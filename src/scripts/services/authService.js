/**
 * BONFREE-HUB Customer Authentication Integration Service (Phase 1B Interface)
 *
 * Security & Architecture Contract:
 * - Prepared for Phase 2 Supabase Auth integration (supabaseClient.js).
 * - Never fakes or simulates successful authentication before Supabase is connected.
 * - Never stores passwords or tokens in localStorage.
 */
import { getPublicConfig, isSupabaseConfigured } from '../core/config.js';

/**
 * Returns whether live Supabase Auth is configured in public runtime config.
 */
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
    message: `${actionLabel} cannot complete yet because Supabase Authentication is not connected. Integration activates in Phase 2.`,
  };
}

/**
 * Customer sign-in interface (`POST /auth/v1/token?grant_type=password` in Phase 2).
 * @param {{ email: string, password: string }} credentials
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

  return {
    ok: false,
    code: 'AUTH_CLIENT_PENDING',
    message: 'Supabase Auth client module will be connected in Phase 2.',
  };
}

/**
 * Customer registration interface (`supabase.auth.signUp` + profile trigger in Phase 2).
 * @param {{ fullName: string, mobile: string, email: string, password: string, acceptedTerms: boolean }} payload
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

  return {
    ok: false,
    code: 'AUTH_CLIENT_PENDING',
    message: 'Supabase Auth client module will be connected in Phase 2.',
  };
}

/**
 * Password recovery email request interface (`supabase.auth.resetPasswordForEmail` in Phase 2).
 * @param {{ email: string, redirectTo?: string }} payload
 */
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

  return {
    ok: false,
    code: 'AUTH_CLIENT_PENDING',
    message: 'Supabase Auth client module will be connected in Phase 2.',
  };
}

/**
 * Recovery password update interface (`supabase.auth.updateUser` in Phase 2).
 * @param {{ newPassword: string }} payload
 */
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

  return {
    ok: false,
    code: 'AUTH_CLIENT_PENDING',
    message: 'Supabase Auth client module will be connected in Phase 2.',
  };
}
