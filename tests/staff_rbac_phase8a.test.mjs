import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

test('Phase 8A SQL migration & manage-staff Edge Function enforce full RBAC, deactivation blocking & audit logging', () => {
  const mig9 = fs.readFileSync(path.join(ROOT, 'supabase/migrations/0009_staff_rbac_and_audit.sql'), 'utf8');
  const seed = fs.readFileSync(path.join(ROOT, 'supabase/seed.sql'), 'utf8');
  const edgeFn = fs.readFileSync(path.join(ROOT, 'supabase/functions/manage-staff/index.ts'), 'utf8');

  const requiredPerms = [
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
  ];
  for (const perm of requiredPerms) {
    assert.match(mig9, new RegExp(`'${perm.replace('.', '\\.')}'`), `Missing permission in 0009: ${perm}`);
    assert.match(seed, new RegExp(`'${perm.replace('.', '\\.')}'`), `Missing permission in seed: ${perm}`);
  }

  assert.match(mig9, /CREATE POLICY brand_settings_admin_update[\s\S]*has_permission\('settings\.manage'\)/);
  assert.match(mig9, /CREATE POLICY customers_staff_manage[\s\S]*has_permission\('customers\.manage'\)/);
  assert.match(mig9, /fn_my_staff_context/);
  assert.match(mig9, /IF v_staff\.status <> 'active'/);
  assert.match(mig9, /trg_audit_brand_settings_update/);

  assert.match(edgeFn, /requireStaffPermission\(req, 'staff\.manage'\)/);
  assert.match(edgeFn, /PRIVILEGE_ESCALATION_BLOCKED/);
  assert.match(edgeFn, /CANNOT_DEACTIVATE_SELF/);
  assert.match(edgeFn, /ban_duration/);
  assert.match(edgeFn, /staff\.activated/);
  assert.match(edgeFn, /staff\.deactivated/);
  assert.match(edgeFn, /staff\.permissions_updated/);
});

test('Phase 8A Sidebar navigation restriction & page RBAC across all 4 roles', async () => {
  const { ROLE_DEFAULT_PERMISSIONS } = await import('../src/scripts/services/authService.js');
  const { getVisibleAdminNavGroups } = await import('../src/scripts/components/adminShell.js');

  const visibleIds = (roleCode, extraPerms = []) => {
    const perms = [...new Set([...ROLE_DEFAULT_PERMISSIONS[roleCode], ...extraPerms])];
    return getVisibleAdminNavGroups({ role_code: roleCode, permissions: perms }).flatMap((g) =>
      g.items.map((i) => i.id),
    );
  };

  // Administrator sees all 14 modules
  const adminIds = visibleIds('administrator');
  assert.equal(adminIds.length, 14);
  assert.equal(adminIds.includes('staff'), true);
  assert.equal(adminIds.includes('settings'), true);

  // Store Manager restricted from Loyalty Programmes, Staff Management, Surveys, Settings
  const mgrIds = visibleIds('store_manager');
  assert.equal(mgrIds.includes('customers'), true);
  assert.equal(mgrIds.includes('reports'), true);
  assert.equal(mgrIds.includes('staff'), false);
  assert.equal(mgrIds.includes('settings'), false);
  assert.equal(mgrIds.includes('loyalty'), false);

  // Sales Staff limited to Overview, Customers, QR Scanner, Stamps, Redemptions, Purchases
  const salesIds = visibleIds('sales_staff');
  assert.deepEqual(salesIds, ['overview', 'customers', 'qr-scanner', 'stamps', 'redemptions', 'purchases']);

  // Marketing Staff limited to Overview, Campaigns, Surveys, Analytics
  const mktIds = visibleIds('marketing_staff');
  assert.deepEqual(mktIds, ['overview', 'campaigns', 'surveys', 'analytics']);

  // Granular per-staff override adds Rewards visibility without changing role
  const salesWithOverride = visibleIds('sales_staff', ['rewards.manage']);
  assert.equal(salesWithOverride.includes('rewards'), true);
});

test('Phase 8A Live staff operations, deactivated session termination & privilege escalation guards (mocked Supabase)', async (t) => {
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
    location: { origin: 'https://bonfree.test', pathname: '/admin/staff.html', search: '', hash: '' },
    history: { replaceState: () => {} },
    __BONFREE_CONFIG__: {
      supabaseUrl: 'https://mock-project.supabase.co',
      supabaseAnonKey: 'mock-anon-key',
      environment: 'test',
    },
  };
  globalThis.document = { querySelector: () => null };

  const { supabaseAuth } = await import('../src/scripts/core/supabaseClient.js');
  const { requireStaffSession } = await import('../src/scripts/services/authService.js');
  const { signInStaff } = await import('../src/scripts/services/adminService.js');
  const {
    fetchStaffDirectory,
    saveStaffMember,
    toggleStaffAccountStatus,
    saveStaffPermissionOverrides,
    fetchStaffActivityLog,
  } = await import('../src/scripts/services/adminExtendedService.js');

  // 1. Deactivated staff member holding an active JWT is immediately blocked & signed out
  supabaseAuth.setSession({
    access_token: 'existing-jwt-deactivated-staff',
    refresh_token: 'ref-1',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });

  let signOutCalled = false;
  globalThis.fetch = async (url) => {
    if (url.includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'staff-user-5', email: 'pooja@bonfree-hub.in' }), { status: 200 });
    }
    if (url.includes('/auth/v1/logout')) {
      signOutCalled = true;
      return new Response(JSON.stringify({}), { status: 200 });
    }
    if (url.includes('/rest/v1/rpc/fn_my_staff_context')) {
      return new Response(
        JSON.stringify({ ok: true, is_staff: true, active: false, status: 'inactive', staff_code: 'STF1005' }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify([]), { status: 200 });
  };

  const deactivatedGuard = await requireStaffSession();
  assert.equal(deactivatedGuard.ok, false);
  assert.equal(deactivatedGuard.code, 'STAFF_ACCOUNT_DEACTIVATED');
  assert.equal(deactivatedGuard.redirectUrl, 'login.html?reason=staff_deactivated');
  assert.equal(signOutCalled, true);
  assert.equal(supabaseAuth.getSession(), null);

  // 2. Deactivated staff cannot log back in via signInStaff
  globalThis.fetch = async (url) => {
    if (url.includes('/auth/v1/token?grant_type=password')) {
      return new Response(
        JSON.stringify({
          access_token: 'temp-jwt',
          refresh_token: 'temp-ref',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: 'staff-user-5', email: 'pooja@bonfree-hub.in' },
        }),
        { status: 200 },
      );
    }
    if (url.includes('/rest/v1/staff')) {
      return new Response(
        JSON.stringify([{ id: 'stf-5', staff_code: 'STF1005', status: 'inactive', roles: { code: 'marketing_staff' } }]),
        { status: 200 },
      );
    }
    if (url.includes('/auth/v1/logout')) {
      return new Response(JSON.stringify({}), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 404 });
  };

  const blockedLogin = await signInStaff({ email: 'pooja@bonfree-hub.in', password: 'Password123' });
  assert.equal(blockedLogin.ok, false);
  assert.equal(blockedLogin.code, 'STAFF_ACCOUNT_DEACTIVATED');
  assert.equal(supabaseAuth.getSession(), null);

  // 3. Active Administrator operations: list, invite, edit, permission override, status toggle, activity log
  supabaseAuth.setSession({
    access_token: 'live-admin-jwt',
    refresh_token: 'live-admin-ref',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });

  const capturedActions = [];
  globalThis.fetch = async (url, opts = {}) => {
    if (url.includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'admin-user-1', email: 'isha@bonfree-hub.in' }), { status: 200 });
    }
    if (url.includes('/rest/v1/rpc/fn_my_staff_context')) {
      return new Response(
        JSON.stringify({
          ok: true,
          is_staff: true,
          active: true,
          id: 'stf-3',
          staff_code: 'STF1003',
          role_code: 'administrator',
          permissions: ['staff.manage', 'settings.manage'],
        }),
        { status: 200 },
      );
    }
    if (url.includes('/functions/v1/manage-staff')) {
      const payload = JSON.parse(opts.body);
      capturedActions.push(payload);
      if (payload.action === 'list') {
        return new Response(
          JSON.stringify({
            ok: true,
            staff: [{ id: 'STF1002', uuid: 'stf-2', name: 'Vikram Singh', email: 'vikram@bonfree-hub.in', role: 'Sales Staff', roleCode: 'sales_staff', department: 'Bengaluru', status: 'Active', overrides: {} }],
            roles: [{ id: 'r-admin', code: 'administrator', name: 'Administrator' }],
            permissions: [{ id: 'p-1', code: 'rewards.manage', module: 'rewards', description: 'Manage rewards' }],
            rolePermissions: [{ role_id: 'r-admin', permission_id: 'p-1' }],
            stores: [{ id: 'str-1', name: 'Bengaluru — MG Road' }],
          }),
          { status: 200 },
        );
      }
      if (payload.action === 'get_activity') {
        return new Response(
          JSON.stringify({
            ok: true,
            auditLogs: [{ action: 'staff.invited', entity_type: 'staff', created_at: '2026-11-26T10:00:00Z' }],
            stampTransactions: [],
            redemptions: [],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  };

  const adminGuard = await requireStaffSession();
  assert.equal(adminGuard.ok, true);
  assert.equal(adminGuard.staff.role_code, 'administrator');

  const dirRes = await fetchStaffDirectory();
  assert.equal(dirRes.ok, true);
  assert.equal(dirRes.staff.length, 1);

  const inviteRes = await saveStaffMember({
    staffId: 'STF1009',
    name: 'Kabir Mehta',
    email: 'kabir@bonfree-hub.in',
    role: 'Sales Staff',
    department: 'Bengaluru — MG Road',
    status: 'Active',
  });
  assert.equal(inviteRes.ok, true);

  const permRes = await saveStaffPermissionOverrides({
    staffUuid: 'stf-2',
    overrides: { 'rewards.manage': true },
  });
  assert.equal(permRes.ok, true);

  const deactivateRes = await toggleStaffAccountStatus({ staffUuid: 'stf-2', nextStatus: 'inactive' });
  assert.equal(deactivateRes.ok, true);

  const activityRes = await fetchStaffActivityLog('stf-2');
  assert.equal(activityRes.ok, true);
  assert.equal(capturedActions.map((a) => a.action).includes('create'), true);
  assert.equal(capturedActions.map((a) => a.action).includes('set_permissions'), true);
  assert.equal(capturedActions.map((a) => a.action).includes('update_status'), true);

  // 4. Privilege escalation / direct unauthorized API call returns 403 FORBIDDEN / PRIVILEGE_ESCALATION_BLOCKED
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ code: 'PRIVILEGE_ESCALATION_BLOCKED', message: 'Only Administrators can assign Administrator.' }),
      { status: 403 },
    );
  const escRes = await saveStaffMember({
    staffId: 'STF9999',
    name: 'Escalation Attempt',
    email: 'esc@bonfree-hub.in',
    role: 'Administrator',
  });
  assert.equal(escRes.ok, false);
  assert.equal(escRes.code, 'PRIVILEGE_ESCALATION_BLOCKED');
});
