// Order Tracking Controller for 100201 Football Shop
// Strictly account-specific tracking with multi-order switcher & separate completed order history

import { store, isPickupOrder } from './store.js';
import { auth } from './auth.js';

let activeTrackingOrderId = null;

export function registerUserOrder(orderId) {
  // Handled transparently by store.createOrder customer email linking
  if (!orderId) return;
}

export function isOrderCompleted(order) {
  if (!order || !order.status) return false;
  const s = order.status.trim().toLowerCase();
  return s === 'delivered' || s === 'completed' || s.includes('delivered') || s.includes('picked up') || s.includes('collected');
}

export function getUserOrders() {
  const allOrders = store.getOrders();
  const currentCustomer = typeof auth !== 'undefined' ? auth.getCurrentCustomer() : null;

  // Track order is strictly specific to each logged-in account
  if (!currentCustomer || !currentCustomer.email) {
    return [];
  }

  const customerEmail = currentCustomer.email.trim().toLowerCase();

  return allOrders.filter(order => {
    if (order.customer?.email && order.customer.email.trim().toLowerCase() === customerEmail) {
      return true;
    }
    if (order.customer?.id && currentCustomer.id && order.customer.id === currentCustomer.id) {
      return true;
    }
    return false;
  });
}

export function initTracker() {
  setupTrackerEventListeners();

  store.subscribe('orders', () => {
    renderTracker();
  });

  store.subscribe('currency', () => {
    renderTracker();
  });

  if (typeof auth !== 'undefined' && auth.subscribe) {
    auth.subscribe(() => {
      // Re-evaluate active order when customer login changes
      const userOrders = getUserOrders();
      if (!userOrders.some(o => o.id === activeTrackingOrderId)) {
        activeTrackingOrderId = userOrders[0]?.id || null;
      }
      renderTracker();
    });
  }
}

function setupTrackerEventListeners() {
  const searchBtn = document.getElementById('tracker-search-btn');
  const searchInput = document.getElementById('tracker-search-input');

  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
      const orderId = searchInput.value.trim();
      if (orderId) trackOrder(orderId);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const orderId = searchInput.value.trim();
        if (orderId) trackOrder(orderId);
      }
    });
  }
}

export function trackOrder(orderId) {
  if (!orderId) return;
  const cleanId = orderId.trim().toUpperCase();
  const currentCustomer = typeof auth !== 'undefined' ? auth.getCurrentCustomer() : null;
  const isMerchant = typeof auth !== 'undefined' ? auth.isMerchantLoggedIn() : false;

  // Track order requires an authenticated account
  if (!currentCustomer && !isMerchant) {
    window.showToast?.('Please sign in to track your orders.', 'info');
    if (typeof window.openCustomerAuthModal === 'function') {
      const prevView = store.getView() || 'storefront';
      window.openCustomerAuthModal(
        'account',
        () => {
          trackOrder(cleanId);
        },
        () => {
          window.navigateToView?.('storefront');
        }
      );
    }
    return;
  }

  const order = store.getOrderById(cleanId);
  if (!order) {
    activeTrackingOrderId = cleanId;
    renderTracker();
    return;
  }

  // Security & Account isolation: Ensure order belongs to this customer account (merchants can view all)
  if (!isMerchant && currentCustomer) {
    const customerEmail = currentCustomer.email ? currentCustomer.email.trim().toLowerCase() : '';
    const isOwner = (order.customer?.email && order.customer.email.trim().toLowerCase() === customerEmail) ||
                    (order.customer?.id && currentCustomer.id && order.customer.id === currentCustomer.id);

    if (!isOwner) {
      window.showToast?.(`Order ${cleanId} is not associated with your account.`, 'warning');
      return;
    }
  }

  activeTrackingOrderId = cleanId;
  const searchInput = document.getElementById('tracker-search-input');
  if (searchInput) searchInput.value = cleanId;
  renderTracker();
}

export function renderTracker() {
  const container = document.getElementById('tracker-display-container');
  const recentBar = document.getElementById('tracker-recent-orders-bar');
  const historySection = document.getElementById('tracker-order-history-section');
  const historyList = document.getElementById('order-history-list');
  const historyBadge = document.getElementById('order-history-count-badge');
  if (!container) return;

  const currentCustomer = typeof auth !== 'undefined' ? auth.getCurrentCustomer() : null;
  const isMerchant = typeof auth !== 'undefined' ? auth.isMerchantLoggedIn() : false;

  // If user is not logged in, gate tracking view
  if (!currentCustomer && !isMerchant) {
    if (recentBar) recentBar.style.display = 'none';
    if (historySection) historySection.style.display = 'none';
    container.innerHTML = `
      <div class="tracker-empty-card">
        <div class="tracker-empty-icon-wrap">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <h3>Account Sign In Required</h3>
        <p>Order tracking and delivery history are secured and specific to each customer account.</p>
        <div style="margin-top: 1.5rem; display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
          <button class="btn btn-primary btn-sm" onclick="window.openCustomerAuthModal('account', () => window.navigateToView('tracker'), () => window.navigateToView('storefront'))">
            Sign In to Your Account
          </button>
          <button class="btn btn-secondary btn-sm" onclick="window.navigateToView('storefront')">
            Return to Store
          </button>
        </div>
      </div>
    `;
    return;
  }

  // Account-specific orders
  const userOrders = isMerchant ? store.getOrders() : getUserOrders();
  const activeOrders = userOrders.filter(o => !isOrderCompleted(o));
  const completedOrders = userOrders.filter(o => isOrderCompleted(o));

  // 1. SHIPMENT SWITCHER:
  // Hide option to see other shipments. ONLY available if the user has MULTIPLE active orders!
  if (recentBar) {
    if (activeOrders.length > 1) {
      recentBar.style.display = 'flex';
      recentBar.innerHTML = `
        <div class="user-shipments-wrapper">
          <span class="user-shipments-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
            Your Active Orders (${activeOrders.length}):
          </span>
          <div class="user-shipments-pills">
            ${activeOrders.map(o => `
              <button class="recent-order-pill ${o.id === activeTrackingOrderId ? 'active' : ''}" data-order-id="${o.id}">
                ${o.id} &bull; ${o.status}
              </button>
            `).join('')}
          </div>
        </div>
      `;

      recentBar.querySelectorAll('.recent-order-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          trackOrder(btn.dataset.orderId);
        });
      });
    } else {
      // 0 or 1 active order: completely hide switcher (no option to see other shipments)
      recentBar.style.display = 'none';
      recentBar.innerHTML = '';
    }
  }

  // 2. Select active order to display
  if (!activeTrackingOrderId || !userOrders.some(o => o.id === activeTrackingOrderId)) {
    if (activeOrders.length > 0) {
      activeTrackingOrderId = activeOrders[0].id;
    } else if (completedOrders.length > 0) {
      activeTrackingOrderId = completedOrders[0].id;
    } else {
      activeTrackingOrderId = null;
    }
  }

  const order = activeTrackingOrderId ? store.getOrderById(activeTrackingOrderId) : null;

  // 3. Render Top Live Tracking Card
  if (!order) {
    if (userOrders.length === 0) {
      container.innerHTML = `
        <div class="tracker-empty-card">
          <div class="tracker-empty-icon-wrap">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
          </div>
          <h3>No Orders Found for Your Account</h3>
          <p>You have no active or completed orders under <strong>${currentCustomer?.email || 'this account'}</strong>.</p>
          <div style="margin-top: 1.5rem;">
            <button class="btn btn-primary btn-sm" onclick="window.navigateToView('storefront')">Browse Football Kits</button>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="tracker-empty-card">
          <h3>Order "${activeTrackingOrderId}" Not Found</h3>
          <p>This order ID was not found under your account records.</p>
        </div>
      `;
    }
  } else {
    renderActiveOrderCard(container, order);
  }

  // 4. Render SEPARATE CONTAINER for Order History (Completed Deliveries for this Account)
  if (historySection && historyList) {
    if (completedOrders.length > 0) {
      historySection.style.display = 'block';
      if (historyBadge) {
        historyBadge.textContent = `${completedOrders.length} Completed ${completedOrders.length === 1 ? 'Order' : 'Orders'}`;
      }
      renderOrderHistoryList(historyList, completedOrders);
    } else {
      historySection.style.display = 'none';
      historyList.innerHTML = '';
    }
  }
}

function renderActiveOrderCard(container, order) {
  const isDelivered = isOrderCompleted(order);
  const isPickup = isPickupOrder(order);

  const stages = isPickup ? [
    { key: 'Order Confirmed', title: 'Order Confirmed', icon: 'check-circle' },
    { key: 'Processing & Custom Printing', title: 'Processing & Printing', icon: 'tool' },
    { key: 'Ready for Pick-up', title: 'Ready for Pick-up', icon: 'shopping-bag' },
    { key: 'Picked Up', title: 'Picked Up', icon: 'package' }
  ] : [
    { key: 'Order Confirmed', title: 'Order Confirmed', icon: 'check-circle' },
    { key: 'Processing & Custom Printing', title: 'Processing & Printing', icon: 'tool' },
    { key: 'Shipped', title: 'Shipped', icon: 'truck' },
    { key: 'Out for Delivery', title: 'Out for Delivery', icon: 'map-pin' },
    { key: 'Delivered', title: 'Delivered / Received', icon: 'package' }
  ];

  let currentStageIndex = -1;
  const statusLower = (order.status || '').toLowerCase();

  if (isPickup) {
    currentStageIndex = stages.findIndex(s => s.key.toLowerCase() === statusLower);
    if (currentStageIndex === -1 && (statusLower.includes('process') || statusLower.includes('print'))) currentStageIndex = 1;
    if (currentStageIndex === -1 && (statusLower.includes('ready') || statusLower.includes('shipped') || statusLower.includes('out'))) currentStageIndex = 2;
    if (currentStageIndex === -1 && isDelivered) currentStageIndex = 3;
    if (currentStageIndex === -1) currentStageIndex = 0;
  } else {
    currentStageIndex = stages.findIndex(s => s.key.toLowerCase() === statusLower);
    if (currentStageIndex === -1 && statusLower.includes('processing')) currentStageIndex = 1;
    if (currentStageIndex === -1 && statusLower.includes('shipped')) currentStageIndex = 2;
    if (currentStageIndex === -1 && statusLower.includes('out')) currentStageIndex = 3;
    if (currentStageIndex === -1 && isDelivered) currentStageIndex = 4;
    if (currentStageIndex === -1) currentStageIndex = 0;
  }

  const progressPct = stages.length > 1 ? (currentStageIndex / (stages.length - 1)) * 100 : 0;

  // Status badge style
  let badgeClass = 'badge-status-out-for-delivery';
  let badgeText = order.status;
  if (isDelivered) {
    badgeClass = 'badge-status-delivered';
    badgeText = isPickup ? '✓ Picked Up' : `✓ ${order.status}`;
  } else if (isPickup && (statusLower.includes('ready') || currentStageIndex === 2)) {
    badgeClass = 'badge-status-ready-pickup';
    badgeText = '🛍️ Ready for Pick-up';
  }

  const fulfillmentNote = isPickup
    ? (isDelivered ? 'Claimed & Picked Up at Store Counter' : (order.estimatedDelivery || 'Ready for Pick-up in 1-2 Hours (Same-Day Collection)'))
    : (order.estimatedDelivery || (isDelivered ? 'Delivered & Received' : 'In Transit to Recipient'));

  container.innerHTML = `
    <div class="order-tracking-card ${isDelivered ? 'card-status-completed' : ''}">
      <div class="order-top-banner">
        <div class="order-meta-group">
          <div class="order-meta-id">
            <span>${order.id}</span>
            <span class="badge ${badgeClass}">
              ${badgeText}
            </span>
            ${isPickup ? '<span class="order-type-chip">IN-STORE PICK-UP</span>' : '<span class="order-type-chip delivery-chip">COURIER DELIVERY</span>'}
          </div>
          <div class="order-meta-date">
            Placed on ${new Date(order.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            &bull; Fulfillment: <strong>${fulfillmentNote}</strong>
          </div>
        </div>
      </div>

      <!-- Live Pipeline Stepper (${stages.length} Stages) -->
      <div class="tracking-pipeline ${isPickup ? 'tracking-pipeline-pickup' : ''}">
        <div class="pipeline-track">
          <div class="pipeline-progress-fill" style="width: ${progressPct}%"></div>
        </div>
        <div class="pipeline-steps">
          ${stages.map((stage, idx) => {
            const isCompleted = idx <= currentStageIndex;
            const isCurrent = idx === currentStageIndex;
            const timelineItem = order.timeline?.[idx];

            return `
              <div class="pipeline-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}">
                <div class="step-node">
                  ${getStageSvgIcon(stage.icon)}
                </div>
                <div class="step-title">${stage.title}</div>
                <div class="step-timestamp">${timelineItem?.timestamp ? timelineItem.timestamp.slice(-5) : (isCompleted ? 'Done' : 'Pending')}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Carrier & Dispatch Box -->
      ${isPickup ? `
        <div class="carrier-dispatch-box carrier-dispatch-box-pickup">
          <div class="dispatch-left">
            <div class="carrier-icon carrier-icon-pickup">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </div>
            <div class="carrier-info">
              <h4>${order.carrier || '100201 Store Pick-up Counter'}</h4>
              <p>Claim Code: <code>${order.trackingNumber}</code> &bull; Location: Ortigas Center, Pasig City</p>
            </div>
          </div>
          <button class="tracking-copy-btn" id="copy-tracking-btn" data-code="${order.trackingNumber}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy Claim Code
          </button>
        </div>

        <div class="pickup-guidance-card">
          <div class="pickup-guidance-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </div>
          <div class="pickup-guidance-content">
            <div class="pickup-guidance-title">Store Pick-up Counter Instructions</div>
            <div class="pickup-guidance-desc">
              Please present your Claim Code <strong>${order.trackingNumber}</strong> along with a valid ID at the 100201 store counter.
              <div style="margin-top: 0.35rem; color: var(--text-muted); font-size: 0.8rem;">
                Store Hours: <strong>Mon &ndash; Sat 10:00 AM &ndash; 8:00 PM</strong> &bull; Direct hotline: <strong>+63 917 555 1201</strong>
              </div>
            </div>
          </div>
        </div>
      ` : `
        <div class="carrier-dispatch-box">
          <div class="dispatch-left">
            <div class="carrier-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
            </div>
            <div class="carrier-info">
              <h4>${order.carrier}</h4>
              <p>Tracking Code: <code>${order.trackingNumber}</code> &bull; Origin: Store Dispatch Logistics</p>
            </div>
          </div>
          <button class="tracking-copy-btn" id="copy-tracking-btn" data-code="${order.trackingNumber}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy Tracking #
          </button>
        </div>
      `}

      <!-- Split details: Ordered Items + Recipient & Payment -->
      <div class="order-details-split">
        <div>
          <h4 class="ordered-items-title">Kit Contents (${order.items.length})</h4>
          <div class="order-items-compact-list">
            ${order.items.map(item => `
              <div class="order-item-compact">
                <img src="${item.image}" alt="${item.name}" onerror="this.src='https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?auto=format&fit=crop&w=800&q=80'">
                <div class="order-item-compact-info">
                  <div class="order-item-compact-name">${item.name}</div>
                  <div class="order-item-compact-meta">
                    Size: <strong>${item.size}</strong> &bull; Qty: ${item.quantity}
                    ${item.customization ? `&bull; Print: <span style="color:var(--accent-gold); font-weight:700;">${item.customization}</span>` : ''}
                  </div>
                </div>
                <div class="order-item-compact-price">${store.formatPrice(item.price * item.quantity)}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="order-side-summary">
          <div class="order-side-title">${isPickup ? 'Store Collection Point & Claimant' : 'Delivery Address'}</div>
          <div class="order-address-box">
            ${isPickup ? `
              <div style="margin-bottom: 0.65rem;">
                <span class="pickup-location-pill">📍 In-Store Collection Point</span><br>
                <strong>100201 Football Shop Counter</strong><br>
                Unit 14B, Sapphire Tower, Ortigas Center<br>
                Pasig City 1605, Philippines
              </div>
              <div style="border-top: 1px dashed var(--border-subtle); padding-top: 0.65rem; font-size: 0.82rem; color: var(--text-secondary);">
                <strong>Claimant Name:</strong> ${order.customer.name}<br>
                <strong>Mobile Contact:</strong> ${order.customer.phone}<br>
                <strong>Email:</strong> ${order.customer.email}
              </div>
            ` : `
              <strong>${order.customer.name}</strong><br>
              ${order.customer.address}<br>
              ${order.customer.city} ${order.customer.postalCode}, ${order.customer.country}<br>
              Contact: ${order.customer.phone}
            `}
          </div>

          <div class="order-side-title">Payment Settlement</div>
          <div class="order-address-box" style="margin-bottom: 0;">
            ${order.paymentMethod?.type === 'cod' ? `
              <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.3rem;">
                <span class="pm-icon-badge pm-icon-cod" style="font-size:0.65rem; height:20px; width:36px; line-height:20px;">COD</span>
                <strong>Cash on Delivery (Courier)</strong>
              </div>
              <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.35rem;">Pay exact cash to rider upon parcel inspection</div>
              <div>${isDelivered ? 'Total Collected:' : 'Amount to Pay Rider:'} <strong style="color:var(--accent-gold); font-family:var(--font-display); font-size:1.1rem;">${store.formatPrice(order.total)}</strong></div>
            ` : order.paymentMethod?.type === 'pickup' ? `
              <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.3rem;">
                <span class="pm-icon-badge pm-icon-pickup" style="font-size:0.65rem; height:20px; width:48px; line-height:20px;">PICKUP</span>
                <strong>Payment on Pick-up</strong>
              </div>
              <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.35rem;">Pay via Cash, GCash, or Card at 100201 store desk</div>
              <div>${isDelivered ? 'Total Settled:' : 'Amount Due at Counter:'} <strong style="color:var(--accent-pitch); font-family:var(--font-display); font-size:1.1rem;">${store.formatPrice(order.total)}</strong></div>
            ` : `
              <strong>${order.paymentMethod?.brand || 'GCash Mobile'}</strong> (${order.paymentMethod?.last4 ? `•••• ${order.paymentMethod.last4}` : 'Settled'})<br>
              <div style="margin-top:0.25rem;">Total Settled: <strong style="color:var(--accent-pitch); font-family:var(--font-display); font-size:1.1rem;">${store.formatPrice(order.total)}</strong></div>
            `}
          </div>
        </div>
      </div>
    </div>
  `;

  const copyBtn = document.getElementById('copy-tracking-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const code = copyBtn.dataset.code;
      const label = isPickup ? 'Claim code' : 'Tracking code';
      navigator.clipboard?.writeText(code).then(() => {
        window.showToast?.(`${label} ${code} copied!`, 'info');
      }).catch(() => {
        window.showToast?.(`${label}: ${code}`, 'info');
      });
    });
  }
}

function renderOrderHistoryList(container, completedOrders) {
  container.innerHTML = completedOrders.map(order => {
    const isPickup = isPickupOrder(order);
    const placedDateStr = new Date(order.date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    const completedStep = order.timeline?.find(t => {
      const st = (t.status || '').toLowerCase();
      return st.includes('deliver') || st.includes('picked') || st.includes('complete');
    });
    const completedTimeStr = completedStep?.timestamp || placedDateStr;

    return `
      <div class="order-history-card" data-order-id="${order.id}">
        <div class="order-history-card-header">
          <div class="order-history-id-block">
            <span class="order-history-id">${order.id}</span>
            <span class="badge badge-status-delivered">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline-block; vertical-align:middle; margin-right:4px;">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              ${isPickup ? 'Picked Up' : 'Delivered'}
            </span>
            ${isPickup ? '<span class="order-type-chip">IN-STORE PICK-UP</span>' : '<span class="order-type-chip delivery-chip">COURIER</span>'}
          </div>

          <div class="order-history-meta-block">
            <div class="order-history-date">
              <span>${isPickup ? 'Picked Up' : 'Delivered'}: <strong>${completedTimeStr}</strong></span>
              <span class="meta-dot">&bull;</span>
              <span>Placed: ${placedDateStr}</span>
            </div>
            <div class="order-history-total">
              ${store.formatPrice(order.total)}
              <div style="font-size:0.72rem; color:var(--text-muted); font-weight:normal; text-align:right;">
                ${order.paymentMethod?.type === 'cod' ? 'COD (Paid Rider)' : order.paymentMethod?.type === 'pickup' ? 'Paid at Counter' : (order.paymentMethod?.brand || 'Paid')}
              </div>
            </div>
          </div>
        </div>

        <div class="order-history-items-row">
          ${order.items.map(item => `
            <div class="order-history-item-mini">
              <img src="${item.image}" alt="${item.name}" onerror="this.src='https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?auto=format&fit=crop&w=800&q=80'">
              <div class="order-history-item-details">
                <div class="order-history-item-name">${item.name}</div>
                <div class="order-history-item-tags">
                  <span class="history-tag">Size: ${item.size}</span>
                  <span class="history-tag">Qty: ${item.quantity}</span>
                  ${item.customization ? `<span class="history-tag history-tag-custom">${item.customization}</span>` : ''}
                </div>
              </div>
              <div class="order-history-item-price">${store.formatPrice(item.price * item.quantity)}</div>
            </div>
          `).join('')}
        </div>

        <div class="order-history-card-footer">
          <div class="order-history-courier-info">
            ${isPickup ? `
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              <span>Store Counter Collection &bull; Claim Code: <code>${order.trackingNumber}</code></span>
            ` : `
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
              <span>${order.carrier} &bull; Waybill: <code>${order.trackingNumber}</code></span>
            `}
          </div>

          <div class="order-history-actions">
            <button class="btn btn-secondary btn-sm copy-history-tracking-btn" data-code="${order.trackingNumber}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              ${isPickup ? 'Copy Claim Code' : 'Copy Waybill'}
            </button>
            <button class="btn btn-primary btn-sm view-history-timeline-btn" data-order-id="${order.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              View Full Timeline
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Event Listeners
  container.querySelectorAll('.copy-history-tracking-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const code = btn.dataset.code;
      navigator.clipboard?.writeText(code).then(() => {
        window.showToast?.(`Code ${code} copied!`, 'info');
      }).catch(() => {
        window.showToast?.(`Code: ${code}`, 'info');
      });
    });
  });

  container.querySelectorAll('.view-history-timeline-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const orderId = btn.dataset.orderId;
      trackOrder(orderId);
      document.getElementById('tracker-display-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function getStageSvgIcon(iconName) {
  switch (iconName) {
    case 'check-circle':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    case 'tool':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`;
    case 'truck':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>`;
    case 'map-pin':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
    case 'shopping-bag':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`;
    case 'package':
    default:
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;
  }
}
