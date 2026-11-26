import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function getServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !serviceRoleKey) {
    throw new Error('Missing server-side SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing Bearer token', user: null, adminClient: null };
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) {
    return { error: 'Invalid or expired session', user: null, adminClient: null };
  }

  return { error: null, user: data.user, adminClient: getServiceClient() };
}

export async function requireStaffPermission(req: Request, permissionCode: string) {
  const auth = await requireAuthenticatedUser(req);
  if (auth.error || !auth.user || !auth.adminClient) {
    return { ...auth, staff: null };
  }

  const { data: staff, error: staffErr } = await auth.adminClient
    .from('staff')
    .select('id, staff_code, role_id, store_id, status, roles!inner(code)')
    .eq('user_id', auth.user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (staffErr || !staff) {
    return { error: 'Active staff profile required', user: auth.user, adminClient: null, staff: null };
  }

  const { data: perm } = await auth.adminClient
    .from('permissions')
    .select('id')
    .eq('code', permissionCode)
    .maybeSingle();

  if (!perm) {
    return { error: 'Unknown permission code', user: auth.user, adminClient: null, staff: null };
  }

  const { data: override } = await auth.adminClient
    .from('staff_permissions')
    .select('granted')
    .eq('staff_id', staff.id)
    .eq('permission_id', perm.id)
    .maybeSingle();

  if (override) {
    if (!override.granted) {
      return { error: `Permission denied: ${permissionCode}`, user: auth.user, adminClient: null, staff: null };
    }
    return { error: null, user: auth.user, adminClient: auth.adminClient, staff };
  }

  const { data: rolePerm } = await auth.adminClient
    .from('role_permissions')
    .select('permission_id')
    .eq('role_id', staff.role_id)
    .eq('permission_id', perm.id)
    .maybeSingle();

  if (!rolePerm) {
    return { error: `Permission denied: ${permissionCode}`, user: auth.user, adminClient: null, staff: null };
  }

  return { error: null, user: auth.user, adminClient: auth.adminClient, staff };
}
