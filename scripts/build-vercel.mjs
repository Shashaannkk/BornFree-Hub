/**
 * BONFREE-HUB Vercel Static Production Build Script
 *
 * Packages static HTML/CSS/JS/assets into `dist/` and injects safe public
 * configuration meta tags (`bonfree-supabase-url`, `bonfree-supabase-anon-key`,
 * `bonfree-env`) from Vercel Environment Variables at deploy time.
 *
 * Security Rules:
 * - NEVER reads or emits `SUPABASE_SERVICE_ROLE_KEY`.
 * - Rejects build if `PUBLIC_APP_ENV=production` lacks Supabase public config
 *   or if a service_role key appears in public env variables.
 * - Excludes developer showcase `design-system.html` from `dist/` in production.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const PUBLIC_SUPABASE_URL = String(process.env.PUBLIC_SUPABASE_URL || '').trim();
const PUBLIC_SUPABASE_ANON_KEY = String(process.env.PUBLIC_SUPABASE_ANON_KEY || '').trim();
const PUBLIC_APP_ENV = String(process.env.PUBLIC_APP_ENV || (process.env.VERCEL_ENV === 'production' ? 'production' : 'development')).trim();

function decodeJwtRole(token = '') {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return '';
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return String(payload.role || '');
  } catch {
    return '';
  }
}

if (PUBLIC_SUPABASE_ANON_KEY && decodeJwtRole(PUBLIC_SUPABASE_ANON_KEY) === 'service_role') {
  console.error('BUILD ABORTED: PUBLIC_SUPABASE_ANON_KEY contains a service_role JWT. Refusing to bundle secret key into frontend.');
  process.exit(1);
}

if (PUBLIC_APP_ENV === 'production' && (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY)) {
  console.error('BUILD ABORTED: PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are required when PUBLIC_APP_ENV=production.');
  process.exit(1);
}

if (PUBLIC_SUPABASE_URL && !PUBLIC_SUPABASE_URL.startsWith('https://')) {
  console.error('BUILD ABORTED: PUBLIC_SUPABASE_URL must use HTTPS in deployed builds.');
  process.exit(1);
}

function escapeAttr(val) {
  return String(val || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function injectMetaTags(html) {
  let out = html.replace(/<meta\s+name="bonfree-(env|supabase-url|supabase-anon-key)"[^>]*>\s*/gi, '');
  const metaBlock = [
    `    <meta name="bonfree-env" content="${escapeAttr(PUBLIC_APP_ENV)}" />`,
    PUBLIC_SUPABASE_URL
      ? `    <meta name="bonfree-supabase-url" content="${escapeAttr(PUBLIC_SUPABASE_URL)}" />`
      : null,
    PUBLIC_SUPABASE_ANON_KEY
      ? `    <meta name="bonfree-supabase-anon-key" content="${escapeAttr(PUBLIC_SUPABASE_ANON_KEY)}" />`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  return out.replace(/<\/head>/i, `${metaBlock}\n  </head>`);
}

function copyTree(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyTree(srcPath, destPath);
    } else if (entry.name.endsWith('.html')) {
      const html = fs.readFileSync(srcPath, 'utf8');
      fs.writeFileSync(destPath, injectMetaTags(html), 'utf8');
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export function runBuild() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  for (const dir of ['assets', 'src', 'admin']) {
    copyTree(path.join(ROOT, dir), path.join(DIST, dir));
  }

  let htmlCount = 0;
  for (const entry of fs.readdirSync(ROOT)) {
    if (!entry.endsWith('.html')) continue;
    if (PUBLIC_APP_ENV === 'production' && entry === 'design-system.html') continue;
    const html = fs.readFileSync(path.join(ROOT, entry), 'utf8');
    fs.writeFileSync(path.join(DIST, entry), injectMetaTags(html), 'utf8');
    htmlCount += 1;
  }

  return {
    outputDir: DIST,
    environment: PUBLIC_APP_ENV,
    supabaseConfigured: Boolean(PUBLIC_SUPABASE_URL && PUBLIC_SUPABASE_ANON_KEY),
    rootHtmlCount: htmlCount,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const result = runBuild();
  console.log('BONFREE-HUB production build ready:', JSON.stringify(result));
}
