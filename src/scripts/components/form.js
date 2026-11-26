/**
 * BONFREE-HUB Reusable Form Validation, Password Toggles & Submit States
 */
import { clearElement, el } from '../core/dom.js';
import { createIcon } from '../core/icons.js';
import { createSpinner } from './loader.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Attaches accessible show/hide password behavior to `[data-password-toggle]` buttons.
 */
export function initPasswordToggles(root = document) {
  const buttons = root.querySelectorAll('[data-password-toggle]');
  for (const btn of buttons) {
    if (btn.dataset.bound === 'true') continue;
    btn.dataset.bound = 'true';

    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-password-toggle');
      const input = targetId ? document.getElementById(targetId) : btn.parentElement?.querySelector('input');
      if (!input) return;

      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      clearElement(btn);
      btn.appendChild(createIcon(showing ? 'eye' : 'eye-off', { size: 16 }));
    });
  }
}

export function setFieldError(fieldWrapper, message) {
  if (!fieldWrapper) return;
  fieldWrapper.classList.add('has-error');
  let errEl = fieldWrapper.querySelector('.field__error');
  if (!errEl) {
    errEl = el('span', { className: 'field__error', role: 'alert' });
    fieldWrapper.appendChild(errEl);
  }
  errEl.textContent = message;
}

export function clearFieldErrors(formEl) {
  if (!formEl) return;
  for (const field of formEl.querySelectorAll('.field.has-error')) {
    field.classList.remove('has-error');
    field.querySelector('.field__error')?.remove();
  }
}

/**
 * Validates required fields, email format, and min-length constraints cleanly.
 * @returns {{ valid: boolean, values: Record<string, string> }}
 */
export function validateForm(formEl) {
  clearFieldErrors(formEl);
  const values = {};
  let valid = true;

  const controls = formEl.querySelectorAll('input[name], select[name], textarea[name]');
  for (const control of controls) {
    const raw = control.type === 'checkbox' ? String(control.checked) : control.value.trim();
    values[control.name] = raw;

    const fieldWrap = control.closest('.field');
    if (control.required && !raw) {
      valid = false;
      setFieldError(fieldWrap, 'This field is required.');
      continue;
    }

    if (control.type === 'email' && raw && !EMAIL_REGEX.test(raw)) {
      valid = false;
      setFieldError(fieldWrap, 'Enter a valid email address.');
      continue;
    }

    const minLen = Number(control.getAttribute('minlength'));
    if (minLen > 0 && raw && raw.length < minLen) {
      valid = false;
      setFieldError(fieldWrap, `Must be at least ${minLen} characters.`);
    }
  }

  return { valid, values };
}

/**
 * Toggles button loading spinner without losing original label text.
 */
export function setButtonLoading(button, isLoading, loadingLabel = 'Processing...') {
  if (!button) return;
  if (isLoading) {
    if (!button.dataset.originalLabel) {
      button.dataset.originalLabel = button.textContent.trim();
    }
    button.disabled = true;
    button.classList.add('is-loading');
    clearElement(button);
    button.append(createSpinner(), el('span', { text: loadingLabel }));
  } else {
    button.disabled = false;
    button.classList.remove('is-loading');
    const original = button.dataset.originalLabel;
    if (original) {
      button.textContent = original;
    }
  }
}
