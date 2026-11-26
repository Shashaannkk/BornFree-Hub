/**
 * BONFREE-HUB Admin Console Pages Controller (Phase 2A)
 * Powers Staff Sign In, Overview, Customers, and Loyalty Programmes.
 */
import { clearElement, el, qs } from '../core/dom.js';
import { createIcon } from '../core/icons.js';
import { createStore } from '../core/state.js';
import { mountAdminShell } from '../components/adminShell.js';
import { openModal, closeModal } from '../components/modal.js';
import { createAlert, showToast } from '../components/toast.js';
import { createStatusBadge, renderDataTable } from '../components/table.js';
import { renderCardSkeleton } from '../components/loader.js';
import { setButtonLoading, validateForm } from '../components/form.js';
import { createLineChartSvg } from '../components/charts.js';
import {
  ADMIN_DEV_FIXTURE,
  saveLoyaltyProgramme,
  signInStaff,
} from '../services/adminService.js';

/* --------------------------------------------------------------------------
   1. Admin Login (admin/login.html)
   -------------------------------------------------------------------------- */
export function initAdminLoginPage() {
  const form = qs('#admin-login-form');
  if (!form) return;

  const statusRegion = qs('#admin-login-status');

  qs('#admin-forgot-link')?.addEventListener('click', (event) => {
    event.preventDefault();
    openModal({
      title: 'Staff Password Recovery',
      body: el('p', {
        className: 'text-sm text-muted',
        text: 'Staff password resets are issued through verified Supabase Auth recovery emails or an authorized Super Admin once Phase 2B authentication is connected.',
      }),
      footerActions: [
        el('button', {
          type: 'button',
          className: 'btn btn--primary btn--sm',
          text: 'Close',
          onClick: closeModal,
        }),
      ],
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearElement(statusRegion);

    const { valid, values } = validateForm(form);
    if (!valid) {
      statusRegion.appendChild(
        createAlert({
          variant: 'danger',
          title: 'Credentials Incomplete',
          message: 'Enter a valid work email address and password.',
        }),
      );
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true, 'Verifying...');

    try {
      const result = await signInStaff({
        email: values.email,
        password: values.password,
      });

      if (!result.ok) {
        statusRegion.appendChild(
          createAlert({
            variant: 'warning',
            title: 'Supabase Staff Auth Pending (Phase 2B)',
            message: result.message,
          }),
        );
        showToast({ message: result.message, variant: 'warning' });
      }
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

/* --------------------------------------------------------------------------
   2. Admin Overview (admin/dashboard.html)
   -------------------------------------------------------------------------- */
export function initAdminOverviewPage() {
  const host = qs('#admin-overview-host');
  if (!host) return;

  mountAdminShell({ activeId: 'overview' });

  const store = createStore({
    range: '30d',
    mode: 'ready', // 'ready' | 'loading' | 'empty' | 'error'
  });

  const render = () => {
    clearElement(host);
    const { range, mode } = store.getState();

    if (mode === 'loading') {
      host.append(renderCardSkeleton(3), renderCardSkeleton(2));
      return;
    }

    if (mode === 'error') {
      host.append(
        createAlert({
          variant: 'danger',
          title: 'Analytics Feed Unavailable',
          message: 'Simulated error state for Phase 2A QA. Switch back to Live Dev Data or retry.',
        }),
        el('div', { className: 'cluster' }, [
          el('button', {
            type: 'button',
            className: 'btn btn--primary btn--sm',
            text: 'Retry Overview',
            onClick: () => {
              store.setState({ mode: 'ready' });
              render();
            },
          }),
        ]),
      );
      return;
    }

    if (mode === 'empty') {
      host.append(
        el('div', { className: 'card table-empty stack' }, [
          createIcon('bar-chart', { size: 28 }),
          el('h3', { className: 'card__title', text: 'No Activity in Selected Range' }),
          el('p', {
            className: 'text-sm text-muted',
            text: 'No customer registrations or stamp transactions matched this date range.',
          }),
        ]),
      );
      return;
    }

    const kpi = ADMIN_DEV_FIXTURE.kpisByRange[range];
    const kpiCards = [
      {
        icon: 'users',
        label: 'Registered / Active Customers',
        value: kpi.registeredCustomers.toLocaleString('en-IN'),
        delta: `${kpi.activeCustomers.toLocaleString('en-IN')} active members`,
      },
      {
        icon: 'qr-code',
        label: 'Total Loyalty Cards',
        value: kpi.totalLoyaltyCards.toLocaleString('en-IN'),
        delta: '100% digital QR passes issued',
      },
      {
        icon: 'stamp',
        label: 'Stamps Issued',
        value: kpi.stampsIssued.toLocaleString('en-IN'),
        delta: 'Qualifying purchases credited',
      },
      {
        icon: 'gift',
        label: 'Rewards Unlocked & Redeemed',
        value: `${kpi.rewardsRedeemed.toLocaleString('en-IN')}`,
        delta: `${kpi.rewardsUnlocked.toLocaleString('en-IN')} unlocked in period`,
      },
      {
        icon: 'receipt',
        label: 'Qualifying Purchases',
        value: kpi.qualifyingPurchases.toLocaleString('en-IN'),
        delta: '84.2% qualification rate',
      },
      {
        icon: 'bar-chart',
        label: 'Loyalty Sales',
        value: `₹${kpi.loyaltySalesInr.toLocaleString('en-IN')}`,
        delta: 'Development preview aggregate',
      },
    ];

    const kpiGrid = el(
      'div',
      { className: 'admin-kpi-grid' },
      kpiCards.map((c) =>
        el('article', { className: 'kpi-card' }, [
          el('div', { className: 'kpi-card__top' }, [
            createIcon(c.icon, { size: 15 }),
            el('span', { text: c.label }),
          ]),
          el('div', { className: 'kpi-card__value', text: c.value }),
          el('div', { className: 'kpi-card__delta', text: c.delta }),
        ]),
      ),
    );

    const chartCard = el('section', { className: 'card stack' }, [
      el('div', { className: 'between' }, [
        el('h2', { className: 'card__title', text: 'Customer Growth' }),
        el('span', { className: 'badge badge--dark', text: '+18.4% vs. previous 6 months' }),
      ]),
      createLineChartSvg(ADMIN_DEV_FIXTURE.growthSeries, {
        maxVal: 13000,
        ariaLabel: 'Customer growth line chart from Jul to Dec',
      }),
    ]);

    const txTableHost = el('div');
    renderDataTable(txTableHost, {
      rows: ADMIN_DEV_FIXTURE.recentTransactions,
      columns: [
        { key: 'timestamp', label: 'Date & Time' },
        {
          key: 'customerId',
          label: 'Customer',
          render: (row) => `${row.customerName} (${row.customerId})`,
        },
        {
          key: 'type',
          label: 'Type',
          render: (row) =>
            createStatusBadge(row.type, row.type === 'Earned' ? 'active' : 'neutral'),
        },
        { key: 'delta', label: 'Stamps' },
        { key: 'balance', label: 'Balance' },
      ],
    });

    const txCard = el('section', { className: 'card stack' }, [
      el('div', { className: 'between' }, [
        el('h2', { className: 'card__title', text: 'Recent Stamp & Redemption Activity' }),
        el('a', { href: 'customers.html', className: 'auth-link', text: 'View Customers ->' }),
      ]),
      txTableHost,
    ]);

    const regTableHost = el('div');
    renderDataTable(regTableHost, {
      rows: ADMIN_DEV_FIXTURE.recentRegistrations,
      columns: [
        { key: 'id', label: 'Member ID' },
        { key: 'name', label: 'Name' },
        { key: 'programme', label: 'Programme' },
        { key: 'joinedAt', label: 'Registered' },
      ],
    });

    const regCard = el('section', { className: 'card stack' }, [
      el('div', { className: 'between' }, [
        el('h2', { className: 'card__title', text: 'Recent Registrations' }),
        el('a', { href: 'customers.html', className: 'auth-link', text: 'Manage Directory ->' }),
      ]),
      regTableHost,
    ]);

    host.append(
      createAlert({
        variant: 'info',
        title: 'Development Preview Mode',
        message: 'Overview metrics reflect read-only development fixtures until Phase 2B/Supabase Edge Functions connect.',
      }),
      kpiGrid,
      el('div', { className: 'admin-overview-split' }, [chartCard, txCard]),
      regCard,
    );
  };

  qs('#overview-range-select')?.addEventListener('change', (e) => {
    store.setState({ range: e.target.value });
    render();
  });

  for (const btn of document.querySelectorAll('[data-admin-state]')) {
    btn.addEventListener('click', () => {
      for (const b of document.querySelectorAll('[data-admin-state]')) {
        b.classList.toggle('is-active', b === btn);
      }
      store.setState({ mode: btn.getAttribute('data-admin-state') });
      render();
    });
  }

  render();
}

/* --------------------------------------------------------------------------
   3. Customers Directory (admin/customers.html)
   -------------------------------------------------------------------------- */
function openCustomerInspectModal(customer) {
  const body = el('div', { className: 'stack' }, [
    el('div', { className: 'grid grid-2 card card--ivory' }, [
      el('div', {}, [
        el('div', { className: 'text-xs text-muted', text: 'Membership ID' }),
        el('strong', { className: 'text-sm', text: customer.id }),
      ]),
      el('div', {}, [
        el('div', { className: 'text-xs text-muted', text: 'Status' }),
        createStatusBadge(customer.status, customer.status === 'Active' ? 'active' : 'inactive'),
      ]),
      el('div', {}, [
        el('div', { className: 'text-xs text-muted', text: 'Email' }),
        el('strong', { className: 'text-sm', text: customer.email }),
      ]),
      el('div', {}, [
        el('div', { className: 'text-xs text-muted', text: 'Mobile' }),
        el('strong', { className: 'text-sm', text: customer.phone }),
      ]),
      el('div', {}, [
        el('div', { className: 'text-xs text-muted', text: 'Programme & Balance' }),
        el('strong', { className: 'text-sm', text: `${customer.programme} · ${customer.stamps}/10 Stamps` }),
      ]),
      el('div', {}, [
        el('div', { className: 'text-xs text-muted', text: 'Lifetime Spend & Redemptions' }),
        el('strong', {
          className: 'text-sm',
          text: `₹${customer.totalSpendInr.toLocaleString('en-IN')} · ${customer.rewardsRedeemed} rewards`,
        }),
      ]),
    ]),
    el('div', { className: 'stack', style: 'gap: 0.35rem;' }, [
      el('strong', { className: 'text-sm', text: 'Recent Purchase & Activity History' }),
      el(
        'ul',
        { className: 'stack', style: 'gap: 0.25rem;' },
        customer.recentPurchases.map((p) =>
          el('li', { className: 'text-xs text-muted', text: `• ${p}` }),
        ),
      ),
    ]),
    createAlert({
      variant: 'info',
      title: 'Read-Only Customer View',
      message: 'Direct balance edits are disabled client-side. Stamp issuance occurs via staff Edge Functions.',
    }),
  ]);

  openModal({
    title: `Customer Profile — ${customer.name}`,
    body,
    footerActions: [
      el('button', {
        type: 'button',
        className: 'btn btn--primary btn--sm',
        text: 'Close',
        onClick: closeModal,
      }),
    ],
  });
}

export function initAdminCustomersPage() {
  const tableHost = qs('#admin-customers-table');
  if (!tableHost) return;

  const initialQuery = new URLSearchParams(window.location.search).get('q') || '';
  const searchInput = qs('#cust-search-input');
  const statusSelect = qs('#cust-status-filter');
  const progSelect = qs('#cust-programme-filter');
  const sortSelect = qs('#cust-sort-select');

  if (searchInput && initialQuery) {
    searchInput.value = initialQuery;
  }

  const store = createStore({
    query: initialQuery,
    status: 'all',
    programme: 'all',
    sortBy: 'joined-desc',
    page: 1,
    loading: false,
  });

  mountAdminShell({
    activeId: 'customers',
    onGlobalSearch: (val) => {
      if (searchInput) searchInput.value = val;
      store.setState({ query: val, page: 1 });
      render();
    },
  });

  const render = () => {
    const { query, status, programme, sortBy, page, loading } = store.getState();
    const q = query.trim().toLowerCase();

    let rows = ADMIN_DEV_FIXTURE.customers.filter((c) => {
      const matchesQ =
        !q ||
        c.id.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q);
      const matchesStatus = status === 'all' || c.status.toLowerCase() === status;
      const matchesProg = programme === 'all' || c.programme === programme;
      return matchesQ && matchesStatus && matchesProg;
    });

    if (sortBy === 'stamps-desc') {
      rows = [...rows].sort((a, b) => b.stamps - a.stamps);
    } else if (sortBy === 'name-asc') {
      rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    }

    const pageSize = 5;
    const slice = rows.slice((page - 1) * pageSize, page * pageSize);

    renderDataTable(tableHost, {
      loading,
      rows: slice,
      page,
      pageSize,
      totalItems: rows.length,
      emptyMessage: 'No customers match the selected search or filters.',
      onPageChange: (nextPage) => {
        store.setState({ page: nextPage });
        render();
      },
      columns: [
        { key: 'id', label: 'Customer ID' },
        {
          key: 'name',
          label: 'Name & Email',
          render: (row) =>
            el('div', {}, [
              el('div', { className: 'text-sm', style: 'font-weight: 500;', text: row.name }),
              el('div', { className: 'text-xs text-muted', text: row.email }),
            ]),
        },
        { key: 'phone', label: 'Phone' },
        { key: 'programme', label: 'Programme' },
        { key: 'stamps', label: 'Stamp Balance' },
        {
          key: 'status',
          label: 'Status',
          render: (row) =>
            createStatusBadge(row.status, row.status === 'Active' ? 'active' : 'inactive'),
        },
        { key: 'joinedOn', label: 'Joined On' },
        {
          key: 'actions',
          label: 'Actions',
          render: (row) =>
            el(
              'button',
              {
                type: 'button',
                className: 'btn btn--outline-muted btn--sm',
                onClick: () => openCustomerInspectModal(row),
              },
              [createIcon('eye', { size: 14 }), el('span', { text: 'Details' })],
            ),
        },
      ],
    });
  };

  qs('#cust-apply-btn')?.addEventListener('click', () => {
    store.setState({
      query: searchInput?.value || '',
      status: statusSelect?.value || 'all',
      programme: progSelect?.value || 'all',
      sortBy: sortSelect?.value || 'joined-desc',
      page: 1,
    });
    render();
  });

  qs('#cust-clear-btn')?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    if (statusSelect) statusSelect.value = 'all';
    if (progSelect) progSelect.value = 'all';
    if (sortSelect) sortSelect.value = 'joined-desc';
    store.setState({
      query: '',
      status: 'all',
      programme: 'all',
      sortBy: 'joined-desc',
      page: 1,
    });
    render();
  });

  qs('#cust-toggle-loading-btn')?.addEventListener('click', () => {
    store.setState((prev) => ({ loading: !prev.loading }));
    render();
  });

  qs('#add-customer-btn')?.addEventListener('click', () => {
    openModal({
      title: 'Add Loyalty Customer (Phase 2B)',
      body: el('p', {
        className: 'text-sm text-muted',
        text: 'Staff-assisted customer onboarding creates verified Supabase Auth + profile records via an authenticated Edge Function in Phase 2B.',
      }),
      footerActions: [
        el('button', {
          type: 'button',
          className: 'btn btn--primary btn--sm',
          text: 'Got It',
          onClick: closeModal,
        }),
      ],
    });
  });

  render();
}

/* --------------------------------------------------------------------------
   4. Loyalty Programmes Master-Detail (admin/loyalty.html)
   -------------------------------------------------------------------------- */
export function initAdminLoyaltyPage() {
  const listHost = qs('#programme-list-host');
  const form = qs('#programme-editor-form');
  if (!listHost || !form) return;

  mountAdminShell({ activeId: 'loyalty' });

  const store = createStore({
    selectedId: ADMIN_DEV_FIXTURE.programmes[0].id,
    isCreatingNew: false,
    draftTiers: [...ADMIN_DEV_FIXTURE.programmes[0].tiers],
  });

  const editorTitle = qs('#programme-editor-title');
  const tiersHost = qs('#programme-tiers-host');
  const statusRegion = qs('#programme-save-status');

  const nameInput = qs('#prog-name');
  const statusSelect = qs('#prog-status');
  const descInput = qs('#prog-description');
  const goalInput = qs('#prog-stamp-goal');
  const amountInput = qs('#prog-qualifying-amount');
  const ruleSelect = qs('#prog-calc-rule');
  const stampValidityInput = qs('#prog-stamp-validity');
  const rewardValidityInput = qs('#prog-reward-validity');
  const eligibilityInput = qs('#prog-eligibility');

  function renderTiers() {
    clearElement(tiersHost);
    const { draftTiers } = store.getState();

    if (draftTiers.length === 0) {
      tiersHost.appendChild(
        el('p', { className: 'text-xs text-muted', text: 'No reward tiers configured. Add at least one milestone.' }),
      );
      return;
    }

    for (let idx = 0; idx < draftTiers.length; idx += 1) {
      const tier = draftTiers[idx];
      const stampsField = el('input', {
        type: 'number',
        className: 'input',
        min: '1',
        value: String(tier.stamps),
        'aria-label': 'Required stamps for tier',
      });
      stampsField.addEventListener('input', (e) => {
        draftTiers[idx] = { ...draftTiers[idx], stamps: Number(e.target.value) || 1 };
      });

      const titleField = el('input', {
        type: 'text',
        className: 'input',
        value: tier.title,
        placeholder: 'Reward title',
        'aria-label': 'Reward title',
      });
      titleField.addEventListener('input', (e) => {
        draftTiers[idx] = { ...draftTiers[idx], title: e.target.value };
      });

      const valField = el('input', {
        type: 'text',
        className: 'input',
        value: tier.value,
        placeholder: 'e.g. ₹500 Voucher',
        'aria-label': 'Reward value',
      });
      valField.addEventListener('input', (e) => {
        draftTiers[idx] = { ...draftTiers[idx], value: e.target.value };
      });

      const removeBtn = el(
        'button',
        {
          type: 'button',
          className: 'btn btn--icon btn--outline-muted btn--sm',
          'aria-label': 'Remove reward level',
          onClick: () => {
            store.setState({ draftTiers: draftTiers.filter((_, i) => i !== idx) });
            renderTiers();
          },
        },
        [createIcon('x', { size: 14 })],
      );

      tiersHost.appendChild(
        el('div', { className: 'reward-tier-row' }, [stampsField, titleField, valField, removeBtn]),
      );
    }
  }

  function populateEditor(prog, isNew = false) {
    clearElement(statusRegion);
    editorTitle.textContent = isNew ? 'Create Loyalty Programme' : `Edit Programme — ${prog.name}`;
    nameInput.value = prog.name;
    statusSelect.value = prog.status;
    descInput.value = prog.description;
    goalInput.value = String(prog.stampGoal);
    amountInput.value = String(prog.qualifyingAmountInr);
    ruleSelect.value = prog.calculationRule;
    stampValidityInput.value = String(prog.stampValidityMonths);
    rewardValidityInput.value = String(prog.rewardValidityMonths);
    eligibilityInput.value = prog.eligibility;

    store.setState({
      isCreatingNew: isNew,
      selectedId: isNew ? '' : prog.id,
      draftTiers: prog.tiers.map((t) => ({ ...t })),
    });
    renderProgrammeList();
    renderTiers();
  }

  function renderProgrammeList() {
    clearElement(listHost);
    const { selectedId } = store.getState();

    for (const prog of ADMIN_DEV_FIXTURE.programmes) {
      const btn = el(
        'button',
        {
          type: 'button',
          className: `programme-list-item${prog.id === selectedId ? ' is-selected' : ''}`,
          onClick: () => populateEditor(prog, false),
        },
        [
          el('div', { className: 'between' }, [
            el('strong', { className: 'text-sm', text: prog.name }),
            createStatusBadge(prog.status, prog.status === 'Active' ? 'active' : 'inactive'),
          ]),
          el('span', { className: 'text-xs text-muted', text: prog.subtitle }),
        ],
      );
      listHost.appendChild(btn);
    }
  }

  qs('#add-reward-tier-btn')?.addEventListener('click', () => {
    const { draftTiers } = store.getState();
    store.setState({
      draftTiers: [...draftTiers, { stamps: 10, title: 'New Milestone Reward', value: '₹500 Voucher' }],
    });
    renderTiers();
  });

  qs('#create-programme-btn')?.addEventListener('click', () => {
    populateEditor(
      {
        id: '',
        name: '',
        description: '',
        status: 'Active',
        stampGoal: 10,
        qualifyingAmountInr: 1000,
        calculationRule: 'per_threshold',
        stampValidityMonths: 12,
        rewardValidityMonths: 6,
        eligibility: 'All active loyalty club members',
        tiers: [{ stamps: 10, title: 'Store Voucher', value: '₹500 Voucher' }],
      },
      true,
    );
  });

  qs('#cancel-programme-btn')?.addEventListener('click', () => {
    populateEditor(ADMIN_DEV_FIXTURE.programmes[0], false);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearElement(statusRegion);
    const { valid, values } = validateForm(form);
    if (!valid) {
      statusRegion.appendChild(
        createAlert({
          variant: 'danger',
          title: 'Configuration Incomplete',
          message: 'Fill in all required loyalty programme fields.',
        }),
      );
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true, 'Saving...');

    try {
      const res = await saveLoyaltyProgramme({
        ...values,
        tiers: store.getState().draftTiers,
      });
      if (!res.ok) {
        statusRegion.appendChild(
          createAlert({
            variant: 'warning',
            title: 'Database Save Pending (Phase 2B)',
            message: res.message,
          }),
        );
        showToast({ message: res.message, variant: 'warning' });
      }
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  populateEditor(ADMIN_DEV_FIXTURE.programmes[0], false);
}
