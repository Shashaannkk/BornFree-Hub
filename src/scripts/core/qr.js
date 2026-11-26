/**
 * BONFREE-HUB Deterministic Monochrome QR Matrix SVG Generator
 *
 * Generates a crisp, CSP-safe 21x21 QR-style vector code derived from the member's
 * Membership ID (no external image APIs or canvas dependencies).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function isFinderModule(r, c, size) {
  const inTopLeft = r < 7 && c < 7;
  const inTopRight = r < 7 && c >= size - 7;
  const inBottomLeft = r >= size - 7 && c < 7;
  if (!inTopLeft && !inTopRight && !inBottomLeft) return null;

  const lr = r >= size - 7 ? r - (size - 7) : r;
  const lc = c >= size - 7 ? c - (size - 7) : c;
  if (lr === 0 || lr === 6 || lc === 0 || lc === 6) return true;
  if (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4) return true;
  return false;
}

function isSeparator(r, c, size) {
  if (r === 7 && c <= 7) return true;
  if (c === 7 && r <= 7) return true;
  if (r === 7 && c >= size - 8) return true;
  if (c === size - 8 && r <= 7) return true;
  if (r === size - 8 && c <= 7) return true;
  if (c === 7 && r >= size - 8) return true;
  return false;
}

/**
 * Creates a deterministic monochrome SVG element representing the member's checkout QR code.
 * @param {string} membershipCode
 * @param {string} [className]
 * @returns {SVGElement}
 */
export function createMembershipQrSvg(membershipCode = 'BF-001248', className = 'digital-pass__qr-svg') {
  const size = 21;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class', className);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Membership QR code for ${membershipCode}`);

  const bg = document.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('width', String(size));
  bg.setAttribute('height', String(size));
  bg.setAttribute('fill', '#ffffff');
  svg.appendChild(bg);

  let seed = hashString(membershipCode);
  const nextBit = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) % 2 === 0;
  };

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      let dark = false;
      const finder = isFinderModule(r, c, size);
      if (finder !== null) {
        dark = finder;
      } else if (isSeparator(r, c, size)) {
        dark = false;
      } else if (r === 6 || c === 6) {
        dark = (r + c) % 2 === 0;
      } else {
        dark = nextBit();
      }

      if (dark) {
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', String(c));
        rect.setAttribute('y', String(r));
        rect.setAttribute('width', '1');
        rect.setAttribute('height', '1');
        rect.setAttribute('fill', '#101010');
        svg.appendChild(rect);
      }
    }
  }

  return svg;
}
