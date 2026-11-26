/**
 * BONFREE-HUB Public Runtime Configuration
 *
 * Security rule:
 * - Only public identifiers (e.g., Supabase URL & public anon key) may ever exist here.
 * - Never embed service-role keys, admin passwords, or private webhook secrets.
 */

const DEFAULTS = Object.freeze({
  appName: 'BONFREE-HUB',
  appTagline: 'Modern Streetwear & Everyday Fashion',
  currencySymbol: '₹',
  defaultStampGoal: 10,
  supabaseUrl: '',
  supabaseAnonKey: '',
  environment: 'development',
});

/**
 * Reads safe public config from `<meta name="bonfree-*" content="...">` tags
 * or a sanitized `window.__BONFREE_CONFIG__` object when injected at deploy time.
 */
export function getPublicConfig() {
  if (typeof document === 'undefined') {
    return { ...DEFAULTS };
  }

  const metaUrl = document.querySelector('meta[name="bonfree-supabase-url"]')?.content?.trim() || '';
  const metaKey = document.querySelector('meta[name="bonfree-supabase-anon-key"]')?.content?.trim() || '';
  const metaEnv = document.querySelector('meta[name="bonfree-env"]')?.content?.trim() || '';
  const runtime = typeof window !== 'undefined' && window.__BONFREE_CONFIG__ ? window.__BONFREE_CONFIG__ : {};

  return Object.freeze({
    ...DEFAULTS,
    supabaseUrl: runtime.supabaseUrl || metaUrl || DEFAULTS.supabaseUrl,
    supabaseAnonKey: runtime.supabaseAnonKey || metaKey || DEFAULTS.supabaseAnonKey,
    environment: runtime.environment || metaEnv || DEFAULTS.environment,
  });
}

export function isSupabaseConfigured() {
  const cfg = getPublicConfig();
  return Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
}
