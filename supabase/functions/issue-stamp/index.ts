import { getCorsHeaders, jsonResponse } from '../_shared/cors.ts';
import { requireStaffPermission } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  const ctx = await requireStaffPermission(req, 'stamps.issue');
  if (ctx.error || !ctx.adminClient || !ctx.staff) {
    return jsonResponse({ ok: false, code: 'FORBIDDEN', message: ctx.error }, 403);
  }

  try {
    const body = await req.json();
    const {
      customerUuid,
      qrToken,
      programmeId,
      storeId,
      receiptNo,
      amountInr,
      itemsSummary,
      idempotencyKey,
    } = body;

    if ((!customerUuid && !qrToken) || !programmeId || !receiptNo || Number(amountInr) <= 0) {
      return jsonResponse(
        { ok: false, code: 'VALIDATION_ERROR', message: 'Customer, programme, receipt number, and positive purchase amount are required.' },
        400,
      );
    }

    // Resolve customer strictly on the backend (verify QR identifier if provided)
    let resolvedCustomerId = customerUuid || null;
    if (qrToken) {
      const { data: qrCust } = await ctx.adminClient
        .from('customers')
        .select('id, status')
        .eq('qr_token', String(qrToken).trim())
        .maybeSingle();

      if (!qrCust) {
        return jsonResponse({ ok: false, code: 'INVALID_QR_TOKEN', message: 'Scanned QR identifier is invalid.' }, 404);
      }
      if (qrCust.status !== 'active') {
        return jsonResponse({ ok: false, code: 'CUSTOMER_NOT_ACTIVE', message: 'Customer membership is inactive.' }, 403);
      }
      resolvedCustomerId = qrCust.id;
    }

    let resolvedStoreId = storeId || ctx.staff.store_id;
    if (!resolvedStoreId) {
      const { data: fallbackStore } = await ctx.adminClient
        .from('stores')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      resolvedStoreId = fallbackStore?.id || null;
    }

    if (!resolvedStoreId) {
      return jsonResponse({ ok: false, code: 'STORE_REQUIRED', message: 'No active store location available.' }, 400);
    }

    // Never pass any frontend-supplied stamp count; fn_award_stamps calculates stamps authoritatively.
    const { data, error } = await ctx.adminClient.rpc('fn_award_stamps', {
      p_customer_id: resolvedCustomerId,
      p_programme_id: programmeId,
      p_store_id: resolvedStoreId,
      p_staff_id: ctx.staff.id,
      p_receipt_no: String(receiptNo).trim(),
      p_amount_inr: Number(amountInr),
      p_items_summary: String(itemsSummary || ''),
      p_idempotency_key: idempotencyKey ? String(idempotencyKey).trim() : null,
    });

    if (error) {
      const msg = error.message || '';
      if (error.code === '23505' || msg.includes('unique')) {
        return jsonResponse(
          { ok: false, code: 'DUPLICATE_RECEIPT', message: 'Duplicate purchase receipt detected. Stamps were already awarded.' },
          409,
        );
      }
      if (msg.includes('IDEMPOTENCY_KEY_CONFLICT')) {
        return jsonResponse(
          { ok: false, code: 'IDEMPOTENCY_KEY_CONFLICT', message: 'Idempotency key reused with different purchase parameters.' },
          409,
        );
      }
      if (msg.includes('COOLDOWN_ACTIVE')) {
        return jsonResponse(
          { ok: false, code: 'COOLDOWN_ACTIVE', message: 'Cooldown period active for this member and programme. Try again later.' },
          429,
        );
      }
      if (msg.includes('PROGRAMME_EXPIRED_OR_INACTIVE')) {
        return jsonResponse(
          { ok: false, code: 'PROGRAMME_EXPIRED_OR_INACTIVE', message: 'Selected loyalty programme is inactive or expired.' },
          400,
        );
      }
      if (msg.includes('PURCHASE_BELOW_THRESHOLD')) {
        return jsonResponse(
          { ok: false, code: 'PURCHASE_BELOW_THRESHOLD', message: 'Purchase amount does not meet the qualifying threshold.' },
          400,
        );
      }

      return jsonResponse({ ok: false, code: 'STAMP_AWARD_REJECTED', message: msg }, 400);
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
  } catch (err) {
    return jsonResponse({ ok: false, code: 'SERVER_ERROR', message: String(err) }, 500);
  }
});
