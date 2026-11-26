import { getCorsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/auth.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  try {
    const body = await req.json();
    const fullName = String(body.fullName || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();

    if (fullName.length < 2 || !EMAIL_RE.test(email) || !subject || message.length < 10) {
      return jsonResponse({ ok: false, code: 'VALIDATION_ERROR', message: 'Invalid contact inquiry fields.' }, 400);
    }

    const adminClient = getServiceClient();
    const { data, error } = await adminClient
      .from('contact_messages')
      .insert({
        full_name: fullName,
        email,
        subject,
        message,
      })
      .select('id, created_at')
      .single();

    if (error) {
      return jsonResponse({ ok: false, code: 'INSERT_FAILED', message: error.message }, 400);
    }

    return jsonResponse({ ok: true, ticketId: data.id, createdAt: data.created_at }, 201);
  } catch (err) {
    return jsonResponse({ ok: false, code: 'SERVER_ERROR', message: String(err) }, 500);
  }
});
