/**
 * BONFREE-HUB Reusable Data Table & Pagination Component
 */
import { el, clearElement } from '../core/dom.js';
import { createIcon } from '../core/icons.js';
import { renderTableSkeleton } from './loader.js';

/**
 * Renders a status badge cell safely.
 */
export function createStatusBadge(label, tone = 'neutral') {
  return el('span', { className: `badge badge--${tone}`, text: label });
}

/**
 * Renders a structured table shell with optional loading, empty state, and pagination.
 */
export function renderDataTable(
  container,
  {
    columns = [],
    rows = [],
    loading = false,
    emptyMessage = 'No records match your current filters.',
    page = 1,
    pageSize = 10,
    totalItems = rows.length,
    onPageChange = null,
  } = {},
) {
  if (!container) return;
  clearElement(container);

  const shell = el('div', { className: 'table-shell' });

  if (loading) {
    shell.appendChild(renderTableSkeleton({ rows: 5, cols: Math.max(columns.length, 4) }));
    container.appendChild(shell);
    return;
  }

  if (rows.length === 0) {
    shell.appendChild(
      el('div', { className: 'table-empty' }, [
        el('p', { className: 'text-sm', text: emptyMessage }),
      ]),
    );
    container.appendChild(shell);
    return;
  }

  const thead = el('thead', {}, [
    el(
      'tr',
      {},
      columns.map((col) => el('th', { text: col.label })),
    ),
  ]);

  const tbody = el(
    'tbody',
    {},
    rows.map((row) =>
      el(
        'tr',
        {},
        columns.map((col) => {
          const td = el('td');
          if (typeof col.render === 'function') {
            const rendered = col.render(row);
            if (rendered instanceof Node) {
              td.appendChild(rendered);
            } else {
              td.textContent = rendered ?? '';
            }
          } else {
            td.textContent = row[col.key] ?? '';
          }
          return td;
        }),
      ),
    ),
  );

  const tableScroll = el('div', { className: 'table-scroll' }, [
    el('table', { className: 'data-table' }, [thead, tbody]),
  ]);

  shell.appendChild(tableScroll);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems > 0 && typeof onPageChange === 'function') {
    const startItem = (page - 1) * pageSize + 1;
    const endItem = Math.min(totalItems, page * pageSize);

    const pagesWrap = el('div', { className: 'pagination__pages' });
    pagesWrap.appendChild(
      el(
        'button',
        {
          type: 'button',
          className: 'page-btn',
          disabled: page <= 1,
          'aria-label': 'Previous page',
          onClick: () => onPageChange(page - 1),
        },
        [createIcon('chevron-left', { size: 14 })],
      ),
    );

    for (let p = 1; p <= totalPages; p += 1) {
      pagesWrap.appendChild(
        el('button', {
          type: 'button',
          className: `page-btn${p === page ? ' is-active' : ''}`,
          text: String(p),
          'aria-current': p === page ? 'page' : null,
          onClick: () => onPageChange(p),
        }),
      );
    }

    pagesWrap.appendChild(
      el(
        'button',
        {
          type: 'button',
          className: 'page-btn',
          disabled: page >= totalPages,
          'aria-label': 'Next page',
          onClick: () => onPageChange(page + 1),
        },
        [createIcon('chevron-right', { size: 14 })],
      ),
    );

    shell.appendChild(
      el('div', { className: 'pagination' }, [
        el('span', { text: `Showing ${startItem}-${endItem} of ${totalItems} records` }),
        pagesWrap,
      ]),
    );
  }

  container.appendChild(shell);
}
