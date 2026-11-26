/**
 * BONFREE-HUB Contact Inquiry Service (Phase 1B Interface)
 *
 * Prepared to invoke the `submit-contact` Supabase Edge Function in Phase 2.
 * Does not simulate successful delivery before backend configuration is active.
 */
import { isSupabaseConfigured } from '../core/config.js';
import { invokeEdgeFunction } from '../core/supabaseClient.js';

/**
 * Submits a customer inquiry to the `submit-contact` Supabase Edge Function.
 * @param {{ fullName: string, email: string, subject: string, message: string }} payload
 */
export async function submitContactInquiry({ fullName, email, subject, message }) {
  if (!fullName || !email || !subject || !message) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Please fill in all required contact fields.',
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message:
        'Your inquiry was validated, but message delivery is offline until Supabase Edge Functions are connected.',
    };
  }

  return invokeEdgeFunction('submit-contact', { fullName, email, subject, message });
}
