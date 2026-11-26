/**
 * BONFREE-HUB Reusable Loading States (Spinners, Skeletons & Overlays)
 */
import { el, clearElement } from '../core/dom.js';

export function createSpinner(label = '') {
  return el('span', {
    className: 'spinner',
    role: label ? 'status' : null,
    'aria-label': label || null,
    'aria-hidden': label ? null : 'true',
  });
}

export function renderCardSkeleton(count = 3) {
  const grid = el('div', { className: 'grid grid-3' });
  for (let i = 0; i < count; i += 1) {
    grid.appendChild(
      el('div', { className: 'card stack' }, [
        el('span', { className: 'skeleton skeleton--title' }),
        el('span', { className: 'skeleton skeleton--text' }),
        el('span', { className: 'skeleton skeleton--text', style: 'width: 72%;' }),
      ]),
    );
  }
  return grid;
}

export function renderTableSkeleton({ rows = 5, cols = 5 } = {}) {
  const wrap = el('div', { className: 'stack', style: 'padding: 1rem;' });
  for (let r = 0; r < rows; r += 1) {
    const row = el('div', {
      className: 'grid',
      style: `grid-template-columns: repeat(${cols}, minmax(0, 1fr)); gap: 0.75rem;`,
    });
    for (let c = 0; c < cols; c += 1) {
      row.appendChild(el('span', { className: 'skeleton skeleton--text' }));
    }
    wrap.appendChild(row);
  }
  return wrap;
}

export function setRegionLoading(container, isLoading, message = 'Loading...') {
  if (!container) return;
  container.classList.add('loading-overlay-host');
  const existing = container.querySelector(':scope > .loading-overlay');

  if (isLoading) {
    if (existing) return;
    const overlay = el('div', { className: 'loading-overlay', role: 'status', 'aria-live': 'polite' }, [
      createSpinner(message),
      el('span', { className: 'text-xs text-muted', text: message }),
    ]);
    container.appendChild(overlay);
  } else if (existing) {
    clearElement(existing);
    existing.remove();
  }
}
