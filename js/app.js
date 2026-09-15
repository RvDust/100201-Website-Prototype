// Main Application Orchestrator for 100201 Football Shop

import { store } from './store.js';
import { initStorefront, renderCatalog, setCatalogLeagueFilter } from './storefront.js';
import { initCart, openCartDrawer, closeCartDrawer } from './cart.js';
import { initPayments, openPaymentsModal, closePaymentsModal } from './payments.js';
import { initTracker, trackOrder, renderTracker } from './tracker.js';
import { initAdmin, renderAdminDashboard } from './admin.js';
import { initAuth, auth, openCustomerAuthModal, closeCustomerAuthModal } from './auth.js';

// Global exposed methods
window.showToast = showToast;
window.navigateToView = navigateToView;
window.openCartDrawer = openCartDrawer;
window.closeCartDrawer = closeCartDrawer;
window.openPaymentsModal = openPaymentsModal;
window.openSizeChartModal = openSizeChartModal;
window.closeSizeChartModal = closeSizeChartModal;
window.openCustomerAuthModal = openCustomerAuthModal;
window.closeCustomerAuthModal = closeCustomerAuthModal;

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Sub-modules
  initAuth();
  initStorefront();
  initCart();
  initPayments();
  initTracker();
  initAdmin();

  setupGlobalNavigation();
  setupKeyboardShortcuts();
  setupSizeChartModal();

  // Reactive sync: When customer logs in/out, refresh payment options
  auth.subscribe(() => {
    store.notify('payments', store.getPaymentMethods());
  });

  // Initial View
  navigateToView('storefront');
});

function setupGlobalNavigation() {
  // Admin / Merchant Mode Toggle
  const adminModeBtn = document.getElementById('mode-btn-admin');
  if (adminModeBtn) {
    adminModeBtn.addEventListener('click', () => {
      const currentView = store.getView();
      if (currentView === 'admin') {
        navigateToView('storefront');
      } else {
        navigateToView('admin');
      }
    });
  }

  // Admin Header Exit Button
  const adminExitBtn = document.getElementById('admin-exit-btn');
  if (adminExitBtn) {
    adminExitBtn.addEventListener('click', () => {
      navigateToView('storefront');
    });
  }

  // Tracker Back to Shop Button
  const trackerBackBtn = document.getElementById('tracker-back-to-shop-btn');
  if (trackerBackBtn) {
    trackerBackBtn.addEventListener('click', () => {
      navigateToView('storefront');
    });
  }

  // Brand Logo click returns to storefront
  const brandLogo = document.getElementById('brand-logo-btn');
  if (brandLogo) {
    brandLogo.addEventListener('click', () => {
      setCatalogLeagueFilter('all');
      navigateToView('storefront');
    });
  }

  // Top Nav links
  const navShop = document.getElementById('nav-link-shop');
  const navRetro = document.getElementById('nav-link-retro');
  const navTracker = document.getElementById('nav-link-tracker');

  if (navShop) {
    navShop.addEventListener('click', (e) => {
      e.preventDefault();
      setCatalogLeagueFilter('all');
      navigateToView('storefront');
    });
  }

  if (navRetro) {
    navRetro.addEventListener('click', (e) => {
      e.preventDefault();
      setCatalogLeagueFilter('Retro Legends');
      navigateToView('storefront');
    });
  }

  if (navTracker) {
    navTracker.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToView('tracker');
    });
  }

  // Footer Navigation Shortcuts
  document.querySelectorAll('[data-nav-target]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.dataset.navTarget;
      if (target === 'retro') {
        setCatalogLeagueFilter('Retro Legends');
        navigateToView('storefront');
      } else {
        navigateToView(target);
      }
    });
  });

  // Mobile Bottom Navigation Bar Actions
  const mobShop = document.getElementById('mob-nav-shop');
  const mobRetro = document.getElementById('mob-nav-retro');
  const mobTrack = document.getElementById('mob-nav-track');
  const mobCart = document.getElementById('mob-nav-cart');

  if (mobShop) {
    mobShop.addEventListener('click', () => {
      setCatalogLeagueFilter('all');
      navigateToView('storefront');
    });
  }

  if (mobRetro) {
    mobRetro.addEventListener('click', () => {
      setCatalogLeagueFilter('Retro Legends');
      navigateToView('storefront');
    });
  }

  if (mobTrack) {
    mobTrack.addEventListener('click', () => {
      navigateToView('tracker');
    });
  }

  if (mobCart) {
    mobCart.addEventListener('click', () => {
      openCartDrawer();
    });
  }
}

export function navigateToView(viewName, orderIdParam = null) {
  store.setView(viewName);

  // Main Sections
  const storefrontView = document.getElementById('view-storefront');
  const adminView = document.getElementById('view-admin');
  const trackerView = document.getElementById('view-tracker');

  // Nav links
  const navShop = document.getElementById('nav-link-shop');
  const navRetro = document.getElementById('nav-link-retro');
  const navTracker = document.getElementById('nav-link-tracker');

  // Mobile bottom nav items
  const mobShop = document.getElementById('mob-nav-shop');
  const mobRetro = document.getElementById('mob-nav-retro');
  const mobTrack = document.getElementById('mob-nav-track');

  // Hide all main views first
  if (storefrontView) storefrontView.style.display = 'none';
  if (adminView) adminView.style.display = 'none';
  if (trackerView) trackerView.style.display = 'none';

  // Remove active from nav links
  if (navShop) navShop.classList.remove('active');
  if (navRetro) navRetro.classList.remove('active');
  if (navTracker) navTracker.classList.remove('active');

  if (mobShop) mobShop.classList.remove('active');
  if (mobRetro) mobRetro.classList.remove('active');
  if (mobTrack) mobTrack.classList.remove('active');

  if (viewName === 'admin') {
    if (adminView) adminView.style.display = 'block';
    renderAdminDashboard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (viewName === 'tracker') {
    if (!auth.isCustomerLoggedIn() && !auth.isMerchantLoggedIn()) {
      window.showToast?.('Please sign in to track your orders.', 'info');
      openCustomerAuthModal('account', () => {
        navigateToView('tracker', orderIdParam);
      });
      return;
    }

    if (trackerView) trackerView.style.display = 'block';
    if (navTracker) navTracker.classList.add('active');
    if (mobTrack) mobTrack.classList.add('active');

    if (orderIdParam) {
      trackOrder(orderIdParam);
    } else {
      renderTracker();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    // Default: Storefront
    if (storefrontView) storefrontView.style.display = 'block';
    if (navShop) navShop.classList.add('active');
    if (mobShop) mobShop.classList.add('active');
    renderCatalog();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Remove the bag option and announcement bar for the merchant or admin view
  const isMerchant = auth.isMerchantLoggedIn();
  const cartToggleBtn = document.getElementById('cart-toggle-btn');
  const mobNavCart = document.getElementById('mob-nav-cart');
  const tickerBar = document.querySelector('.ticker-bar');

  if (cartToggleBtn) {
    cartToggleBtn.style.display = (isMerchant || viewName === 'admin') ? 'none' : 'flex';
  }
  if (mobNavCart) {
    mobNavCart.style.display = (isMerchant || viewName === 'admin') ? 'none' : 'flex';
  }
  if (tickerBar) {
    tickerBar.style.display = viewName === 'admin' ? 'none' : 'flex';
  }

  document.body.classList.toggle('merchant-logged-in', isMerchant);
  document.body.classList.toggle('view-admin', viewName === 'admin');
}

function setupSizeChartModal() {
  const closeBtn = document.getElementById('close-sizechart-btn');
  const backdrop = document.getElementById('sizechart-modal-backdrop');

  if (closeBtn) closeBtn.addEventListener('click', closeSizeChartModal);
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeSizeChartModal();
    });
  }
}

export function openSizeChartModal() {
  const backdrop = document.getElementById('sizechart-modal-backdrop');
  if (backdrop) backdrop.classList.add('open');
}

export function closeSizeChartModal() {
  const backdrop = document.getElementById('sizechart-modal-backdrop');
  if (backdrop) backdrop.classList.remove('open');
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCartDrawer();
      closePaymentsModal();
      closeSizeChartModal();
      document.querySelectorAll('.modal-backdrop').forEach(modal => {
        modal.classList.remove('open');
      });
    }
  });
}

export function showToast(message, type = 'normal') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'info' ? 'toast-info' : ''}`;

  let iconSvg = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--accent-pitch); flex-shrink: 0;">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  `;

  if (type === 'error') {
    iconSvg = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--accent-crimson); flex-shrink: 0;">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
    `;
  } else if (type === 'info') {
    iconSvg = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--accent-sky); flex-shrink: 0;">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    `;
  }

  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.75rem;">
      ${iconSvg}
      <span class="toast-msg">${message}</span>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
    setTimeout(() => {
      toast.remove();
    }, 250);
  }, 3200);
}
