/**
 * BONFREE-HUB Reusable Alerts & Toast Notification System
 */
import { el } from '../core/dom.js';
import { createIcon } from '../core/icons.js';

const VARIANT_ICONS = Object.freeze({
  info: 'info',
  success: 'check',
  warning: 'alert-circle',
  danger: 'alert-circle',
});

let toastRegion = null;

function ensureToastRegion() {
  if (toastRegion && document.body.contains(toastRegion)) return toastRegion;
  toastRegion = el('div', {
    className: 'toast-region',
    role: 'status',
    'aria-live': 'polite',
  });
  document.body.appendChild(toastRegion);
  return toastRegion;
}

/**
 * Displays a floating toast notification.
 */
export function showToast({ message, variant = 'info', durationMs = 4000 } = {}) {
  const region = ensureToastRegion();
  const iconName = VARIANT_ICONS[variant] || 'info';

  const dismissBtn = el(
    'button',
    {
      type: 'button',
      className: 'btn btn--icon btn--sm',
      'aria-label': 'Dismiss notification',
      style: 'color: inherit;',
      onClick: () => toast.remove(),
    },
    [createIcon('x', { size: 15 })],
  );

  const toast = el('div', { className: 'toast' }, [
    el('div', { className: 'cluster', style: 'flex-wrap: nowrap;' }, [
      createIcon(iconName, { size: 16 }),
      el('span', { text: message || '' }),
    ]),
    dismissBtn,
  ]);

  region.appendChild(toast);

  if (durationMs > 0) {
    window.setTimeout(() => {
      if (toast.isConnected) toast.remove();
    }, durationMs);
  }

  return toast;
}

/**
 * Builds an inline alert banner DOM element.
 */
export function createAlert({ title = '', message = '', variant = 'info' } = {}) {
  const iconName = VARIANT_ICONS[variant] || 'info';
  return el('div', { className: `alert alert--${variant}`, role: variant === 'danger' ? 'alert' : 'status' }, [
    createIcon(iconName, { size: 18 }),
    el('div', { className: 'stack', style: 'gap: 2px;' }, [
      title ? el('strong', { className: 'text-sm', text: title }) : null,
      message ? el('span', { className: 'text-xs', text: message }) : null,
    ]),
  ]);
}
