/**
 * BONFREE-HUB Admin Insights & System Controllers (Phase 2D / 8C Live Integration)
 * Powers Analytics, Reports & CSV Exports, and Settings.
 */
import { clearElement, el, qs } from '../core/dom.js';
import { isProductionEnvironment } from '../core/config.js';
import { createStore } from '../core/state.js';
import { mountAdminShell } from '../components/adminShell.js';
import { openModal, closeModal } from '../components/modal.js';
import { createAlert, showToast } from '../components/toast.js';
import { createStatusBadge, renderDataTable } from '../components/table.js';
import { setButtonLoading, validateForm } from '../components/form.js';
import { createBarChartSvg, createLineChartSvg } from '../components/charts.js';
import {
  ADMIN_EXTENDED_FIXTURE,
  buildSafeCsv,
  exportAdminReportCsv,
  fetchAdminAnalytics,
  fetchAdminReportPreview,
  fetchAdminSettings,
  saveBrandSettings,
  updateAdminAccountPassword,
} from '../services/adminExtendedService.js';
import { ADMIN_DEV_FIXTURE } from '../services/adminService.js';

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
   1. Analytics (admin/analytics.html)
   -------------------------------------------------------------------------- */
export function initAdminAnalyticsPage() {
  const host = qs('#admin-analytics-host');
  if (!host) return;

  mountAdminShell({ activeId: 'analytics' });

  const periodSelect = qs('#analytics-period');
  const customRangeWrap = qs('#analytics-custom-range');
  const customInputs = customRangeWrap ? customRangeWrap.querySelectorAll('input[type="date"]') : [];
  const customStartInput = customInputs[0] || null;
  const customEndInput = customInputs[1] || null;

  const store = createStore({
    period: 'monthly',
    startDate: '',
    endDate: '',
    loading: true,
    errorMessage: '',
    summary: null,
  });

  async function loadAnalytics() {
    const { period, startDate, endDate } = store.getState();
    store.setState({ loading: true, errorMessage: '' });
    render();
    const res = await fetchAdminAnalytics({ period, startDate, endDate });
    if (!res.ok) {
      store.setState({ loading: false, errorMessage: res.message || 'Unable to load analytics.' });
    } else {
      store.setState({ loading: false, summary: res.summary });
    }
    render();
  }

  function render() {
    clearElement(host);
    const { period, loading, errorMessage, summary } = store.getState();

    if (customRangeWrap) {
      customRangeWrap.hidden = period !== 'custom';
    }

    if (loading) {
      host.appendChild(el('div', { className: 'card text-sm text-muted', text: 'Calculating loyalty analytics...' }));
      return;
    }

    if (errorMessage) {
      host.appendChild(
        createAlert({
          variant: 'danger',
          title: 'Analytics Unavailable',
          message: errorMessage,
        }),
      );
      return;
    }

    const metrics = summary || {};
    const conversionPct =
      Number(metrics.rewardsUnlocked || 0) > 0
        ? `${((Number(metrics.rewardsRedeemed || 0) / Number(metrics.rewardsUnlocked)) * 100).toFixed(1)}% conversion`
        : `${Number(metrics.rewardsRedeemed || 0)} completed`;

    const kpis = [
      [
        'Registered & Active Members',
        Number(metrics.totalMembers || 0).toLocaleString('en-IN'),
        `${Number(metrics.activeMembers || 0).toLocaleString('en-IN')} active · +${Number(metrics.newRegistrations || 0)} in range`,
      ],
      [
        'Stamps Awarded',
        Number(metrics.stampsAwarded || 0).toLocaleString('en-IN'),
        `Purchase frequency: ${metrics.avgPurchaseFrequency ?? 0}x`,
      ],
      [
        'Rewards Unlocked / Redeemed',
        `${Number(metrics.rewardsUnlocked || 0)} / ${Number(metrics.rewardsRedeemed || 0)}`,
        conversionPct,
      ],
      [
        'Qualifying Purchase Revenue',
        `₹${Number(metrics.qualifyingRevenueInr || 0).toLocaleString('en-IN')}`,
        `${Number(metrics.qualifyingPurchases || 0).toLocaleString('en-IN')} qualifying orders`,
      ],
    ];

    const kpiGrid = el(
      'div',
      { className: 'grid grid-4' },
      kpis.map(([label, val, sub]) =>
        el('article', { className: 'kpi-card' }, [
          el('div', { className: 'kpi-card__top', text: label }),
          el('div', { className: 'kpi-card__value', style: 'font-size: 1.65rem;', text: val }),
          el('div', { className: 'kpi-card__delta', text: sub }),
        ]),
      ),
    );

    const growthSeries = Array.isArray(metrics.monthlyGrowth) ? metrics.monthlyGrowth : [];
    const stampBars = Array.isArray(metrics.stampBars) ? metrics.stampBars : [];
    const dailyRegs = Array.isArray(metrics.dailyRegistrations) ? metrics.dailyRegistrations : [];

    const growthCard = el('section', { className: 'card stack' }, [
      el('div', { className: 'between' }, [
        el('h2', { className: 'card__title', text: 'Customer Growth (Monthly Cumulative)' }),
        el('span', { className: 'badge badge--dark', text: `${Number(metrics.totalMembers || 0)} total` }),
      ]),
      createLineChartSvg(growthSeries, { valueKey: 'total', ariaLabel: 'Cumulative customer growth line chart' }),
    ]);

    const barCard = el('section', { className: 'card stack' }, [
      el('div', { className: 'between' }, [
        el('h2', { className: 'card__title', text: 'Stamp Issuance Over Time' }),
        el('span', { className: 'text-xs text-muted', text: `Total: ${Number(metrics.stampsAwarded || 0).toLocaleString('en-IN')}` }),
      ]),
      createBarChartSvg(stampBars, { ariaLabel: 'Stamp issuance bar chart' }),
    ]);

    const dailyRegCard = el('section', { className: 'card stack' }, [
      el('div', { className: 'between' }, [
        el('h2', { className: 'card__title', text: 'Daily Member Registrations' }),
        el('span', { className: 'text-xs text-muted', text: `${Number(metrics.newRegistrations || 0)} signups in window` }),
      ]),
      createBarChartSvg(
        dailyRegs.map((d) => ({ label: d.label, value: Number(d.count || 0) })),
        { ariaLabel: 'Daily customer registrations chart' },
      ),
    ]);

    const activeCustomersTable = el('div');
    renderDataTable(activeCustomersTable, {
      rows: metrics.mostActiveCustomers || [],
      emptyMessage: 'No qualifying customer purchases recorded in this period.',
      columns: [
        { key: 'rank', label: '#' },
        { key: 'name', label: 'Customer' },
        { key: 'memberId', label: 'Member ID' },
        { key: 'stampsEarned', label: 'Stamps Earned' },
        { key: 'rewardsRedeemed', label: 'Rewards Redeemed' },
        {
          key: 'totalSpendInr',
          label: 'Total Spend',
          render: (r) => `₹${Number(r.totalSpendInr || 0).toLocaleString('en-IN')}`,
        },
      ],
    });

    const progPerfTable = el('div');
    renderDataTable(progPerfTable, {
      rows: metrics.programmePerformance || [],
      emptyMessage: 'No loyalty programmes configured yet.',
      columns: [
        { key: 'name', label: 'Programme' },
        { key: 'members', label: 'Enrolled Members' },
        { key: 'stamps', label: 'Stamps Issued' },
        { key: 'redemptionRate', label: 'Redemption Rate' },
      ],
    });

    const staffPerfTable = el('div');
    renderDataTable(staffPerfTable, {
      rows: metrics.staffActivity || [],
      emptyMessage: 'No staff activity recorded in this period.',
      columns: [
        { key: 'id', label: 'Staff ID' },
        { key: 'name', label: 'Staff Member' },
        { key: 'role', label: 'Role' },
        { key: 'stampsIssuedCount', label: 'Stamps Awarded' },
        { key: 'redemptionsVerifiedCount', label: 'Redemptions Verified' },
      ],
    });

    host.append(
      kpiGrid,
      el('div', { className: 'grid grid-2' }, [growthCard, barCard]),
      dailyRegCard,
      el('div', { className: 'grid grid-2' }, [
        el('section', { className: 'card stack' }, [
          el('div', { className: 'between' }, [
            el('h2', { className: 'card__title', text: 'Most Active Customers' }),
            el('a', { href: 'customers.html', className: 'auth-link', text: 'View All Customers ->' }),
          ]),
          activeCustomersTable,
        ]),
        el('section', { className: 'card stack' }, [
          el('h2', { className: 'card__title', text: 'Loyalty Programme Performance' }),
          progPerfTable,
        ]),
      ]),
      el('section', { className: 'card stack' }, [
        el('h2', { className: 'card__title', text: 'Staff Operational Activity' }),
        staffPerfTable,
      ]),
    );
  }

  periodSelect?.addEventListener('change', (e) => {
    store.setState({ period: e.target.value });
    if (e.target.value !== 'custom') {
      loadAnalytics();
    } else {
      render();
    }
  });

  qs('#analytics-custom-apply')?.addEventListener('click', () => {
    const startDate = customStartInput?.value || '';
    const endDate = customEndInput?.value || '';
    if (!startDate || !endDate) {
      showToast({ message: 'Select both start and end dates for a custom range.', variant: 'warning' });
      return;
    }
    store.setState({ period: 'custom', startDate, endDate });
    loadAnalytics();
  });

  loadAnalytics();
}

/* --------------------------------------------------------------------------
   2. Reports & Authorized CSV Export (admin/reports.html)
   -------------------------------------------------------------------------- */
export function initAdminReportsPage() {
  const tableHost = qs('#reports-preview-table');
  if (!tableHost) return;

  mountAdminShell({ activeId: 'reports' });

  const fromInput = qs('#rep-date-from');
  const toInput = qs('#rep-date-to');
  const categorySelect = qs('#rep-category');
  const typeSelect = qs('#rep-type');
  const previewTitle = qs('#reports-preview-title');
  const exportBtn = qs('#rep-export-csv-btn');

  if (fromInput && toInput) {
    const now = new Date();
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 30);
    fromInput.value = start.toISOString().slice(0, 10);
    toInput.value = now.toISOString().slice(0, 10);
  }

  const store = createStore({
    category: 'customer-activity',
    reportType: 'Summary',
    page: 1,
    loading: true,
    columns: [],
    rows: [],
    totalItems: 0,
  });

  function buildDevFallbackDataset(category) {
    if (category === 'customer-registration') {
      return {
        label: 'Customer Registration',
        columns: [
          { key: 'id', label: 'Customer ID' },
          { key: 'name', label: 'Customer' },
          { key: 'programme', label: 'Programme' },
          { key: 'joinedOn', label: 'Join Date' },
          { key: 'status', label: 'Status' },
        ],
        rows: ADMIN_DEV_FIXTURE.customers,
      };
    }
    if (category === 'stamp-transactions') {
      return {
        label: 'Stamp Transactions',
        columns: [
          { key: 'id', label: 'TXN ID' },
          { key: 'dateTime', label: 'Date & Time' },
          { key: 'customerName', label: 'Customer' },
          { key: 'purchaseRef', label: 'Purchase Ref' },
          { key: 'stampsAwarded', label: 'Stamps' },
          { key: 'status', label: 'Status' },
        ],
        rows: ADMIN_DEV_FIXTURE.stampTransactions,
      };
    }
    if (category === 'purchases') {
      return {
        label: 'Purchase Records',
        columns: [
          { key: 'receiptNo', label: 'Receipt No.' },
          { key: 'dateTime', label: 'Date & Time' },
          { key: 'memberName', label: 'Customer' },
          { key: 'amountInr', label: 'Amount (INR)' },
          { key: 'stampsAwarded', label: 'Stamps' },
        ],
        rows: ADMIN_EXTENDED_FIXTURE.purchaseRecords,
      };
    }
    if (category === 'rewards') {
      return {
        label: 'Rewards Catalogue',
        columns: [
          { key: 'code', label: 'Code' },
          { key: 'title', label: 'Reward Title' },
          { key: 'type', label: 'Type' },
          { key: 'requiredStamps', label: 'Required Stamps' },
          { key: 'status', label: 'Status' },
        ],
        rows: ADMIN_DEV_FIXTURE.rewardsCatalog,
      };
    }
    if (category === 'redemptions') {
      return {
        label: 'Reward Redemptions',
        columns: [
          { key: 'voucherCode', label: 'Voucher Code' },
          { key: 'customerName', label: 'Customer' },
          { key: 'rewardTitle', label: 'Reward' },
          { key: 'stampsCost', label: 'Stamps' },
          { key: 'status', label: 'Status' },
        ],
        rows: ADMIN_DEV_FIXTURE.redemptions,
      };
    }
    if (category === 'staff-activity') {
      return {
        label: 'Staff Activity',
        columns: [
          { key: 'id', label: 'Staff ID' },
          { key: 'name', label: 'Staff Name' },
          { key: 'role', label: 'Role' },
          { key: 'stampsIssuedCount', label: 'Stamps Issued' },
          { key: 'redemptionsVerifiedCount', label: 'Redemptions Verified' },
        ],
        rows: ADMIN_EXTENDED_FIXTURE.staffMembers,
      };
    }
    if (category === 'programme-performance') {
      return {
        label: 'Loyalty Programme Performance',
        columns: [
          { key: 'name', label: 'Programme' },
          { key: 'members', label: 'Members' },
          { key: 'stamps', label: 'Stamps Issued' },
          { key: 'redemptionRate', label: 'Redemption Rate' },
        ],
        rows: ADMIN_EXTENDED_FIXTURE.analytics.programmePerformance,
      };
    }
    return {
      label: 'Customer Activity',
      columns: [
        { key: 'name', label: 'Customer' },
        { key: 'id', label: 'Member ID' },
        { key: 'joinedOn', label: 'Join Date' },
        { key: 'stamps', label: 'Stamp Balance' },
        { key: 'rewardsRedeemed', label: 'Rewards Redeemed' },
        {
          key: 'totalSpendInr',
          label: 'Total Spend',
          render: (r) => `₹${Number(r.totalSpendInr || 0).toLocaleString('en-IN')}`,
        },
      ],
      rows: ADMIN_DEV_FIXTURE.customers,
    };
  }

  async function loadReport() {
    const { category, page } = store.getState();
    const dateFrom = fromInput?.value || '';
    const dateTo = toInput?.value || '';
    store.setState({ loading: true });
    render();

    const pageSize = 8;
    const res = await fetchAdminReportPreview({ category, dateFrom, dateTo, page, pageSize });
    if (res.ok && res.useLocalFallback && !isProductionEnvironment()) {
      const ds = buildDevFallbackDataset(category);
      const slice = ds.rows.slice((page - 1) * pageSize, page * pageSize);
      store.setState({
        loading: false,
        columns: ds.columns,
        rows: slice,
        totalItems: ds.rows.length,
        allDevRows: ds.rows,
      });
    } else if (!res.ok) {
      store.setState({ loading: false, columns: [], rows: [], totalItems: 0 });
      showToast({ message: res.message || 'Unable to generate report.', variant: 'danger' });
    } else {
      const data = res.data || {};
      store.setState({
        loading: false,
        columns: data.columns || [],
        rows: data.rows || [],
        totalItems: Number(data.totalItems || 0),
        allDevRows: null,
      });
    }
    render();
  }

  function render() {
    const { category, reportType, page, columns, rows, totalItems, loading } = store.getState();
    const fromVal = fromInput?.value || '';
    const toVal = toInput?.value || '';
    if (previewTitle) {
      previewTitle.textContent = `Report Preview: ${category} — ${reportType} (${fromVal} to ${toVal})`;
    }

    renderDataTable(tableHost, {
      loading,
      rows,
      page,
      pageSize: 8,
      totalItems,
      emptyMessage: 'No records matched the selected report category and date range.',
      onPageChange: (nextPage) => {
        store.setState({ page: nextPage });
        loadReport();
      },
      columns,
    });
  }

  categorySelect?.addEventListener('change', (e) => {
    store.setState({ category: e.target.value, page: 1 });
    loadReport();
  });

  typeSelect?.addEventListener('change', (e) => {
    store.setState({ reportType: e.target.value, page: 1 });
    render();
  });

  fromInput?.addEventListener('change', () => {
    store.setState({ page: 1 });
    loadReport();
  });
  toInput?.addEventListener('change', () => {
    store.setState({ page: 1 });
    loadReport();
  });

  exportBtn?.addEventListener('click', async () => {
    const { category, columns, allDevRows } = store.getState();
    const dateFrom = fromInput?.value || '';
    const dateTo = toInput?.value || '';

    setButtonLoading(exportBtn, true, 'Exporting...');
    const res = await exportAdminReportCsv({ category, dateFrom, dateTo });
    setButtonLoading(exportBtn, false);

    if (res.ok) {
      if (!res.csv || res.rowCount === 0) {
        showToast({ message: 'No report records available to export for this range.', variant: 'warning' });
        return;
      }
      triggerCsvDownload(res.filename, res.csv);
      showToast({ message: `Exported ${res.rowCount} authorized records to ${res.filename}.`, variant: 'success' });
      return;
    }

    if (res.code === 'SUPABASE_NOT_CONFIGURED' && Array.isArray(allDevRows) && allDevRows.length > 0) {
      const headers = columns.map((c) => c.label);
      const bodyRows = allDevRows.map((row) => columns.map((c) => row[c.key] ?? ''));
      triggerCsvDownload(`bonfree-hub-${category}-preview.csv`, buildSafeCsv(headers, bodyRows));
      showToast({ message: res.message, variant: 'info' });
      return;
    }

    showToast({ message: res.message || 'CSV export rejected by server permissions.', variant: 'danger' });
  });

  loadReport();
}

/* --------------------------------------------------------------------------
   3. Settings (admin/settings.html)
   -------------------------------------------------------------------------- */
export function initAdminSettingsPage() {
  const form = qs('#admin-settings-form');
  if (!form) return;

  mountAdminShell({ activeId: 'settings' });

  const statusRegion = qs('#settings-save-status');
  let activeStoreId = null;

  async function loadSettings() {
    const res = await fetchAdminSettings();
    if (!res.ok) {
      showToast({ message: res.message || 'Unable to load settings.', variant: 'danger' });
      return;
    }
    const s = res.settings;
    activeStoreId = s.storeId || null;
    if (form.brandName) form.brandName.value = s.brandName || 'BONFREE-HUB';
    if (form.tagline) form.tagline.value = s.tagline || '';
    if (form.supportEmail) form.supportEmail.value = s.supportEmail || '';
    if (form.supportPhone) form.supportPhone.value = s.supportPhone || '';
    if (form.address) form.address.value = s.address || '';
    if (form.stampValidity) form.stampValidity.value = String(s.stampValidity || 12);
    if (form.rewardValidity) form.rewardValidity.value = String(s.rewardValidity || 6);
    if (form.adminName) form.adminName.value = s.adminName || 'Admin';
    if (form.adminEmail) {
      form.adminEmail.value = s.adminEmail || '';
      form.adminEmail.readOnly = true;
    }
    if (form.dailySummaryView) form.dailySummaryView.checked = Boolean(s.dailySummaryView);
    if (form.twoFactor) form.twoFactor.checked = Boolean(s.securityStatus?.twoFactorConfigured);
    if (form.loginAlerts) form.loginAlerts.checked = Boolean(s.securityStatus?.loginAlertsConfigured);
  }

  qs('#open-admin-pw-modal')?.addEventListener('click', () => {
    const pwStatus = el('div', { 'aria-live': 'polite' });
    const pwForm = el('form', { className: 'form-stack', novalidate: true }, [
      pwStatus,
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'adm-cur-pw', text: 'Current Password *' }),
        el('input', { id: 'adm-cur-pw', name: 'currentPassword', type: 'password', className: 'input', required: true }),
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'adm-new-pw', text: 'New Password *' }),
        el('input', { id: 'adm-new-pw', name: 'newPassword', type: 'password', className: 'input', minlength: '8', required: true }),
      ]),
    ]);

    const updateBtn = el('button', {
      type: 'button',
      className: 'btn btn--primary',
      text: 'Update Password',
      onClick: async () => {
        clearElement(pwStatus);
        const { valid, values } = validateForm(pwForm);
        if (!valid) {
          pwStatus.appendChild(createAlert({ variant: 'danger', title: 'Validation Error', message: 'Provide current and valid new password (8+ chars).' }));
          return;
        }
        setButtonLoading(updateBtn, true, 'Updating...');
        const res = await updateAdminAccountPassword(values);
        setButtonLoading(updateBtn, false);
        if (!res.ok) {
          pwStatus.appendChild(
            createAlert({
              variant: res.code === 'SUPABASE_NOT_CONFIGURED' ? 'warning' : 'danger',
              title: res.code === 'SUPABASE_NOT_CONFIGURED' ? 'Backend Connection Required' : 'Password Update Error',
              message: res.message,
            }),
          );
        } else {
          closeModal();
          showToast({ message: 'Admin account password updated.', variant: 'success' });
        }
      },
    });

    openModal({
      title: 'Update Staff Account Password',
      body: pwForm,
      footerActions: [
        el('button', { type: 'button', className: 'btn btn--outline-muted', text: 'Cancel', onClick: closeModal }),
        updateBtn,
      ],
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearElement(statusRegion);
    const { valid, values } = validateForm(form);
    if (!valid) {
      statusRegion.appendChild(
        createAlert({ variant: 'danger', title: 'Check Brand Settings', message: 'Brand Name and Support Email are required.' }),
      );
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true, 'Saving...');
    try {
      const res = await saveBrandSettings({
        ...values,
        storeId: activeStoreId,
        dailySummaryView: Boolean(form.dailySummaryView?.checked),
      });
      statusRegion.appendChild(
        createAlert({
          variant: res.ok ? 'success' : res.code === 'SUPABASE_NOT_CONFIGURED' ? 'warning' : 'danger',
          title: res.ok ? 'Settings Saved' : res.code === 'SUPABASE_NOT_CONFIGURED' ? 'Database Connection Required' : 'Save Rejected',
          message: res.message,
        }),
      );
      showToast({ message: res.message, variant: res.ok ? 'success' : res.code === 'SUPABASE_NOT_CONFIGURED' ? 'warning' : 'danger' });
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  loadSettings();
}
