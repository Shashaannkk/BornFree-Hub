/**
 * BONFREE-HUB Public Pages Interactive Controller (Phase 1A & Surveys)
 * Powers interactive loyalty card preview, FAQ accordion, scroll reveal, and customer surveys.
 */
import { el, qs, qsa } from '../core/dom.js';
import { createIcon } from '../core/icons.js';
import { showToast, createAlert } from '../components/toast.js';
import { clearFieldErrors, setButtonLoading, setFieldError, validateForm } from '../components/form.js';
import { submitSurveyResponse } from '../services/loyaltyService.js';

/**
 * Initializes the interactive 2x5 example loyalty card on `loyalty.html`.
 */
export function initInteractiveLoyaltyCard() {
  const cardGrid = qs('[data-interactive-stamps]');
  if (!cardGrid) return;

  const total = 10;
  let earned = Number(cardGrid.getAttribute('data-initial-stamps')) || 4;
  const countLabel = qs('[data-interactive-stamp-count]');
  const statusBanner = qs('[data-interactive-stamp-status]');
  const addBtn = qs('[data-stamp-add]');
  const resetBtn = qs('[data-stamp-reset]');

  const render = () => {
    cardGrid.replaceChildren();
    for (let i = 1; i <= total; i += 1) {
      const isEarned = i <= earned;
      const btn = el(
        'button',
        {
          type: 'button',
          className: `stamp-btn${isEarned ? ' is-earned' : ''}`,
          'aria-label': `Set stamp progress to ${i} of ${total}`,
          'aria-pressed': String(isEarned),
          onClick: () => {
            earned = i === earned ? i - 1 : i;
            render();
            if (earned === total) {
              showToast({
                message: '10/10 Stamps reached — ₹500 Loyalty Reward unlocked!',
                variant: 'success',
              });
            }
          },
        },
        [isEarned ? createIcon('check', { size: 14 }) : el('span', { text: String(i) })],
      );
      cardGrid.appendChild(btn);
    }

    if (countLabel) {
      countLabel.textContent = `${earned} / ${total} Stamps`;
    }
    if (statusBanner) {
      const remaining = total - earned;
      statusBanner.textContent =
        remaining === 0
          ? 'Reward Unlocked: Redeem your ₹500 BONFREE-HUB voucher!'
          : `${remaining} more ${remaining === 1 ? 'stamp' : 'stamps'} to unlock a ₹500 voucher.`;
    }
  };

  addBtn?.addEventListener('click', () => {
    if (earned < total) {
      earned += 1;
      render();
      if (earned === total) {
        showToast({
          message: '10/10 Stamps reached — ₹500 Loyalty Reward unlocked!',
          variant: 'success',
        });
      }
    }
  });

  resetBtn?.addEventListener('click', () => {
    earned = 0;
    render();
  });

  render();
}

/**
 * Accessible FAQ accordion on `loyalty.html`.
 */
export function initFaqAccordion() {
  const triggers = qsa('[data-faq-trigger]');
  for (const trigger of triggers) {
    trigger.addEventListener('click', () => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      const panelId = trigger.getAttribute('aria-controls');
      const panel = panelId ? document.getElementById(panelId) : null;

      trigger.setAttribute('aria-expanded', String(!expanded));
      if (panel) {
        panel.hidden = expanded;
      }
    });
  }
}

/**
 * Subtle scroll reveal observer respecting `prefers-reduced-motion`.
 */
export function initScrollReveals() {
  const items = qsa('[data-reveal]');
  if (items.length === 0) return;

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReduced || typeof IntersectionObserver === 'undefined') {
    for (const item of items) item.classList.add('is-visible');
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12 },
  );

  for (const item of items) {
    observer.observe(item);
  }
}

/**
 * Initializes responsive customer-facing survey (`survey.html`).
 */
export function initCustomerSurveyPage() {
  const form = qs('#customer-survey-form');
  if (!form) return;

  const ratingInput = qs('#survey-rating-value');
  const starBtns = qsa('[data-survey-star]');
  const statusRegion = qs('#survey-status-region');

  for (const btn of starBtns) {
    btn.addEventListener('click', () => {
      const val = Number(btn.getAttribute('data-survey-star'));
      if (ratingInput) ratingInput.value = String(val);
      for (const s of starBtns) {
        const sVal = Number(s.getAttribute('data-survey-star'));
        const active = sVal <= val;
        s.classList.toggle('is-selected', active);
        s.setAttribute('aria-pressed', String(active));
      }
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    statusRegion?.replaceChildren();
    clearFieldErrors(form);
    const { valid, values } = validateForm(form);
    let ok = valid;

    if (!ratingInput?.value) {
      ok = false;
      setFieldError(ratingInput?.closest('.field'), 'Please choose a star rating.');
    }

    if (!ok) {
      statusRegion?.appendChild(
        createAlert({
          variant: 'danger',
          title: 'Complete Required Questions',
          message: 'Please answer the rating and required survey questions before submitting.',
        }),
      );
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true, 'Submitting...');
    try {
      const res = await submitSurveyResponse({
        surveyId: 'srv-streetwear-2025',
        rating: Number(ratingInput.value),
        ...values,
      });
      if (!res.ok) {
        statusRegion?.appendChild(
          createAlert({
            variant: 'warning',
            title: 'Backend Connection Pending (Phase 3)',
            message: res.message,
          }),
        );
        showToast({ message: res.message, variant: 'warning' });
      }
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}
