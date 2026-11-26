import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

test('Phase 8B SQL migration enforces campaign validity, stamp cap safety, survey closing & duplicate response prevention', () => {
  const mig10 = fs.readFileSync(
    path.join(ROOT, 'supabase/migrations/0010_campaigns_and_surveys_lifecycle.sql'),
    'utf8',
  );

  // Campaigns storage & validity
  assert.match(mig10, /'campaign-images'/);
  assert.match(mig10, /has_permission\('campaigns\.manage'\)/);
  assert.match(mig10, /is_campaign_currently_valid/);
  assert.match(mig10, /trg_audit_campaigns_dml/);
  assert.match(mig10, /v_prog\.max_stamps_per_tx/);

  // Surveys publish/close & duplicate prevention
  assert.match(mig10, /CHECK \(status IN \('draft', 'published', 'closed', 'archived'\)\)/);
  assert.match(mig10, /eligible_programme_id/);
  assert.match(mig10, /s\.status = 'published'/);
  assert.match(mig10, /fn_submit_survey_response/);
  assert.match(mig10, /DUPLICATE_SURVEY_SUBMISSION/);
  assert.match(mig10, /SURVEY_NOT_OPEN/);
  assert.match(mig10, /SURVEY_ELIGIBILITY_NOT_MET/);
  assert.match(mig10, /REVOKE ALL ON FUNCTION public\.fn_submit_survey_response\(uuid, smallint, jsonb\) FROM PUBLIC, anon/);
});

test('Phase 8B Campaign scheduling, expired offers, image upload & customer eligibility filtering', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.sessionStorage;
  });

  const {
    deriveCampaignDisplayStatus,
    saveCampaign,
    uploadCampaignImage,
    toggleCampaignStatus,
  } = await import('../src/scripts/services/adminExtendedService.js');
  const { isCampaignCurrentlyValid } = await import('../src/scripts/services/loyaltyService.js');

  const today = new Date('2026-11-26T12:00:00Z');
  assert.equal(deriveCampaignDisplayStatus({ status: 'active', startDate: '2026-11-01', endDate: '2026-12-10' }, today), 'Active');
  assert.equal(deriveCampaignDisplayStatus({ status: 'active', startDate: '2026-12-01', endDate: '2026-12-31' }, today), 'Scheduled');
  assert.equal(deriveCampaignDisplayStatus({ status: 'active', startDate: '2026-10-01', endDate: '2026-10-31' }, today), 'Completed');
  assert.equal(deriveCampaignDisplayStatus({ status: 'inactive', startDate: '2026-11-01', endDate: '2026-12-10' }, today), 'Inactive');

  const enrolledSet = new Set(['prog-classic']);
  assert.equal(isCampaignCurrentlyValid({ status: 'active', start_date: '2026-11-01', end_date: '2026-12-10', programme_id: 'prog-classic' }, enrolledSet, today), true);
  assert.equal(isCampaignCurrentlyValid({ status: 'active', start_date: '2026-11-01', end_date: '2026-12-10', programme_id: 'prog-premium' }, enrolledSet, today), false);
  assert.equal(isCampaignCurrentlyValid({ status: 'active', start_date: '2026-10-01', end_date: '2026-10-31', programme_id: null }, enrolledSet, today), false);

  // Date & image validation
  const badDates = await saveCampaign({ title: 'Bad Dates', startDate: '2026-12-10', endDate: '2026-12-01' });
  assert.equal(badDates.ok, false);
  assert.equal(badDates.code, 'VALIDATION_ERROR');

  const badImg = await uploadCampaignImage({ name: 'script.js', type: 'application/javascript', size: 120 });
  assert.equal(badImg.ok, false);
  assert.equal(badImg.code, 'VALIDATION_ERROR');

  // Live campaign save & toggle
  const storage = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };
  globalThis.window = {
    location: { origin: 'https://bonfree.test', pathname: '/admin/campaigns.html', search: '', hash: '' },
    __BONFREE_CONFIG__: { supabaseUrl: 'https://mock.supabase.co', supabaseAnonKey: 'anon', environment: 'test' },
  };
  globalThis.document = { querySelector: () => null };

  const { supabaseAuth } = await import('../src/scripts/core/supabaseClient.js');
  supabaseAuth.setSession({
    access_token: 'admin-jwt',
    refresh_token: 'ref',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });

  let insertedCamp = null;
  let patchedCampStatus = null;
  globalThis.fetch = async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    if (url.includes('/rest/v1/campaigns') && method === 'POST') {
      insertedCamp = JSON.parse(opts.body);
      return new Response(JSON.stringify([{ id: 'camp-live-1', ...insertedCamp }]), { status: 201 });
    }
    if (url.includes('/rest/v1/campaigns') && method === 'PATCH') {
      patchedCampStatus = JSON.parse(opts.body).status;
      return new Response(JSON.stringify([{ id: 'camp-live-1', status: patchedCampStatus }]), { status: 200 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  };

  const liveSave = await saveCampaign({
    title: 'Denim Days Live',
    description: 'Baggy fits bonus stamps.',
    programmeId: 'prog-classic',
    multiplier: 2,
    bonusStamps: 1,
    minPurchaseInr: 2000,
    startDate: '2026-11-26',
    endDate: '2026-12-31',
    status: 'Active',
  });
  assert.equal(liveSave.ok, true);
  assert.equal(insertedCamp.multiplier, 2);
  assert.equal(insertedCamp.bonus_stamps, 1);

  const toggleRes = await toggleCampaignStatus({ campaignId: 'camp-live-1', nextStatus: 'inactive' });
  assert.equal(toggleRes.ok, true);
  assert.equal(patchedCampStatus, 'inactive');
});

test('Phase 8B Survey creation, publication, customer submission, duplicate block & analytics summary', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.sessionStorage;
  });

  const storage = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };
  globalThis.window = {
    location: { origin: 'https://bonfree.test', pathname: '/admin/surveys.html', search: '', hash: '' },
    __BONFREE_CONFIG__: { supabaseUrl: 'https://mock.supabase.co', supabaseAnonKey: 'anon', environment: 'test' },
  };
  globalThis.document = { querySelector: () => null };

  const { supabaseAuth } = await import('../src/scripts/core/supabaseClient.js');
  const {
    computeSurveyAnalytics,
    fetchAdminSurveys,
    saveSurvey,
    updateSurveyStatus,
  } = await import('../src/scripts/services/adminExtendedService.js');
  const {
    fetchCustomerPortalData,
    submitSurveyResponse,
  } = await import('../src/scripts/services/loyaltyService.js');

  supabaseAuth.setSession({
    access_token: 'live-jwt',
    refresh_token: 'ref',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });

  // Analytics calculation check
  const stats = computeSurveyAnalytics(
    [{ id: 'q-mc', type: 'multiple_choice', options: ['Oversized Tees', 'Baggy Jeans'] }],
    [
      { overall_rating: 5, favorite: 'Oversized Tees' },
      { overall_rating: 4, favorite: 'Oversized Tees' },
      { overall_rating: 3, favorite: 'Baggy Jeans' },
    ],
  );
  assert.equal(stats.totalResponses, 3);
  assert.equal(stats.avgRating, '4.0');
  assert.equal(stats.topFeedback[0].pct, 67);

  // Live save draft -> publish -> fetch analytics -> customer portal -> customer submit -> duplicate block -> close
  let surveyStatusDb = 'draft';
  let submittedOnce = false;

  globalThis.fetch = async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();

    if (url.includes('/rest/v1/surveys') && method === 'POST') {
      surveyStatusDb = JSON.parse(opts.body).status;
      return new Response(JSON.stringify([{ id: 'srv-live-1', status: surveyStatusDb }]), { status: 201 });
    }
    if (url.includes('/rest/v1/surveys') && method === 'PATCH') {
      surveyStatusDb = JSON.parse(opts.body).status;
      return new Response(JSON.stringify([{ id: 'srv-live-1', status: surveyStatusDb }]), { status: 200 });
    }
    if (url.includes('/rest/v1/survey_questions') && method === 'POST') {
      return new Response(opts.body, { status: 201 });
    }
    if (url.includes('/rest/v1/surveys') && method === 'GET') {
      return new Response(
        JSON.stringify([
          {
            id: 'srv-live-1',
            title: 'Winter Drop Survey',
            subtitle: 'Tell us your favorite fits.',
            eligible_programme_id: null,
            status: 'published',
            loyalty_programmes: null,
            survey_questions: [
              { id: 'q-1', question_type: 'rating', prompt: 'Overall rating', options: [], sort_order: 1, is_required: true },
              { id: 'q-2', question_type: 'multiple_choice', prompt: 'Favorite item', options: ['Tees', 'Cargos'], sort_order: 2, is_required: true },
            ],
          },
        ]),
        { status: 200 },
      );
    }
    if (url.includes('/rest/v1/survey_questions') && method === 'GET') {
      return new Response(
        JSON.stringify([
          { id: 'q-1', survey_id: 'srv-live-1', question_type: 'rating', prompt: 'Overall rating', options: [], sort_order: 1 },
          { id: 'q-2', survey_id: 'srv-live-1', question_type: 'multiple_choice', prompt: 'Favorite item', options: ['Tees', 'Cargos'], sort_order: 2 },
        ]),
        { status: 200 },
      );
    }
    if (url.includes('/rest/v1/survey_responses') && method === 'GET') {
      return new Response(
        JSON.stringify([
          { id: 'r-1', survey_id: 'srv-live-1', overall_rating: 5, answers: { favoriteCollection: 'Tees' }, submitted_at: '2026-11-26T12:00:00Z', customers: { membership_id: 'BF-001248', profiles: { full_name: 'Aanya' } } },
        ]),
        { status: 200 },
      );
    }
    if (url.includes('/rest/v1/rpc/fn_submit_survey_response')) {
      if (surveyStatusDb !== 'published') {
        return new Response(JSON.stringify({ message: 'SURVEY_NOT_OPEN' }), { status: 400 });
      }
      if (submittedOnce) {
        return new Response(JSON.stringify({ message: 'DUPLICATE_SURVEY_SUBMISSION' }), { status: 409 });
      }
      submittedOnce = true;
      return new Response(JSON.stringify('resp-uuid-1'), { status: 200 });
    }
    if (url.includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'u-1' }), { status: 200 });
    }
    if (url.includes('/rest/v1/rpc/sync_my_loyalty_cards')) {
      return new Response(JSON.stringify(0), { status: 200 });
    }
    if (url.includes('/rest/v1/profiles')) {
      return new Response(JSON.stringify([{ id: 'u-1', full_name: 'Aanya', email: 'aanya@bonfree.test' }]), { status: 200 });
    }
    if (url.includes('/rest/v1/customers')) {
      return new Response(JSON.stringify([{ id: 'c-1', membership_id: 'BF-001248', qr_token: 'BFQR-001248A9C4E2', status: 'active' }]), { status: 200 });
    }
    if (url.includes('/rest/v1/campaigns')) {
      return new Response(
        JSON.stringify([
          { id: 'c-act', title: 'New Drop Rewards', description: '2x stamps', image_path: 'assets/images/hero-streetwear.jpg', programme_id: null, multiplier: 2, bonus_stamps: 0, start_date: '2026-11-01', end_date: '2026-12-31', status: 'active' },
          { id: 'c-exp', title: 'Expired Drop', description: 'Old', image_path: '', programme_id: null, multiplier: 2, bonus_stamps: 0, start_date: '2025-01-01', end_date: '2025-01-10', status: 'active' },
        ]),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify([]), { status: 200 });
  };

  const draftRes = await saveSurvey({
    title: 'Winter Drop Survey',
    status: 'Published',
    questions: [
      { type: 'rating', prompt: 'Overall rating', options: [] },
      { type: 'multiple_choice', prompt: 'Favorite item', options: ['Tees', 'Cargos'] },
    ],
  });
  assert.equal(draftRes.ok, true);
  assert.equal(draftRes.surveyId, 'srv-live-1');

  const adminSurveys = await fetchAdminSurveys();
  assert.equal(adminSurveys.ok, true);
  assert.equal(adminSurveys.surveys[0].totalResponses, 1);
  assert.equal(adminSurveys.surveys[0].avgRating, '5.0');

  const portal = await fetchCustomerPortalData();
  assert.equal(portal.ok, true);
  assert.equal(portal.data.campaigns.length, 1); // Expired Drop excluded!
  assert.equal(portal.data.surveys.length, 1);
  assert.equal(portal.data.surveys[0].submitted, true);

  // First submission succeeds, duplicate fails with DUPLICATE_SURVEY_SUBMISSION
  const sub1 = await submitSurveyResponse({ surveyId: 'srv-live-1', rating: 5, answers: { favoriteCollection: 'Tees' } });
  assert.equal(sub1.ok, true);

  const subDup = await submitSurveyResponse({ surveyId: 'srv-live-1', rating: 5, answers: { favoriteCollection: 'Tees' } });
  assert.equal(subDup.ok, false);
  assert.equal(subDup.code, 'DUPLICATE_SURVEY_SUBMISSION');

  // Closing survey blocks new submissions
  await updateSurveyStatus({ surveyId: 'srv-live-1', status: 'closed' });
  submittedOnce = false;
  const subClosed = await submitSurveyResponse({ surveyId: 'srv-live-1', rating: 4, answers: {} });
  assert.equal(subClosed.ok, false);
  assert.equal(subClosed.code, 'SURVEY_NOT_OPEN');
});
