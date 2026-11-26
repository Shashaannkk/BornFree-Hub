/**
 * BONFREE-HUB Customer Portal & Dashboard Controller (Phase 1C)
 */
import { clearElement, el, qs } from '../core/dom.js';
import { createIcon } from '../core/icons.js';
import { createMembershipQrSvg } from '../core/qr.js';
import { createStore } from '../core/state.js';
import { renderSidebarNav } from '../components/navbar.js';
import { confirmModal, openModal, closeModal } from '../components/modal.js';
import { createAlert, showToast } from '../components/toast.js';
import { createStatusBadge, renderDataTable } from '../components/table.js';
import { renderCardSkeleton } from '../components/loader.js';
import { setButtonLoading, validateForm } from '../components/form.js';
import {
  requireCustomerSession,
  signOutCustomer,
} from '../services/authService.js';
import {
  computeNextAvailableReward,
  fetchCustomerPortalData,
  requestRewardRedemption,
  submitSurveyResponse,
  updateCustomerProfile,
  updateMemberPreferences,
} from '../services/loyaltyService.js';
import { isSupabaseConfigured } from '../core/config.js';

const MEMBER_NAV_ITEMS = Object.freeze([
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'rewards', label: 'My Rewards', icon: 'gift' },
  { id: 'stamps', label: 'Stamp Activity', icon: 'stamp' },
  { id: 'purchases', label: 'Purchase History', icon: 'shopping-bag' },
  { id: 'profile', label: 'My Profile', icon: 'user' },
  { id: 'preferences', label: 'Preferences', icon: 'sliders' },
]);

const VALID_VIEWS = new Set(MEMBER_NAV_ITEMS.map((i) => i.id));

const portalStore = createStore({
  activeView: 'dashboard',
  selectedCardId: null,
  viewMode: 'ready', // 'ready' | 'loading' | 'empty' | 'error'
  rewardFilter: 'all', // 'all' | 'available' | 'locked' | 'redeemed'
  stampFilter: 'all', // 'all' | 'earned' | 'redeemed'
  stampPage: 1,
  purchaseQuery: '',
  purchaseStatus: 'all', // 'all' | 'qualifying' | 'not-qualifying'
  purchasePage: 1,
  data: null,
  errorMessage: '',
});

function createSkylineSvg() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 240 92');
  svg.setAttribute('class', 'digital-pass__skyline');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.4');
  svg.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS(ns, 'path');
  path.setAttribute(
    'd',
    'M0 92V56h18v36M22 92V34h24v58M30 34V22h8v12M50 92V44h20v48M76 92V14h30v78M91 14V4M112 92V40h22v52M140 92V26h26v66M172 92V48h20v44M198 92V38h24v54',
  );
  svg.appendChild(path);
  return svg;
}

async function copyMembershipId(code) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(code);
    }
    showToast({ message: `Membership ID ${code} copied.`, variant: 'success' });
  } catch {
    showToast({ message: `Membership ID: ${code}`, variant: 'info' });
  }
}

function createDigitalPassCard(member, activeCard, { showCopy = false } = {}) {
  const qrPayload = member.qrToken || member.membershipCode;
  const qrSvg = createMembershipQrSvg(qrPayload);

  const infoCol = el('div', { className: 'digital-pass__info' }, [
    el('div', {}, [
      el('div', { className: 'loyalty-card__brand', text: 'BONFREE-HUB' }),
      el('div', {
        className: 'loyalty-card__sub',
        text: `${activeCard.programmeName.toUpperCase()} · ${activeCard.status.toUpperCase()}`,
      }),
    ]),
    el('div', { className: 'stack', style: 'gap: 0.25rem;' }, [
      el('div', { className: 'loyalty-card__name', text: member.firstName }),
      el('div', { className: 'cluster', style: 'gap: 0.4rem;' }, [
        el('span', { className: 'loyalty-card__id', text: member.membershipCode }),
        showCopy
          ? el(
              'button',
              {
                type: 'button',
                className: 'btn btn--ghost btn--icon btn--sm',
                style: 'color: var(--color-white); width: 26px; height: 26px;',
                'aria-label': 'Copy Membership ID',
                onClick: () => copyMembershipId(member.membershipCode),
              },
              [createIcon('copy', { size: 13 })],
            )
          : null,
      ]),
    ]),
  ]);

  const qrCol = el('div', { className: 'digital-pass__qr-box' }, [
    qrSvg,
    el('span', { className: 'loyalty-card__qr-label', text: 'SCAN AT CHECKOUT' }),
  ]);

  return el('article', { className: 'digital-pass', 'aria-label': 'Digital Membership Card' }, [
    createSkylineSvg(),
    infoCol,
    qrCol,
  ]);
}

function createProgressCard(activeCard, rewards, onViewRewards, onRefresh) {
  const remaining = Math.max(0, activeCard.stampGoal - activeCard.collectedStamps);
  const pct = Math.min(100, Math.round((activeCard.collectedStamps / activeCard.stampGoal) * 100));
  const nextReward = computeNextAvailableReward(
    activeCard.collectedStamps,
    rewards,
    activeCard.programmeId,
  );

  const cardStatusTone =
    activeCard.status === 'completed'
      ? 'active'
      : activeCard.status === 'expired'
      ? 'danger'
      : 'neutral';
  const cardStatusLabel =
    activeCard.status === 'completed'
      ? 'Completed Card'
      : activeCard.status === 'expired'
      ? 'Programme Expired'
      : 'Active Card';

  const stampRow = el('div', {
    className: 'progress-card__stamps',
    role: 'img',
    'aria-label': `${activeCard.collectedStamps} of ${activeCard.stampGoal} stamps collected`,
  });

  for (let i = 1; i <= activeCard.stampGoal; i += 1) {
    const earned = i <= activeCard.collectedStamps;
    stampRow.appendChild(
      el('span', { className: `stamp-badge-circle${earned ? ' is-earned' : ''}` }, [
        createIcon(earned ? 'check' : 'stamp', { size: 14 }),
      ]),
    );
  }

  return el('article', { className: 'progress-card' }, [
    el('div', { className: 'between', style: 'flex-wrap: wrap;' }, [
      el('span', { className: 'eyebrow', text: 'YOUR LOYALTY PROGRESS' }),
      el('div', { className: 'cluster' }, [
        createStatusBadge(cardStatusLabel, cardStatusTone),
        el('span', { className: 'badge badge--neutral', text: `${activeCard.programmeName} · ${activeCard.programmeRule}` }),
        el(
          'button',
          {
            type: 'button',
            className: 'btn btn--outline-muted btn--sm',
            onClick: onRefresh,
            'aria-label': 'Refresh loyalty progress',
          },
          [el('span', { text: 'Refresh' })],
        ),
      ]),
    ]),
    stampRow,
    el('div', { className: 'stack', style: 'gap: 0.5rem;' }, [
      el('div', { className: 'between' }, [
        el('strong', {
          className: 'page-title',
          style: 'font-size: 1.5rem;',
          text: `${activeCard.collectedStamps}/${activeCard.stampGoal} Stamps`,
        }),
        el('span', {
          className: 'text-xs text-muted',
          text: `${activeCard.collectedStamps} collected · ${remaining} remaining`,
        }),
      ]),
      el('div', { className: 'progress-track', role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100' }, [
        el('div', { className: 'progress-track__fill', style: `width: ${pct}%;` }),
      ]),
    ]),
    el(
      'button',
      {
        type: 'button',
        className: 'next-reward-callout',
        onClick: onViewRewards,
      },
      [
        el('div', { className: 'cluster', style: 'flex-wrap: nowrap;' }, [
          createIcon('gift', { size: 20 }),
          el('div', {}, [
            el('div', { className: 'text-xs text-muted', text: 'Next Available Reward' }),
            el('strong', { className: 'text-sm', text: nextReward.message }),
          ]),
        ]),
        createIcon('chevron-right', { size: 16 }),
      ],
    ),
  ]);
}

function openMemberSurveyModal(survey) {
  const statusRegion = el('div', { 'aria-live': 'polite' });
  const answers = {};
  let selectedRating = null;

  const form = el('form', { className: 'form-stack', novalidate: true }, [
    statusRegion,
    survey.subtitle ? el('p', { className: 'text-sm text-muted', text: survey.subtitle }) : null,
    ...(survey.questions || []).map((q, idx) => {
      const label = el('label', {
        className: 'field__label',
        text: `${idx + 1}. ${q.prompt}${q.isRequired ? ' *' : ''}`,
      });

      if (q.type === 'rating') {
        const starRow = el('div', { className: 'cluster' });
        const buttons = [1, 2, 3, 4, 5].map((star) =>
          el('button', {
            type: 'button',
            className: 'btn btn--outline-muted btn--sm',
            text: `${star} ★`,
            onClick: () => {
              selectedRating = star;
              answers[q.id] = star;
              buttons.forEach((b, i) => {
                b.className = i + 1 <= star ? 'btn btn--primary btn--sm' : 'btn btn--outline-muted btn--sm';
              });
            },
          }),
        );
        starRow.append(...buttons);
        return el('div', { className: 'field' }, [label, starRow]);
      }

      if (q.type === 'multiple_choice') {
        const select = el(
          'select',
          {
            className: 'select',
            name: q.id,
            required: Boolean(q.isRequired),
          },
          [
            el('option', { value: '', text: 'Select an option' }),
            ...(q.options || []).map((opt) => el('option', { value: opt, text: opt })),
          ],
        );
        select.addEventListener('change', () => {
          answers[q.id] = select.value;
          answers.favoriteCollection = answers.favoriteCollection || select.value;
        });
        return el('div', { className: 'field' }, [label, select]);
      }

      if (q.type === 'long_answer') {
        const area = el('textarea', {
          className: 'textarea',
          name: q.id,
          placeholder: 'Share your feedback...',
          required: Boolean(q.isRequired),
        });
        area.addEventListener('input', () => {
          answers[q.id] = area.value;
        });
        return el('div', { className: 'field' }, [label, area]);
      }

      const inp = el('input', {
        type: 'text',
        className: 'input',
        name: q.id,
        placeholder: 'Your answer...',
        required: Boolean(q.isRequired),
      });
      inp.addEventListener('input', () => {
        answers[q.id] = inp.value;
      });
      return el('div', { className: 'field' }, [label, inp]);
    }),
  ]);

  const submitBtn = el('button', {
    type: 'button',
    className: 'btn btn--primary',
    text: 'Submit Survey Response',
    onClick: async () => {
      clearElement(statusRegion);
      const { valid } = validateForm(form);
      const hasRatingQ = (survey.questions || []).some((q) => q.type === 'rating' && q.isRequired);
      if (!valid || (hasRatingQ && !selectedRating)) {
        statusRegion.appendChild(
          createAlert({
            variant: 'danger',
            title: 'Required Questions Incomplete',
            message: 'Complete all required rating and feedback questions before submitting.',
          }),
        );
        return;
      }

      setButtonLoading(submitBtn, true, 'Submitting...');
      const res = await submitSurveyResponse({
        surveyId: survey.id,
        rating: selectedRating,
        answers,
      });
      setButtonLoading(submitBtn, false);

      if (!res.ok) {
        statusRegion.appendChild(
          createAlert({
            variant: res.code === 'SUPABASE_NOT_CONFIGURED' ? 'warning' : 'danger',
            title: res.code === 'SUPABASE_NOT_CONFIGURED' ? 'Backend Connection Required' : 'Submission Rejected',
            message: res.message,
          }),
        );
        showToast({ message: res.message, variant: res.code === 'SUPABASE_NOT_CONFIGURED' ? 'warning' : 'danger' });
      } else {
        closeModal();
        showToast({ message: res.message, variant: 'success', durationMs: 5000 });
        await loadPortalData();
      }
    },
  });

  openModal({
    title: survey.title,
    body: form,
    footerActions: [
      el('button', { type: 'button', className: 'btn btn--outline-muted', text: 'Cancel', onClick: closeModal }),
      submitBtn,
    ],
  });
}

function renderDashboardOverview(container, data, navigateTo) {
  const { member, cards = [], rewards, purchases, stampActivity, campaigns = [], surveys = [] } = data;
  const { selectedCardId } = portalStore.getState();
  const activeCard =
    cards.find((c) => c.id === selectedCardId) ||
    cards[0] || {
      id: 'default',
      programmeId: null,
      programmeName: member.programmeName,
      programmeRule: member.programmeRule,
      stampGoal: member.stampGoal,
      collectedStamps: member.collectedStamps,
      status: 'active',
    };

  const recentRewards = rewards.filter((r) => r.status === 'redeemed').slice(0, 3);
  const recentPurchases = purchases.slice(0, 3);
  const recentStamps = stampActivity.slice(0, 3);

  const cardSwitcher =
    cards.length > 1
      ? el('div', { className: 'between', style: 'flex-wrap: wrap;' }, [
          el('span', { className: 'text-xs text-muted', text: `Enrolled Loyalty Programmes (${cards.length})` }),
          el(
            'div',
            { className: 'segmented', role: 'tablist', 'aria-label': 'Switch loyalty programme card' },
            cards.map((c) =>
              el('button', {
                type: 'button',
                role: 'tab',
                'aria-selected': String(c.id === activeCard.id),
                className: `segmented__btn${c.id === activeCard.id ? ' is-active' : ''}`,
                text: `${c.programmeName} (${c.collectedStamps}/${c.stampGoal})`,
                onClick: () => {
                  portalStore.setState({ selectedCardId: c.id });
                  renderPortalContent();
                },
              }),
            ),
          ),
        ])
      : null;

  const topHero = el('div', { className: 'member-card-hero' }, [
    createDigitalPassCard(member, activeCard, { showCopy: true }),
    createProgressCard(activeCard, rewards, () => navigateTo('rewards'), () => loadPortalData()),
  ]);

  const rewardCard = el('section', { className: 'feed-card' }, [
    el('div', { className: 'between' }, [
      el('h3', { className: 'card__title', text: 'Reward History' }),
      el('button', {
        type: 'button',
        className: 'auth-link',
        text: 'View All >',
        onClick: () => navigateTo('rewards'),
      }),
    ]),
    el(
      'div',
      { className: 'feed-list' },
      recentRewards.map((item) =>
        el('div', { className: 'feed-item' }, [
          el('div', { className: 'feed-item__left' }, [
            el('span', { className: 'feed-item__thumb' }, [createIcon('gift', { size: 16 })]),
            el('div', { style: 'min-width: 0;' }, [
              el('div', { className: 'feed-item__title', text: item.title }),
              el('div', { className: 'text-xs text-muted', text: `Redeemed on ${item.redeemedAt}` }),
            ]),
          ]),
          createStatusBadge('Redeemed', 'neutral'),
        ]),
      ),
    ),
  ]);

  const purchaseCard = el('section', { className: 'feed-card' }, [
    el('div', { className: 'between' }, [
      el('h3', { className: 'card__title', text: 'Purchase History' }),
      el('button', {
        type: 'button',
        className: 'auth-link',
        text: 'View All >',
        onClick: () => navigateTo('purchases'),
      }),
    ]),
    el(
      'div',
      { className: 'feed-list' },
      recentPurchases.map((p) =>
        el('div', { className: 'feed-item' }, [
          el('div', { className: 'feed-item__left' }, [
            el('span', { className: 'feed-item__thumb' }, [createIcon('shirt', { size: 16 })]),
            el('div', { style: 'min-width: 0;' }, [
              el('div', { className: 'feed-item__title', text: p.itemName }),
              el('div', { className: 'text-xs text-muted', text: p.date }),
            ]),
          ]),
          el('strong', { className: 'text-sm', text: `₹${p.amountInr.toLocaleString('en-IN')}` }),
        ]),
      ),
    ),
  ]);

  const stampCard = el('section', { className: 'feed-card' }, [
    el('div', { className: 'between' }, [
      el('h3', { className: 'card__title', text: 'Stamp Activity' }),
      el('button', {
        type: 'button',
        className: 'auth-link',
        text: 'View All >',
        onClick: () => navigateTo('stamps'),
      }),
    ]),
    el(
      'div',
      { className: 'feed-list' },
      recentStamps.map((s) =>
        el('div', { className: 'feed-item' }, [
          el('div', { className: 'feed-item__left' }, [
            el('span', { className: 'feed-item__thumb' }, [createIcon('stamp', { size: 16 })]),
            el('div', { style: 'min-width: 0;' }, [
              el('div', { className: 'feed-item__title', text: s.title }),
              el('div', {
                className: 'text-xs text-muted',
                text: s.amountInr ? `Purchase: ₹${s.amountInr.toLocaleString('en-IN')}` : s.receiptNo,
              }),
            ]),
          ]),
          el('span', { className: 'text-xs text-muted', text: s.date }),
        ]),
      ),
    ),
  ]);

  const campaignsCard = el('section', { className: 'feed-card' }, [
    el('div', { className: 'between' }, [
      el('h3', { className: 'card__title', text: 'Active Member Promotions' }),
      el('span', { className: 'badge badge--dark', text: `${campaigns.length} Live` }),
    ]),
    campaigns.length > 0
      ? el(
          'div',
          { className: 'feed-list' },
          campaigns.slice(0, 3).map((camp) =>
            el('div', { className: 'feed-item' }, [
              el('div', { className: 'feed-item__left' }, [
                el('span', { className: 'feed-item__thumb' }, [createIcon('tag', { size: 16 })]),
                el('div', { style: 'min-width: 0;' }, [
                  el('div', { className: 'feed-item__title', text: camp.title }),
                  el('div', {
                    className: 'text-xs text-muted',
                    text: `${camp.rule} · Ends ${camp.endDate}`,
                  }),
                ]),
              ]),
              createStatusBadge(camp.programmeName || 'Eligible', 'active'),
            ]),
          ),
        )
      : el('p', { className: 'text-xs text-muted', text: 'No active seasonal campaigns right now.' }),
  ]);

  const surveysCard = el('section', { className: 'feed-card' }, [
    el('div', { className: 'between' }, [
      el('h3', { className: 'card__title', text: 'Member Feedback Surveys' }),
      el('a', { href: 'survey.html', className: 'auth-link', text: 'Survey Page >' }),
    ]),
    surveys.length > 0
      ? el(
          'div',
          { className: 'feed-list' },
          surveys.slice(0, 3).map((sv) =>
            el('div', { className: 'feed-item' }, [
              el('div', { className: 'feed-item__left' }, [
                el('span', { className: 'feed-item__thumb' }, [createIcon('star', { size: 16 })]),
                el('div', { style: 'min-width: 0;' }, [
                  el('div', { className: 'feed-item__title', text: sv.title }),
                  el('div', { className: 'text-xs text-muted', text: `${(sv.questions || []).length} questions` }),
                ]),
              ]),
              sv.submitted
                ? createStatusBadge('Completed', 'neutral')
                : el('button', {
                    type: 'button',
                    className: 'btn btn--primary btn--sm',
                    text: 'Take Survey',
                    onClick: () => openMemberSurveyModal(sv),
                  }),
            ]),
          ),
        )
      : el('p', { className: 'text-xs text-muted', text: 'No open feedback surveys at the moment.' }),
  ]);

  const engagementGrid = el('div', { className: 'grid grid-2' }, [campaignsCard, surveysCard]);

  if (cardSwitcher) {
    container.append(cardSwitcher, topHero, el('div', { className: 'member-feeds-grid' }, [rewardCard, purchaseCard, stampCard]), engagementGrid);
  } else {
    container.append(topHero, el('div', { className: 'member-feeds-grid' }, [rewardCard, purchaseCard, stampCard]), engagementGrid);
  }
}

async function copyTextWithToast(text, label = 'Copied') {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    }
    showToast({ message: `${label}: ${text}`, variant: 'success' });
  } catch {
    showToast({ message: `${label}: ${text}`, variant: 'info' });
  }
}

function handleRedeemClick(reward) {
  const statusRegion = el('div', { 'aria-live': 'polite' });
  const idempotencyKey =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? `rdm-${reward.id}-${crypto.randomUUID().slice(0, 8)}`
      : `rdm-${reward.id}-${Math.random().toString(36).slice(2, 10)}`;

  const confirmBtn = el('button', {
    type: 'button',
    className: 'btn btn--primary',
    text: `Generate Voucher (-${reward.requiredStamps} Stamps)`,
    onClick: async () => {
      clearElement(statusRegion);
      setButtonLoading(confirmBtn, true, 'Requesting...');
      const res = await requestRewardRedemption({ rewardId: reward.id, idempotencyKey });
      setButtonLoading(confirmBtn, false);

      if (!res.ok) {
        statusRegion.appendChild(
          createAlert({
            variant: res.code === 'SUPABASE_NOT_CONFIGURED' ? 'warning' : 'danger',
            title: res.code === 'NETWORK_ERROR' ? 'Connection Interrupted — Retry Safely' : 'Unable to Redeem',
            message: res.message,
          }),
        );
        showToast({
          message: res.message,
          variant: res.code === 'SUPABASE_NOT_CONFIGURED' ? 'warning' : 'danger',
          durationMs: 5000,
        });
        return;
      }

      closeModal();
      const voucher = res.result?.voucher_code;
      showToast({
        message: voucher ? `Voucher ${voucher} generated and active!` : res.message,
        variant: 'success',
        durationMs: 6000,
      });
      await loadPortalData();
    },
  });

  openModal({
    title: `Redeem — ${reward.title}`,
    body: el('div', { className: 'stack' }, [
      statusRegion,
      el('p', {
        className: 'text-sm text-muted',
        text: `Confirming deducts ${reward.requiredStamps} stamps server-side from your card and generates a single-use checkout voucher code.`,
      }),
      createAlert({
        variant: 'info',
        title: 'Atomic Voucher Protection',
        message: 'If store staff reject an unused pending voucher, your spent stamps are refunded to your card ledger.',
      }),
    ]),
    footerActions: [
      el('button', {
        type: 'button',
        className: 'btn btn--outline-muted',
        text: 'Cancel',
        onClick: closeModal,
      }),
      confirmBtn,
    ],
  });
}

function renderRewardsView(container, data) {
  const { member, rewards } = data;
  const { rewardFilter } = portalStore.getState();

  const filters = [
    { id: 'all', label: `All (${rewards.length})` },
    { id: 'available', label: `Available (${rewards.filter((r) => r.status === 'available').length})` },
    { id: 'pending', label: `Active Vouchers (${rewards.filter((r) => r.status === 'pending').length})` },
    { id: 'locked', label: `Locked (${rewards.filter((r) => r.status === 'locked').length})` },
    {
      id: 'redeemed',
      label: `History (${rewards.filter((r) => r.status === 'redeemed' || r.status === 'expired' || r.status === 'rejected').length})`,
    },
  ];

  const segmented = el(
    'div',
    { className: 'segmented', role: 'tablist', 'aria-label': 'Filter rewards' },
    filters.map((f) =>
      el('button', {
        type: 'button',
        role: 'tab',
        'aria-selected': String(f.id === rewardFilter),
        className: `segmented__btn${f.id === rewardFilter ? ' is-active' : ''}`,
        text: f.label,
        onClick: () => {
          portalStore.setState({ rewardFilter: f.id });
          renderPortalContent();
        },
      }),
    ),
  );

  const visible =
    rewardFilter === 'all'
      ? rewards
      : rewardFilter === 'redeemed'
      ? rewards.filter((r) => r.status === 'redeemed' || r.status === 'expired' || r.status === 'rejected')
      : rewards.filter((r) => r.status === rewardFilter);

  const grid = el(
    'div',
    { className: 'rewards-grid' },
    visible.map((rw) => {
      const isPending = rw.status === 'pending';
      const isLocked = rw.status === 'locked';
      const isHistory = rw.status === 'redeemed' || rw.status === 'expired' || rw.status === 'rejected';
      const badgeTone =
        rw.status === 'available'
          ? 'active'
          : isPending || isLocked
          ? 'warning'
          : rw.status === 'rejected'
          ? 'danger'
          : 'neutral';
      const badgeLabel =
        rw.status === 'available'
          ? 'Unlocked'
          : isPending
          ? 'Active Voucher'
          : isLocked
          ? 'Locked'
          : rw.status === 'expired'
          ? 'Expired'
          : rw.status === 'rejected'
          ? 'Rejected'
          : 'Redeemed';
      const baseStamps = rw.cardStamps ?? member.collectedStamps;
      const stampsNeeded = Math.max(0, rw.requiredStamps - baseStamps);

      return el('article', { className: `reward-item-card${isLocked ? ' is-locked' : ''}` }, [
        el('div', { className: 'stack', style: 'gap: 0.75rem;' }, [
          el('div', { className: 'between' }, [
            el('div', { className: 'cluster' }, [
              createIcon('gift', { size: 18 }),
              el('span', { className: 'badge badge--dark', text: `${rw.requiredStamps} Stamps` }),
            ]),
            createStatusBadge(badgeLabel, badgeTone),
          ]),
          el('div', {}, [
            el('h3', { className: 'card__title', text: rw.title }),
            el('p', { className: 'text-sm text-muted', style: 'margin-top: 0.25rem;', text: rw.description }),
          ]),
          rw.voucherCode
            ? el('div', { className: 'between', style: 'gap: 0.5rem; flex-wrap: wrap;' }, [
                el('div', { className: 'cluster' }, [
                  el('span', { className: 'text-xs text-muted', text: 'Voucher Code:' }),
                  el('span', { className: 'voucher-code-chip', text: rw.voucherCode }),
                ]),
                isPending
                  ? el('button', {
                      type: 'button',
                      className: 'btn btn--outline-muted btn--sm',
                      text: 'Copy Code',
                      onClick: () => copyTextWithToast(rw.voucherCode, 'Voucher Code copied'),
                    })
                  : null,
              ])
            : null,
          el('div', { className: 'text-xs text-muted', text: rw.validityText }),
        ]),
        isHistory
          ? el('div', { className: 'text-xs text-muted', text: rw.validityText })
          : isPending
          ? el('div', { className: 'text-xs text-muted', text: 'Present this voucher code to staff at checkout.' })
          : isLocked
          ? el('button', {
              type: 'button',
              className: 'btn btn--outline-muted btn--block',
              disabled: true,
              text: rw.lockReason || `Need ${stampsNeeded} more ${stampsNeeded === 1 ? 'stamp' : 'stamps'} to unlock`,
            })
          : el('button', {
              type: 'button',
              className: 'btn btn--primary btn--block',
              text: 'Redeem Reward',
              onClick: () => handleRedeemClick(rw),
            }),
      ]);
    }),
  );

  container.append(
    el('div', { className: 'between', style: 'flex-wrap: wrap;' }, [
      el('div', {}, [
        el('h2', { className: 'page-title', text: 'My Rewards' }),
        el('p', {
          className: 'text-sm text-muted',
          text: `Current balance: ${member.collectedStamps}/${member.stampGoal} stamps · ${member.stampExpiryNote}`,
        }),
      ]),
      segmented,
    ]),
    grid,
  );
}

function renderStampActivityView(container, data) {
  const { stampFilter, stampPage } = portalStore.getState();
  const filtered =
    stampFilter === 'all'
      ? data.stampActivity
      : data.stampActivity.filter((item) => item.type === stampFilter);

  const pageSize = 4;
  const slice = filtered.slice((stampPage - 1) * pageSize, stampPage * pageSize);

  const tableHost = el('div');
  renderDataTable(tableHost, {
    rows: slice,
    page: stampPage,
    pageSize,
    totalItems: filtered.length,
    emptyMessage: 'No stamp activity records found for this filter.',
    onPageChange: (nextPage) => {
      portalStore.setState({ stampPage: nextPage });
      renderPortalContent();
    },
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'title', label: 'Activity' },
      { key: 'receiptNo', label: 'Reference' },
      {
        key: 'delta',
        label: 'Stamps Δ',
        render: (row) =>
          createStatusBadge(row.delta, row.type === 'earned' ? 'success' : 'neutral'),
      },
      { key: 'balanceAfter', label: 'Balance' },
    ],
  });

  const filterBar = el(
    'div',
    { className: 'segmented' },
    [
      { id: 'all', label: 'All Activity' },
      { id: 'earned', label: 'Earned' },
      { id: 'redeemed', label: 'Redeemed' },
    ].map((tab) =>
      el('button', {
        type: 'button',
        className: `segmented__btn${stampFilter === tab.id ? ' is-active' : ''}`,
        text: tab.label,
        onClick: () => {
          portalStore.setState({ stampFilter: tab.id, stampPage: 1 });
          renderPortalContent();
        },
      }),
    ),
  );

  container.append(
    el('div', { className: 'between', style: 'flex-wrap: wrap;' }, [
      el('div', {}, [
        el('h2', { className: 'page-title', text: 'Stamp Activity' }),
        el('p', { className: 'text-sm text-muted', text: 'Immutable ledger of earned and redeemed loyalty stamps.' }),
      ]),
      filterBar,
    ]),
    createAlert({
      variant: 'info',
      title: 'Read-Only Member Ledger',
      message: 'Stamps can only be credited or deducted by verified store staff and Edge Functions.',
    }),
    tableHost,
  );
}

function renderPurchaseHistoryView(container, data) {
  const { purchaseQuery, purchaseStatus, purchasePage } = portalStore.getState();

  const filtered = data.purchases.filter((p) => {
    const q = purchaseQuery.trim().toLowerCase();
    const matchesQ =
      !q ||
      p.itemName.toLowerCase().includes(q) ||
      p.receiptNo.toLowerCase().includes(q) ||
      p.store.toLowerCase().includes(q);
    const matchesStatus =
      purchaseStatus === 'all' ||
      (purchaseStatus === 'qualifying' && p.qualifying) ||
      (purchaseStatus === 'not-qualifying' && !p.qualifying);
    return matchesQ && matchesStatus;
  });

  const pageSize = 4;
  const slice = filtered.slice((purchasePage - 1) * pageSize, purchasePage * pageSize);

  const searchInput = el('input', {
    type: 'search',
    className: 'input',
    placeholder: 'Search item, receipt #, or store...',
    value: purchaseQuery,
    'aria-label': 'Search purchases',
  });
  searchInput.addEventListener('input', (e) => {
    portalStore.setState({ purchaseQuery: e.target.value, purchasePage: 1 });
    renderPortalContent();
  });

  const statusSelect = el(
    'select',
    { className: 'select', 'aria-label': 'Filter by qualifying status' },
    [
      el('option', { value: 'all', text: 'All Purchases', selected: purchaseStatus === 'all' }),
      el('option', { value: 'qualifying', text: 'Qualifying Only', selected: purchaseStatus === 'qualifying' }),
      el('option', { value: 'not-qualifying', text: 'Not Qualifying', selected: purchaseStatus === 'not-qualifying' }),
    ],
  );
  statusSelect.addEventListener('change', (e) => {
    portalStore.setState({ purchaseStatus: e.target.value, purchasePage: 1 });
    renderPortalContent();
  });

  const tableHost = el('div');
  renderDataTable(tableHost, {
    rows: slice,
    page: purchasePage,
    pageSize,
    totalItems: filtered.length,
    emptyMessage: 'No purchase records match your search or filter.',
    onPageChange: (nextPage) => {
      portalStore.setState({ purchasePage: nextPage });
      renderPortalContent();
    },
    columns: [
      { key: 'receiptNo', label: 'Receipt No.' },
      { key: 'date', label: 'Date' },
      {
        key: 'itemName',
        label: 'Item & Store',
        render: (row) =>
          el('div', {}, [
            el('div', { className: 'text-sm', style: 'font-weight: 500;', text: row.itemName }),
            el('div', { className: 'text-xs text-muted', text: `${row.category} · ${row.store}` }),
          ]),
      },
      {
        key: 'amountInr',
        label: 'Amount',
        render: (row) => `₹${row.amountInr.toLocaleString('en-IN')}`,
      },
      {
        key: 'qualifying',
        label: 'Qualification',
        render: (row) =>
          createStatusBadge(
            row.qualifying ? `Qualifying (+${row.stampsAwarded})` : 'Not Qualifying',
            row.qualifying ? 'active' : 'inactive',
          ),
      },
    ],
  });

  container.append(
    el('div', { className: 'between', style: 'flex-wrap: wrap;' }, [
      el('div', {}, [
        el('h2', { className: 'page-title', text: 'Purchase History' }),
        el('p', { className: 'text-sm text-muted', text: 'Recorded in-store and verified streetwear purchases.' }),
      ]),
    ]),
    el('div', { className: 'card grid grid-2', style: 'padding: 1rem;' }, [searchInput, statusSelect]),
    tableHost,
  );
}

function renderProfileView(container, data) {
  const { member } = data;
  const protectedRows = [
    ['Membership ID', member.membershipCode],
    ['Email Address', member.email],
    ['Member Since', member.joinedDate],
    ['Active Programme', `${member.programmeName} (${member.programmeRule})`],
    ['Verified Stamp Balance', `${member.collectedStamps} / ${member.stampGoal} Stamps (Read-Only)`],
  ];

  const statusRegion = el('div', { 'aria-live': 'polite' });
  const editForm = el('form', { className: 'card form-stack', id: 'member-profile-form', novalidate: true }, [
    el('h3', { className: 'card__title', text: 'Personal Details' }),
    statusRegion,
    el('div', { className: 'grid grid-3' }, [
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'prof-name', text: 'Full Name *' }),
        el('input', {
          id: 'prof-name',
          name: 'fullName',
          type: 'text',
          className: 'input',
          value: member.fullName,
          minlength: '2',
          required: true,
        }),
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'prof-mobile', text: 'Mobile Number' }),
        el('input', {
          id: 'prof-mobile',
          name: 'mobile',
          type: 'tel',
          className: 'input',
          value: member.mobile || '',
          placeholder: '+91 98765 43210',
        }),
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'prof-birth-month', text: 'Birth Month (Optional)' }),
        el(
          'select',
          { id: 'prof-birth-month', name: 'birthMonth', className: 'select' },
          [
            el('option', { value: '', text: 'Select month' }),
            ...[
              'January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December',
            ].map((m, idx) =>
              el('option', {
                value: String(idx + 1),
                text: m,
                selected: Number(member.birthMonth) === idx + 1,
              }),
            ),
          ],
        ),
      ]),
    ]),
    el('div', { className: 'cluster', style: 'justify-content: flex-end;' }, [
      el('button', { type: 'submit', className: 'btn btn--primary', text: 'Save Profile' }),
    ]),
  ]);

  editForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearElement(statusRegion);
    const { valid, values } = validateForm(editForm);
    if (!valid) {
      statusRegion.appendChild(
        createAlert({ variant: 'danger', title: 'Validation Error', message: 'Enter a valid full name.' }),
      );
      return;
    }

    const submitBtn = editForm.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true, 'Saving...');
    try {
      const res = await updateCustomerProfile({
        fullName: values.fullName,
        mobile: values.mobile,
        birthMonth: values.birthMonth,
      });

      if (res.code === 'SESSION_EXPIRED') {
        window.location.href = 'login.html?reason=session_expired';
        return;
      }

      statusRegion.appendChild(
        createAlert({
          variant: res.ok ? 'success' : res.code === 'SUPABASE_NOT_CONFIGURED' ? 'warning' : 'danger',
          title: res.ok ? 'Profile Updated' : 'Update Status',
          message: res.message,
        }),
      );
      showToast({ message: res.message, variant: res.ok ? 'success' : 'warning' });
      if (res.ok) {
        loadPortalData();
      }
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  container.append(
    el('h2', { className: 'page-title', text: 'My Profile' }),
    createAlert({
      variant: 'info',
      title: 'Protected Membership Fields',
      message: 'Membership ID, stamp balance, and tier eligibility are read-only and enforced by PostgreSQL RLS.',
    }),
    editForm,
    el(
      'div',
      { className: 'card grid grid-2' },
      protectedRows.map(([label, val]) =>
        el('div', { className: 'stack', style: 'gap: 0.2rem;' }, [
          el('span', { className: 'text-xs text-muted', text: label }),
          el('strong', { className: 'text-sm', text: val }),
        ]),
      ),
    ),
  );
}

function renderPreferencesView(container, data) {
  const prefs = { ...data.preferences };

  const makeToggleRow = (key, title, desc) => {
    const input = el('input', { type: 'checkbox', checked: prefs[key] });
    input.addEventListener('change', () => {
      prefs[key] = input.checked;
    });
    return el('div', { className: 'between', style: 'padding-block: 0.75rem; border-bottom: 1px solid var(--border-subtle);' }, [
      el('div', {}, [
        el('strong', { className: 'text-sm', text: title }),
        el('div', { className: 'text-xs text-muted', text: desc }),
      ]),
      el('label', { className: 'switch', 'aria-label': title }, [
        input,
        el('span', { className: 'switch__track' }),
      ]),
    ]);
  };

  const saveBtn = el('button', {
    type: 'button',
    className: 'btn btn--primary',
    text: 'Save Preferences',
    onClick: async () => {
      setButtonLoading(saveBtn, true, 'Saving...');
      const res = await updateMemberPreferences(prefs);
      setButtonLoading(saveBtn, false);
      showToast({ message: res.message, variant: res.ok ? 'success' : 'warning', durationMs: 4500 });
    },
  });

  container.append(
    el('h2', { className: 'page-title', text: 'Preferences' }),
    el('div', { className: 'card stack' }, [
      makeToggleRow('earlyAccessDrops', 'Early Access to New Collections', 'Receive 48-hour previews before public streetwear drops.'),
      makeToggleRow('birthdayOffers', 'Birthday Month Privileges', 'Get notified when your birthday bonus stamp unlocks.'),
      makeToggleRow('voucherExpiryAlerts', 'Voucher Expiry Alerts', 'Reminders 14 days before an earned voucher expires.'),
      makeToggleRow('smsStampReceipts', 'SMS Stamp Confirmations', 'Receive instant SMS confirmation after in-store stamp credits.'),
      el('div', { className: 'cluster', style: 'justify-content: flex-end; padding-top: 0.5rem;' }, [saveBtn]),
    ]),
  );
}

function renderPortalContent() {
  const host = qs('#member-view-host');
  if (!host) return;
  clearElement(host);

  const { activeView, viewMode, data, errorMessage } = portalStore.getState();

  if (viewMode === 'loading') {
    host.append(
      renderCardSkeleton(2),
      el('div', { className: 'card' }, [renderCardSkeleton(3)]),
    );
    return;
  }

  if (viewMode === 'error') {
    host.append(
      createAlert({
        variant: 'danger',
        title: 'Unable to Load Loyalty Dashboard',
        message: errorMessage || 'A temporary error occurred while retrieving your membership card.',
      }),
      el('div', { className: 'cluster' }, [
        el('button', {
          type: 'button',
          className: 'btn btn--primary',
          text: 'Retry Loading',
          onClick: () => loadPortalData(),
        }),
      ]),
    );
    return;
  }

  if (viewMode === 'empty' || !data) {
    host.append(
      el('div', { className: 'card table-empty stack' }, [
        createIcon('gift', { size: 28 }),
        el('h3', { className: 'card__title', text: 'No Loyalty Activity Yet' }),
        el('p', {
          className: 'text-sm text-muted',
          text: 'Present your BONFREE-HUB Membership ID at checkout on your first purchase to start collecting stamps.',
        }),
      ]),
    );
    return;
  }

  const navigateTo = (nextView) => {
    if (!VALID_VIEWS.has(nextView)) return;
    portalStore.setState({ activeView: nextView });
    if (window.location.hash !== `#${nextView}`) {
      window.history.replaceState(null, '', `#${nextView}`);
    }
    syncNavHighlight();
    renderPortalContent();
  };

  if (activeView === 'dashboard') renderDashboardOverview(host, data, navigateTo);
  else if (activeView === 'rewards') renderRewardsView(host, data);
  else if (activeView === 'stamps') renderStampActivityView(host, data);
  else if (activeView === 'purchases') renderPurchaseHistoryView(host, data);
  else if (activeView === 'profile') renderProfileView(host, data);
  else if (activeView === 'preferences') renderPreferencesView(host, data);
}

function syncNavHighlight() {
  const { activeView } = portalStore.getState();

  const sidebarTarget = qs('#member-sidebar-nav');
  if (sidebarTarget) {
    renderSidebarNav(sidebarTarget, MEMBER_NAV_ITEMS, {
      activeId: activeView,
      onSelect: (id) => {
        portalStore.setState({ activeView: id });
        window.history.replaceState(null, '', `#${id}`);
        syncNavHighlight();
        renderPortalContent();
      },
    });
  }

  for (const btn of document.querySelectorAll('[data-member-view]')) {
    const target = btn.getAttribute('data-member-view');
    const isMatch = target === activeView || (target === 'profile' && activeView === 'preferences');
    btn.classList.toggle('is-active', isMatch);
    btn.setAttribute('aria-current', isMatch ? 'page' : 'false');
  }
}

async function handleSignOut() {
  const confirmed = await confirmModal({
    title: 'Sign Out of BONFREE-HUB',
    message: 'Are you sure you want to sign out of your customer loyalty account?',
    confirmLabel: 'Sign Out',
    cancelLabel: 'Stay Signed In',
  });
  if (confirmed) {
    await signOutCustomer();
    window.location.href = 'login.html';
  }
}

function hydrateBannerIdentity(data) {
  const { member, isDevelopmentFixture } = data;
  const nameEl = qs('#member-banner-name');
  const idEl = qs('#member-banner-id');
  const badgeEl = qs('#member-fixture-badge');
  const topNameEl = qs('#member-topbar-name');
  const topAvatarEl = qs('#member-topbar-avatar');

  if (nameEl) nameEl.textContent = member.firstName;
  if (idEl) idEl.textContent = member.membershipCode;
  if (topNameEl) topNameEl.textContent = member.firstName;
  if (topAvatarEl) topAvatarEl.textContent = (member.firstName || 'M')[0].toUpperCase();
  if (badgeEl) {
    badgeEl.textContent = isDevelopmentFixture
      ? 'Development Preview Data (Read-Only)'
      : 'Verified Loyalty Member';
    badgeEl.className = isDevelopmentFixture ? 'badge badge--neutral' : 'badge badge--active';
  }
}

async function loadPortalData() {
  portalStore.setState({ viewMode: 'loading' });
  renderPortalContent();

  const res = await fetchCustomerPortalData();
  if (!res.ok) {
    if (res.code === 'SESSION_EXPIRED' || res.code === 'NO_SESSION') {
      window.location.href = 'login.html?reason=session_expired';
      return;
    }
    portalStore.setState({ viewMode: 'error', errorMessage: res.message });
  } else {
    portalStore.setState({ viewMode: 'ready', data: res.data });
    hydrateBannerIdentity(res.data);
    const copyIdBtn = qs('#copy-member-id-btn');
    if (copyIdBtn && copyIdBtn.dataset.bound !== 'true') {
      copyIdBtn.dataset.bound = 'true';
      copyIdBtn.addEventListener('click', () => {
        const currentCode = portalStore.getState().data?.member.membershipCode || 'BF-001248';
        copyMembershipId(currentCode);
      });
    }
  }
  renderPortalContent();
}

export async function initCustomerDashboard() {
  const host = qs('#member-view-host');
  if (!host) return;

  const authGuard = await requireCustomerSession();
  if (!authGuard.ok) {
    window.location.href = authGuard.redirectUrl || 'login.html?reason=auth_required';
    return;
  }

  const reason = new URLSearchParams(window.location.search).get('reason');
  if (reason === 'unauthorized_admin') {
    showToast({
      message: 'Admin portal access is restricted to verified store & admin staff.',
      variant: 'warning',
      durationMs: 5000,
    });
  }

  const hashView = window.location.hash.replace('#', '');
  if (VALID_VIEWS.has(hashView)) {
    portalStore.setState({ activeView: hashView });
  }

  for (const btn of document.querySelectorAll('[data-member-view]')) {
    btn.addEventListener('click', () => {
      const nextView = btn.getAttribute('data-member-view');
      if (!VALID_VIEWS.has(nextView)) return;
      portalStore.setState({ activeView: nextView });
      window.history.replaceState(null, '', `#${nextView}`);
      syncNavHighlight();
      renderPortalContent();
    });
  }

  for (const btn of document.querySelectorAll('[data-preview-state]')) {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-preview-state');
      for (const b of document.querySelectorAll('[data-preview-state]')) {
        b.classList.toggle('is-active', b === btn);
      }
      portalStore.setState({
        viewMode: mode,
        errorMessage: mode === 'error' ? 'Simulated network error preview (Phase 1C QA state).' : '',
      });
      renderPortalContent();
    });
  }

  qs('#member-signout-btn')?.addEventListener('click', handleSignOut);
  qs('#member-drawer-signout')?.addEventListener('click', handleSignOut);

  // Mobile drawer for customer portal
  const drawer = qs('#member-mobile-drawer');
  const backdrop = qs('#member-drawer-backdrop');
  const setDrawer = (open) => {
    drawer?.classList.toggle('is-open', open);
    backdrop?.classList.toggle('is-open', open);
  };
  qs('#member-mobile-menu-btn')?.addEventListener('click', () => setDrawer(true));
  qs('#member-drawer-close')?.addEventListener('click', () => setDrawer(false));
  backdrop?.addEventListener('click', () => setDrawer(false));
  for (const link of drawer?.querySelectorAll('[data-member-view]') || []) {
    link.addEventListener('click', () => setDrawer(false));
  }

  syncNavHighlight();
  loadPortalData();

  if (isSupabaseConfigured()) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        loadPortalData();
      }
    });
  }
}
