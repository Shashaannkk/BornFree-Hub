/**
 * BONFREE-HUB Admin Service & Development Fixtures (Phase 2A)
 *
 * Security & Architecture Rules:
 * - No hardcoded admin passwords or backdoors.
 * - All balance-changing, customer-creating, and programme-saving actions remain read-only/uncommitted
 *   until Phase 2B/Supabase Edge Functions and PostgreSQL RLS are wired.
 */
import { isProductionEnvironment, isSupabaseConfigured } from '../core/config.js';
import {
  invokeEdgeFunction,
  restInsert,
  restRpc,
  restSelect,
  restUpdate,
  supabaseAuth,
} from '../core/supabaseClient.js';
import { isProgrammeCurrentlyValid } from './loyaltyService.js';

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
      qrToken: 'BFQR-001248A9C4E2',
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
      qrToken: 'BFQR-011234B7E105',
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
      qrToken: 'BFQR-011009C4D819',
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
      code: 'RW-500-OFF',
      programmeId: 'prog-classic',
      programmeName: 'Classic Stamps',
      title: '₹500 Off Store Voucher',
      type: 'Fixed Discount',
      valueLabel: '₹500 Off',
      discountAmountInr: 500,
      discountPercent: null,
      description: '₹500 off on streetwear & everyday fashion purchases of ₹2,000 or above.',
      requiredStamps: 10,
      validityMonths: 6,
      redemptionLimitPerMember: 4,
      redemptionLimit: '1 per card completion',
      eligibilityRule: 'Active Classic Stamps members with >= 10 stamps',
      eligibilityConfig: {},
      status: 'Active',
    },
    {
      id: 'rw-fixed-1000',
      code: 'RW-1000-OFF',
      programmeId: 'prog-classic',
      programmeName: 'Classic Stamps',
      title: '₹1,000 Denim & Cargo Credit',
      type: 'Fixed Discount',
      valueLabel: '₹1,000 Off',
      discountAmountInr: 1000,
      discountPercent: null,
      description: '₹1,000 off on baggy jeans, wide cargo pants, and layered outerwear.',
      requiredStamps: 20,
      validityMonths: 6,
      redemptionLimitPerMember: 2,
      redemptionLimit: '1 per member / quarter',
      eligibilityRule: 'Active members with >= 20 stamps',
      eligibilityConfig: {},
      status: 'Active',
    },
    {
      id: 'rw-pct-15',
      code: 'RW-15PCT',
      programmeId: 'prog-classic',
      programmeName: 'Classic Stamps',
      title: 'Streetwear Insider — 15% Off',
      type: 'Percentage Discount',
      valueLabel: '15% Off',
      discountAmountInr: null,
      discountPercent: 15,
      description: '15% off (up to ₹2,500) on oversized tees, boxy shirts, cargos, and jackets.',
      requiredStamps: 15,
      validityMonths: 3,
      redemptionLimitPerMember: 2,
      redemptionLimit: '2 per member / year',
      eligibilityRule: 'Active members with >= 15 stamps',
      eligibilityConfig: {},
      status: 'Active',
    },
    {
      id: 'rw-free-tee',
      code: 'RW-FREE-TEE',
      programmeId: 'prog-classic',
      programmeName: 'Classic Stamps',
      title: 'Complimentary Graphic Tee',
      type: 'Free Product',
      valueLabel: 'Free Heavyweight Tee',
      discountAmountInr: null,
      discountPercent: null,
      description: 'Redeem 1 complimentary seasonal monochrome graphic tee from our core drop.',
      requiredStamps: 25,
      validityMonths: 6,
      redemptionLimitPerMember: 1,
      redemptionLimit: '1 per member',
      eligibilityRule: 'Members with >= 25 stamps',
      eligibilityConfig: {},
      status: 'Active',
    },
    {
      id: 'rw-birthday',
      code: 'RW-BIRTHDAY',
      programmeId: null,
      programmeName: 'All Active Programmes',
      title: 'Birthday Month Streetwear Perk',
      type: 'Birthday Reward',
      valueLabel: '₹750 Birthday Credit',
      discountAmountInr: 750,
      discountPercent: null,
      description: 'Celebrate your birthday month with ₹750 credit + priority fitting support.',
      requiredStamps: 5,
      validityMonths: 1,
      redemptionLimitPerMember: 1,
      redemptionLimit: 'Once per year (birth month)',
      eligibilityRule: 'Members celebrating their birth month',
      eligibilityConfig: { birthday_month_only: true },
      status: 'Active',
    },
    {
      id: 'rw-early-drop',
      code: 'RW-EARLY-DROP',
      programmeId: 'prog-premium',
      programmeName: 'Premium Circle',
      title: 'Early Access to New Drops',
      type: 'Exclusive Member Offer',
      valueLabel: '48h Drop Preview',
      discountAmountInr: null,
      discountPercent: null,
      description: 'Be first to shop limited streetwear capsules, denim washes, and collabs.',
      requiredStamps: 10,
      validityMonths: 12,
      redemptionLimitPerMember: null,
      redemptionLimit: 'Unlimited while active',
      eligibilityRule: 'Premium Circle members (>= 10 lifetime stamps)',
      eligibilityConfig: { min_lifetime_stamps: 10 },
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
 * Looks up a customer by opaque QR token (`BFQR-...`), Membership ID, email, or phone in dev fixture.
 * Strictly identifies membership; never authorizes stamp awards or redemptions.
 */
export function lookupCustomerForScanner(query = '') {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const cleanedPhone = q.replace(/\s+/g, '');

  const match = ADMIN_DEV_FIXTURE.customers.find(
    (c) =>
      (c.qrToken && c.qrToken.toLowerCase() === q) ||
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
 * Live staff-only member lookup via PostgreSQL `fn_lookup_member_by_qr_or_query`.
 */
export async function lookupMemberLive(query = '') {
  const q = String(query || '').trim();
  if (!q) return { ok: false, code: 'VALIDATION_ERROR', message: 'Enter a QR token, ID, email, or phone.' };

  if (!isSupabaseConfigured()) {
    if (isProductionEnvironment()) {
      return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Live Supabase connection is required in production.' };
    }
    const devMatch = lookupCustomerForScanner(q);
    if (!devMatch) {
      return { ok: false, code: 'INVALID_QR_OR_MEMBER', message: 'Invalid QR identifier or unknown member.' };
    }
    return { ok: true, source: 'development-fixture', ...devMatch };
  }

  const res = await restRpc('fn_lookup_member_by_qr_or_query', { p_query: q });
  if (!res.ok) return res;
  if (!res.data) {
    return { ok: false, code: 'INVALID_QR_OR_MEMBER', message: 'Invalid QR identifier or unknown member.' };
  }

  const cards = Array.isArray(res.data.cards) ? res.data.cards : [];
  const activeCard = cards.find((c) => c.is_programme_valid) || cards[0] || null;
  return {
    ok: true,
    source: 'supabase-live',
    customer: {
      id: res.data.membership_id,
      uuid: res.data.customer_id,
      qrToken: res.data.qr_token,
      name: res.data.full_name,
      email: res.data.email,
      phone: res.data.phone || '',
      stamps: activeCard ? activeCard.current_stamps : 0,
      status: res.data.status === 'active' ? 'Active' : 'Inactive',
    },
    programme: activeCard
      ? {
          id: activeCard.programme_id,
          name: activeCard.programme_name,
          status: activeCard.programme_status,
          isValidNow: activeCard.is_programme_valid,
          stampGoal: activeCard.stamp_goal,
          qualifyingAmountInr: activeCard.qualifying_amount_inr,
          calculationRule: activeCard.calculation_rule,
        }
      : ADMIN_DEV_FIXTURE.programmes[0],
  };
}

/**
 * Invokes `issue-stamp` Edge Function when connected.
 * Never sends or trusts a frontend stamp count; uses `idempotencyKey` for safe retry protection.
 */
export async function awardStampsForPurchase({
  customerId,
  customerUuid = null,
  qrToken = null,
  programmeId = null,
  purchaseRef,
  amountInr,
  itemsSummary = '',
  idempotencyKey = '',
  calculatedStamps = null,
  programme = null,
}) {
  if ((!customerId && !customerUuid && !qrToken) || !purchaseRef || !amountInr || Number(amountInr) <= 0) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Customer, purchase reference, and a positive purchase amount are required.',
    };
  }

  if (programme && !isProgrammeCurrentlyValid(programme)) {
    return {
      ok: false,
      code: 'PROGRAMME_EXPIRED_OR_INACTIVE',
      message: `Cannot award stamps: programme "${programme.name}" is inactive or expired.`,
    };
  }

  if (!isSupabaseConfigured()) {
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

    if (calculatedStamps !== null && Number(calculatedStamps) <= 0) {
      return {
        ok: false,
        code: 'NOT_QUALIFYING',
        message: 'Purchase amount does not meet the minimum qualifying threshold for a stamp.',
      };
    }

    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message:
        'Stamp award request validated, but ledger credits require the Supabase Edge Function (`issue-stamp`). No client balance was modified.',
    };
  }

  // Note: calculatedStamps is NEVER transmitted to the Edge Function; the backend computes stamps authoritatively.
  const edgeRes = await invokeEdgeFunction('issue-stamp', {
    customerUuid,
    qrToken,
    programmeId,
    receiptNo: String(purchaseRef).trim(),
    amountInr: Number(amountInr),
    itemsSummary: String(itemsSummary || '').trim(),
    idempotencyKey: idempotencyKey || undefined,
  });

  if (!edgeRes.ok) return edgeRes;

  return {
    ok: true,
    idempotentReplay: Boolean(edgeRes.data?.idempotentReplay),
    result: edgeRes.data?.result ?? edgeRes.data ?? null,
  };
}

/**
 * Fetches stamp transactions from RLS-protected Supabase tables (or dev fixture when unconfigured).
 */
export async function fetchStampTransactions() {
  if (!isSupabaseConfigured()) {
    if (isProductionEnvironment()) {
      return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Live Supabase connection is required in production.', rows: [] };
    }
    return {
      ok: true,
      source: 'development-fixture',
      rows: ADMIN_DEV_FIXTURE.stampTransactions,
    };
  }

  const res = await restSelect(
    'stamp_transactions',
    'select=id,transaction_code,tx_type,stamps_delta,balance_after,status,created_at,notes,customers(membership_id,profiles(full_name,phone)),staff(staff_code),purchases(receipt_no,amount_inr,stores(name)),loyalty_programmes(name)&order=created_at.desc&limit=100',
  );

  if (!res.ok) return res;

  const rows = (res.data || []).map((tx) => {
    const d = new Date(tx.created_at);
    return {
      id: tx.transaction_code || tx.id,
      isoDate: Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10),
      dateTime: Number.isNaN(d.getTime())
        ? tx.created_at
        : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      customerId: tx.customers?.membership_id || '—',
      customerName: tx.customers?.profiles?.full_name || 'Member',
      customerPhone: tx.customers?.profiles?.phone || '—',
      staffId: tx.staff?.staff_code || 'SYSTEM',
      staffName: tx.staff?.staff_code || 'System',
      store: tx.purchases?.stores?.name || 'Flagship Store',
      purchaseRef: tx.purchases?.receipt_no || '—',
      amountInr: Number(tx.purchases?.amount_inr || 0),
      stampsAwarded: Number(tx.stamps_delta || 0),
      programme: tx.loyalty_programmes?.name || 'Classic Stamps',
      status: tx.status ? tx.status.charAt(0).toUpperCase() + tx.status.slice(1) : 'Awarded',
    };
  });

  return { ok: true, source: 'supabase-live', rows };
}

/**
 * Fetches loyalty rewards catalogue and programme options from Supabase (or read-only dev fixture).
 */
export async function fetchAdminRewards() {
  if (!isSupabaseConfigured()) {
    if (isProductionEnvironment()) {
      return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Live Supabase connection is required in production.', rewards: [], programmes: [] };
    }
    return {
      ok: true,
      source: 'development-fixture',
      rewards: ADMIN_DEV_FIXTURE.rewardsCatalog,
      programmes: ADMIN_DEV_FIXTURE.programmes,
    };
  }

  const [rewardsRes, progsRes] = await Promise.all([
    restSelect('rewards', 'select=*,loyalty_programmes(id,name)&order=required_stamps.asc'),
    restSelect('loyalty_programmes', 'select=id,name,status&order=name.asc'),
  ]);

  if (!rewardsRes.ok) return rewardsRes;

  const programmes = (progsRes.ok && Array.isArray(progsRes.data) ? progsRes.data : []).map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status === 'active' ? 'Active' : 'Inactive',
  }));

  const rewards = (rewardsRes.data || []).map((rw) => ({
    id: rw.id,
    code: rw.code,
    programmeId: rw.programme_id || null,
    programmeName: rw.loyalty_programmes?.name || 'All Active Programmes',
    title: rw.title,
    type: rw.reward_type,
    valueLabel: rw.value_label,
    discountAmountInr: rw.discount_amount_inr !== null ? Number(rw.discount_amount_inr) : null,
    discountPercent: rw.discount_percent !== null ? Number(rw.discount_percent) : null,
    description: rw.description || '',
    requiredStamps: Number(rw.required_stamps || 1),
    validityMonths: Number(rw.validity_months || 6),
    redemptionLimitPerMember: rw.redemption_limit_per_member ?? null,
    redemptionLimit: rw.redemption_limit_label || '1 per card completion',
    eligibilityRule: rw.eligibility_rule || 'All active BONFREE-HUB members',
    eligibilityConfig: rw.eligibility_config || {},
    status: rw.status === 'active' ? 'Active' : 'Inactive',
  }));

  return { ok: true, source: 'supabase-live', rewards, programmes };
}

/**
 * Creates or updates a reward definition in Supabase (`rewards` table via RLS `rewards.manage`).
 */
export async function saveRewardDefinition(payload) {
  const title = String(payload?.title || '').trim();
  const rewardType = String(payload?.type || payload?.reward_type || 'Fixed Discount').trim();
  const valueLabel = String(payload?.valueLabel || payload?.value_label || title).trim();
  const rawStamps = payload?.requiredStamps ?? payload?.required_stamps;
  const requiredStamps = rawStamps !== undefined ? Number(rawStamps) : 10;
  const rawValidity = payload?.validityMonths ?? payload?.validity_months;
  const validityMonths = rawValidity !== undefined ? Number(rawValidity) : 6;
  const status = String(payload?.status || 'Active').toLowerCase() === 'inactive' ? 'inactive' : 'active';

  if (!title || !valueLabel || !Number.isInteger(requiredStamps) || requiredStamps <= 0 || !Number.isInteger(validityMonths) || validityMonths <= 0) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Reward title, value label, positive required stamps, and positive validity duration are required.',
    };
  }

  const discountAmount =
    rewardType === 'Fixed Discount' && payload?.discountAmountInr !== undefined && String(payload.discountAmountInr).trim() !== ''
      ? Number(payload.discountAmountInr)
      : null;
  const discountPercent =
    rewardType === 'Percentage Discount' && payload?.discountPercent !== undefined && String(payload.discountPercent).trim() !== ''
      ? Number(payload.discountPercent)
      : null;

  if (discountAmount !== null && (Number.isNaN(discountAmount) || discountAmount < 0)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Discount amount must be zero or positive.' };
  }
  if (discountPercent !== null && (Number.isNaN(discountPercent) || discountPercent <= 0 || discountPercent > 100)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Discount percentage must be between 1 and 100.' };
  }

  const limitNumRaw = payload?.redemptionLimitPerMember ?? payload?.redemption_limit_per_member;
  const redemptionLimitPerMember =
    limitNumRaw !== undefined && limitNumRaw !== null && String(limitNumRaw).trim() !== ''
      ? Number(limitNumRaw)
      : null;

  if (redemptionLimitPerMember !== null && (!Number.isInteger(redemptionLimitPerMember) || redemptionLimitPerMember <= 0)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Redemption limit count must be a positive whole number.' };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message:
        'Reward configuration validated. Saving to PostgreSQL activates once Supabase backend & admin RBAC are connected.',
    };
  }

  const eligibilityConfig = {};
  if (rewardType === 'Birthday Reward' || payload?.birthdayMonthOnly === true || payload?.birthdayMonthOnly === 'true') {
    eligibilityConfig.birthday_month_only = true;
  }
  const minLife = Number(payload?.minLifetimeStamps || 0);
  if (Number.isInteger(minLife) && minLife > 0) {
    eligibilityConfig.min_lifetime_stamps = minLife;
  }

  const record = {
    programme_id: payload?.programmeId || null,
    title,
    reward_type: rewardType,
    value_label: valueLabel,
    discount_amount_inr: discountAmount,
    discount_percent: discountPercent,
    description: String(payload?.description || '').trim(),
    required_stamps: requiredStamps,
    validity_months: validityMonths,
    redemption_limit_per_member: redemptionLimitPerMember,
    redemption_limit_label: String(payload?.redemptionLimit || '1 per card completion').trim(),
    eligibility_rule: String(payload?.eligibilityRule || 'All active BONFREE-HUB members').trim(),
    eligibility_config: eligibilityConfig,
    status,
  };

  if (payload?.id) {
    const res = await restUpdate('rewards', `id=eq.${encodeURIComponent(payload.id)}`, record);
    if (!res.ok) return res;
    return { ok: true, reward: Array.isArray(res.data) ? res.data[0] : res.data };
  }

  const nonce =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 6).toUpperCase()
      : Math.random().toString(36).slice(2, 8).toUpperCase();

  const res = await restInsert('rewards', {
    code: `RW-${nonce}`,
    ...record,
  });
  if (!res.ok) return res;
  return { ok: true, reward: Array.isArray(res.data) ? res.data[0] : res.data };
}

/**
 * Activates or deactivates an existing reward in Supabase.
 */
export async function toggleRewardStatus({ rewardId, nextStatus }) {
  if (!rewardId) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Reward ID is required.' };
  }
  const normalized = String(nextStatus || '').toLowerCase() === 'active' ? 'active' : 'inactive';
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message: `Reward status change to "${normalized}" requires live Supabase admin connection.`,
    };
  }
  const res = await restUpdate('rewards', `id=eq.${encodeURIComponent(rewardId)}`, { status: normalized });
  if (!res.ok) return res;
  return { ok: true, reward: Array.isArray(res.data) ? res.data[0] : res.data };
}

/**
 * Fetches redemption queue and voucher history from Supabase (or dev fixture when unconfigured).
 */
export async function fetchAdminRedemptions() {
  if (!isSupabaseConfigured()) {
    if (isProductionEnvironment()) {
      return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Live Supabase connection is required in production.', rows: [] };
    }
    return {
      ok: true,
      source: 'development-fixture',
      rows: ADMIN_DEV_FIXTURE.redemptions,
    };
  }

  const res = await restSelect(
    'redemptions',
    'select=id,voucher_code,stamps_cost,status,rejection_reason,notes,requested_at,processed_at,customers(membership_id,profiles(full_name,phone)),rewards(title,reward_type,value_label),customer_rewards(expires_at),staff(staff_code)&order=requested_at.desc&limit=150',
  );

  if (!res.ok) return res;

  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : 'Pending');
  const fmtDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const rows = (res.data || []).map((r) => ({
    id: r.id,
    requestedOn: fmtDateTime(r.requested_at),
    isoDate: r.requested_at ? String(r.requested_at).slice(0, 10) : '',
    voucherCode: r.voucher_code,
    customerId: r.customers?.membership_id || '—',
    customerName: r.customers?.profiles?.full_name || 'Member',
    customerPhone: r.customers?.profiles?.phone || '—',
    rewardTitle: r.rewards?.title || 'Loyalty Reward',
    rewardType: r.rewards?.reward_type || '',
    stampsCost: Number(r.stamps_cost || 0),
    status: cap(r.status),
    expiresOn: fmtDate(r.customer_rewards?.expires_at),
    verifiedBy: r.staff?.staff_code || '—',
    notes: r.rejection_reason ? `Rejected: ${r.rejection_reason}` : r.notes || 'Ready for checkout verification.',
  }));

  return { ok: true, source: 'supabase-live', rows };
}

/**
 * Verifies a customer voucher code via the `redeem-reward` Edge Function (`mode: 'verify'`).
 */
export async function verifyVoucherCode(voucherCode) {
  const clean = String(voucherCode || '').trim().toUpperCase();
  if (!clean) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Enter a valid voucher code (e.g. BFH-XXXX-XXXXXX).' };
  }

  if (!isSupabaseConfigured()) {
    const match = ADMIN_DEV_FIXTURE.redemptions.find((r) => r.voucherCode.toUpperCase() === clean);
    if (!match) {
      return { ok: false, code: 'VOUCHER_NOT_FOUND', message: `No voucher found matching "${clean}".` };
    }
    return { ok: true, source: 'development-fixture', voucher: match };
  }

  const edgeRes = await invokeEdgeFunction('redeem-reward', { mode: 'verify', voucherCode: clean });
  if (!edgeRes.ok) return edgeRes;

  const v = edgeRes.data?.voucher;
  if (!v) {
    return { ok: false, code: 'VOUCHER_NOT_FOUND', message: 'Voucher details could not be loaded.' };
  }

  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : 'Pending');
  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return {
    ok: true,
    source: 'supabase-live',
    voucher: {
      id: v.redemption_id,
      voucherCode: v.voucher_code,
      customerId: v.customer_id || '—',
      customerName: v.customer_name || 'Member',
      customerPhone: v.customer_phone || '—',
      rewardTitle: v.reward_title || 'Loyalty Reward',
      rewardType: v.reward_type || '',
      stampsCost: Number(v.stamps_cost || 0),
      status: cap(v.status),
      expiresOn: fmtDate(v.expires_at),
      notes: v.notes || '',
    },
  };
}

export async function processRedemption({ redemptionId = null, voucherCode = null, action, rejectionReason = '' }) {
  if ((!redemptionId && !voucherCode) || !action) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Redemption ID or voucher code and action are required.' };
  }
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message: `Redemption "${action}" request prepared for ${voucherCode || redemptionId}, awaiting Supabase Edge Function (\`redeem-reward\`).`,
    };
  }
  const edgeRes = await invokeEdgeFunction('redeem-reward', {
    mode: action,
    redemptionId: redemptionId || undefined,
    voucherCode: voucherCode ? String(voucherCode).trim().toUpperCase() : undefined,
    rejectionReason: rejectionReason ? String(rejectionReason).trim() : undefined,
  });
  if (!edgeRes.ok) return edgeRes;
  return {
    ok: true,
    redemption: edgeRes.data?.redemption ?? edgeRes.data ?? null,
    message:
      action === 'confirm'
        ? `Voucher ${voucherCode || redemptionId} verified and marked Completed.`
        : `Redemption ${voucherCode || redemptionId} rejected and stamps refunded.`,
  };
}

/**
 * Staff authentication interface (Supabase Auth + active staff RBAC verification).
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

  const res = await supabaseAuth.signInWithPassword({
    email: String(email).trim().toLowerCase(),
    password,
  });

  if (!res.ok) return res;

  const userId = res.data?.user?.id;
  const staffRes = await restSelect(
    'staff',
    `select=id,staff_code,status,roles(code,name)&user_id=eq.${userId}`,
  );

  if (!staffRes.ok || !Array.isArray(staffRes.data) || staffRes.data.length === 0) {
    await supabaseAuth.signOut();
    return {
      ok: false,
      code: 'UNAUTHORIZED_STAFF_LOGIN',
      message: 'Unauthorized: This account does not have staff or administrator access.',
    };
  }

  const staffRow = staffRes.data[0];
  if (staffRow.status !== 'active') {
    await supabaseAuth.signOut();
    return {
      ok: false,
      code: 'STAFF_ACCOUNT_DEACTIVATED',
      message: 'Your staff account has been deactivated. Contact an Administrator to restore access.',
    };
  }

  return { ok: true, session: res.data, staff: staffRow };
}

/**
 * Sends a Supabase password recovery email for a staff work email address.
 */
export async function requestStaffPasswordReset({ email }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Enter a valid staff work email address.' };
  }
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message: 'Staff password reset emails activate once Supabase Authentication is connected.',
    };
  }
  const redirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/reset-password.html` : undefined;
  const res = await supabaseAuth.resetPasswordForEmail({ email: cleanEmail, redirectTo });
  if (!res.ok) return res;
  return {
    ok: true,
    message: 'If an active staff account matches that email, a password setup/reset link has been sent.',
  };
}

/**
 * Generates a deterministic-per-intent idempotency key for safe POS retries.
 */
export function createIdempotencyKey(customerKey = '', receiptNo = '') {
  const cleanCust = String(customerKey || 'cust').replace(/[^a-zA-Z0-9-]/g, '');
  const cleanRec = String(receiptNo || 'rec').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const nonce =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `idem-${cleanCust}-${cleanRec}-${nonce}`;
}

/**
 * Fetches loyalty member directory from RLS-protected Supabase tables (or dev fixture outside production).
 */
export async function fetchAdminCustomers() {
  if (!isSupabaseConfigured()) {
    if (isProductionEnvironment()) {
      return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Live Supabase connection is required in production.', rows: [] };
    }
    return { ok: true, source: 'development-fixture', rows: ADMIN_DEV_FIXTURE.customers };
  }

  const res = await restSelect(
    'customers',
    'select=id,membership_id,status,joined_at,profiles(full_name,email,phone),loyalty_cards(current_stamps,loyalty_programmes(name)),purchases(items_summary,amount_inr,purchased_at)&order=joined_at.desc&limit=200',
  );
  if (!res.ok) return res;

  const rows = (res.data || []).map((c) => {
    const cards = Array.isArray(c.loyalty_cards) ? c.loyalty_cards : [];
    const primaryCard = cards[0] || null;
    const purchases = Array.isArray(c.purchases) ? c.purchases : [];
    const totalSpend = purchases.reduce((sum, p) => sum + Number(p.amount_inr || 0), 0);
    const joinedDate = c.joined_at ? new Date(c.joined_at) : null;
    return {
      uuid: c.id,
      id: c.membership_id,
      name: c.profiles?.full_name || 'Member',
      email: c.profiles?.email || '—',
      phone: c.profiles?.phone || '—',
      programme: primaryCard?.loyalty_programmes?.name || 'Classic Stamps',
      stamps: Number(primaryCard?.current_stamps || 0),
      status: c.status === 'active' ? 'Active' : 'Inactive',
      joinedOn:
        joinedDate && !Number.isNaN(joinedDate.getTime())
          ? joinedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : '—',
      totalSpendInr: totalSpend,
      rewardsRedeemed: 0,
      recentPurchases: purchases.slice(0, 4).map(
        (p) => `${p.items_summary || 'Store purchase'} (₹${Number(p.amount_inr || 0).toLocaleString('en-IN')})`,
      ),
    };
  });

  return { ok: true, source: 'supabase-live', rows };
}

/**
 * Fetches loyalty programmes and tiers from Supabase (or dev fixture outside production).
 */
export async function fetchAdminProgrammes() {
  if (!isSupabaseConfigured()) {
    if (isProductionEnvironment()) {
      return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Live Supabase connection is required in production.', rows: [] };
    }
    return { ok: true, source: 'development-fixture', rows: ADMIN_DEV_FIXTURE.programmes };
  }

  const res = await restSelect(
    'loyalty_programmes',
    'select=id,code,name,subtitle,description,status,stamp_goal,qualifying_amount_inr,calculation_rule,stamp_validity_months,reward_validity_months,eligibility_rule,loyalty_programme_tiers(id,stamps_required,title,reward_value)&order=created_at.asc',
  );
  if (!res.ok) return res;

  const rows = (res.data || []).map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    subtitle: p.subtitle || 'Spend · Collect · Redeem',
    description: p.description || '',
    status: p.status === 'active' ? 'Active' : 'Inactive',
    stampGoal: Number(p.stamp_goal || 10),
    qualifyingAmountInr: Number(p.qualifying_amount_inr || 1000),
    calculationRule: p.calculation_rule || 'per_threshold',
    stampValidityMonths: Number(p.stamp_validity_months || 12),
    rewardValidityMonths: Number(p.reward_validity_months || 6),
    eligibility: p.eligibility_rule || 'All active loyalty club members',
    tiers: Array.isArray(p.loyalty_programme_tiers)
      ? p.loyalty_programme_tiers
          .map((t) => ({
            id: t.id,
            stamps: Number(t.stamps_required || 10),
            title: t.title,
            value: t.reward_value,
          }))
          .sort((a, b) => a.stamps - b.stamps)
      : [],
  }));

  return { ok: true, source: 'supabase-live', rows };
}

/**
 * Saves or creates a loyalty programme directly via RLS-authorized Supabase endpoints.
 */
export async function saveLoyaltyProgramme(programmePayload) {
  if (!programmePayload?.name) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Programme name is required.' };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message: 'Connect Supabase URL and public anon key before saving loyalty programmes.',
    };
  }

  const cleanName = String(programmePayload.name).trim();
  const slugCode = `PROG-${cleanName.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 18)}`;
  const row = {
    name: cleanName,
    subtitle: String(programmePayload.subtitle || 'Spend · Collect · Redeem').trim(),
    description: String(programmePayload.description || '').trim(),
    status: String(programmePayload.status || 'Active').toLowerCase() === 'active' ? 'active' : 'inactive',
    stamp_goal: Math.min(100, Math.max(1, Number(programmePayload.stampGoal || 10))),
    qualifying_amount_inr: Math.max(1, Number(programmePayload.qualifyingAmountInr || 1000)),
    calculation_rule: ['per_threshold', 'per_transaction', 'multiplier_2x'].includes(programmePayload.calculationRule)
      ? programmePayload.calculationRule
      : 'per_threshold',
    stamp_validity_months: Math.max(1, Number(programmePayload.stampValidityMonths || 12)),
    reward_validity_months: Math.max(1, Number(programmePayload.rewardValidityMonths || 6)),
    eligibility_rule: String(programmePayload.eligibility || 'All active BONFREE-HUB members').trim(),
  };

  let res;
  if (programmePayload.id) {
    res = await restUpdate('loyalty_programmes', `id=eq.${encodeURIComponent(programmePayload.id)}`, row);
  } else {
    res = await restInsert('loyalty_programmes', { ...row, code: slugCode });
  }

  if (!res.ok) return res;
  const saved = Array.isArray(res.data) ? res.data[0] : res.data;
  return {
    ok: true,
    programme: saved,
    message: `Programme "${cleanName}" saved to Supabase.`,
  };
}
