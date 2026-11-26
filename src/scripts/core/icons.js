/**
 * BONFREE-HUB Lucide-Standard Inline SVG Icon Registry
 *
 * Renders crisp 24x24 stroke icons with zero external CDN runtime dependency
 * and strict Content-Security-Policy compatibility.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Each entry maps an icon name to Lucide geometry elements [tag, attrs].
 */
export const ICON_DEFINITIONS = Object.freeze({
  home: [
    ['path', { d: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8' }],
    ['path', { d: 'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }],
  ],
  user: [
    ['path', { d: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' }],
    ['circle', { cx: '12', cy: '7', r: '4' }],
  ],
  users: [
    ['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }],
    ['circle', { cx: '9', cy: '7', r: '4' }],
    ['path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }],
    ['path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' }],
  ],
  gift: [
    ['rect', { x: '3', y: '8', width: '18', height: '4', rx: '1' }],
    ['path', { d: 'M12 8v13' }],
    ['path', { d: 'M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7' }],
    ['path', { d: 'M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5' }],
  ],
  tag: [
    ['path', { d: 'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z' }],
    ['circle', { cx: '7.5', cy: '7.5', r: '.5', fill: 'currentColor' }],
  ],
  'shopping-bag': [
    ['path', { d: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z' }],
    ['path', { d: 'M3 6h18' }],
    ['path', { d: 'M16 10a4 4 0 0 1-8 0' }],
  ],
  receipt: [
    ['path', { d: 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z' }],
    ['path', { d: 'M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8' }],
    ['path', { d: 'M12 17.5v-11' }],
  ],
  award: [
    ['path', { d: 'm15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526' }],
    ['circle', { cx: '12', cy: '8', r: '6' }],
  ],
  'bar-chart': [
    ['line', { x1: '12', x2: '12', y1: '20', y2: '10' }],
    ['line', { x1: '18', x2: '18', y1: '20', y2: '4' }],
    ['line', { x1: '6', x2: '6', y1: '20', y2: '16' }],
  ],
  'file-text': [
    ['path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }],
    ['path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }],
    ['path', { d: 'M10 9H8' }],
    ['path', { d: 'M16 13H8' }],
    ['path', { d: 'M16 17H8' }],
  ],
  settings: [
    ['path', { d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' }],
    ['circle', { cx: '12', cy: '12', r: '3' }],
  ],
  bell: [
    ['path', { d: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9' }],
    ['path', { d: 'M10.3 21a1.94 1.94 0 0 0 3.4 0' }],
  ],
  search: [
    ['circle', { cx: '11', cy: '11', r: '8' }],
    ['path', { d: 'm21 21-4.3-4.3' }],
  ],
  mail: [
    ['rect', { width: '20', height: '16', x: '2', y: '4', rx: '2' }],
    ['path', { d: 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' }],
  ],
  lock: [
    ['rect', { width: '18', height: '11', x: '3', y: '11', rx: '2', ry: '2' }],
    ['path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' }],
  ],
  eye: [
    ['path', { d: 'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0' }],
    ['circle', { cx: '12', cy: '12', r: '3' }],
  ],
  'eye-off': [
    ['path', { d: 'M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49' }],
    ['path', { d: 'M14.084 14.158a3 3 0 0 1-4.242-4.242' }],
    ['path', { d: 'M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143' }],
    ['path', { d: 'm2 2 20 20' }],
  ],
  phone: [
    ['path', { d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' }],
  ],
  'map-pin': [
    ['path', { d: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0' }],
    ['circle', { cx: '12', cy: '10', r: '3' }],
  ],
  check: [['path', { d: 'M20 6 9 17l-5-5' }]],
  x: [
    ['path', { d: 'M18 6 6 18' }],
    ['path', { d: 'm6 6 12 12' }],
  ],
  'alert-circle': [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['line', { x1: '12', x2: '12', y1: '8', y2: '12' }],
    ['line', { x1: '12', x2: '12.01', y1: '16', y2: '16' }],
  ],
  info: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'M12 16v-4' }],
    ['path', { d: 'M12 8h.01' }],
  ],
  menu: [
    ['line', { x1: '4', x2: '20', y1: '12', y2: '12' }],
    ['line', { x1: '4', x2: '20', y1: '6', y2: '6' }],
    ['line', { x1: '4', x2: '20', y1: '18', y2: '18' }],
  ],
  plus: [
    ['path', { d: 'M5 12h14' }],
    ['path', { d: 'M12 5v14' }],
  ],
  'log-out': [
    ['path', { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' }],
    ['polyline', { points: '16 17 21 12 16 7' }],
    ['line', { x1: '21', x2: '9', y1: '12', y2: '12' }],
  ],
  'qr-code': [
    ['rect', { width: '5', height: '5', x: '3', y: '3', rx: '1' }],
    ['rect', { width: '5', height: '5', x: '16', y: '3', rx: '1' }],
    ['rect', { width: '5', height: '5', x: '3', y: '16', rx: '1' }],
    ['path', { d: 'M21 16h-3a2 2 0 0 0-2 2v3' }],
    ['path', { d: 'M21 21v.01' }],
    ['path', { d: 'M12 7v3a2 2 0 0 1-2 2H7' }],
    ['path', { d: 'M3 12h.01' }],
    ['path', { d: 'M12 3h.01' }],
    ['path', { d: 'M12 16v.01' }],
    ['path', { d: 'M16 12h1' }],
    ['path', { d: 'M21 12v.01' }],
    ['path', { d: 'M12 21v-1' }],
  ],
  copy: [
    ['rect', { width: '14', height: '14', x: '8', y: '8', rx: '2', ry: '2' }],
    ['path', { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' }],
  ],
  sparkles: [
    ['path', { d: 'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z' }],
  ],
  star: [
    ['polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' }],
  ],
  sliders: [
    ['line', { x1: '4', x2: '4', y1: '21', y2: '14' }],
    ['line', { x1: '4', x2: '4', y1: '10', y2: '3' }],
    ['line', { x1: '12', x2: '12', y1: '21', y2: '12' }],
    ['line', { x1: '12', x2: '12', y1: '8', y2: '3' }],
    ['line', { x1: '20', x2: '20', y1: '21', y2: '16' }],
    ['line', { x1: '20', x2: '20', y1: '12', y2: '3' }],
    ['line', { x1: '2', x2: '6', y1: '14', y2: '14' }],
    ['line', { x1: '10', x2: '14', y1: '8', y2: '8' }],
    ['line', { x1: '18', x2: '22', y1: '16', y2: '16' }],
  ],
  megaphone: [
    ['path', { d: 'm3 11 18-5v12L3 14v-3z' }],
    ['path', { d: 'M11.6 16.8a3 3 0 1 1-5.8-1.6' }],
  ],
  'clipboard-list': [
    ['rect', { width: '8', height: '4', x: '8', y: '2', rx: '1', ry: '1' }],
    ['path', { d: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2' }],
    ['path', { d: 'M12 11h4' }],
    ['path', { d: 'M12 16h4' }],
    ['path', { d: 'M8 11h.01' }],
    ['path', { d: 'M8 16h.01' }],
  ],
  'chevron-left': [['path', { d: 'm15 18-6-6 6-6' }]],
  'chevron-right': [['path', { d: 'm9 18 6-6-6-6' }]],
  'chevron-down': [['path', { d: 'm6 9 6 6 6-6' }]],
  'arrow-right': [
    ['path', { d: 'M5 12h14' }],
    ['path', { d: 'm12 5 7 7-7 7' }],
  ],
  crown: [
    ['path', { d: 'M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z' }],
    ['path', { d: 'M5 21h14' }],
  ],
  gem: [
    ['path', { d: 'M6 3h12l4 6-10 13L2 9Z' }],
    ['path', { d: 'M11 3 8 9l4 13 4-13-3-6' }],
    ['path', { d: 'M2 9h20' }],
  ],
  heart: [
    ['path', { d: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z' }],
  ],
  shirt: [
    ['path', { d: 'M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z' }],
  ],
  cake: [
    ['path', { d: 'M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8' }],
    ['path', { d: 'M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1' }],
    ['path', { d: 'M2 21h20' }],
    ['path', { d: 'M7 8v3' }],
    ['path', { d: 'M12 8v3' }],
    ['path', { d: 'M17 8v3' }],
    ['path', { d: 'M7 4h.01' }],
    ['path', { d: 'M12 4h.01' }],
    ['path', { d: 'M17 4h.01' }],
  ],
  percent: [
    ['line', { x1: '19', x2: '5', y1: '5', y2: '19' }],
    ['circle', { cx: '6.5', cy: '6.5', r: '2.5' }],
    ['circle', { cx: '17.5', cy: '17.5', r: '2.5' }],
  ],
  stamp: [
    ['path', { d: 'M5 22h14' }],
    ['path', { d: 'M19.27 13.73A2.5 2.5 0 0 0 17.5 13h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.5c0-.66-.26-1.3-.73-1.77Z' }],
    ['path', { d: 'M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-3-3c-1.66 0-3 1-3 3s1 2 1 3.5V13' }],
  ],
  'shield-check': [
    ['path', { d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z' }],
    ['path', { d: 'm9 12 2 2 4-4' }],
  ],
  instagram: [
    ['rect', { width: '20', height: '20', x: '2', y: '2', rx: '5', ry: '5' }],
    ['path', { d: 'M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z' }],
    ['line', { x1: '17.5', x2: '17.51', y1: '6.5', y2: '6.5' }],
  ],
  leaf: [
    ['path', { d: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z' }],
    ['path', { d: 'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12' }],
  ],
});

/**
 * Builds an accessible inline SVG icon node using Lucide geometry.
 * @param {string} name
 * @param {{ size?: number, strokeWidth?: number, className?: string, label?: string }} [opts]
 * @returns {SVGElement}
 */
export function createIcon(name, opts = {}) {
  const { size = 18, strokeWidth = 1.75, className = '', label = '' } = opts;
  const shapes = ICON_DEFINITIONS[name] || ICON_DEFINITIONS.info;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(strokeWidth));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  if (className) {
    svg.setAttribute('class', className);
  }

  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }

  for (const [tag, attrs] of shapes) {
    const child = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      child.setAttribute(k, v);
    }
    svg.appendChild(child);
  }

  return svg;
}

/**
 * Hydrates `<span data-icon="gift" data-icon-size="18"></span>` placeholders in a root node.
 */
export function hydrateIcons(root = document) {
  const nodes = root.querySelectorAll('[data-icon]');
  for (const placeholder of nodes) {
    const iconName = placeholder.getAttribute('data-icon');
    const size = Number(placeholder.getAttribute('data-icon-size')) || 18;
    const label = placeholder.getAttribute('data-icon-label') || '';
    const icon = createIcon(iconName, { size, label });
    placeholder.replaceWith(icon);
  }
}
