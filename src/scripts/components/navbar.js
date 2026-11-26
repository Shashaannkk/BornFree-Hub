/**
 * BONFREE-HUB Reusable Navigation Component
 * Supports Public Header + Mobile Drawer, Member Sidebar/Bottom Nav, and Admin Sidebar.
 */
import { el, clearElement } from '../core/dom.js';
import { createIcon } from '../core/icons.js';

export const PUBLIC_NAV_ITEMS = Object.freeze([
  { id: 'home', label: 'Home', href: 'index.html' },
  { id: 'about', label: 'About Us', href: 'about.html' },
  { id: 'loyalty', label: 'Loyalty Club', href: 'loyalty.html' },
  { id: 'how-it-works', label: 'How It Works', href: 'loyalty.html#how-it-works' },
  { id: 'contact', label: 'Contact', href: 'contact.html' },
]);

/**
 * Mounts the public header and responsive mobile drawer into target containers.
 */
export function mountPublicHeader(headerEl, { activeId = 'home', navItems = PUBLIC_NAV_ITEMS } = {}) {
  if (!headerEl) return;
  clearElement(headerEl);

  let drawerOpen = false;
  const backdrop = el('div', { className: 'nav-drawer-backdrop', 'aria-hidden': 'true' });
  const drawer = el('aside', {
    className: 'nav-drawer',
    role: 'dialog',
    'aria-label': 'Mobile Navigation',
  });

  const setDrawer = (open) => {
    drawerOpen = open;
    backdrop.classList.toggle('is-open', open);
    drawer.classList.toggle('is-open', open);
    backdrop.setAttribute('aria-hidden', String(!open));
    menuBtn.setAttribute('aria-expanded', String(open));
  };

  backdrop.addEventListener('click', () => setDrawer(false));

  const closeBtn = el(
    'button',
    {
      type: 'button',
      className: 'btn btn--icon btn--outline-muted',
      'aria-label': 'Close menu',
      onClick: () => setDrawer(false),
    },
    [createIcon('x', { size: 18 })],
  );

  const drawerLinks = el(
    'nav',
    { className: 'stack', 'aria-label': 'Mobile links' },
    navItems.map((item) =>
      el('a', {
        href: item.href,
        className: 'site-nav__link',
        'aria-current': item.id === activeId ? 'page' : null,
        text: item.label,
        onClick: () => setDrawer(false),
      }),
    ),
  );

  const drawerActions = el('div', { className: 'stack' }, [
    el('a', {
      href: 'login.html',
      className: 'btn btn--secondary btn--block',
      'aria-current': activeId === 'login' ? 'page' : null,
      text: 'Login',
      onClick: () => setDrawer(false),
    }),
    el('a', {
      href: 'register.html',
      className: 'btn btn--primary btn--block',
      'aria-current': activeId === 'register' ? 'page' : null,
      text: 'Join Now',
      onClick: () => setDrawer(false),
    }),
  ]);

  drawer.append(
    el('div', { className: 'between' }, [
      el('span', { className: 'brand-wordmark', text: 'BONFREE-HUB' }),
      closeBtn,
    ]),
    drawerLinks,
    drawerActions,
  );

  const menuBtn = el(
    'button',
    {
      type: 'button',
      className: 'mobile-menu-btn',
      'aria-label': 'Open menu',
      'aria-expanded': 'false',
      onClick: () => setDrawer(!drawerOpen),
    },
    [createIcon('menu', { size: 20 })],
  );

  const desktopNav = el(
    'nav',
    { className: 'site-nav', 'aria-label': 'Primary navigation' },
    navItems.map((item) =>
      el('a', {
        href: item.href,
        className: 'site-nav__link',
        'aria-current': item.id === activeId ? 'page' : null,
        text: item.label,
      }),
    ),
  );

  const desktopActions = el('div', { className: 'site-header__actions site-header__actions--desktop' }, [
    el('a', {
      href: 'login.html',
      className: 'btn btn--outline-muted btn--sm',
      'aria-current': activeId === 'login' ? 'page' : null,
      text: 'Login',
    }),
    el('a', {
      href: 'register.html',
      className: 'btn btn--primary btn--sm',
      'aria-current': activeId === 'register' ? 'page' : null,
      text: 'Join Now',
    }),
  ]);

  const inner = el('div', { className: 'container site-header__inner' }, [
    el('a', { href: 'index.html', className: 'brand-wordmark', text: 'BONFREE-HUB' }),
    desktopNav,
    desktopActions,
    menuBtn,
  ]);

  headerEl.className = 'site-header';
  headerEl.appendChild(inner);

  if (typeof document !== 'undefined' && document.body) {
    document.body.append(backdrop, drawer);
  }
}

/**
 * Renders a reusable sidebar navigation list for either Admin (dark) or Member (light) shells.
 */
export function renderSidebarNav(container, items = [], { activeId = '', onSelect } = {}) {
  if (!container) return;
  clearElement(container);

  const list = el(
    'nav',
    { className: 'sidebar-nav', 'aria-label': 'Section navigation' },
    items.map((item) =>
      el(
        'button',
        {
          type: 'button',
          className: `sidebar-nav__item${item.id === activeId ? ' is-active' : ''}`,
          'aria-current': item.id === activeId ? 'page' : null,
          onClick: () => {
            if (typeof onSelect === 'function') {
              onSelect(item.id);
            }
          },
        },
        [createIcon(item.icon || 'home', { size: 17 }), el('span', { text: item.label })],
      ),
    ),
  );

  container.appendChild(list);
}
