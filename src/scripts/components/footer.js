/**
 * BONFREE-HUB Shared Public Footer Component (Phase 1A)
 */
import { el, clearElement } from '../core/dom.js';
import { createIcon } from '../core/icons.js';
import { openModal, closeModal } from './modal.js';

export function openPolicyModal(kind) {
  const isPrivacy = kind === 'privacy';
  const title = isPrivacy ? 'Privacy Policy — BONFREE-HUB' : 'Loyalty Terms & Conditions';
  const bodyText = isPrivacy
    ? 'BONFREE-HUB collects only the member details required to maintain your digital stamp card, purchase qualification history, and reward vouchers. Account data is secured via authenticated access controls and is never sold to third parties.'
    : '1 stamp is awarded per qualifying purchase of ₹1,000 or above at BONFREE-HUB flagship stores or partner channels. Collect 10 stamps to redeem a ₹500 loyalty voucher. Stamps remain valid for 12 months and redeemed vouchers remain valid for 6 months.';

  openModal({
    title,
    body: el('p', { className: 'text-sm text-muted', text: bodyText }),
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

export function mountPublicFooter(footerEl) {
  if (!footerEl) return;
  clearElement(footerEl);

  footerEl.className = 'public-footer';

  const brandCol = el('div', { className: 'stack', style: 'gap: 0.75rem;' }, [
    el('a', { href: 'index.html', className: 'brand-wordmark', text: 'BONFREE-HUB' }),
    el('p', {
      className: 'text-sm',
      style: 'color: var(--color-text-inverse-muted); max-width: 34ch;',
      text: 'Modern streetwear & everyday fashion for young men and women — paired with a rewarding digital stamp club.',
    }),
    el('div', { className: 'cluster' }, [
      el(
        'a',
        {
          href: 'https://instagram.com',
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'btn btn--outline-muted btn--icon btn--sm',
          'aria-label': 'BONFREE-HUB on Instagram',
        },
        [createIcon('instagram', { size: 15 })],
      ),
      el(
        'a',
        {
          href: 'mailto:care@bonfree-hub.in',
          className: 'btn btn--outline-muted btn--icon btn--sm',
          'aria-label': 'Email BONFREE-HUB Support',
        },
        [createIcon('mail', { size: 15 })],
      ),
    ]),
  ]);

  const exploreCol = el('div', {}, [
    el('h3', { className: 'public-footer__heading', text: 'Explore' }),
    el('ul', { className: 'public-footer__links' }, [
      el('li', {}, [el('a', { href: 'index.html', text: 'Home' })]),
      el('li', {}, [el('a', { href: 'about.html', text: 'About Us' })]),
      el('li', {}, [el('a', { href: 'loyalty.html', text: 'Loyalty Club' })]),
      el('li', {}, [el('a', { href: 'loyalty.html#how-it-works', text: 'How It Works' })]),
      el('li', {}, [el('a', { href: 'contact.html', text: 'Contact Us' })]),
    ]),
  ]);

  const legalCol = el('div', {}, [
    el('h3', { className: 'public-footer__heading', text: 'Member Policies' }),
    el('ul', { className: 'public-footer__links' }, [
      el('li', {}, [el('a', { href: 'privacy.html', text: 'Privacy Policy' })]),
      el('li', {}, [el('a', { href: 'terms.html', text: 'Terms & Conditions' })]),
      el('li', {}, [el('a', { href: 'survey.html', text: 'Member Feedback' })]),
    ]),
  ]);

  const contactCol = el('div', {}, [
    el('h3', { className: 'public-footer__heading', text: 'Contact & Flagship Store' }),
    el('ul', { className: 'public-footer__links' }, [
      el('li', { className: 'cluster' }, [
        createIcon('map-pin', { size: 14 }),
        el('span', { text: 'Spectrum Mall, MG Road, Bengaluru — 560001' }),
      ]),
      el('li', { className: 'cluster' }, [
        createIcon('phone', { size: 14 }),
        el('a', { href: 'tel:+919876543210', text: '+91 98765 43210 (10 AM – 8 PM)' }),
      ]),
      el('li', { className: 'cluster' }, [
        createIcon('mail', { size: 14 }),
        el('a', { href: 'mailto:care@bonfree-hub.in', text: 'care@bonfree-hub.in' }),
      ]),
    ]),
  ]);

  const container = el('div', { className: 'container' }, [
    el('div', { className: 'public-footer__grid' }, [brandCol, exploreCol, legalCol, contactCol]),
    el('div', { className: 'public-footer__bottom' }, [
      el('span', { text: '© 2026 BONFREE-HUB. All rights reserved.' }),
      el('span', { text: 'Digital Loyalty & Rewards Platform' }),
    ]),
  ]);

  footerEl.appendChild(container);
}
