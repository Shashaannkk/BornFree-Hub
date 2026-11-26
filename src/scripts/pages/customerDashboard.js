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
import { setButtonLoading } from '../components/form.js';
import {
  fetchCustomerPortalData,
  requestRewardRedemption,
  updateMemberPreferences,
} from '../services/loyaltyService.js';

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

function createDigitalPassCard(member, { showCopy = false } = {}) {
  const qrSvg = createMembershipQrSvg(member.membershipCode);

  const infoCol = el('div', { className: 'digital-pass__info' }, [
    el('div', {}, [
      el('div', { className: 'loyalty-card__brand', text: 'BONFREE-HUB' }),
      el('div', { className: 'loyalty-card__sub', text: 'LOYALTY MEMBER' }),
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
                style: 'color: #ffffff; width: 26px; height: 26px;',
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

function createProgressCard(member, onViewRewards) {
  const remaining = Math.max(0, member.stampGoal - member.collectedStamps);
  const pct = Math.min(100, Math.round((member.collectedStamps / member.stampGoal) * 100));

  const stampRow = el('div', {
    className: 'progress-card__stamps',
    role: 'img',
    'aria-label': `${member.collectedStamps} of ${member.stampGoal} stamps collected`,
  });

  for (let i = 1; i <= member.stampGoal; i += 1) {
    const earned = i <= member.collectedStamps;
    stampRow.appendChild(
      el('span', { className: `stamp-badge-circle${earned ? ' is-earned' : ''}` }, [
        createIcon(earned ? 'check' : 'stamp', { size: 14 }),
      ]),
    );
  }

  return el('article', { className: 'progress-card' }, [
    el('div', { className: 'between' }, [
      el('span', { className: 'eyebrow', text: 'YOUR LOYALTY PROGRESS' }),
      el('span', { className: 'badge badge--neutral', text: `${member.programmeName} · ${member.programmeRule}` }),
    ]),
    stampRow,
    el('div', { className: 'stack', style: 'gap: 0.5rem;' }, [
      el('div', { className: 'between' }, [
        el('strong', {
          className: 'page-title',
          style: 'font-size: 1.5rem;',
          text: `${member.collectedStamps}/${member.stampGoal} Stamps`,
        }),
        el('span', {
          className: 'text-xs text-muted',
          text: `${member.collectedStamps} collected · ${remaining} remaining`,
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
            el('div', { className: 'text-xs text-muted', text: 'Next Reward' }),
            el('strong', {
              className: 'text-sm',
              text:
                remaining > 0
                  ? `Collect ${remaining} more ${remaining === 1 ? 'stamp' : 'stamps'} to unlock a ₹500 Voucher`
                  : '₹500 Voucher ready to redeem!',
            }),
          ]),
        ]),
        createIcon('chevron-right', { size: 16 }),
      ],
    ),
  ]);
}

function renderDashboardOverview(container, data, navigateTo) {
  const { member, rewards, purchases, stampActivity } = data;
  const recentRewards = rewards.filter((r) => r.status === 'redeemed').slice(0, 3);
  const recentPurchases = purchases.slice(0, 3);
  const recentStamps = stampActivity.slice(0, 3);

  const topHero = el('div', { className: 'member-card-hero' }, [
    createDigitalPassCard(member, { showCopy: true }),
    createProgressCard(member, () => navigateTo('rewards')),
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

  container.append(topHero, el('div', { className: 'member-feeds-grid' }, [rewardCard, purchaseCard, stampCard]));
}

function handleRedeemClick(reward) {
  const confirmBtn = el('button', {
    type: 'button',
    className: 'btn btn--primary',
    text: 'Submit Redemption Request',
    onClick: async () => {
      setButtonLoading(confirmBtn, true, 'Requesting...');
      const res = await requestRewardRedemption({ rewardId: reward.id });
      setButtonLoading(confirmBtn, false);
      closeModal();
      showToast({
        message: res.message,
        variant: res.ok ? 'success' : 'warning',
        durationMs: 5000,
      });
    },
  });

  openModal({
    title: `Redeem — ${reward.title}`,
    body: el('div', { className: 'stack' }, [
      el('p', {
        className: 'text-sm text-muted',
        text: `This reward requires ${reward.requiredStamps} stamps. In production, submitting this request validates your balance atomically on the server and generates a single-use checkout voucher code.`,
      }),
      createAlert({
        variant: 'info',
        title: 'Tamper-Proof Balance Rule',
        message: 'Balances cannot be modified in the browser before Phase 2 Edge Function connection.',
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
    { id: 'locked', label: `Locked (${rewards.filter((r) => r.status === 'locked').length})` },
    { id: 'redeemed', label: `Redeemed (${rewards.filter((r) => r.status === 'redeemed').length})` },
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

  const visible = rewardFilter === 'all' ? rewards : rewards.filter((r) => r.status === rewardFilter);

  const grid = el(
    'div',
    { className: 'rewards-grid' },
    visible.map((rw) => {
      const isLocked = rw.status === 'locked';
      const isRedeemed = rw.status === 'redeemed';
      const badgeTone = rw.status === 'available' ? 'active' : isLocked ? 'warning' : 'neutral';
      const badgeLabel = rw.status === 'available' ? 'Available' : isLocked ? 'Locked' : 'Redeemed';
      const stampsNeeded = Math.max(0, rw.requiredStamps - member.collectedStamps);

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
            ? el('div', { className: 'cluster' }, [
                el('span', { className: 'text-xs text-muted', text: 'Voucher Code:' }),
                el('span', { className: 'voucher-code-chip', text: rw.voucherCode }),
              ])
            : null,
          el('div', { className: 'text-xs text-muted', text: rw.validityText }),
        ]),
        isRedeemed
          ? el('div', { className: 'text-xs text-muted', text: `Completed on ${rw.redeemedAt}` })
          : isLocked
          ? el('button', {
              type: 'button',
              className: 'btn btn--outline-muted btn--block',
              disabled: true,
              text: `Need ${stampsNeeded} more ${stampsNeeded === 1 ? 'stamp' : 'stamps'} to unlock`,
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
  const rows = [
    ['Full Name', member.fullName],
    ['Membership ID', member.membershipCode],
    ['Email Address', member.email],
    ['Mobile Number', member.mobile],
    ['Member Since', member.joinedDate],
    ['Active Programme', `${member.programmeName} (${member.programmeRule})`],
    ['Verified Stamp Balance', `${member.collectedStamps} / ${member.stampGoal} Stamps (Read-Only)`],
  ];

  container.append(
    el('h2', { className: 'page-title', text: 'My Profile' }),
    createAlert({
      variant: 'info',
      title: 'Protected Membership Fields',
      message: 'Membership ID, stamp balance, and tier eligibility are read-only and controlled by the backend.',
    }),
    el(
      'div',
      { className: 'card grid grid-2' },
      rows.map(([label, val]) =>
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
    message: 'Are you sure you want to sign out of your customer portal preview?',
    confirmLabel: 'Sign Out',
    cancelLabel: 'Stay Signed In',
  });
  if (confirmed) {
    window.location.href = 'login.html';
  }
}

async function loadPortalData() {
  portalStore.setState({ viewMode: 'loading' });
  renderPortalContent();

  const res = await fetchCustomerPortalData();
  if (!res.ok) {
    portalStore.setState({ viewMode: 'error', errorMessage: res.message });
  } else {
    portalStore.setState({ viewMode: 'ready', data: res.data });
    const copyIdBtn = qs('#copy-member-id-btn');
    copyIdBtn?.addEventListener('click', () => copyMembershipId(res.data.member.membershipCode));
  }
  renderPortalContent();
}

export function initCustomerDashboard() {
  const host = qs('#member-view-host');
  if (!host) return;

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
}
