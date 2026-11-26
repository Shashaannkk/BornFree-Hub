/**
 * BONFREE-HUB Customer Authentication & Route Protection Service (Phase 4)
 *
 * Security & Architecture Contract:
 * - Connects to Supabase Authentication when configured (`PUBLIC_SUPABASE_URL` & `PUBLIC_SUPABASE_ANON_KEY`).
 * - Never fakes or simulates successful authentication before Supabase is connected.
 * - Customer roles cannot be modified client-side; backend RLS + Edge Functions enforce authorization.
 */
import { getPublicConfig, isSupabaseConfigured } from '../core/config.js';
import { restRpc, restSelect, supabaseAuth } from '../core/supabaseClient.js';

export const ROLE_DEFAULT_PERMISSIONS = Object.freeze({
  administrator: [
    'customers.read',
    'customers.manage',
    'purchases.read',
    'stamps.read',
    'stamps.issue',
    'rewards.manage',
    'redemptions.verify',
    'programmes.manage',
    'campaigns.manage',
    'surveys.manage',
    'staff.manage',
    'analytics.view',
    'reports.export',
    'settings.manage',
  ],
  store_manager: [
    'customers.read',
    'customers.manage',
    'purchases.read',
    'stamps.read',
    'stamps.issue',
    'rewards.manage',
    'redemptions.verify',
    'campaigns.manage',
    'analytics.view',
    'reports.export',
  ],
  sales_staff: [
    'customers.read',
    'purchases.read',
    'stamps.read',
    'stamps.issue',
    'redemptions.verify',
  ],
  marketing_staff: [
    'campaigns.manage',
    'surveys.manage',
    'analytics.view',
  ],
});

let cachedStaffContext = null;

export function getCachedStaffContext() {
  return cachedStaffContext;
}

export function clearCachedStaffContext() {
  cachedStaffContext = null;
}

export function getAuthIntegrationStatus() {
  const config = getPublicConfig();
  return {
    configured: isSupabaseConfigured(),
    environment: config.environment,
  };
}

function unconfiguredResult(actionLabel) {
  return {
    ok: false,
    code: 'SUPABASE_NOT_CONFIGURED',
    message: `${actionLabel} cannot complete yet because Supabase Authentication is not connected.`,
  };
}

/**
 * Customer sign-in with session persistence and role verification.
 */
export async function signInCustomer({ email, password }) {
  if (!email || !password) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Email address and password are required.',
    };
  }

  if (!isSupabaseConfigured()) {
    return unconfiguredResult('Customer sign in');
  }

  const res = await supabaseAuth.signInWithPassword({
    email: String(email).trim().toLowerCase(),
    password,
  });

  if (!res.ok) return res;

  const userId = res.data?.user?.id;
  if (!userId) {
    return { ok: false, code: 'SESSION_INVALID', message: 'Session user identity missing.' };
  }

  // Verify customer record exists (or handle staff-only accounts cleanly)
  const custRes = await restSelect('customers', `select=id,membership_id,status&user_id=eq.${userId}`);
  if (custRes.ok && Array.isArray(custRes.data) && custRes.data.length === 0) {
    const staffRes = await restSelect('staff', `select=id,status&user_id=eq.${userId}`);
    if (staffRes.ok && Array.isArray(staffRes.data) && staffRes.data.length > 0) {
      await supabaseAuth.signOut();
      return {
        ok: false,
        code: 'STAFF_ACCOUNT_USE_ADMIN_PORTAL',
        message: 'This is a staff account. Please sign in through the Admin Portal (admin/login.html).',
      };
    }
  }

  return {
    ok: true,
    session: res.data,
    user: res.data.user,
  };
}

/**
 * Customer registration with email verification & duplicate prevention.
 */
export async function registerCustomer({ fullName, mobile, email, password, acceptedTerms }) {
  if (!fullName || !mobile || !email || !password || !acceptedTerms) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'All required fields and terms acceptance must be completed.',
    };
  }

  if (!isSupabaseConfigured()) {
    return unconfiguredResult('Member registration');
  }

  const emailRedirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/login.html?reason=verified` : undefined;

  const res = await supabaseAuth.signUp({
    email: String(email).trim().toLowerCase(),
    password,
    metadata: {
      full_name: String(fullName).trim(),
      phone: String(mobile).trim(),
    },
    emailRedirectTo,
  });

  if (!res.ok) return res;

  const requiresEmailVerification = !res.data?.access_token;
  return {
    ok: true,
    requiresEmailVerification,
    session: res.data?.access_token ? res.data : null,
    message: requiresEmailVerification
      ? 'Account created! Please verify your email using the confirmation link sent to your inbox.'
      : 'Welcome to BONFREE-HUB! Your loyalty membership is now active.',
  };
}

export async function requestPasswordReset({ email }) {
  if (!email) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Registered email address is required.',
    };
  }

  if (!isSupabaseConfigured()) {
    return unconfiguredResult('Password reset link request');
  }

  const redirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/reset-password.html` : undefined;
  const res = await supabaseAuth.resetPasswordForEmail({
    email: String(email).trim().toLowerCase(),
    redirectTo,
  });

  if (!res.ok) return res;

  return {
    ok: true,
    message: 'If an account matches that email address, a password reset link has been sent.',
  };
}

export async function updateCustomerPassword({ newPassword }) {
  if (!newPassword) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'A valid new password is required.',
    };
  }

  if (!isSupabaseConfigured()) {
    return unconfiguredResult('Password update');
  }

  const res = await supabaseAuth.updateUser({ password: newPassword });
  if (!res.ok) return res;

  return {
    ok: true,
    message: 'Your password has been updated. Please sign in with your new credentials.',
  };
}

export async function signOutCustomer() {
  return supabaseAuth.signOut();
}

/**
 * Route guard for protected customer pages (`customer-dashboard.html`).
 * In unconfigured development mode, allows read-only preview fixtures.
 * When Supabase is configured, verifies active session + customer record via RLS.
 */
export async function requireCustomerSession() {
  if (!isSupabaseConfigured()) {
    return { ok: true, mode: 'dev-preview', session: null, customer: null };
  }

  supabaseAuth.consumeAuthRedirectFromUrl();
  const sessionCheck = await supabaseAuth.getValidSession();
  if (!sessionCheck.ok) {
    return {
      ok: false,
      code: sessionCheck.code || 'AUTH_REQUIRED',
      message: sessionCheck.message || 'Please sign in to access your loyalty dashboard.',
      redirectUrl:
        sessionCheck.code === 'SESSION_EXPIRED'
          ? 'login.html?reason=session_expired'
          : 'login.html?reason=auth_required',
    };
  }

  const userRes = await supabaseAuth.getUser();
  if (!userRes.ok || !userRes.data?.id) {
    supabaseAuth.clearSession();
    return {
      ok: false,
      code: 'SESSION_EXPIRED',
      message: 'Your session has expired. Please sign in again.',
      redirectUrl: 'login.html?reason=session_expired',
    };
  }

  const custRes = await restSelect('customers', `select=id,membership_id,status&user_id=eq.${userRes.data.id}`);
  if (!custRes.ok || !Array.isArray(custRes.data) || custRes.data.length === 0) {
    return {
      ok: false,
      code: 'CUSTOMER_PROFILE_REQUIRED',
      message: 'Customer membership access is required for this portal.',
      redirectUrl: 'login.html?reason=auth_required',
    };
  }

  return {
    ok: true,
    mode: 'live',
    session: sessionCheck.session,
    user: userRes.data,
    customer: custRes.data[0],
  };
}

/**
 * Route guard for admin pages (`admin/*.html`).
 * Prevents customer accounts and deactivated staff accounts from accessing admin UI.
 * Resolves live effective permissions for sidebar/module restriction; authoritative enforcement remains in PostgreSQL RLS & Edge Functions.
 */
export async function requireStaffSession() {
  if (!isSupabaseConfigured()) {
    cachedStaffContext = null;
    return { ok: true, mode: 'dev-preview', session: null, staff: null, permissions: null };
  }

  const sessionCheck = await supabaseAuth.getValidSession();
  if (!sessionCheck.ok) {
    cachedStaffContext = null;
    return {
      ok: false,
      code: sessionCheck.code,
      message: sessionCheck.message,
      redirectUrl:
        sessionCheck.code === 'SESSION_EXPIRED'
          ? 'login.html?reason=session_expired'
          : 'login.html?reason=auth_required',
    };
  }

  const userRes = await supabaseAuth.getUser();
  if (!userRes.ok || !userRes.data?.id) {
    cachedStaffContext = null;
    supabaseAuth.clearSession();
    return {
      ok: false,
      code: 'SESSION_EXPIRED',
      message: 'Staff session expired.',
      redirectUrl: 'login.html?reason=session_expired',
    };
  }

  // Primary server-resolved active context + effective permission array
  const ctxRes = await restRpc('fn_my_staff_context');
  if (ctxRes.ok && ctxRes.data && ctxRes.data.ok) {
    const ctx = ctxRes.data;
    if (!ctx.is_staff) {
      cachedStaffContext = null;
      return {
        ok: false,
        code: 'UNAUTHORIZED_ADMIN_ACCESS',
        message: 'Unauthorized: Customer accounts cannot access the BONFREE-HUB Admin Console.',
        redirectUrl: '../customer-dashboard.html?reason=unauthorized_admin',
      };
    }

    if (!ctx.active) {
      cachedStaffContext = null;
      await supabaseAuth.signOut();
      return {
        ok: false,
        code: 'STAFF_ACCOUNT_DEACTIVATED',
        message: 'Your staff account has been deactivated. Contact an Administrator.',
        redirectUrl: 'login.html?reason=staff_deactivated',
      };
    }

    cachedStaffContext = ctx;
    return {
      ok: true,
      mode: 'live',
      session: sessionCheck.session,
      user: userRes.data,
      staff: ctx,
      permissions: Array.isArray(ctx.permissions) ? ctx.permissions : [],
    };
  }

  // Fallback query when RPC is unavailable (e.g., mocked unit tests)
  const staffRes = await restSelect(
    'staff',
    `select=id,staff_code,status,department,roles(code,name)&user_id=eq.${userRes.data.id}`,
  );

  if (!staffRes.ok || !Array.isArray(staffRes.data) || staffRes.data.length === 0) {
    cachedStaffContext = null;
    return {
      ok: false,
      code: 'UNAUTHORIZED_ADMIN_ACCESS',
      message: 'Unauthorized: Customer accounts cannot access the BONFREE-HUB Admin Console.',
      redirectUrl: '../customer-dashboard.html?reason=unauthorized_admin',
    };
  }

  const staffRow = staffRes.data[0];
  if (staffRow.status !== 'active') {
    cachedStaffContext = null;
    await supabaseAuth.signOut();
    return {
      ok: false,
      code: 'STAFF_ACCOUNT_DEACTIVATED',
      message: 'Your staff account has been deactivated. Contact an Administrator.',
      redirectUrl: 'login.html?reason=staff_deactivated',
    };
  }

  const roleCode = staffRow.roles?.code || 'sales_staff';
  const permissions = ROLE_DEFAULT_PERMISSIONS[roleCode] || [];
  const normalizedStaff = {
    id: staffRow.id,
    staff_code: staffRow.staff_code,
    status: staffRow.status,
    role_code: roleCode,
    role_name: staffRow.roles?.name || roleCode,
    department: staffRow.department || '',
    email: userRes.data.email || '',
    permissions,
  };
  cachedStaffContext = normalizedStaff;

  return {
    ok: true,
    mode: 'live',
    session: sessionCheck.session,
    user: userRes.data,
    staff: normalizedStaff,
    permissions,
  };
}
