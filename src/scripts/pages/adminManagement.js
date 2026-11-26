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
  CAMPAIGN_ASSET_OPTIONS,
  computeSurveyAnalytics,
  fetchAdminCampaigns,
  fetchAdminPurchases,
  fetchAdminSurveys,
  fetchStaffActivityLog,
  fetchStaffDirectory,
  saveCampaign,
  saveStaffMember,
  saveStaffPermissionOverrides,
  saveSurvey,
  sendStaffPasswordSetup,
  toggleCampaignStatus,
  toggleStaffAccountStatus,
  updateSurveyStatus,
  uploadCampaignImage,
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
    allRows: [],
    loading: true,
    dateFrom: '',
    dateTo: '',
    query: '',
    status: 'all',
    sortBy: 'date-desc',
    page: 1,
  });

  function getFiltered() {
    const { allRows, dateFrom, dateTo, query, status, sortBy } = store.getState();
    const q = query.trim().toLowerCase();

    let rows = allRows.filter((p) => {
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
    const { page, loading } = store.getState();
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
      loading,
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
    triggerCsvDownload('bonfree-hub-purchase-records.csv', csv);
    showToast({ message: `Exported ${rows.length} purchase records to CSV.`, variant: 'success' });
  });

  render();
  fetchAdminPurchases().then((res) => {
    store.setState({
      loading: false,
      allRows: res.ok ? res.rows || [] : [],
    });
    if (!res.ok) {
      showToast({ message: res.message || 'Unable to load purchase records.', variant: 'danger' });
    }
    render();
  });
}

/* --------------------------------------------------------------------------
   2. Staff Management (admin/staff.html)
   -------------------------------------------------------------------------- */
function openStaffFormModal(existing = null, stores = [], onSaved = () => {}) {
  const isEdit = Boolean(existing);
  const statusRegion = el('div', { 'aria-live': 'polite' });

  const storeSelect = el('select', { id: 'stf-store', name: 'storeId', className: 'select' }, [
    el('option', { value: '', text: 'Head Office / Unassigned', selected: !existing?.storeId }),
    ...stores
      .filter((s) => s.id)
      .map((s) => el('option', { value: s.id, text: s.name, selected: existing?.storeId === s.id })),
  ]);

  const form = el('form', { className: 'form-stack', novalidate: true }, [
    statusRegion,
    el('div', { className: 'grid grid-2' }, [
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'stf-id', text: 'Staff ID *' }),
        el('input', {
          id: 'stf-id',
          name: 'staffId',
          type: 'text',
          className: 'input',
          value: existing?.id || 'STF1006',
          readonly: isEdit,
          required: true,
        }),
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'stf-name', text: 'Full Name *' }),
        el('input', { id: 'stf-name', name: 'name', type: 'text', className: 'input', value: existing?.name || '', required: true }),
      ]),
    ]),
    el('div', { className: 'field' }, [
      el('label', { className: 'field__label', for: 'stf-email', text: 'Work Email *' }),
      el('input', {
        id: 'stf-email',
        name: 'email',
        type: 'email',
        className: 'input',
        value: existing?.email || '',
        readonly: isEdit,
        required: true,
      }),
    ]),
    el('div', { className: 'grid grid-2' }, [
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
        el('label', { className: 'field__label', for: 'stf-status', text: 'Account Status' }),
        el('select', { id: 'stf-status', name: 'status', className: 'select' }, [
          el('option', { value: 'Active', text: 'Active', selected: !existing || existing.status === 'Active' }),
          el('option', { value: 'Inactive', text: 'Inactive', selected: existing?.status === 'Inactive' }),
        ]),
      ]),
    ]),
    el('div', { className: 'grid grid-2' }, [
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'stf-store', text: 'Assigned Store' }),
        storeSelect,
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'stf-dept', text: 'Department Label' }),
        el('input', { id: 'stf-dept', name: 'department', type: 'text', className: 'input', value: existing?.department || 'Bengaluru — MG Road' }),
      ]),
    ]),
    createAlert({
      variant: 'info',
      title: 'Backend RBAC & Invite Setup',
      message: isEdit
        ? 'Deactivating a staff account immediately terminates active admin access on the backend.'
        : 'New staff receive a verified Supabase Auth invitation email to set their password.',
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
      const res = await saveStaffMember({ uuid: existing?.uuid || null, ...values });
      setButtonLoading(submitBtn, false);
      if (!res.ok) {
        statusRegion.appendChild(
          createAlert({
            variant: res.code === 'SUPABASE_NOT_CONFIGURED' ? 'warning' : 'danger',
            title: res.code === 'SUPABASE_NOT_CONFIGURED' ? 'Backend Connection Required' : 'Operation Blocked',
            message: res.message,
          }),
        );
        showToast({ message: res.message, variant: res.code === 'SUPABASE_NOT_CONFIGURED' ? 'warning' : 'danger' });
      } else {
        closeModal();
        showToast({
          message: isEdit ? `Updated ${values.name}.` : `Staff invitation issued to ${values.email}.`,
          variant: 'success',
        });
        onSaved();
      }
    },
  });

  const resetBtn = isEdit
    ? el('button', {
        type: 'button',
        className: 'btn btn--outline-muted',
        text: 'Send Password Reset',
        onClick: async () => {
          clearElement(statusRegion);
          setButtonLoading(resetBtn, true, 'Sending...');
          const res = await sendStaffPasswordSetup({ staffUuid: existing.uuid, email: existing.email });
          setButtonLoading(resetBtn, false);
          statusRegion.appendChild(
            createAlert({
              variant: res.ok ? 'success' : res.code === 'SUPABASE_NOT_CONFIGURED' ? 'warning' : 'danger',
              title: res.ok ? 'Password Link Sent' : 'Reset Status',
              message: res.message,
            }),
          );
        },
      })
    : null;

  openModal({
    title: isEdit ? `Edit Staff — ${existing.name}` : 'Add Store / Back-Office Staff',
    body: form,
    footerActions: [
      el('button', { type: 'button', className: 'btn btn--outline-muted', text: 'Cancel', onClick: closeModal }),
      resetBtn,
      submitBtn,
    ].filter(Boolean),
  });
}

function openStaffPermissionsModal(staff, allPermissions = [], roleDefaultSet = new Set(), onSaved = () => {}) {
  const statusRegion = el('div', { 'aria-live': 'polite' });
  const draftOverrides = { ...(staff.overrides || {}) };

  const listWrap = el('div', { className: 'stack', style: 'gap: 0.65rem; max-height: 55vh; overflow-y: auto;' }, [
    statusRegion,
    createAlert({
      variant: 'info',
      title: `Role Baseline: ${staff.role}`,
      message: 'Leave permissions on Role Default or explicitly grant/revoke per individual staff member.',
    }),
    ...allPermissions.map((perm) => {
      const roleHas = roleDefaultSet.has(perm.code);
      const currentOverride =
        draftOverrides[perm.code] === true ? 'grant' : draftOverrides[perm.code] === false ? 'revoke' : 'default';

      const select = el('select', { className: 'select', 'aria-label': `Permission ${perm.code}`, style: 'width: auto; min-width: 170px;' }, [
        el('option', { value: 'default', text: `Role Default (${roleHas ? 'Allowed' : 'Denied'})`, selected: currentOverride === 'default' }),
        el('option', { value: 'grant', text: 'Explicitly Grant', selected: currentOverride === 'grant' }),
        el('option', { value: 'revoke', text: 'Explicitly Revoke', selected: currentOverride === 'revoke' }),
      ]);

      select.addEventListener('change', (e) => {
        if (e.target.value === 'grant') draftOverrides[perm.code] = true;
        else if (e.target.value === 'revoke') draftOverrides[perm.code] = false;
        else delete draftOverrides[perm.code];
      });

      return el('div', { className: 'between', style: 'gap: 0.75rem; padding-block: 0.35rem; border-bottom: 1px solid var(--border-subtle);' }, [
        el('div', { style: 'min-width: 0;' }, [
          el('div', { className: 'text-sm', style: 'font-weight: 500;', text: perm.description || perm.code }),
          el('div', { className: 'text-xs text-muted', text: perm.code }),
        ]),
        select,
      ]);
    }),
  ]);

  const saveBtn = el('button', {
    type: 'button',
    className: 'btn btn--primary',
    text: 'Save Permissions',
    onClick: async () => {
      clearElement(statusRegion);
      setButtonLoading(saveBtn, true, 'Saving...');
      const res = await saveStaffPermissionOverrides({
        staffUuid: staff.uuid || staff.id,
        overrides: draftOverrides,
      });
      setButtonLoading(saveBtn, false);
      if (!res.ok) {
        statusRegion.appendChild(
          createAlert({
            variant: res.code === 'SUPABASE_NOT_CONFIGURED' ? 'warning' : 'danger',
            title: res.code === 'SUPABASE_NOT_CONFIGURED' ? 'Backend Connection Required' : 'Permission Update Rejected',
            message: res.message,
          }),
        );
        showToast({ message: res.message, variant: res.code === 'SUPABASE_NOT_CONFIGURED' ? 'warning' : 'danger' });
      } else {
        closeModal();
        showToast({ message: `Updated granular permissions for ${staff.name}.`, variant: 'success' });
        onSaved();
      }
    },
  });

  openModal({
    title: `Permissions — ${staff.name} (${staff.id})`,
    body: listWrap,
    footerActions: [
      el('button', { type: 'button', className: 'btn btn--outline-muted', text: 'Cancel', onClick: closeModal }),
      saveBtn,
    ],
  });
}

async function openStaffActivityModal(staff) {
  const activityHost = el('ul', { className: 'stack', style: 'gap: 0.35rem;' }, [
    el('li', { className: 'text-xs text-muted', text: 'Loading audit & operations activity...' }),
  ]);

  openModal({
    title: `Staff Activity — ${staff.name} (${staff.id})`,
    body: el('div', { className: 'stack' }, [
      el('div', { className: 'grid grid-2 card card--ivory' }, [
        el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Role & Store' }), el('strong', { className: 'text-sm', text: `${staff.role} · ${staff.department}` })]),
        el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Operations Count' }), el('strong', { className: 'text-sm', text: `${staff.stampsIssuedCount} stamps · ${staff.redemptionsVerifiedCount} redemptions` })]),
      ]),
      el('div', { className: 'stack', style: 'gap: 0.35rem;' }, [
        el('strong', { className: 'text-sm', text: 'Recent Audit Log & Operational Activity' }),
        activityHost,
      ]),
    ]),
    footerActions: [
      el('button', { type: 'button', className: 'btn btn--primary btn--sm', text: 'Close', onClick: closeModal }),
    ],
  });

  const res = await fetchStaffActivityLog(staff.uuid);
  clearElement(activityHost);

  const items = [];
  if (res.ok && res.source !== 'development-fixture') {
    const data = res.data || res;
    for (const log of data.auditLogs || []) {
      items.push(`[Audit] ${log.action} on ${log.entity_type} (${new Date(log.created_at).toLocaleString('en-GB')})`);
    }
    for (const tx of data.stampTransactions || []) {
      items.push(`[Stamps] ${tx.transaction_code} (${tx.stamps_delta > 0 ? `+${tx.stamps_delta}` : tx.stamps_delta}): ${tx.notes}`);
    }
    for (const rdm of data.redemptions || []) {
      items.push(`[Redemption] ${rdm.voucher_code} -> ${rdm.status}`);
    }
  } else if (Array.isArray(staff.recentActivity)) {
    items.push(...staff.recentActivity);
  }

  if (items.length === 0) {
    activityHost.appendChild(el('li', { className: 'text-xs text-muted', text: 'No recorded activity events yet.' }));
    return;
  }

  for (const line of items) {
    activityHost.appendChild(el('li', { className: 'text-xs text-muted', text: `• ${line}` }));
  }
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
    staff: [],
    roles: [],
    permissions: [],
    rolePermissions: [],
    roleMatrix: ADMIN_EXTENDED_FIXTURE.roleMatrix,
    stores: [],
    loading: true,
  });

  async function loadDirectory() {
    store.setState({ loading: true });
    renderPanel();
    const res = await fetchStaffDirectory();
    if (!res.ok) {
      store.setState({ loading: false, staff: [] });
      showToast({ message: res.message || 'Unable to load staff directory.', variant: 'danger' });
    } else {
      store.setState({
        loading: false,
        staff: res.staff || [],
        roles: res.roles || [],
        permissions: res.permissions || [],
        rolePermissions: res.rolePermissions || [],
        roleMatrix: res.roleMatrix || ADMIN_EXTENDED_FIXTURE.roleMatrix,
        stores: res.stores || [],
      });
    }
    renderPanel();
  }

  function getRolePermissionSet(roleCode) {
    const { roles, permissions, rolePermissions } = store.getState();
    const role = roles.find((r) => r.code === roleCode);
    if (!role || rolePermissions.length === 0) {
      const colName =
        roleCode === 'administrator'
          ? 'Administrator'
          : roleCode === 'store_manager'
          ? 'Store Manager'
          : roleCode === 'sales_staff'
          ? 'Sales Staff'
          : 'Marketing Staff';
      const allowed = new Set();
      for (const row of store.getState().roleMatrix) {
        const m = /\(([^)]+)\)/.exec(row.capability);
        if (m && row[colName]) allowed.add(m[1]);
      }
      return allowed;
    }
    const permById = new Map(permissions.map((p) => [p.id, p.code]));
    const set = new Set();
    for (const rp of rolePermissions) {
      if (rp.role_id === role.id && permById.has(rp.permission_id)) {
        set.add(permById.get(rp.permission_id));
      }
    }
    return set;
  }

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
    const { activeTab, query, role, status, staff, permissions, roleMatrix, stores, loading } = store.getState();

    if (activeTab === 'roles') {
      const matrixTable = el('div');
      const tick = (allowed) =>
        createStatusBadge(allowed ? 'Allowed' : 'Restricted', allowed ? 'active' : 'inactive');

      renderDataTable(matrixTable, {
        loading,
        rows: roleMatrix,
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
          message: 'Sidebar navigation hides restricted modules, while PostgreSQL RLS & Edge Functions enforce authorization on every API call.',
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
    const filtered = staff.filter((s) => {
      const mQ = !q || s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
      const mR = role === 'all' || s.role === role;
      const mS = status === 'all' || s.status.toLowerCase() === status;
      return mQ && mR && mS;
    });

    const tableHost = el('div');
    renderDataTable(tableHost, {
      loading,
      rows: filtered,
      page: 1,
      pageSize: 10,
      totalItems: filtered.length,
      emptyMessage: 'No staff accounts match your filter.',
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
          render: (row) => {
            const nextStatus = row.status === 'Active' ? 'inactive' : 'active';
            const toggleBtn = el('button', {
              type: 'button',
              className: 'btn btn--outline-muted btn--sm',
              text: row.status === 'Active' ? 'Deactivate' : 'Activate',
              onClick: async () => {
                setButtonLoading(toggleBtn, true, '...');
                const res = await toggleStaffAccountStatus({
                  staffUuid: row.uuid || row.id,
                  nextStatus,
                });
                setButtonLoading(toggleBtn, false);
                if (!res.ok) {
                  showToast({
                    message: res.message,
                    variant: res.code === 'SUPABASE_NOT_CONFIGURED' ? 'warning' : 'danger',
                  });
                } else {
                  showToast({ message: `${row.name} marked ${nextStatus}.`, variant: 'success' });
                  loadDirectory();
                }
              },
            });

            return el('div', { className: 'cluster', style: 'gap: 0.35rem; flex-wrap: wrap;' }, [
              el('button', {
                type: 'button',
                className: 'btn btn--outline-muted btn--sm',
                text: 'Edit',
                onClick: () => openStaffFormModal(row, stores, loadDirectory),
              }),
              el('button', {
                type: 'button',
                className: 'btn btn--outline-muted btn--sm',
                text: 'Permissions',
                onClick: () =>
                  openStaffPermissionsModal(
                    row,
                    permissions,
                    getRolePermissionSet(
                      row.roleCode ||
                        row.role.toLowerCase().replace(/\s+/g, '_'),
                    ),
                    loadDirectory,
                  ),
              }),
              toggleBtn,
              el('button', {
                type: 'button',
                className: 'btn btn--outline-muted btn--sm',
                text: 'Activity',
                onClick: () => openStaffActivityModal(row),
              }),
            ]);
          },
        },
      ],
    });

    host.append(toolbar, tableHost);
  }

  qs('#add-staff-btn')?.addEventListener('click', () => {
    const { stores } = store.getState();
    openStaffFormModal(null, stores, loadDirectory);
  });

  renderTabs();
  loadDirectory();
}

/* --------------------------------------------------------------------------
   3. Campaigns (admin/campaigns.html)
   -------------------------------------------------------------------------- */
function openCampaignFormModal(existing = null, programmes = [], onSaved = () => {}) {
  const isEdit = Boolean(existing);
  const statusRegion = el('div', { 'aria-live': 'polite' });
  let uploadedImageUrl = existing?.rawImagePath || '';

  const imagePresetSelect = el(
    'select',
    { id: 'camp-img-preset', name: 'imagePath', className: 'select' },
    CAMPAIGN_ASSET_OPTIONS.map((opt) =>
      el('option', {
        value: opt.path,
        text: opt.label,
        selected: existing?.rawImagePath === opt.path || existing?.image?.endsWith(opt.path),
      }),
    ),
  );

  const fileInput = el('input', {
    id: 'camp-img-file',
    type: 'file',
    accept: 'image/png,image/jpeg,image/webp',
    className: 'input',
    'aria-label': 'Upload campaign banner image',
  });

  const programmeSelect = el(
    'select',
    { id: 'camp-programme', name: 'programmeId', className: 'select' },
    [
      el('option', { value: '', text: 'All Active Programmes', selected: !existing?.programmeId }),
      ...programmes.map((p) =>
        el('option', { value: p.id, text: p.name, selected: existing?.programmeId === p.id }),
      ),
    ],
  );

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
        el('input', { id: 'camp-start', name: 'startDate', type: 'date', className: 'input', value: existing?.startDate || new Date().toISOString().slice(0, 10), required: true }),
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'camp-end', text: 'End Date *' }),
        el('input', { id: 'camp-end', name: 'endDate', type: 'date', className: 'input', value: existing?.endDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), required: true }),
      ]),
    ]),
    el('div', { className: 'grid grid-3' }, [
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'camp-mult', text: 'Multiplier (1x–10x)' }),
        el('input', { id: 'camp-mult', name: 'multiplier', type: 'number', step: '0.5', min: '1', max: '10', className: 'input', value: String(existing?.multiplier ?? 1) }),
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'camp-bonus', text: 'Bonus Stamps (+N)' }),
        el('input', { id: 'camp-bonus', name: 'bonusStamps', type: 'number', min: '0', className: 'input', value: String(existing?.bonusStamps ?? 0) }),
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'camp-min', text: 'Min Spend (₹)' }),
        el('input', { id: 'camp-min', name: 'minPurchaseInr', type: 'number', min: '0', className: 'input', value: String(existing?.minPurchaseInr ?? 0) }),
      ]),
    ]),
    el('div', { className: 'grid grid-2' }, [
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'camp-programme', text: 'Loyalty Programme' }),
        programmeSelect,
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'camp-status', text: 'Campaign Status' }),
        el('select', { id: 'camp-status', name: 'status', className: 'select' }, [
          el('option', { value: 'Active', text: 'Active', selected: !existing || existing.status === 'Active' }),
          el('option', { value: 'Scheduled', text: 'Scheduled', selected: existing?.status === 'Scheduled' }),
          el('option', { value: 'Inactive', text: 'Inactive', selected: existing?.status === 'Inactive' }),
          el('option', { value: 'Completed', text: 'Completed', selected: existing?.status === 'Completed' }),
        ]),
      ]),
    ]),
    el('div', { className: 'grid grid-2' }, [
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'camp-rule', text: 'Promotional Offer Label' }),
        el('input', { id: 'camp-rule', name: 'rule', type: 'text', className: 'input', value: existing?.rule || '2x Stamp Multiplier on New Drops' }),
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'camp-elig', text: 'Customer Eligibility' }),
        el('input', { id: 'camp-elig', name: 'eligibilityRule', type: 'text', className: 'input', value: existing?.eligibilityRule || 'All active BONFREE-HUB members' }),
      ]),
    ]),
    el('div', { className: 'grid grid-2' }, [
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'camp-img-preset', text: 'Brand Streetwear Visual' }),
        imagePresetSelect,
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'camp-img-file', text: 'Or Upload Custom Banner (JPG/PNG)' }),
        fileInput,
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
      let finalImagePath = values.imagePath;

      if (fileInput.files && fileInput.files[0]) {
        const upRes = await uploadCampaignImage(fileInput.files[0]);
        if (!upRes.ok) {
          setButtonLoading(submitBtn, false);
          statusRegion.appendChild(
            createAlert({
              variant: upRes.code === 'SUPABASE_NOT_CONFIGURED' ? 'warning' : 'danger',
              title: 'Image Upload Status',
              message: upRes.message,
            }),
          );
          return;
        }
        finalImagePath = upRes.publicUrl;
      } else if (uploadedImageUrl && /^https?:\/\//i.test(uploadedImageUrl)) {
        finalImagePath = uploadedImageUrl;
      }

      const res = await saveCampaign({
        id: existing?.id || null,
        ...values,
        imagePath: finalImagePath,
      });
      setButtonLoading(submitBtn, false);
      if (!res.ok) {
        statusRegion.appendChild(
          createAlert({
            variant: res.code === 'SUPABASE_NOT_CONFIGURED' ? 'warning' : 'danger',
            title: res.code === 'SUPABASE_NOT_CONFIGURED' ? 'Backend Connection Required' : 'Validation Error',
            message: res.message,
          }),
        );
        showToast({ message: res.message, variant: res.code === 'SUPABASE_NOT_CONFIGURED' ? 'warning' : 'danger' });
      } else {
        closeModal();
        showToast({ message: isEdit ? `Campaign "${values.title}" updated.` : `Campaign "${values.title}" created.`, variant: 'success' });
        onSaved();
      }
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
  const store = createStore({ activeTab: 'All', campaigns: [], programmes: [], loading: true });

  async function loadCampaigns() {
    store.setState({ loading: true });
    renderGrid();
    const res = await fetchAdminCampaigns();
    if (!res.ok) {
      store.setState({ loading: false, campaigns: [], programmes: [] });
      showToast({ message: res.message || 'Unable to load campaigns.', variant: 'danger' });
    } else {
      store.setState({ loading: false, campaigns: res.campaigns || [], programmes: res.programmes || [] });
    }
    renderKpis();
    renderTabs();
    renderGrid();
  }

  function renderKpis() {
    const { campaigns } = store.getState();
    clearElement(kpiHost);
    const counts = {
      All: campaigns.length,
      Active: campaigns.filter((c) => c.status === 'Active').length,
      Scheduled: campaigns.filter((c) => c.status === 'Scheduled').length,
      Completed: campaigns.filter((c) => c.status === 'Completed' || c.status === 'Inactive').length,
    };

    for (const [label, val] of [
      ['Total Campaigns', counts.All],
      ['Active Now', counts.Active],
      ['Scheduled', counts.Scheduled],
      ['Completed / Inactive', counts.Completed],
    ]) {
      kpiHost.appendChild(
        el('article', { className: 'kpi-card' }, [
          el('div', { className: 'kpi-card__top', text: label }),
          el('div', { className: 'kpi-card__value', style: 'font-size: 1.5rem;', text: String(val) }),
        ]),
      );
    }
  }

  function renderTabs() {
    clearElement(tabsHost);
    const { activeTab, campaigns } = store.getState();
    const counts = {
      All: campaigns.length,
      Active: campaigns.filter((c) => c.status === 'Active').length,
      Scheduled: campaigns.filter((c) => c.status === 'Scheduled').length,
      Completed: campaigns.filter((c) => c.status === 'Completed').length,
      Inactive: campaigns.filter((c) => c.status === 'Inactive').length,
    };
    for (const tab of ['All', 'Active', 'Scheduled', 'Completed', 'Inactive']) {
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
    const { activeTab, campaigns, programmes, loading } = store.getState();

    if (loading) {
      gridHost.appendChild(el('div', { className: 'card text-sm text-muted', text: 'Loading streetwear campaigns...' }));
      return;
    }

    const list = activeTab === 'All' ? campaigns : campaigns.filter((c) => c.status === activeTab);
    if (list.length === 0) {
      gridHost.appendChild(el('div', { className: 'card text-sm text-muted', text: `No ${activeTab.toLowerCase()} campaigns found.` }));
      return;
    }

    for (const camp of list) {
      const toggleInput = el('input', { type: 'checkbox', checked: camp.status === 'Active' });
      toggleInput.addEventListener('change', async () => {
        const nextStatus = toggleInput.checked ? 'active' : 'inactive';
        const res = await toggleCampaignStatus({ campaignId: camp.id, nextStatus });
        if (!res.ok) {
          toggleInput.checked = camp.status === 'Active';
          showToast({
            message: res.message,
            variant: res.code === 'SUPABASE_NOT_CONFIGURED' ? 'warning' : 'danger',
          });
        } else {
          showToast({ message: `"${camp.title}" is now ${nextStatus}.`, variant: 'success' });
          loadCampaigns();
        }
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
              el('div', { className: 'text-xs text-muted', text: `${camp.programmeName || 'All Programmes'} · ${camp.eligibilityRule || 'All members'}` }),
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
                onClick: () => openCampaignFormModal(camp, programmes, loadCampaigns),
              }),
            ]),
          ]),
        ]),
      );
    }
  }

  qs('#create-campaign-btn')?.addEventListener('click', () => {
    const { programmes } = store.getState();
    openCampaignFormModal(null, programmes, loadCampaigns);
  });

  loadCampaigns();
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
    surveys: [],
    selectedSurveyId: null,
    programmes: [],
    surveyTitle: ADMIN_EXTENDED_FIXTURE.survey.title,
    surveySubtitle: ADMIN_EXTENDED_FIXTURE.survey.subtitle,
    programmeId: '',
    surveyStatus: ADMIN_EXTENDED_FIXTURE.survey.status,
    questions: ADMIN_EXTENDED_FIXTURE.survey.questions.map((q) => ({ ...q, options: [...q.options] })),
    responses: ADMIN_EXTENDED_FIXTURE.survey.responses,
    totalResponses: ADMIN_EXTENDED_FIXTURE.survey.totalResponses,
    avgRating: ADMIN_EXTENDED_FIXTURE.survey.avgRating,
    topFeedback: ADMIN_EXTENDED_FIXTURE.survey.topFeedback,
    loading: true,
  });

  function applySelectedSurvey(sv) {
    if (!sv) return;
    store.setState({
      selectedSurveyId: sv.id,
      surveyTitle: sv.title,
      surveySubtitle: sv.subtitle || '',
      programmeId: sv.programmeId || '',
      surveyStatus: sv.status || 'Draft',
      questions: (sv.questions || []).map((q) => ({ ...q, options: [...(q.options || [])] })),
      responses: sv.responses || [],
      totalResponses: sv.totalResponses ?? (sv.responses?.length || 0),
      avgRating: sv.avgRating ?? '0.0',
      topFeedback: sv.topFeedback || [],
    });
  }

  async function loadSurveys(preferredId = null) {
    store.setState({ loading: true });
    renderPanel();
    const res = await fetchAdminSurveys();
    if (!res.ok) {
      store.setState({ loading: false });
      showToast({ message: res.message || 'Unable to load surveys.', variant: 'danger' });
      renderPanel();
      return;
    }

    const list = res.surveys || [];
    const targetId = preferredId || store.getState().selectedSurveyId;
    const selected = list.find((s) => s.id === targetId) || list[0] || null;
    store.setState({ loading: false, source: res.source || 'development-fixture', surveys: list, programmes: res.programmes || [] });
    if (selected) applySelectedSurvey(selected);
    renderTabs();
    renderPanel();
  }

  function renderTabs() {
    clearElement(tabsHost);
    const { activeTab, totalResponses } = store.getState();
    for (const [id, label] of [
      ['builder', 'Survey Builder'],
      ['responses', `Responses (${totalResponses})`],
      ['summary', 'Summary & Analytics'],
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

    if (state.loading) {
      host.appendChild(el('div', { className: 'card text-sm text-muted', text: 'Loading surveys & feedback analytics...' }));
      return;
    }

    const liveAnalytics =
      state.source === 'supabase-live' || (state.responses && state.responses.length !== ADMIN_EXTENDED_FIXTURE.survey.responses.length)
        ? computeSurveyAnalytics(state.questions, state.responses)
        : { totalResponses: state.totalResponses, avgRating: state.avgRating, topFeedback: state.topFeedback };

    if (state.activeTab === 'responses') {
      const tableHost = el('div');
      renderDataTable(tableHost, {
        rows: state.responses,
        pageSize: 10,
        totalItems: state.responses.length,
        emptyMessage: 'No member responses submitted for this survey yet.',
        columns: [
          { key: 'memberId', label: 'Member ID' },
          { key: 'memberName', label: 'Member' },
          { key: 'rating', label: 'Rating (★)' },
          { key: 'favorite', label: 'Highlighted Response' },
          { key: 'submittedOn', label: 'Submitted' },
        ],
      });
      host.appendChild(tableHost);
      return;
    }

    if (state.activeTab === 'summary') {
      host.appendChild(
        el('div', { className: 'card stack' }, [
          el('h2', { className: 'card__title', text: `Survey Analytics — ${state.surveyTitle}` }),
          el('p', {
            className: 'text-sm text-muted',
            text: `${liveAnalytics.totalResponses} total responses · Average Rating: ${liveAnalytics.avgRating} / 5.0`,
          }),
          ...(liveAnalytics.topFeedback.length > 0
            ? liveAnalytics.topFeedback.map((item) =>
                el('div', { className: 'meter-row' }, [
                  el('div', { className: 'between text-xs' }, [
                    el('span', { text: item.label }),
                    el('strong', { text: `${item.pct}%${item.count !== undefined ? ` (${item.count})` : ''}` }),
                  ]),
                  el('div', { className: 'meter-track' }, [
                    el('div', { className: 'meter-track__fill', style: `width: ${item.pct}%;` }),
                  ]),
                ]),
              )
            : [el('p', { className: 'text-xs text-muted', text: 'No multiple-choice answer distribution data available yet.' })]),
        ]),
      );
      return;
    }

    // Builder 3-column layout
    const surveySwitcher =
      state.surveys.length > 0
        ? el('div', { className: 'field' }, [
            el('label', { className: 'field__label', for: 'survey-switcher', text: 'Select Existing Survey' }),
            el(
              'select',
              {
                id: 'survey-switcher',
                className: 'select',
                onChange: (e) => {
                  const chosen = state.surveys.find((s) => s.id === e.target.value);
                  if (chosen) {
                    applySelectedSurvey(chosen);
                    renderTabs();
                    renderPanel();
                  }
                },
              },
              state.surveys.map((s) =>
                el('option', {
                  value: s.id,
                  text: `${s.title} (${s.status})`,
                  selected: s.id === state.selectedSurveyId,
                }),
              ),
            ),
          ])
        : null;

    const palette = el('aside', { className: 'card stack' }, [
      surveySwitcher,
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
      placeholder: 'Survey title...',
      'aria-label': 'Survey Title',
    });
    titleInput.addEventListener('input', (e) => {
      store.setState({ surveyTitle: e.target.value });
    });

    const subtitleInput = el('input', {
      type: 'text',
      className: 'input',
      value: state.surveySubtitle,
      placeholder: 'Short description for members...',
      'aria-label': 'Survey Subtitle',
    });
    subtitleInput.addEventListener('input', (e) => {
      store.setState({ surveySubtitle: e.target.value });
    });

    const progSelect = el(
      'select',
      {
        className: 'select',
        'aria-label': 'Eligible loyalty programme',
        onChange: (e) => store.setState({ programmeId: e.target.value }),
      },
      [
        el('option', { value: '', text: 'Eligible: All Active Members', selected: !state.programmeId }),
        ...state.programmes.map((p) =>
          el('option', { value: p.id, text: `Eligible: ${p.name} Members`, selected: state.programmeId === p.id }),
        ),
      ],
    );

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

        const optionsInput =
          q.type === 'multiple_choice'
            ? el('input', {
                type: 'text',
                className: 'input',
                value: (q.options || []).join(', '),
                placeholder: 'Comma-separated choices...',
                'aria-label': `Question ${idx + 1} options`,
              })
            : null;
        if (optionsInput) {
          optionsInput.addEventListener('input', (e) => {
            state.questions[idx].options = e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
          });
        }

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
          optionsInput,
        ]);
      }),
    );

    const saveStatus = el('div', { 'aria-live': 'polite' });
    const submitAction = async (targetStatus) => {
      clearElement(saveStatus);
      const cur = store.getState();
      const res = await saveSurvey({
        id: cur.selectedSurveyId,
        title: cur.surveyTitle,
        subtitle: cur.surveySubtitle,
        programmeId: cur.programmeId || null,
        status: targetStatus,
        questions: cur.questions,
      });
      if (!res.ok) {
        saveStatus.appendChild(
          createAlert({
            variant: res.code === 'VALIDATION_ERROR' ? 'danger' : 'warning',
            title: res.code === 'VALIDATION_ERROR' ? 'Validation Error' : 'Backend Connection Required',
            message: res.message,
          }),
        );
        showToast({ message: res.message, variant: res.code === 'VALIDATION_ERROR' ? 'danger' : 'warning' });
      } else {
        showToast({ message: `Survey saved as ${targetStatus}.`, variant: 'success' });
        await loadSurveys(res.surveyId);
      }
    };

    const closeSurveyBtn =
      state.selectedSurveyId && state.surveyStatus === 'Published'
        ? el('button', {
            type: 'button',
            className: 'btn btn--danger',
            text: 'Close Survey',
            onClick: async () => {
              const res = await updateSurveyStatus({ surveyId: state.selectedSurveyId, status: 'closed' });
              if (!res.ok) {
                showToast({ message: res.message, variant: 'warning' });
              } else {
                showToast({ message: 'Survey closed — new submissions blocked.', variant: 'info' });
                await loadSurveys(state.selectedSurveyId);
              }
            },
          })
        : null;

    const statusTone =
      state.surveyStatus === 'Published' ? 'active' : state.surveyStatus === 'Closed' ? 'danger' : 'neutral';

    const canvas = el('section', { className: 'card stack' }, [
      saveStatus,
      el('div', { className: 'between' }, [
        el('strong', { className: 'text-sm', text: 'Survey Canvas' }),
        createStatusBadge(state.surveyStatus, statusTone),
      ]),
      titleInput,
      subtitleInput,
      progSelect,
      questionsWrap,
      el('div', { className: 'cluster', style: 'justify-content: flex-end; flex-wrap: wrap;' }, [
        closeSurveyBtn,
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
      ].filter(Boolean)),
    ]);

    const summaryCard = el('aside', { className: 'card stack' }, [
      el('strong', { className: 'text-sm', text: 'Responses Summary' }),
      el('div', { className: 'grid grid-2' }, [
        el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Responses' }), el('strong', { className: 'page-title', text: String(liveAnalytics.totalResponses) })]),
        el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Avg. Rating' }), el('strong', { className: 'page-title', text: `${liveAnalytics.avgRating} ★` })]),
      ]),
      ...liveAnalytics.topFeedback.map((item) =>
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
      selectedSurveyId: null,
      surveyTitle: 'New Member Feedback Survey',
      surveySubtitle: 'Tell us what streetwear drops & loyalty rewards you want next.',
      programmeId: '',
      surveyStatus: 'Draft',
      responses: [],
      totalResponses: 0,
      avgRating: '0.0',
      topFeedback: [],
      questions: [{ id: 'q-new-1', type: 'rating', prompt: 'Rate your experience with BONFREE-HUB', options: [] }],
    });
    renderTabs();
    renderPanel();
  });

  renderTabs();
  loadSurveys();
}
