/**
 * BONFREE-HUB Customer Loyalty Service & Development Fixtures (Phase 1C)
 *
 * Security & Architecture Rules:
 * - Development fixtures below are strictly READ-ONLY preview data clearly flagged `isDevelopmentFixture: true`.
 * - Customers can NEVER mutate stamp balances, reward eligibility, or purchase records client-side.
 * - All redemptions and preference updates invoke authenticated Supabase Edge Functions / RLS endpoints in Phase 2.
 */
import { isSupabaseConfigured } from '../core/config.js';

export const DEV_MEMBER_FIXTURE = Object.freeze({
  isDevelopmentFixture: true,
  member: Object.freeze({
    id: 'dev-member-001',
    fullName: 'Aanya Sharma',
    firstName: 'Aanya',
    membershipCode: 'BF-001248',
    email: 'aanya.sharma@bonfree-member.dev',
    mobile: '+91 98765 43210',
    joinedDate: '12 Oct 2024',
    programmeName: 'Classic Stamps',
    programmeRule: '₹1,000 = 1 Stamp',
    stampGoal: 10,
    collectedStamps: 7,
    stampExpiryNote: 'Stamps valid for 12 months from purchase date',
  }),
  rewards: Object.freeze([
    {
      id: 'rw-avail-1',
      title: '₹250 Member Drop Credit',
      description: 'Valid on oversized tees, boxy shirts, and cropped tops.',
      requiredStamps: 5,
      status: 'available',
      voucherCode: null,
      validityText: 'Redeem anytime while balance >= 5 stamps',
    },
    {
      id: 'rw-avail-2',
      title: 'Priority Alteration & Care Pass',
      description: 'Complimentary denim & cargo hemming at flagship stores.',
      requiredStamps: 3,
      status: 'available',
      voucherCode: null,
      validityText: 'Member perk unlocked at 3 stamps',
    },
    {
      id: 'rw-lock-1',
      title: '₹500 BONFREE-HUB Voucher',
      description: 'Signature 10-stamp reward valid storewide on all Gen Z streetwear.',
      requiredStamps: 10,
      status: 'locked',
      voucherCode: null,
      validityText: 'Valid 6 months once unlocked & redeemed',
    },
    {
      id: 'rw-lock-2',
      title: 'Early Capsule Access Pass',
      description: '48-hour private preview for limited outerwear & denim drops.',
      requiredStamps: 10,
      status: 'locked',
      voucherCode: null,
      validityText: 'Unlocks at 10 stamps',
    },
    {
      id: 'rw-red-1',
      title: '₹500 BONFREE-HUB Voucher',
      description: 'Applied on Relaxed Cargo Pants order.',
      requiredStamps: 10,
      status: 'redeemed',
      voucherCode: 'BFH-VCH-4821',
      redeemedAt: '12 Jan 2025',
      validityText: 'Redeemed in-store',
    },
    {
      id: 'rw-red-2',
      title: '₹250 Member Drop Credit',
      description: 'Applied on Heavyweight Graphic Tee.',
      requiredStamps: 5,
      status: 'redeemed',
      voucherCode: 'BFH-VCH-3190',
      redeemedAt: '18 Aug 2024',
      validityText: 'Redeemed in-store',
    },
  ]),
  stampActivity: Object.freeze([
    {
      id: 'st-1',
      date: '12 Jan 2025',
      title: 'Stamp Earned — Oversized Graphic Tee',
      receiptNo: 'BFH-250112-0142',
      programme: 'Classic Stamps',
      delta: '+1',
      balanceAfter: 7,
      type: 'earned',
      amountInr: 1499,
    },
    {
      id: 'st-2',
      date: '05 Nov 2024',
      title: 'Stamp Earned — Relaxed Cargo Pants',
      receiptNo: 'BFH-241105-0089',
      programme: 'Classic Stamps',
      delta: '+1',
      balanceAfter: 6,
      type: 'earned',
      amountInr: 2299,
    },
    {
      id: 'st-3',
      date: '18 Aug 2024',
      title: 'Stamp Earned — Boxy Oxford Shirt',
      receiptNo: 'BFH-240818-0211',
      programme: 'Classic Stamps',
      delta: '+1',
      balanceAfter: 5,
      type: 'earned',
      amountInr: 1799,
    },
    {
      id: 'st-4',
      date: '22 Jun 2024',
      title: 'Stamp Earned — Baggy Raw Denim Jeans',
      receiptNo: 'BFH-240622-0047',
      programme: 'Classic Stamps',
      delta: '+2',
      balanceAfter: 4,
      type: 'earned',
      amountInr: 3199,
    },
    {
      id: 'st-5',
      date: '12 Jan 2025',
      title: 'Voucher Issued — ₹500 Store Reward',
      receiptNo: 'BFH-VCH-4821',
      programme: 'Classic Stamps',
      delta: '-10',
      balanceAfter: 6,
      type: 'redeemed',
      amountInr: null,
    },
  ]),
  purchases: Object.freeze([
    {
      id: 'pur-1',
      receiptNo: 'BFH-250112-0142',
      date: '12 Jan 2025',
      itemName: 'Oversized Graphic Tee (Washed Charcoal)',
      category: 'Oversized Tees',
      store: 'Bengaluru — MG Road',
      amountInr: 1499,
      qualifying: true,
      stampsAwarded: 1,
    },
    {
      id: 'pur-2',
      receiptNo: 'BFH-241105-0089',
      date: '05 Nov 2024',
      itemName: 'Relaxed Utility Cargo Pants (Slate)',
      category: 'Cargo Pants',
      store: 'Bengaluru — MG Road',
      amountInr: 2299,
      qualifying: true,
      stampsAwarded: 1,
    },
    {
      id: 'pur-3',
      receiptNo: 'BFH-240818-0211',
      date: '18 Aug 2024',
      itemName: 'Boxy Cropped Poplin Shirt (Ivory)',
      category: 'Trendy Shirts',
      store: 'Mumbai — Bandra',
      amountInr: 1799,
      qualifying: true,
      stampsAwarded: 1,
    },
    {
      id: 'pur-4',
      receiptNo: 'BFH-240622-0047',
      date: '22 Jun 2024',
      itemName: 'Baggy Raw Denim Jeans + Layered Overshirt',
      category: 'Denim & Shirts',
      store: 'Bengaluru — MG Road',
      amountInr: 3199,
      qualifying: true,
      stampsAwarded: 2,
    },
    {
      id: 'pur-5',
      receiptNo: 'BFH-240410-0019',
      date: '10 Apr 2024',
      itemName: 'Ribbed Crop Top (Monochrome Black)',
      category: 'Tops',
      store: 'Bengaluru — MG Road',
      amountInr: 799,
      qualifying: false,
      stampsAwarded: 0,
    },
  ]),
  preferences: Object.freeze({
    earlyAccessDrops: true,
    birthdayOffers: true,
    voucherExpiryAlerts: true,
    smsStampReceipts: false,
  }),
});

/**
 * Fetches member dashboard state (returns read-only development fixture until Phase 2 Supabase is connected).
 */
export async function fetchCustomerPortalData() {
  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      source: 'development-fixture',
      data: DEV_MEMBER_FIXTURE,
    };
  }
  return {
    ok: false,
    code: 'SUPABASE_CLIENT_PENDING',
    message: 'Live Supabase customer queries connect in Phase 2.',
  };
}

/**
 * Submits a reward redemption request to the `redeem-reward` Edge Function in Phase 2.
 * Never mutates local stamp balances or issues fake voucher codes before backend confirmation.
 */
export async function requestRewardRedemption({ rewardId }) {
  if (!rewardId) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Missing reward identifier.' };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message:
        'Redemption requests execute via the Phase 2 Supabase Edge Function so stamp deductions remain tamper-proof.',
    };
  }

  return {
    ok: false,
    code: 'SERVICE_PENDING',
    message: 'Live reward redemption connects in Phase 2.',
  };
}

/**
 * Updates member communication preferences (RLS `profiles` / `preferences` update in Phase 2).
 */
export async function updateMemberPreferences(preferences) {
  if (!preferences || typeof preferences !== 'object') {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid preferences payload.' };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message:
        'Preference updates persist to Supabase PostgreSQL once Phase 2 backend authentication is active.',
    };
  }

  return {
    ok: false,
    code: 'SERVICE_PENDING',
    message: 'Live preference sync connects in Phase 2.',
  };
}

/**
 * Submits customer feedback survey responses to Supabase in Phase 3.
 */
export async function submitSurveyResponse(payload) {
  if (!payload || !payload.surveyId) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Survey payload is incomplete.' };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message:
        'Thank you — your survey inputs passed validation, and response persistence activates once Phase 3 Supabase backend is connected.',
    };
  }

  return {
    ok: false,
    code: 'SERVICE_PENDING',
    message: 'Live survey submission connects in Phase 3.',
  };
}
