/**
 * BONFREE-HUB Supabase Public Client (CSP-Safe Vanilla JS)
 *
 * Security Rules:
 * - Uses ONLY `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`.
 * - NEVER accepts or embeds `SUPABASE_SERVICE_ROLE_KEY`.
 * - Stores transient Auth JWT in memory + ephemeral `sessionStorage` (never `localStorage`).
 */
import { getPublicConfig, isSupabaseConfigured } from './config.js';

const SESSION_KEY = 'bonfree_hub_auth_session';
let memorySession = null;

function readSession() {
  if (memorySession) return memorySession;
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        memorySession = JSON.parse(raw);
        return memorySession;
      }
    }
  } catch {
    // Ignore storage read errors in restricted environments.
  }
  return null;
}

function writeSession(session) {
  if (session && session.expires_in && !session.expires_at) {
    session = {
      ...session,
      expires_at: Math.floor(Date.now() / 1000) + Number(session.expires_in),
    };
  }
  memorySession = session;
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (session) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  } catch {
    // Ignore storage write errors.
  }
}

export function normalizeSupabaseError(status, payload = {}) {
  const rawCode = String(payload.error_code || payload.code || '').toLowerCase();
  const rawMsg = String(payload.msg || payload.message || payload.error_description || '').toLowerCase();

  if (rawCode === 'user_already_exists' || rawMsg.includes('already registered') || rawMsg.includes('already exists')) {
    return {
      code: 'DUPLICATE_ACCOUNT',
      message: 'An account with this email address already exists. Sign in or reset your password instead.',
    };
  }
  if (rawCode === 'invalid_credentials' || rawMsg.includes('invalid login credentials')) {
    return {
      code: 'INVALID_CREDENTIALS',
      message: 'Incorrect email address or password.',
    };
  }
  if (rawCode === 'email_not_confirmed' || rawMsg.includes('email not confirmed')) {
    return {
      code: 'EMAIL_NOT_CONFIRMED',
      message: 'Please verify your email address using the link sent to your inbox before signing in.',
    };
  }
  if (status === 401 || rawMsg.includes('jwt expired') || rawCode === 'session_not_found') {
    return {
      code: 'SESSION_EXPIRED',
      message: 'Your session has expired. Please sign in again.',
    };
  }
  if (rawCode === 'cooldown_active') {
    return {
      code: 'COOLDOWN_ACTIVE',
      message: payload.message || 'Cooldown period active for this member and programme. Try again later.',
    };
  }
  if (status === 429 || rawCode === 'over_request_rate_limit') {
    return {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please wait a moment before trying again.',
    };
  }

  return {
    code: payload.error_code || payload.code || 'SUPABASE_ERROR',
    message: payload.msg || payload.message || payload.error_description || 'Request could not be completed.',
  };
}

function buildHeaders(extra = {}, useSessionToken = true) {
  const cfg = getPublicConfig();
  const session = useSessionToken ? readSession() : null;
  const token = session?.access_token || cfg.supabaseAnonKey;

  return {
    apikey: cfg.supabaseAnonKey,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function requestJson(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const normalized = normalizeSupabaseError(response.status, payload);
      return {
        ok: false,
        status: response.status,
        code: normalized.code,
        message: normalized.message,
        data: null,
      };
    }

    return { ok: true, status: response.status, data: payload };
  } catch {
    return {
      ok: false,
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Unable to reach BONFREE-HUB authentication servers. Check your connection and retry.',
      data: null,
    };
  }
}

export const supabaseAuth = Object.freeze({
  getSession() {
    return readSession();
  },
  setSession(session) {
    writeSession(session);
  },
  clearSession() {
    writeSession(null);
  },

  /**
   * Parses Supabase recovery/verification hash params (`#access_token=...&refresh_token=...&type=recovery`)
   * and persists the transient session without keeping tokens in the URL bar.
   */
  consumeAuthRedirectFromUrl() {
    if (typeof window === 'undefined' || !window.location.hash) {
      return { found: false, type: null };
    }
    const rawHash = window.location.hash.replace(/^#/, '');
    if (!rawHash.includes('access_token=')) {
      return { found: false, type: null };
    }
    const params = new URLSearchParams(rawHash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const expiresIn = Number(params.get('expires_in')) || 3600;
    const type = params.get('type') || 'recovery';

    if (accessToken) {
      writeSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
        expires_in: expiresIn,
        token_type: params.get('token_type') || 'bearer',
      });
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return { found: true, type };
    }
    return { found: false, type: null };
  },

  /**
   * Ensures a valid non-expired session exists; refreshes automatically if refresh_token is available.
   */
  async getValidSession() {
    const session = readSession();
    if (!session?.access_token) {
      return { ok: false, code: 'NO_SESSION', message: 'Please sign in to continue.' };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const isExpiring = session.expires_at && Number(session.expires_at) <= nowSec + 30;
    if (!isExpiring) {
      return { ok: true, session };
    }

    if (!session.refresh_token || !isSupabaseConfigured()) {
      writeSession(null);
      return {
        ok: false,
        code: 'SESSION_EXPIRED',
        message: 'Your session has expired. Please sign in again.',
      };
    }

    const { supabaseUrl } = getPublicConfig();
    const res = await requestJson(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: buildHeaders({}, false),
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });

    if (!res.ok || !res.data?.access_token) {
      writeSession(null);
      return {
        ok: false,
        code: 'SESSION_EXPIRED',
        message: 'Your session has expired. Please sign in again.',
      };
    }

    writeSession(res.data);
    return { ok: true, session: readSession() };
  },

  async getUser() {
    if (!isSupabaseConfigured()) {
      return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured.' };
    }
    const check = await this.getValidSession();
    if (!check.ok) return check;

    const { supabaseUrl } = getPublicConfig();
    return requestJson(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: buildHeaders(),
    });
  },

  async signInWithPassword({ email, password }) {
    if (!isSupabaseConfigured()) {
      return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured.' };
    }
    const { supabaseUrl } = getPublicConfig();
    const res = await requestJson(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: buildHeaders({}, false),
      body: JSON.stringify({ email, password }),
    });
    if (res.ok && res.data?.access_token) {
      writeSession(res.data);
    }
    return res;
  },

  async signUp({ email, password, metadata = {}, emailRedirectTo }) {
    if (!isSupabaseConfigured()) {
      return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured.' };
    }
    const { supabaseUrl } = getPublicConfig();
    const res = await requestJson(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: buildHeaders({}, false),
      body: JSON.stringify({
        email,
        password,
        data: metadata,
        options: emailRedirectTo ? { emailRedirectTo } : undefined,
      }),
    });

    // Supabase returns obfuscated user with empty identities[] on duplicate email when enumeration protection is on
    if (res.ok && res.data?.user && Array.isArray(res.data.user.identities) && res.data.user.identities.length === 0) {
      return {
        ok: false,
        status: 409,
        code: 'DUPLICATE_ACCOUNT',
        message: 'An account with this email address already exists. Sign in or reset your password instead.',
        data: null,
      };
    }

    if (res.ok && res.data?.access_token) {
      writeSession(res.data);
    }
    return res;
  },

  async resetPasswordForEmail({ email, redirectTo }) {
    if (!isSupabaseConfigured()) {
      return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured.' };
    }
    const { supabaseUrl } = getPublicConfig();
    return requestJson(`${supabaseUrl}/auth/v1/recover`, {
      method: 'POST',
      headers: buildHeaders({}, false),
      body: JSON.stringify({ email, redirect_to: redirectTo }),
    });
  },

  async updateUser({ password }) {
    if (!isSupabaseConfigured()) {
      return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured.' };
    }
    const check = await this.getValidSession();
    if (!check.ok) return check;

    const { supabaseUrl } = getPublicConfig();
    return requestJson(`${supabaseUrl}/auth/v1/user`, {
      method: 'PUT',
      headers: buildHeaders(),
      body: JSON.stringify({ password }),
    });
  },

  async signOut() {
    const { supabaseUrl } = getPublicConfig();
    const session = readSession();
    if (isSupabaseConfigured() && session?.access_token) {
      await fetch(`${supabaseUrl}/auth/v1/logout`, {
        method: 'POST',
        headers: buildHeaders(),
      }).catch(() => {});
    }
    writeSession(null);
    return { ok: true };
  },
});

export async function invokeEdgeFunction(functionName, body = {}) {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured.' };
  }
  const { supabaseUrl } = getPublicConfig();
  return requestJson(`${supabaseUrl}/functions/v1/${encodeURIComponent(functionName)}`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });
}

export async function restSelect(table, queryString = '') {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured.' };
  }
  const { supabaseUrl } = getPublicConfig();
  const suffix = queryString ? `?${queryString}` : '';
  return requestJson(`${supabaseUrl}/rest/v1/${encodeURIComponent(table)}${suffix}`, {
    method: 'GET',
    headers: buildHeaders(),
  });
}

export async function restUpdate(table, matchQuery, body = {}) {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured.' };
  }
  const check = await supabaseAuth.getValidSession();
  if (!check.ok) return check;

  const { supabaseUrl } = getPublicConfig();
  return requestJson(`${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?${matchQuery}`, {
    method: 'PATCH',
    headers: buildHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(body),
  });
}

export async function restInsert(table, body = {}) {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured.' };
  }
  const { supabaseUrl } = getPublicConfig();
  return requestJson(`${supabaseUrl}/rest/v1/${encodeURIComponent(table)}`, {
    method: 'POST',
    headers: buildHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(body),
  });
}

export async function restRpc(fnName, params = {}) {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured.' };
  }
  const { supabaseUrl } = getPublicConfig();
  return requestJson(`${supabaseUrl}/rest/v1/rpc/${encodeURIComponent(fnName)}`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(params),
  });
}

export async function restDelete(table, matchQuery) {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured.' };
  }
  const check = await supabaseAuth.getValidSession();
  if (!check.ok) return check;

  const { supabaseUrl } = getPublicConfig();
  return requestJson(`${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?${matchQuery}`, {
    method: 'DELETE',
    headers: buildHeaders({ Prefer: 'return=representation' }),
  });
}

export async function uploadStorageObject(bucket, objectPath, file) {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured.' };
  }
  const check = await supabaseAuth.getValidSession();
  if (!check.ok) return check;

  const cfg = getPublicConfig();
  const session = readSession();
  const token = session?.access_token || cfg.supabaseAnonKey;
  const cleanPath = String(objectPath || '').replace(/^\/+/, '');
  const uploadUrl = `${cfg.supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${cleanPath}`;

  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: file,
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const normalized = normalizeSupabaseError(response.status, payload);
      return { ok: false, status: response.status, code: normalized.code, message: normalized.message, data: null };
    }
    const publicUrl = `${cfg.supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${cleanPath}`;
    return { ok: true, publicUrl, data: payload };
  } catch {
    return {
      ok: false,
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Unable to upload image to Supabase Storage.',
      data: null,
    };
  }
}
