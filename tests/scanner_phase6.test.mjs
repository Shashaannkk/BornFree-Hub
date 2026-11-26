import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function setupLiveMockBrowser(t) {
  const originalFetch = globalThis.fetch;
  const storage = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };
  globalThis.window = {
    location: { origin: 'https://bonfree.test', pathname: '/admin/scanner.html', search: '', hash: '' },
    history: { replaceState: () => {} },
    __BONFREE_CONFIG__: {
      supabaseUrl: 'https://mock-project.supabase.co',
      supabaseAnonKey: 'mock-anon-key',
      environment: 'test',
    },
  };
  globalThis.document = { querySelector: () => null };

  t.after(() => {
    globalThis.fetch = originalFetch;
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.sessionStorage;
  });
}

test('Phase 6 SQL migration & Edge Function enforce cooldown, FOR UPDATE locking, idempotency & zero client stamp trust', () => {
  const mig7 = fs.readFileSync(
    path.join(ROOT, 'supabase/migrations/0007_stamp_cooldown_and_idempotency.sql'),
    'utf8',
  );
  assert.match(mig7, /cooldown_minutes integer NOT NULL DEFAULT 0/);
  assert.match(mig7, /FOR UPDATE/);
  assert.match(mig7, /COOLDOWN_ACTIVE/);
  assert.match(mig7, /IDEMPOTENCY_KEY_CONFLICT/);
  assert.match(mig7, /INSERT INTO public\.audit_logs/);
  assert.match(mig7, /REVOKE ALL ON FUNCTION public\.fn_award_stamps/);

  const ef = fs.readFileSync(path.join(ROOT, 'supabase/functions/issue-stamp/index.ts'), 'utf8');
  assert.match(ef, /requireStaffPermission\(req, 'stamps\.issue'\)/);
  assert.match(ef, /INVALID_QR_TOKEN/);
  assert.match(ef, /DUPLICATE_RECEIPT/);
  assert.match(ef, /COOLDOWN_ACTIVE/);
});

test('Phase 6 Valid purchase, no client stamp trust, network retry idempotency, duplicates, cooldown & unauthorized staff', async (t) => {
  setupLiveMockBrowser(t);

  const { supabaseAuth } = await import('../src/scripts/core/supabaseClient.js');
  const {
    signInStaff,
    lookupMemberLive,
    awardStampsForPurchase,
    fetchStampTransactions,
    createIdempotencyKey,
  } = await import('../src/scripts/services/adminService.js');

  // 1. Unauthorized customer account rejected from staff login
  globalThis.fetch = async (url) => {
    if (url.includes('/auth/v1/token')) {
      return new Response(
        JSON.stringify({
          access_token: 'cust-jwt',
          refresh_token: 'cust-ref',
          expires_in: 3600,
          user: { id: 'cust-u-1', email: 'customer@bonfree.test' },
        }),
        { status: 200 },
      );
    }
    if (url.includes('/rest/v1/staff')) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  };

  const unauthStaff = await signInStaff({ email: 'customer@bonfree.test', password: 'Password1' });
  assert.equal(unauthStaff.ok, false);
  assert.equal(unauthStaff.code, 'UNAUTHORIZED_STAFF_LOGIN');
  assert.equal(supabaseAuth.getSession(), null);

  // 2. Authorized staff sign in
  globalThis.fetch = async (url) => {
    if (url.includes('/auth/v1/token')) {
      return new Response(
        JSON.stringify({
          access_token: 'staff-jwt-123',
          refresh_token: 'staff-ref-123',
          expires_in: 3600,
          user: { id: 'staff-u-1', email: 'staff@bonfree.test' },
        }),
        { status: 200 },
      );
    }
    if (url.includes('/rest/v1/staff')) {
      return new Response(
        JSON.stringify([{ id: 'stf-1', staff_code: 'STF1002', status: 'active', roles: { code: 'sales_staff' } }]),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({}), { status: 200 });
  };

  const authStaff = await signInStaff({ email: 'staff@bonfree.test', password: 'Password1' });
  assert.equal(authStaff.ok, true);

  // 3. Invalid purchase amount rejected client-side
  const invalidAmt = await awardStampsForPurchase({
    customerId: 'BF-001248',
    purchaseRef: 'INV-100',
    amountInr: -50,
    calculatedStamps: 99,
  });
  assert.equal(invalidAmt.ok, false);
  assert.equal(invalidAmt.code, 'VALIDATION_ERROR');

  // 4. QR lookup + interrupted network request + safe idempotent retry + no client stamp count sent
  const idemKey = createIdempotencyKey('BF-001248', 'INV-LIVE-777');
  let capturedPayload = null;
  let attempt = 0;

  globalThis.fetch = async (url, opts = {}) => {
    if (url.includes('/rest/v1/rpc/fn_lookup_member_by_qr_or_query')) {
      return new Response(
        JSON.stringify({
          customer_id: 'cust-uuid-1',
          membership_id: 'BF-001248',
          qr_token: 'BFQR-001248A9C4E2',
          status: 'active',
          full_name: 'Aanya Sharma',
          email: 'aanya@bonfree.test',
          phone: '+91 98765 43210',
          cards: [
            {
              programme_id: 'prog-uuid-1',
              programme_name: 'Classic Stamps',
              programme_status: 'active',
              is_programme_valid: true,
              stamp_goal: 10,
              qualifying_amount_inr: 1000,
              calculation_rule: 'per_threshold',
              current_stamps: 4,
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.includes('/functions/v1/issue-stamp')) {
      attempt += 1;
      capturedPayload = JSON.parse(opts.body);
      if (attempt === 1) {
        throw new Error('Simulated network drop');
      }
      return new Response(
        JSON.stringify({
          ok: true,
          idempotentReplay: false,
          result: {
            purchase_id: 'pur-uuid-1',
            transaction_id: 'tx-uuid-1',
            transaction_code: 'TXN-20261126-10001',
            stamps_awarded: 3,
            new_balance: 7,
          },
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify([]), { status: 200 });
  };

  const member = await lookupMemberLive('BFQR-001248A9C4E2');
  assert.equal(member.ok, true);
  assert.equal(member.customer.uuid, 'cust-uuid-1');

  // First attempt drops on network
  const dropRes = await awardStampsForPurchase({
    customerId: member.customer.id,
    customerUuid: member.customer.uuid,
    qrToken: member.customer.qrToken,
    programmeId: member.programme.id,
    purchaseRef: 'INV-LIVE-777',
    amountInr: 3499,
    idempotencyKey: idemKey,
    calculatedStamps: 999, // Tampered preview value must NEVER be sent to backend
    programme: { status: 'active' },
  });
  assert.equal(dropRes.ok, false);
  assert.equal(dropRes.code, 'NETWORK_ERROR');
  assert.equal('calculatedStamps' in capturedPayload, false);
  assert.equal('stamps' in capturedPayload, false);
  assert.equal(capturedPayload.idempotencyKey, idemKey);

  // Safe retry with same idempotencyKey succeeds with server-calculated stamps (3)
  const retryRes = await awardStampsForPurchase({
    customerId: member.customer.id,
    customerUuid: member.customer.uuid,
    qrToken: member.customer.qrToken,
    programmeId: member.programme.id,
    purchaseRef: 'INV-LIVE-777',
    amountInr: 3499,
    idempotencyKey: idemKey,
    calculatedStamps: 999,
    programme: { status: 'active' },
  });
  assert.equal(retryRes.ok, true);
  assert.equal(retryRes.result.stamps_awarded, 3);
  assert.equal(retryRes.result.new_balance, 7);

  // 5. Duplicate receipt & Cooldown responses mapped accurately
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ code: 'DUPLICATE_RECEIPT', message: 'Duplicate purchase receipt detected.' }), { status: 409 });
  const dupRes = await awardStampsForPurchase({
    customerId: 'BF-001248',
    customerUuid: 'cust-uuid-1',
    programmeId: 'prog-uuid-1',
    purchaseRef: 'INV-LIVE-777',
    amountInr: 3499,
    idempotencyKey: createIdempotencyKey('BF-001248', 'INV-LIVE-777'),
  });
  assert.equal(dupRes.ok, false);
  assert.equal(dupRes.code, 'DUPLICATE_RECEIPT');

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ code: 'COOLDOWN_ACTIVE', message: 'Cooldown period active.' }), { status: 429 });
  const cdRes = await awardStampsForPurchase({
    customerId: 'BF-001248',
    customerUuid: 'cust-uuid-1',
    programmeId: 'prog-uuid-1',
    purchaseRef: 'INV-LIVE-778',
    amountInr: 2000,
    idempotencyKey: createIdempotencyKey('BF-001248', 'INV-LIVE-778'),
  });
  assert.equal(cdRes.ok, false);
  assert.equal(cdRes.code, 'COOLDOWN_ACTIVE');

  // 6. Live Stamp Transactions fetch maps Supabase joins cleanly
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify([
        {
          id: 'tx-uuid-1',
          transaction_code: 'TXN-20261126-10001',
          tx_type: 'earned',
          stamps_delta: 3,
          balance_after: 7,
          status: 'awarded',
          created_at: '2026-11-26T13:45:00Z',
          customers: { membership_id: 'BF-001248', profiles: { full_name: 'Aanya Sharma', phone: '+91 98765 43210' } },
          staff: { staff_code: 'STF1002' },
          purchases: { receipt_no: 'INV-LIVE-777', amount_inr: 3499, stores: { name: 'MG Road' } },
          loyalty_programmes: { name: 'Classic Stamps' },
        },
      ]),
      { status: 200 },
    );

  const txFeed = await fetchStampTransactions();
  assert.equal(txFeed.ok, true);
  assert.equal(txFeed.source, 'supabase-live');
  assert.equal(txFeed.rows[0].id, 'TXN-20261126-10001');
  assert.equal(txFeed.rows[0].stampsAwarded, 3);
  assert.equal(txFeed.rows[0].purchaseRef, 'INV-LIVE-777');
});
