/**
 * BONFREE-HUB Brand-Colour SVG Chart Components
 * Dynamically scales axes for real Supabase metrics of any magnitude and empty states.
 *
 * Brand palette (hardcoded for SVG attribute compatibility — cannot use CSS variables):
 *   Data line/bars:  #b51f20  (--color-brand-primary)
 *   Labels/text:     #71717a  (--color-grey)
 *   Grid lines:      #e4e4e7  (--color-grey-border)
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

function buildNiceScale(values = [], explicitMin = null, explicitMax = null) {
  const nums = values.map((v) => Number(v || 0)).filter((v) => !Number.isNaN(v));
  const rawMax = explicitMax !== null ? explicitMax : Math.max(0, ...(nums.length ? nums : [0]));
  const rawMin = explicitMin !== null ? explicitMin : 0;

  let maxVal = rawMax <= rawMin ? rawMin + 10 : rawMax * 1.15;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(1, maxVal))));
  const step = Math.max(1, Math.ceil((maxVal - rawMin) / 4 / magnitude) * magnitude);
  maxVal = rawMin + step * 4;

  const ticks = [0, 1, 2, 3, 4].map((i) => rawMin + step * i);
  return { minVal: rawMin, maxVal, ticks };
}

/**
 * Renders an accessible brand-coloured line chart SVG.
 */
export function createLineChartSvg(
  series = [],
  { minVal = null, maxVal = null, valueKey = 'total', ariaLabel = 'Customer growth chart' } = {},
) {
  const width = 460;
  const height = 190;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 28;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', ariaLabel);

  if (!Array.isArray(series) || series.length === 0) {
    const empty = document.createElementNS(SVG_NS, 'text');
    empty.setAttribute('x', String(width / 2));
    empty.setAttribute('y', String(height / 2));
    empty.setAttribute('text-anchor', 'middle');
    empty.setAttribute('font-size', '12');
    empty.setAttribute('fill', '#71717a');
    empty.textContent = 'No records in selected range';
    svg.appendChild(empty);
    return svg;
  }

  const values = series.map((pt) => Number(pt[valueKey] ?? pt.total ?? pt.count ?? 0));
  const scale = buildNiceScale(values, minVal, maxVal);

  for (const tick of scale.ticks) {
    const y = padT + ((scale.maxVal - tick) / Math.max(1, scale.maxVal - scale.minVal)) * (height - padT - padB);
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(padL));
    line.setAttribute('x2', String(width - padR));
    line.setAttribute('y1', String(y));
    line.setAttribute('y2', String(y));
    line.setAttribute('stroke', '#e4e4e7');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);

    const txt = document.createElementNS(SVG_NS, 'text');
    txt.setAttribute('x', String(padL - 8));
    txt.setAttribute('y', String(y + 4));
    txt.setAttribute('text-anchor', 'end');
    txt.setAttribute('font-size', '10');
    txt.setAttribute('fill', '#71717a');
    txt.textContent = tick.toLocaleString('en-IN');
    svg.appendChild(txt);
  }

  const pts = series.map((pt, idx) => {
    const v = Number(pt[valueKey] ?? pt.total ?? pt.count ?? 0);
    return {
      ...pt,
      x: padL + (idx / Math.max(1, series.length - 1)) * (width - padL - padR),
      y: padT + ((scale.maxVal - v) / Math.max(1, scale.maxVal - scale.minVal)) * (height - padT - padB),
    };
  });

  const poly = document.createElementNS(SVG_NS, 'polyline');
  poly.setAttribute('fill', 'none');
  poly.setAttribute('stroke', '#b51f20');
  poly.setAttribute('stroke-width', '2');
  poly.setAttribute('points', pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
  svg.appendChild(poly);

  for (const pt of pts) {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', pt.x.toFixed(1));
    c.setAttribute('cy', pt.y.toFixed(1));
    c.setAttribute('r', '3.5');
    c.setAttribute('fill', '#b51f20');
    svg.appendChild(c);

    const lbl = document.createElementNS(SVG_NS, 'text');
    lbl.setAttribute('x', pt.x.toFixed(1));
    lbl.setAttribute('y', String(height - 6));
    lbl.setAttribute('text-anchor', 'middle');
    lbl.setAttribute('font-size', '10');
    lbl.setAttribute('fill', '#71717a');
    lbl.textContent = pt.label;
    svg.appendChild(lbl);
  }

  return svg;
}

/**
 * Renders an accessible brand-coloured bar chart SVG.
 */
export function createBarChartSvg(bars = [], { maxVal = null, ariaLabel = 'Stamp issuance bar chart' } = {}) {
  const width = 420;
  const height = 190;
  const padL = 46;
  const padB = 28;
  const padT = 18;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', ariaLabel);

  if (!Array.isArray(bars) || bars.length === 0) {
    const empty = document.createElementNS(SVG_NS, 'text');
    empty.setAttribute('x', String(width / 2));
    empty.setAttribute('y', String(height / 2));
    empty.setAttribute('text-anchor', 'middle');
    empty.setAttribute('font-size', '12');
    empty.setAttribute('fill', '#71717a');
    empty.textContent = 'No issuance data for selected range';
    svg.appendChild(empty);
    return svg;
  }

  const values = bars.map((b) => Number(b.value ?? b.count ?? 0));
  const scale = buildNiceScale(values, 0, maxVal);

  for (const tick of scale.ticks) {
    const y = padT + ((scale.maxVal - tick) / Math.max(1, scale.maxVal)) * (height - padT - padB);
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(padL));
    line.setAttribute('x2', String(width - 12));
    line.setAttribute('y1', String(y));
    line.setAttribute('y2', String(y));
    line.setAttribute('stroke', '#e4e4e7');
    svg.appendChild(line);

    const txt = document.createElementNS(SVG_NS, 'text');
    txt.setAttribute('x', String(padL - 6));
    txt.setAttribute('y', String(y + 4));
    txt.setAttribute('text-anchor', 'end');
    txt.setAttribute('font-size', '10');
    txt.setAttribute('fill', '#71717a');
    txt.textContent = tick.toLocaleString('en-IN');
    svg.appendChild(txt);
  }

  const slotW = (width - padL - 20) / Math.max(1, bars.length);
  const barW = Math.min(36, Math.max(14, slotW * 0.6));
  bars.forEach((b, idx) => {
    const val = Number(b.value ?? b.count ?? 0);
    const x = padL + idx * slotW + (slotW - barW) / 2;
    const barH = Math.max(0, (val / Math.max(1, scale.maxVal)) * (height - padT - padB));
    const y = height - padB - barH;

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', x.toFixed(1));
    rect.setAttribute('y', y.toFixed(1));
    rect.setAttribute('width', String(barW));
    rect.setAttribute('height', barH.toFixed(1));
    rect.setAttribute('rx', '2');
    rect.setAttribute('fill', '#b51f20');
    svg.appendChild(rect);

    const valTxt = document.createElementNS(SVG_NS, 'text');
    valTxt.setAttribute('x', (x + barW / 2).toFixed(1));
    valTxt.setAttribute('y', Math.max(12, y - 5).toFixed(1));
    valTxt.setAttribute('text-anchor', 'middle');
    valTxt.setAttribute('font-size', '10');
    valTxt.setAttribute('font-weight', '600');
    valTxt.setAttribute('fill', '#b51f20');
    valTxt.textContent = val.toLocaleString('en-IN');
    svg.appendChild(valTxt);

    const lbl = document.createElementNS(SVG_NS, 'text');
    lbl.setAttribute('x', (x + barW / 2).toFixed(1));
    lbl.setAttribute('y', String(height - 8));
    lbl.setAttribute('text-anchor', 'middle');
    lbl.setAttribute('font-size', '10');
    lbl.setAttribute('fill', '#71717a');
    lbl.textContent = b.label;
    svg.appendChild(lbl);
  });

  return svg;
}
