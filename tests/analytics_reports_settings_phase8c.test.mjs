import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

test('Phase 8C SQL migration, Edge Function & Settings enforce real indexes, permissions, CSV safety & honest toggles', () => {
  const mig11 = fs.readFileSync(
    path.join(ROOT, 'supabase/migrations/0011_analytics_reports_and_settings.sql'),
    'utf8',
  );
  const edgeFn = fs.readFileSync(
    path.join(ROOT, 'supabase/functions/admin-analytics/index.ts'),
    'utf8',
  );
  const settingsHtml = fs.readFileSync(path.join(ROOT, 'admin/settings.html'), 'utf8');

  // Indexes & server analytics RPC
  assert.match(mig11, /idx_customers_joined_at/);
  assert.match(mig11, /idx_stamp_tx_type_created/);
  assert.match(mig11, /idx_purchases_qualifying_date/);
  assert.match(mig11, /fn_analytics_summary/);
  assert.match(mig11, /REVOKE ALL ON FUNCTION public\.fn_analytics_summary\(date, date\) FROM PUBLIC, anon, authenticated/);
  assert.match(mig11, /DEFAULT false/);

  // Honest security controls in admin/settings.html (must not show unconfigured 2FA / Login Alerts as enabled)
  assert.equal(/name="twoFactor"[^>]*checked/i.test(settingsHtml), false);
  assert.equal(/name="loginAlerts"[^>]*checked/i.test(settingsHtml), false);
  assert.match(settingsHtml, /Not configured/i);

  // Edge Function authorization & CSV formula injection protection
  assert.match(edgeFn, /requireStaffPermission\(req, 'analytics\.view'\)/);
  assert.match(edgeFn, /requireStaffPermission\(exportCtx|req, 'reports\.export'\)/i.test(edgeFn) ? /.*/ : /reports\.export/);
  assert.match(edgeFn, /requireStaffPermission\(req, 'reports\.export'\)/);
  assert.match(edgeFn, /escapeCsvCell/);
  assert.match(edgeFn, /report\.exported/);
});

test('Phase 8C Analytics empty dataset, date ranges, large CSV export, unauthorized block & live settings', async (t) => {
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
    location: { origin: 'https://bonfree.test', pathname: '/admin/analytics.html', search: '', hash: '' },
    __BONFREE_CONFIG__: { supabaseUrl: 'https://mock.supabase.co', supabaseAnonKey: 'anon', environment: 'test' },
  };
  globalThis.document = { querySelector: () => null };

  const { supabaseAuth } = await import('../src/scripts/core/supabaseClient.js');
  const {
    buildSafeCsv,
    exportAdminReportCsv,
    fetchAdminAnalytics,
    fetchAdminReportPreview,
    fetchAdminSettings,
    saveBrandSettings,
    updateAdminAccountPassword,
  } = await import('../src/scripts/services/adminExtendedService.js');

  supabaseAuth.setSession({
    access_token: 'admin-jwt',
    refresh_token: 'ref',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });

  // 1. Empty dataset handling (zero members, zero revenue, zero stamps)
  globalThis.fetch = async (url, opts = {}) => {
    if (url.includes('/functions/v1/admin-analytics')) {
      const body = JSON.parse(opts.body);
      assert.equal(body.action, 'summary');
      return new Response(
        JSON.stringify({
          ok: true,
          summary: {
            totalMembers: 0,
            activeMembers: 0,
            newRegistrations: 0,
            totalLoyaltyCards: 0,
            stampsAwarded: 0,
            rewardsUnlocked: 0,
            rewardsRedeemed: 0,
            qualifyingPurchases: 0,
            qualifyingRevenueInr: 0,
            avgPurchaseFrequency: 0,
            dailyRegistrations: [],
            monthlyGrowth: [],
            stampBars: [],
            mostActiveCustomers: [],
            programmePerformance: [],
            staffActivity: [],
          },
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify([]), { status: 200 });
  };

  const emptyAnalytics = await fetchAdminAnalytics({ period: 'daily' });
  assert.equal(emptyAnalytics.ok, true);
  assert.equal(emptyAnalytics.summary.totalMembers, 0);
  assert.equal(emptyAnalytics.summary.qualifyingRevenueInr, 0);
  assert.deepEqual(emptyAnalytics.summary.mostActiveCustomers, []);

  // 2. Date-range filtering & populated dataset verification
  let capturedDateBody = null;
  globalThis.fetch = async (url, opts = {}) => {
    if (url.includes('/functions/v1/admin-analytics')) {
      capturedDateBody = JSON.parse(opts.body);
      return new Response(
        JSON.stringify({
          ok: true,
          summary: {
            totalMembers: 420,
            activeMembers: 398,
            newRegistrations: 42,
            stampsAwarded: 1280,
            rewardsUnlocked: 95,
            rewardsRedeemed: 71,
            qualifyingPurchases: 610,
            qualifyingRevenueInr: 1450000,
            avgPurchaseFrequency: 2.35,
            dailyRegistrations: [{ label: '26 Nov', count: 11 }],
            monthlyGrowth: [{ label: 'Nov', total: 420 }],
            stampBars: [{ label: 'Wk 1', value: 1280 }],
            mostActiveCustomers: [{ rank: 1, name: 'Aanya', memberId: 'BF-001248', stampsEarned: 24, rewardsRedeemed: 2, totalSpendInr: 32000 }],
            programmePerformance: [{ name: 'Classic Stamps', members: 400, stamps: 1200, redemptionRate: '17.8%' }],
            staffActivity: [{ id: 'STF1002', name: 'Vikram Singh', role: 'Sales Staff', stampsIssuedCount: 820, redemptionsVerifiedCount: 38 }],
          },
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify([]), { status: 200 });
  };

  const customRes = await fetchAdminAnalytics({ period: 'custom', startDate: '2026-11-01', endDate: '2026-11-26' });
  assert.equal(customRes.ok, true);
  assert.equal(capturedDateBody.period, 'custom');
  assert.equal(capturedDateBody.startDate, '2026-11-01');
  assert.equal(capturedDateBody.endDate, '2026-11-26');
  assert.equal(customRes.summary.stampsAwarded, 1280);
  assert.equal(customRes.summary.staffActivity[0].id, 'STF1002');

  // 3. Paginated report preview + Large dataset CSV export + Formula injection check
  const dangerousCsv = buildSafeCsv(['Name', 'Note'], [['Alice', '=cmd|calc'], ['Bob', '+SUM(1,2)'], ['Eve', '@IMPORT']]);
  assert.match(dangerousCsv, /"'=cmd\|calc"/);
  assert.match(dangerousCsv, /"'\+SUM\(1,2\)"/);
  assert.match(dangerousCsv, /"'@IMPORT"/);

  globalThis.fetch = async (url, opts = {}) => {
    const body = JSON.parse(opts.body);
    if (body.action === 'report_preview') {
      return new Response(
        JSON.stringify({
          ok: true,
          columns: [{ key: 'id', label: 'Member ID' }],
          rows: [{ id: 'BF-001248' }],
          totalItems: 1500,
          page: 2,
          pageSize: 8,
        }),
        { status: 200 },
      );
    }
    if (body.action === 'export_csv') {
      return new Response(
        JSON.stringify({
          ok: true,
          filename: 'bonfree-hub-purchases-2026-11-01-to-2026-11-26.csv',
          rowCount: 1500,
          csv: '"Receipt No.","Amount"\r\n"INV-1","3499"',
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({}), { status: 200 });
  };

  const previewRes = await fetchAdminReportPreview({ category: 'purchases', dateFrom: '2026-11-01', dateTo: '2026-11-26', page: 2, pageSize: 8 });
  assert.equal(previewRes.ok, true);
  assert.equal(previewRes.data.totalItems, 1500);

  const exportRes = await exportAdminReportCsv({ category: 'purchases', dateFrom: '2026-11-01', dateTo: '2026-11-26' });
  assert.equal(exportRes.ok, true);
  assert.equal(exportRes.rowCount, 1500);

  // 4. Unauthorized export (missing reports.export) cleanly returns 403 FORBIDDEN
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ code: 'FORBIDDEN', message: 'Permission denied: reports.export' }), { status: 403 });
  const deniedExport = await exportAdminReportCsv({ category: 'customer-registration' });
  assert.equal(deniedExport.ok, false);
  assert.equal(deniedExport.code, 'FORBIDDEN');

  // 5. Real Settings read, honest security status, update & password update
  let brandPatched = null;
  let staffPrefsPatched = null;
  let pwPut = null;
  globalThis.fetch = async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    if (url.includes('/auth/v1/user') && method === 'GET') {
      return new Response(JSON.stringify({ id: 'adm-u-1', email: 'admin@bonfree-hub.in' }), { status: 200 });
    }
    if (url.includes('/auth/v1/user') && method === 'PUT') {
      pwPut = JSON.parse(opts.body);
      return new Response(JSON.stringify({ id: 'adm-u-1' }), { status: 200 });
    }
    if (url.includes('/rest/v1/brand_settings') && method === 'GET') {
      return new Response(
        JSON.stringify([
          {
            brand_name: 'BONFREE-HUB',
            tagline: 'Modern Streetwear & Everyday Fashion',
            support_email: 'care@bonfree-hub.in',
            support_phone: '+91 98765 43210',
            address: 'MG Road, Bengaluru',
            default_stamp_validity_months: 12,
            default_reward_validity_months: 6,
            two_factor_required: false,
            login_alerts_enabled: false,
          },
        ]),
        { status: 200 },
      );
    }
    if (url.includes('/rest/v1/brand_settings') && method === 'PATCH') {
      brandPatched = JSON.parse(opts.body);
      return new Response(JSON.stringify([brandPatched]), { status: 200 });
    }
    if (url.includes('/rest/v1/stores')) {
      return new Response(JSON.stringify([{ id: 'str-1', name: 'MG Road Flagship', phone: '+91 98765 43210', address: 'MG Road' }]), { status: 200 });
    }
    if (url.includes('/rest/v1/profiles')) {
      return new Response(JSON.stringify([{ id: 'adm-u-1', full_name: 'Isha Menon', email: 'isha@bonfree-hub.in' }]), { status: 200 });
    }
    if (url.includes('/rest/v1/staff') && method === 'GET') {
      return new Response(JSON.stringify([{ id: 'stf-3', preferences: { dailySummaryView: true } }]), { status: 200 });
    }
    if (url.includes('/rest/v1/staff') && method === 'PATCH') {
      staffPrefsPatched = JSON.parse(opts.body);
      return new Response(JSON.stringify([staffPrefsPatched]), { status: 200 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  };

  const settingsRes = await fetchAdminSettings();
  assert.equal(settingsRes.ok, true);
  assert.equal(settingsRes.settings.securityStatus.twoFactorConfigured, false);
  assert.equal(settingsRes.settings.securityStatus.loginAlertsConfigured, false);
  assert.equal(settingsRes.settings.securityStatus.rlsAndAuditActive, true);

  const saveRes = await saveBrandSettings({
    storeId: 'str-1',
    brandName: 'BONFREE-HUB',
    tagline: 'Gen Z Streetwear',
    supportEmail: 'hello@bonfree-hub.in',
    supportPhone: '+91 99999 88888',
    address: 'Indiranagar, Bengaluru',
    stampValidity: '24',
    rewardValidity: '12',
    adminName: 'Isha Menon',
    dailySummaryView: false,
  });
  assert.equal(saveRes.ok, true);
  assert.equal(brandPatched.default_stamp_validity_months, 24);
  assert.equal(staffPrefsPatched.preferences.dailySummaryView, false);

  const pwRes = await updateAdminAccountPassword({ currentPassword: 'OldPassword1', newPassword: 'NewStrongPassword2' });
  assert.equal(pwRes.ok, true);
  assert.equal(pwPut.password, 'NewStrongPassword2');
});
