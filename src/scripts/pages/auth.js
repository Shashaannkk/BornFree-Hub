/**
 * BONFREE-HUB Contact & Customer Auth Pages Controller (Phase 1B)
 */
import { clearElement, qs, qsa } from '../core/dom.js';
import { createAlert, showToast } from '../components/toast.js';
import { clearFieldErrors, setButtonLoading, setFieldError, validateForm } from '../components/form.js';
import { openPolicyModal } from '../components/footer.js';
import {
  registerCustomer,
  requestPasswordReset,
  signInCustomer,
  updateCustomerPassword,
} from '../services/authService.js';
import { submitContactInquiry } from '../services/contactService.js';

const MOBILE_REGEX = /^\+?[0-9\s-]{10,15}$/;

export function evaluatePasswordStrength(password = '') {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };
}

export function isPasswordStrong(password = '') {
  const checks = evaluatePasswordStrength(password);
  return checks.length && checks.upper && checks.lower && checks.number;
}

function showFormBanner(region, { title, message, variant = 'warning' }) {
  if (!region) return;
  clearElement(region);
  region.appendChild(createAlert({ title, message, variant }));
}

function bindLivePasswordRules(inputEl, rulesContainer) {
  if (!inputEl || !rulesContainer) return;

  const update = () => {
    const checks = evaluatePasswordStrength(inputEl.value);
    for (const [key, met] of Object.entries(checks)) {
      const ruleNode = rulesContainer.querySelector(`[data-rule="${key}"]`);
      if (ruleNode) {
        ruleNode.classList.toggle('is-met', met);
      }
    }
  };

  inputEl.addEventListener('input', update);
  update();
}

function handleServiceResult(result, statusRegion) {
  if (result.ok) return;

  const isNotConfigured =
    result.code === 'SUPABASE_NOT_CONFIGURED' ||
    result.code === 'AUTH_CLIENT_PENDING' ||
    result.code === 'SERVICE_PENDING';

  showFormBanner(statusRegion, {
    title: isNotConfigured ? 'Backend Connection Pending (Phase 2)' : 'Unable to Proceed',
    message: result.message,
    variant: isNotConfigured ? 'warning' : 'danger',
  });

  showToast({
    message: result.message,
    variant: isNotConfigured ? 'warning' : 'danger',
  });
}

function initContactPage() {
  const form = qs('#contact-form');
  if (!form) return;
  const statusRegion = qs('#form-status-region');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearElement(statusRegion);
    const { valid, values } = validateForm(form);
    if (!valid) {
      showFormBanner(statusRegion, {
        title: 'Check Your Details',
        message: 'Please complete all required fields with valid information.',
        variant: 'danger',
      });
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true, 'Sending...');

    try {
      const result = await submitContactInquiry({
        fullName: values.fullName,
        email: values.email,
        subject: values.subject,
        message: values.message,
      });
      handleServiceResult(result, statusRegion);
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

function initLoginPage() {
  const form = qs('#login-form');
  if (!form) return;
  const statusRegion = qs('#form-status-region');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearElement(statusRegion);
    const { valid, values } = validateForm(form);
    if (!valid) {
      showFormBanner(statusRegion, {
        title: 'Sign In Incomplete',
        message: 'Enter a valid email address and password.',
        variant: 'danger',
      });
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true, 'Signing In...');

    try {
      const result = await signInCustomer({
        email: values.email,
        password: values.password,
      });
      handleServiceResult(result, statusRegion);
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

function initRegisterPage() {
  const form = qs('#register-form');
  if (!form) return;
  const statusRegion = qs('#form-status-region');
  const passwordInput = qs('#reg-password');
  const confirmInput = qs('#reg-confirm-password');
  const mobileInput = qs('#reg-mobile');
  const termsCheckbox = qs('#reg-terms');
  const rulesContainer = qs('#reg-password-rules');

  bindLivePasswordRules(passwordInput, rulesContainer);

  for (const trigger of qsa('[data-open-policy]')) {
    trigger.addEventListener('click', () => {
      openPolicyModal(trigger.getAttribute('data-open-policy'));
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearElement(statusRegion);
    const { valid, values } = validateForm(form);
    let allValid = valid;

    if (mobileInput && values.mobile && !MOBILE_REGEX.test(values.mobile)) {
      allValid = false;
      setFieldError(mobileInput.closest('.field'), 'Enter a valid 10–15 digit mobile number.');
    }

    if (passwordInput && values.password && !isPasswordStrong(values.password)) {
      allValid = false;
      setFieldError(
        passwordInput.closest('.field'),
        'Password must meet all 4 security requirements below.',
      );
    }

    if (confirmInput && values.confirmPassword && values.password !== values.confirmPassword) {
      allValid = false;
      setFieldError(confirmInput.closest('.field'), 'Passwords do not match.');
    }

    if (termsCheckbox && !termsCheckbox.checked) {
      allValid = false;
      setFieldError(
        termsCheckbox.closest('.field'),
        'You must accept the Privacy Policy and Loyalty Terms.',
      );
    }

    if (!allValid) {
      showFormBanner(statusRegion, {
        title: 'Review Registration Fields',
        message: 'Please fix the highlighted errors before creating your account.',
        variant: 'danger',
      });
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true, 'Creating Account...');

    try {
      const result = await registerCustomer({
        fullName: values.fullName,
        mobile: values.mobile,
        email: values.email,
        password: values.password,
        acceptedTerms: termsCheckbox.checked,
      });
      handleServiceResult(result, statusRegion);
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

function initForgotPasswordPage() {
  const form = qs('#forgot-password-form');
  if (!form) return;
  const statusRegion = qs('#form-status-region');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearElement(statusRegion);
    const { valid, values } = validateForm(form);
    if (!valid) {
      showFormBanner(statusRegion, {
        title: 'Valid Email Required',
        message: 'Enter the registered email address associated with your BONFREE-HUB account.',
        variant: 'danger',
      });
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true, 'Sending Link...');

    try {
      const result = await requestPasswordReset({ email: values.email });
      handleServiceResult(result, statusRegion);
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

function initResetPasswordPage() {
  const form = qs('#reset-password-form');
  if (!form) return;
  const statusRegion = qs('#form-status-region');
  const newPasswordInput = qs('#reset-new-password');
  const confirmPasswordInput = qs('#reset-confirm-password');
  const rulesContainer = qs('#reset-password-rules');

  bindLivePasswordRules(newPasswordInput, rulesContainer);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearElement(statusRegion);
    clearFieldErrors(form);
    const { valid, values } = validateForm(form);
    let allValid = valid;

    if (newPasswordInput && values.newPassword && !isPasswordStrong(values.newPassword)) {
      allValid = false;
      setFieldError(
        newPasswordInput.closest('.field'),
        'New password must meet all 4 security requirements below.',
      );
    }

    if (
      confirmPasswordInput &&
      values.confirmPassword &&
      values.newPassword !== values.confirmPassword
    ) {
      allValid = false;
      setFieldError(confirmPasswordInput.closest('.field'), 'Passwords do not match.');
    }

    if (!allValid) {
      showFormBanner(statusRegion, {
        title: 'Password Validation Failed',
        message: 'Ensure your new password meets all requirements and matches confirmation.',
        variant: 'danger',
      });
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true, 'Updating Password...');

    try {
      const result = await updateCustomerPassword({ newPassword: values.newPassword });
      handleServiceResult(result, statusRegion);
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

export function initAuthAndContactPages() {
  initContactPage();
  initLoginPage();
  initRegisterPage();
  initForgotPasswordPage();
  initResetPasswordPage();
}
