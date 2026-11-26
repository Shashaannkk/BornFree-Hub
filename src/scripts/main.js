/**
 * BONFREE-HUB Main Bootstrapper
 * Initializes shared navigation, footer, icons, forms, public pages, and design-system showcase.
 */
import { getPublicConfig } from './core/config.js';
import { hydrateIcons } from './core/icons.js';
import { el, qs } from './core/dom.js';
import { createStore } from './core/state.js';
import { mountPublicHeader, renderSidebarNav } from './components/navbar.js';
import { mountPublicFooter } from './components/footer.js';
import { confirmModal, openModal } from './components/modal.js';
import { showToast, createAlert } from './components/toast.js';
import { createStatusBadge, renderDataTable } from './components/table.js';
import { initPasswordToggles, setButtonLoading, validateForm } from './components/form.js';
import { renderCardSkeleton, setRegionLoading } from './components/loader.js';
import {
  initInteractiveLoyaltyCard,
  initFaqAccordion,
  initScrollReveals,
  initCustomerSurveyPage,
} from './pages/public.js';
import { initAuthAndContactPages } from './pages/auth.js';
import { initCustomerDashboard } from './pages/customerDashboard.js';

const uiStore = createStore({
  tablePage: 1,
  tableLoading: false,
  adminActiveNav: 'overview',
});

const SAMPLE_CUSTOMERS = [
  { id: 'BF-001248', name: 'Aanya Sharma', phone: '+91 98765 43210', programme: 'Classic Stamps', stamps: 7, status: 'Active' },
  { id: 'BF-001249', name: 'Rohan Mehta', phone: '+91 98200 11876', programme: 'Classic Stamps', stamps: 4, status: 'Active' },
  { id: 'BF-001250', name: 'Kavya Iyer', phone: '+91 98990 22446', programme: 'Streetwear Club', stamps: 10, status: 'Active' },
  { id: 'BF-001251', name: 'Vihaan Malhotra', phone: '+91 97654 33011', programme: 'Streetwear Club', stamps: 2, status: 'Inactive' },
  { id: 'BF-001252', name: 'Myra Desai', phone: '+91 98330 77122', programme: 'Premium Circle', stamps: 9, status: 'Active' },
  { id: 'BF-001253', name: 'Arjun Bedi', phone: '+91 98100 55667', programme: 'Classic Stamps', stamps: 6, status: 'Active' },
];

function initStampTrackers() {
  const grids = document.querySelectorAll('[data-stamp-grid]');
  for (const grid of grids) {
    const total = Number(grid.getAttribute('data-stamp-total')) || 10;
    const earned = Number(grid.getAttribute('data-stamp-earned')) || 0;
    grid.replaceChildren();
    for (let i = 1; i <= total; i += 1) {
      const slot = el('span', {
        className: `stamp-slot${i <= earned ? ' is-earned' : ''}`,
        'aria-label': `Stamp ${i} of ${total}${i <= earned ? ' earned' : ' remaining'}`,
        text: i <= earned ? '✓' : '',
      });
      grid.appendChild(slot);
    }
  }
}

function initDesignSystemShowcase() {
  const tableTarget = qs('#ds-table-demo');
  if (tableTarget) {
    const pageSize = 3;
    const renderDemoTable = () => {
      const { tablePage, tableLoading } = uiStore.getState();
      const start = (tablePage - 1) * pageSize;
      const slice = SAMPLE_CUSTOMERS.slice(start, start + pageSize);

      renderDataTable(tableTarget, {
        loading: tableLoading,
        page: tablePage,
        pageSize,
        totalItems: SAMPLE_CUSTOMERS.length,
        rows: slice,
        onPageChange: (nextPage) => {
          uiStore.setState({ tablePage: nextPage });
          renderDemoTable();
        },
        columns: [
          { key: 'id', label: 'Member ID' },
          { key: 'name', label: 'Customer' },
          { key: 'programme', label: 'Programme' },
          { key: 'stamps', label: 'Stamp Balance' },
          {
            key: 'status',
            label: 'Status',
            render: (row) => createStatusBadge(row.status, row.status === 'Active' ? 'active' : 'inactive'),
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) =>
              el('button', {
                type: 'button',
                className: 'btn btn--outline-muted btn--sm',
                text: 'Inspect',
                onClick: () =>
                  openModal({
                    title: `Member Preview — ${row.name}`,
                    body: `Membership ID: ${row.id} · Programme: ${row.programme} · Stamps: ${row.stamps}/10`,
                  }),
              }),
          },
        ],
      });
    };

    renderDemoTable();

    qs('#ds-toggle-table-loading')?.addEventListener('click', () => {
      uiStore.setState((prev) => ({ tableLoading: !prev.tableLoading }));
      renderDemoTable();
    });
  }

  const adminSidebarDemo = qs('#ds-admin-sidebar-demo');
  if (adminSidebarDemo) {
    const adminItems = [
      { id: 'overview', label: 'Overview', icon: 'home' },
      { id: 'customers', label: 'Customers', icon: 'users' },
      { id: 'programmes', label: 'Loyalty Programmes', icon: 'gift' },
      { id: 'purchases', label: 'Purchase Records', icon: 'receipt' },
      { id: 'campaigns', label: 'Campaigns', icon: 'megaphone' },
      { id: 'analytics', label: 'Analytics', icon: 'bar-chart' },
      { id: 'settings', label: 'Settings', icon: 'settings' },
    ];
    const renderAdminNav = () => {
      renderSidebarNav(adminSidebarDemo, adminItems, {
        activeId: uiStore.getState().adminActiveNav,
        onSelect: (id) => {
          uiStore.setState({ adminActiveNav: id });
          renderAdminNav();
          showToast({ message: `Selected admin section: ${id}`, variant: 'info', durationMs: 2200 });
        },
      });
    };
    renderAdminNav();
  }

  const alertsContainer = qs('#ds-alerts-demo');
  if (alertsContainer) {
    alertsContainer.append(
      createAlert({
        variant: 'info',
        title: 'Phase 1 Foundation Ready',
        message: 'Database persistence and Supabase Auth endpoints will connect in Phase 2.',
      }),
      createAlert({
        variant: 'success',
        title: 'Stamp Credited',
        message: '1 loyalty stamp issued for qualifying streetwear order above ₹1,000.',
      }),
      createAlert({
        variant: 'warning',
        title: '2 Stamps Remaining',
        message: 'Collect 2 more stamps to unlock your ₹500 BONFREE-HUB voucher.',
      }),
      createAlert({
        variant: 'danger',
        title: 'Validation Required',
        message: 'Qualifying purchase threshold was not met on this receipt.',
      }),
    );
  }

  const skeletonTarget = qs('#ds-skeleton-demo');
  if (skeletonTarget) {
    skeletonTarget.appendChild(renderCardSkeleton(3));
  }

  const overlayTarget = qs('#ds-overlay-demo');
  qs('#ds-toggle-overlay-btn')?.addEventListener('click', () => {
    const active = overlayTarget?.querySelector(':scope > .loading-overlay');
    setRegionLoading(overlayTarget, !active, 'Syncing loyalty ledger...');
  });

  qs('#ds-open-modal-btn')?.addEventListener('click', async () => {
    const confirmed = await confirmModal({
      title: 'Confirm Reward Redemption',
      message: 'Redeem 10 stamps for a ₹500 BONFREE-HUB store voucher? (Foundation UI preview)',
      confirmLabel: 'Redeem Voucher',
      cancelLabel: 'Keep Stamps',
    });
    showToast({
      message: confirmed ? 'Redemption preview confirmed.' : 'Redemption preview cancelled.',
      variant: confirmed ? 'success' : 'info',
    });
  });

  qs('#ds-toast-success-btn')?.addEventListener('click', () => {
    showToast({ message: 'Design system toast notification triggered.', variant: 'success' });
  });

  const demoForm = qs('#ds-validation-form');
  if (demoForm) {
    demoForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const submitBtn = demoForm.querySelector('button[type="submit"]');
      const { valid } = validateForm(demoForm);
      if (!valid) {
        showToast({ message: 'Please resolve highlighted form fields.', variant: 'warning' });
        return;
      }
      setButtonLoading(submitBtn, true, 'Validating...');
      window.setTimeout(() => {
        setButtonLoading(submitBtn, false);
        showToast({ message: 'Form inputs passed client-side validation.', variant: 'success' });
      }, 700);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const cfg = getPublicConfig();
  const activePage = document.body.dataset.page || 'home';

  const headerHost = qs('#site-header');
  if (headerHost) {
    mountPublicHeader(headerHost, { activeId: activePage });
  }

  const footerHost = qs('#site-footer');
  if (footerHost) {
    mountPublicFooter(footerHost);
  }

  initAuthAndContactPages();
  initCustomerDashboard();
  initStampTrackers();
  initInteractiveLoyaltyCard();
  initFaqAccordion();
  initScrollReveals();
  initCustomerSurveyPage();
  initPasswordToggles();
  initDesignSystemShowcase();
  hydrateIcons();

  if (cfg.environment === 'development') {
    document.documentElement.dataset.bonfreeReady = 'true';
  }
});
