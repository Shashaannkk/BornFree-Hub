/**
 * BONFREE-HUB Accessible Modal Dialog Manager
 */
import { el, clearElement } from '../core/dom.js';
import { createIcon } from '../core/icons.js';

let activeBackdrop = null;
let previousFocus = null;

function ensureBackdrop() {
  if (activeBackdrop) return activeBackdrop;

  const backdrop = el('div', {
    className: 'modal-backdrop',
    hidden: true,
    role: 'presentation',
  });

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !backdrop.hidden) {
      closeModal();
    }
  });

  document.body.appendChild(backdrop);
  activeBackdrop = backdrop;
  return backdrop;
}

/**
 * Opens an accessible modal dialog.
 */
export function openModal({ title = 'Dialog', body = null, footerActions = [] } = {}) {
  const backdrop = ensureBackdrop();
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  clearElement(backdrop);

  const closeBtn = el(
    'button',
    {
      type: 'button',
      className: 'btn btn--icon btn--ghost',
      'aria-label': 'Close dialog',
      onClick: closeModal,
    },
    [createIcon('x', { size: 18 })],
  );

  const bodyEl = el('div', { className: 'modal-dialog__body' });
  if (body instanceof Node) {
    bodyEl.appendChild(body);
  } else if (body) {
    bodyEl.appendChild(el('p', { className: 'text-sm', text: String(body) }));
  }

  const dialogChildren = [
    el('div', { className: 'modal-dialog__header' }, [
      el('h3', { className: 'card__title', id: 'bonfree-modal-title', text: title }),
      closeBtn,
    ]),
    bodyEl,
  ];

  if (footerActions.length > 0) {
    dialogChildren.push(el('div', { className: 'modal-dialog__footer' }, footerActions));
  }

  const dialog = el(
    'div',
    {
      className: 'modal-dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'bonfree-modal-title',
    },
    dialogChildren,
  );

  backdrop.appendChild(dialog);
  backdrop.hidden = false;
  closeBtn.focus();
}

export function closeModal() {
  if (!activeBackdrop) return;
  activeBackdrop.hidden = true;
  clearElement(activeBackdrop);
  if (previousFocus && typeof previousFocus.focus === 'function') {
    previousFocus.focus();
  }
}

/**
 * Opens a standard confirmation modal and resolves with boolean result.
 */
export function confirmModal({
  title = 'Confirm Action',
  message = 'Are you sure you want to continue?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
} = {}) {
  return new Promise((resolve) => {
    const cancelBtn = el('button', {
      type: 'button',
      className: 'btn btn--outline-muted',
      text: cancelLabel,
      onClick: () => {
        closeModal();
        resolve(false);
      },
    });

    const confirmBtn = el('button', {
      type: 'button',
      className: 'btn btn--primary',
      text: confirmLabel,
      onClick: () => {
        closeModal();
        resolve(true);
      },
    });

    openModal({
      title,
      body: message,
      footerActions: [cancelBtn, confirmBtn],
    });
  });
}
