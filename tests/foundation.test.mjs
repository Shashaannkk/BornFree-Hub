import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function listFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

test('Phase 1, 1A & 1B required files and image assets exist', () => {
  const expectedFiles = [
    'index.html',
    'about.html',
    'loyalty.html',
    'contact.html',
    'login.html',
    'register.html',
    'forgot-password.html',
    'reset-password.html',
    'customer-dashboard.html',
    'survey.html',
    'admin/login.html',
    'admin/dashboard.html',
    'admin/customers.html',
    'admin/loyalty.html',
    'admin/scanner.html',
    'admin/stamps.html',
    'admin/rewards.html',
    'admin/redemptions.html',
    'admin/purchases.html',
    'admin/staff.html',
    'admin/campaigns.html',
    'admin/surveys.html',
    'admin/analytics.html',
    'admin/reports.html',
    'admin/settings.html',
    'design-system.html',
    'vercel.json',
    '.env.example',
    '.gitignore',
    'docs/ARCHITECTURE.md',
    'docs/IMPLEMENTATION_PLAN.md',
    'assets/images/hero-streetwear.jpg',
    'assets/images/store-interior.jpg',
    'assets/images/streetwear-editorial.jpg',
    'assets/images/auth-contact.jpg',
    'assets/images/auth-login.jpg',
    'assets/images/auth-register.jpg',
    'assets/images/auth-reset.jpg',
    'assets/images/member-banner.jpg',
    'assets/images/admin-login.jpg',
    'assets/vendor/html5-qrcode.min.js',
    'src/styles/tokens.css',
    'src/styles/reset.css',
    'src/styles/layout.css',
    'src/styles/components.css',
    'src/styles/public.css',
    'src/styles/auth.css',
    'src/styles/dashboard.css',
    'src/styles/admin.css',
    'src/scripts/core/config.js',
    'src/scripts/core/dom.js',
    'src/scripts/core/icons.js',
    'src/scripts/core/qr.js',
    'src/scripts/core/state.js',
    'src/scripts/components/navbar.js',
    'src/scripts/components/adminShell.js',
    'src/scripts/components/charts.js',
    'src/scripts/components/footer.js',
    'src/scripts/components/modal.js',
    'src/scripts/components/toast.js',
    'src/scripts/components/table.js',
    'src/scripts/components/form.js',
    'src/scripts/components/loader.js',
    'src/scripts/services/authService.js',
    'src/scripts/services/contactService.js',
    'src/scripts/services/loyaltyService.js',
    'src/scripts/services/adminService.js',
    'src/scripts/services/adminExtendedService.js',
    'src/scripts/pages/public.js',
    'src/scripts/pages/auth.js',
    'src/scripts/pages/customerDashboard.js',
    'src/scripts/pages/adminPages.js',
    'src/scripts/pages/adminOperations.js',
    'src/scripts/pages/adminManagement.js',
    'src/scripts/pages/adminInsights.js',
    'src/scripts/main.js',
    'src/scripts/adminMain.js',
  ];

  for (const file of expectedFiles) {
    assert.equal(fs.existsSync(path.join(ROOT, file)), true, `Missing required file: ${file}`);
  }
});

test('Design system tokens enforce approved palette and fonts', () => {
  const tokens = read('src/styles/tokens.css');
  assert.match(tokens, /--color-black:\s*#101010/i);
  assert.match(tokens, /--color-white:\s*#ffffff/i);
  assert.match(tokens, /--color-ivory:\s*#f5f4f0/i);
  assert.match(tokens, /--color-grey-light:\s*#d9d9d9/i);
  assert.match(tokens, /Playfair Display/);
  assert.match(tokens, /Inter/);
});

test('All HTML pages comply with CSP (no inline scripts or style tags) and avoid checkout UI', () => {
  const htmlPages = [
    'index.html',
    'about.html',
    'loyalty.html',
    'contact.html',
    'login.html',
    'register.html',
    'forgot-password.html',
    'reset-password.html',
    'customer-dashboard.html',
    'survey.html',
    'admin/login.html',
    'admin/dashboard.html',
    'admin/customers.html',
    'admin/loyalty.html',
    'admin/scanner.html',
    'admin/stamps.html',
    'admin/rewards.html',
    'admin/redemptions.html',
    'admin/purchases.html',
    'admin/staff.html',
    'admin/campaigns.html',
    'admin/surveys.html',
    'admin/analytics.html',
    'admin/reports.html',
    'admin/settings.html',
    'design-system.html',
  ];
  for (const htmlFile of htmlPages) {
    const content = read(htmlFile);
    assert.equal(/<style[\s>]/i.test(content), false, `${htmlFile} must not contain <style> tags`);
    assert.equal(
      /<script(?![^>]*\bsrc=)[^>]*>/i.test(content),
      false,
      `${htmlFile} must not contain inline <script> blocks`,
    );
    assert.equal(
      /\bAdd to Cart\b|\bProceed to Checkout\b/i.test(content),
      false,
      `${htmlFile} must not contain e-commerce checkout CTAs`,
    );
  }
});

test('Public pages include required Phase 1A sections and local images', () => {
  const home = read('index.html');
  assert.match(home, /SHOP MORE\./);
  assert.match(home, /EARN MORE\./);
  assert.match(home, /Explore Rewards/);
  assert.match(home, /Join Now/);
  assert.match(home, /assets\/images\/hero-streetwear\.jpg/);
  assert.match(home, /Birthday Offers/);

  const about = read('about.html');
  assert.match(about, /OUR STORY/);
  assert.match(about, /assets\/images\/store-interior\.jpg/);

  const loyalty = read('loyalty.html');
  assert.match(loyalty, /HOW IT WORKS/);
  assert.match(loyalty, /data-interactive-stamps/);
  assert.match(loyalty, /Frequently Asked Questions/);
  assert.match(loyalty, /data-faq-trigger/);
});

test('Frontend source uses no localStorage DB persistence or hardcoded secrets', () => {
  const srcFiles = listFiles(path.join(ROOT, 'src'));
  for (const file of srcFiles) {
    const raw = fs.readFileSync(file, 'utf8');
    const codeOnly = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    assert.equal(/\blocalStorage\b/.test(codeOnly), false, `${file} must not use localStorage`);
    assert.equal(
      /service_role|SUPABASE_SERVICE_ROLE_KEY/i.test(codeOnly),
      false,
      `${file} must never reference service role keys`,
    );
  }
});

test('Core JS utilities and public navigation items export expected symbols', async () => {
  const { escapeHtml } = await import('../src/scripts/core/dom.js');
  const { createStore } = await import('../src/scripts/core/state.js');
  const { getPublicConfig, isSupabaseConfigured } = await import('../src/scripts/core/config.js');
  const { ICON_DEFINITIONS } = await import('../src/scripts/core/icons.js');
  const { PUBLIC_NAV_ITEMS } = await import('../src/scripts/components/navbar.js');

  assert.equal(escapeHtml('<script>"alert"</script>'), '&lt;script&gt;&quot;alert&quot;&lt;/script&gt;');

  const store = createStore({ count: 0 });
  let seen = 0;
  const unsubscribe = store.subscribe((s) => {
    seen = s.count;
  });
  store.setState({ count: 3 });
  assert.equal(seen, 3);
  unsubscribe();
  store.setState({ count: 5 });
  assert.equal(seen, 3);

  const cfg = getPublicConfig();
  assert.equal(cfg.appName, 'BONFREE-HUB');
  assert.equal(isSupabaseConfigured(), false);
  assert.ok(Object.keys(ICON_DEFINITIONS).length >= 30);

  const navLabels = PUBLIC_NAV_ITEMS.map((i) => i.label);
  assert.deepEqual(navLabels, ['Home', 'About Us', 'Loyalty Club', 'How It Works', 'Contact']);
});

test('Phase 1B Contact & Auth HTML pages contain required form fields and navigation links', () => {
  const contact = read('contact.html');
  assert.match(contact, /id="contact-form"/);
  assert.match(contact, /Visit Our Store/);
  assert.match(contact, /assets\/images\/auth-contact\.jpg/);

  const login = read('login.html');
  assert.match(login, /id="login-form"/);
  assert.match(login, /forgot-password\.html/);
  assert.match(login, /register\.html/);
  assert.match(login, /data-password-toggle="login-password"/);

  const register = read('register.html');
  assert.match(register, /id="register-form"/);
  assert.match(register, /id="reg-mobile"/);
  assert.match(register, /id="reg-terms"/);
  assert.match(register, /login\.html/);

  const forgot = read('forgot-password.html');
  assert.match(forgot, /id="forgot-password-form"/);
  assert.match(forgot, /login\.html/);

  const reset = read('reset-password.html');
  assert.match(reset, /id="reset-password-form"/);
  assert.match(reset, /id="reset-new-password"/);
  assert.match(reset, /id="reset-confirm-password"/);
});

test('Auth & Contact integration services do not simulate success before Supabase is connected', async () => {
  const {
    signInCustomer,
    registerCustomer,
    requestPasswordReset,
    updateCustomerPassword,
  } = await import('../src/scripts/services/authService.js');
  const { submitContactInquiry } = await import('../src/scripts/services/contactService.js');
  const { isPasswordStrong } = await import('../src/scripts/pages/auth.js');

  assert.equal(isPasswordStrong('weak'), false);
  assert.equal(isPasswordStrong('StrongPass1'), true);

  const loginRes = await signInCustomer({ email: 'member@bonfree-hub.com', password: 'Password1' });
  assert.equal(loginRes.ok, false);
  assert.equal(loginRes.code, 'SUPABASE_NOT_CONFIGURED');

  const regRes = await registerCustomer({
    fullName: 'Aanya Sharma',
    mobile: '+91 98765 43210',
    email: 'aanya@bonfree-hub.com',
    password: 'Password1',
    acceptedTerms: true,
  });
  assert.equal(regRes.ok, false);
  assert.equal(regRes.code, 'SUPABASE_NOT_CONFIGURED');

  const forgotRes = await requestPasswordReset({ email: 'aanya@bonfree-hub.com' });
  assert.equal(forgotRes.ok, false);
  assert.equal(forgotRes.code, 'SUPABASE_NOT_CONFIGURED');

  const resetRes = await updateCustomerPassword({ newPassword: 'NewPassword1' });
  assert.equal(resetRes.ok, false);
  assert.equal(resetRes.code, 'SUPABASE_NOT_CONFIGURED');

  const contactRes = await submitContactInquiry({
    fullName: 'Aanya Sharma',
    email: 'aanya@bonfree-hub.com',
    subject: 'Loyalty Stamps & Rewards',
    message: 'Checking my recent stamp credit.',
  });
  assert.equal(contactRes.ok, false);
  assert.equal(contactRes.code, 'SUPABASE_NOT_CONFIGURED');
});

test('Phase 1C Customer Dashboard & LoyaltyService enforce read-only fixture boundaries', async () => {
  const dash = read('customer-dashboard.html');
  assert.match(dash, /Welcome back/);
  assert.match(dash, /BF-001248/);
  assert.match(dash, /id="copy-member-id-btn"/);
  assert.match(dash, /data-preview-state="loading"/);
  assert.match(dash, /data-preview-state="empty"/);
  assert.match(dash, /data-preview-state="error"/);
  assert.match(dash, /mobile-bottom-nav/);

  const {
    DEV_MEMBER_FIXTURE,
    fetchCustomerPortalData,
    requestRewardRedemption,
    updateMemberPreferences,
  } = await import('../src/scripts/services/loyaltyService.js');

  assert.equal(DEV_MEMBER_FIXTURE.isDevelopmentFixture, true);
  assert.equal(Object.isFrozen(DEV_MEMBER_FIXTURE), true);
  assert.equal(Object.isFrozen(DEV_MEMBER_FIXTURE.member), true);

  const portalRes = await fetchCustomerPortalData();
  assert.equal(portalRes.ok, true);
  assert.equal(portalRes.source, 'development-fixture');
  assert.equal(portalRes.data.member.collectedStamps, 7);

  const redeemRes = await requestRewardRedemption({ rewardId: 'rw-avail-1' });
  assert.equal(redeemRes.ok, false);
  assert.equal(redeemRes.code, 'SUPABASE_NOT_CONFIGURED');

  const prefRes = await updateMemberPreferences({ earlyAccessDrops: true });
  assert.equal(prefRes.ok, false);
  assert.equal(prefRes.code, 'SUPABASE_NOT_CONFIGURED');
});

test('Phase 2A Admin Console sidebar, pages, and security boundaries are verified', async () => {
  const { ADMIN_NAV_GROUPS } = await import('../src/scripts/components/adminShell.js');
  const { ADMIN_DEV_FIXTURE, signInStaff, saveLoyaltyProgramme } = await import(
    '../src/scripts/services/adminService.js'
  );

  const navLabels = ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.label));
  assert.deepEqual(navLabels, [
    'Overview',
    'Customers',
    'Loyalty Programmes',
    'QR Scanner',
    'Stamp Transactions',
    'Rewards',
    'Redemptions',
    'Purchase Records',
    'Staff Management',
    'Campaigns',
    'Surveys',
    'Analytics',
    'Reports',
    'Settings',
  ]);

  assert.equal(ADMIN_DEV_FIXTURE.isDevelopmentFixture, true);
  assert.equal(Object.isFrozen(ADMIN_DEV_FIXTURE), true);

  const staffAuth = await signInStaff({ email: 'admin@bonfree-hub.in', password: 'TestPassword1' });
  assert.equal(staffAuth.ok, false);
  assert.equal(staffAuth.code, 'SUPABASE_NOT_CONFIGURED');

  const progSave = await saveLoyaltyProgramme({ name: 'Classic Stamps' });
  assert.equal(progSave.ok, false);
  assert.equal(progSave.code, 'SUPABASE_NOT_CONFIGURED');

  for (const adminPage of [
    'admin/dashboard.html',
    'admin/customers.html',
    'admin/loyalty.html',
    'admin/scanner.html',
    'admin/stamps.html',
    'admin/rewards.html',
    'admin/redemptions.html',
    'admin/purchases.html',
    'admin/staff.html',
    'admin/campaigns.html',
    'admin/surveys.html',
    'admin/analytics.html',
    'admin/reports.html',
    'admin/settings.html',
  ]) {
    const html = read(adminPage);
    assert.match(html, /id="admin-sidebar-host"/);
    assert.match(html, /id="admin-topbar-host"/);
    assert.match(html, /\.\.\/src\/scripts\/adminMain\.js/);
  }
});

test('Phase 2C & 2D Business Management, Analytics, Reports, Settings & CSV safety', async () => {
  const { ADMIN_NAV_GROUPS } = await import('../src/scripts/components/adminShell.js');
  const allReady = ADMIN_NAV_GROUPS.flatMap((g) => g.items).every((i) => i.ready && i.href);
  assert.equal(allReady, true, 'All 14 admin sidebar items should link to live pages');

  const {
    ADMIN_EXTENDED_FIXTURE,
    buildSafeCsv,
    saveStaffMember,
    saveCampaign,
    saveSurvey,
    saveBrandSettings,
    updateAdminAccountPassword,
  } = await import('../src/scripts/services/adminExtendedService.js');
  const { submitSurveyResponse } = await import('../src/scripts/services/loyaltyService.js');

  assert.equal(ADMIN_EXTENDED_FIXTURE.isDevelopmentFixture, true);
  assert.equal(Object.isFrozen(ADMIN_EXTENDED_FIXTURE), true);

  const csv = buildSafeCsv(['Name', 'Formula'], [['Aanya', '=cmd|calc']]);
  assert.match(csv, /"'=cmd\|calc"/);

  assert.equal((await saveStaffMember({ name: 'Neha', email: 'neha@bonfree-hub.in', role: 'Store Manager' })).code, 'SUPABASE_NOT_CONFIGURED');
  assert.equal((await saveCampaign({ title: 'Denim Days', startDate: '2025-02-01', endDate: '2025-02-28' })).code, 'SUPABASE_NOT_CONFIGURED');
  assert.equal((await saveSurvey({ title: 'Survey', questions: [{ id: '1' }] })).code, 'SUPABASE_NOT_CONFIGURED');
  assert.equal((await saveBrandSettings({ brandName: 'BONFREE-HUB', supportEmail: 'care@bonfree-hub.in' })).code, 'SUPABASE_NOT_CONFIGURED');
  assert.equal((await updateAdminAccountPassword({ currentPassword: 'old', newPassword: 'NewPassword1' })).code, 'SUPABASE_NOT_CONFIGURED');
  assert.equal((await submitSurveyResponse({ surveyId: 'srv-1' })).code, 'SUPABASE_NOT_CONFIGURED');

  const surveyPage = read('survey.html');
  assert.match(surveyPage, /id="customer-survey-form"/);
  assert.match(surveyPage, /data-survey-star="5"/);
});

test('Frontend audit: viewport meta, img alt text, and local href/src integrity across all 26 HTML pages', () => {
  const htmlFiles = [
    ...fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')),
    ...fs
      .readdirSync(path.join(ROOT, 'admin'))
      .filter((f) => f.endsWith('.html'))
      .map((f) => `admin/${f}`),
  ];

  assert.equal(htmlFiles.length, 26);

  for (const rel of htmlFiles) {
    const html = read(rel);
    assert.match(html, /<meta[^>]+name="viewport"/i, `${rel} missing viewport meta`);
    assert.match(html, /<title>[^<]+<\/title>/i, `${rel} missing <title>`);
    assert.equal(/<img(?![^>]*\balt=)/i.test(html), false, `${rel} contains <img> without alt`);

    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((m) => m[1])
      .filter(
        (u) =>
          !u.startsWith('http://') &&
          !u.startsWith('https://') &&
          !u.startsWith('#') &&
          !u.startsWith('mailto:') &&
          !u.startsWith('tel:'),
      );

    for (const ref of refs) {
      const clean = ref.split('#')[0].split('?')[0];
      const resolved = path.resolve(path.dirname(path.join(ROOT, rel)), clean);
      assert.equal(fs.existsSync(resolved), true, `Broken local asset/link "${ref}" in ${rel}`);
    }
  }
});

test('Phase 2B Store Operations calculations, duplicate receipt detection & Edge Function guards', async () => {
  const {
    calculateEligibleStamps,
    lookupCustomerForScanner,
    awardStampsForPurchase,
    saveRewardDefinition,
    processRedemption,
  } = await import('../src/scripts/services/adminService.js');

  assert.equal(calculateEligibleStamps({ amountInr: 2499, qualifyingAmountInr: 1000 }), 2);
  assert.equal(calculateEligibleStamps({ amountInr: 900, qualifyingAmountInr: 1000 }), 0);
  assert.equal(
    calculateEligibleStamps({ amountInr: 2500, qualifyingAmountInr: 1000, calculationRule: 'multiplier_2x' }),
    4,
  );

  const memberMatch = lookupCustomerForScanner('BF-001248');
  assert.equal(memberMatch?.customer.name, 'Aanya Sharma');

  const dupRes = await awardStampsForPurchase({
    customerId: 'BF-001248',
    purchaseRef: 'INV-CP-43579',
    amountInr: 2000,
    calculatedStamps: 2,
  });
  assert.equal(dupRes.ok, false);
  assert.equal(dupRes.code, 'DUPLICATE_RECEIPT');

  const newAwardRes = await awardStampsForPurchase({
    customerId: 'BF-001248',
    purchaseRef: 'INV-CP-99999',
    amountInr: 2500,
    calculatedStamps: 2,
  });
  assert.equal(newAwardRes.ok, false);
  assert.equal(newAwardRes.code, 'SUPABASE_NOT_CONFIGURED');

  const rewardSave = await saveRewardDefinition({ title: 'Test Reward' });
  assert.equal(rewardSave.ok, false);
  assert.equal(rewardSave.code, 'SUPABASE_NOT_CONFIGURED');

  const redeemRes = await processRedemption({ redemptionId: 'RDM-901', action: 'confirm' });
  assert.equal(redeemRes.ok, false);
  assert.equal(redeemRes.code, 'SUPABASE_NOT_CONFIGURED');
});
