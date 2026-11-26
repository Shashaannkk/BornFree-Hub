/**
 * BONFREE-HUB Admin Console Entry Bootstrapper (Phase 2A)
 */
import { getPublicConfig } from './core/config.js';
import { installGlobalErrorMonitoring } from './core/logger.js';
import { hydrateIcons } from './core/icons.js';
import { initPasswordToggles } from './components/form.js';
import { requireStaffSession } from './services/authService.js';
import {
  initAdminCustomersPage,
  initAdminLoginPage,
  initAdminLoyaltyPage,
  initAdminOverviewPage,
} from './pages/adminPages.js';
import {
  initAdminRedemptionsPage,
  initAdminRewardsPage,
  initAdminScannerPage,
  initAdminStampsPage,
} from './pages/adminOperations.js';
import {
  initAdminCampaignsPage,
  initAdminPurchasesPage,
  initAdminStaffPage,
  initAdminSurveysPage,
} from './pages/adminManagement.js';
import {
  initAdminAnalyticsPage,
  initAdminReportsPage,
  initAdminSettingsPage,
} from './pages/adminInsights.js';

const PAGE_REQUIRED_PERMISSION = Object.freeze({
  'admin-overview': null,
  'admin-customers': 'customers.read',
  'admin-loyalty': 'programmes.manage',
  'admin-scanner': 'stamps.issue',
  'admin-stamps': 'stamps.read',
  'admin-rewards': 'rewards.manage',
  'admin-redemptions': 'redemptions.verify',
  'admin-purchases': 'purchases.read',
  'admin-staff': 'staff.manage',
  'admin-campaigns': 'campaigns.manage',
  'admin-surveys': 'surveys.manage',
  'admin-analytics': 'analytics.view',
  'admin-reports': 'reports.export',
  'admin-settings': 'settings.manage',
});

document.addEventListener('DOMContentLoaded', async () => {
  installGlobalErrorMonitoring();
  const cfg = getPublicConfig();
  const pageName = document.body.dataset.page || '';

  if (pageName !== 'admin-login') {
    const staffGuard = await requireStaffSession();
    if (!staffGuard.ok) {
      window.location.href = staffGuard.redirectUrl || 'login.html?reason=auth_required';
      return;
    }

    if (staffGuard.mode === 'live') {
      const requiredPerm = PAGE_REQUIRED_PERMISSION[pageName] || null;
      const grantedPerms = Array.isArray(staffGuard.permissions) ? staffGuard.permissions : [];
      if (requiredPerm && !grantedPerms.includes(requiredPerm)) {
        window.location.href = 'dashboard.html?reason=forbidden_module';
        return;
      }
    }
  }

  initPasswordToggles();
  initAdminLoginPage();
  initAdminOverviewPage();
  initAdminCustomersPage();
  initAdminLoyaltyPage();
  initAdminScannerPage();
  initAdminStampsPage();
  initAdminRewardsPage();
  initAdminRedemptionsPage();
  initAdminPurchasesPage();
  initAdminStaffPage();
  initAdminCampaignsPage();
  initAdminSurveysPage();
  initAdminAnalyticsPage();
  initAdminReportsPage();
  initAdminSettingsPage();
  hydrateIcons();

  if (cfg.environment === 'development') {
    document.documentElement.dataset.bonfreeAdminReady = 'true';
  }
});
