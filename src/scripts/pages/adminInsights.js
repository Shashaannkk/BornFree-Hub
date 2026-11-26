/**
 * BONFREE-HUB Admin Insights & System Controllers (Phase 2D)
 * Powers Analytics, Reports, and Settings.
 */
import { clearElement, el, qs } from '../core/dom.js';
import { createIcon } from '../core/icons.js';
import { createStore } from '../core/state.js';
import { mountAdminShell } from '../components/adminShell.js';
import { openModal, closeModal } from '../components/modal.js';
import { createAlert, showToast } from '../components/toast.js';
import { renderDataTable } from '../components/table.js';
import { setButtonLoading, validateForm } from '../components/form.js';
import { createBarChartSvg, createLineChartSvg } from '../components/charts.js';
import {
  ADMIN_EXTENDED_FIXTURE,
  buildSafeCsv,
  saveBrandSettings,
  updateAdminAccountPassword,
} from '../services/adminExtendedService.js';
import { ADMIN_DEV_FIXTURE } from '../services/adminService.js';

/* --------------------------------------------------------------------------
   1. Analytics (admin/analytics.html)
   -------------------------------------------------------------------------- */
export function initAdminAnalyticsPage() {
  const host = qs('#admin-analytics-host');
  if (!host) return;

  mountAdminShell({ activeId: 'analytics' });

  const periodSelect = qs('#analytics-period');
  const customRangeWrap = qs('#analytics-custom-range');
  const store = createStore({ period: 'monthly' });

  function render() {
    clearElement(host);
    const { period } = store.getState();
    const metrics = ADMIN_EXTENDED_FIXTURE.analytics.byPeriod[period];

    if (customRangeWrap) {
      customRangeWrap.hidden = period !== 'custom';
    }

    const kpis = [
      ['Total Registered Members', metrics.members.toLocaleString('en-IN'), `${metrics.active.toLocaleString('en-IN')} active members`],
      ['Stamps Issued', metrics.stamps.toLocaleString('en-IN'), `Purchase frequency: ${metrics.avgFreq}`],
      ['Rewards Redeemed', metrics.redeemed.toLocaleString('en-IN'), '32.8% redemption conversion'],
      ['Qualifying Revenue', `₹${metrics.revenueInr.toLocaleString('en-IN')}`, 'Verified member purchases'],
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

    const growthCard = el('section', { className: 'card stack' }, [
      el('div', { className: 'between' }, [
        el('h2', { className: 'card__title', text: 'Customer Growth' }),
        el('span', { className: 'badge badge--dark', text: '+8.4%' }),
      ]),
      createLineChartSvg(ADMIN_DEV_FIXTURE.growthSeries),
    ]);

    const barCard = el('section', { className: 'card stack' }, [
      el('div', { className: 'between' }, [
        el('h2', { className: 'card__title', text: 'Stamp Issuance' }),
        el('span', { className: 'text-xs text-muted', text: `Total: ${metrics.stamps.toLocaleString('en-IN')}` }),
      ]),
      createBarChartSvg(ADMIN_EXTENDED_FIXTURE.analytics.stampWeeklyBars),
    ]);

    const activeCustomersTable = el('div');
    renderDataTable(activeCustomersTable, {
      rows: ADMIN_EXTENDED_FIXTURE.analytics.mostActiveCustomers,
      columns: [
        { key: 'rank', label: '#' },
        { key: 'name', label: 'Customer' },
        { key: 'memberId', label: 'Member ID' },
        { key: 'stampsEarned', label: 'Stamps Earned' },
        { key: 'rewardsRedeemed', label: 'Rewards Redeemed' },
        {
          key: 'totalSpendInr',
          label: 'Total Spend',
          render: (r) => `₹${r.totalSpendInr.toLocaleString('en-IN')}`,
        },
      ],
    });

    const progPerfTable = el('div');
    renderDataTable(progPerfTable, {
      rows: ADMIN_EXTENDED_FIXTURE.analytics.programmePerformance,
      columns: [
        { key: 'name', label: 'Programme' },
        { key: 'members', label: 'Enrolled Members' },
        { key: 'stamps', label: 'Stamps Issued' },
        { key: 'redemptionRate', label: 'Redemption Rate' },
      ],
    });

    host.append(
      kpiGrid,
      el('div', { className: 'grid grid-2' }, [growthCard, barCard]),
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
    );
  }

  periodSelect?.addEventListener('change', (e) => {
    store.setState({ period: e.target.value });
    render();
  });

  qs('#analytics-custom-apply')?.addEventListener('click', () => {
    showToast({ message: 'Applied custom date range to preview dataset.', variant: 'info' });
    render();
  });

  render();
}

/* --------------------------------------------------------------------------
   2. Reports & CSV Export (admin/reports.html)
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

  const store = createStore({
    category: 'customer-activity',
    reportType: 'Summary',
    page: 1,
  });

  function buildReportDataset(category) {
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
          render: (r) => `₹${r.totalSpendInr.toLocaleString('en-IN')}`,
        },
      ],
      rows: ADMIN_DEV_FIXTURE.customers,
    };
  }

  function render() {
    const { category, reportType, page } = store.getState();
    const dataset = buildReportDataset(category);
    const fromVal = fromInput?.value || '01 Jan 2025';
    const toVal = toInput?.value || '31 Jan 2025';
    if (previewTitle) {
      previewTitle.textContent = `Report Preview: ${dataset.label} — ${reportType} (${fromVal} to ${toVal})`;
    }

    const pageSize = 5;
    const slice = dataset.rows.slice((page - 1) * pageSize, page * pageSize);

    renderDataTable(tableHost, {
      rows: slice,
      page,
      pageSize,
      totalItems: dataset.rows.length,
      onPageChange: (nextPage) => {
        store.setState({ page: nextPage });
        render();
      },
      columns: dataset.columns,
    });
  }

  categorySelect?.addEventListener('change', (e) => {
    store.setState({ category: e.target.value, page: 1 });
    render();
  });

  typeSelect?.addEventListener('change', (e) => {
    store.setState({ reportType: e.target.value, page: 1 });
    render();
  });

  qs('#rep-export-csv-btn')?.addEventListener('click', () => {
    const { category } = store.getState();
    const dataset = buildReportDataset(category);
    if (!dataset.rows.length) {
      showToast({ message: 'No report records available to export.', variant: 'warning' });
      return;
    }
    const headers = dataset.columns.map((c) => c.label);
    const bodyRows = dataset.rows.map((row) => dataset.columns.map((c) => row[c.key] ?? ''));
    triggerCsvDownload(`bonfree-hub-${category}-report.csv`, buildSafeCsv(headers, bodyRows));
    showToast({
      message: 'Preview CSV downloaded. Full server-authorized export runs via Phase 3 Edge Function.',
      variant: 'info',
    });
  });

  render();
}

/* --------------------------------------------------------------------------
   3. Settings (admin/settings.html)
   -------------------------------------------------------------------------- */
export function initAdminSettingsPage() {
  const form = qs('#admin-settings-form');
  if (!form) return;

  mountAdminShell({ activeId: 'settings' });

  const statusRegion = qs('#settings-save-status');

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
        pwStatus.appendChild(createAlert({ variant: 'warning', title: 'Backend Auth Pending (Phase 3)', message: res.message }));
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
      const res = await saveBrandSettings(values);
      statusRegion.appendChild(
        createAlert({ variant: 'warning', title: 'Database Save Pending (Phase 3)', message: res.message }),
      );
      showToast({ message: res.message, variant: 'warning' });
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}
