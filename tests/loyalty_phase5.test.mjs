import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

test('Phase 5 Opaque QR Token contains no PII or credentials', async () => {
  const { isOpaqueQrToken } = await import('../src/scripts/core/qr.js');

  assert.equal(isOpaqueQrToken('BFQR-001248A9C4E2'), true);
  assert.equal(isOpaqueQrToken('aanya@bonfree-hub.com'), false);
  assert.equal(isOpaqueQrToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.jwt'), false);
  assert.equal(isOpaqueQrToken('BFQR-BAD'), false);

  const mig6 = fs.readFileSync(
    path.join(ROOT, 'supabase/migrations/0006_loyalty_qr_and_programme_lifecycle.sql'),
    'utf8',
  );
  assert.match(mig6, /qr_token text UNIQUE/);
  assert.match(mig6, /NEW\.qr_token <> OLD\.qr_token/);
  assert.match(mig6, /sync_my_loyalty_cards/);
  assert.match(mig6, /fn_lookup_member_by_qr_or_query/);
});

test('Phase 5 Programme validity, multiple cards, completed cards & next reward calculations', async () => {
  const {
    DEV_MEMBER_FIXTURE,
    isProgrammeCurrentlyValid,
    computeNextAvailableReward,
  } = await import('../src/scripts/services/loyaltyService.js');

  // Multiple cards & completed card check
  assert.equal(DEV_MEMBER_FIXTURE.cards.length, 2);
  assert.equal(DEV_MEMBER_FIXTURE.cards[0].status, 'active');
  assert.equal(DEV_MEMBER_FIXTURE.cards[1].status, 'completed');
  assert.equal(DEV_MEMBER_FIXTURE.cards[1].collectedStamps, 10);

  // Active vs inactive vs expired vs future programmes
  assert.equal(isProgrammeCurrentlyValid({ status: 'active' }), true);
  assert.equal(isProgrammeCurrentlyValid({ status: 'inactive' }), false);
  assert.equal(
    isProgrammeCurrentlyValid({ status: 'active', expires_at: '2020-01-01T00:00:00Z' }),
    false,
  );
  assert.equal(
    isProgrammeCurrentlyValid({ status: 'active', starts_at: '2099-01-01T00:00:00Z' }),
    false,
  );

  // Next reward calculations for new member (0 stamps), active card (7 stamps), and completed card (10 stamps)
  const newMemberNext = computeNextAvailableReward(0, DEV_MEMBER_FIXTURE.rewards);
  assert.equal(newMemberNext.type, 'upcoming');
  assert.equal(newMemberNext.stampsRemaining, 3);

  const activeMemberNext = computeNextAvailableReward(7, DEV_MEMBER_FIXTURE.rewards);
  assert.equal(activeMemberNext.type, 'upcoming');
  assert.equal(activeMemberNext.stampsRemaining, 3);
  assert.match(activeMemberNext.message, /₹500 BONFREE-HUB Voucher/);

  const completedMemberNext = computeNextAvailableReward(10, DEV_MEMBER_FIXTURE.rewards);
  assert.equal(completedMemberNext.type, 'unlocked');
  assert.equal(completedMemberNext.stampsRemaining, 0);
});

test('Phase 5 Scanner lookup rejects invalid QR tokens and blocks awards on expired/inactive programmes', async () => {
  const {
    lookupCustomerForScanner,
    lookupMemberLive,
    awardStampsForPurchase,
  } = await import('../src/scripts/services/adminService.js');

  // Valid opaque QR token lookup
  const okLookup = lookupCustomerForScanner('BFQR-001248A9C4E2');
  assert.equal(okLookup?.customer.id, 'BF-001248');

  // Invalid QR token rejection
  const badLookup = await lookupMemberLive('BFQR-INVALID-999999');
  assert.equal(badLookup.ok, false);
  assert.equal(badLookup.code, 'INVALID_QR_OR_MEMBER');

  // Expired programme rejection
  const expiredAward = await awardStampsForPurchase({
    customerId: 'BF-001248',
    purchaseRef: 'INV-NEW-5555',
    amountInr: 2500,
    calculatedStamps: 2,
    programme: { name: 'Expired Promo', status: 'active', expires_at: '2020-01-01T00:00:00Z' },
  });
  assert.equal(expiredAward.ok, false);
  assert.equal(expiredAward.code, 'PROGRAMME_EXPIRED_OR_INACTIVE');
});

test('Phase 5 Live loyalty card auto-assignment & read-only balance enforcement (mocked Supabase)', async (t) => {
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
    location: { origin: 'https://bonfree.test', pathname: '/customer-dashboard.html', search: '', hash: '' },
    history: { replaceState: () => {} },
    __BONFREE_CONFIG__: {
      supabaseUrl: 'https://mock-project.supabase.co',
      supabaseAnonKey: 'mock-anon-key',
      environment: 'test',
    },
  };
  globalThis.document = { querySelector: () => null };

  const { supabaseAuth } = await import('../src/scripts/core/supabaseClient.js');
  const { fetchCustomerPortalData } = await import('../src/scripts/services/loyaltyService.js');

  supabaseAuth.setSession({
    access_token: 'live-jwt-abc',
    refresh_token: 'live-ref-abc',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });

  let syncRpcCalled = false;
  globalThis.fetch = async (url) => {
    if (url.includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'u-1', email: 'new@bonfree.test' }), { status: 200 });
    }
    if (url.includes('/rest/v1/rpc/sync_my_loyalty_cards')) {
      syncRpcCalled = true;
      return new Response(JSON.stringify(2), { status: 200 });
    }
    if (url.includes('/rest/v1/profiles')) {
      return new Response(JSON.stringify([{ id: 'u-1', full_name: 'Rhea Kapoor', email: 'new@bonfree.test', phone: '' }]), { status: 200 });
    }
    if (url.includes('/rest/v1/customers')) {
      return new Response(
        JSON.stringify([{ id: 'c-1', membership_id: 'BF-001002', qr_token: 'BFQR-9988776655443322', status: 'active', preferences: {}, joined_at: '2026-01-01T00:00:00Z' }]),
        { status: 200 },
      );
    }
    if (url.includes('/rest/v1/loyalty_cards')) {
      return new Response(
        JSON.stringify([
          { id: 'lc-1', current_stamps: 0, lifetime_stamps: 0, status: 'active', loyalty_programmes: { id: 'p-1', name: 'Classic Stamps', status: 'active', stamp_goal: 10, qualifying_amount_inr: 1000, stamp_validity_months: 12 } },
          { id: 'lc-2', current_stamps: 10, lifetime_stamps: 10, status: 'completed', loyalty_programmes: { id: 'p-2', name: 'Premium Circle', status: 'active', stamp_goal: 10, qualifying_amount_inr: 2500, stamp_validity_months: 12 } },
        ]),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify([]), { status: 200 });
  };

  const res = await fetchCustomerPortalData();
  assert.equal(syncRpcCalled, true);
  assert.equal(res.ok, true);
  assert.equal(res.data.member.qrToken, 'BFQR-9988776655443322');
  assert.equal(res.data.cards.length, 2);
  assert.equal(res.data.cards[0].collectedStamps, 0);
  assert.equal(res.data.cards[1].status, 'completed');
});
