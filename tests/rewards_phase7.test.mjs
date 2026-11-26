import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

test('Phase 7 SQL migration & Edge Function enforce auto-unlocking, stamp consumption, voucher uniqueness & concurrency', () => {
  const mig8 = fs.readFileSync(
    path.join(ROOT, 'supabase/migrations/0008_rewards_redemption_lifecycle.sql'),
    'utf8',
  );
  const edgeFn = fs.readFileSync(
    path.join(ROOT, 'supabase/functions/redeem-reward/index.ts'),
    'utf8',
  );

  // Database constraints & security primitives
  assert.match(mig8, /eligibility_rule text NOT NULL/);
  assert.match(mig8, /eligibility_config jsonb NOT NULL/);
  assert.match(mig8, /trg_audit_rewards_dml/);
  assert.match(mig8, /uniq_open_customer_reward[\s\S]*WHERE status IN \('available', 'pending'\)/);
  assert.match(mig8, /uniq_redemptions_voucher_code/);
  assert.match(mig8, /fn_generate_unique_voucher_code/);
  assert.match(mig8, /fn_customer_meets_reward_eligibility/);
  assert.match(mig8, /fn_sync_customer_unlocked_rewards/);
  assert.match(mig8, /FOR UPDATE/);
  assert.match(mig8, /REDEMPTION_ALREADY_PENDING/);
  assert.match(mig8, /VOUCHER_ALREADY_REDEEMED/);
  assert.match(mig8, /VOUCHER_EXPIRED/);
  assert.match(mig8, /REVOKE ALL ON FUNCTION public\.fn_request_redemption\(uuid, uuid, text\) FROM PUBLIC, anon, authenticated/);
  assert.match(mig8, /REVOKE ALL ON FUNCTION public\.fn_verify_voucher\(text\) FROM PUBLIC, anon, authenticated/);
  assert.match(mig8, /REVOKE ALL ON FUNCTION public\.fn_process_redemption\(uuid, uuid, uuid, text, text, text\) FROM PUBLIC, anon, authenticated/);
  assert.match(mig8, /GRANT EXECUTE ON FUNCTION public\.fn_process_redemption\(uuid, uuid, uuid, text, text, text\) TO service_role/);

  // Edge Function RBAC and semantic error codes
  assert.match(edgeFn, /requireAuthenticatedUser/);
  assert.match(edgeFn, /requireStaffPermission\(req, 'redemptions\.verify'\)/);
  assert.match(edgeFn, /INSUFFICIENT_STAMPS/);
  assert.match(edgeFn, /REDEMPTION_ALREADY_PENDING/);
  assert.match(edgeFn, /VOUCHER_ALREADY_REDEEMED/);
  assert.match(edgeFn, /VOUCHER_EXPIRED/);
});

test('Phase 7 Complete E2E lifecycle (Purchase -> Stamps -> Auto-Unlock -> Voucher -> Verify -> Complete & Security Guards)', async (t) => {
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
    location: { origin: 'https://bonfree.test', pathname: '/admin/rewards.html', search: '', hash: '' },
    history: { replaceState: () => {} },
    __BONFREE_CONFIG__: {
      supabaseUrl: 'https://mock-project.supabase.co',
      supabaseAnonKey: 'mock-anon-key',
      environment: 'test',
    },
  };
  globalThis.document = { querySelector: () => null };

  const { supabaseAuth } = await import('../src/scripts/core/supabaseClient.js');
  const {
    fetchAdminRewards,
    saveRewardDefinition,
    toggleRewardStatus,
    awardStampsForPurchase,
    verifyVoucherCode,
    processRedemption,
  } = await import('../src/scripts/services/adminService.js');
  const {
    fetchCustomerPortalData,
    requestRewardRedemption,
  } = await import('../src/scripts/services/loyaltyService.js');

  supabaseAuth.setSession({
    access_token: 'live-staff-jwt',
    refresh_token: 'live-staff-ref',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });

  // 1. Admin reward validation blocks invalid percentages & stamps
  const badPct = await saveRewardDefinition({
    title: 'Bad Pct Voucher',
    type: 'Percentage Discount',
    valueLabel: '150% Off',
    discountPercent: 150,
    requiredStamps: 10,
    validityMonths: 6,
  });
  assert.equal(badPct.ok, false);
  assert.equal(badPct.code, 'VALIDATION_ERROR');

  // 2. Live Admin Reward create, fetch & toggle (covering all required attributes)
  let savedRewardBody = null;
  let toggledStatus = null;
  let awardCalled = false;
  let cardStamps = 7;
  const generatedVoucher = 'BFH-8A4C-9F21B0';

  globalThis.fetch = async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();

    if (url.includes('/rest/v1/rewards') && method === 'POST') {
      savedRewardBody = JSON.parse(opts.body);
      return new Response(
        JSON.stringify([{ id: 'rw-live-500', ...savedRewardBody }]),
        { status: 201 },
      );
    }

    if (url.includes('/rest/v1/rewards') && method === 'PATCH') {
      const patch = JSON.parse(opts.body);
      toggledStatus = patch.status;
      return new Response(JSON.stringify([{ id: 'rw-live-500', status: toggledStatus }]), { status: 200 });
    }

    if (url.includes('/rest/v1/rewards') && method === 'GET') {
      return new Response(
        JSON.stringify([
          {
            id: 'rw-live-500',
            code: 'RW-500-OFF',
            programme_id: 'prog-classic',
            title: '₹500 Off Store Voucher',
            reward_type: 'Fixed Discount',
            value_label: '₹500 Off',
            discount_amount_inr: 500,
            discount_percent: null,
            description: '₹500 off streetwear.',
            required_stamps: 10,
            validity_months: 6,
            redemption_limit_per_member: 1,
            redemption_limit_label: '1 per member',
            eligibility_rule: 'Classic Stamps members',
            eligibility_config: {},
            status: 'active',
            loyalty_programmes: { id: 'prog-classic', name: 'Classic Stamps' },
          },
          {
            id: 'rw-live-bday',
            code: 'RW-BDAY',
            programme_id: null,
            title: 'Birthday Perk',
            reward_type: 'Birthday Reward',
            value_label: '₹750 Birthday Credit',
            discount_amount_inr: 750,
            discount_percent: null,
            description: 'Birthday month only.',
            required_stamps: 5,
            validity_months: 1,
            redemption_limit_per_member: 1,
            redemption_limit_label: 'Once per birth month',
            eligibility_rule: 'Birth month only',
            eligibility_config: { birthday_month_only: true },
            status: 'active',
            loyalty_programmes: null,
          },
        ]),
        { status: 200 },
      );
    }

    if (url.includes('/rest/v1/loyalty_programmes')) {
      return new Response(JSON.stringify([{ id: 'prog-classic', name: 'Classic Stamps', status: 'active' }]), { status: 200 });
    }

    if (url.includes('/functions/v1/issue-stamp')) {
      awardCalled = true;
      cardStamps = 10;
      return new Response(
        JSON.stringify({
          ok: true,
          idempotentReplay: false,
          result: { purchase_id: 'p-1', transaction_id: 't-1', stamps_awarded: 3, new_balance: 10 },
        }),
        { status: 200 },
      );
    }

    if (url.includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'u-1', email: 'aanya@bonfree.test' }), { status: 200 });
    }
    if (url.includes('/rest/v1/rpc/sync_my_loyalty_cards')) {
      return new Response(JSON.stringify(0), { status: 200 });
    }
    if (url.includes('/rest/v1/profiles')) {
      return new Response(JSON.stringify([{ id: 'u-1', full_name: 'Aanya Sharma', email: 'aanya@bonfree.test', phone: '+91 9876543210' }]), { status: 200 });
    }
    if (url.includes('/rest/v1/customers')) {
      const nonCurrentMonth = ((new Date().getMonth() + 1) % 12) + 1;
      return new Response(
        JSON.stringify([{ id: 'c-1', membership_id: 'BF-001248', qr_token: 'BFQR-001248A9C4E2', status: 'active', birth_month: nonCurrentMonth, preferences: {}, joined_at: '2026-01-01T00:00:00Z' }]),
        { status: 200 },
      );
    }
    if (url.includes('/rest/v1/loyalty_cards')) {
      return new Response(
        JSON.stringify([{ id: 'lc-1', programme_id: 'prog-classic', current_stamps: cardStamps, lifetime_stamps: cardStamps, status: cardStamps >= 10 ? 'completed' : 'active', loyalty_programmes: { id: 'prog-classic', name: 'Classic Stamps', status: 'active', stamp_goal: 10, qualifying_amount_inr: 1000, stamp_validity_months: 12 } }]),
        { status: 200 },
      );
    }
    if (url.includes('/rest/v1/customer_rewards')) {
      return new Response(
        JSON.stringify([
          {
            id: 'cr-unlk-1',
            reward_id: 'rw-live-500',
            voucher_code: 'BFH-UNLK-ABC12345',
            stamps_spent: 10,
            status: 'available',
            expires_at: '2027-05-26T00:00:00Z',
            rewards: { title: '₹500 Off Store Voucher', description: '₹500 off streetwear.', required_stamps: 10 },
          },
        ]),
        { status: 200 },
      );
    }

    if (url.includes('/functions/v1/redeem-reward')) {
      const reqBody = JSON.parse(opts.body);
      if (reqBody.mode === 'request') {
        cardStamps = 0;
        return new Response(
          JSON.stringify({
            ok: true,
            idempotentReplay: false,
            result: { redemption_id: 'rdm-1', customer_reward_id: 'cr-unlk-1', voucher_code: generatedVoucher, new_balance: 0 },
          }),
          { status: 200 },
        );
      }
      if (reqBody.mode === 'verify') {
        return new Response(
          JSON.stringify({
            ok: true,
            voucher: {
              redemption_id: 'rdm-1',
              voucher_code: generatedVoucher,
              customer_id: 'BF-001248',
              customer_name: 'Aanya Sharma',
              customer_phone: '+91 9876543210',
              reward_title: '₹500 Off Store Voucher',
              reward_type: 'Fixed Discount',
              stamps_cost: 10,
              status: 'pending',
              expires_at: '2027-05-26T00:00:00Z',
            },
          }),
          { status: 200 },
        );
      }
      if (reqBody.mode === 'confirm') {
        return new Response(JSON.stringify({ ok: true, redemption: { id: 'rdm-1', status: 'completed', voucher_code: generatedVoucher } }), { status: 200 });
      }
    }

    return new Response(JSON.stringify([]), { status: 200 });
  };

  // Create Free Product reward
  const createRes = await saveRewardDefinition({
    title: 'Complimentary Tote Bag',
    type: 'Free Product',
    valueLabel: 'Free Tote Bag',
    programmeId: 'prog-classic',
    requiredStamps: 8,
    validityMonths: 3,
    redemptionLimitPerMember: 1,
    redemptionLimit: '1 per member',
    eligibilityRule: 'Classic Stamps members',
    status: 'Active',
    description: 'Canvas monochrome tote.',
  });
  assert.equal(createRes.ok, true);
  assert.equal(savedRewardBody.reward_type, 'Free Product');
  assert.equal(savedRewardBody.required_stamps, 8);
  assert.equal(savedRewardBody.redemption_limit_per_member, 1);

  // Toggle status inactive
  const toggleRes = await toggleRewardStatus({ rewardId: 'rw-live-500', nextStatus: 'Inactive' });
  assert.equal(toggleRes.ok, true);
  assert.equal(toggledStatus, 'inactive');

  const catalogRes = await fetchAdminRewards();
  assert.equal(catalogRes.ok, true);
  assert.equal(catalogRes.rewards.length, 2);

  // Purchase -> Stamp award -> Auto-unlocked customer portal -> Redemption request -> Verify -> Confirm
  const stampRes = await awardStampsForPurchase({
    customerId: 'BF-001248',
    customerUuid: 'c-1',
    programmeId: 'prog-classic',
    purchaseRef: 'INV-P7-001',
    amountInr: 3400,
    programme: { status: 'active' },
  });
  assert.equal(awardCalled, true);
  assert.equal(stampRes.ok, true);
  assert.equal(stampRes.result.new_balance, 10);

  const portalRes = await fetchCustomerPortalData();
  assert.equal(portalRes.ok, true);
  const voucherReward = portalRes.data.rewards.find((r) => r.id === 'rw-live-500');
  const bdayReward = portalRes.data.rewards.find((r) => r.id === 'rw-live-bday');
  assert.equal(voucherReward.status, 'available');
  assert.equal(voucherReward.voucherCode, null); // Hold code must NOT leak before stamps are deducted
  assert.equal(bdayReward.status, 'locked'); // Birthday eligibility enforced

  const reqRedeem = await requestRewardRedemption({ rewardId: 'rw-live-500' });
  assert.equal(reqRedeem.ok, true);
  assert.equal(reqRedeem.result.voucher_code, generatedVoucher);
  assert.equal(reqRedeem.result.new_balance, 0);

  const verifyRes = await verifyVoucherCode(generatedVoucher);
  assert.equal(verifyRes.ok, true);
  assert.equal(verifyRes.voucher.status, 'Pending');

  const confirmRes = await processRedemption({
    redemptionId: verifyRes.voucher.id,
    voucherCode: generatedVoucher,
    action: 'confirm',
  });
  assert.equal(confirmRes.ok, true);
  assert.equal(confirmRes.redemption.status, 'completed');

  // 3. Security Rejection Scenarios: Duplicate voucher reuse, Expired voucher, Unauthorized caller
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ code: 'VOUCHER_ALREADY_REDEEMED', message: 'Already redeemed.' }), { status: 409 });
  const doubleSpendRes = await processRedemption({ voucherCode: generatedVoucher, action: 'confirm' });
  assert.equal(doubleSpendRes.ok, false);
  assert.equal(doubleSpendRes.code, 'VOUCHER_ALREADY_REDEEMED');

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ code: 'VOUCHER_EXPIRED', message: 'Expired.' }), { status: 410 });
  const expiredRes = await processRedemption({ voucherCode: 'BFH-OLD-999999', action: 'confirm' });
  assert.equal(expiredRes.ok, false);
  assert.equal(expiredRes.code, 'VOUCHER_EXPIRED');

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ code: 'FORBIDDEN', message: 'Permission denied: redemptions.verify' }), { status: 403 });
  const unauthRes = await processRedemption({ voucherCode: generatedVoucher, action: 'confirm' });
  assert.equal(unauthRes.ok, false);
  assert.equal(unauthRes.code, 'FORBIDDEN');
});
