/**
 * BONFREE-HUB Contact Inquiry Service (Phase 1B Interface)
 *
 * Prepared to invoke the `submit-contact` Supabase Edge Function in Phase 2.
 * Does not simulate successful delivery before backend configuration is active.
 */
import { isSupabaseConfigured } from '../core/config.js';

/**
 * Submits a customer inquiry to the backend Edge Function when connected.
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
        'Your inquiry was validated, but message delivery is offline until the Phase 2 Supabase Edge Function is connected.',
    };
  }

  return {
    ok: false,
    code: 'SERVICE_PENDING',
    message: 'Contact Edge Function integration activates in Phase 2.',
  };
}
