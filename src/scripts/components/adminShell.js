/**
 * BONFREE-HUB Reusable Admin Console Shell (Phase 2A)
 *
 * Guarantees an identical fixed black sidebar, topbar search, notifications,
 * account menu, mobile drawer, and logout flow across all admin pages.
 */
import { clearElement, el } from '../core/dom.js';
import { isProductionEnvironment, isSupabaseConfigured } from '../core/config.js';
import { createIcon } from '../core/icons.js';
import { supabaseAuth } from '../core/supabaseClient.js';
import { clearCachedStaffContext, getCachedStaffContext } from '../services/authService.js';
import { confirmModal, openModal, closeModal } from './modal.js';
import { showToast } from './toast.js';

export const ADMIN_NAV_GROUPS = Object.freeze([
  {
    group: 'Core',
    items: [
      { id: 'overview', label: 'Overview', icon: 'home', href: 'dashboard.html', ready: true, permission: null },
      { id: 'customers', label: 'Customers', icon: 'users', href: 'customers.html', ready: true, permission: 'customers.read' },
      { id: 'loyalty', label: 'Loyalty Programmes', icon: 'gift', href: 'loyalty.html', ready: true, permission: 'programmes.manage' },
    ],
  },
  {
    group: 'POS & Ledger',
    items: [
      { id: 'qr-scanner', label: 'QR Scanner', icon: 'qr-code', href: 'scanner.html', ready: true, permission: 'stamps.issue' },
      { id: 'stamps', label: 'Stamp Transactions', icon: 'stamp', href: 'stamps.html', ready: true, permission: 'stamps.read' },
      { id: 'rewards', label: 'Rewards', icon: 'award', href: 'rewards.html', ready: true, permission: 'rewards.manage' },
      { id: 'redemptions', label: 'Redemptions', icon: 'tag', href: 'redemptions.html', ready: true, permission: 'redemptions.verify' },
      { id: 'purchases', label: 'Purchase Records', icon: 'receipt', href: 'purchases.html', ready: true, permission: 'purchases.read' },
    ],
  },
  {
    group: 'Engagement',
    items: [
      { id: 'staff', label: 'Staff Management', icon: 'shield-check', href: 'staff.html', ready: true, permission: 'staff.manage' },
      { id: 'campaigns', label: 'Campaigns', icon: 'megaphone', href: 'campaigns.html', ready: true, permission: 'campaigns.manage' },
      { id: 'surveys', label: 'Surveys', icon: 'clipboard-list', href: 'surveys.html', ready: true, permission: 'surveys.manage' },
    ],
  },
  {
    group: 'Insights & System',
    items: [
      { id: 'analytics', label: 'Analytics', icon: 'bar-chart', href: 'analytics.html', ready: true, permission: 'analytics.view' },
      { id: 'reports', label: 'Reports', icon: 'file-text', href: 'reports.html', ready: true, permission: 'reports.export' },
      { id: 'settings', label: 'Settings', icon: 'settings', href: 'settings.html', ready: true, permission: 'settings.manage' },
    ],
  },
]);

export function canStaffAccessNavItem(item, staffContext = null) {
  if (!staffContext) return true; // Development preview mode shows complete navigation
  if (!item?.permission) return true;
  const perms = Array.isArray(staffContext.permissions) ? staffContext.permissions : [];
  return perms.includes(item.permission);
}

export function getVisibleAdminNavGroups(staffContext = getCachedStaffContext()) {
  if (!staffContext) return ADMIN_NAV_GROUPS;
  return ADMIN_NAV_GROUPS.map((grp) => ({
    ...grp,
    items: grp.items.filter((item) => canStaffAccessNavItem(item, staffContext)),
  })).filter((grp) => grp.items.length > 0);
}

function openUpcomingModuleModal(item) {
  openModal({
    title: `${item.label} — Access Restricted`,
    body: el('p', {
      className: 'text-sm text-muted',
      text: `The "${item.label}" console module is currently disabled or restricted for your account.`,
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
}

async function handleAdminLogout() {
  const confirmed = await confirmModal({
    title: 'Log Out of Admin Console',
    message: 'End your current admin console session and return to Staff Sign In?',
    confirmLabel: 'Logout',
    cancelLabel: 'Cancel',
  });
  if (confirmed) {
    clearCachedStaffContext();
    await supabaseAuth.signOut();
    window.location.href = 'login.html?reason=signed_out';
  }
}

function buildSidebarInner(activeId, onItemNavigate, staffContext = getCachedStaffContext()) {
  const header = el('div', { className: 'admin-sidebar__header' }, [
    el('a', { href: '../index.html', className: 'brand-wordmark', style: 'font-size: 1.15rem;', text: 'BONFREE-HUB' }),
    el('div', { className: 'admin-sidebar__sub', text: 'LOYALTY PLATFORM' }),
  ]);

  const groupsWrap = el('div', { className: 'admin-sidebar__groups' });
  const visibleGroups = getVisibleAdminNavGroups(staffContext);

  for (const grp of visibleGroups) {
    const list = el(
      'div',
      { className: 'admin-nav-list' },
      grp.items.map((item) => {
        const isActive = item.id === activeId;
        const left = el('span', { className: 'admin-nav-link__left' }, [
          createIcon(item.icon, { size: 16 }),
          el('span', { text: item.label }),
        ]);

        const badge = !item.ready ? el('span', { className: 'admin-nav-link__tag', text: '2B' }) : null;

        if (item.ready && item.href) {
          return el(
            'a',
            {
              href: item.href,
              className: `admin-nav-link${isActive ? ' is-active' : ''}`,
              'aria-current': isActive ? 'page' : null,
            },
            [left, badge],
          );
        }

        return el(
          'button',
          {
            type: 'button',
            className: `admin-nav-link${isActive ? ' is-active' : ''}`,
            onClick: () => {
              if (onItemNavigate) onItemNavigate();
              openUpcomingModuleModal(item);
            },
          },
          [left, badge],
        );
      }),
    );

    groupsWrap.append(
      el('div', {}, [
        el('div', { className: 'admin-nav-group__label', text: grp.group }),
        list,
      ]),
    );
  }

  const footer = el('div', { className: 'admin-sidebar__footer' }, [
    el(
      'button',
      {
        type: 'button',
        className: 'admin-nav-link',
        onClick: handleAdminLogout,
      },
      [
        el('span', { className: 'admin-nav-link__left' }, [
          createIcon('log-out', { size: 16 }),
          el('span', { text: 'Logout' }),
        ]),
      ],
    ),
  ]);

  return [header, groupsWrap, footer];
}

/**
 * Mounts the shared admin sidebar, mobile drawer, and topbar into an `.admin-shell` page.
 */
export function mountAdminShell({ activeId = 'overview', onGlobalSearch = null } = {}) {
  const sidebarHost = document.getElementById('admin-sidebar-host');
  const topbarHost = document.getElementById('admin-topbar-host');
  if (!sidebarHost || !topbarHost) return;

  clearElement(sidebarHost);
  clearElement(topbarHost);

  sidebarHost.className = 'admin-sidebar';
  sidebarHost.append(...buildSidebarInner(activeId));

  // Responsive Mobile Admin Drawer
  const backdrop = el('div', { className: 'nav-drawer-backdrop', 'aria-hidden': 'true' });
  const drawer = el('aside', {
    className: 'nav-drawer nav-drawer--dark',
    role: 'dialog',
    'aria-label': 'Admin Navigation',
    style: 'overflow-y: auto;',
  });

  const setDrawer = (open) => {
    backdrop.classList.toggle('is-open', open);
    drawer.classList.toggle('is-open', open);
    backdrop.setAttribute('aria-hidden', String(!open));
  };

  backdrop.addEventListener('click', () => setDrawer(false));
  drawer.append(...buildSidebarInner(activeId, () => setDrawer(false)));
  document.body.append(backdrop, drawer);

  // Topbar: Mobile menu button + Search + Notifications + Account Menu
  const mobileBtn = el(
    'button',
    {
      type: 'button',
      className: 'mobile-menu-btn',
      'aria-label': 'Open admin menu',
      onClick: () => setDrawer(true),
    },
    [createIcon('menu', { size: 18 })],
  );

  const searchInput = el('input', {
    type: 'search',
    id: 'admin-global-search',
    className: 'input',
    placeholder: 'Search customers, transactions, programmes...',
    'aria-label': 'Global admin search',
  });

  if (typeof onGlobalSearch === 'function') {
    searchInput.addEventListener('input', (e) => onGlobalSearch(e.target.value));
  } else {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && searchInput.value.trim()) {
        window.location.href = `customers.html?q=${encodeURIComponent(searchInput.value.trim())}`;
      }
    });
  }

  const searchBox = el('div', { className: 'admin-search-box' }, [
    el('span', { className: 'input-wrap__icon' }, [createIcon('search', { size: 15 })]),
    searchInput,
  ]);

  const notifyBtn = el(
    'button',
    {
      type: 'button',
      className: 'btn btn--icon btn--outline-muted',
      'aria-label': 'View notifications',
      onClick: () => {
        const liveConnected = isSupabaseConfigured();
        openModal({
          title: 'Admin Notifications',
          body: el('div', { className: 'stack' }, [
            el('div', { className: `alert ${liveConnected ? 'alert--success' : 'alert--warning'}` }, [
              createIcon(liveConnected ? 'check-circle' : 'alert-circle', { size: 16 }),
              el('span', {
                className: 'text-xs',
                text: liveConnected
                  ? 'Backend connected: all loyalty transactions, voucher verifications, and audit events are recorded in Supabase.'
                  : 'Supabase connection not detected. Configure PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY for live operations.',
              }),
            ]),
          ]),
        });
      },
    },
    [createIcon('bell', { size: 17 })],
  );

  const staffCtx = getCachedStaffContext();
  const displayName = staffCtx?.full_name || (isProductionEnvironment() ? 'Staff Member' : 'Admin Console (Local Dev)');
  const displaySub = staffCtx
    ? `${staffCtx.role_name || staffCtx.role_code} · ${staffCtx.staff_code}`
    : isProductionEnvironment()
      ? 'Sign in required'
      : 'care@bonfree-hub.in';

  const accountMenu = el('div', { className: 'admin-account-menu', hidden: true }, [
    el('div', { style: 'padding: 0.4rem 0.75rem; border-bottom: 1px solid var(--border-subtle);' }, [
      el('div', { className: 'text-xs', style: 'font-weight: 600;', text: displayName }),
      el('div', { className: 'text-xs text-muted', text: displaySub }),
    ]),
    el(
      'button',
      {
        type: 'button',
        className: 'admin-account-menu__item',
        onClick: () => {
          accountMenu.hidden = true;
          showToast({
            message: staffCtx
              ? `Signed in as ${displayName} (${staffCtx.role_name || staffCtx.role_code}).`
              : 'Role permissions enforce server-side via Supabase RLS and Edge Functions.',
            variant: 'info',
          });
        },
      },
      [createIcon('user', { size: 14 }), el('span', { text: 'Staff Profile' })],
    ),
    el(
      'button',
      {
        type: 'button',
        className: 'admin-account-menu__item',
        onClick: () => {
          accountMenu.hidden = true;
          handleAdminLogout();
        },
      },
      [createIcon('log-out', { size: 14 }), el('span', { text: 'Logout' })],
    ),
  ]);

  const accountBtn = el(
    'button',
    {
      type: 'button',
      className: 'admin-account-btn',
      'aria-expanded': 'false',
      onClick: () => {
        const nextOpen = accountMenu.hidden;
        accountMenu.hidden = !nextOpen;
        accountBtn.setAttribute('aria-expanded', String(nextOpen));
      },
    },
    [
      createIcon('user', { size: 14 }),
      el('span', { text: staffCtx?.staff_code || 'Admin' }),
      createIcon('chevron-down', { size: 13 }),
    ],
  );

  document.addEventListener('click', (event) => {
    if (!accountBtn.contains(event.target) && !accountMenu.contains(event.target)) {
      accountMenu.hidden = true;
      accountBtn.setAttribute('aria-expanded', 'false');
    }
  });

  topbarHost.className = 'admin-topbar';
  topbarHost.append(
    el('div', { className: 'admin-topbar__left' }, [mobileBtn, searchBox]),
    el('div', { className: 'admin-topbar__right' }, [
      notifyBtn,
      el('div', { className: 'admin-account-wrap' }, [accountBtn, accountMenu]),
    ]),
  );
}
