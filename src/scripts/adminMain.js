/**
 * BONFREE-HUB Admin Console Entry Bootstrapper (Phase 2A)
 */
import { getPublicConfig } from './core/config.js';
import { hydrateIcons } from './core/icons.js';
import { initPasswordToggles } from './components/form.js';
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

document.addEventListener('DOMContentLoaded', () => {
  const cfg = getPublicConfig();

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
