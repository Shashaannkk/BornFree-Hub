/**
 * BONFREE-HUB Lightweight Monochrome SVG Chart Components
 * Shared across Admin Overview and Analytics pages.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Renders an accessible monochrome line chart SVG.
 */
export function createLineChartSvg(series, { minVal = 9500, maxVal = 13200, ariaLabel = 'Customer growth chart' } = {}) {
  const width = 460;
  const height = 190;
  const padL = 44;
  const padR = 16;
  const padT = 16;
  const padB = 28;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', ariaLabel);

  for (const tick of [10000, 11000, 12000, 13000]) {
    const y = padT + ((maxVal - tick) / (maxVal - minVal)) * (height - padT - padB);
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(padL));
    line.setAttribute('x2', String(width - padR));
    line.setAttribute('y1', String(y));
    line.setAttribute('y2', String(y));
    line.setAttribute('stroke', '#e5e4df');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);

    const txt = document.createElementNS(SVG_NS, 'text');
    txt.setAttribute('x', String(padL - 8));
    txt.setAttribute('y', String(y + 4));
    txt.setAttribute('text-anchor', 'end');
    txt.setAttribute('font-size', '10');
    txt.setAttribute('fill', '#6e6e6e');
    txt.textContent = tick.toLocaleString('en-IN');
    svg.appendChild(txt);
  }

  const pts = series.map((pt, idx) => ({
    ...pt,
    x: padL + (idx / Math.max(1, series.length - 1)) * (width - padL - padR),
    y: padT + ((maxVal - pt.total) / (maxVal - minVal)) * (height - padT - padB),
  }));

  const poly = document.createElementNS(SVG_NS, 'polyline');
  poly.setAttribute('fill', 'none');
  poly.setAttribute('stroke', '#101010');
  poly.setAttribute('stroke-width', '2');
  poly.setAttribute('points', pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
  svg.appendChild(poly);

  for (const pt of pts) {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', pt.x.toFixed(1));
    c.setAttribute('cy', pt.y.toFixed(1));
    c.setAttribute('r', '3.5');
    c.setAttribute('fill', '#101010');
    svg.appendChild(c);

    const lbl = document.createElementNS(SVG_NS, 'text');
    lbl.setAttribute('x', pt.x.toFixed(1));
    lbl.setAttribute('y', String(height - 6));
    lbl.setAttribute('text-anchor', 'middle');
    lbl.setAttribute('font-size', '10');
    lbl.setAttribute('fill', '#6e6e6e');
    lbl.textContent = pt.label;
    svg.appendChild(lbl);
  }

  return svg;
}

/**
 * Renders an accessible monochrome bar chart SVG.
 */
export function createBarChartSvg(bars, { maxVal = 10000, ariaLabel = 'Stamp issuance bar chart' } = {}) {
  const width = 420;
  const height = 190;
  const padL = 42;
  const padB = 28;
  const padT = 18;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', ariaLabel);

  for (const tick of [2000, 4000, 6000, 8000, 10000]) {
    const y = padT + ((maxVal - tick) / maxVal) * (height - padT - padB);
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(padL));
    line.setAttribute('x2', String(width - 12));
    line.setAttribute('y1', String(y));
    line.setAttribute('y2', String(y));
    line.setAttribute('stroke', '#e5e4df');
    svg.appendChild(line);

    const txt = document.createElementNS(SVG_NS, 'text');
    txt.setAttribute('x', String(padL - 6));
    txt.setAttribute('y', String(y + 4));
    txt.setAttribute('text-anchor', 'end');
    txt.setAttribute('font-size', '10');
    txt.setAttribute('fill', '#6e6e6e');
    txt.textContent = String(tick);
    svg.appendChild(txt);
  }

  const slotW = (width - padL - 20) / Math.max(1, bars.length);
  bars.forEach((b, idx) => {
    const barW = 36;
    const x = padL + idx * slotW + (slotW - barW) / 2;
    const barH = (b.value / maxVal) * (height - padT - padB);
    const y = height - padB - barH;

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', x.toFixed(1));
    rect.setAttribute('y', y.toFixed(1));
    rect.setAttribute('width', String(barW));
    rect.setAttribute('height', barH.toFixed(1));
    rect.setAttribute('rx', '2');
    rect.setAttribute('fill', '#101010');
    svg.appendChild(rect);

    const valTxt = document.createElementNS(SVG_NS, 'text');
    valTxt.setAttribute('x', (x + barW / 2).toFixed(1));
    valTxt.setAttribute('y', (y - 5).toFixed(1));
    valTxt.setAttribute('text-anchor', 'middle');
    valTxt.setAttribute('font-size', '10');
    valTxt.setAttribute('font-weight', '600');
    valTxt.setAttribute('fill', '#101010');
    valTxt.textContent = b.value.toLocaleString('en-IN');
    svg.appendChild(valTxt);

    const lbl = document.createElementNS(SVG_NS, 'text');
    lbl.setAttribute('x', (x + barW / 2).toFixed(1));
    lbl.setAttribute('y', String(height - 8));
    lbl.setAttribute('text-anchor', 'middle');
    lbl.setAttribute('font-size', '10');
    lbl.setAttribute('fill', '#6e6e6e');
    lbl.textContent = b.label;
    svg.appendChild(lbl);
  });

  return svg;
}
