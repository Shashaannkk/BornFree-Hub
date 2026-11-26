import test from 'node:test';
import assert from 'node:assert/strict';

function installMockBrowser({ url = 'https://bonfree.test/login.html', configured = true } = {}) {
  const storage = new Map();
  const parsedUrl = new URL(url);

  globalThis.sessionStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear(),
  };

  globalThis.window = {
    location: {
      origin: parsedUrl.origin,
      pathname: parsedUrl.pathname,
      search: parsedUrl.search,
      hash: parsedUrl.hash,
    },
    history: {
      replaceState: (_state, _title, nextPath) => {
        const next = new URL(nextPath, parsedUrl.origin);
        globalThis.window.location.pathname = next.pathname;
        globalThis.window.location.search = next.search;
        globalThis.window.location.hash = next.hash;
      },
    },
    __BONFREE_CONFIG__: configured
      ? {
          supabaseUrl: 'https://mock-project.supabase.co',
          supabaseAnonKey: 'mock-public-anon-key',
          environment: 'test',
        }
      : {},
  };

  globalThis.document = {
    querySelector: () => null,
  };
}

function makeJsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('Phase 4 Auth Integration: registration, verification, duplicate rejection, login, reset, expiry & role guards', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.sessionStorage;
  });

  installMockBrowser();

  const { supabaseAuth } = await import('../src/scripts/core/supabaseClient.js');
  const {
    registerCustomer,
    signInCustomer,
    signOutCustomer,
    requestPasswordReset,
    updateCustomerPassword,
    requireCustomerSession,
    requireStaffSession,
  } = await import('../src/scripts/services/authService.js');
  const { fetchCustomerPortalData, updateCustomerProfile } = await import(
    '../src/scripts/services/loyaltyService.js'
  );

  // 1. Registration with email verification required (no immediate access_token)
  globalThis.fetch = async (url) => {
    assert.match(url, /\/auth\/v1\/signup$/);
    return makeJsonResponse(200, {
      user: {
        id: 'cust-user-1',
        email: 'newmember@bonfree.test',
        identities: [{ id: 'ident-1' }],
      },
    });
  };

  const regOk = await registerCustomer({
    fullName: 'Aanya Sharma',
    mobile: '+91 98765 43210',
    email: 'newmember@bonfree.test',
    password: 'StrongPassword1',
    acceptedTerms: true,
  });
  assert.equal(regOk.ok, true);
  assert.equal(regOk.requiresEmailVerification, true);

  // 2. Duplicate registration (obfuscated empty identities[] AND 422 user_already_exists)
  globalThis.fetch = async () =>
    makeJsonResponse(200, {
      user: { id: 'existing-id', email: 'dup@bonfree.test', identities: [] },
    });
  const dup1 = await registerCustomer({
    fullName: 'Dup User',
    mobile: '+91 98765 43210',
    email: 'dup@bonfree.test',
    password: 'StrongPassword1',
    acceptedTerms: true,
  });
  assert.equal(dup1.ok, false);
  assert.equal(dup1.code, 'DUPLICATE_ACCOUNT');

  globalThis.fetch = async () =>
    makeJsonResponse(422, { error_code: 'user_already_exists', msg: 'User already registered' });
  const dup2 = await registerCustomer({
    fullName: 'Dup User',
    mobile: '+91 98765 43210',
    email: 'dup@bonfree.test',
    password: 'StrongPassword1',
    acceptedTerms: true,
  });
  assert.equal(dup2.ok, false);
  assert.equal(dup2.code, 'DUPLICATE_ACCOUNT');

  // 3. Unauthenticated protected route check
  supabaseAuth.clearSession();
  const unauthGuard = await requireCustomerSession();
  assert.equal(unauthGuard.ok, false);
  assert.equal(unauthGuard.redirectUrl, 'login.html?reason=auth_required');

  // 4. Customer Login + Session Persistence + Customer Role Guard
  globalThis.fetch = async (url) => {
    if (url.includes('/auth/v1/token?grant_type=password')) {
      return makeJsonResponse(200, {
        access_token: 'jwt-customer-123',
        refresh_token: 'ref-customer-123',
        expires_in: 3600,
        user: { id: 'cust-user-1', email: 'aanya@bonfree.test' },
      });
    }
    if (url.includes('/rest/v1/customers')) {
      return makeJsonResponse(200, [{ id: 'cid-1', membership_id: 'BF-001001', status: 'active' }]);
    }
    return makeJsonResponse(404, {});
  };

  const loginRes = await signInCustomer({ email: 'aanya@bonfree.test', password: 'StrongPassword1' });
  assert.equal(loginRes.ok, true);
  assert.equal(supabaseAuth.getSession().access_token, 'jwt-customer-123');

  // 5. Customer blocked from Admin Console route
  globalThis.fetch = async (url) => {
    if (url.includes('/auth/v1/user')) {
      return makeJsonResponse(200, { id: 'cust-user-1', email: 'aanya@bonfree.test' });
    }
    if (url.includes('/rest/v1/staff')) {
      return makeJsonResponse(200, []); // No active staff row for customer
    }
    return makeJsonResponse(404, {});
  };

  const adminGuard = await requireStaffSession();
  assert.equal(adminGuard.ok, false);
  assert.equal(adminGuard.code, 'UNAUTHORIZED_ADMIN_ACCESS');
  assert.equal(adminGuard.redirectUrl, '../customer-dashboard.html?reason=unauthorized_admin');

  // 6. Live Customer Portal fetch + Profile Update (only safe fields patched)
  const capturedPatchBodies = [];
  globalThis.fetch = async (url, opts = {}) => {
    if (url.includes('/auth/v1/user')) {
      return makeJsonResponse(200, { id: 'cust-user-1', email: 'aanya@bonfree.test' });
    }
    if (url.includes('/rest/v1/profiles') && opts.method === 'PATCH') {
      capturedPatchBodies.push({ table: 'profiles', body: JSON.parse(opts.body) });
      return makeJsonResponse(200, [{}]);
    }
    if (url.includes('/rest/v1/customers') && opts.method === 'PATCH') {
      capturedPatchBodies.push({ table: 'customers', body: JSON.parse(opts.body) });
      return makeJsonResponse(200, [{}]);
    }
    if (url.includes('/rest/v1/profiles')) {
      return makeJsonResponse(200, [{ id: 'cust-user-1', full_name: 'Aanya Sharma', email: 'aanya@bonfree.test', phone: '+91 98765 43210' }]);
    }
    if (url.includes('/rest/v1/customers')) {
      return makeJsonResponse(200, [{ id: 'cid-1', membership_id: 'BF-001001', status: 'active', birth_month: 8, preferences: {}, joined_at: '2025-01-01T00:00:00Z' }]);
    }
    if (url.includes('/rest/v1/loyalty_cards')) {
      return makeJsonResponse(200, [{ current_stamps: 6, loyalty_programmes: { name: 'Classic Stamps', stamp_goal: 10, qualifying_amount_inr: 1000, stamp_validity_months: 12 } }]);
    }
    if (url.includes('/rest/v1/rewards')) return makeJsonResponse(200, []);
    if (url.includes('/rest/v1/customer_rewards')) return makeJsonResponse(200, []);
    if (url.includes('/rest/v1/stamp_transactions')) return makeJsonResponse(200, []);
    if (url.includes('/rest/v1/purchases')) return makeJsonResponse(200, []);
    return makeJsonResponse(200, []);
  };

  const portalData = await fetchCustomerPortalData();
  assert.equal(portalData.ok, true);
  assert.equal(portalData.source, 'supabase-live');
  assert.equal(portalData.data.member.membershipCode, 'BF-001001');
  assert.equal(portalData.data.member.collectedStamps, 6);

  const profUpdate = await updateCustomerProfile({
    fullName: 'Aanya S.',
    mobile: '+91 98765 00000',
    birthMonth: '9',
  });
  assert.equal(profUpdate.ok, true);
  assert.equal('membership_id' in capturedPatchBodies[1].body, false);
  assert.equal('status' in capturedPatchBodies[1].body, false);

  // 7. Expired Session Handling (refresh fails -> clears session & redirects)
  supabaseAuth.setSession({
    access_token: 'expired-jwt',
    refresh_token: 'bad-refresh',
    expires_at: Math.floor(Date.now() / 1000) - 10,
  });
  globalThis.fetch = async (url) => {
    assert.match(url, /grant_type=refresh_token/);
    return makeJsonResponse(401, { error_code: 'session_not_found', msg: 'Session expired' });
  };
  const expiredCheck = await requireCustomerSession();
  assert.equal(expiredCheck.ok, false);
  assert.equal(expiredCheck.code, 'SESSION_EXPIRED');
  assert.equal(expiredCheck.redirectUrl, 'login.html?reason=session_expired');
  assert.equal(supabaseAuth.getSession(), null);

  // 8. Forgot Password + Reset Password Recovery URL Hash
  globalThis.fetch = async (url) => {
    if (url.includes('/auth/v1/recover')) return makeJsonResponse(200, {});
    if (url.includes('/auth/v1/user')) return makeJsonResponse(200, { id: 'cust-user-1' });
    return makeJsonResponse(200, {});
  };
  const forgotRes = await requestPasswordReset({ email: 'aanya@bonfree.test' });
  assert.equal(forgotRes.ok, true);

  globalThis.window.location.hash = '#access_token=rec-jwt-999&refresh_token=rec-ref&expires_in=3600&type=recovery';
  const consumed = supabaseAuth.consumeAuthRedirectFromUrl();
  assert.equal(consumed.found, true);
  assert.equal(consumed.type, 'recovery');
  assert.equal(globalThis.window.location.hash, '');

  const resetRes = await updateCustomerPassword({ newPassword: 'NewStrongPassword2' });
  assert.equal(resetRes.ok, true);

  // 9. Logout clears session
  globalThis.fetch = async () => makeJsonResponse(204, {});
  await signOutCustomer();
  assert.equal(supabaseAuth.getSession(), null);
});
