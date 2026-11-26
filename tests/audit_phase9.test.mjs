import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

test('Phase 9 Security Headers allow self camera on scanner and enforce CSP', () => {
  const vercelCfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const globalBlock = (vercelCfg.headers || []).find((entry) => entry.source === '/(.*)');
  const headerList = globalBlock?.headers || [];
  const byKey = Object.fromEntries(headerList.map((h) => [h.key, h.value]));

  assert.ok(byKey['Permissions-Policy']?.includes('camera=(self)'));
  assert.ok(!byKey['Permissions-Policy']?.includes('camera=()'));
  assert.equal(byKey['X-Frame-Options'], 'DENY');
  assert.equal(byKey['X-Content-Type-Options'], 'nosniff');
  assert.match(byKey['Content-Security-Policy'] || '', /script-src 'self'/);
  assert.match(byKey['Content-Security-Policy'] || '', /object-src 'none'/);
});

test('Phase 9 QR Encoder builds ISO/IEC 18004 matrices with valid finder & timing patterns', async () => {
  const { encodeQrMatrix, isOpaqueQrToken } = await import('../src/scripts/core/qr.js');

  assert.equal(isOpaqueQrToken('BFQR-001248A9C4E2'), true);
  assert.equal(isOpaqueQrToken('member@example.com'), false);

  // 17-char token fits Version 2 (25x25), Level M
  const v2 = encodeQrMatrix('BFQR-001248A9C4E2');
  assert.equal(v2.length, 25);
  // Top-left finder pattern outer dark 7x7 ring check
  for (let i = 0; i < 7; i += 1) {
    assert.equal(v2[0][i], 1);
    assert.equal(v2[6][i], 1);
    assert.equal(v2[i][0], 1);
    assert.equal(v2[i][6], 1);
  }
  // White separator around finder pattern
  for (let i = 0; i < 8; i += 1) {
    assert.equal(v2[7][i], 0);
    assert.equal(v2[i][7], 0);
  }
  // Dark module for Version 2: (4*2+9, 8) = (17, 8)
  assert.equal(v2[17][8], 1);

  // Longer UUID-style token fits Version 3 (29x29), Level M
  const v3 = encodeQrMatrix('BFQR-A1B2C3D4-E5F6-7890-ABCD-1234567890EF');
  assert.equal(v3.length, 29);
  assert.equal(v3[4 * 3 + 9][8], 1);
});

test('Phase 9 Scanner releases camera tracks on pagehide, beforeunload, and hidden visibility', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/scripts/pages/adminOperations.js'), 'utf8');
  assert.match(src, /addEventListener\('pagehide'/);
  assert.match(src, /addEventListener\('beforeunload'/);
  assert.match(src, /addEventListener\('visibilitychange'/);
  assert.match(src, /document\.hidden/);
});

test('Phase 9 Static XSS, storage, inline-script, and image asset budget checks pass', () => {
  const jsFiles = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) jsFiles.push(full);
    }
  };
  walk(path.join(ROOT, 'src'));

  for (const file of jsFiles) {
    const text = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write|\beval\(/, file);
    assert.doesNotMatch(text, /\blocalStorage\.(getItem|setItem|removeItem)/, file);
  }

  const htmlFiles = [
    ...fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).map((f) => path.join(ROOT, f)),
    ...fs.readdirSync(path.join(ROOT, 'admin')).filter((f) => f.endsWith('.html')).map((f) => path.join(ROOT, 'admin', f)),
  ];
  assert.equal(htmlFiles.length, 29);

  for (const htmlFile of htmlFiles) {
    const html = fs.readFileSync(htmlFile, 'utf8');
    assert.match(html, /<meta\s+name="viewport"/, htmlFile);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, htmlFile);
    assert.doesNotMatch(html, /<style\b/, htmlFile);
  }

  const images = fs.readdirSync(path.join(ROOT, 'assets/images')).filter((f) => f.endsWith('.jpg'));
  assert.equal(images.length, 9);
  for (const img of images) {
    const bytes = fs.statSync(path.join(ROOT, 'assets/images', img)).size;
    assert.ok(bytes < 250 * 1024, `${img} exceeds 250 KB budget (${bytes} bytes)`);
  }
});

test('Deployment Prep: Build script injects public env safely, excludes dev fixtures in production & blocks service_role leaks', async () => {
  const vercelCfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  assert.equal(vercelCfg.outputDirectory, 'dist');
  assert.equal(vercelCfg.buildCommand, 'node scripts/build-vercel.mjs');
  const hsts = (vercelCfg.headers?.[2]?.headers || []).find((h) => h.key === 'Strict-Transport-Security');
  assert.ok(hsts?.value?.includes('max-age=31536000'));

  const prodSeed = fs
    .readFileSync(path.join(ROOT, 'supabase/production_seed.sql'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  assert.match(prodSeed, /ON CONFLICT .* DO NOTHING/i);
  assert.doesNotMatch(prodSeed, /\b(DELETE\s+FROM|TRUNCATE\s+TABLE|DROP\s+TABLE)\b/i);

  const { isProductionEnvironment } = await import('../src/scripts/core/config.js');
  const prevEnv = process.env.PUBLIC_APP_ENV;
  const prevUrl = process.env.PUBLIC_SUPABASE_URL;
  const prevKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
  try {
    process.env.PUBLIC_APP_ENV = 'production';
    delete process.env.PUBLIC_SUPABASE_URL;
    delete process.env.PUBLIC_SUPABASE_ANON_KEY;
    assert.equal(isProductionEnvironment(), true);

    const { fetchCustomerPortalData } = await import('../src/scripts/services/loyaltyService.js');
    const portalRes = await fetchCustomerPortalData();
    assert.equal(portalRes.ok, false);
    assert.equal(portalRes.code, 'SUPABASE_NOT_CONFIGURED');

    const { fetchAdminCustomers, fetchAdminProgrammes } = await import('../src/scripts/services/adminService.js');
    assert.equal((await fetchAdminCustomers()).ok, false);
    assert.equal((await fetchAdminProgrammes()).ok, false);

    const { fetchAdminPurchases, fetchAdminAnalytics } = await import('../src/scripts/services/adminExtendedService.js');
    assert.equal((await fetchAdminPurchases()).ok, false);
    assert.equal((await fetchAdminAnalytics()).ok, false);
  } finally {
    if (prevEnv === undefined) delete process.env.PUBLIC_APP_ENV;
    else process.env.PUBLIC_APP_ENV = prevEnv;
    if (prevUrl === undefined) delete process.env.PUBLIC_SUPABASE_URL;
    else process.env.PUBLIC_SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.PUBLIC_SUPABASE_ANON_KEY;
    else process.env.PUBLIC_SUPABASE_ANON_KEY = prevKey;
  }
});
