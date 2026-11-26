import { getCorsHeaders, jsonResponse } from '../_shared/cors.ts';
import { requireStaffPermission } from '../_shared/auth.ts';

function getCallerRoleCode(staff: Record<string, unknown>): string {
  const roles = staff?.roles as { code?: string } | { code?: string }[] | undefined;
  if (Array.isArray(roles)) return roles[0]?.code || '';
  return roles?.code || '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  const ctx = await requireStaffPermission(req, 'staff.manage');
  if (ctx.error || !ctx.adminClient || !ctx.staff) {
    return jsonResponse({ ok: false, code: 'FORBIDDEN', message: ctx.error }, 403);
  }

  const callerRole = getCallerRoleCode(ctx.staff as unknown as Record<string, unknown>);

  try {
    const body = await req.json();
    const {
      action = 'create',
      staffId,
      email,
      fullName,
      staffCode,
      roleCode,
      storeId,
      department,
      status,
      overrides,
      redirectTo,
    } = body;

    if (action === 'list') {
      const [staffRes, profilesRes, rolesRes, permsRes, rolePermsRes, staffPermsRes, storesRes, txRes, rdmRes] =
        await Promise.all([
          ctx.adminClient.from('staff').select('id, user_id, staff_code, role_id, store_id, department, status, created_at').order('created_at', { ascending: false }),
          ctx.adminClient.from('profiles').select('id, full_name, email, phone'),
          ctx.adminClient.from('roles').select('id, code, name, description').order('code'),
          ctx.adminClient.from('permissions').select('id, code, module, description').order('module').order('code'),
          ctx.adminClient.from('role_permissions').select('role_id, permission_id'),
          ctx.adminClient.from('staff_permissions').select('staff_id, permission_id, granted'),
          ctx.adminClient.from('stores').select('id, store_code, name').eq('is_active', true),
          ctx.adminClient.from('stamp_transactions').select('staff_id').not('staff_id', 'is', null),
          ctx.adminClient.from('redemptions').select('verified_by_staff_id').not('verified_by_staff_id', 'is', null),
        ]);

      if (staffRes.error) {
        return jsonResponse({ ok: false, code: 'QUERY_FAILED', message: staffRes.error.message }, 400);
      }

      const profileById = new Map((profilesRes.data || []).map((p) => [p.id, p]));
      const roleById = new Map((rolesRes.data || []).map((r) => [r.id, r]));
      const storeById = new Map((storesRes.data || []).map((s) => [s.id, s]));
      const permById = new Map((permsRes.data || []).map((p) => [p.id, p]));

      const stampCounts = new Map<string, number>();
      for (const row of txRes.data || []) {
        stampCounts.set(row.staff_id, (stampCounts.get(row.staff_id) || 0) + 1);
      }
      const rdmCounts = new Map<string, number>();
      for (const row of rdmRes.data || []) {
        rdmCounts.set(row.verified_by_staff_id, (rdmCounts.get(row.verified_by_staff_id) || 0) + 1);
      }

      const staffRows = (staffRes.data || []).map((s) => {
        const prof = profileById.get(s.user_id);
        const role = roleById.get(s.role_id);
        const store = s.store_id ? storeById.get(s.store_id) : null;
        const memberOverrides: Record<string, boolean> = {};
        for (const sp of staffPermsRes.data || []) {
          if (sp.staff_id === s.id) {
            const p = permById.get(sp.permission_id);
            if (p) memberOverrides[p.code] = Boolean(sp.granted);
          }
        }
        return {
          id: s.staff_code,
          uuid: s.id,
          userId: s.user_id,
          name: prof?.full_name || s.staff_code,
          email: prof?.email || '',
          phone: prof?.phone || '',
          role: role?.name || 'Sales Staff',
          roleCode: role?.code || 'sales_staff',
          storeId: s.store_id || '',
          department: store?.name || s.department || 'Operations',
          status: s.status === 'active' ? 'Active' : 'Inactive',
          overrides: memberOverrides,
          stampsIssuedCount: stampCounts.get(s.id) || 0,
          redemptionsVerifiedCount: rdmCounts.get(s.id) || 0,
        };
      });

      return jsonResponse(
        {
          ok: true,
          staff: staffRows,
          roles: rolesRes.data || [],
          permissions: permsRes.data || [],
          rolePermissions: rolePermsRes.data || [],
          stores: storesRes.data || [],
        },
        200,
      );
    }

    if (action === 'get_activity') {
      if (!staffId) {
        return jsonResponse({ ok: false, code: 'VALIDATION_ERROR', message: 'Staff UUID is required.' }, 400);
      }
      const [auditRes, txRes, rdmRes] = await Promise.all([
        ctx.adminClient
          .from('audit_logs')
          .select('id, action, entity_type, metadata, created_at')
          .or(`actor_staff_id.eq.${staffId},entity_id.eq.${staffId}`)
          .order('created_at', { ascending: false })
          .limit(20),
        ctx.adminClient
          .from('stamp_transactions')
          .select('transaction_code, stamps_delta, notes, created_at')
          .eq('staff_id', staffId)
          .order('created_at', { ascending: false })
          .limit(10),
        ctx.adminClient
          .from('redemptions')
          .select('voucher_code, status, processed_at')
          .eq('verified_by_staff_id', staffId)
          .order('processed_at', { ascending: false })
          .limit(10),
      ]);

      return jsonResponse(
        {
          ok: true,
          auditLogs: auditRes.data || [],
          stampTransactions: txRes.data || [],
          redemptions: rdmRes.data || [],
        },
        200,
      );
    }

    if (action === 'update_status') {
      if (!staffId || (status !== 'active' && status !== 'inactive')) {
        return jsonResponse({ ok: false, code: 'VALIDATION_ERROR', message: 'Valid staffId and status required.' }, 400);
      }

      if (staffId === ctx.staff.id && status === 'inactive') {
        return jsonResponse({ ok: false, code: 'CANNOT_DEACTIVATE_SELF', message: 'You cannot deactivate your own active administrator account.' }, 400);
      }

      const { data: targetStaff } = await ctx.adminClient
        .from('staff')
        .select('id, user_id, staff_code, roles(code)')
        .eq('id', staffId)
        .single();

      if (!targetStaff) {
        return jsonResponse({ ok: false, code: 'STAFF_NOT_FOUND', message: 'Staff record not found.' }, 404);
      }

      const targetRole = getCallerRoleCode(targetStaff as unknown as Record<string, unknown>);
      if (targetRole === 'administrator' && callerRole !== 'administrator') {
        return jsonResponse({ ok: false, code: 'PRIVILEGE_ESCALATION_BLOCKED', message: 'Only Administrators can alter Administrator accounts.' }, 403);
      }

      const { data, error } = await ctx.adminClient
        .from('staff')
        .update({ status })
        .eq('id', staffId)
        .select('id, user_id, staff_code, status')
        .single();

      if (error) {
        return jsonResponse({ ok: false, code: 'UPDATE_FAILED', message: error.message }, 400);
      }

      // Immediately revoke session & login capability when deactivated; lift ban on reactivation
      await ctx.adminClient.auth.admin.updateUserById(targetStaff.user_id, {
        ban_duration: status === 'inactive' ? '876000h' : 'none',
      }).catch(() => {});

      await ctx.adminClient.from('audit_logs').insert({
        actor_staff_id: ctx.staff.id,
        action: status === 'active' ? 'staff.activated' : 'staff.deactivated',
        entity_type: 'staff',
        entity_id: data.id,
        metadata: { staff_code: data.staff_code, status },
      });

      return jsonResponse({ ok: true, staff: data }, 200);
    }

    if (action === 'set_permissions') {
      if (!staffId || !overrides || typeof overrides !== 'object') {
        return jsonResponse({ ok: false, code: 'VALIDATION_ERROR', message: 'Staff UUID and permission overrides are required.' }, 400);
      }

      const { data: targetStaff } = await ctx.adminClient
        .from('staff')
        .select('id, staff_code, roles(code)')
        .eq('id', staffId)
        .single();

      if (!targetStaff) {
        return jsonResponse({ ok: false, code: 'STAFF_NOT_FOUND', message: 'Staff record not found.' }, 404);
      }

      const targetRole = getCallerRoleCode(targetStaff as unknown as Record<string, unknown>);
      if (targetRole === 'administrator' && callerRole !== 'administrator') {
        return jsonResponse({ ok: false, code: 'PRIVILEGE_ESCALATION_BLOCKED', message: 'Only Administrators can alter Administrator permissions.' }, 403);
      }

      if (callerRole !== 'administrator' && (overrides['staff.manage'] === true || overrides['settings.manage'] === true)) {
        return jsonResponse({ ok: false, code: 'PRIVILEGE_ESCALATION_BLOCKED', message: 'Privilege escalation denied: cannot grant privileged permissions.' }, 403);
      }

      const { data: allPerms } = await ctx.adminClient.from('permissions').select('id, code');
      const permIdByCode = new Map((allPerms || []).map((p) => [p.code, p.id]));

      const { error: clearErr } = await ctx.adminClient.from('staff_permissions').delete().eq('staff_id', staffId);
      if (clearErr) {
        return jsonResponse({ ok: false, code: 'PERMISSION_UPDATE_FAILED', message: clearErr.message }, 400);
      }

      const inserts = Object.entries(overrides as Record<string, boolean | null>)
        .filter(([code, val]) => typeof val === 'boolean' && permIdByCode.has(code))
        .map(([code, granted]) => ({
          staff_id: staffId,
          permission_id: permIdByCode.get(code),
          granted: Boolean(granted),
        }));

      if (inserts.length > 0) {
        const { error: insErr } = await ctx.adminClient.from('staff_permissions').insert(inserts);
        if (insErr) {
          return jsonResponse({ ok: false, code: 'PERMISSION_UPDATE_FAILED', message: insErr.message }, 400);
        }
      }

      await ctx.adminClient.from('audit_logs').insert({
        actor_staff_id: ctx.staff.id,
        action: 'staff.permissions_updated',
        entity_type: 'staff',
        entity_id: staffId,
        metadata: { staff_code: targetStaff.staff_code, overrides },
      });

      return jsonResponse({ ok: true }, 200);
    }

    if (action === 'send_reset') {
      if (!email) {
        return jsonResponse({ ok: false, code: 'VALIDATION_ERROR', message: 'Staff email is required.' }, 400);
      }
      const { data: linkData, error: linkErr } = await ctx.adminClient.auth.admin.generateLink({
        type: 'recovery',
        email: String(email).trim().toLowerCase(),
        options: redirectTo ? { redirectTo } : undefined,
      });

      if (linkErr) {
        return jsonResponse({ ok: false, code: 'RESET_FAILED', message: linkErr.message }, 400);
      }

      await ctx.adminClient.from('audit_logs').insert({
        actor_staff_id: ctx.staff.id,
        action: 'staff.password_reset_sent',
        entity_type: 'staff',
        entity_id: staffId || null,
        metadata: { email: String(email).trim().toLowerCase() },
      });

      return jsonResponse({ ok: true, message: 'Password setup/reset link generated for staff member.', hasLink: Boolean(linkData) }, 200);
    }

    if (action === 'update') {
      if (!staffId || !fullName || !roleCode) {
        return jsonResponse({ ok: false, code: 'VALIDATION_ERROR', message: 'Staff UUID, full name, and role are required.' }, 400);
      }

      if (roleCode === 'administrator' && callerRole !== 'administrator') {
        return jsonResponse({ ok: false, code: 'PRIVILEGE_ESCALATION_BLOCKED', message: 'Only Administrators can assign the Administrator role.' }, 403);
      }

      if (staffId === ctx.staff.id && status === 'inactive') {
        return jsonResponse({ ok: false, code: 'CANNOT_DEACTIVATE_SELF', message: 'You cannot deactivate your own active administrator account.' }, 400);
      }

      const { data: existingStaff } = await ctx.adminClient
        .from('staff')
        .select('id, user_id, staff_code, roles(code)')
        .eq('id', staffId)
        .single();

      if (!existingStaff) {
        return jsonResponse({ ok: false, code: 'STAFF_NOT_FOUND', message: 'Staff record not found.' }, 404);
      }

      const currentTargetRole = getCallerRoleCode(existingStaff as unknown as Record<string, unknown>);
      if (currentTargetRole === 'administrator' && callerRole !== 'administrator') {
        return jsonResponse({ ok: false, code: 'PRIVILEGE_ESCALATION_BLOCKED', message: 'Only Administrators can modify Administrator accounts.' }, 403);
      }

      const { data: role } = await ctx.adminClient.from('roles').select('id').eq('code', roleCode).single();
      if (!role) {
        return jsonResponse({ ok: false, code: 'INVALID_ROLE', message: 'Invalid role code.' }, 400);
      }

      const nextStatus = status === 'inactive' ? 'inactive' : 'active';
      await ctx.adminClient.from('profiles').update({ full_name: String(fullName).trim() }).eq('id', existingStaff.user_id);

      const { data: updated, error: updErr } = await ctx.adminClient
        .from('staff')
        .update({
          role_id: role.id,
          store_id: storeId || null,
          department: department || 'Operations',
          status: nextStatus,
        })
        .eq('id', staffId)
        .select()
        .single();

      if (updErr) {
        return jsonResponse({ ok: false, code: 'STAFF_UPDATE_FAILED', message: updErr.message }, 400);
      }

      await ctx.adminClient.auth.admin.updateUserById(existingStaff.user_id, {
        ban_duration: nextStatus === 'inactive' ? '876000h' : 'none',
      }).catch(() => {});

      await ctx.adminClient.from('audit_logs').insert({
        actor_staff_id: ctx.staff.id,
        action: 'staff.updated',
        entity_type: 'staff',
        entity_id: staffId,
        metadata: { staff_code: existingStaff.staff_code, role_code: roleCode, status: nextStatus, department },
      });

      return jsonResponse({ ok: true, staff: updated }, 200);
    }

    // Create / Invite new staff member (default action)
    if (!email || !fullName || !staffCode || !roleCode) {
      return jsonResponse({ ok: false, code: 'VALIDATION_ERROR', message: 'Missing required staff fields.' }, 400);
    }

    if (roleCode === 'administrator' && callerRole !== 'administrator') {
      return jsonResponse({ ok: false, code: 'PRIVILEGE_ESCALATION_BLOCKED', message: 'Only Administrators can provision Administrator accounts.' }, 403);
    }

    const { data: role } = await ctx.adminClient.from('roles').select('id').eq('code', roleCode).single();
    if (!role) {
      return jsonResponse({ ok: false, code: 'INVALID_ROLE', message: 'Invalid role code.' }, 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const { data: invited, error: inviteErr } = await ctx.adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
      data: { full_name: String(fullName).trim() },
      redirectTo: redirectTo || undefined,
    });

    if (inviteErr || !invited?.user) {
      return jsonResponse({ ok: false, code: 'INVITE_FAILED', message: inviteErr?.message || 'Invite failed' }, 400);
    }

    const initialStatus = status === 'inactive' ? 'inactive' : 'active';
    await ctx.adminClient.auth.admin.updateUserById(invited.user.id, {
      app_metadata: { is_staff: true },
      ban_duration: initialStatus === 'inactive' ? '876000h' : 'none',
    });

    await ctx.adminClient.from('profiles').upsert({
      id: invited.user.id,
      full_name: String(fullName).trim(),
      email: normalizedEmail,
    });

    const { data: staffRow, error: staffErr } = await ctx.adminClient
      .from('staff')
      .insert({
        user_id: invited.user.id,
        staff_code: String(staffCode).trim().toUpperCase(),
        role_id: role.id,
        store_id: storeId || null,
        department: department || 'Operations',
        status: initialStatus,
      })
      .select()
      .single();

    if (staffErr) {
      return jsonResponse({ ok: false, code: 'STAFF_INSERT_FAILED', message: staffErr.message }, 400);
    }

    await ctx.adminClient.from('audit_logs').insert({
      actor_staff_id: ctx.staff.id,
      action: 'staff.invited',
      entity_type: 'staff',
      entity_id: staffRow.id,
      metadata: { staff_code: staffRow.staff_code, role_code: roleCode, status: initialStatus },
    });

    return jsonResponse({ ok: true, staff: staffRow }, 201);
  } catch (err) {
    return jsonResponse({ ok: false, code: 'SERVER_ERROR', message: String(err) }, 500);
  }
});
