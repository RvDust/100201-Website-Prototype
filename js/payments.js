// Payment Methods Controller for 100201 Football Shop
// Manages isolated payment methods saved per Buyer Account

import { store } from './store.js';
import { auth } from './auth.js';

export function initPayments() {
  setupPaymentsModalEvents();
  renderPaymentsManagerList();

  store.subscribe('payments', () => {
    renderPaymentsManagerList();
  });
}

function setupPaymentsModalEvents() {
  const closePaymentsBtn = document.getElementById('close-payments-modal-btn');
  const paymentsModalBackdrop = document.getElementById('payments-modal-backdrop');

  if (closePaymentsBtn) {
    closePaymentsBtn.addEventListener('click', closePaymentsModal);
  }
  if (paymentsModalBackdrop) {
    paymentsModalBackdrop.addEventListener('click', (e) => {
      if (e.target === paymentsModalBackdrop) closePaymentsModal();
    });
  }

  const toggleAddBtn = document.getElementById('modal-toggle-add-pm-btn');
  const addFormBox = document.getElementById('modal-add-pm-form-box');
  if (toggleAddBtn && addFormBox) {
    toggleAddBtn.addEventListener('click', () => {
      const isHidden = addFormBox.classList.toggle('collapsed');
      toggleAddBtn.textContent = isHidden ? '+ Add New Payment Method' : 'Cancel';
    });
  }

  const addPmForm = document.getElementById('modal-add-pm-form');
  if (addPmForm) {
    addPmForm.addEventListener('submit', handleAddNewPaymentMethod);
  }

  const modalPmType = document.getElementById('modal-pm-type');
  const modalPmHelper = document.getElementById('modal-pm-helper');
  const modalPmHolderLabel = document.getElementById('modal-pm-holder-label');
  const modalPmNumberLabel = document.getElementById('modal-pm-number-label');
  const modalPmNumberGroup = document.getElementById('modal-pm-number-group');
  const modalPmNumberInput = document.getElementById('modal-pm-number');

  function updateModalPmFormFields() {
    if (!modalPmType) return;
    const val = modalPmType.value;
    if (val === 'cod') {
      if (modalPmHelper) {
        modalPmHelper.style.display = 'block';
        modalPmHelper.innerHTML = '💵 <strong>Cash on Delivery (COD):</strong> Saved as your preferred payment method for courier deliveries. No bank account required.';
      }
      if (modalPmHolderLabel) modalPmHolderLabel.textContent = 'Recipient Name';
      if (modalPmNumberGroup) modalPmNumberGroup.style.display = 'none';
      if (modalPmNumberInput) modalPmNumberInput.required = false;
    } else if (val === 'pickup') {
      if (modalPmHelper) {
        modalPmHelper.style.display = 'block';
        modalPmHelper.innerHTML = '📍 <strong>Payment on Pick-up:</strong> Settle payment at the 100201 store counter via Cash, GCash QR, or card terminal when claiming your kit.';
      }
      if (modalPmHolderLabel) modalPmHolderLabel.textContent = 'Claimant Name';
      if (modalPmNumberGroup) modalPmNumberGroup.style.display = 'none';
      if (modalPmNumberInput) modalPmNumberInput.required = false;
    } else {
      if (modalPmHelper) {
        modalPmHelper.style.display = val === 'gcash' || val === 'maya' || val === 'bdo' ? 'block' : 'none';
        if (val === 'gcash') modalPmHelper.innerHTML = '📱 <strong>GCash:</strong> Transfer to 0917-555-1201 (100201 Football Shop).';
        else if (val === 'maya') modalPmHelper.innerHTML = '📱 <strong>Maya:</strong> Transfer to 0917-555-1201 (100201 Football Shop).';
        else if (val === 'bdo') modalPmHelper.innerHTML = '🏦 <strong>BDO Unibank:</strong> Account 0041-8890-2101 (100201 SPORTS).';
      }
      if (modalPmHolderLabel) modalPmHolderLabel.textContent = val === 'card' ? 'Cardholder Name' : 'Account / Holder Name';
      if (modalPmNumberLabel) modalPmNumberLabel.textContent = val === 'card' ? 'Card Number (16 digits)' : 'Mobile Number or Account / Card Number';
      if (modalPmNumberGroup) modalPmNumberGroup.style.display = 'block';
      if (modalPmNumberInput) modalPmNumberInput.required = true;
    }
  }

  if (modalPmType) {
    modalPmType.addEventListener('change', updateModalPmFormFields);
    updateModalPmFormFields();
  }
}

export function openPaymentsModal() {
  if (!auth.isCustomerLoggedIn()) {
    window.showToast?.('Please sign in or create an account to view payment options.', 'info');
    window.openCustomerAuthModal?.('account');
    return;
  }

  const backdrop = document.getElementById('payments-modal-backdrop');
  if (backdrop) {
    const customer = auth.getCurrentCustomer();
    const subtitleEl = document.getElementById('payments-modal-subtitle');
    if (subtitleEl && customer) {
      subtitleEl.innerHTML = `Saved payment options for <strong>${customer.name}</strong> (${customer.email}). Private to your buyer account.`;
    }
    renderPaymentsManagerList();
    backdrop.classList.add('open');
  }
}

export function closePaymentsModal() {
  const backdrop = document.getElementById('payments-modal-backdrop');
  if (backdrop) backdrop.classList.remove('open');
}

export function renderPaymentsManagerList() {
  const container = document.getElementById('payments-manager-list');
  if (!container) return;

  const customer = auth.getCurrentCustomer();
  if (!customer) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted); background: var(--bg-surface-elevated); border: 1px dashed var(--border-medium); border-radius: var(--radius-sm);">
        <p style="margin-bottom: 0.5rem; color: var(--text-primary); font-weight: 600;">Sign In Required</p>
        <p style="margin: 0; font-size: 0.8rem;">Please sign in to view and manage your account's saved payment methods.</p>
      </div>
    `;
    return;
  }

  const methods = store.getPaymentMethods();

  if (methods.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2.25rem 1.5rem; color: var(--text-muted); background: var(--bg-surface-elevated); border: 1px dashed var(--border-medium); border-radius: var(--radius-sm);">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-bottom: 0.6rem; color: var(--text-muted);">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
          <line x1="1" y1="10" x2="23" y2="10"></line>
        </svg>
        <p style="margin-bottom: 0.35rem; font-weight: 700; color: var(--text-primary);">No saved payment options yet</p>
        <p style="margin: 0; font-size: 0.8rem;">Add your GCash, Maya, COD, or Bank Transfer below for fast 1-click checkout on your account.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = methods.map(pm => {
    const badgeClass = pm.type === 'cod' ? 'pm-icon-cod' :
                       pm.type === 'pickup' ? 'pm-icon-pickup' :
                       pm.type === 'gcash' ? 'pm-icon-gcash' :
                       pm.type === 'maya' ? 'pm-icon-maya' :
                       pm.type === 'bdo' || pm.type === 'bank' ? 'pm-icon-bdo' : 'pm-icon-card';
    const badgeText = pm.badgeText || (
      pm.type === 'cod' ? 'COD' :
      pm.type === 'pickup' ? 'PICKUP' :
      pm.type === 'gcash' ? 'GCASH' :
      pm.type === 'maya' ? 'MAYA' :
      pm.type === 'bdo' || pm.type === 'bank' ? 'BDO' : 'CARD'
    );
    const title = pm.brand || (
      pm.type === 'cod' ? 'Cash on Delivery (COD)' :
      pm.type === 'pickup' ? 'Payment on Pick-up' :
      pm.type === 'gcash' ? 'GCash' :
      pm.type === 'maya' ? 'Maya' : 'Credit Card'
    );
    const sub = pm.accountNumber || (pm.last4 ? `•••• ${pm.last4}` : pm.accountName);

    return `
      <div class="payment-method-card" data-pm-id="${pm.id}">
        <div class="pm-left">
          <div class="pm-icon-badge ${badgeClass}" style="font-weight:800; font-size:0.68rem;">${badgeText}</div>
          <div class="pm-details">
            <span class="pm-title">${title}</span>
            <span class="pm-sub">${sub} &bull; ${pm.accountName || pm.cardHolder || ''}</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          ${pm.isDefault ? `
            <span class="pm-default-tag">Default</span>
          ` : `
            <button class="btn btn-secondary btn-sm" data-action="set-default" data-id="${pm.id}">
              Set Default
            </button>
          `}
          <button class="icon-btn btn-sm" data-action="delete" data-id="${pm.id}" title="Remove payment option from account" style="color: var(--accent-crimson);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-action="set-default"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      store.setDefaultPaymentMethod(btn.dataset.id);
      window.showToast?.('Default payment option updated for your account', 'success');
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      store.deletePaymentMethod(btn.dataset.id);
      window.showToast?.('Payment method removed from your account');
    });
  });
}

function handleAddNewPaymentMethod(e) {
  e.preventDefault();

  if (!auth.isCustomerLoggedIn()) {
    window.showToast?.('Please sign in to your buyer account to save payment options', 'error');
    return;
  }

  const customer = auth.getCurrentCustomer();
  const type = document.getElementById('modal-pm-type')?.value || 'gcash';
  const name = document.getElementById('modal-pm-holder')?.value.trim() || customer?.name || 'Customer';
  const number = document.getElementById('modal-pm-number')?.value.trim();
  const isDefault = document.getElementById('modal-pm-default')?.checked;

  let brand = 'GCash';
  let badgeText = 'GCASH';
  let accountNumber = number;
  let last4 = '0000';

  if (type === 'cod') {
    brand = 'Cash on Delivery (COD)';
    badgeText = 'COD';
    accountNumber = 'Exact Cash Upon Arrival';
    last4 = 'CASH';
  } else if (type === 'pickup') {
    brand = 'Payment on Pick-up';
    badgeText = 'PICKUP';
    accountNumber = 'Pay at Store Counter';
    last4 = 'COUNTER';
  } else {
    if (!name || !number) {
      window.showToast?.('Please enter required details', 'error');
      return;
    }
    brand = type === 'gcash' ? 'GCash' : type === 'maya' ? 'Maya' : type === 'bdo' ? 'BDO Unibank' : 'Visa';
    badgeText = type === 'gcash' ? 'GCASH' : type === 'maya' ? 'MAYA' : type === 'bdo' ? 'BDO' : 'VISA';
    last4 = number.replace(/\D/g, '').slice(-4);
  }

  store.addPaymentMethod({
    type,
    brand,
    accountName: name,
    accountNumber,
    cardHolder: name,
    last4,
    badgeText,
    isDefault
  });

  window.showToast?.(`New ${brand} option saved to ${customer?.name || 'your'} account!`, 'success');

  const addPmForm = document.getElementById('modal-add-pm-form');
  if (addPmForm) addPmForm.reset();
  const addFormBox = document.getElementById('modal-add-pm-form-box');
  if (addFormBox) addFormBox.classList.add('collapsed');
  const toggleAddBtn = document.getElementById('modal-toggle-add-pm-btn');
  if (toggleAddBtn) toggleAddBtn.textContent = '+ Add New Payment Method';
}
