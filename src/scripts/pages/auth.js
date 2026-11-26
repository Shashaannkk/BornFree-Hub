/**
 * BONFREE-HUB Contact & Customer Auth Pages Controller (Phase 4 Connected)
 */
import { clearElement, qs, qsa } from '../core/dom.js';
import { isSupabaseConfigured } from '../core/config.js';
import { supabaseAuth } from '../core/supabaseClient.js';
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

function handleServiceError(result, statusRegion) {
  if (result.ok) return;

  const isPendingConfig =
    result.code === 'SUPABASE_NOT_CONFIGURED' ||
    result.code === 'AUTH_CLIENT_PENDING' ||
    result.code === 'SERVICE_PENDING';

  const variant = isPendingConfig ? 'warning' : 'danger';
  const title = isPendingConfig
    ? 'Supabase Connection Pending'
    : result.code === 'DUPLICATE_ACCOUNT'
    ? 'Email Already Registered'
    : result.code === 'EMAIL_NOT_CONFIRMED'
    ? 'Email Verification Required'
    : result.code === 'SESSION_EXPIRED'
    ? 'Session Expired'
    : 'Unable to Proceed';

  showFormBanner(statusRegion, {
    title,
    message: result.message,
    variant,
  });

  showToast({ message: result.message, variant });
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

      if (result.ok) {
        form.reset();
        showFormBanner(statusRegion, {
          title: 'Message Sent',
          message: 'Thank you for contacting BONFREE-HUB. Our support team will reply shortly.',
          variant: 'success',
        });
        showToast({ message: 'Contact inquiry submitted.', variant: 'success' });
      } else {
        handleServiceError(result, statusRegion);
      }
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

function initLoginPage() {
  const form = qs('#login-form');
  if (!form) return;
  const statusRegion = qs('#form-status-region');

  // Consume redirect verification hash if Supabase redirected to login.html
  supabaseAuth.consumeAuthRedirectFromUrl();

  const reason = new URLSearchParams(window.location.search).get('reason');
  if (reason === 'verified') {
    showFormBanner(statusRegion, {
      title: 'Email Verified',
      message: 'Your email has been verified. Sign in below to access your digital loyalty card.',
      variant: 'success',
    });
  } else if (reason === 'session_expired') {
    showFormBanner(statusRegion, {
      title: 'Session Expired',
      message: 'Your session expired for security. Please sign in again.',
      variant: 'warning',
    });
  } else if (reason === 'auth_required') {
    showFormBanner(statusRegion, {
      title: 'Sign In Required',
      message: 'Please sign in to access your BONFREE-HUB customer dashboard.',
      variant: 'info',
    });
  } else if (reason === 'reset_success') {
    showFormBanner(statusRegion, {
      title: 'Password Updated',
      message: 'Your password was reset successfully. Sign in with your new password.',
      variant: 'success',
    });
  }

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

      if (result.ok) {
        showToast({ message: 'Signed in successfully.', variant: 'success' });
        window.location.href = 'customer-dashboard.html';
      } else {
        handleServiceError(result, statusRegion);
      }
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

function initRegisterPage() {
  const form = qs('#register-form');
  if (!form) return;
  const statusRegion = qs('#form-status-region');
  const emailInput = qs('#reg-email');
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

      if (result.ok) {
        if (result.requiresEmailVerification) {
          form.reset();
          showFormBanner(statusRegion, {
            title: 'Verify Your Email Address',
            message: result.message,
            variant: 'success',
          });
          showToast({ message: 'Verification email sent.', variant: 'success' });
        } else {
          showToast({ message: 'Membership created!', variant: 'success' });
          window.location.href = 'customer-dashboard.html';
        }
      } else {
        if (result.code === 'DUPLICATE_ACCOUNT' && emailInput) {
          setFieldError(emailInput.closest('.field'), 'This email is already registered.');
        }
        handleServiceError(result, statusRegion);
      }
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
      if (result.ok) {
        form.reset();
        showFormBanner(statusRegion, {
          title: 'Reset Link Sent',
          message: result.message,
          variant: 'success',
        });
        showToast({ message: 'Password recovery email sent.', variant: 'success' });
      } else {
        handleServiceError(result, statusRegion);
      }
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

  const redirectToken = supabaseAuth.consumeAuthRedirectFromUrl();
  if (isSupabaseConfigured() && !redirectToken.found && !supabaseAuth.getSession()) {
    showFormBanner(statusRegion, {
      title: 'Recovery Link Required',
      message: 'Open the password reset link sent to your email, or request a new reset link.',
      variant: 'warning',
    });
  }

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
      if (result.ok) {
        await supabaseAuth.signOut();
        window.location.href = 'login.html?reason=reset_success';
      } else {
        handleServiceError(result, statusRegion);
      }
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
