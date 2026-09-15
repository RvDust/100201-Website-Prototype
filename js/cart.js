import { store, MAX_ORDER_AMOUNT_PHP, MAX_ORDER_ITEMS } from './store.js';
import { auth, openCustomerAuthModal } from './auth.js';
import { registerUserOrder } from './tracker.js';
import { FootballCaptcha } from './captcha.js';

let selectedPaymentMethodId = null;
let currentCheckoutStep = 1;
let fulfillmentMode = 'delivery'; // 'delivery' | 'pickup'
let checkoutCaptcha = null;
let isPlacingOrder = false;

export function initCart() {
  setupCartEventListeners();
  renderCart();

  store.subscribe('cart', () => {
    renderCart();
    updateCartHeaderBadge();
  });

  store.subscribe('currency', () => {
    renderCart();
  });

  store.subscribe('payments', () => {
    renderCheckoutPaymentMethods();
  });

  updateCartHeaderBadge();
}

function setupCartEventListeners() {
  const cartToggleBtn = document.getElementById('cart-toggle-btn');
  const cartCloseBtn = document.getElementById('cart-close-btn');
  const cartBackdrop = document.getElementById('cart-drawer-backdrop');
  const cartContinueBtn = document.getElementById('cart-continue-btn');

  if (cartToggleBtn) cartToggleBtn.addEventListener('click', openCartDrawer);
  if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCartDrawer);
  if (cartContinueBtn) cartContinueBtn.addEventListener('click', closeCartDrawer);
  if (cartBackdrop) {
    cartBackdrop.addEventListener('click', (e) => {
      if (e.target === cartBackdrop) closeCartDrawer();
    });
  }

  // Promo Code Form
  const promoApplyBtn = document.getElementById('cart-promo-apply-btn');
  const promoInput = document.getElementById('cart-promo-input');
  if (promoApplyBtn && promoInput) {
    promoApplyBtn.addEventListener('click', () => {
      const code = promoInput.value.trim();
      if (!code) return;
      const res = store.applyPromo(code);
      if (res.success) {
        window.showToast?.(res.message, 'success');
        promoInput.value = '';
      } else {
        window.showToast?.(res.message, 'error');
      }
    });
  }

  // Proceed to Checkout
  const checkoutBtn = document.getElementById('cart-checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      const cart = store.getCart();
      if (cart.length === 0) {
        window.showToast?.('Your bag is empty. Add a kit first!', 'error');
        return;
      }

      // Intercept unauthenticated users: require customer login/register before checkout
      if (!auth.isCustomerLoggedIn()) {
        closeCartDrawer();
        openCustomerAuthModal('checkout', () => {
          openCheckoutModal();
        });
        return;
      }

      closeCartDrawer();
      openCheckoutModal();
    });
  }

  // Checkout Modal Close & Backdrop
  const closeCheckoutBtn = document.getElementById('close-checkout-btn');
  const checkoutBackdrop = document.getElementById('checkout-modal-backdrop');
  if (closeCheckoutBtn && checkoutBackdrop) {
    closeCheckoutBtn.addEventListener('click', closeCheckoutModal);
    checkoutBackdrop.addEventListener('click', (e) => {
      if (e.target === checkoutBackdrop) closeCheckoutModal();
    });
  }

  // Multi-step Checkout Controls
  setupMultiStepCheckout();

  // Place Order Form Submit
  const checkoutForm = document.getElementById('checkout-form');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', handlePlaceOrder);
  }

  // Toggle "Add New Payment Method" inside checkout
  const toggleNewPmBtn = document.getElementById('checkout-toggle-add-pm-btn');
  const newPmBox = document.getElementById('checkout-new-pm-box');
  if (toggleNewPmBtn && newPmBox) {
    toggleNewPmBtn.addEventListener('click', () => {
      const isHidden = newPmBox.classList.toggle('collapsed');
      toggleNewPmBtn.textContent = isHidden ? '+ Add or Use Another Payment Option' : 'Hide Payment Form';
    });
  }
}

function setupMultiStepCheckout() {
  const gotoStep2Btn = document.getElementById('checkout-goto-step-2-btn');
  const backToStep1Btn = document.getElementById('checkout-back-to-step-1-btn');
  const step1Box = document.getElementById('checkout-step-1');
  const step2Box = document.getElementById('checkout-step-2');
  const stepNav1 = document.getElementById('step-nav-1');
  const stepNav2 = document.getElementById('step-nav-2');

  // Fulfillment Toggle buttons
  const btnDelivery = document.getElementById('fulfillment-btn-delivery');
  const btnPickup = document.getElementById('fulfillment-btn-pickup');
  const addressInput = document.getElementById('checkout-address');
  const addressLabel = document.getElementById('checkout-address-label');

  if (btnDelivery && btnPickup) {
    btnDelivery.addEventListener('click', () => {
      fulfillmentMode = 'delivery';
      btnDelivery.classList.add('active');
      btnPickup.classList.remove('active');
      if (addressLabel) addressLabel.textContent = 'Delivery Street Address *';
      if (addressInput) {
        addressInput.value = 'Unit 14B, Sapphire Tower, Ortigas Center';
        addressInput.readOnly = false;
      }
    });

    btnPickup.addEventListener('click', () => {
      fulfillmentMode = 'pickup';
      btnPickup.classList.add('active');
      btnDelivery.classList.remove('active');
      if (addressLabel) addressLabel.textContent = 'Store Pick-up Location *';
      if (addressInput) {
        addressInput.value = '100201 Football Shop Counter, Ortigas Center, Pasig City';
        addressInput.readOnly = true;
      }
    });
  }

  // Goto Step 2
  if (gotoStep2Btn) {
    gotoStep2Btn.addEventListener('click', () => {
      const name = document.getElementById('checkout-name')?.value.trim();
      const email = document.getElementById('checkout-email')?.value.trim();
      const phone = document.getElementById('checkout-phone')?.value.trim();
      const city = document.getElementById('checkout-city')?.value.trim();
      const address = document.getElementById('checkout-address')?.value.trim();

      if (!name || !email || !phone || !city || !address) {
        window.showToast?.('Please fill in all required fulfillment details', 'error');
        return;
      }

      currentCheckoutStep = 2;
      step1Box.style.display = 'none';
      step2Box.style.display = 'block';
      stepNav1.classList.remove('active');
      stepNav1.classList.add('completed');
      stepNav2.classList.add('active');

      renderCheckoutPaymentMethods();

      // Initialize or refresh Anti-Bot Security CAPTCHA for checkout step 2
      if (!checkoutCaptcha) {
        checkoutCaptcha = new FootballCaptcha('checkout-captcha-container');
      } else {
        checkoutCaptcha.refresh();
      }

      updatePlaceOrderBtnText();
    });
  }

  // Back to Step 1
  if (backToStep1Btn) {
    backToStep1Btn.addEventListener('click', () => {
      currentCheckoutStep = 1;
      if (step1Box) step1Box.style.display = 'block';
      if (step2Box) step2Box.style.display = 'none';

      if (stepNav1) {
        stepNav1.classList.add('active');
        stepNav1.classList.remove('completed');
      }
      if (stepNav2) {
        stepNav2.classList.remove('active');
      }
    });
  }
}

export function openCartDrawer() {
  if (auth.isMerchantLoggedIn() || store.getView() === 'admin') {
    return; // Remove bag option for merchant
  }
  const backdrop = document.getElementById('cart-drawer-backdrop');
  if (backdrop) backdrop.classList.add('open');
}

export function closeCartDrawer() {
  const backdrop = document.getElementById('cart-drawer-backdrop');
  if (backdrop) backdrop.classList.remove('open');
}

export function updateCartHeaderBadge() {
  const badge = document.getElementById('cart-badge-count');
  const mobBadge = document.getElementById('mob-cart-badge-count');
  const summary = store.getCartSummary();
  if (badge) {
    badge.textContent = summary.totalItems;
    badge.style.display = summary.totalItems > 0 ? 'flex' : 'none';
  }
  if (mobBadge) {
    mobBadge.textContent = summary.totalItems;
    mobBadge.style.display = summary.totalItems > 0 ? 'flex' : 'none';
  }
}

export function renderCart() {
  const cartItemsList = document.getElementById('cart-items-list');
  const emptyState = document.getElementById('cart-empty-state');
  const cartFooter = document.getElementById('cart-footer');
  const cartCountEl = document.getElementById('cart-item-count-text');

  if (!cartItemsList) return;

  const cart = store.getCart();
  const summary = store.getCartSummary();

  if (cartCountEl) {
    cartCountEl.textContent = `${summary.totalItems} ${summary.totalItems === 1 ? 'kit' : 'kits'}`;
  }

  // Free Shipping Meter (₱1,500 threshold)
  const meterText = document.getElementById('shipping-meter-text');
  const meterBar = document.getElementById('shipping-meter-fill');
  if (meterText && meterBar) {
    if (summary.subtotal === 0) {
      meterText.innerHTML = 'Add items for <strong>Free Nationwide PH Shipping</strong> over ₱1,500';
      meterBar.style.width = '0%';
    } else if (summary.freeShippingQualified) {
      meterText.innerHTML = '⚡ You have unlocked <strong>Free Nationwide Delivery</strong>!';
      meterBar.style.width = '100%';
    } else {
      const pct = Math.min(100, Math.round((summary.subtotal / 1500) * 100));
      meterText.innerHTML = `Add <strong>${store.formatPrice(summary.freeShippingNeeded)}</strong> more for <strong>Free Shipping</strong>`;
      meterBar.style.width = `${pct}%`;
    }
  }

  if (cart.length === 0) {
    cartItemsList.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    if (cartFooter) cartFooter.style.display = 'none';
    return;
  }

  cartItemsList.style.display = 'flex';
  if (emptyState) emptyState.style.display = 'none';
  if (cartFooter) cartFooter.style.display = 'block';

  cartItemsList.innerHTML = cart.map(item => `
    <div class="cart-item-row" data-cart-id="${item.cartItemId}">
      <img class="cart-item-img" src="${item.image}" alt="${item.name}" onerror="this.src='https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?auto=format&fit=crop&w=800&q=80'">
      <div class="cart-item-details">
        <div>
          <h4 class="cart-item-name">${item.name}</h4>
          <div class="cart-item-meta">
            <span>Size: <span class="size-badge">${item.size}</span></span>
            <span>&bull;</span>
            <span>${store.formatPrice(item.price)} each</span>
          </div>
          ${item.customization ? `<div class="cart-item-customization">Print: ${item.customization}</div>` : ''}
        </div>
        <div class="cart-item-bottom">
          <div class="qty-stepper">
            <button class="qty-btn" data-action="decrease" data-id="${item.cartItemId}">&minus;</button>
            <span class="qty-val">${item.quantity}</span>
            <button class="qty-btn" data-action="increase" data-id="${item.cartItemId}">&plus;</button>
          </div>
          <span class="cart-item-price">${store.formatPrice(item.price * item.quantity)}</span>
          <button class="cart-item-remove" data-action="remove" data-id="${item.cartItemId}" title="Remove kit">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  cartItemsList.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cartItemId = btn.dataset.id;
      const item = cart.find(i => i.cartItemId === cartItemId);
      if (!item) return;

      if (btn.dataset.action === 'increase') {
        store.updateCartQuantity(cartItemId, item.quantity + 1);
      } else {
        store.updateCartQuantity(cartItemId, item.quantity - 1);
      }
    });
  });

  cartItemsList.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      store.removeFromCart(btn.dataset.id);
      window.showToast?.('Jersey removed from bag');
    });
  });

  const subtotalEl = document.getElementById('cart-subtotal-val');
  const discountRow = document.getElementById('cart-discount-row');
  const discountEl = document.getElementById('cart-discount-val');
  const shippingEl = document.getElementById('cart-shipping-val');
  const totalEl = document.getElementById('cart-total-val');

  if (subtotalEl) subtotalEl.textContent = store.formatPrice(summary.subtotal);
  if (discountRow && discountEl) {
    if (summary.discountAmount > 0) {
      discountRow.style.display = 'flex';
      discountEl.textContent = `-${store.formatPrice(summary.discountAmount)} (${summary.promoCode})`;
    } else {
      discountRow.style.display = 'none';
    }
  }
  if (shippingEl) {
    shippingEl.textContent = summary.shipping === 0 ? 'FREE' : store.formatPrice(summary.shipping);
  }
  if (totalEl) totalEl.textContent = store.formatPrice(summary.finalTotal);

  // Spending Cap & Quota Verification Banner in Cart
  const limitWarning = document.getElementById('cart-limit-warning');
  const checkoutBtn = document.getElementById('cart-checkout-btn');
  const isOverSpendLimit = summary.finalTotal > MAX_ORDER_AMOUNT_PHP;
  const isOverItemLimit = summary.totalItems > MAX_ORDER_ITEMS;

  if (limitWarning && checkoutBtn) {
    if (isOverSpendLimit || isOverItemLimit) {
      limitWarning.style.display = 'block';
      limitWarning.textContent = isOverSpendLimit
        ? `⚠️ Order total exceeds the maximum spending cap of ${store.formatPrice(MAX_ORDER_AMOUNT_PHP)}.`
        : `⚠️ Quantity exceeds the limit of ${MAX_ORDER_ITEMS} kits per order.`;
      checkoutBtn.disabled = true;
      checkoutBtn.style.opacity = '0.5';
      checkoutBtn.style.cursor = 'not-allowed';
    } else {
      limitWarning.style.display = 'none';
      checkoutBtn.disabled = false;
      checkoutBtn.style.opacity = '1';
      checkoutBtn.style.cursor = 'pointer';
    }
  }
}

export function openCheckoutModal() {
  const modalBackdrop = document.getElementById('checkout-modal-backdrop');
  if (!modalBackdrop) return;

  const cart = store.getCart();
  if (cart.length === 0) {
    window.showToast?.('Your bag is empty. Add a kit first!', 'error');
    return;
  }

  // Reset to Step 1
  currentCheckoutStep = 1;
  const step1Box = document.getElementById('checkout-step-1');
  const step2Box = document.getElementById('checkout-step-2');
  const stepNav1 = document.getElementById('step-nav-1');
  const stepNav2 = document.getElementById('step-nav-2');

  if (step1Box) step1Box.style.display = 'block';
  if (step2Box) step2Box.style.display = 'none';
  if (stepNav1) {
    stepNav1.classList.add('active');
    stepNav1.classList.remove('completed');
  }
  if (stepNav2) stepNav2.classList.remove('active');

  const formSection = document.getElementById('checkout-form-section');
  const confirmSection = document.getElementById('checkout-confirmation-section');
  if (formSection) formSection.style.display = 'block';
  if (confirmSection) confirmSection.style.display = 'none';

  // Auto-populate logged-in customer info if available
  const customer = auth.getCurrentCustomer();
  if (customer) {
    const nameEl = document.getElementById('checkout-name');
    const emailEl = document.getElementById('checkout-email');
    const phoneEl = document.getElementById('checkout-phone');
    const addressEl = document.getElementById('checkout-address');
    const cityEl = document.getElementById('checkout-city');
    const postalEl = document.getElementById('checkout-postal');

    if (nameEl && !nameEl.value) nameEl.value = customer.name || '';
    if (emailEl && !emailEl.value) emailEl.value = customer.email || '';
    if (phoneEl && !phoneEl.value) phoneEl.value = customer.phone || '';
    if (addressEl && !addressEl.value) addressEl.value = customer.address || '';
    if (cityEl && !cityEl.value) cityEl.value = customer.city || 'Pasig City';
    if (postalEl && !postalEl.value) postalEl.value = customer.postalCode || '1600';
  }

  renderCheckoutOrderSummary();
  renderCheckoutPaymentMethods();

  modalBackdrop.classList.add('open');
}

window.openCheckoutModal = openCheckoutModal;

export function closeCheckoutModal() {
  const modalBackdrop = document.getElementById('checkout-modal-backdrop');
  if (modalBackdrop) modalBackdrop.classList.remove('open');
}

function renderCheckoutOrderSummary() {
  const summary = store.getCartSummary();
  const summaryEl = document.getElementById('checkout-summary-breakdown');
  if (!summaryEl) return;

  summaryEl.innerHTML = `
    <div style="background: var(--bg-surface-elevated); padding: 0.85rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); margin-bottom: 1.25rem;">
      <div class="cart-summary-line">
        <span>Jerseys (${summary.totalItems}):</span>
        <span>${store.formatPrice(summary.subtotal)}</span>
      </div>
      ${summary.discountAmount > 0 ? `
        <div class="cart-summary-line">
          <span>Promo Discount (${summary.promoCode}):</span>
          <span class="discount-val">-${store.formatPrice(summary.discountAmount)}</span>
        </div>
      ` : ''}
      <div class="cart-summary-line">
        <span>Delivery / Pickup:</span>
        <span>${summary.shipping === 0 ? 'FREE' : store.formatPrice(summary.shipping)}</span>
      </div>
      <div class="cart-summary-line total-line">
        <span>Total Due:</span>
        <span style="color: var(--accent-pitch);">${store.formatPrice(summary.finalTotal)}</span>
      </div>
    </div>
  `;

  const payBtn = document.getElementById('checkout-place-order-btn');
  if (payBtn) {
    payBtn.innerHTML = `Place Order &bull; ${store.formatPrice(summary.finalTotal)}`;
  }
}

export function renderCheckoutPaymentMethods() {
  const container = document.getElementById('checkout-payment-methods-list');
  if (!container) return;

  const methods = store.getPaymentMethods();

  if (methods.length === 0) {
    container.innerHTML = `
      <div style="padding: 1.25rem; background: var(--bg-surface-elevated); border: 1px dashed var(--border-medium); border-radius: var(--radius-sm); text-align: center; color: var(--text-muted); font-size: 0.85rem;">
        <p style="margin: 0 0 0.4rem; color: var(--text-primary); font-weight: 600;">No payment options saved to your account yet.</p>
        <p style="margin: 0; font-size: 0.78rem;">Click <strong>"+ Add or Use Another Payment Option"</strong> below to save GCash, Maya, or Card to your account.</p>
      </div>
    `;
    selectedPaymentMethodId = null;
    updatePaymentCalloutText();
    return;
  }

  if (!selectedPaymentMethodId || !methods.some(m => m.id === selectedPaymentMethodId)) {
    const defaultMethod = methods.find(m => m.isDefault) || methods[0];
    selectedPaymentMethodId = defaultMethod ? defaultMethod.id : null;
  }

  container.innerHTML = methods.map(pm => {
    const isSelected = pm.id === selectedPaymentMethodId;
    const badgeClass = pm.type === 'gcash' ? 'pm-icon-gcash' : 
                       pm.type === 'maya' ? 'pm-icon-maya' : 
                       pm.type === 'bdo' ? 'pm-icon-bdo' : 
                       pm.type === 'pickup' ? 'pm-icon-pickup' : 'pm-icon-card';
    const badgeText = pm.badgeText || (pm.type === 'gcash' ? 'GCASH' : pm.type === 'maya' ? 'MAYA' : pm.type === 'bdo' ? 'BDO' : 'CARD');
    const title = pm.brand || (pm.type === 'gcash' ? 'GCash' : pm.type === 'maya' ? 'Maya' : 'Credit Card');
    const sub = pm.accountNumber || (pm.last4 ? `•••• ${pm.last4}` : pm.accountName);

    return `
      <div class="payment-method-card ${isSelected ? 'selected' : ''}" data-pm-id="${pm.id}">
        <div class="pm-left">
          <input type="radio" class="pm-radio" name="checkout_pm" value="${pm.id}" ${isSelected ? 'checked' : ''}>
          <div class="pm-icon-badge ${badgeClass}">${badgeText}</div>
          <div class="pm-details">
            <span class="pm-title">${title}</span>
            <span class="pm-sub">${sub}</span>
          </div>
        </div>
        ${pm.isDefault ? '<span class="pm-default-tag">Default</span>' : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('.payment-method-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedPaymentMethodId = card.dataset.pmId;
      renderCheckoutPaymentMethods();
      updatePaymentCalloutText();
    });
  });

  updatePaymentCalloutText();
}

function updatePaymentCalloutText() {
  const callout = document.getElementById('ph-payment-callout');
  if (!callout) return;

  const methods = store.getPaymentMethods();
  const pm = methods.find(m => m.id === selectedPaymentMethodId) || methods[0];

  if (!pm) return;

  if (pm.type === 'gcash') {
    callout.innerHTML = `
      <div><strong>🇵🇭 GCash Mobile Wallet:</strong></div>
      <div>Send payment to <strong>0917-555-1201 (100201 Football Shop)</strong>. Your order is registered immediately and heat-press dispatch begins upon confirmation.</div>
    `;
  } else if (pm.type === 'maya') {
    callout.innerHTML = `
      <div><strong>🇵🇭 Maya (PayMaya):</strong></div>
      <div>Send payment via Maya wallet to <strong>0917-555-1201 (100201 Football Shop)</strong>. Instant SMS receipt provided.</div>
    `;
  } else if (pm.type === 'bdo') {
    callout.innerHTML = `
      <div><strong>🇵🇭 BDO Bank Transfer:</strong></div>
      <div>Account Number: <strong>0041-8890-2101</strong> &bull; Account Name: <strong>100201 SPORTS</strong>. Upload your transaction slip for fast clearance.</div>
    `;
  } else if (pm.type === 'pickup') {
    callout.innerHTML = `
      <div><strong>📍 Cash on Store Pick-up:</strong></div>
      <div>Pay in cash or GCash at our store collection desk in Ortigas Center upon inspecting your kit.</div>
    `;
  } else {
    callout.innerHTML = `
      <div><strong>🔒 Secure Card Settlement:</strong></div>
      <div>Visa, Mastercard, or JCB protected by 256-bit tokenized gateway.</div>
    `;
  }
}

function handlePlaceOrder(e) {
  e.preventDefault();

  if (isPlacingOrder) {
    console.warn('[Cart] Order placement already in progress.');
    return;
  }

  const cart = store.getCart();
  if (cart.length === 0) {
    window.showToast?.('Bag is empty', 'error');
    return;
  }

  const summary = store.getCartSummary();

  // 1. Spending Cap Validation
  if (summary.finalTotal > MAX_ORDER_AMOUNT_PHP) {
    window.showToast?.(`Order total exceeds spending cap of ${store.formatPrice(MAX_ORDER_AMOUNT_PHP)}`, 'error');
    return;
  }

  if (summary.totalItems > MAX_ORDER_ITEMS) {
    window.showToast?.(`Order exceeds maximum allowed quantity of ${MAX_ORDER_ITEMS} kits`, 'error');
    return;
  }

  // 2. Anti-Bot CAPTCHA Verification
  if (checkoutCaptcha && !checkoutCaptcha.validate()) {
    window.showToast?.('Please enter the 4-character security verification code.', 'warning');
    return;
  }

  const newPmBox = document.getElementById('checkout-new-pm-box');
  const isAddingNewPm = newPmBox && !newPmBox.classList.contains('collapsed');

  let chosenPaymentMethod = null;

  if (isAddingNewPm) {
    const pmType = document.getElementById('new-pm-type')?.value || 'gcash';
    const accountName = document.getElementById('new-card-holder')?.value.trim();
    const accountNumber = document.getElementById('new-card-number')?.value.trim();
    const saveAsDefault = document.getElementById('new-card-save-default')?.checked;

    if (!accountName || !accountNumber) {
      window.showToast?.('Please fill in complete payment details', 'error');
      return;
    }

    const brandName = pmType === 'gcash' ? 'GCash' : pmType === 'maya' ? 'Maya' : pmType === 'bdo' ? 'BDO Bank' : 'Visa Card';
    const newPm = store.addPaymentMethod({
      type: pmType,
      brand: brandName,
      accountName,
      accountNumber,
      isDefault: saveAsDefault
    });

    chosenPaymentMethod = {
      type: pmType,
      brand: brandName,
      last4: accountNumber.slice(-4)
    };
    if (newPm) {
      selectedPaymentMethodId = newPm.id;
    }
  } else {
    const methods = store.getPaymentMethods();
    const pm = methods.find(m => m.id === selectedPaymentMethodId) || methods[0];
    if (pm) {
      chosenPaymentMethod = {
        type: pm.type,
        brand: pm.brand || 'GCash',
        last4: pm.accountNumber?.slice(-4) || pm.last4 || '0101'
      };
    } else {
      window.showToast?.('Please add a payment option (GCash, Maya, or Card) for your account', 'error');
      if (newPmBox) {
        newPmBox.classList.remove('collapsed');
        const toggleBtn = document.getElementById('checkout-toggle-add-pm-btn');
        if (toggleBtn) toggleBtn.textContent = 'Hide Payment Form';
      }
      return;
    }
  }

  const currentCust = auth.getCurrentCustomer();
  const customer = {
    name: document.getElementById('checkout-name')?.value.trim() || currentCust?.name || 'Football Fan',
    email: document.getElementById('checkout-email')?.value.trim() || currentCust?.email || 'customer@100201footballshop.ph',
    phone: document.getElementById('checkout-phone')?.value.trim() || currentCust?.phone || '+63 917 555 1201',
    address: document.getElementById('checkout-address')?.value.trim() || currentCust?.address || 'Store Counter Collection',
    city: document.getElementById('checkout-city')?.value.trim() || currentCust?.city || 'Pasig City',
    postalCode: document.getElementById('checkout-postal')?.value.trim() || currentCust?.postalCode || '1605',
    country: 'Philippines',
    fulfillmentMode
  };

  const placeOrderBtn = document.getElementById('checkout-place-order-btn');
  const originalBtnContent = placeOrderBtn ? placeOrderBtn.innerHTML : 'Place Order';

  // Lock UI to prevent duplicate payment / duplicate submissions
  isPlacingOrder = true;
  if (placeOrderBtn) {
    placeOrderBtn.disabled = true;
    placeOrderBtn.classList.add('is-loading');
    placeOrderBtn.innerHTML = '<span class="button-spinner"></span> Processing Order...';
  }

  try {
    const newOrder = store.createOrder({
      customer,
      items: cart,
      summary,
      paymentMethod: chosenPaymentMethod
    });

    isPlacingOrder = false;
    if (placeOrderBtn) {
      placeOrderBtn.disabled = false;
      placeOrderBtn.classList.remove('is-loading');
      placeOrderBtn.innerHTML = originalBtnContent;
    }

    registerUserOrder(newOrder.id);
    showOrderConfirmationScreen(newOrder);
  } catch (err) {
    isPlacingOrder = false;
    if (placeOrderBtn) {
      placeOrderBtn.disabled = false;
      placeOrderBtn.classList.remove('is-loading');
      placeOrderBtn.innerHTML = originalBtnContent;
    }
    window.showToast?.(err.message || 'Failed to place order. Please try again.', 'error');
  }
}

function showOrderConfirmationScreen(order) {
  const formSection = document.getElementById('checkout-form-section');
  const confirmSection = document.getElementById('checkout-confirmation-section');
  if (formSection) formSection.style.display = 'none';
  if (!confirmSection) return;

  const isUserAuth = auth.isCustomerLoggedIn() || auth.isMerchantLoggedIn();

  confirmSection.style.display = 'block';
  confirmSection.innerHTML = `
    <div class="order-confirmation-box">
      <div class="confirmation-check-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <h2 style="font-size: 1.6rem; margin-bottom: 0.5rem; color: #FFFFFF;">Order Placed Successfully!</h2>
      <p style="font-size: 0.9rem; max-width: 440px; margin: 0 auto 1.25rem; color: var(--text-secondary);">
        Thank you, <strong>${order.customer.name}</strong>. Your ${order.items.length} kit order is registered for 100201 dispatch processing.
      </p>

      <div class="order-id-badge">${order.id}</div>

      <div class="confirmation-next-steps">
        <h5>Fulfillment & Tracking Summary</h5>
        <div style="font-size: 0.88rem; color: var(--text-primary); font-weight: 600; margin-bottom: 0.4rem;">
          ${order.customer.address}, ${order.customer.city}
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">
          Carrier: <strong>${order.carrier}</strong> &bull; Waybill: <code>${order.trackingNumber}</code>
        </div>
      </div>

      <div style="display: flex; gap: 0.75rem; justify-content: center; margin-top: 2rem;">
        ${isUserAuth ? `
          <button id="track-order-direct-btn" class="btn btn-primary" data-order-id="${order.id}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            Track Shipment Live
          </button>
        ` : ''}
        <button id="finish-checkout-btn" class="${isUserAuth ? 'btn btn-secondary' : 'btn btn-primary'}">
          Continue Shopping
        </button>
      </div>
    </div>
  `;

  document.getElementById('track-order-direct-btn')?.addEventListener('click', (e) => {
    const orderId = e.currentTarget.dataset.orderId;
    closeCheckoutModal();
    window.navigateToView?.('tracker', orderId);
  });

  document.getElementById('finish-checkout-btn')?.addEventListener('click', () => {
    closeCheckoutModal();
    window.navigateToView?.('storefront');
  });
}
