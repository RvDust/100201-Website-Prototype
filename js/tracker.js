// Order Tracking Controller for 100201 Football Shop
// Strictly account-specific tracking with multi-order switcher & separate completed order history

import { store } from './store.js';
import { auth } from './auth.js';

let activeTrackingOrderId = null;

export function registerUserOrder(orderId) {
  // Handled transparently by store.createOrder customer email linking
  if (!orderId) return;
}

export function isOrderCompleted(order) {
  if (!order || !order.status) return false;
  const s = order.status.trim().toLowerCase();
  return s === 'delivered' || s === 'completed' || s.includes('delivered') || s.includes('picked up');
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
          window.navigateToView?.(prevView);
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
            Your Active Shipments (${activeOrders.length}):
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
  const stages = [
    { key: 'Order Confirmed', title: 'Order Confirmed', icon: 'check-circle' },
    { key: 'Processing & Custom Printing', title: 'Processing & Printing', icon: 'tool' },
    { key: 'Shipped', title: 'Shipped', icon: 'truck' },
    { key: 'Out for Delivery', title: 'Out for Delivery', icon: 'map-pin' },
    { key: 'Delivered', title: 'Delivered / Picked Up', icon: 'package' }
  ];

  let currentStageIndex = stages.findIndex(s => s.key.toLowerCase() === order.status.toLowerCase());
  if (currentStageIndex === -1 && order.status.toLowerCase().includes('processing')) currentStageIndex = 1;
  if (currentStageIndex === -1 && order.status.toLowerCase().includes('shipped')) currentStageIndex = 2;
  if (currentStageIndex === -1 && order.status.toLowerCase().includes('out')) currentStageIndex = 3;
  if (currentStageIndex === -1 && isDelivered) currentStageIndex = 4;
  if (currentStageIndex === -1) currentStageIndex = 0;

  const progressPct = (currentStageIndex / (stages.length - 1)) * 100;

  container.innerHTML = `
    <div class="order-tracking-card ${isDelivered ? 'card-status-completed' : ''}">
      <div class="order-top-banner">
        <div class="order-meta-group">
          <div class="order-meta-id">
            <span>${order.id}</span>
            <span class="badge ${isDelivered ? 'badge-status-delivered' : 'badge-status-out-for-delivery'}">
              ${isDelivered ? `✓ ${order.status}` : order.status}
            </span>
          </div>
          <div class="order-meta-date">
            Placed on ${new Date(order.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            &bull; Fulfillment: <strong>${order.estimatedDelivery || (isDelivered ? 'Delivered & Received' : 'In Transit to Recipient')}</strong>
          </div>
        </div>

        <div style="display: flex; gap: 0.75rem; align-items: center;">
          <button class="btn btn-secondary btn-sm" id="admin-switch-from-tracker-btn" title="Update status in Admin Portal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Edit in Admin
          </button>
        </div>
      </div>

      <!-- Live 5-Stage Stepper -->
      <div class="tracking-pipeline">
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
          <div class="order-side-title">Delivery / Collection Address</div>
          <div class="order-address-box">
            <strong>${order.customer.name}</strong><br>
            ${order.customer.address}<br>
            ${order.customer.city} ${order.customer.postalCode}, ${order.customer.country}<br>
            Contact: ${order.customer.phone}
          </div>

          <div class="order-side-title">Payment Method</div>
          <div class="order-address-box" style="margin-bottom: 0;">
            <strong>${order.paymentMethod?.brand || 'GCash'}</strong> (${order.paymentMethod?.last4 || 'Direct'})<br>
            Total Paid: <strong style="color:var(--accent-pitch); font-family:var(--font-display); font-size:1.1rem;">${store.formatPrice(order.total)}</strong>
          </div>
        </div>
      </div>
    </div>
  `;

  const copyBtn = document.getElementById('copy-tracking-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const code = copyBtn.dataset.code;
      navigator.clipboard?.writeText(code).then(() => {
        window.showToast?.(`Tracking code ${code} copied!`, 'info');
      }).catch(() => {
        window.showToast?.(`Tracking code: ${code}`, 'info');
      });
    });
  }

  const adminSwitchBtn = document.getElementById('admin-switch-from-tracker-btn');
  if (adminSwitchBtn) {
    adminSwitchBtn.addEventListener('click', () => {
      window.navigateToView?.('admin');
      setTimeout(() => {
        document.querySelector('.admin-tab-btn[data-admin-tab="orders"]')?.click();
      }, 50);
    });
  }
}

function renderOrderHistoryList(container, completedOrders) {
  container.innerHTML = completedOrders.map(order => {
    const placedDateStr = new Date(order.date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    const deliveredStep = order.timeline?.find(t => t.status.toLowerCase().includes('deliver'));
    const deliveredTimeStr = deliveredStep?.timestamp || placedDateStr;

    return `
      <div class="order-history-card" data-order-id="${order.id}">
        <div class="order-history-card-header">
          <div class="order-history-id-block">
            <span class="order-history-id">${order.id}</span>
            <span class="badge badge-status-delivered">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline-block; vertical-align:middle; margin-right:4px;">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Delivered
            </span>
          </div>

          <div class="order-history-meta-block">
            <div class="order-history-date">
              <span>Delivered: <strong>${deliveredTimeStr}</strong></span>
              <span class="meta-dot">&bull;</span>
              <span>Placed: ${placedDateStr}</span>
            </div>
            <div class="order-history-total">
              ${store.formatPrice(order.total)}
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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
            <span>${order.carrier} &bull; Waybill: <code>${order.trackingNumber}</code></span>
          </div>

          <div class="order-history-actions">
            <button class="btn btn-secondary btn-sm copy-history-tracking-btn" data-code="${order.trackingNumber}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy Waybill
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
        window.showToast?.(`Tracking code ${code} copied!`, 'info');
      }).catch(() => {
        window.showToast?.(`Tracking code: ${code}`, 'info');
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
    case 'package':
    default:
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;
  }
}
