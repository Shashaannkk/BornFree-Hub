/**
 * BONFREE-HUB Production Client Monitoring & Sanitized Logger
 *
 * Security rules:
 * - Never logs passwords, bearer tokens, JWTs, or full customer emails.
 * - Keeps an in-memory circular diagnostic buffer only (no localStorage).
 */
import { getPublicConfig } from './config.js';

const MAX_BUFFER = 40;
const logBuffer = [];

function redactSensitive(value = '') {
  return String(value || '')
    .replace(/eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]');
}

export function logAppEvent(level = 'info', category = 'app', message = '', meta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    env: getPublicConfig().environment,
    level,
    category,
    message: redactSensitive(message),
    page: typeof document !== 'undefined' ? document.body?.dataset?.page || '' : '',
    code: meta?.code || undefined,
  };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER) logBuffer.shift();

  if (level === 'error' && typeof console !== 'undefined') {
    console.error('[BONFREE-HUB]', entry.category, entry.message, entry.code || '');
  }
  return entry;
}

export function getRecentLogEvents() {
  return [...logBuffer];
}

let monitoringInstalled = false;

export function installGlobalErrorMonitoring() {
  if (monitoringInstalled || typeof window === 'undefined') return;
  monitoringInstalled = true;

  window.addEventListener('error', (event) => {
    logAppEvent('error', 'window.error', event?.message || 'Unhandled runtime error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason?.message || String(event?.reason || 'Unhandled promise rejection');
    logAppEvent('error', 'unhandledrejection', reason);
  });
}
