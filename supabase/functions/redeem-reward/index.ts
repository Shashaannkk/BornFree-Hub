import { getCorsHeaders, jsonResponse } from '../_shared/cors.ts';
import { requireAuthenticatedUser, requireStaffPermission } from '../_shared/auth.ts';

function mapRedemptionRpcError(message = '') {
  if (message.includes('INSUFFICIENT_STAMPS')) {
    return {
      status: 400,
      code: 'INSUFFICIENT_STAMPS',
      message: 'Insufficient stamps on the eligible loyalty card for this reward.',
    };
  }
  if (message.includes('REDEMPTION_ALREADY_PENDING')) {
    return {
      status: 409,
      code: 'REDEMPTION_ALREADY_PENDING',
      message: 'You already have an active pending voucher for this reward.',
    };
  }
  if (message.includes('REWARD_ELIGIBILITY_NOT_MET') || message.includes('REDEMPTION_LIMIT_REACHED')) {
    return {
      status: 403,
      code: 'REWARD_ELIGIBILITY_NOT_MET',
      message: 'This reward eligibility requirement or member redemption limit has been reached.',
    };
  }
  if (message.includes('ACTIVE_REWARD_NOT_FOUND')) {
    return {
      status: 404,
      code: 'ACTIVE_REWARD_NOT_FOUND',
      message: 'Selected reward is inactive or unavailable.',
    };
  }
  if (message.includes('ACTIVE_LOYALTY_CARD_NOT_FOUND')) {
    return {
      status: 404,
      code: 'ACTIVE_LOYALTY_CARD_NOT_FOUND',
      message: 'No eligible loyalty card found for this reward programme.',
    };
  }
  if (message.includes('VOUCHER_ALREADY_REDEEMED')) {
    return {
      status: 409,
      code: 'VOUCHER_ALREADY_REDEEMED',
      message: 'This voucher code has already been redeemed and cannot be used twice.',
    };
  }
  if (message.includes('VOUCHER_EXPIRED')) {
    return {
      status: 410,
      code: 'VOUCHER_EXPIRED',
      message: 'This voucher code has expired and is no longer valid.',
    };
  }
  if (message.includes('REDEMPTION_ALREADY_PROCESSED')) {
    return {
      status: 409,
      code: 'REDEMPTION_ALREADY_PROCESSED',
      message: 'This redemption request has already been processed.',
    };
  }
  if (message.includes('REDEMPTION_NOT_FOUND')) {
    return {
      status: 404,
      code: 'REDEMPTION_NOT_FOUND',
      message: 'No matching voucher or redemption record found.',
    };
  }
  if (message.includes('CUSTOMER_NOT_ACTIVE')) {
    return {
      status: 403,
      code: 'CUSTOMER_NOT_ACTIVE',
      message: 'Customer membership account is inactive.',
    };
  }
  if (message.includes('STAFF_NOT_ACTIVE')) {
    return {
      status: 403,
      code: 'FORBIDDEN',
      message: 'Active staff account required.',
    };
  }
  return {
    status: 400,
    code: 'REDEMPTION_REJECTED',
    message: message || 'Redemption request could not be completed.',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  try {
    const body = await req.json();
    const { mode } = body; // 'request' (customer) | 'verify' | 'confirm' | 'reject' (staff)

    if (mode === 'request') {
      const auth = await requireAuthenticatedUser(req);
      if (auth.error || !auth.user || !auth.adminClient) {
        return jsonResponse({ ok: false, code: 'UNAUTHORIZED', message: auth.error }, 401);
      }

      const { rewardId, idempotencyKey } = body;
      if (!rewardId) {
        return jsonResponse({ ok: false, code: 'VALIDATION_ERROR', message: 'Reward ID is required.' }, 400);
      }

      const { data: customer } = await auth.adminClient
        .from('customers')
        .select('id, status')
        .eq('user_id', auth.user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!customer) {
        return jsonResponse({ ok: false, code: 'CUSTOMER_NOT_ACTIVE', message: 'Active customer account required.' }, 403);
      }

      const { data, error } = await auth.adminClient.rpc('fn_request_redemption', {
        p_customer_id: customer.id,
        p_reward_id: rewardId,
        p_idempotency_key: idempotencyKey ? String(idempotencyKey).trim() : null,
      });

      if (error) {
        const mapped = mapRedemptionRpcError(error.message);
        return jsonResponse({ ok: false, code: mapped.code, message: mapped.message }, mapped.status);
      }

      const row = data?.[0] ?? null;
      return jsonResponse(
        {
          ok: true,
          idempotentReplay: Boolean(row?.idempotent_replay),
          result: row,
        },
        200,
      );
    }

    if (mode === 'verify') {
      const ctx = await requireStaffPermission(req, 'redemptions.verify');
      if (ctx.error || !ctx.adminClient || !ctx.staff) {
        return jsonResponse({ ok: false, code: 'FORBIDDEN', message: ctx.error }, 403);
      }

      const voucherCode = String(body.voucherCode || '').trim().toUpperCase();
      if (!voucherCode) {
        return jsonResponse({ ok: false, code: 'VALIDATION_ERROR', message: 'Voucher code is required.' }, 400);
      }

      const { data, error } = await ctx.adminClient.rpc('fn_verify_voucher', {
        p_voucher_code: voucherCode,
      });

      if (error) {
        return jsonResponse({ ok: false, code: 'VERIFY_ERROR', message: error.message }, 400);
      }
      if (!data?.ok) {
        return jsonResponse(
          { ok: false, code: data?.code || 'VOUCHER_NOT_FOUND', message: 'No voucher matched this code.' },
          404,
        );
      }

      return jsonResponse({ ok: true, voucher: data }, 200);
    }

    if (mode === 'confirm' || mode === 'reject') {
      const ctx = await requireStaffPermission(req, 'redemptions.verify');
      if (ctx.error || !ctx.adminClient || !ctx.staff) {
        return jsonResponse({ ok: false, code: 'FORBIDDEN', message: ctx.error }, 403);
      }

      const { redemptionId, voucherCode, storeId, rejectionReason } = body;
      if (!redemptionId && !voucherCode) {
        return jsonResponse(
          { ok: false, code: 'VALIDATION_ERROR', message: 'Redemption ID or voucher code is required.' },
          400,
        );
      }

      const { data, error } = await ctx.adminClient.rpc('fn_process_redemption', {
        p_redemption_id: redemptionId || null,
        p_staff_id: ctx.staff.id,
        p_store_id: storeId || ctx.staff.store_id,
        p_action: mode,
        p_rejection_reason: rejectionReason || null,
        p_voucher_code: voucherCode ? String(voucherCode).trim().toUpperCase() : null,
      });

      if (error) {
        const mapped = mapRedemptionRpcError(error.message);
        return jsonResponse({ ok: false, code: mapped.code, message: mapped.message }, mapped.status);
      }

      return jsonResponse({ ok: true, redemption: data }, 200);
    }

    return jsonResponse({ ok: false, code: 'INVALID_MODE', message: 'Unsupported redemption mode.' }, 400);
  } catch (err) {
    return jsonResponse({ ok: false, code: 'SERVER_ERROR', message: String(err) }, 500);
  }
});
