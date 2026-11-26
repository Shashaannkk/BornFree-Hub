/**
 * BONFREE-HUB Extended Admin Service & Fixtures (Phases 2C & 2D)
 *
 * Security & Architecture Rules:
 * - All datasets below are frozen read-only development fixtures (`isDevelopmentFixture: true`).
 * - Staff roles & permissions shown in UI are informative only; backend RLS & Edge Functions enforce RBAC.
 * - Never simulates successful DB writes or CSV authorization bypasses before Supabase is connected.
 */
import { isSupabaseConfigured } from '../core/config.js';

export const ADMIN_EXTENDED_FIXTURE = Object.freeze({
  isDevelopmentFixture: true,
  purchaseRecords: Object.freeze([
    {
      receiptNo: 'BFH-250131-0187',
      isoDate: '2025-01-31',
      dateTime: '31 Jan 2025, 19:24',
      memberId: 'BF-001248',
      memberName: 'Aanya Sharma',
      store: 'Bengaluru — MG Road',
      itemsSummary: 'Oversized Graphic Tee, Relaxed Cargo Pants',
      amountInr: 3798,
      qualifying: true,
      stampsAwarded: 3,
      recordedBy: 'Rohan Mehta (STF1002)',
    },
    {
      receiptNo: 'BFH-250131-0186',
      isoDate: '2025-01-31',
      dateTime: '31 Jan 2025, 17:02',
      memberId: 'BF-011234',
      memberName: 'Ishaan Mehta',
      store: 'Delhi — Khan Market',
      itemsSummary: 'Layered Utility Jacket, Baggy Raw Denim',
      amountInr: 6498,
      qualifying: true,
      stampsAwarded: 2,
      recordedBy: 'Neha Gupta (STF1001)',
    },
    {
      receiptNo: 'BFH-250131-0185',
      isoDate: '2025-01-31',
      dateTime: '31 Jan 2025, 15:37',
      memberId: 'BF-009902',
      memberName: 'Tara Sinha',
      store: 'Mumbai — Bandra',
      itemsSummary: 'Ribbed Crop Top (Monochrome)',
      amountInr: 799,
      qualifying: false,
      stampsAwarded: 0,
      recordedBy: 'Vikram Singh (STF1002)',
    },
    {
      receiptNo: 'BFH-250130-0184',
      isoDate: '2025-01-30',
      dateTime: '30 Jan 2025, 14:11',
      memberId: 'BF-011009',
      memberName: 'Kavya Iyer',
      store: 'Bengaluru — MG Road',
      itemsSummary: 'Boxy Poplin Shirt, Wide Cargo Trousers',
      amountInr: 4198,
      qualifying: true,
      stampsAwarded: 4,
      recordedBy: 'Rohan Mehta (STF1002)',
    },
    {
      receiptNo: 'BFH-250129-0183',
      isoDate: '2025-01-29',
      dateTime: '29 Jan 2025, 12:08',
      memberId: 'BF-010077',
      memberName: 'Arjun Bedi',
      store: 'Mumbai — Bandra',
      itemsSummary: 'Monochrome Cap & Socks Pack',
      amountInr: 699,
      qualifying: false,
      stampsAwarded: 0,
      recordedBy: 'Vikram Singh (STF1002)',
    },
    {
      receiptNo: 'BFH-250128-0182',
      isoDate: '2025-01-28',
      dateTime: '28 Jan 2025, 18:40',
      memberId: 'BF-010321',
      memberName: 'Myra Desai',
      store: 'Delhi — Khan Market',
      itemsSummary: 'Cropped Denim Jacket, Heavyweight Tee',
      amountInr: 5298,
      qualifying: true,
      stampsAwarded: 2,
      recordedBy: 'Neha Gupta (STF1001)',
    },
  ]),
  staffMembers: Object.freeze([
    {
      id: 'STF1001',
      name: 'Neha Gupta',
      email: 'neha.gupta@bonfree-hub.in',
      role: 'Store Manager',
      department: 'Delhi — Khan Market',
      status: 'Active',
      stampsIssuedCount: 412,
      redemptionsVerifiedCount: 68,
      recentActivity: [
        'Awarded +2 stamps to BF-011234 (INV-CP-43568)',
        'Verified voucher BFH-VCH-4821 for BF-000987',
      ],
    },
    {
      id: 'STF1002',
      name: 'Vikram Singh',
      email: 'vikram.singh@bonfree-hub.in',
      role: 'Sales Staff',
      department: 'Bengaluru — MG Road',
      status: 'Active',
      stampsIssuedCount: 289,
      redemptionsVerifiedCount: 41,
      recentActivity: [
        'Awarded +3 stamps to BF-001248 (BFH-250131-0187)',
        'Recorded non-qualifying receipt BFH-250131-0185',
      ],
    },
    {
      id: 'STF1003',
      name: 'Isha Menon',
      email: 'isha.menon@bonfree-hub.in',
      role: 'Administrator',
      department: 'Head Office — CRM',
      status: 'Active',
      stampsIssuedCount: 44,
      redemptionsVerifiedCount: 19,
      recentActivity: [
        'Updated Classic Stamps reward validity policy',
        'Audited monthly qualifying purchase report',
      ],
    },
    {
      id: 'STF1004',
      name: 'Rakesh Verma',
      email: 'rakesh.verma@bonfree-hub.in',
      role: 'Store Manager',
      department: 'Mumbai — Bandra',
      status: 'Active',
      stampsIssuedCount: 318,
      redemptionsVerifiedCount: 52,
      recentActivity: [
        'Verified voucher BFH-25K-8M2Q9 preview',
        'Awarded +2 stamps to BF-010077',
      ],
    },
    {
      id: 'STF1005',
      name: 'Pooja Nair',
      email: 'pooja.nair@bonfree-hub.in',
      role: 'Marketing Staff',
      department: 'Head Office — Marketing',
      status: 'Inactive',
      stampsIssuedCount: 0,
      redemptionsVerifiedCount: 0,
      recentActivity: [
        'Drafted Denim Days seasonal campaign',
        'Published Modern Streetwear feedback survey',
      ],
    },
  ]),
  roleMatrix: Object.freeze([
    {
      capability: 'Scan Member QR & Issue Stamps',
      Administrator: true,
      'Store Manager': true,
      'Sales Staff': true,
      'Marketing Staff': false,
    },
    {
      capability: 'Verify & Confirm Voucher Redemptions',
      Administrator: true,
      'Store Manager': true,
      'Sales Staff': true,
      'Marketing Staff': false,
    },
    {
      capability: 'Configure Loyalty Programmes & Rules',
      Administrator: true,
      'Store Manager': false,
      'Sales Staff': false,
      'Marketing Staff': false,
    },
    {
      capability: 'Manage Campaigns & Surveys',
      Administrator: true,
      'Store Manager': true,
      'Sales Staff': false,
      'Marketing Staff': true,
    },
    {
      capability: 'Manage Staff Roles & Accounts',
      Administrator: true,
      'Store Manager': false,
      'Sales Staff': false,
      'Marketing Staff': false,
    },
    {
      capability: 'Export Reports & Edit Brand Settings',
      Administrator: true,
      'Store Manager': true,
      'Sales Staff': false,
      'Marketing Staff': false,
    },
  ]),
  campaigns: Object.freeze([
    {
      id: 'camp-1',
      title: 'New Drop Rewards',
      description: 'Earn 2x loyalty stamps on new drop streetwear — oversized tees, cargos, baggy jeans and more.',
      image: '../assets/images/hero-streetwear.jpg',
      startDate: '2025-01-10',
      endDate: '2025-02-28',
      rule: '2x Stamp Multiplier on New Arrivals',
      status: 'Active',
    },
    {
      id: 'camp-2',
      title: 'Denim Days',
      description: 'Special rewards on denim — baggy jeans, relaxed fits and new washes for a modern everyday look.',
      image: '../assets/images/streetwear-editorial.jpg',
      startDate: '2025-02-01',
      endDate: '2025-03-31',
      rule: '+1 Bonus Stamp on Denim Purchases >= ₹2,000',
      status: 'Active',
    },
    {
      id: 'camp-3',
      title: "Members' Month",
      description: 'Exclusive offers, bonus stamps and early access for loyalty members on everyday streetwear.',
      image: '../assets/images/auth-login.jpg',
      startDate: '2025-03-01',
      endDate: '2025-03-31',
      rule: '48h Early Drop Access + Double Birthday Stamp',
      status: 'Scheduled',
    },
    {
      id: 'camp-4',
      title: 'Weekend Streetwear Sale',
      description: 'Weekend bonus stamps across boxy shirts, layered jackets, crop tops and relaxed trousers.',
      image: '../assets/images/store-interior.jpg',
      startDate: '2025-01-15',
      endDate: '2025-01-31',
      rule: '2x Stamps Fri–Sun In-Store',
      status: 'Completed',
    },
  ]),
  survey: Object.freeze({
    id: 'srv-streetwear-2025',
    title: 'Modern streetwear & everyday fashion',
    subtitle: 'Help us serve you better. Share your experience with BONFREE-HUB.',
    status: 'Draft',
    totalResponses: 368,
    avgRating: 4.6,
    topFeedback: [
      { label: 'Oversized tees & casual basics', pct: 42 },
      { label: 'Cargos & baggy jeans', pct: 28 },
      { label: 'Trendy boxy shirts', pct: 18 },
      { label: 'Layered jackets & tops', pct: 12 },
    ],
    questions: [
      {
        id: 'q1',
        type: 'rating',
        prompt: 'How would you rate your overall shopping & loyalty experience at BONFREE-HUB?',
        options: [],
      },
      {
        id: 'q2',
        type: 'multiple_choice',
        prompt: 'What do you like the most about our collections?',
        options: [
          'Oversized tees & casual basics',
          'Trendy boxy shirts',
          'Cargos & baggy jeans',
          'Layered jackets & crop tops',
        ],
      },
      {
        id: 'q3',
        type: 'short_answer',
        prompt: 'Which streetwear fit or colourway should we restock next?',
        options: [],
      },
      {
        id: 'q4',
        type: 'long_answer',
        prompt: 'Any suggestions to make your BONFREE-HUB loyalty rewards even better?',
        options: [],
      },
    ],
    responses: [
      { memberId: 'BF-001248', memberName: 'Aanya Sharma', rating: 5, favorite: 'Oversized tees & casual basics', submittedOn: '31 Jan 2025' },
      { memberId: 'BF-011234', memberName: 'Ishaan Mehta', rating: 5, favorite: 'Cargos & baggy jeans', submittedOn: '30 Jan 2025' },
      { memberId: 'BF-011009', memberName: 'Kavya Iyer', rating: 4, favorite: 'Trendy boxy shirts', submittedOn: '29 Jan 2025' },
      { memberId: 'BF-010321', memberName: 'Myra Desai', rating: 5, favorite: 'Layered jackets & crop tops', submittedOn: '28 Jan 2025' },
    ],
  }),
  analytics: Object.freeze({
    byPeriod: Object.freeze({
      daily: { members: 12840, active: 11920, stamps: 1285, redeemed: 198, revenueInr: 1945000, avgFreq: '2.1x / mo' },
      weekly: { members: 12840, active: 11920, stamps: 8640, redeemed: 1120, revenueInr: 6840000, avgFreq: '2.4x / mo' },
      monthly: { members: 12840, active: 11920, stamps: 38275, redeemed: 4892, revenueInr: 18640000, avgFreq: '2.6x / mo' },
      custom: { members: 12840, active: 11920, stamps: 24190, redeemed: 3110, revenueInr: 12490000, avgFreq: '2.5x / mo' },
    }),
    stampWeeklyBars: Object.freeze([
      { label: 'Week 1', value: 6420 },
      { label: 'Week 2', value: 7350 },
      { label: 'Week 3', value: 7810 },
      { label: 'Week 4', value: 8640 },
      { label: 'Week 5', value: 8055 },
    ]),
    mostActiveCustomers: Object.freeze([
      { rank: 1, name: 'Ananya Sharma', memberId: 'BFH100482', stampsEarned: 180, rewardsRedeemed: 6, totalSpendInr: 284000 },
      { rank: 2, name: 'Rohan Mehta', memberId: 'BFH100317', stampsEarned: 162, rewardsRedeemed: 5, totalSpendInr: 248500 },
      { rank: 3, name: 'Kavya Iyer', memberId: 'BFH100901', stampsEarned: 146, rewardsRedeemed: 5, totalSpendInr: 210000 },
      { rank: 4, name: 'Arjun Kapoor', memberId: 'BFH100756', stampsEarned: 138, rewardsRedeemed: 4, totalSpendInr: 196500 },
    ]),
    programmePerformance: Object.freeze([
      { name: 'Classic Stamps', members: 8420, stamps: 24100, redemptionRate: '34.2%' },
      { name: 'Premium Circle', members: 2680, stamps: 9840, redemptionRate: '41.8%' },
      { name: 'Festive Rewards', members: 1740, stamps: 4335, redemptionRate: '28.5%' },
    ]),
  }),
  settings: Object.freeze({
    brandName: 'BONFREE-HUB',
    tagline: 'Modern Streetwear & Everyday Fashion',
    supportEmail: 'care@bonfree-hub.in',
    supportPhone: '+91 98765 43210',
    address: 'Spectrum Mall, MG Road, Bengaluru — 560001, India',
    defaultStampValidityMonths: 12,
    defaultRewardValidityMonths: 6,
    twoFactorEnabled: true,
    loginAlertsEnabled: true,
    sessionTimeoutMinutes: 30,
    adminName: 'Admin',
    adminEmail: 'admin@bonfree-hub.in',
    dailyDigestAlerts: true,
    highValueRedemptionAlerts: true,
  }),
});

/**
 * Generates RFC-4180 compliant CSV text safely (neutralizing formula injection prefixes).
 */
export function buildSafeCsv(headers = [], rows = []) {
  const escapeCell = (val) => {
    let str = val === null || val === undefined ? '' : String(val);
    if (/^[=+\-@]/.test(str)) {
      str = `'${str}`;
    }
    return `"${str.replace(/"/g, '""')}"`;
  };
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','));
  }
  return lines.join('\r\n');
}

function pendingBackendResult(actionName) {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message: `${actionName} validated cleanly, but persistence requires Phase 3 Supabase RBAC & Edge Function integration.`,
    };
  }
  return {
    ok: false,
    code: 'SERVICE_PENDING',
    message: `${actionName} connects in Phase 3.`,
  };
}

export async function saveStaffMember(payload) {
  if (!payload?.name || !payload?.email || !payload?.role) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Staff name, email, and role are required.' };
  }
  return pendingBackendResult('Staff account update');
}

export async function saveCampaign(payload) {
  if (!payload?.title || !payload?.startDate || !payload?.endDate) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Campaign title, start date, and end date are required.' };
  }
  return pendingBackendResult('Campaign configuration');
}

export async function saveSurvey(payload) {
  if (!payload?.title || !Array.isArray(payload.questions) || payload.questions.length === 0) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Survey title and at least one question are required.' };
  }
  return pendingBackendResult(`Survey (${payload.status || 'Draft'})`);
}

export async function saveBrandSettings(payload) {
  if (!payload?.brandName || !payload?.supportEmail) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Brand name and support email are required.' };
  }
  return pendingBackendResult('Brand & security settings');
}

export async function updateAdminAccountPassword({ currentPassword, newPassword }) {
  if (!currentPassword || !newPassword) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Current and new passwords are required.' };
  }
  return pendingBackendResult('Admin password update');
}
