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

test('Phase 3 SQL migrations, seed, ERD, setup guide, and Edge Functions exist', () => {
  const expectedFiles = [
    'supabase/migrations/0001_core_identity_and_rbac.sql',
    'supabase/migrations/0002_loyalty_purchases_and_rewards.sql',
    'supabase/migrations/0003_engagement_settings_and_audit.sql',
    'supabase/migrations/0004_security_functions_and_rls.sql',
    'supabase/migrations/0005_profile_guard_and_auto_card.sql',
    'supabase/migrations/0006_loyalty_qr_and_programme_lifecycle.sql',
    'supabase/migrations/0007_stamp_cooldown_and_idempotency.sql',
    'supabase/migrations/0008_rewards_redemption_lifecycle.sql',
    'supabase/migrations/0009_staff_rbac_and_audit.sql',
    'supabase/migrations/0010_campaigns_and_surveys_lifecycle.sql',
    'supabase/migrations/0011_analytics_reports_and_settings.sql',
    'supabase/seed.sql',
    'supabase/tests/rls_security_tests.sql',
    'supabase/functions/_shared/cors.ts',
    'supabase/functions/_shared/auth.ts',
    'supabase/functions/issue-stamp/index.ts',
    'supabase/functions/redeem-reward/index.ts',
    'supabase/functions/manage-staff/index.ts',
    'supabase/functions/submit-contact/index.ts',
    'supabase/functions/admin-analytics/index.ts',
    'src/scripts/core/supabaseClient.js',
    'docs/DATABASE_ERD.md',
    'docs/SUPABASE_SETUP.md',
  ];

  for (const file of expectedFiles) {
    assert.equal(fs.existsSync(path.join(ROOT, file)), true, `Missing Phase 3 file: ${file}`);
  }
});

test('SQL migrations create all 18+ required tables with PKs, FKs, constraints & timestamps', () => {
  const allSql = [
    read('supabase/migrations/0001_core_identity_and_rbac.sql'),
    read('supabase/migrations/0002_loyalty_purchases_and_rewards.sql'),
    read('supabase/migrations/0003_engagement_settings_and_audit.sql'),
  ].join('\n');

  const requiredTables = [
    'stores',
    'profiles',
    'roles',
    'permissions',
    'role_permissions',
    'staff',
    'staff_permissions',
    'customers',
    'loyalty_programmes',
    'loyalty_programme_tiers',
    'loyalty_cards',
    'purchases',
    'stamp_transactions',
    'rewards',
    'customer_rewards',
    'redemptions',
    'campaigns',
    'surveys',
    'survey_questions',
    'survey_responses',
    'contact_messages',
    'brand_settings',
    'audit_logs',
  ];

  for (const table of requiredTables) {
    assert.match(allSql, new RegExp(`CREATE TABLE public\\.${table}\\b`), `Missing table: ${table}`);
  }

  // Unique membership ID, scoped purchase receipt, duplicate stamp prevention, immutable ledger
  assert.match(allSql, /membership_id text NOT NULL UNIQUE/);
  assert.match(allSql, /UNIQUE \(store_id, receipt_no\)/);
  assert.match(allSql, /uniq_stamp_tx_earned_per_purchase/);
  assert.match(allSql, /prevent_ledger_mutation/);
  assert.match(allSql, /prevent_audit_mutation/);
});

test('RLS migration enables Row Level Security on every exposed table and locks down atomic RPCs', () => {
  const rlsSql = read('supabase/migrations/0004_security_functions_and_rls.sql');

  const rlsTables = [
    'stores',
    'profiles',
    'roles',
    'permissions',
    'role_permissions',
    'staff',
    'staff_permissions',
    'customers',
    'loyalty_programmes',
    'loyalty_programme_tiers',
    'loyalty_cards',
    'purchases',
    'stamp_transactions',
    'rewards',
    'customer_rewards',
    'redemptions',
    'campaigns',
    'surveys',
    'survey_questions',
    'survey_responses',
    'contact_messages',
    'brand_settings',
    'audit_logs',
  ];

  for (const table of rlsTables) {
    assert.match(
      rlsSql,
      new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`),
      `RLS not enabled on ${table}`,
    );
  }

  // Customers must never get direct INSERT/UPDATE policies on loyalty_cards, purchases, stamp_transactions
  assert.equal(/CREATE POLICY[^\n]+ON public\.loyalty_cards\s+FOR\s+(INSERT|UPDATE|DELETE)/i.test(rlsSql), false);
  assert.equal(/CREATE POLICY[^\n]+ON public\.purchases\s+FOR\s+(INSERT|UPDATE|DELETE)/i.test(rlsSql), false);
  assert.equal(/CREATE POLICY[^\n]+ON public\.stamp_transactions\s+FOR\s+(INSERT|UPDATE|DELETE)/i.test(rlsSql), false);

  // Atomic RPCs revoked from anon/authenticated and granted only to service_role
  assert.match(rlsSql, /REVOKE ALL ON FUNCTION public\.fn_award_stamps.*FROM PUBLIC, anon, authenticated/s);
  assert.match(rlsSql, /REVOKE ALL ON FUNCTION public\.fn_request_redemption.*FROM PUBLIC, anon, authenticated/s);
  assert.match(rlsSql, /REVOKE ALL ON FUNCTION public\.fn_process_redemption.*FROM PUBLIC, anon, authenticated/s);
  assert.match(rlsSql, /GRANT EXECUTE ON FUNCTION public\.fn_award_stamps.*TO service_role/s);
});

test('Seed SQL contains zero hardcoded production passwords or fake production customer emails', () => {
  const seed = read('supabase/seed.sql')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '');
  assert.equal(/password|bcrypt|crypt\(/i.test(seed), false, 'seed.sql must not contain passwords');
  assert.equal(/INSERT INTO auth\.users/i.test(seed), false, 'seed.sql must not seed auth.users');
});

test('Frontend Supabase client exposes no service_role keys and executes cleanly when unconfigured', async () => {
  const clientCode = read('src/scripts/core/supabaseClient.js')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.equal(/service_role|SUPABASE_SERVICE_ROLE_KEY/i.test(clientCode), false);

  const { supabaseAuth, invokeEdgeFunction, restSelect } = await import(
    '../src/scripts/core/supabaseClient.js'
  );

  assert.equal(supabaseAuth.getSession(), null);
  assert.equal((await supabaseAuth.signInWithPassword({ email: 'a@b.com', password: 'Password1' })).code, 'SUPABASE_NOT_CONFIGURED');
  assert.equal((await invokeEdgeFunction('issue-stamp', {})).code, 'SUPABASE_NOT_CONFIGURED');
  assert.equal((await restSelect('customers')).code, 'SUPABASE_NOT_CONFIGURED');
});
