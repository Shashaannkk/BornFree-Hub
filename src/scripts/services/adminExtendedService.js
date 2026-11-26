/**
 * BONFREE-HUB Extended Admin Service & Fixtures (Phases 2C & 2D)
 *
 * Security & Architecture Rules:
 * - All datasets below are frozen read-only development fixtures (`isDevelopmentFixture: true`).
 * - Staff roles & permissions shown in UI are informative only; backend RLS & Edge Functions enforce RBAC.
 * - Never simulates successful DB writes or CSV authorization bypasses before Supabase is connected.
 */
import { isProductionEnvironment, isSupabaseConfigured } from '../core/config.js';
import {
  invokeEdgeFunction,
  restDelete,
  restInsert,
  restSelect,
  restUpdate,
  supabaseAuth,
  uploadStorageObject,
} from '../core/supabaseClient.js';

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
      capability: 'View Customer Directory & Balances (customers.read)',
      Administrator: true,
      'Store Manager': true,
      'Sales Staff': true,
      'Marketing Staff': false,
    },
    {
      capability: 'Edit Customer Profiles & Status (customers.manage)',
      Administrator: true,
      'Store Manager': true,
      'Sales Staff': false,
      'Marketing Staff': false,
    },
    {
      capability: 'View Purchase Records (purchases.read)',
      Administrator: true,
      'Store Manager': true,
      'Sales Staff': true,
      'Marketing Staff': false,
    },
    {
      capability: 'View Stamp Ledger (stamps.read)',
      Administrator: true,
      'Store Manager': true,
      'Sales Staff': true,
      'Marketing Staff': false,
    },
    {
      capability: 'Scan Member QR & Issue Stamps (stamps.issue)',
      Administrator: true,
      'Store Manager': true,
      'Sales Staff': true,
      'Marketing Staff': false,
    },
    {
      capability: 'Create, Edit & Toggle Rewards (rewards.manage)',
      Administrator: true,
      'Store Manager': true,
      'Sales Staff': false,
      'Marketing Staff': false,
    },
    {
      capability: 'Verify & Confirm Voucher Redemptions (redemptions.verify)',
      Administrator: true,
      'Store Manager': true,
      'Sales Staff': true,
      'Marketing Staff': false,
    },
    {
      capability: 'Configure Loyalty Programmes & Rules (programmes.manage)',
      Administrator: true,
      'Store Manager': false,
      'Sales Staff': false,
      'Marketing Staff': false,
    },
    {
      capability: 'Create & Toggle Campaigns (campaigns.manage)',
      Administrator: true,
      'Store Manager': true,
      'Sales Staff': false,
      'Marketing Staff': true,
    },
    {
      capability: 'Build Surveys & View Responses (surveys.manage)',
      Administrator: true,
      'Store Manager': false,
      'Sales Staff': false,
      'Marketing Staff': true,
    },
    {
      capability: 'Manage Staff Roles & Granular Permissions (staff.manage)',
      Administrator: true,
      'Store Manager': false,
      'Sales Staff': false,
      'Marketing Staff': false,
    },
    {
      capability: 'View Loyalty Analytics (analytics.view)',
      Administrator: true,
      'Store Manager': true,
      'Sales Staff': false,
      'Marketing Staff': true,
    },
    {
      capability: 'Preview & Export CSV Reports (reports.export)',
      Administrator: true,
      'Store Manager': true,
      'Sales Staff': false,
      'Marketing Staff': false,
    },
    {
      capability: 'Modify Brand & Security Settings (settings.manage)',
      Administrator: true,
      'Store Manager': false,
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
      programmeId: 'prog-classic',
      programmeName: 'Classic Stamps',
      multiplier: 2,
      bonusStamps: 0,
      minPurchaseInr: 1000,
      eligibilityRule: 'Classic Stamps members on purchases >= ₹1,000',
      startDate: '2026-11-01',
      endDate: '2026-12-31',
      rule: '2x Stamp Multiplier on New Arrivals',
      status: 'Active',
    },
    {
      id: 'camp-2',
      title: 'Denim Days',
      description: 'Special rewards on denim — baggy jeans, relaxed fits and new washes for a modern everyday look.',
      image: '../assets/images/streetwear-editorial.jpg',
      programmeId: 'prog-classic',
      programmeName: 'Classic Stamps',
      multiplier: 1,
      bonusStamps: 1,
      minPurchaseInr: 2000,
      eligibilityRule: 'Classic Stamps members spending >= ₹2,000',
      startDate: '2026-11-15',
      endDate: '2026-12-31',
      rule: '+1 Bonus Stamp on Denim Purchases >= ₹2,000',
      status: 'Active',
    },
    {
      id: 'camp-3',
      title: "Members' Month Exclusive",
      description: 'Exclusive offers, bonus stamps and early access for loyalty members on everyday streetwear.',
      image: '../assets/images/auth-login.jpg',
      programmeId: 'prog-premium',
      programmeName: 'Premium Circle',
      multiplier: 1,
      bonusStamps: 2,
      minPurchaseInr: 2500,
      eligibilityRule: 'Premium Circle members',
      startDate: '2027-01-01',
      endDate: '2027-01-31',
      rule: '+2 Bonus Stamps for Premium Circle',
      status: 'Scheduled',
    },
    {
      id: 'camp-4',
      title: 'Weekend Streetwear Sale',
      description: 'Weekend bonus stamps across boxy shirts, layered jackets, crop tops and relaxed trousers.',
      image: '../assets/images/store-interior.jpg',
      programmeId: null,
      programmeName: 'All Active Programmes',
      multiplier: 2,
      bonusStamps: 0,
      minPurchaseInr: 1500,
      eligibilityRule: 'All active BONFREE-HUB members',
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

const ROLE_NAME_TO_CODE = Object.freeze({
  Administrator: 'administrator',
  'Store Manager': 'store_manager',
  'Sales Staff': 'sales_staff',
  'Marketing Staff': 'marketing_staff',
  administrator: 'administrator',
  store_manager: 'store_manager',
  sales_staff: 'sales_staff',
  marketing_staff: 'marketing_staff',
});

export async function fetchStaffDirectory() {
  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      source: 'development-fixture',
      staff: ADMIN_EXTENDED_FIXTURE.staffMembers,
      roles: [
        { code: 'administrator', name: 'Administrator' },
        { code: 'store_manager', name: 'Store Manager' },
        { code: 'sales_staff', name: 'Sales Staff' },
        { code: 'marketing_staff', name: 'Marketing Staff' },
      ],
      permissions: [
        { code: 'customers.read', module: 'customers', description: 'View customer directory and loyalty balances' },
        { code: 'customers.manage', module: 'customers', description: 'Edit customer profiles and membership status' },
        { code: 'purchases.read', module: 'purchases', description: 'View store purchase records and receipts' },
        { code: 'stamps.read', module: 'stamps', description: 'View stamp transaction ledger' },
        { code: 'stamps.issue', module: 'scanner', description: 'Verify receipts and issue loyalty stamps' },
        { code: 'rewards.manage', module: 'rewards', description: 'Create, edit, and toggle reward catalogue items' },
        { code: 'redemptions.verify', module: 'redemptions', description: 'Verify, confirm, or reject voucher redemptions' },
        { code: 'programmes.manage', module: 'loyalty', description: 'Create and configure loyalty programmes' },
        { code: 'campaigns.manage', module: 'campaigns', description: 'Create and toggle promotional campaigns' },
        { code: 'surveys.manage', module: 'surveys', description: 'Build surveys and inspect customer feedback' },
        { code: 'staff.manage', module: 'staff', description: 'Provision staff, assign roles, and manage permissions' },
        { code: 'analytics.view', module: 'analytics', description: 'View aggregated loyalty analytics' },
        { code: 'reports.export', module: 'reports', description: 'Preview and export authorized CSV reports' },
        { code: 'settings.manage', module: 'settings', description: 'Modify brand details, validity & security settings' },
      ],
      rolePermissions: [],
      roleMatrix: ADMIN_EXTENDED_FIXTURE.roleMatrix,
      stores: [
        { id: '', name: 'Head Office / Operations' },
      ],
    };
  }

  const res = await invokeEdgeFunction('manage-staff', { action: 'list' });
  if (!res.ok) return res;

  const data = res.data || {};
  const roles = data.roles || [];
  const permissions = data.permissions || [];
  const rolePerms = data.rolePermissions || [];

  const permSetByRoleId = new Map();
  for (const rp of rolePerms) {
    if (!permSetByRoleId.has(rp.role_id)) permSetByRoleId.set(rp.role_id, new Set());
    permSetByRoleId.get(rp.role_id).add(rp.permission_id);
  }

  const roleByCode = new Map(roles.map((r) => [r.code, r]));
  const roleMatrix = permissions.map((p) => ({
    capability: `${p.description || p.code} (${p.code})`,
    Administrator: Boolean(permSetByRoleId.get(roleByCode.get('administrator')?.id)?.has(p.id)),
    'Store Manager': Boolean(permSetByRoleId.get(roleByCode.get('store_manager')?.id)?.has(p.id)),
    'Sales Staff': Boolean(permSetByRoleId.get(roleByCode.get('sales_staff')?.id)?.has(p.id)),
    'Marketing Staff': Boolean(permSetByRoleId.get(roleByCode.get('marketing_staff')?.id)?.has(p.id)),
  }));

  return {
    ok: true,
    source: 'supabase-live',
    staff: data.staff || [],
    roles,
    permissions,
    rolePermissions: rolePerms,
    roleMatrix: roleMatrix.length > 0 ? roleMatrix : ADMIN_EXTENDED_FIXTURE.roleMatrix,
    stores: data.stores || [],
  };
}

export async function saveStaffMember(payload) {
  if (!payload?.name || (!payload?.uuid && !payload?.email) || !payload?.role) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Staff name, email, and role are required.' };
  }

  const staffCode = payload?.staffId
    ? String(payload.staffId).trim().toUpperCase()
    : `STF${String(Math.floor(1000 + Math.random() * 9000))}`;
  if (!payload?.uuid && !/^STF[0-9]{4,}$/.test(staffCode)) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Staff ID must follow format STF followed by at least 4 digits (e.g. STF1006).',
    };
  }

  const roleCode = ROLE_NAME_TO_CODE[payload.role] || '';
  if (!roleCode) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid role selected.' };
  }

  if (!isSupabaseConfigured()) {
    return pendingBackendResult('Staff account update');
  }

  const isEdit = Boolean(payload.uuid);
  const redirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/reset-password.html` : undefined;

  return invokeEdgeFunction('manage-staff', {
    action: isEdit ? 'update' : 'create',
    staffId: payload.uuid || undefined,
    staffCode,
    fullName: String(payload.name).trim(),
    email: payload.email ? String(payload.email).trim().toLowerCase() : undefined,
    roleCode,
    storeId: payload.storeId || null,
    department: payload.department || 'Operations',
    status: String(payload.status || 'Active').toLowerCase() === 'inactive' ? 'inactive' : 'active',
    redirectTo,
  });
}

export async function toggleStaffAccountStatus({ staffUuid, nextStatus }) {
  if (!staffUuid) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Staff UUID is required.' };
  }
  const normalized = String(nextStatus || '').toLowerCase() === 'inactive' ? 'inactive' : 'active';
  if (!isSupabaseConfigured()) {
    return pendingBackendResult(`Staff status update (${normalized})`);
  }
  return invokeEdgeFunction('manage-staff', {
    action: 'update_status',
    staffId: staffUuid,
    status: normalized,
  });
}

export async function saveStaffPermissionOverrides({ staffUuid, overrides }) {
  if (!staffUuid || !overrides || typeof overrides !== 'object') {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Staff UUID and permissions map are required.' };
  }
  if (!isSupabaseConfigured()) {
    return pendingBackendResult('Granular permission override save');
  }
  return invokeEdgeFunction('manage-staff', {
    action: 'set_permissions',
    staffId: staffUuid,
    overrides,
  });
}

export async function sendStaffPasswordSetup({ staffUuid, email }) {
  if (!email) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Staff work email is required.' };
  }
  if (!isSupabaseConfigured()) {
    return pendingBackendResult('Staff password setup link');
  }
  const redirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/reset-password.html` : undefined;
  return invokeEdgeFunction('manage-staff', {
    action: 'send_reset',
    staffId: staffUuid || undefined,
    email: String(email).trim().toLowerCase(),
    redirectTo,
  });
}

export async function fetchStaffActivityLog(staffUuid) {
  if (!staffUuid || !isSupabaseConfigured()) {
    return { ok: true, source: 'development-fixture', auditLogs: [], stampTransactions: [], redemptions: [] };
  }
  return invokeEdgeFunction('manage-staff', { action: 'get_activity', staffId: staffUuid });
}

export const CAMPAIGN_ASSET_OPTIONS = Object.freeze([
  { label: 'New Drop Streetwear (Hero Lookbook)', path: 'assets/images/hero-streetwear.jpg' },
  { label: 'Denim Editorial Portrait', path: 'assets/images/streetwear-editorial.jpg' },
  { label: 'Members Exclusive Portrait', path: 'assets/images/auth-login.jpg' },
  { label: 'Flagship Store Interior', path: 'assets/images/store-interior.jpg' },
]);

function resolveAdminImageSrc(rawPath = '') {
  const clean = String(rawPath || '').trim();
  if (!clean) return '../assets/images/hero-streetwear.jpg';
  if (/^https?:\/\//i.test(clean) || clean.startsWith('../') || clean.startsWith('/')) {
    return clean;
  }
  return `../${clean.replace(/^\.\//, '')}`;
}

export function deriveCampaignDisplayStatus(camp, nowDate = new Date()) {
  const raw = String(camp?.status || 'active').toLowerCase();
  if (raw === 'inactive') return 'Inactive';
  if (raw === 'completed') return 'Completed';
  const todayIso = nowDate.toISOString().slice(0, 10);
  if (camp?.endDate && String(camp.endDate) < todayIso) return 'Completed';
  if (raw === 'scheduled' || (camp?.startDate && String(camp.startDate) > todayIso)) return 'Scheduled';
  return 'Active';
}

export async function fetchAdminCampaigns() {
  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      source: 'development-fixture',
      campaigns: ADMIN_EXTENDED_FIXTURE.campaigns.map((c) => ({
        ...c,
        status: deriveCampaignDisplayStatus(c),
      })),
      programmes: [
        { id: 'prog-classic', name: 'Classic Stamps', status: 'Active' },
        { id: 'prog-premium', name: 'Premium Circle', status: 'Active' },
        { id: 'prog-festive', name: 'Festive Rewards', status: 'Active' },
      ],
    };
  }

  const [campRes, progsRes] = await Promise.all([
    restSelect('campaigns', 'select=*,loyalty_programmes(id,name)&order=start_date.desc'),
    restSelect('loyalty_programmes', 'select=id,name,status&order=name.asc'),
  ]);

  if (!campRes.ok) return campRes;

  const programmes = (progsRes.ok && Array.isArray(progsRes.data) ? progsRes.data : []).map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status === 'active' ? 'Active' : 'Inactive',
  }));

  const campaigns = (campRes.data || []).map((c) => {
    const mapped = {
      id: c.id,
      title: c.title,
      description: c.description || '',
      image: resolveAdminImageSrc(c.image_path),
      rawImagePath: c.image_path || 'assets/images/hero-streetwear.jpg',
      programmeId: c.programme_id || null,
      programmeName: c.loyalty_programmes?.name || 'All Active Programmes',
      multiplier: Number(c.multiplier || 1),
      bonusStamps: Number(c.bonus_stamps || 0),
      minPurchaseInr: Number(c.eligibility_config?.min_purchase_inr || 0),
      eligibilityRule: c.eligibility_rule || 'All active BONFREE-HUB members',
      startDate: c.start_date,
      endDate: c.end_date,
      rule: c.promotional_rule || `${Number(c.multiplier || 1)}x Stamps`,
      status: c.status,
    };
    return {
      ...mapped,
      status: deriveCampaignDisplayStatus(mapped),
    };
  });

  return { ok: true, source: 'supabase-live', campaigns, programmes };
}

export async function uploadCampaignImage(file) {
  if (!file) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Please choose an image file.' };
  }
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (file.type && !allowed.has(file.type)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Only JPG, PNG, and WEBP campaign images are supported.' };
  }
  if (file.size && file.size > 5 * 1024 * 1024) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Campaign image must be under 5 MB.' };
  }
  if (!isSupabaseConfigured()) {
    return pendingBackendResult('Campaign image upload');
  }

  const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const nonce =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return uploadStorageObject('campaign-images', `campaigns/${Date.now()}-${nonce}.${ext}`, file);
}

export async function saveCampaign(payload) {
  const title = String(payload?.title || '').trim();
  const startDate = String(payload?.startDate || '').trim();
  const endDate = String(payload?.endDate || '').trim();
  const multiplier = payload?.multiplier !== undefined && payload.multiplier !== '' ? Number(payload.multiplier) : 1;
  const bonusStamps = payload?.bonusStamps !== undefined && payload.bonusStamps !== '' ? Number(payload.bonusStamps) : 0;
  const minPurchase = payload?.minPurchaseInr !== undefined && payload.minPurchaseInr !== '' ? Number(payload.minPurchaseInr) : 0;

  if (!title || !startDate || !endDate) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Campaign title, start date, and end date are required.' };
  }
  if (endDate < startDate) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Campaign end date cannot be earlier than start date.' };
  }
  if (Number.isNaN(multiplier) || multiplier < 1 || multiplier > 10) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Stamp multiplier must be between 1.0 and 10.0.' };
  }
  if (!Number.isInteger(bonusStamps) || bonusStamps < 0) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Bonus stamps must be a whole number >= 0.' };
  }
  if (!isSupabaseConfigured()) {
    return pendingBackendResult('Campaign configuration');
  }

  const normalizedStatusRaw = String(payload?.status || 'active').toLowerCase();
  const status = ['active', 'scheduled', 'completed', 'inactive'].includes(normalizedStatusRaw)
    ? normalizedStatusRaw
    : 'active';

  const record = {
    title,
    description: String(payload?.description || '').trim(),
    image_path: String(payload?.imagePath || payload?.rawImagePath || 'assets/images/hero-streetwear.jpg').trim(),
    programme_id: payload?.programmeId || null,
    multiplier,
    bonus_stamps: bonusStamps,
    promotional_rule: String(payload?.rule || `${multiplier}x Stamps${bonusStamps > 0 ? ` + ${bonusStamps} Bonus` : ''}`).trim(),
    eligibility_rule: String(payload?.eligibilityRule || 'All active BONFREE-HUB members').trim(),
    eligibility_config: minPurchase > 0 ? { min_purchase_inr: minPurchase } : {},
    start_date: startDate,
    end_date: endDate,
    status,
  };

  if (payload?.id) {
    const res = await restUpdate('campaigns', `id=eq.${encodeURIComponent(payload.id)}`, record);
    if (!res.ok) return res;
    return { ok: true, campaign: Array.isArray(res.data) ? res.data[0] : res.data };
  }

  const res = await restInsert('campaigns', record);
  if (!res.ok) return res;
  return { ok: true, campaign: Array.isArray(res.data) ? res.data[0] : res.data };
}

export async function toggleCampaignStatus({ campaignId, nextStatus }) {
  if (!campaignId) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Campaign ID is required.' };
  }
  const normalized = String(nextStatus || '').toLowerCase() === 'inactive' ? 'inactive' : 'active';
  if (!isSupabaseConfigured()) {
    return pendingBackendResult(`Campaign status (${normalized})`);
  }
  const res = await restUpdate('campaigns', `id=eq.${encodeURIComponent(campaignId)}`, { status: normalized });
  if (!res.ok) return res;
  return { ok: true, campaign: Array.isArray(res.data) ? res.data[0] : res.data };
}

export function computeSurveyAnalytics(questions = [], responses = []) {
  const totalResponses = responses.length;
  const ratingValues = responses
    .map((r) => Number(r.rating ?? r.overall_rating))
    .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 5);
  const avgRating =
    ratingValues.length > 0
      ? (ratingValues.reduce((sum, v) => sum + v, 0) / ratingValues.length).toFixed(1)
      : '0.0';

  const mcQuestion = questions.find((q) => q.type === 'multiple_choice' && Array.isArray(q.options) && q.options.length > 0);
  const counts = new Map();
  if (mcQuestion) {
    for (const opt of mcQuestion.options) counts.set(opt, 0);
    for (const r of responses) {
      const picked = r.favorite || r.answers?.[mcQuestion.id] || r.answers?.favoriteCollection;
      if (picked && counts.has(picked)) {
        counts.set(picked, counts.get(picked) + 1);
      } else if (picked) {
        counts.set(picked, (counts.get(picked) || 0) + 1);
      }
    }
  }

  const topFeedback = Array.from(counts.entries()).map(([label, cnt]) => ({
    label,
    count: cnt,
    pct: totalResponses > 0 ? Math.round((cnt / totalResponses) * 100) : 0,
  }));

  return { totalResponses, avgRating, topFeedback };
}

export async function fetchAdminSurveys() {
  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      source: 'development-fixture',
      surveys: [
        {
          ...ADMIN_EXTENDED_FIXTURE.survey,
          status: ADMIN_EXTENDED_FIXTURE.survey.status,
          programmeId: null,
        },
      ],
      programmes: [
        { id: 'prog-classic', name: 'Classic Stamps' },
        { id: 'prog-premium', name: 'Premium Circle' },
      ],
    };
  }

  const [surveysRes, questionsRes, responsesRes, progsRes] = await Promise.all([
    restSelect('surveys', 'select=*,loyalty_programmes(id,name)&order=updated_at.desc'),
    restSelect('survey_questions', 'select=*&order=sort_order.asc'),
    restSelect('survey_responses', 'select=*,customers(membership_id,profiles(full_name))&order=submitted_at.desc&limit=250'),
    restSelect('loyalty_programmes', 'select=id,name&order=name.asc'),
  ]);

  if (!surveysRes.ok) return surveysRes;

  const qBySurvey = new Map();
  for (const q of questionsRes.data || []) {
    if (!qBySurvey.has(q.survey_id)) qBySurvey.set(q.survey_id, []);
    qBySurvey.get(q.survey_id).push({
      id: q.id,
      type: q.question_type,
      prompt: q.prompt,
      options: Array.isArray(q.options) ? q.options : [],
      sortOrder: q.sort_order,
    });
  }

  const rBySurvey = new Map();
  for (const r of responsesRes.data || []) {
    if (!rBySurvey.has(r.survey_id)) rBySurvey.set(r.survey_id, []);
    const ansObj = r.answers && typeof r.answers === 'object' ? r.answers : {};
    const favorite =
      ansObj.favoriteCollection ||
      Object.values(ansObj).find((v) => typeof v === 'string' && v.trim().length > 0) ||
      '—';
    const submittedDate = r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    rBySurvey.get(r.survey_id).push({
      id: r.id,
      memberId: r.customers?.membership_id || 'Member',
      memberName: r.customers?.profiles?.full_name || 'Verified Member',
      rating: r.overall_rating ?? '—',
      favorite,
      answers: ansObj,
      submittedOn: submittedDate,
    });
  }

  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : 'Draft');
  const surveys = (surveysRes.data || []).map((sv) => {
    const qsList = qBySurvey.get(sv.id) || [];
    const rsList = rBySurvey.get(sv.id) || [];
    const analytics = computeSurveyAnalytics(qsList, rsList);
    return {
      id: sv.id,
      title: sv.title,
      subtitle: sv.subtitle || '',
      programmeId: sv.eligible_programme_id || null,
      programmeName: sv.loyalty_programmes?.name || 'All Active Members',
      status: cap(sv.status),
      questions: qsList,
      responses: rsList,
      totalResponses: analytics.totalResponses,
      avgRating: analytics.avgRating,
      topFeedback: analytics.topFeedback,
    };
  });

  return {
    ok: true,
    source: 'supabase-live',
    surveys,
    programmes: progsRes.data || [],
  };
}

export async function saveSurvey(payload) {
  const title = String(payload?.title || '').trim();
  if (!title || !Array.isArray(payload?.questions) || payload.questions.length === 0) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Survey title and at least one question are required.' };
  }

  for (const q of payload.questions) {
    if (q?.prompt !== undefined && !String(q.prompt).trim()) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'Every survey question must have a non-empty prompt.' };
    }
  }

  const rawStatus = String(payload?.status || 'Draft').toLowerCase();
  if (!isSupabaseConfigured()) {
    return pendingBackendResult(`Survey (${payload.status || 'Draft'})`);
  }

  const dbStatus = ['draft', 'published', 'closed', 'archived'].includes(rawStatus) ? rawStatus : 'draft';
  const surveyRecord = {
    title,
    subtitle: String(payload?.subtitle || '').trim(),
    eligible_programme_id: payload?.programmeId || null,
    status: dbStatus,
    published_at: dbStatus === 'published' ? new Date().toISOString() : undefined,
    closed_at: dbStatus === 'closed' ? new Date().toISOString() : undefined,
  };

  let surveyId = payload?.id || null;
  if (surveyId) {
    const updRes = await restUpdate('surveys', `id=eq.${encodeURIComponent(surveyId)}`, surveyRecord);
    if (!updRes.ok) return updRes;
    const delRes = await restDelete('survey_questions', `survey_id=eq.${encodeURIComponent(surveyId)}`);
    if (!delRes.ok) return delRes;
  } else {
    const insRes = await restInsert('surveys', surveyRecord);
    if (!insRes.ok) return insRes;
    const created = Array.isArray(insRes.data) ? insRes.data[0] : insRes.data;
    surveyId = created?.id;
  }

  if (!surveyId) {
    return { ok: false, code: 'SAVE_FAILED', message: 'Unable to resolve saved survey record.' };
  }

  const qInserts = payload.questions.map((q, idx) => ({
    survey_id: surveyId,
    question_type: q.type,
    prompt: String(q.prompt).trim(),
    options: Array.isArray(q.options) ? q.options : [],
    sort_order: idx + 1,
    is_required: q.isRequired !== false,
  }));

  const qRes = await restInsert('survey_questions', qInserts);
  if (!qRes.ok) return qRes;

  return { ok: true, surveyId, status: dbStatus };
}

export async function updateSurveyStatus({ surveyId, status }) {
  if (!surveyId || !status) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Survey ID and target status are required.' };
  }
  const dbStatus = String(status).toLowerCase();
  if (!isSupabaseConfigured()) {
    return pendingBackendResult(`Survey status (${dbStatus})`);
  }
  const patch = {
    status: dbStatus,
    published_at: dbStatus === 'published' ? new Date().toISOString() : undefined,
    closed_at: dbStatus === 'closed' ? new Date().toISOString() : undefined,
  };
  const res = await restUpdate('surveys', `id=eq.${encodeURIComponent(surveyId)}`, patch);
  if (!res.ok) return res;
  return { ok: true, survey: Array.isArray(res.data) ? res.data[0] : res.data };
}

export async function fetchAdminAnalytics({ period = 'monthly', startDate = null, endDate = null } = {}) {
  if (!isSupabaseConfigured()) {
    if (isProductionEnvironment()) {
      return {
        ok: false,
        code: 'SUPABASE_NOT_CONFIGURED',
        message: 'Analytics requires a live Supabase configuration in production.',
      };
    }
    const metrics = ADMIN_EXTENDED_FIXTURE.analytics.byPeriod[period] || ADMIN_EXTENDED_FIXTURE.analytics.byPeriod.monthly;
    return {
      ok: true,
      source: 'development-fixture',
      summary: {
        totalMembers: metrics.members,
        activeMembers: metrics.active,
        newRegistrations: period === 'daily' ? 14 : period === 'weekly' ? 86 : 312,
        totalLoyaltyCards: metrics.members,
        stampsAwarded: metrics.stamps,
        rewardsUnlocked: Math.round(metrics.redeemed * 1.25),
        rewardsRedeemed: metrics.redeemed,
        qualifyingPurchases: Math.round(metrics.stamps * 0.8),
        qualifyingRevenueInr: metrics.revenueInr,
        avgPurchaseFrequency: metrics.avgFreq,
        dailyRegistrations: [
          { label: '22 Nov', count: 12 },
          { label: '23 Nov', count: 18 },
          { label: '24 Nov', count: 15 },
          { label: '25 Nov', count: 21 },
          { label: '26 Nov', count: 14 },
        ],
        monthlyGrowth: [
          { label: 'Jul', registrations: 380, total: 10120 },
          { label: 'Aug', registrations: 440, total: 10560 },
          { label: 'Sep', registrations: 490, total: 11050 },
          { label: 'Oct', registrations: 560, total: 11610 },
          { label: 'Nov', registrations: 610, total: 12220 },
          { label: 'Dec', registrations: 620, total: 12840 },
        ],
        stampBars: ADMIN_EXTENDED_FIXTURE.analytics.stampWeeklyBars,
        mostActiveCustomers: ADMIN_EXTENDED_FIXTURE.analytics.mostActiveCustomers,
        programmePerformance: ADMIN_EXTENDED_FIXTURE.analytics.programmePerformance,
        staffActivity: ADMIN_EXTENDED_FIXTURE.staffMembers,
      },
    };
  }

  const res = await invokeEdgeFunction('admin-analytics', {
    action: 'summary',
    period,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  if (!res.ok) return res;
  const s = res.data?.summary || {};
  return {
    ok: true,
    source: 'supabase-live',
    summary: {
      totalMembers: Number(s.totalMembers ?? 0),
      activeMembers: Number(s.activeMembers ?? 0),
      newRegistrations: Number(s.newRegistrations ?? 0),
      totalLoyaltyCards: Number(s.totalLoyaltyCards ?? 0),
      stampsAwarded: Number(s.stampsAwarded ?? 0),
      rewardsUnlocked: Number(s.rewardsUnlocked ?? 0),
      rewardsRedeemed: Number(s.rewardsRedeemed ?? 0),
      qualifyingPurchases: Number(s.qualifyingPurchases ?? 0),
      qualifyingRevenueInr: Number(s.qualifyingRevenueInr ?? 0),
      avgPurchaseFrequency: Number(s.avgPurchaseFrequency ?? 0),
      dailyRegistrations: Array.isArray(s.dailyRegistrations) ? s.dailyRegistrations : [],
      monthlyGrowth: Array.isArray(s.monthlyGrowth) ? s.monthlyGrowth : [],
      stampBars: Array.isArray(s.stampBars) ? s.stampBars : [],
      mostActiveCustomers: Array.isArray(s.mostActiveCustomers) ? s.mostActiveCustomers : [],
      programmePerformance: Array.isArray(s.programmePerformance) ? s.programmePerformance : [],
      staffActivity: Array.isArray(s.staffActivity) ? s.staffActivity : [],
    },
  };
}

export async function fetchAdminReportPreview({ category = 'customer-activity', dateFrom = '', dateTo = '', page = 1, pageSize = 8 } = {}) {
  if (!isSupabaseConfigured()) {
    if (isProductionEnvironment()) {
      return {
        ok: false,
        code: 'SUPABASE_NOT_CONFIGURED',
        message: 'Reports require a live Supabase configuration in production.',
      };
    }
    return { ok: true, source: 'development-fixture', useLocalFallback: true };
  }

  return invokeEdgeFunction('admin-analytics', {
    action: 'report_preview',
    category,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize,
  });
}

export async function exportAdminReportCsv({ category = 'customer-activity', dateFrom = '', dateTo = '' } = {}) {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message: 'Live full-dataset CSV export requires Supabase `admin-analytics` (`reports.export` permission). Preview download used instead.',
    };
  }

  const res = await invokeEdgeFunction('admin-analytics', {
    action: 'export_csv',
    category,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  if (!res.ok) return res;
  return {
    ok: true,
    filename: res.data?.filename || `bonfree-hub-${category}-report.csv`,
    rowCount: Number(res.data?.rowCount || 0),
    csv: res.data?.csv || '',
  };
}

export async function fetchAdminSettings() {
  if (!isSupabaseConfigured()) {
    if (isProductionEnvironment()) {
      return {
        ok: false,
        code: 'SUPABASE_NOT_CONFIGURED',
        message: 'Settings require a live Supabase configuration in production.',
      };
    }
    return {
      ok: true,
      source: 'development-fixture',
      settings: {
        brandName: ADMIN_EXTENDED_FIXTURE.settings.brandName,
        tagline: ADMIN_EXTENDED_FIXTURE.settings.tagline,
        supportEmail: ADMIN_EXTENDED_FIXTURE.settings.supportEmail,
        supportPhone: ADMIN_EXTENDED_FIXTURE.settings.supportPhone,
        address: ADMIN_EXTENDED_FIXTURE.settings.address,
        stampValidity: ADMIN_EXTENDED_FIXTURE.settings.defaultStampValidityMonths,
        rewardValidity: ADMIN_EXTENDED_FIXTURE.settings.defaultRewardValidityMonths,
        adminName: ADMIN_EXTENDED_FIXTURE.settings.adminName,
        adminEmail: ADMIN_EXTENDED_FIXTURE.settings.adminEmail,
        dailySummaryView: true,
        securityStatus: {
          rlsAndAuditActive: true,
          twoFactorConfigured: false,
          loginAlertsConfigured: false,
        },
      },
    };
  }

  const userRes = await supabaseAuth.getUser();
  const uid = userRes.data?.id || '';
  const [brandRes, storeRes, profRes, staffRes] = await Promise.all([
    restSelect('brand_settings', 'select=*&id=eq.true'),
    restSelect('stores', 'select=id,name,phone,address&is_active=eq.true&order=created_at.asc&limit=1'),
    uid ? restSelect('profiles', `select=id,full_name,email&id=eq.${uid}`) : Promise.resolve({ ok: true, data: [] }),
    uid ? restSelect('staff', `select=id,preferences&user_id=eq.${uid}`) : Promise.resolve({ ok: true, data: [] }),
  ]);

  if (!brandRes.ok) return brandRes;

  const brand = brandRes.data?.[0] || {};
  const flagship = storeRes.data?.[0] || {};
  const profile = profRes.data?.[0] || {};
  const staff = staffRes.data?.[0] || {};

  return {
    ok: true,
    source: 'supabase-live',
    settings: {
      storeId: flagship.id || null,
      brandName: brand.brand_name || 'BONFREE-HUB',
      tagline: brand.tagline || '',
      supportEmail: brand.support_email || '',
      supportPhone: brand.support_phone || flagship.phone || '',
      address: brand.address || flagship.address || '',
      stampValidity: Number(brand.default_stamp_validity_months || 12),
      rewardValidity: Number(brand.default_reward_validity_months || 6),
      adminName: profile.full_name || 'Admin',
      adminEmail: profile.email || userRes.data?.email || '',
      dailySummaryView: staff.preferences?.dailySummaryView !== false,
      securityStatus: {
        rlsAndAuditActive: true,
        twoFactorConfigured: Boolean(brand.two_factor_required),
        loginAlertsConfigured: Boolean(brand.login_alerts_enabled),
      },
    },
  };
}

export async function saveBrandSettings(payload) {
  if (!payload?.brandName || !payload?.supportEmail) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Brand name and support email are required.' };
  }
  if (!isSupabaseConfigured()) {
    return pendingBackendResult('Brand & security settings');
  }

  const brandPatch = {
    brand_name: String(payload.brandName).trim(),
    tagline: String(payload.tagline || '').trim(),
    support_email: String(payload.supportEmail).trim(),
    support_phone: String(payload.supportPhone || '').trim(),
    address: String(payload.address || '').trim(),
    default_stamp_validity_months: Number(payload.stampValidity || 12),
    default_reward_validity_months: Number(payload.rewardValidity || 6),
  };

  const brandRes = await restUpdate('brand_settings', 'id=eq.true', brandPatch);
  if (!brandRes.ok) return brandRes;

  if (payload.storeId) {
    await restUpdate('stores', `id=eq.${encodeURIComponent(payload.storeId)}`, {
      phone: brandPatch.support_phone,
      address: brandPatch.address,
    }).catch(() => {});
  }

  const userRes = await supabaseAuth.getUser();
  if (userRes.ok && userRes.data?.id) {
    const uid = userRes.data.id;
    if (payload.adminName && String(payload.adminName).trim().length >= 2) {
      await restUpdate('profiles', `id=eq.${uid}`, {
        full_name: String(payload.adminName).trim(),
      }).catch(() => {});
    }
    await restUpdate('staff', `user_id=eq.${uid}`, {
      preferences: {
        dailySummaryView: payload.dailySummaryView === true || payload.dailySummaryView === 'on',
      },
    }).catch(() => {});
  }

  return { ok: true, message: 'Brand settings, store contact details, and loyalty defaults saved.' };
}

export async function updateAdminAccountPassword({ currentPassword, newPassword }) {
  if (!currentPassword || !newPassword) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Current and new passwords are required.' };
  }
  if (!isSupabaseConfigured()) {
    return pendingBackendResult('Admin password update');
  }
  return supabaseAuth.updateUser({ password: newPassword });
}

/**
 * Fetches store purchase records from RLS-protected Supabase `purchases` table.
 */
export async function fetchAdminPurchases() {
  if (!isSupabaseConfigured()) {
    if (isProductionEnvironment()) {
      return {
        ok: false,
        code: 'SUPABASE_NOT_CONFIGURED',
        message: 'Purchase records require live Supabase configuration in production.',
      };
    }
    return {
      ok: true,
      source: 'development-fixture',
      rows: ADMIN_EXTENDED_FIXTURE.purchaseRecords,
    };
  }

  const res = await restSelect(
    'purchases',
    'select=id,receipt_no,items_summary,amount_inr,is_qualifying,stamps_calculated,purchased_at,stores(name),customers(membership_id,profiles(full_name)),staff(staff_code)&order=purchased_at.desc&limit=200',
  );
  if (!res.ok) return res;

  const rows = (res.data || []).map((p) => {
    const dt = new Date(p.purchased_at);
    const validDt = !Number.isNaN(dt.getTime());
    return {
      receiptNo: p.receipt_no,
      isoDate: validDt ? dt.toISOString().slice(0, 10) : '',
      dateTime: validDt
        ? dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : p.purchased_at,
      memberId: p.customers?.membership_id || '—',
      memberName: p.customers?.profiles?.full_name || 'Member',
      store: p.stores?.name || 'Flagship Store',
      itemsSummary: p.items_summary || 'In-store apparel purchase',
      amountInr: Number(p.amount_inr || 0),
      qualifying: Boolean(p.is_qualifying),
      stampsAwarded: Number(p.stamps_calculated || 0),
      recordedBy: p.staff?.staff_code || 'Staff',
    };
  });

  return { ok: true, source: 'supabase-live', rows };
}
