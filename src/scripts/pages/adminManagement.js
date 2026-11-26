/**
 * BONFREE-HUB Admin Management Controllers (Phase 2C)
 * Powers Purchase Records, Staff Management, Campaigns, and Surveys.
 */
import { clearElement, el, qs } from '../core/dom.js';
import { createIcon } from '../core/icons.js';
import { createStore } from '../core/state.js';
import { mountAdminShell } from '../components/adminShell.js';
import { openModal, closeModal } from '../components/modal.js';
import { createAlert, showToast } from '../components/toast.js';
import { createStatusBadge, renderDataTable } from '../components/table.js';
import { setButtonLoading, validateForm } from '../components/form.js';
import {
  ADMIN_EXTENDED_FIXTURE,
  buildSafeCsv,
  saveCampaign,
  saveStaffMember,
  saveSurvey,
} from '../services/adminExtendedService.js';

function triggerCsvDownload(filename, csvText) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = el('a', { href: url, download: filename });
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/* --------------------------------------------------------------------------
   1. Purchase Records (admin/purchases.html)
   -------------------------------------------------------------------------- */
function openPurchaseDetailModal(rec) {
  openModal({
    title: `Purchase Receipt — ${rec.receiptNo}`,
    body: el('div', { className: 'stack' }, [
      el('div', { className: 'grid grid-2 card card--ivory' }, [
        el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Customer' }), el('strong', { className: 'text-sm', text: `${rec.memberName} (${rec.memberId})` })]),
        el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Date & Store' }), el('strong', { className: 'text-sm', text: `${rec.dateTime} · ${rec.store}` })]),
        el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Purchase Amount' }), el('strong', { className: 'text-sm', text: `₹${rec.amountInr.toLocaleString('en-IN')}` })]),
        el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Eligibility & Stamps' }), el('strong', { className: 'text-sm', text: rec.qualifying ? `Qualifying (+${rec.stampsAwarded} stamps)` : 'Not Qualifying (0 stamps)' })]),
      ]),
      el('div', {}, [
        el('div', { className: 'text-xs text-muted', text: 'Items Purchased' }),
        el('strong', { className: 'text-sm', text: rec.itemsSummary }),
      ]),
      el('div', { className: 'text-xs text-muted', text: `Recorded by: ${rec.recordedBy}` }),
    ]),
    footerActions: [
      el('button', { type: 'button', className: 'btn btn--primary btn--sm', text: 'Close', onClick: closeModal }),
    ],
  });
}

export function initAdminPurchasesPage() {
  const tableHost = qs('#admin-purchases-table');
  if (!tableHost) return;

  mountAdminShell({ activeId: 'purchases' });

  const fromInput = qs('#pur-date-from');
  const toInput = qs('#pur-date-to');
  const searchInput = qs('#pur-search');
  const statusSelect = qs('#pur-status');
  const sortSelect = qs('#pur-sort');
  const kpiHost = qs('#pur-kpis');

  const store = createStore({
    dateFrom: '',
    dateTo: '',
    query: '',
    status: 'all',
    sortBy: 'date-desc',
    page: 1,
  });

  function getFiltered() {
    const { dateFrom, dateTo, query, status, sortBy } = store.getState();
    const q = query.trim().toLowerCase();

    let rows = ADMIN_EXTENDED_FIXTURE.purchaseRecords.filter((p) => {
      const matchesQ =
        !q ||
        p.receiptNo.toLowerCase().includes(q) ||
        p.memberName.toLowerCase().includes(q) ||
        p.memberId.toLowerCase().includes(q) ||
        p.itemsSummary.toLowerCase().includes(q);
      const matchesStatus =
        status === 'all' ||
        (status === 'qualifying' && p.qualifying) ||
        (status === 'not-qualifying' && !p.qualifying);
      const matchesFrom = !dateFrom || p.isoDate >= dateFrom;
      const matchesTo = !dateTo || p.isoDate <= dateTo;
      return matchesQ && matchesStatus && matchesFrom && matchesTo;
    });

    if (sortBy === 'date-asc') rows = [...rows].sort((a, b) => a.isoDate.localeCompare(b.isoDate));
    else if (sortBy === 'amount-desc') rows = [...rows].sort((a, b) => b.amountInr - a.amountInr);
    return rows;
  }

  function render() {
    const rows = getFiltered();
    const { page } = store.getState();
    const totalAmount = rows.reduce((sum, r) => sum + r.amountInr, 0);
    const qualifyingCount = rows.filter((r) => r.qualifying).length;
    const nonQualifyingCount = rows.length - qualifyingCount;
    const rate = rows.length ? ((qualifyingCount / rows.length) * 100).toFixed(1) : '0.0';

    clearElement(kpiHost);
    const stats = [
      ['Total Purchases', String(rows.length)],
      ['Total Purchase Amount', `₹${totalAmount.toLocaleString('en-IN')}`],
      ['Qualifying Purchases', `${qualifyingCount} (${nonQualifyingCount} non-qualifying)`],
      ['Qualification Rate', `${rate}%`],
    ];
    for (const [label, val] of stats) {
      kpiHost.appendChild(
        el('article', { className: 'kpi-card' }, [
          el('div', { className: 'kpi-card__top', text: label }),
          el('div', { className: 'kpi-card__value', style: 'font-size: 1.5rem;', text: val }),
        ]),
      );
    }

    const pageSize = 5;
    const slice = rows.slice((page - 1) * pageSize, page * pageSize);

    renderDataTable(tableHost, {
      rows: slice,
      page,
      pageSize,
      totalItems: rows.length,
      emptyMessage: 'No purchase records match your filters.',
      onPageChange: (nextPage) => {
        store.setState({ page: nextPage });
        render();
      },
      columns: [
        { key: 'receiptNo', label: 'Receipt No.' },
        { key: 'dateTime', label: 'Date & Time' },
        {
          key: 'memberName',
          label: 'Member',
          render: (row) => `${row.memberName} (${row.memberId})`,
        },
        {
          key: 'amountInr',
          label: 'Purchase Amount',
          render: (row) => `₹${row.amountInr.toLocaleString('en-IN')}`,
        },
        {
          key: 'qualifying',
          label: 'Qualifying Status',
          render: (row) =>
            createStatusBadge(
              row.qualifying ? '✓ Qualifying' : '× Not Qualifying',
              row.qualifying ? 'active' : 'inactive',
            ),
        },
        {
          key: 'actions',
          label: 'Actions',
          render: (row) =>
            el(
              'button',
              {
                type: 'button',
                className: 'btn btn--outline-muted btn--sm',
                'aria-label': `Inspect ${row.receiptNo}`,
                onClick: () => openPurchaseDetailModal(row),
              },
              [createIcon('eye', { size: 15 })],
            ),
        },
      ],
    });
  }

  qs('#pur-apply-btn')?.addEventListener('click', () => {
    store.setState({
      dateFrom: fromInput?.value || '',
      dateTo: toInput?.value || '',
      query: searchInput?.value || '',
      status: statusSelect?.value || 'all',
      sortBy: sortSelect?.value || 'date-desc',
      page: 1,
    });
    render();
  });

  qs('#pur-clear-btn')?.addEventListener('click', () => {
    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';
    if (searchInput) searchInput.value = '';
    if (statusSelect) statusSelect.value = 'all';
    if (sortSelect) sortSelect.value = 'date-desc';
    store.setState({ dateFrom: '', dateTo: '', query: '', status: 'all', sortBy: 'date-desc', page: 1 });
    render();
  });

  qs('#pur-export-csv-btn')?.addEventListener('click', () => {
    const rows = getFiltered();
    if (rows.length === 0) {
      showToast({ message: 'No visible records to export.', variant: 'warning' });
      return;
    }
    const csv = buildSafeCsv(
      ['Receipt No', 'Date & Time', 'Member ID', 'Member Name', 'Store', 'Amount (INR)', 'Qualifying', 'Stamps Awarded'],
      rows.map((r) => [r.receiptNo, r.dateTime, r.memberId, r.memberName, r.store, r.amountInr, r.qualifying, r.stampsAwarded]),
    );
    triggerCsvDownload('bonfree-hub-purchase-records-preview.csv', csv);
    showToast({ message: 'Exported preview CSV. Live full-dataset export runs server-side in Phase 3.', variant: 'info' });
  });

  render();
}

/* --------------------------------------------------------------------------
   2. Staff Management (admin/staff.html)
   -------------------------------------------------------------------------- */
function openStaffFormModal(existing = null) {
  const isEdit = Boolean(existing);
  const statusRegion = el('div', { 'aria-live': 'polite' });

  const form = el('form', { className: 'form-stack', novalidate: true }, [
    statusRegion,
    el('div', { className: 'grid grid-2' }, [
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'stf-id', text: 'Staff ID *' }),
        el('input', { id: 'stf-id', name: 'staffId', type: 'text', className: 'input', value: existing?.id || 'STF1006', required: true }),
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'stf-name', text: 'Full Name *' }),
        el('input', { id: 'stf-name', name: 'name', type: 'text', className: 'input', value: existing?.name || '', required: true }),
      ]),
    ]),
    el('div', { className: 'field' }, [
      el('label', { className: 'field__label', for: 'stf-email', text: 'Work Email *' }),
      el('input', { id: 'stf-email', name: 'email', type: 'email', className: 'input', value: existing?.email || '', required: true }),
    ]),
    el('div', { className: 'grid grid-3' }, [
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'stf-role', text: 'Assigned Role *' }),
        el(
          'select',
          { id: 'stf-role', name: 'role', className: 'select', required: true },
          ['Administrator', 'Store Manager', 'Sales Staff', 'Marketing Staff'].map((r) =>
            el('option', { value: r, text: r, selected: existing?.role === r }),
          ),
        ),
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'stf-dept', text: 'Store / Department' }),
        el('input', { id: 'stf-dept', name: 'department', type: 'text', className: 'input', value: existing?.department || 'Bengaluru — MG Road' }),
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'stf-status', text: 'Account Status' }),
        el('select', { id: 'stf-status', name: 'status', className: 'select' }, [
          el('option', { value: 'Active', text: 'Active', selected: !existing || existing.status === 'Active' }),
          el('option', { value: 'Inactive', text: 'Inactive', selected: existing?.status === 'Inactive' }),
        ]),
      ]),
    ]),
    createAlert({
      variant: 'info',
      title: 'Backend RBAC Enforcement',
      message: 'Role permissions are enforced via Supabase PostgreSQL RLS & Edge Functions.',
    }),
  ]);

  const submitBtn = el('button', {
    type: 'button',
    className: 'btn btn--primary',
    text: isEdit ? 'Save Staff Account' : 'Invite Staff Member',
    onClick: async () => {
      clearElement(statusRegion);
      const { valid, values } = validateForm(form);
      if (!valid) {
        statusRegion.appendChild(createAlert({ variant: 'danger', title: 'Validation Error', message: 'Complete all required staff fields.' }));
        return;
      }
      setButtonLoading(submitBtn, true, 'Saving...');
      const res = await saveStaffMember(values);
      setButtonLoading(submitBtn, false);
      statusRegion.appendChild(createAlert({ variant: 'warning', title: 'Backend Save Pending (Phase 3)', message: res.message }));
      showToast({ message: res.message, variant: 'warning' });
    },
  });

  openModal({
    title: isEdit ? `Edit Staff — ${existing.name}` : 'Add Store / Back-Office Staff',
    body: form,
    footerActions: [
      el('button', { type: 'button', className: 'btn btn--outline-muted', text: 'Cancel', onClick: closeModal }),
      submitBtn,
    ],
  });
}

function openStaffActivityModal(staff) {
  openModal({
    title: `Staff Activity — ${staff.name} (${staff.id})`,
    body: el('div', { className: 'stack' }, [
      el('div', { className: 'grid grid-2 card card--ivory' }, [
        el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Role & Store' }), el('strong', { className: 'text-sm', text: `${staff.role} · ${staff.department}` })]),
        el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Operations Count' }), el('strong', { className: 'text-sm', text: `${staff.stampsIssuedCount} stamps · ${staff.redemptionsVerifiedCount} redemptions` })]),
      ]),
      el('div', { className: 'stack', style: 'gap: 0.35rem;' }, [
        el('strong', { className: 'text-sm', text: 'Recent Audit Log Activity' }),
        el(
          'ul',
          { className: 'stack', style: 'gap: 0.25rem;' },
          staff.recentActivity.map((act) => el('li', { className: 'text-xs text-muted', text: `• ${act}` })),
        ),
      ]),
    ]),
    footerActions: [
      el('button', { type: 'button', className: 'btn btn--primary btn--sm', text: 'Close', onClick: closeModal }),
    ],
  });
}

export function initAdminStaffPage() {
  const host = qs('#staff-tab-panel');
  if (!host) return;

  mountAdminShell({ activeId: 'staff' });

  const tabsHost = qs('#staff-tabs');
  const store = createStore({
    activeTab: 'list', // 'list' | 'roles'
    query: '',
    role: 'all',
    status: 'all',
  });

  function renderTabs() {
    clearElement(tabsHost);
    const { activeTab } = store.getState();
    for (const [id, label] of [['list', 'Staff List'], ['roles', 'Role & Permissions']]) {
      tabsHost.appendChild(
        el('button', {
          type: 'button',
          className: `tab${activeTab === id ? ' is-active' : ''}`,
          text: label,
          onClick: () => {
            store.setState({ activeTab: id });
            renderTabs();
            renderPanel();
          },
        }),
      );
    }
  }

  function renderPanel() {
    clearElement(host);
    const { activeTab, query, role, status } = store.getState();

    if (activeTab === 'roles') {
      const matrixTable = el('div');
      const tick = (allowed) =>
        createStatusBadge(allowed ? 'Allowed' : 'Restricted', allowed ? 'active' : 'inactive');

      renderDataTable(matrixTable, {
        rows: ADMIN_EXTENDED_FIXTURE.roleMatrix,
        columns: [
          { key: 'capability', label: 'Permission / Module Capability' },
          { key: 'Administrator', label: 'Administrator', render: (r) => tick(r.Administrator) },
          { key: 'Store Manager', label: 'Store Manager', render: (r) => tick(r['Store Manager']) },
          { key: 'Sales Staff', label: 'Sales Staff', render: (r) => tick(r['Sales Staff']) },
          { key: 'Marketing Staff', label: 'Marketing Staff', render: (r) => tick(r['Marketing Staff']) },
        ],
      });

      host.append(
        createAlert({
          variant: 'info',
          title: 'Server-Enforced RBAC Policy',
          message: 'Client UI reflects role capabilities, while PostgreSQL RLS & Edge Functions enforce authorization on every mutation.',
        }),
        matrixTable,
      );
      return;
    }

    const searchInput = el('input', {
      type: 'search',
      className: 'input',
      placeholder: 'Search by name, email or staff ID...',
      value: query,
      'aria-label': 'Search staff',
    });
    const roleSelect = el(
      'select',
      { className: 'select', 'aria-label': 'Filter by role' },
      [
        el('option', { value: 'all', text: 'All Roles', selected: role === 'all' }),
        ...['Administrator', 'Store Manager', 'Sales Staff', 'Marketing Staff'].map((r) =>
          el('option', { value: r, text: r, selected: role === r }),
        ),
      ],
    );
    const statusSelect = el(
      'select',
      { className: 'select', 'aria-label': 'Filter by status' },
      [
        el('option', { value: 'all', text: 'All Status', selected: status === 'all' }),
        el('option', { value: 'active', text: 'Active', selected: status === 'active' }),
        el('option', { value: 'inactive', text: 'Inactive', selected: status === 'inactive' }),
      ],
    );

    const toolbar = el('div', { className: 'filter-toolbar', style: 'grid-template-columns: 1.5fr 1fr 1fr auto;' }, [
      searchInput,
      roleSelect,
      statusSelect,
      el('button', {
        type: 'button',
        className: 'btn btn--primary',
        text: 'Apply',
        onClick: () => {
          store.setState({
            query: searchInput.value,
            role: roleSelect.value,
            status: statusSelect.value,
          });
          renderPanel();
        },
      }),
    ]);

    const q = query.trim().toLowerCase();
    const filtered = ADMIN_EXTENDED_FIXTURE.staffMembers.filter((s) => {
      const mQ = !q || s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
      const mR = role === 'all' || s.role === role;
      const mS = status === 'all' || s.status.toLowerCase() === status;
      return mQ && mR && mS;
    });

    const tableHost = el('div');
    renderDataTable(tableHost, {
      rows: filtered,
      page: 1,
      pageSize: 8,
      totalItems: filtered.length,
      columns: [
        { key: 'id', label: 'Staff ID' },
        {
          key: 'name',
          label: 'Name & Email',
          render: (row) =>
            el('div', {}, [
              el('div', { className: 'text-sm', style: 'font-weight: 500;', text: row.name }),
              el('div', { className: 'text-xs text-muted', text: row.email }),
            ]),
        },
        { key: 'role', label: 'Role' },
        { key: 'department', label: 'Store / Department' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => createStatusBadge(row.status, row.status === 'Active' ? 'active' : 'inactive'),
        },
        {
          key: 'actions',
          label: 'Actions',
          render: (row) =>
            el('div', { className: 'cluster', style: 'gap: 0.35rem;' }, [
              el('button', {
                type: 'button',
                className: 'btn btn--outline-muted btn--sm',
                text: 'Edit',
                onClick: () => openStaffFormModal(row),
              }),
              el('button', {
                type: 'button',
                className: 'btn btn--outline-muted btn--sm',
                text: 'Activity',
                onClick: () => openStaffActivityModal(row),
              }),
            ]),
        },
      ],
    });

    host.append(toolbar, tableHost);
  }

  qs('#add-staff-btn')?.addEventListener('click', () => openStaffFormModal(null));
  renderTabs();
  renderPanel();
}

/* --------------------------------------------------------------------------
   3. Campaigns (admin/campaigns.html)
   -------------------------------------------------------------------------- */
function openCampaignFormModal(existing = null) {
  const isEdit = Boolean(existing);
  const statusRegion = el('div', { 'aria-live': 'polite' });

  const form = el('form', { className: 'form-stack', novalidate: true }, [
    statusRegion,
    el('div', { className: 'field' }, [
      el('label', { className: 'field__label', for: 'camp-title', text: 'Campaign Title *' }),
      el('input', { id: 'camp-title', name: 'title', type: 'text', className: 'input', value: existing?.title || '', required: true }),
    ]),
    el('div', { className: 'field' }, [
      el('label', { className: 'field__label', for: 'camp-desc', text: 'Description *' }),
      el('textarea', { id: 'camp-desc', name: 'description', className: 'textarea', required: true, text: existing?.description || '' }),
    ]),
    el('div', { className: 'grid grid-2' }, [
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'camp-start', text: 'Start Date *' }),
        el('input', { id: 'camp-start', name: 'startDate', type: 'date', className: 'input', value: existing?.startDate || '2025-02-01', required: true }),
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'camp-end', text: 'End Date *' }),
        el('input', { id: 'camp-end', name: 'endDate', type: 'date', className: 'input', value: existing?.endDate || '2025-02-28', required: true }),
      ]),
    ]),
    el('div', { className: 'grid grid-2' }, [
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'camp-rule', text: 'Promotional Rule' }),
        el('input', { id: 'camp-rule', name: 'rule', type: 'text', className: 'input', value: existing?.rule || '2x Stamp Multiplier' }),
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'camp-status', text: 'Status' }),
        el('select', { id: 'camp-status', name: 'status', className: 'select' }, [
          el('option', { value: 'Active', text: 'Active', selected: existing?.status === 'Active' }),
          el('option', { value: 'Scheduled', text: 'Scheduled', selected: existing?.status === 'Scheduled' }),
          el('option', { value: 'Completed', text: 'Completed', selected: existing?.status === 'Completed' }),
        ]),
      ]),
    ]),
  ]);

  const submitBtn = el('button', {
    type: 'button',
    className: 'btn btn--primary',
    text: isEdit ? 'Save Campaign' : 'Create Campaign',
    onClick: async () => {
      clearElement(statusRegion);
      const { valid, values } = validateForm(form);
      if (!valid) {
        statusRegion.appendChild(createAlert({ variant: 'danger', title: 'Validation Error', message: 'Complete all required campaign fields.' }));
        return;
      }
      setButtonLoading(submitBtn, true, 'Saving...');
      const res = await saveCampaign(values);
      setButtonLoading(submitBtn, false);
      statusRegion.appendChild(createAlert({ variant: 'warning', title: 'Backend Save Pending (Phase 3)', message: res.message }));
      showToast({ message: res.message, variant: 'warning' });
    },
  });

  openModal({
    title: isEdit ? `Edit Campaign — ${existing.title}` : 'Create Streetwear Campaign',
    body: form,
    footerActions: [
      el('button', { type: 'button', className: 'btn btn--outline-muted', text: 'Cancel', onClick: closeModal }),
      submitBtn,
    ],
  });
}

export function initAdminCampaignsPage() {
  const gridHost = qs('#admin-campaigns-grid');
  if (!gridHost) return;

  mountAdminShell({ activeId: 'campaigns' });

  const kpiHost = qs('#campaigns-kpis');
  const tabsHost = qs('#campaigns-tabs');
  const store = createStore({ activeTab: 'All' });

  const all = ADMIN_EXTENDED_FIXTURE.campaigns;
  const counts = {
    All: all.length,
    Active: all.filter((c) => c.status === 'Active').length,
    Scheduled: all.filter((c) => c.status === 'Scheduled').length,
    Completed: all.filter((c) => c.status === 'Completed').length,
  };

  for (const [label, val] of [
    ['Total Campaigns', counts.All],
    ['Active', counts.Active],
    ['Scheduled', counts.Scheduled],
    ['Completed', counts.Completed],
  ]) {
    kpiHost.appendChild(
      el('article', { className: 'kpi-card' }, [
        el('div', { className: 'kpi-card__top', text: label }),
        el('div', { className: 'kpi-card__value', style: 'font-size: 1.5rem;', text: String(val) }),
      ]),
    );
  }

  function renderTabs() {
    clearElement(tabsHost);
    const { activeTab } = store.getState();
    for (const tab of ['All', 'Active', 'Scheduled', 'Completed']) {
      tabsHost.appendChild(
        el('button', {
          type: 'button',
          className: `tab${activeTab === tab ? ' is-active' : ''}`,
          text: `${tab} (${counts[tab]})`,
          onClick: () => {
            store.setState({ activeTab: tab });
            renderTabs();
            renderGrid();
          },
        }),
      );
    }
  }

  function renderGrid() {
    clearElement(gridHost);
    const { activeTab } = store.getState();
    const list = activeTab === 'All' ? all : all.filter((c) => c.status === activeTab);

    for (const camp of list) {
      const toggleInput = el('input', { type: 'checkbox', checked: camp.status === 'Active' });
      toggleInput.addEventListener('change', async () => {
        const res = await saveCampaign({
          title: camp.title,
          startDate: camp.startDate,
          endDate: camp.endDate,
          status: toggleInput.checked ? 'Active' : 'Inactive',
        });
        toggleInput.checked = camp.status === 'Active';
        showToast({ message: res.message, variant: 'warning' });
      });

      const badgeTone =
        camp.status === 'Active' ? 'active' : camp.status === 'Scheduled' ? 'warning' : 'neutral';

      gridHost.appendChild(
        el('article', { className: 'campaign-card' }, [
          el('div', { className: 'campaign-card__top' }, [
            el('img', { src: camp.image, alt: camp.title, className: 'campaign-card__thumb', loading: 'lazy' }),
            el('div', { className: 'stack', style: 'gap: 0.35rem;' }, [
              el('h3', { className: 'card__title', text: camp.title }),
              el('p', { className: 'text-xs text-muted', text: camp.description }),
              el('div', { className: 'text-xs', text: `Start: ${camp.startDate} · End: ${camp.endDate}` }),
              el('span', { className: 'badge badge--neutral', style: 'align-self: flex-start;', text: camp.rule }),
            ]),
          ]),
          el('div', { className: 'campaign-card__footer' }, [
            createStatusBadge(camp.status, badgeTone),
            el('div', { className: 'cluster' }, [
              el('label', { className: 'switch', 'aria-label': `Toggle ${camp.title}` }, [
                toggleInput,
                el('span', { className: 'switch__track' }),
              ]),
              el('button', {
                type: 'button',
                className: 'btn btn--outline-muted btn--sm',
                text: 'Edit',
                onClick: () => openCampaignFormModal(camp),
              }),
            ]),
          ]),
        ]),
      );
    }
  }

  qs('#create-campaign-btn')?.addEventListener('click', () => openCampaignFormModal(null));
  renderTabs();
  renderGrid();
}

/* --------------------------------------------------------------------------
   4. Surveys Builder, Responses & Summary (admin/surveys.html)
   -------------------------------------------------------------------------- */
export function initAdminSurveysPage() {
  const host = qs('#surveys-panel-host');
  if (!host) return;

  mountAdminShell({ activeId: 'surveys' });

  const tabsHost = qs('#surveys-tabs');
  const store = createStore({
    activeTab: 'builder', // 'builder' | 'responses' | 'summary'
    surveyTitle: ADMIN_EXTENDED_FIXTURE.survey.title,
    surveySubtitle: ADMIN_EXTENDED_FIXTURE.survey.subtitle,
    surveyStatus: ADMIN_EXTENDED_FIXTURE.survey.status,
    questions: ADMIN_EXTENDED_FIXTURE.survey.questions.map((q) => ({ ...q, options: [...q.options] })),
  });

  function renderTabs() {
    clearElement(tabsHost);
    const { activeTab } = store.getState();
    for (const [id, label] of [
      ['builder', 'Survey Builder'],
      ['responses', 'Responses'],
      ['summary', 'Summary'],
    ]) {
      tabsHost.appendChild(
        el('button', {
          type: 'button',
          className: `tab${activeTab === id ? ' is-active' : ''}`,
          text: label,
          onClick: () => {
            store.setState({ activeTab: id });
            renderTabs();
            renderPanel();
          },
        }),
      );
    }
  }

  function addQuestion(type) {
    const { questions } = store.getState();
    const defaults = {
      rating: 'How satisfied are you with our recent streetwear fits?',
      multiple_choice: 'Which category do you shop most frequently?',
      short_answer: 'What size or fit improvements would you suggest?',
      long_answer: 'Tell us more about your in-store loyalty experience.',
    };
    const next = {
      id: `q-${Date.now()}`,
      type,
      prompt: defaults[type] || 'New survey question',
      options: type === 'multiple_choice' ? ['Oversized Tees', 'Cargo Pants', 'Baggy Jeans'] : [],
    };
    store.setState({ questions: [...questions, next] });
    renderPanel();
  }

  function renderPanel() {
    clearElement(host);
    const state = store.getState();

    if (state.activeTab === 'responses') {
      const tableHost = el('div');
      renderDataTable(tableHost, {
        rows: ADMIN_EXTENDED_FIXTURE.survey.responses,
        columns: [
          { key: 'memberId', label: 'Member ID' },
          { key: 'memberName', label: 'Member' },
          { key: 'rating', label: 'Rating (★)' },
          { key: 'favorite', label: 'Top Category' },
          { key: 'submittedOn', label: 'Submitted' },
        ],
      });
      host.appendChild(tableHost);
      return;
    }

    if (state.activeTab === 'summary') {
      host.appendChild(
        el('div', { className: 'card stack' }, [
          el('h2', { className: 'card__title', text: 'Survey Analytics Summary' }),
          el('p', {
            className: 'text-sm text-muted',
            text: `${ADMIN_EXTENDED_FIXTURE.survey.totalResponses} total responses · Average Rating: ${ADMIN_EXTENDED_FIXTURE.survey.avgRating} / 5.0`,
          }),
          ...ADMIN_EXTENDED_FIXTURE.survey.topFeedback.map((item) =>
            el('div', { className: 'meter-row' }, [
              el('div', { className: 'between text-xs' }, [
                el('span', { text: item.label }),
                el('strong', { text: `${item.pct}%` }),
              ]),
              el('div', { className: 'meter-track' }, [
                el('div', { className: 'meter-track__fill', style: `width: ${item.pct}%;` }),
              ]),
            ]),
          ),
        ]),
      );
      return;
    }

    // Builder 3-column layout
    const palette = el('aside', { className: 'card stack' }, [
      el('strong', { className: 'text-sm', text: 'Add Question' }),
      el('div', { className: 'survey-palette' }, [
        ['rating', 'star', 'Rating'],
        ['multiple_choice', 'clipboard-list', 'Multiple Choice'],
        ['short_answer', 'file-text', 'Short Answer'],
        ['long_answer', 'file-text', 'Long Answer'],
      ].map(([t, icon, label]) =>
        el(
          'button',
          {
            type: 'button',
            className: 'btn btn--outline-muted btn--sm',
            style: 'justify-content: flex-start;',
            onClick: () => addQuestion(t),
          },
          [createIcon(icon, { size: 15 }), el('span', { text: label })],
        ),
      )),
    ]);

    const titleInput = el('input', {
      type: 'text',
      className: 'input',
      value: state.surveyTitle,
      'aria-label': 'Survey Title',
    });
    titleInput.addEventListener('input', (e) => {
      store.setState({ surveyTitle: e.target.value });
    });

    const questionsWrap = el(
      'div',
      { className: 'stack' },
      state.questions.map((q, idx) => {
        const promptInput = el('input', {
          type: 'text',
          className: 'input',
          value: q.prompt,
          'aria-label': `Question ${idx + 1} prompt`,
        });
        promptInput.addEventListener('input', (e) => {
          state.questions[idx].prompt = e.target.value;
        });

        const moveUp = el('button', {
          type: 'button',
          className: 'btn btn--outline-muted btn--sm',
          disabled: idx === 0,
          text: '↑',
          'aria-label': 'Move question up',
          onClick: () => {
            const copy = [...state.questions];
            [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
            store.setState({ questions: copy });
            renderPanel();
          },
        });

        const moveDown = el('button', {
          type: 'button',
          className: 'btn btn--outline-muted btn--sm',
          disabled: idx === state.questions.length - 1,
          text: '↓',
          'aria-label': 'Move question down',
          onClick: () => {
            const copy = [...state.questions];
            [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
            store.setState({ questions: copy });
            renderPanel();
          },
        });

        const removeBtn = el('button', {
          type: 'button',
          className: 'btn btn--outline-muted btn--sm',
          text: 'Remove',
          onClick: () => {
            store.setState({ questions: state.questions.filter((_, i) => i !== idx) });
            renderPanel();
          },
        });

        return el('div', { className: 'survey-question-card' }, [
          el('div', { className: 'between' }, [
            el('span', { className: 'badge badge--neutral', text: `Q${idx + 1} · ${q.type.replace('_', ' ')}` }),
            el('div', { className: 'cluster' }, [moveUp, moveDown, removeBtn]),
          ]),
          promptInput,
          q.options.length > 0
            ? el('div', { className: 'text-xs text-muted', text: `Options: ${q.options.join(' | ')}` })
            : null,
        ]);
      }),
    );

    const saveStatus = el('div', { 'aria-live': 'polite' });
    const submitAction = async (targetStatus) => {
      clearElement(saveStatus);
      const res = await saveSurvey({
        title: store.getState().surveyTitle,
        status: targetStatus,
        questions: store.getState().questions,
      });
      saveStatus.appendChild(
        createAlert({
          variant: res.code === 'VALIDATION_ERROR' ? 'danger' : 'warning',
          title: res.code === 'VALIDATION_ERROR' ? 'Validation Error' : 'Backend Save Pending (Phase 3)',
          message: res.message,
        }),
      );
      showToast({ message: res.message, variant: 'warning' });
    };

    const canvas = el('section', { className: 'card stack' }, [
      saveStatus,
      el('div', { className: 'between' }, [
        el('strong', { className: 'text-sm', text: 'Survey Canvas' }),
        createStatusBadge(state.surveyStatus, 'neutral'),
      ]),
      titleInput,
      questionsWrap,
      el('div', { className: 'cluster', style: 'justify-content: flex-end;' }, [
        el('button', {
          type: 'button',
          className: 'btn btn--outline-muted',
          text: 'Save as Draft',
          onClick: () => submitAction('Draft'),
        }),
        el('button', {
          type: 'button',
          className: 'btn btn--primary',
          text: 'Publish Survey',
          onClick: () => submitAction('Published'),
        }),
      ]),
    ]);

    const summaryCard = el('aside', { className: 'card stack' }, [
      el('strong', { className: 'text-sm', text: 'Responses Summary' }),
      el('div', { className: 'grid grid-2' }, [
        el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Responses' }), el('strong', { className: 'page-title', text: String(ADMIN_EXTENDED_FIXTURE.survey.totalResponses) })]),
        el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Avg. Rating' }), el('strong', { className: 'page-title', text: `${ADMIN_EXTENDED_FIXTURE.survey.avgRating} ★` })]),
      ]),
      ...ADMIN_EXTENDED_FIXTURE.survey.topFeedback.map((item) =>
        el('div', { className: 'meter-row' }, [
          el('div', { className: 'between text-xs' }, [
            el('span', { text: item.label }),
            el('strong', { text: `${item.pct}%` }),
          ]),
          el('div', { className: 'meter-track' }, [
            el('div', { className: 'meter-track__fill', style: `width: ${item.pct}%;` }),
          ]),
        ]),
      ),
      el('a', { href: '../survey.html', className: 'btn btn--secondary btn--sm btn--block', text: 'Open Customer Survey View' }),
    ]);

    host.appendChild(el('div', { className: 'survey-builder-grid' }, [palette, canvas, summaryCard]));
  }

  qs('#create-survey-btn')?.addEventListener('click', () => {
    store.setState({
      activeTab: 'builder',
      surveyTitle: 'New Member Feedback Survey',
      surveyStatus: 'Draft',
      questions: [{ id: 'q-new-1', type: 'rating', prompt: 'Rate your experience with BONFREE-HUB', options: [] }],
    });
    renderTabs();
    renderPanel();
  });

  renderTabs();
  renderPanel();
}
