// Admin Management Portal Controller for 100201 Football Shop

import { store } from './store.js';
import { auth } from './auth.js';

let editingProductId = null;
let currentAdminTab = 'products';
let productSearchQuery = '';
let orderStatusFilter = 'all';
let currentModalImages = [];
let localPresetAssets = [];

export function initAdmin() {
  setupAdminEventListeners();
  renderAdminDashboard();

  auth.subscribe(() => {
    renderAdminDashboard();
  });

  store.subscribe('products', () => {
    renderAdminDashboard();
  });

  store.subscribe('orders', () => {
    renderAdminDashboard();
  });

  store.subscribe('currency', () => {
    renderAdminDashboard();
  });
}

function setupAdminEventListeners() {
  const tabBtns = document.querySelectorAll('.admin-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabBtns.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      currentAdminTab = e.currentTarget.dataset.adminTab;

      const productsSection = document.getElementById('admin-products-view');
      const ordersSection = document.getElementById('admin-orders-view');

      if (currentAdminTab === 'products') {
        if (productsSection) productsSection.style.display = 'block';
        if (ordersSection) ordersSection.style.display = 'none';
      } else {
        if (productsSection) productsSection.style.display = 'none';
        if (ordersSection) ordersSection.style.display = 'block';
      }
    });
  });

  const gateBackLink = document.getElementById('merchant-gate-back-link');
  if (gateBackLink) {
    gateBackLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.navigateToView?.('storefront');
    });
  }

  const prodSearch = document.getElementById('admin-prod-search');
  if (prodSearch) {
    prodSearch.addEventListener('input', (e) => {
      productSearchQuery = e.target.value.toLowerCase().trim();
      renderProductsTable();
    });
  }

  const orderFilter = document.getElementById('admin-order-status-filter');
  if (orderFilter) {
    orderFilter.addEventListener('change', (e) => {
      orderStatusFilter = e.target.value;
      renderOrdersTable();
    });
  }

  const addProdBtn = document.getElementById('admin-add-product-btn');
  if (addProdBtn) {
    addProdBtn.addEventListener('click', () => openProductModal(null));
  }

  const closeProdModalBtn = document.getElementById('close-product-modal-btn');
  const cancelProdModalBtn = document.getElementById('cancel-product-modal-btn');
  const prodModalBackdrop = document.getElementById('product-modal-backdrop');

  if (closeProdModalBtn) closeProdModalBtn.addEventListener('click', closeProductModal);
  if (cancelProdModalBtn) cancelProdModalBtn.addEventListener('click', closeProductModal);
  if (prodModalBackdrop) {
    prodModalBackdrop.addEventListener('click', (e) => {
      if (e.target === prodModalBackdrop) closeProductModal();
    });
  }

  const prodForm = document.getElementById('product-crud-form');
  if (prodForm) {
    prodForm.addEventListener('submit', handleSaveProduct);
  }

  const imgUrlInput = document.getElementById('crud-img-url');
  const imgPreview = document.getElementById('crud-img-preview');
  if (imgUrlInput && imgPreview) {
    imgUrlInput.addEventListener('input', (e) => {
      imgPreview.src = e.target.value || 'assets/logo.jpg';
    });
  }

  // Live dynamic stock recalculation listeners
  ['crud-stock-s', 'crud-stock-m', 'crud-stock-l', 'crud-stock-xl', 'crud-stock-xxl'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', updateCrudTotalStock);
    }
  });

  // Live preset photography search filter listener
  const presetSearchInput = document.getElementById('preset-search-input');
  if (presetSearchInput) {
    presetSearchInput.addEventListener('input', (e) => {
      renderPresets(e.target.value);
    });
  }

  const resetDataBtn = document.getElementById('admin-reset-data-btn');
  if (resetDataBtn) {
    resetDataBtn.addEventListener('click', () => {
      if (confirm('Reset 100201 Football Shop data back to official catalog and orders?')) {
        store.resetAllData();
        window.showToast?.('Catalog reset to 100201 showcase values', 'info');
      }
    });
  }
}

export function renderAdminDashboard() {
  const loginGate = document.getElementById('merchant-login-gate');
  const dashboardContent = document.getElementById('merchant-dashboard-content');
  const isAuth = auth.isMerchantLoggedIn();

  if (loginGate) loginGate.style.display = isAuth ? 'none' : 'flex';
  if (dashboardContent) dashboardContent.style.display = isAuth ? 'block' : 'none';
  const tickerBar = document.querySelector('.ticker-bar');
  if (tickerBar && store.getView() === 'admin') {
    tickerBar.style.display = 'none';
  }

  if (!isAuth) {
    return;
  }

  renderKpis();
  renderProductsTable();
  renderOrdersTable();
}

function renderKpis() {
  const products = store.getProducts();
  const orders = store.getOrders();

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const revenueEl = document.getElementById('kpi-revenue-val');
  if (revenueEl) revenueEl.textContent = store.formatPrice(totalRevenue);

  const ordersEl = document.getElementById('kpi-orders-val');
  if (ordersEl) ordersEl.textContent = orders.length;

  const activeOrders = orders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled');
  const activeOrdersEl = document.getElementById('kpi-active-orders-val');
  if (activeOrdersEl) activeOrdersEl.textContent = activeOrders.length;

  let lowStockCount = 0;
  products.forEach(p => {
    const hasLowSize = Object.values(p.stock || {}).some(qty => qty < 3);
    if (hasLowSize) lowStockCount++;
  });
  const lowStockEl = document.getElementById('kpi-low-stock-val');
  if (lowStockEl) lowStockEl.textContent = lowStockCount;
}

function renderProductsTable() {
  const tbody = document.getElementById('admin-products-table-body');
  if (!tbody) return;

  let products = store.getProducts();

  if (productSearchQuery) {
    products = products.filter(p =>
      p.name.toLowerCase().includes(productSearchQuery) ||
      p.club.toLowerCase().includes(productSearchQuery) ||
      p.league.toLowerCase().includes(productSearchQuery)
    );
  }

  if (products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          No products found. Click "Add New Kit" to list a jersey in 100201 Football Shop.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = products.map(kit => {
    const totalStock = Object.values(kit.stock || {}).reduce((a, b) => a + b, 0);
    const isPreOrder = kit.availability && kit.availability.toLowerCase().includes('pre-order');

    return `
      <tr data-prod-id="${kit.id}">
        <td>
          <div class="table-prod-cell">
            <img class="table-prod-img" src="${kit.image}" alt="${kit.name}" onerror="this.src='https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?auto=format&fit=crop&w=800&q=80'">
            <div>
              <div class="table-prod-name">${kit.name}</div>
              <div class="table-prod-club">${kit.club} &bull; ${kit.season}</div>
              <span class="badge ${isPreOrder ? 'badge-retro' : 'badge-new'}" style="font-size:0.65rem; margin-top:2px;">
                ${isPreOrder ? 'Pre-Order' : 'On-Hand'}
              </span>
            </div>
          </div>
        </td>
        <td>
          <span style="font-weight:600;">${kit.league}</span>
        </td>
        <td>
          <span class="badge ${kit.type === 'Retro' ? 'badge-retro' : 'badge-authentic'}">${kit.type}</span>
        </td>
        <td>
          <strong style="font-family:var(--font-display); font-size:1rem;">${store.formatPrice(kit.price)}</strong>
        </td>
        <td>
          <div class="stock-pills">
            ${['S', 'M', 'L', 'XL', 'XXL'].map(sz => {
      const q = kit.stock?.[sz] || 0;
      return `<span class="stock-tag ${q === 0 ? 'zero' : ''}">${sz}:${q}</span>`;
    }).join('')}
          </div>
        </td>
        <td>
          <strong style="color: ${totalStock < 10 ? 'var(--accent-gold)' : 'var(--accent-pitch)'}">
            ${totalStock}
          </strong>
        </td>
        <td>
          <div class="table-actions">
            <button class="icon-btn btn-sm" data-action="edit-product" data-id="${kit.id}" title="Edit Kit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="icon-btn btn-sm" data-action="delete-product" data-id="${kit.id}" title="Delete Kit" style="color: var(--accent-crimson);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-action="edit-product"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const prod = store.getProductById(btn.dataset.id);
      if (prod) openProductModal(prod);
    });
  });

  tbody.querySelectorAll('[data-action="delete-product"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const prod = store.getProductById(btn.dataset.id);
      if (prod && confirm(`Remove "${prod.name}" from 100201 catalog?`)) {
        store.deleteProduct(prod.id);
        window.showToast?.(`Deleted ${prod.name}`, 'info');
      }
    });
  });
}

function renderOrdersTable() {
  const tbody = document.getElementById('admin-orders-table-body');
  if (!tbody) return;

  let orders = store.getOrders();

  if (orderStatusFilter !== 'all') {
    orders = orders.filter(o => o.status.toLowerCase() === orderStatusFilter.toLowerCase());
  }

  if (orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          No orders found under filter "${orderStatusFilter}".
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = orders.map(order => {
    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const dateStr = new Date(order.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    return `
      <tr data-order-id="${order.id}">
        <td>
          <div style="font-family:var(--font-display); font-weight:700; color:var(--text-primary); cursor:pointer;" class="admin-order-id-link" data-id="${order.id}">
            ${order.id}
          </div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${dateStr}</div>
        </td>
        <td>
          <div style="font-weight:600;">${order.customer.name}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${order.customer.city}, ${order.customer.country}</div>
        </td>
        <td>
          <span style="font-size:0.85rem;">${itemCount} jerseys (${order.items.map(i => i.size).join(', ')})</span>
        </td>
        <td>
          <strong style="font-family:var(--font-display); font-size:1.05rem; color:var(--text-primary);">${store.formatPrice(order.total)}</strong>
          <div style="font-size:0.72rem; color:var(--text-muted);">${order.paymentMethod?.brand} &bull; ${order.paymentMethod?.last4}</div>
        </td>
        <td>
          <select class="status-dropdown-select" data-order-id="${order.id}">
            <option value="Order Confirmed" ${order.status === 'Order Confirmed' ? 'selected' : ''}>Confirmed</option>
            <option value="Processing & Custom Printing" ${order.status === 'Processing & Custom Printing' ? 'selected' : ''}>Processing</option>
            <option value="Shipped" ${order.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
            <option value="Out for Delivery" ${order.status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
            <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
            <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" data-action="track-order" data-id="${order.id}">
            Track Live
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.status-dropdown-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const orderId = e.target.dataset.orderId;
      const newStatus = e.target.value;
      store.updateOrderStatus(orderId, newStatus);
      window.showToast?.(`Order ${orderId} updated to "${newStatus}"!`, 'success');
    });
  });

  tbody.querySelectorAll('[data-action="track-order"], .admin-order-id-link').forEach(el => {
    el.addEventListener('click', () => {
      const orderId = el.dataset.id;
      window.navigateToView?.('tracker', orderId);
    });
  });
}

// --- DYNAMIC CRUD MODAL LOGIC & PRESET ASSET DISCOVERY ---

async function fetchLocalProductAssets() {
  if (localPresetAssets.length > 0) return localPresetAssets;
  try {
    const res = await fetch('/api/assets/products');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        localPresetAssets = data;
        return localPresetAssets;
      }
    }
  } catch (e) {
    console.warn('Could not fetch /api/assets/products:', e);
  }

  // Fallback to existing kit images in store
  const prods = store.getProducts();
  const collected = new Set();
  prods.forEach(p => {
    if (p.image) collected.add(p.image);
    if (Array.isArray(p.images)) p.images.forEach(img => collected.add(img));
  });
  localPresetAssets = Array.from(collected);
  return localPresetAssets;
}

function updateCrudTotalStock() {
  const s = parseInt(document.getElementById('crud-stock-s')?.value, 10) || 0;
  const m = parseInt(document.getElementById('crud-stock-m')?.value, 10) || 0;
  const l = parseInt(document.getElementById('crud-stock-l')?.value, 10) || 0;
  const xl = parseInt(document.getElementById('crud-stock-xl')?.value, 10) || 0;
  const xxl = parseInt(document.getElementById('crud-stock-xxl')?.value, 10) || 0;
  const total = s + m + l + xl + xxl;
  const badge = document.getElementById('crud-total-stock-badge');
  if (badge) {
    badge.textContent = `Total: ${total} units`;
    if (total === 0) {
      badge.style.color = 'var(--accent-crimson)';
      badge.style.background = 'rgba(239, 68, 68, 0.12)';
      badge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    } else {
      badge.style.color = 'var(--accent-pitch)';
      badge.style.background = 'rgba(34, 197, 94, 0.12)';
      badge.style.borderColor = 'rgba(34, 197, 94, 0.3)';
    }
  }
}

function populateLeagueOptions(selectedLeague = '') {
  const leagueSelect = document.getElementById('crud-league');
  if (!leagueSelect) return;

  const standardLeagues = [
    'La Liga',
    'Premier League',
    'Serie A',
    'Bundesliga',
    'Ligue 1',
    'International',
    'Brasileirao / South America',
    'Retro Classics',
    'Special Edition',
    'Other'
  ];

  const existingLeagues = store.getProducts().map(p => p.league).filter(Boolean);
  const allLeagues = Array.from(new Set([...standardLeagues, ...existingLeagues]));

  leagueSelect.innerHTML = allLeagues.map(lg => `
    <option value="${lg}" ${lg === selectedLeague ? 'selected' : ''}>${lg}</option>
  `).join('');

  if (selectedLeague && !allLeagues.includes(selectedLeague)) {
    const opt = document.createElement('option');
    opt.value = selectedLeague;
    opt.textContent = selectedLeague;
    opt.selected = true;
    leagueSelect.appendChild(opt);
  }

  if (selectedLeague) {
    leagueSelect.value = selectedLeague;
  }
}

function renderGalleryChips() {
  const container = document.getElementById('crud-gallery-chips-container');
  const countBadge = document.getElementById('crud-gallery-count-badge');
  if (!container) return;

  if (countBadge) {
    countBadge.textContent = `${currentModalImages.length} angle${currentModalImages.length === 1 ? '' : 's'}`;
  }

  const chipsHtml = currentModalImages.map((imgUrl, idx) => `
    <div class="gallery-chip" title="${imgUrl}">
      <img src="${imgUrl}" alt="Angle ${idx + 1}" onerror="this.src='assets/logo.jpg'">
      <span>Angle ${idx + 1}</span>
      <button type="button" class="gallery-chip-remove" data-index="${idx}" title="Remove this photo angle">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
  `).join('');

  container.innerHTML = `
    ${chipsHtml}
    <button type="button" class="gallery-add-chip-btn" id="crud-add-current-angle-btn">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      Add Current Photo as Angle
    </button>
  `;

  container.querySelectorAll('.gallery-chip-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index, 10);
      currentModalImages.splice(idx, 1);
      renderGalleryChips();
    });
  });

  const addBtn = document.getElementById('crud-add-current-angle-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const curImg = document.getElementById('crud-img-url')?.value?.trim();
      if (curImg && !currentModalImages.includes(curImg)) {
        currentModalImages.push(curImg);
        renderGalleryChips();
      } else if (curImg && currentModalImages.includes(curImg)) {
        window.showToast?.('This image is already in the angle gallery', 'info');
      } else {
        window.showToast?.('Please specify a jersey image URL first', 'warning');
      }
    });
  }
}

function renderPresets(filterText = '') {
  const presetContainer = document.getElementById('image-preset-picker-container');
  if (!presetContainer) return;

  const currentUrl = document.getElementById('crud-img-url')?.value?.trim();

  let filtered = localPresetAssets;
  if (filterText) {
    const q = filterText.toLowerCase().trim();
    filtered = localPresetAssets.filter(path => path.toLowerCase().includes(q));
  }

  if (filtered.length === 0) {
    presetContainer.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.78rem;">
        No 100201 photos match "${filterText}"
      </div>
    `;
    return;
  }

  presetContainer.innerHTML = filtered.map(path => {
    const filename = path.split('/').pop().replace(/\.(jpg|jpeg|png|webp)$/i, '');
    const isSelected = currentUrl === path;
    return `
      <div class="preset-thumb-btn ${isSelected ? 'selected' : ''}" data-url="${path}" title="${filename}">
        <img src="${path}" alt="${filename}" onerror="this.src='assets/logo.jpg'">
      </div>
    `;
  }).join('');

  presetContainer.querySelectorAll('.preset-thumb-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      presetContainer.querySelectorAll('.preset-thumb-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const url = btn.dataset.url;
      const imgInput = document.getElementById('crud-img-url');
      const preview = document.getElementById('crud-img-preview');
      if (imgInput) imgInput.value = url;
      if (preview) preview.src = url;

      if (!currentModalImages.includes(url)) {
        currentModalImages.push(url);
        renderGalleryChips();
      }
    });
  });
}

export async function openProductModal(product = null) {
  editingProductId = product ? product.id : null;
  const modalBackdrop = document.getElementById('product-modal-backdrop');
  const titleEl = document.getElementById('product-modal-title');
  const form = document.getElementById('product-crud-form');
  const preview = document.getElementById('crud-img-preview');
  const searchInput = document.getElementById('preset-search-input');

  if (!modalBackdrop || !form) return;

  titleEl.textContent = product ? `Edit Kit: ${product.name}` : 'Add New Kit (100201 Football Shop)';

  // Reset search filter
  if (searchInput) searchInput.value = '';

  // Setup gallery images
  if (product && Array.isArray(product.images) && product.images.length > 0) {
    currentModalImages = [...product.images];
  } else if (product?.image) {
    currentModalImages = [product.image];
  } else {
    currentModalImages = [];
  }

  // Populate dynamic category/league select
  populateLeagueOptions(product?.league || 'La Liga');

  if (product) {
    document.getElementById('crud-name').value = product.name || '';
    document.getElementById('crud-club').value = product.club || '';
    document.getElementById('crud-league').value = product.league || 'La Liga';
    document.getElementById('crud-season').value = product.season || '2026/27';
    document.getElementById('crud-type').value = product.type || 'Home';
    document.getElementById('crud-price').value = product.price || '';
    document.getElementById('crud-original-price').value = product.originalPrice || '';
    document.getElementById('crud-badge').value = product.badge || '';
    document.getElementById('crud-availability').value = product.availability || 'Pre-Order (2-3 Weeks)';
    document.getElementById('crud-featured').checked = !!product.featured;
    document.getElementById('crud-is-new').checked = product.isNew !== undefined ? !!product.isNew : true;
    document.getElementById('crud-img-url').value = product.image || '';
    document.getElementById('crud-desc').value = product.description || '';

    document.getElementById('crud-stock-s').value = product.stock?.S ?? 5;
    document.getElementById('crud-stock-m').value = product.stock?.M ?? 10;
    document.getElementById('crud-stock-l').value = product.stock?.L ?? 8;
    document.getElementById('crud-stock-xl').value = product.stock?.XL ?? 4;
    document.getElementById('crud-stock-xxl').value = product.stock?.XXL ?? 2;

    if (preview) preview.src = product.image || 'assets/logo.jpg';
  } else {
    form.reset();
    document.getElementById('crud-season').value = '2026/27';
    document.getElementById('crud-type').value = 'Home';
    document.getElementById('crud-price').value = '1100';
    document.getElementById('crud-original-price').value = '1300';
    document.getElementById('crud-badge').value = 'NEW DROP // PASIG VAULT';
    document.getElementById('crud-availability').value = 'Pre-Order (2-3 Weeks)';
    document.getElementById('crud-featured').checked = true;
    document.getElementById('crud-is-new').checked = true;

    document.getElementById('crud-stock-s').value = '5';
    document.getElementById('crud-stock-m').value = '8';
    document.getElementById('crud-stock-l').value = '12';
    document.getElementById('crud-stock-xl').value = '6';
    document.getElementById('crud-stock-xxl').value = '3';

    const defaultImg = 'assets/products/barca-2627-home-1.jpg';
    document.getElementById('crud-img-url').value = defaultImg;
    if (preview) preview.src = defaultImg;
    currentModalImages = [defaultImg];
  }

  // Update dynamic total units badge
  updateCrudTotalStock();

  // Render multi-angle gallery chips
  renderGalleryChips();

  // Fetch local photography assets and render presets
  await fetchLocalProductAssets();
  renderPresets('');

  modalBackdrop.classList.add('open');
}

export function closeProductModal() {
  const modalBackdrop = document.getElementById('product-modal-backdrop');
  if (modalBackdrop) modalBackdrop.classList.remove('open');
  editingProductId = null;
}

function handleSaveProduct(e) {
  e.preventDefault();

  const nameVal = document.getElementById('crud-name').value.trim();
  const clubVal = document.getElementById('crud-club').value.trim();
  const priceVal = parseFloat(document.getElementById('crud-price').value);
  const origPriceRaw = document.getElementById('crud-original-price').value.trim();
  const origPriceVal = origPriceRaw ? parseFloat(origPriceRaw) : null;
  const imgVal = document.getElementById('crud-img-url').value.trim() || 'assets/logo.jpg';

  if (!nameVal || !clubVal || isNaN(priceVal) || priceVal <= 0) {
    window.showToast?.('Please provide valid Jersey Title, Club, and Price', 'error');
    return;
  }

  // Ensure primary image is in gallery angles
  if (!currentModalImages.includes(imgVal)) {
    currentModalImages.unshift(imgVal);
  }

  const productData = {
    name: nameVal,
    club: clubVal,
    league: document.getElementById('crud-league').value,
    season: document.getElementById('crud-season').value.trim() || '2026/27',
    type: document.getElementById('crud-type').value,
    badge: document.getElementById('crud-badge').value.trim(),
    price: priceVal,
    originalPrice: origPriceVal,
    availability: document.getElementById('crud-availability').value,
    featured: document.getElementById('crud-featured').checked,
    isNew: document.getElementById('crud-is-new').checked,
    image: imgVal,
    images: currentModalImages.length > 0 ? currentModalImages : [imgVal],
    description: document.getElementById('crud-desc').value.trim(),
    stock: {
      S: Math.max(0, parseInt(document.getElementById('crud-stock-s').value, 10) || 0),
      M: Math.max(0, parseInt(document.getElementById('crud-stock-m').value, 10) || 0),
      L: Math.max(0, parseInt(document.getElementById('crud-stock-l').value, 10) || 0),
      XL: Math.max(0, parseInt(document.getElementById('crud-stock-xl').value, 10) || 0),
      XXL: Math.max(0, parseInt(document.getElementById('crud-stock-xxl').value, 10) || 0)
    }
  };

  if (editingProductId) {
    store.updateProduct(editingProductId, productData);
    window.showToast?.(`Updated "${productData.name}"!`, 'success');
  } else {
    store.addProduct(productData);
    window.showToast?.(`Added "${productData.name}" to 100201 catalog!`, 'success');
  }

  closeProductModal();
}
