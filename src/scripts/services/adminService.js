/**
 * BONFREE-HUB Admin Service & Development Fixtures (Phase 2A)
 *
 * Security & Architecture Rules:
 * - No hardcoded admin passwords or backdoors.
 * - All balance-changing, customer-creating, and programme-saving actions remain read-only/uncommitted
 *   until Phase 2B/Supabase Edge Functions and PostgreSQL RLS are wired.
 */
import { isSupabaseConfigured } from '../core/config.js';

export const ADMIN_DEV_FIXTURE = Object.freeze({
  isDevelopmentFixture: true,
  kpisByRange: Object.freeze({
    '7d': {
      registeredCustomers: 12487,
      activeCustomers: 11920,
      totalLoyaltyCards: 12487,
      stampsIssued: 1940,
      rewardsUnlocked: 342,
      rewardsRedeemed: 288,
      qualifyingPurchases: 1620,
      loyaltySalesInr: 2840000,
    },
    '30d': {
      registeredCustomers: 12487,
      activeCustomers: 11920,
      totalLoyaltyCards: 12487,
      stampsIssued: 8420,
      rewardsUnlocked: 1410,
      rewardsRedeemed: 1185,
      qualifyingPurchases: 6840,
      loyaltySalesInr: 12680000,
    },
    '90d': {
      registeredCustomers: 12487,
      activeCustomers: 11920,
      totalLoyaltyCards: 12487,
      stampsIssued: 24910,
      rewardsUnlocked: 4120,
      rewardsRedeemed: 3480,
      qualifyingPurchases: 19840,
      loyaltySalesInr: 36420000,
    },
    '1y': {
      registeredCustomers: 12487,
      activeCustomers: 11920,
      totalLoyaltyCards: 12487,
      stampsIssued: 48320,
      rewardsUnlocked: 16420,
      rewardsRedeemed: 15860,
      qualifyingPurchases: 41280,
      loyaltySalesInr: 84260000,
    },
  }),
  growthSeries: Object.freeze([
    { label: 'Jul', total: 10120 },
    { label: 'Aug', total: 10490 },
    { label: 'Sep', total: 10860 },
    { label: 'Oct', total: 11340 },
    { label: 'Nov', total: 11910 },
    { label: 'Dec', total: 12487 },
  ]),
  recentRegistrations: Object.freeze([
    { id: 'BF-012487', name: 'Ishaan Mehta', email: 'ishaan.m@example.dev', joinedAt: 'Today, 4:15 PM', programme: 'Premium Circle' },
    { id: 'BF-012486', name: 'Tara Sinha', email: 'tara.sinha@example.dev', joinedAt: 'Today, 2:08 PM', programme: 'Streetwear Club' },
    { id: 'BF-012485', name: 'Rhea Kapoor', email: 'rhea.k@example.dev', joinedAt: 'Yesterday, 6:42 PM', programme: 'Classic Stamps' },
    { id: 'BF-012484', name: 'Arjun Bedi', email: 'arjun.b@example.dev', joinedAt: 'Yesterday, 1:19 PM', programme: 'Classic Stamps' },
  ]),
  recentTransactions: Object.freeze([
    { timestamp: '24 Dec 2024, 4:32 PM', customerId: 'BF-001248', customerName: 'Aanya Sharma', type: 'Earned', delta: '+1', balance: 7 },
    { timestamp: '24 Dec 2024, 3:38 PM', customerId: 'BF-000987', customerName: 'Rhea Kapoor', type: 'Redeemed', delta: '-10', balance: 0 },
    { timestamp: '24 Dec 2024, 2:07 PM', customerId: 'BF-011234', customerName: 'Ishaan Mehta', type: 'Earned', delta: '+2', balance: 5 },
    { timestamp: '24 Dec 2024, 12:41 PM', customerId: 'BF-011009', customerName: 'Kavya Iyer', type: 'Earned', delta: '+1', balance: 10 },
    { timestamp: '24 Dec 2024, 11:03 AM', customerId: 'BF-010560', customerName: 'Vihaan Malhotra', type: 'Redeemed', delta: '-5', balance: 5 },
  ]),
  customers: Object.freeze([
    {
      id: 'BF-001248',
      name: 'Aanya Sharma',
      email: 'aanya.sharma@bonfree-member.dev',
      phone: '+91 98765 43210',
      programme: 'Classic Stamps',
      stamps: 7,
      status: 'Active',
      joinedOn: '12 Oct 2024',
      totalSpendInr: 18499,
      rewardsRedeemed: 2,
      recentPurchases: ['Oversized Graphic Tee (₹1,499)', 'Relaxed Cargo Pants (₹2,299)', 'Boxy Oxford Shirt (₹1,799)'],
    },
    {
      id: 'BF-000987',
      name: 'Rhea Kapoor',
      email: 'rhea.kapoor@example.dev',
      phone: '+91 98200 11876',
      programme: 'Classic Stamps',
      stamps: 0,
      status: 'Active',
      joinedOn: '06 Oct 2024',
      totalSpendInr: 24500,
      rewardsRedeemed: 1,
      recentPurchases: ['Baggy Raw Denim Jeans (₹2,899)', 'Cropped Ribbed Top (₹999)'],
    },
    {
      id: 'BF-011234',
      name: 'Ishaan Mehta',
      email: 'ishaan.mehta@example.dev',
      phone: '+91 98111 66789',
      programme: 'Premium Circle',
      stamps: 5,
      status: 'Active',
      joinedOn: '28 Nov 2024',
      totalSpendInr: 14200,
      rewardsRedeemed: 1,
      recentPurchases: ['Layered Utility Jacket (₹3,499)', 'Wide Cargo Trousers (₹2,199)'],
    },
    {
      id: 'BF-011009',
      name: 'Kavya Iyer',
      email: 'kavya.iyer@example.dev',
      phone: '+91 98990 22446',
      programme: 'Classic Stamps',
      stamps: 10,
      status: 'Active',
      joinedOn: '21 Nov 2024',
      totalSpendInr: 21000,
      rewardsRedeemed: 3,
      recentPurchases: ['Boxy Poplin Shirt (₹1,799)', 'Heavyweight Graphic Tee (₹1,499)'],
    },
    {
      id: 'BF-010560',
      name: 'Vihaan Malhotra',
      email: 'vihaan.m@example.dev',
      phone: '+91 97654 33011',
      programme: 'Streetwear Club',
      stamps: 5,
      status: 'Inactive',
      joinedOn: '14 Sep 2024',
      totalSpendInr: 8900,
      rewardsRedeemed: 0,
      recentPurchases: ['Oversized Acid-Wash Tee (₹1,399)'],
    },
    {
      id: 'BF-010321',
      name: 'Myra Desai',
      email: 'myra.desai@example.dev',
      phone: '+91 98330 77122',
      programme: 'Premium Circle',
      stamps: 8,
      status: 'Active',
      joinedOn: '09 Sep 2024',
      totalSpendInr: 31400,
      rewardsRedeemed: 4,
      recentPurchases: ['Cropped Denim Jacket (₹3,299)', 'Relaxed Cargo Pants (₹2,299)'],
    },
    {
      id: 'BF-010077',
      name: 'Arjun Bedi',
      email: 'arjun.bedi@example.dev',
      phone: '+91 98100 55667',
      programme: 'Classic Stamps',
      stamps: 4,
      status: 'Active',
      joinedOn: '01 Sep 2024',
      totalSpendInr: 12100,
      rewardsRedeemed: 1,
      recentPurchases: ['Boxy Striped Shirt (₹1,899)'],
    },
    {
      id: 'BF-009902',
      name: 'Tara Sinha',
      email: 'tara.sinha@example.dev',
      phone: '+91 98201 88990',
      programme: 'Streetwear Club',
      stamps: 2,
      status: 'Inactive',
      joinedOn: '28 Aug 2024',
      totalSpendInr: 4998,
      rewardsRedeemed: 0,
      recentPurchases: ['Baggy Wash Jeans (₹2,499)'],
    },
  ]),
  programmes: Object.freeze([
    {
      id: 'prog-classic',
      name: 'Classic Stamps',
      subtitle: 'Spend · Collect · Redeem',
      description: 'Spend · Collect · Redeem stamps on eligible streetwear & everyday fashion purchases.',
      status: 'Active',
      stampGoal: 10,
      qualifyingAmountInr: 1000,
      calculationRule: 'per_threshold',
      stampValidityMonths: 12,
      rewardValidityMonths: 6,
      eligibility: 'All registered members (in-store & verified channels)',
      tiers: [
        { stamps: 3, title: 'Priority Alteration Pass', value: 'Free Hemming' },
        { stamps: 5, title: 'Member Drop Credit', value: '₹250 Voucher' },
        { stamps: 10, title: 'Signature Store Reward', value: '₹500 Voucher' },
      ],
    },
    {
      id: 'prog-premium',
      name: 'Premium Circle',
      subtitle: 'Higher rewards for loyal shoppers',
      description: 'Accelerated perks and priority capsule previews for frequent outerwear & denim buyers.',
      status: 'Active',
      stampGoal: 10,
      qualifyingAmountInr: 2500,
      calculationRule: 'per_transaction',
      stampValidityMonths: 12,
      rewardValidityMonths: 6,
      eligibility: 'Members with >= ₹15,000 lifetime qualifying spend',
      tiers: [
        { stamps: 5, title: 'Capsule Early Access', value: '48h Preview' },
        { stamps: 10, title: 'Premium Circle Voucher', value: '₹1,200 Voucher' },
      ],
    },
    {
      id: 'prog-festive',
      name: 'Festive Rewards',
      subtitle: 'Seasonal stamp programme',
      description: 'Limited-run seasonal multiplier campaign on weekend streetwear drops.',
      status: 'Active',
      stampGoal: 8,
      qualifyingAmountInr: 1500,
      calculationRule: 'multiplier_2x',
      stampValidityMonths: 6,
      rewardValidityMonths: 3,
      eligibility: 'Active members during promotional drop dates',
      tiers: [{ stamps: 8, title: 'Seasonal Drop Voucher', value: '₹600 Voucher' }],
    },
    {
      id: 'prog-streetwear',
      name: 'Streetwear Club',
      subtitle: 'Exclusive rewards for streetwear lovers',
      description: 'Campus & youth club programme tailored around oversized tees, cargos, and sneakers.',
      status: 'Inactive',
      stampGoal: 10,
      qualifyingAmountInr: 1200,
      calculationRule: 'per_transaction',
      stampValidityMonths: 12,
      rewardValidityMonths: 6,
      eligibility: 'Verified campus & Gen Z community signups',
      tiers: [{ stamps: 10, title: 'Streetwear Club Voucher', value: '₹500 Voucher' }],
    },
  ]),
  stampTransactions: Object.freeze([
    {
      id: 'TXN-250131-01',
      isoDate: '2025-01-31',
      dateTime: '31 Jan 2025, 6:24 PM',
      customerId: 'BF-001248',
      customerName: 'Aanya Sharma',
      customerPhone: '+91 98765 43210',
      staffId: 'STF1002',
      staffName: 'Rohan Mehta',
      store: 'Bengaluru — MG Road',
      purchaseRef: 'INV-CP-43579',
      amountInr: 4999,
      stampsAwarded: 4,
      programme: 'Classic Stamps',
      status: 'Awarded',
    },
    {
      id: 'TXN-250131-02',
      isoDate: '2025-01-31',
      dateTime: '31 Jan 2025, 4:11 PM',
      customerId: 'BF-011234',
      customerName: 'Ishaan Mehta',
      customerPhone: '+91 98111 66789',
      staffId: 'STF1001',
      staffName: 'Priya Singh',
      store: 'Delhi — Khan Market',
      purchaseRef: 'INV-CP-43568',
      amountInr: 5200,
      stampsAwarded: 2,
      programme: 'Premium Circle',
      status: 'Awarded',
    },
    {
      id: 'TXN-250130-03',
      isoDate: '2025-01-30',
      dateTime: '30 Jan 2025, 8:03 PM',
      customerId: 'BF-011009',
      customerName: 'Kavya Iyer',
      customerPhone: '+91 98990 22446',
      staffId: 'STF1002',
      staffName: 'Rohan Mehta',
      store: 'Bengaluru — MG Road',
      purchaseRef: 'INV-CP-43541',
      amountInr: 7499,
      stampsAwarded: 7,
      programme: 'Classic Stamps',
      status: 'Awarded',
    },
    {
      id: 'TXN-250129-04',
      isoDate: '2025-01-29',
      dateTime: '29 Jan 2025, 2:17 PM',
      customerId: 'BF-010077',
      customerName: 'Arjun Bedi',
      customerPhone: '+91 98100 55667',
      staffId: 'STF1001',
      staffName: 'Neha Kapoor',
      store: 'Mumbai — Bandra',
      purchaseRef: 'INV-CP-43532',
      amountInr: 2100,
      stampsAwarded: 2,
      programme: 'Classic Stamps',
      status: 'Awarded',
    },
    {
      id: 'TXN-250128-05',
      isoDate: '2025-01-28',
      dateTime: '28 Jan 2025, 7:46 PM',
      customerId: 'BF-010560',
      customerName: 'Vihaan Malhotra',
      customerPhone: '+91 97654 33011',
      staffId: 'STF1002',
      staffName: 'Priya Singh',
      store: 'Delhi — Khan Market',
      purchaseRef: 'INV-CP-43511',
      amountInr: 1800,
      stampsAwarded: 0,
      programme: 'Streetwear Club',
      status: 'Reversed',
    },
    {
      id: 'TXN-250127-06',
      isoDate: '2025-01-27',
      dateTime: '27 Jan 2025, 5:10 PM',
      customerId: 'BF-010321',
      customerName: 'Myra Desai',
      customerPhone: '+91 98330 77122',
      staffId: 'STF1001',
      staffName: 'Rohan Mehta',
      store: 'Mumbai — Bandra',
      purchaseRef: 'INV-CP-43490',
      amountInr: 5600,
      stampsAwarded: 2,
      programme: 'Premium Circle',
      status: 'Awarded',
    },
  ]),
  rewardsCatalog: Object.freeze([
    {
      id: 'rw-fixed-500',
      title: '₹500 Off Store Voucher',
      type: 'Fixed Discount',
      valueLabel: '₹500 Off',
      description: '₹500 off on streetwear & everyday fashion purchases of ₹2,000 or above.',
      requiredStamps: 10,
      validityMonths: 6,
      redemptionLimit: '1 per card completion',
      status: 'Active',
    },
    {
      id: 'rw-fixed-1000',
      title: '₹1,000 Denim & Cargo Credit',
      type: 'Fixed Discount',
      valueLabel: '₹1,000 Off',
      description: '₹1,000 off on baggy jeans, wide cargo pants, and layered outerwear.',
      requiredStamps: 20,
      validityMonths: 6,
      redemptionLimit: '1 per member / quarter',
      status: 'Active',
    },
    {
      id: 'rw-pct-15',
      title: 'Streetwear Insider — 15% Off',
      type: 'Percentage Discount',
      valueLabel: '15% Off',
      description: '15% off (up to ₹2,500) on oversized tees, boxy shirts, cargos, and jackets.',
      requiredStamps: 15,
      validityMonths: 3,
      redemptionLimit: '2 per member / year',
      status: 'Active',
    },
    {
      id: 'rw-free-tee',
      title: 'Complimentary Graphic Tee',
      type: 'Free Product',
      valueLabel: 'Free Heavyweight Tee',
      description: 'Redeem 1 complimentary seasonal monochrome graphic tee from our core drop.',
      requiredStamps: 25,
      validityMonths: 6,
      redemptionLimit: '1 per member',
      status: 'Active',
    },
    {
      id: 'rw-birthday',
      title: 'Birthday Month Streetwear Perk',
      type: 'Birthday Reward',
      valueLabel: '₹750 Birthday Credit',
      description: 'Celebrate your birthday month with ₹750 credit + priority fitting support.',
      requiredStamps: 5,
      validityMonths: 1,
      redemptionLimit: 'Once per year (birth month)',
      status: 'Active',
    },
    {
      id: 'rw-early-drop',
      title: 'Early Access to New Drops',
      type: 'Exclusive Member Offer',
      valueLabel: '48h Drop Preview',
      description: 'Be first to shop limited streetwear capsules, denim washes, and collabs.',
      requiredStamps: 10,
      validityMonths: 12,
      redemptionLimit: 'Unlimited while active',
      status: 'Inactive',
    },
  ]),
  redemptions: Object.freeze([
    {
      id: 'RDM-901',
      requestedOn: '31 Jan 2025, 6:52 PM',
      isoDate: '2025-01-31',
      voucherCode: 'BFH-25K-8M2Q9',
      customerId: 'BF-001248',
      customerName: 'Aanya Sharma',
      customerPhone: '+91 98765 43210',
      rewardTitle: '₹500 Off Store Voucher',
      stampsCost: 10,
      status: 'Pending',
      expiresOn: '31 Jul 2025',
      notes: 'Member presented voucher at MG Road checkout.',
    },
    {
      id: 'RDM-902',
      requestedOn: '31 Jan 2025, 5:18 PM',
      isoDate: '2025-01-31',
      voucherCode: 'BFH-10K-7D4N1',
      customerId: 'BF-011234',
      customerName: 'Ishaan Mehta',
      customerPhone: '+91 98111 66789',
      rewardTitle: 'Streetwear Insider — 15% Off',
      stampsCost: 15,
      status: 'Pending',
      expiresOn: '30 Apr 2025',
      notes: 'Awaiting associate verification.',
    },
    {
      id: 'RDM-903',
      requestedOn: '30 Jan 2025, 8:37 PM',
      isoDate: '2025-01-30',
      voucherCode: 'BFH-VCH-4821',
      customerId: 'BF-000987',
      customerName: 'Rhea Kapoor',
      customerPhone: '+91 98200 11876',
      rewardTitle: '₹500 Off Store Voucher',
      stampsCost: 10,
      status: 'Completed',
      expiresOn: '30 Jul 2025',
      notes: 'Verified & redeemed against INV-CP-43520.',
    },
    {
      id: 'RDM-904',
      requestedOn: '15 Dec 2024, 3:12 PM',
      isoDate: '2024-12-15',
      voucherCode: 'BFH-BDAY-99K2',
      customerId: 'BF-010560',
      customerName: 'Vihaan Malhotra',
      customerPhone: '+91 97654 33011',
      rewardTitle: 'Birthday Month Streetwear Perk',
      stampsCost: 5,
      status: 'Expired',
      expiresOn: '15 Jan 2025',
      notes: 'Validity window elapsed without in-store redemption.',
    },
    {
      id: 'RDM-905',
      requestedOn: '22 Jan 2025, 1:45 PM',
      isoDate: '2025-01-22',
      voucherCode: 'BFH-TEE-3104',
      customerId: 'BF-009902',
      customerName: 'Tara Sinha',
      customerPhone: '+91 98201 88990',
      rewardTitle: 'Complimentary Graphic Tee',
      stampsCost: 25,
      status: 'Rejected',
      expiresOn: '22 Jul 2025',
      notes: 'Insufficient verified stamp balance at audit.',
    },
  ]),
});

/**
 * Computes eligible stamps preview from programme rules (read-only UI estimate).
 */
export function calculateEligibleStamps({
  amountInr = 0,
  qualifyingAmountInr = 1000,
  calculationRule = 'per_threshold',
} = {}) {
  const amt = Number(amountInr) || 0;
  const threshold = Math.max(1, Number(qualifyingAmountInr) || 1000);
  if (amt < threshold) return 0;

  if (calculationRule === 'per_transaction') return 1;
  if (calculationRule === 'multiplier_2x') return Math.floor(amt / threshold) * 2;
  return Math.floor(amt / threshold);
}

/**
 * Looks up a customer by Membership ID, email, or phone in dev fixture (Supabase RPC in Phase 3).
 */
export function lookupCustomerForScanner(query = '') {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const cleanedPhone = q.replace(/\s+/g, '');

  const match = ADMIN_DEV_FIXTURE.customers.find(
    (c) =>
      c.id.toLowerCase() === q ||
      c.email.toLowerCase() === q ||
      c.phone.toLowerCase().replace(/\s+/g, '').includes(cleanedPhone) ||
      c.name.toLowerCase().includes(q),
  );

  if (!match) return null;
  const programme =
    ADMIN_DEV_FIXTURE.programmes.find((p) => p.name === match.programme) ||
    ADMIN_DEV_FIXTURE.programmes[0];
  return { customer: match, programme };
}

/**
 * Invokes `issue-stamp` Edge Function when connected.
 * Checks duplicate receipt references cleanly and never mutates local stamp balances.
 */
export async function awardStampsForPurchase({
  customerId,
  purchaseRef,
  amountInr,
  calculatedStamps,
}) {
  if (!customerId || !purchaseRef || !amountInr) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Customer, purchase reference, and purchase amount are required.',
    };
  }

  const normalizedRef = purchaseRef.trim().toUpperCase();
  const duplicate = ADMIN_DEV_FIXTURE.stampTransactions.find(
    (tx) => tx.purchaseRef.toUpperCase() === normalizedRef,
  );
  if (duplicate) {
    return {
      ok: false,
      code: 'DUPLICATE_RECEIPT',
      message: `Duplicate purchase reference detected: ${normalizedRef} was already processed on ${duplicate.dateTime} (${duplicate.id}).`,
    };
  }

  if (Number(calculatedStamps) <= 0) {
    return {
      ok: false,
      code: 'NOT_QUALIFYING',
      message: 'Purchase amount does not meet the minimum qualifying threshold for a stamp.',
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message:
        'Stamp award request validated, but ledger credits require the Phase 3 Supabase Edge Function (`issue-stamp`). No client balance was modified.',
    };
  }

  return {
    ok: false,
    code: 'SERVICE_PENDING',
    message: 'Live `issue-stamp` Edge Function integration activates in Phase 3.',
  };
}

export async function saveRewardDefinition(payload) {
  if (!payload?.title) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Reward title is required.' };
  }
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message:
        'Reward configuration validated. Saving to PostgreSQL activates with Phase 3 Supabase RLS/Edge Functions.',
    };
  }
  return { ok: false, code: 'SERVICE_PENDING', message: 'Live reward persistence connects in Phase 3.' };
}

export async function processRedemption({ redemptionId, action }) {
  if (!redemptionId || !action) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Redemption ID and action are required.' };
  }
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message: `Redemption "${action}" request prepared for ${redemptionId}, awaiting Phase 3 Supabase Edge Function (\`redeem-reward\`).`,
    };
  }
  return { ok: false, code: 'SERVICE_PENDING', message: 'Live redemption processing connects in Phase 3.' };
}

/**
 * Staff authentication interface (Phase 2B/Supabase Auth + staff_members RBAC verification).
 */
export async function signInStaff({ email, password }) {
  if (!email || !password) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Work email address and password are required.',
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message:
        'Staff sign-in is disabled until Supabase Authentication & RBAC staff policies are connected.',
    };
  }

  return {
    ok: false,
    code: 'AUTH_CLIENT_PENDING',
    message: 'Staff authentication client connects in Phase 2B.',
  };
}

/**
 * Saves or creates a loyalty programme (invokes Edge Function / RLS admin policy once connected).
 */
export async function saveLoyaltyProgramme(programmePayload) {
  if (!programmePayload?.name) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Programme name is required.' };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message:
        'Programme configuration validated. Database changes require Phase 2B/Supabase Edge Function connection.',
    };
  }

  return {
    ok: false,
    code: 'SERVICE_PENDING',
    message: 'Live programme persistence connects in Phase 2B.',
  };
}
