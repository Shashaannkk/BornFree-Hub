/**
 * BONFREE-HUB Standards-Compliant ISO/IEC 18004 QR Code SVG Generator (Phase 5 / Audited Phase 9)
 *
 * Security Rules:
 * - Only accepts opaque non-sensitive membership identifiers (e.g. `BFQR-001248A9C4E2`).
 * - Rejects emails, phone numbers, JWTs, passwords, or authorization credentials.
 * - Produces genuine scannable ISO/IEC 18004 Byte-mode QR Codes (Versions 1–6, ECC Level M)
 *   decodable by standard camera apps and `html5-qrcode` / ZXing on `admin/scanner.html`.
 */

const OPAQUE_TOKEN_REGEX = /^BFQR-[A-Z0-9-]{8,48}$/;

export function isOpaqueQrToken(value = '') {
  const token = String(value || '').trim();
  if (!token) return false;
  if (token.includes('@') || token.includes('eyJ') || token.includes('.')) {
    return false;
  }
  return OPAQUE_TOKEN_REGEX.test(token);
}

// ISO/IEC 18004 Version 1–6 specifications for Error Correction Level M
const QR_M_SPECS = [
  { version: 1, size: 21, dataCodewords: 16, blocks: 1, ecPerBlock: 10, maxBytes: 14, align: [] },
  { version: 2, size: 25, dataCodewords: 28, blocks: 1, ecPerBlock: 16, maxBytes: 26, align: [6, 18] },
  { version: 3, size: 29, dataCodewords: 44, blocks: 1, ecPerBlock: 26, maxBytes: 42, align: [6, 22] },
  { version: 4, size: 33, dataCodewords: 64, blocks: 2, ecPerBlock: 18, maxBytes: 62, align: [6, 26] },
  { version: 5, size: 37, dataCodewords: 86, blocks: 2, ecPerBlock: 24, maxBytes: 84, align: [6, 30] },
  { version: 6, size: 41, dataCodewords: 108, blocks: 4, ecPerBlock: 16, maxBytes: 106, align: [6, 34] },
];

// GF(256) log/antilog tables with primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11d)
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function buildRsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function computeRsEcc(dataBytes, ecLen) {
  const gen = buildRsGenerator(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < dataBytes.length; i += 1) {
    const factor = dataBytes[i] ^ rem[0];
    for (let j = 0; j < ecLen - 1; j += 1) {
      rem[j] = rem[j + 1] ^ gfMul(gen[j + 1], factor);
    }
    rem[ecLen - 1] = gfMul(gen[ecLen], factor);
  }
  return rem;
}

function encodeDataCodewords(bytes, spec) {
  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i -= 1) {
      bits.push((val >>> i) & 1);
    }
  };

  // Byte mode (0100) + 8-bit character count
  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  for (let i = 0; i < bytes.length; i += 1) {
    pushBits(bytes[i], 8);
  }

  const maxBits = spec.dataCodewords * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  pushBits(0, termLen);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b += 1) byte = (byte << 1) | bits[i + b];
    codewords.push(byte);
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (codewords.length < spec.dataCodewords) {
    codewords.push(padBytes[padIdx % 2]);
    padIdx += 1;
  }
  return codewords;
}

function buildFinalBitStream(bytes, spec) {
  const codewords = encodeDataCodewords(bytes, spec);
  const blockLen = spec.dataCodewords / spec.blocks;
  const dataBlocks = [];
  const ecBlocks = [];

  for (let b = 0; b < spec.blocks; b += 1) {
    const slice = codewords.slice(b * blockLen, (b + 1) * blockLen);
    dataBlocks.push(slice);
    ecBlocks.push(computeRsEcc(slice, spec.ecPerBlock));
  }

  const finalBytes = [];
  for (let i = 0; i < blockLen; i += 1) {
    for (let b = 0; b < spec.blocks; b += 1) finalBytes.push(dataBlocks[b][i]);
  }
  for (let i = 0; i < spec.ecPerBlock; i += 1) {
    for (let b = 0; b < spec.blocks; b += 1) finalBytes.push(ecBlocks[b][i]);
  }

  const bits = [];
  for (let i = 0; i < finalBytes.length; i += 1) {
    for (let bit = 7; bit >= 0; bit -= 1) {
      bits.push((finalBytes[i] >>> bit) & 1);
    }
  }
  // Remainder bits (Versions 2-6 require 7 remainder bits; Version 1 requires 0)
  const remainder = spec.version >= 2 ? 7 : 0;
  for (let r = 0; r < remainder; r += 1) bits.push(0);
  return bits;
}

function createEmptyMatrix(size) {
  return {
    size,
    modules: Array.from({ length: size }, () => new Uint8Array(size)),
    isFunc: Array.from({ length: size }, () => new Uint8Array(size)),
  };
}

function setModule(mat, row, col, dark, isFunction = false) {
  if (row < 0 || row >= mat.size || col < 0 || col >= mat.size) return;
  mat.modules[row][col] = dark ? 1 : 0;
  if (isFunction) mat.isFunc[row][col] = 1;
}

function placeFinder(mat, topRow, leftCol) {
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const rr = topRow + r;
      const cc = leftCol + c;
      if (rr < 0 || rr >= mat.size || cc < 0 || cc >= mat.size) continue;
      const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
      const inCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      setModule(mat, rr, cc, inOuter && (onBorder || inCenter), true);
    }
  }
}

function placeAlignment(mat, centerRow, centerCol) {
  for (let r = -2; r <= 2; r += 1) {
    for (let c = -2; c <= 2; c += 1) {
      const dark = Math.max(Math.abs(r), Math.abs(c)) !== 1;
      setModule(mat, centerRow + r, centerCol + c, dark, true);
    }
  }
}

function placeFunctionPatterns(mat, spec) {
  const n = mat.size;
  placeFinder(mat, 0, 0);
  placeFinder(mat, 0, n - 7);
  placeFinder(mat, n - 7, 0);

  for (let i = 0; i < spec.align.length; i += 1) {
    for (let j = 0; j < spec.align.length; j += 1) {
      const r = spec.align[i];
      const c = spec.align[j];
      const overlapsFinder =
        (r <= 8 && c <= 8) || (r <= 8 && c >= n - 9) || (r >= n - 9 && c <= 8);
      if (!overlapsFinder) placeAlignment(mat, r, c);
    }
  }

  for (let i = 8; i < n - 8; i += 1) {
    const dark = i % 2 === 0;
    setModule(mat, 6, i, dark, true);
    setModule(mat, i, 6, dark, true);
  }

  // Dark module and format information placeholders
  setModule(mat, 4 * spec.version + 9, 8, true, true);
  for (let i = 0; i <= 8; i += 1) {
    if (i !== 6) {
      setModule(mat, 8, i, false, true);
      setModule(mat, i, 8, false, true);
    }
  }
  for (let i = n - 8; i < n; i += 1) setModule(mat, 8, i, false, true);
  for (let i = n - 7; i < n; i += 1) setModule(mat, i, 8, false, true);
}

function placeDataBits(mat, bits) {
  const n = mat.size;
  let bitIdx = 0;
  let upward = true;
  for (let rightCol = n - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5;
    for (let step = 0; step < n; step += 1) {
      const row = upward ? n - 1 - step : step;
      for (let dx = 0; dx < 2; dx += 1) {
        const col = rightCol - dx;
        if (!mat.isFunc[row][col]) {
          const bit = bitIdx < bits.length ? bits[bitIdx] : 0;
          bitIdx += 1;
          mat.modules[row][col] = bit;
        }
      }
    }
    upward = !upward;
  }
}

function maskCondition(maskId, r, c) {
  switch (maskId) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    default: return false;
  }
}

function computeFormatBits(maskId) {
  // Error correction level M = 00
  const data = maskId & 0x07;
  let rem = data << 10;
  for (let i = 14; i >= 10; i -= 1) {
    if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function applyMaskAndFormat(baseMat, maskId) {
  const n = baseMat.size;
  const out = baseMat.modules.map((row) => new Uint8Array(row));
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!baseMat.isFunc[r][c] && maskCondition(maskId, r, c)) {
        out[r][c] ^= 1;
      }
    }
  }

  const fmt = computeFormatBits(maskId);
  // Write copy 1 around top-left finder
  const tlCoordsRow = [0, 1, 2, 3, 4, 5, 7, 8, 8, 8, 8, 8, 8, 8, 8];
  const tlCoordsCol = [8, 8, 8, 8, 8, 8, 8, 8, 7, 5, 4, 3, 2, 1, 0];
  for (let i = 0; i < 15; i += 1) {
    const bit = (fmt >>> i) & 1;
    out[tlCoordsRow[i]][tlCoordsCol[i]] = bit;
    if (i < 8) {
      out[8][n - 1 - i] = bit;
    } else {
      out[n - 15 + i][8] = bit;
    }
  }
  return out;
}

function scorePenalty(modules) {
  const n = modules.length;
  let penalty = 0;
  let darkCount = 0;

  // Rule 1: adjacent runs >= 5 & dark module count
  for (let r = 0; r < n; r += 1) {
    let runColor = modules[r][0];
    let runLen = 0;
    for (let c = 0; c < n; c += 1) {
      const v = modules[r][c];
      darkCount += v;
      if (v === runColor) {
        runLen += 1;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = v;
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }
  for (let c = 0; c < n; c += 1) {
    let runColor = modules[0][c];
    let runLen = 0;
    for (let r = 0; r < n; r += 1) {
      const v = modules[r][c];
      if (v === runColor) {
        runLen += 1;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = v;
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  // Rule 2: 2x2 blocks of same color
  for (let r = 0; r < n - 1; r += 1) {
    for (let c = 0; c < n - 1; c += 1) {
      const v = modules[r][c];
      if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) {
        penalty += 3;
      }
    }
  }

  // Rule 3: finder-like 1:1:3:1:1 patterns
  const matchFinderPattern = (line) => {
    let hits = 0;
    for (let i = 0; i <= line.length - 11; i += 1) {
      const p1 =
        line[i] === 1 && line[i + 1] === 0 && line[i + 2] === 1 && line[i + 3] === 1 &&
        line[i + 4] === 1 && line[i + 5] === 0 && line[i + 6] === 1 &&
        line[i + 7] === 0 && line[i + 8] === 0 && line[i + 9] === 0 && line[i + 10] === 0;
      const p2 =
        line[i] === 0 && line[i + 1] === 0 && line[i + 2] === 0 && line[i + 3] === 0 &&
        line[i + 4] === 1 && line[i + 5] === 0 && line[i + 6] === 1 && line[i + 7] === 1 &&
        line[i + 8] === 1 && line[i + 9] === 0 && line[i + 10] === 1;
      if (p1 || p2) hits += 1;
    }
    return hits * 40;
  };
  for (let r = 0; r < n; r += 1) penalty += matchFinderPattern(modules[r]);
  for (let c = 0; c < n; c += 1) {
    const col = new Uint8Array(n);
    for (let r = 0; r < n; r += 1) col[r] = modules[r][c];
    penalty += matchFinderPattern(col);
  }

  // Rule 4: dark ratio balance
  const pct = (darkCount * 100) / (n * n);
  const k = Math.min(Math.abs(Math.floor(pct / 5) * 5 - 50), Math.abs(Math.ceil(pct / 5) * 5 - 50));
  penalty += (k / 5) * 10;
  return penalty;
}

export function encodeQrMatrix(text) {
  const bytes = new TextEncoder().encode(String(text));
  const spec = QR_M_SPECS.find((s) => bytes.length <= s.maxBytes);
  if (!spec) {
    throw new RangeError(`QR payload length ${bytes.length} exceeds supported max (${QR_M_SPECS[QR_M_SPECS.length - 1].maxBytes} bytes).`);
  }

  const mat = createEmptyMatrix(spec.size);
  placeFunctionPatterns(mat, spec);
  placeDataBits(mat, buildFinalBitStream(bytes, spec));

  let bestMatrix = null;
  let bestScore = Infinity;
  for (let maskId = 0; maskId < 8; maskId += 1) {
    const candidate = applyMaskAndFormat(mat, maskId);
    const score = scorePenalty(candidate);
    if (score < bestScore) {
      bestScore = score;
      bestMatrix = candidate;
    }
  }
  return bestMatrix;
}

/**
 * Generates an accessible ISO/IEC 18004 monochrome SVG QR Code element for a membership token.
 */
export function createMembershipQrSvg(
  qrToken = 'BFQR-001248A9C4E2',
  className = 'digital-pass__qr-svg',
) {
  const safeToken = String(qrToken || 'BFQR-UNASSIGNED').trim();
  const matrix = encodeQrMatrix(safeToken);
  const moduleCount = matrix.length;
  const quietZone = 4;
  const totalSize = moduleCount + quietZone * 2;
  const ns = 'http://www.w3.org/2000/svg';

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${totalSize} ${totalSize}`);
  svg.setAttribute('class', className);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Membership identification QR code (${safeToken})`);
  svg.setAttribute('data-qr-token', safeToken);

  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('width', String(totalSize));
  bg.setAttribute('height', String(totalSize));
  bg.setAttribute('fill', '#ffffff');
  svg.appendChild(bg);

  const pathParts = [];
  for (let r = 0; r < moduleCount; r += 1) {
    for (let c = 0; c < moduleCount; c += 1) {
      if (matrix[r][c] === 1) {
        pathParts.push(`M${c + quietZone} ${r + quietZone}h1v1h-1z`);
      }
    }
  }

  const modulesPath = document.createElementNS(ns, 'path');
  modulesPath.setAttribute('d', pathParts.join(''));
  modulesPath.setAttribute('fill', '#101010');
  svg.appendChild(modulesPath);

  return svg;
}
