/**
 * BONFREE-HUB Admin Store Operations Pages Controller (Phase 2B)
 * Powers QR Scanner, Stamp Transactions, Rewards, and Redemptions.
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
  ADMIN_DEV_FIXTURE,
  awardStampsForPurchase,
  calculateEligibleStamps,
  lookupCustomerForScanner,
  processRedemption,
  saveRewardDefinition,
} from '../services/adminService.js';

/* --------------------------------------------------------------------------
   1. QR Scanner & Award Stamps (admin/scanner.html)
   -------------------------------------------------------------------------- */
export function initAdminScannerPage() {
  const readerHost = qs('#qr-reader');
  if (!readerHost) return;

  mountAdminShell({ activeId: 'qr-scanner' });

  const startBtn = qs('#scanner-start-btn');
  const stopBtn = qs('#scanner-stop-btn');
  const cameraBadge = qs('#scanner-camera-status');
  const cameraAlertHost = qs('#scanner-camera-alert');
  const lookupForm = qs('#scanner-lookup-form');
  const lookupInput = qs('#scanner-lookup-input');
  const devPresetSelect = qs('#scanner-dev-preset');
  const customerCardHost = qs('#scanner-customer-panel');
  const awardForm = qs('#scanner-award-form');
  const purchaseRefInput = qs('#scanner-purchase-ref');
  const purchaseAmtInput = qs('#scanner-purchase-amount');
  const calcPreviewBadge = qs('#scanner-calculated-stamps');
  const awardStatusHost = qs('#scanner-award-status');

  const store = createStore({
    scanning: false,
    selected: lookupCustomerForScanner('BF-001248'),
  });

  let qrInstance = null;

  function setCameraAlert(variant, title, message) {
    clearElement(cameraAlertHost);
    if (!message) return;
    cameraAlertHost.appendChild(createAlert({ variant, title, message }));
  }

  function renderSelectedCustomer() {
    clearElement(customerCardHost);
    const { selected } = store.getState();

    if (!selected) {
      customerCardHost.appendChild(
        createAlert({
          variant: 'warning',
          title: 'No Customer Selected',
          message: 'Scan a customer QR code or look up a member by ID, email, or mobile number.',
        }),
      );
      updateStampPreview();
      return;
    }

    const { customer, programme } = selected;
    customerCardHost.appendChild(
      el('div', { className: 'scanner-customer-box' }, [
        el('div', { className: 'between' }, [
          el('div', {}, [
            el('strong', { className: 'text-sm', text: customer.name }),
            el('div', { className: 'text-xs text-muted', text: `${customer.id} · ${customer.phone}` }),
          ]),
          createStatusBadge(customer.status, customer.status === 'Active' ? 'active' : 'inactive'),
        ]),
        el('div', { className: 'grid grid-2' }, [
          el('div', {}, [
            el('div', { className: 'text-xs text-muted', text: 'Current Stamp Balance' }),
            el('strong', { className: 'text-sm', text: `${customer.stamps} / ${programme.stampGoal} Stamps` }),
          ]),
          el('div', {}, [
            el('div', { className: 'text-xs text-muted', text: 'Active Programme' }),
            el('strong', { className: 'text-sm', text: `${programme.name} (₹${programme.qualifyingAmountInr}/stamp)` }),
          ]),
        ]),
      ]),
    );
    updateStampPreview();
  }

  function updateStampPreview() {
    const { selected } = store.getState();
    if (!selected || !calcPreviewBadge) return;
    const stamps = calculateEligibleStamps({
      amountInr: purchaseAmtInput?.value || 0,
      qualifyingAmountInr: selected.programme.qualifyingAmountInr,
      calculationRule: selected.programme.calculationRule,
    });
    calcPreviewBadge.textContent = `${stamps} ${stamps === 1 ? 'Stamp' : 'Stamps'}`;
  }

  async function stopScanner() {
    if (qrInstance && store.getState().scanning) {
      try {
        await qrInstance.stop();
        await qrInstance.clear();
      } catch {
        // Ignore cleanup errors when camera stream already closed.
      }
    }
    store.setState({ scanning: false });
    if (cameraBadge) {
      cameraBadge.className = 'badge badge--neutral';
      cameraBadge.textContent = 'Camera Idle';
    }
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
  }

  async function startScanner() {
    clearElement(cameraAlertHost);

    if (typeof window.Html5Qrcode !== 'function') {
      setCameraAlert(
        'danger',
        'Scanner Library Unavailable',
        'html5-qrcode bundle failed to load. Use Manual Customer Lookup on the right.',
      );
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraAlert(
        'warning',
        'Camera API Unavailable',
        'This browser or context does not expose camera access. Use Manual Customer Lookup instead.',
      );
      return;
    }

    try {
      qrInstance = qrInstance || new window.Html5Qrcode('qr-reader');
      store.setState({ scanning: true });
      if (cameraBadge) {
        cameraBadge.className = 'badge badge--active';
        cameraBadge.textContent = 'Scanning Live';
      }
      if (startBtn) startBtn.disabled = true;
      if (stopBtn) stopBtn.disabled = false;

      await qrInstance.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 180, height: 180 } },
        (decodedText) => {
          const found = lookupCustomerForScanner(decodedText);
          if (found) {
            store.setState({ selected: found });
            renderSelectedCustomer();
            showToast({ message: `QR matched member ${found.customer.name} (${found.customer.id}).`, variant: 'success' });
            stopScanner();
          } else {
            setCameraAlert('warning', 'Unknown QR Code', `Scanned payload "${decodedText}" did not match an active member.`);
          }
        },
        () => {
          // Ignore per-frame decode misses while scanning.
        },
      );
    } catch (err) {
      await stopScanner();
      const errName = err?.name || '';
      const msg =
        errName === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access in browser settings or use Manual Customer Lookup.'
          : errName === 'NotFoundError'
          ? 'No camera device detected on this terminal. Use Manual Customer Lookup on the right.'
          : `Unable to start camera (${err?.message || 'Permission or hardware error'}).`;
      setCameraAlert('danger', 'Camera Access Issue', msg);
    }
  }

  startBtn?.addEventListener('click', startScanner);
  stopBtn?.addEventListener('click', stopScanner);

  lookupForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const q = lookupInput?.value || '';
    const found = lookupCustomerForScanner(q);
    if (!found) {
      store.setState({ selected: null });
      renderSelectedCustomer();
      showToast({ message: 'No customer matched that ID, email, or phone.', variant: 'warning' });
      return;
    }
    store.setState({ selected: found });
    renderSelectedCustomer();
  });

  devPresetSelect?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (!val) return;
    const found = lookupCustomerForScanner(val);
    if (found) {
      store.setState({ selected: found });
      renderSelectedCustomer();
      showToast({ message: `Simulated QR scan for ${found.customer.id}`, variant: 'info', durationMs: 2200 });
    }
  });

  purchaseAmtInput?.addEventListener('input', updateStampPreview);

  awardForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    clearElement(awardStatusHost);
    const { valid, values } = validateForm(awardForm);
    const { selected } = store.getState();

    if (!selected) {
      awardStatusHost.appendChild(
        createAlert({
          variant: 'danger',
          title: 'Customer Required',
          message: 'Identify a customer via QR or Manual Lookup before awarding stamps.',
        }),
      );
      return;
    }

    if (!valid) {
      awardStatusHost.appendChild(
        createAlert({
          variant: 'danger',
          title: 'Purchase Details Incomplete',
          message: 'Enter a valid purchase reference and purchase amount.',
        }),
      );
      return;
    }

    const calculatedStamps = calculateEligibleStamps({
      amountInr: values.purchaseAmount,
      qualifyingAmountInr: selected.programme.qualifyingAmountInr,
      calculationRule: selected.programme.calculationRule,
    });

    const confirmBtn = el('button', {
      type: 'button',
      className: 'btn btn--primary',
      text: 'Confirm Award Request',
      onClick: async () => {
        setButtonLoading(confirmBtn, true, 'Submitting...');
        const res = await awardStampsForPurchase({
          customerId: selected.customer.id,
          purchaseRef: values.purchaseRef,
          amountInr: Number(values.purchaseAmount),
          calculatedStamps,
        });
        setButtonLoading(confirmBtn, false);
        closeModal();

        clearElement(awardStatusHost);
        const variant =
          res.code === 'DUPLICATE_RECEIPT' || res.code === 'NOT_QUALIFYING' ? 'danger' : 'warning';
        const title =
          res.code === 'DUPLICATE_RECEIPT'
            ? 'Duplicate Receipt Rejected'
            : res.code === 'NOT_QUALIFYING'
            ? 'Purchase Below Threshold'
            : 'Backend Edge Function Required (Phase 3)';
        awardStatusHost.appendChild(createAlert({ variant, title, message: res.message }));
        showToast({ message: res.message, variant });
      },
    });

    openModal({
      title: 'Confirm Stamp Award Request',
      body: el('div', { className: 'stack' }, [
        el('p', {
          className: 'text-sm text-muted',
          text: `Verify purchase ${values.purchaseRef} (₹${Number(values.purchaseAmount).toLocaleString('en-IN')}) for ${selected.customer.name} (${selected.customer.id}).`,
        }),
        el('div', { className: 'stamp-preview-box' }, [
          el('span', { className: 'text-sm', text: 'Calculated Eligible Stamps' }),
          el('strong', { className: 'text-lg', text: `${calculatedStamps}` }),
        ]),
      ]),
      footerActions: [
        el('button', { type: 'button', className: 'btn btn--outline-muted', text: 'Cancel', onClick: closeModal }),
        confirmBtn,
      ],
    });
  });

  renderSelectedCustomer();
}

/* --------------------------------------------------------------------------
   2. Stamp Transactions (admin/stamps.html)
   -------------------------------------------------------------------------- */
function openTransactionDetailModal(tx) {
  openModal({
    title: `Stamp Transaction — ${tx.id}`,
    body: el('div', { className: 'grid grid-2 card card--ivory' }, [
      el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Customer' }), el('strong', { className: 'text-sm', text: `${tx.customerName} (${tx.customerId})` })]),
      el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Phone' }), el('strong', { className: 'text-sm', text: tx.customerPhone })]),
      el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Staff Member' }), el('strong', { className: 'text-sm', text: `${tx.staffName} (${tx.staffId})` })]),
      el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Store Location' }), el('strong', { className: 'text-sm', text: tx.store })]),
      el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Purchase Reference' }), el('strong', { className: 'text-sm', text: tx.purchaseRef })]),
      el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Purchase Amount' }), el('strong', { className: 'text-sm', text: `₹${tx.amountInr.toLocaleString('en-IN')}` })]),
      el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Programme & Stamps' }), el('strong', { className: 'text-sm', text: `${tx.programme} · +${tx.stampsAwarded} stamps` })]),
      el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Date & Status' }), el('strong', { className: 'text-sm', text: `${tx.dateTime} · ${tx.status}` })]),
    ]),
    footerActions: [
      el('button', { type: 'button', className: 'btn btn--primary btn--sm', text: 'Close', onClick: closeModal }),
    ],
  });
}

export function initAdminStampsPage() {
  const tableHost = qs('#admin-stamps-table');
  if (!tableHost) return;

  mountAdminShell({ activeId: 'stamps' });

  const searchInput = qs('#stamps-search');
  const fromInput = qs('#stamps-date-from');
  const toInput = qs('#stamps-date-to');
  const statusSelect = qs('#stamps-status');
  const sortSelect = qs('#stamps-sort');

  const store = createStore({
    query: '',
    dateFrom: '',
    dateTo: '',
    status: 'all',
    sortBy: 'date-desc',
    page: 1,
    loading: false,
  });

  const render = () => {
    const { query, dateFrom, dateTo, status, sortBy, page, loading } = store.getState();
    const q = query.trim().toLowerCase();

    let rows = ADMIN_DEV_FIXTURE.stampTransactions.filter((tx) => {
      const matchesQ =
        !q ||
        tx.id.toLowerCase().includes(q) ||
        tx.customerName.toLowerCase().includes(q) ||
        tx.customerId.toLowerCase().includes(q) ||
        tx.purchaseRef.toLowerCase().includes(q) ||
        tx.staffName.toLowerCase().includes(q);
      const matchesStatus = status === 'all' || tx.status.toLowerCase() === status;
      const matchesFrom = !dateFrom || tx.isoDate >= dateFrom;
      const matchesTo = !dateTo || tx.isoDate <= dateTo;
      return matchesQ && matchesStatus && matchesFrom && matchesTo;
    });

    if (sortBy === 'date-asc') rows = [...rows].sort((a, b) => a.isoDate.localeCompare(b.isoDate));
    else if (sortBy === 'amount-desc') rows = [...rows].sort((a, b) => b.amountInr - a.amountInr);
    else if (sortBy === 'stamps-desc') rows = [...rows].sort((a, b) => b.stampsAwarded - a.stampsAwarded);

    const pageSize = 5;
    const slice = rows.slice((page - 1) * pageSize, page * pageSize);

    renderDataTable(tableHost, {
      loading,
      rows: slice,
      page,
      pageSize,
      totalItems: rows.length,
      emptyMessage: 'No stamp transactions match your filter criteria.',
      onPageChange: (nextPage) => {
        store.setState({ page: nextPage });
        render();
      },
      columns: [
        { key: 'id', label: 'Transaction ID' },
        { key: 'dateTime', label: 'Date & Time' },
        {
          key: 'customerName',
          label: 'Customer',
          render: (row) =>
            el('div', {}, [
              el('div', { className: 'text-sm', style: 'font-weight: 500;', text: row.customerName }),
              el('div', { className: 'text-xs text-muted', text: row.customerId }),
            ]),
        },
        { key: 'staffName', label: 'Staff' },
        { key: 'purchaseRef', label: 'Reference' },
        {
          key: 'amountInr',
          label: 'Amount (₹)',
          render: (row) => `₹${row.amountInr.toLocaleString('en-IN')}`,
        },
        { key: 'stampsAwarded', label: 'Stamps' },
        {
          key: 'status',
          label: 'Status',
          render: (row) =>
            createStatusBadge(row.status, row.status === 'Awarded' ? 'active' : 'warning'),
        },
        {
          key: 'actions',
          label: 'Details',
          render: (row) =>
            el(
              'button',
              {
                type: 'button',
                className: 'btn btn--outline-muted btn--sm',
                onClick: () => openTransactionDetailModal(row),
              },
              [createIcon('eye', { size: 14 }), el('span', { text: 'View' })],
            ),
        },
      ],
    });
  };

  qs('#stamps-apply-btn')?.addEventListener('click', () => {
    store.setState({
      query: searchInput?.value || '',
      dateFrom: fromInput?.value || '',
      dateTo: toInput?.value || '',
      status: statusSelect?.value || 'all',
      sortBy: sortSelect?.value || 'date-desc',
      page: 1,
    });
    render();
  });

  qs('#stamps-clear-btn')?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';
    if (statusSelect) statusSelect.value = 'all';
    if (sortSelect) sortSelect.value = 'date-desc';
    store.setState({ query: '', dateFrom: '', dateTo: '', status: 'all', sortBy: 'date-desc', page: 1 });
    render();
  });

  render();
}

/* --------------------------------------------------------------------------
   3. Rewards Catalogue Management (admin/rewards.html)
   -------------------------------------------------------------------------- */
function openRewardFormModal(existing = null) {
  const isEdit = Boolean(existing);
  const statusRegion = el('div', { 'aria-live': 'polite' });

  const form = el('form', { className: 'form-stack', novalidate: true }, [
    statusRegion,
    el('div', { className: 'field' }, [
      el('label', { className: 'field__label', for: 'rw-title', text: 'Reward Title *' }),
      el('input', { id: 'rw-title', name: 'title', type: 'text', className: 'input', value: existing?.title || '', required: true }),
    ]),
    el('div', { className: 'grid grid-2' }, [
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'rw-type', text: 'Reward Type *' }),
        el(
          'select',
          { id: 'rw-type', name: 'type', className: 'select', required: true },
          [
            'Fixed Discount',
            'Percentage Discount',
            'Free Product',
            'Birthday Reward',
            'Exclusive Member Offer',
            'New Collection Offer',
          ].map((t) => el('option', { value: t, text: t, selected: existing?.type === t })),
        ),
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'rw-value', text: 'Reward Value *' }),
        el('input', { id: 'rw-value', name: 'valueLabel', type: 'text', className: 'input', placeholder: 'e.g. ₹500 Off / 15% Off', value: existing?.valueLabel || '', required: true }),
      ]),
    ]),
    el('div', { className: 'grid grid-3' }, [
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'rw-stamps', text: 'Required Stamps *' }),
        el('input', { id: 'rw-stamps', name: 'requiredStamps', type: 'number', min: '1', className: 'input', value: String(existing?.requiredStamps || 10), required: true }),
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'rw-validity', text: 'Validity (Months)' }),
        el('input', { id: 'rw-validity', name: 'validityMonths', type: 'number', min: '1', className: 'input', value: String(existing?.validityMonths || 6) }),
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', for: 'rw-status', text: 'Status' }),
        el('select', { id: 'rw-status', name: 'status', className: 'select' }, [
          el('option', { value: 'Active', text: 'Active', selected: !existing || existing.status === 'Active' }),
          el('option', { value: 'Inactive', text: 'Inactive', selected: existing?.status === 'Inactive' }),
        ]),
      ]),
    ]),
    el('div', { className: 'field' }, [
      el('label', { className: 'field__label', for: 'rw-limit', text: 'Redemption Limit' }),
      el('input', { id: 'rw-limit', name: 'redemptionLimit', type: 'text', className: 'input', value: existing?.redemptionLimit || '1 per card completion' }),
    ]),
    el('div', { className: 'field' }, [
      el('label', { className: 'field__label', for: 'rw-desc', text: 'Description *' }),
      el('textarea', { id: 'rw-desc', name: 'description', className: 'textarea', required: true, text: existing?.description || '' }),
    ]),
  ]);

  const submitBtn = el('button', {
    type: 'button',
    className: 'btn btn--primary',
    text: isEdit ? 'Save Reward Changes' : 'Create Reward',
    onClick: async () => {
      clearElement(statusRegion);
      const { valid, values } = validateForm(form);
      if (!valid) {
        statusRegion.appendChild(
          createAlert({ variant: 'danger', title: 'Validation Error', message: 'Complete all required reward fields.' }),
        );
        return;
      }

      setButtonLoading(submitBtn, true, 'Saving...');
      const res = await saveRewardDefinition(values);
      setButtonLoading(submitBtn, false);
      if (!res.ok) {
        statusRegion.appendChild(
          createAlert({ variant: 'warning', title: 'Database Save Pending (Phase 3)', message: res.message }),
        );
        showToast({ message: res.message, variant: 'warning' });
      }
    },
  });

  openModal({
    title: isEdit ? `Edit Reward — ${existing.title}` : 'Create New Reward',
    body: form,
    footerActions: [
      el('button', { type: 'button', className: 'btn btn--outline-muted', text: 'Cancel', onClick: closeModal }),
      submitBtn,
    ],
  });
}

export function initAdminRewardsPage() {
  const gridHost = qs('#admin-rewards-grid');
  if (!gridHost) return;

  mountAdminShell({ activeId: 'rewards' });

  const typeFilter = qs('#rewards-type-filter');
  const store = createStore({ type: 'all' });

  const typeIcon = (type) => {
    if (type === 'Percentage Discount') return 'percent';
    if (type === 'Birthday Reward') return 'cake';
    if (type === 'Free Product') return 'shirt';
    if (type === 'Exclusive Member Offer') return 'crown';
    return 'gift';
  };

  const render = () => {
    clearElement(gridHost);
    const { type } = store.getState();
    const list =
      type === 'all'
        ? ADMIN_DEV_FIXTURE.rewardsCatalog
        : ADMIN_DEV_FIXTURE.rewardsCatalog.filter((r) => r.type === type);

    for (const rw of list) {
      gridHost.appendChild(
        el('article', { className: 'reward-admin-card' }, [
          el('div', { className: 'stack', style: 'gap: 0.75rem;' }, [
            el('div', { className: 'between' }, [
              el('div', { className: 'cluster' }, [
                el('span', { className: 'benefit-card__icon' }, [createIcon(typeIcon(rw.type), { size: 18 })]),
                el('span', { className: 'text-xs text-muted', text: rw.type }),
              ]),
              createStatusBadge(rw.status, rw.status === 'Active' ? 'active' : 'inactive'),
            ]),
            el('div', {}, [
              el('h3', { className: 'card__title', text: rw.valueLabel }),
              el('div', { className: 'text-xs', style: 'font-weight: 600;', text: rw.title }),
              el('p', { className: 'text-xs text-muted', style: 'margin-top: 0.35rem;', text: rw.description }),
            ]),
          ]),
          el('div', { className: 'stack', style: 'gap: 0.5rem; padding-top: 0.75rem; border-top: 1px solid var(--border-subtle);' }, [
            el('div', { className: 'between text-xs text-muted' }, [
              el('span', { text: `${rw.requiredStamps} Stamps · Valid ${rw.validityMonths} mo` }),
              el('span', { text: rw.redemptionLimit }),
            ]),
            el('button', {
              type: 'button',
              className: 'btn btn--outline-muted btn--sm btn--block',
              text: 'Edit Reward',
              onClick: () => openRewardFormModal(rw),
            }),
          ]),
        ]),
      );
    }
  };

  typeFilter?.addEventListener('change', (e) => {
    store.setState({ type: e.target.value });
    render();
  });

  qs('#create-reward-btn')?.addEventListener('click', () => openRewardFormModal(null));
  render();
}

/* --------------------------------------------------------------------------
   4. Redemptions Verification (admin/redemptions.html)
   -------------------------------------------------------------------------- */
function openRedemptionVerifyModal(item) {
  const statusRegion = el('div', { 'aria-live': 'polite' });
  const reasonInput = el('input', {
    type: 'text',
    className: 'input',
    placeholder: 'Optional reason if rejecting...',
    'aria-label': 'Rejection reason',
  });

  const confirmBtn = el('button', {
    type: 'button',
    className: 'btn btn--primary',
    text: 'Confirm Redemption',
    onClick: async () => {
      clearElement(statusRegion);
      setButtonLoading(confirmBtn, true, 'Verifying...');
      const res = await processRedemption({ redemptionId: item.id, action: 'confirm' });
      setButtonLoading(confirmBtn, false);
      statusRegion.appendChild(
        createAlert({ variant: 'warning', title: 'Backend Edge Function Required (Phase 3)', message: res.message }),
      );
      showToast({ message: res.message, variant: 'warning' });
    },
  });

  const rejectBtn = el('button', {
    type: 'button',
    className: 'btn btn--danger',
    text: 'Reject',
    onClick: async () => {
      clearElement(statusRegion);
      setButtonLoading(rejectBtn, true, 'Rejecting...');
      const res = await processRedemption({
        redemptionId: item.id,
        action: 'reject',
        rejectionReason: reasonInput.value,
      });
      setButtonLoading(rejectBtn, false);
      statusRegion.appendChild(
        createAlert({ variant: 'warning', title: 'Backend Edge Function Required (Phase 3)', message: res.message }),
      );
      showToast({ message: res.message, variant: 'warning' });
    },
  });

  openModal({
    title: `Verify Voucher — ${item.voucherCode}`,
    body: el('div', { className: 'stack' }, [
      statusRegion,
      el('div', { className: 'grid grid-2 card card--ivory' }, [
        el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Customer' }), el('strong', { className: 'text-sm', text: `${item.customerName} (${item.customerId})` })]),
        el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Phone' }), el('strong', { className: 'text-sm', text: item.customerPhone })]),
        el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Reward' }), el('strong', { className: 'text-sm', text: item.rewardTitle })]),
        el('div', {}, [el('div', { className: 'text-xs text-muted', text: 'Stamp Cost & Expiry' }), el('strong', { className: 'text-sm', text: `${item.stampsCost} stamps · Exp ${item.expiresOn}` })]),
      ]),
      el('p', { className: 'text-xs text-muted', text: `Notes: ${item.notes}` }),
      item.status === 'Pending'
        ? el('div', { className: 'field' }, [
            el('label', { className: 'field__label', text: 'Rejection Reason (if rejecting)' }),
            reasonInput,
          ])
        : null,
    ]),
    footerActions:
      item.status === 'Pending'
        ? [
            el('button', { type: 'button', className: 'btn btn--outline-muted', text: 'Close', onClick: closeModal }),
            rejectBtn,
            confirmBtn,
          ]
        : [el('button', { type: 'button', className: 'btn btn--primary btn--sm', text: 'Close', onClick: closeModal })],
  });
}

export function initAdminRedemptionsPage() {
  const tableHost = qs('#admin-redemptions-table');
  if (!tableHost) return;

  mountAdminShell({ activeId: 'redemptions' });

  const tabsHost = qs('#redemptions-tabs');
  const searchInput = qs('#redemptions-search');
  const rewardFilter = qs('#redemptions-reward-filter');

  const store = createStore({
    activeTab: 'Pending',
    query: '',
    rewardTitle: 'all',
    page: 1,
  });

  const statuses = ['Pending', 'Completed', 'Expired', 'Rejected'];

  function renderTabs() {
    clearElement(tabsHost);
    const { activeTab } = store.getState();

    for (const status of statuses) {
      const count = ADMIN_DEV_FIXTURE.redemptions.filter((r) => r.status === status).length;
      tabsHost.appendChild(
        el('button', {
          type: 'button',
          className: `tab${activeTab === status ? ' is-active' : ''}`,
          text: `${status} (${count})`,
          onClick: () => {
            store.setState({ activeTab: status, page: 1 });
            renderTabs();
            renderTable();
          },
        }),
      );
    }
  }

  function renderTable() {
    const { activeTab, query, rewardTitle, page } = store.getState();
    const q = query.trim().toLowerCase();

    const rows = ADMIN_DEV_FIXTURE.redemptions.filter((r) => {
      const matchesTab = r.status === activeTab;
      const matchesQ =
        !q ||
        r.voucherCode.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.customerId.toLowerCase().includes(q) ||
        r.customerPhone.toLowerCase().includes(q);
      const matchesReward = rewardTitle === 'all' || r.rewardTitle === rewardTitle;
      return matchesTab && matchesQ && matchesReward;
    });

    const toneFor = (st) =>
      st === 'Completed' ? 'active' : st === 'Pending' ? 'warning' : st === 'Rejected' ? 'danger' : 'neutral';

    renderDataTable(tableHost, {
      rows,
      page,
      pageSize: 8,
      totalItems: rows.length,
      emptyMessage: `No ${activeTab.toLowerCase()} redemptions match your lookup.`,
      columns: [
        { key: 'requestedOn', label: 'Requested On' },
        {
          key: 'voucherCode',
          label: 'Voucher Code',
          render: (row) => el('span', { className: 'voucher-code-chip', text: row.voucherCode }),
        },
        {
          key: 'customerName',
          label: 'Customer',
          render: (row) => `${row.customerName} (${row.customerId})`,
        },
        { key: 'rewardTitle', label: 'Reward' },
        { key: 'stampsCost', label: 'Stamps' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => createStatusBadge(row.status, toneFor(row.status)),
        },
        {
          key: 'actions',
          label: 'Action',
          render: (row) =>
            el('button', {
              type: 'button',
              className: row.status === 'Pending' ? 'btn btn--primary btn--sm' : 'btn btn--outline-muted btn--sm',
              text: row.status === 'Pending' ? 'Verify & Redeem' : 'Inspect',
              onClick: () => openRedemptionVerifyModal(row),
            }),
        },
      ],
    });
  }

  qs('#redemptions-apply-btn')?.addEventListener('click', () => {
    store.setState({
      query: searchInput?.value || '',
      rewardTitle: rewardFilter?.value || 'all',
      page: 1,
    });
    renderTable();
  });

  renderTabs();
  renderTable();
}
