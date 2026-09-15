import { INITIAL_PRODUCTS, INITIAL_ORDERS, SHOP_INFO } from './mock-data.js';
import { auth } from './auth.js';
import { apiClient } from './apiClient.js';

export const MAX_ORDER_AMOUNT_PHP = 100000;
export const MAX_ORDER_ITEMS = 15;
export const MIN_ORDER_AMOUNT_PHP = 100;

class Store {
  constructor() {
    this.subscribers = {
      products: [],
      orders: [],
      cart: [],
      payments: [],
      view: [],
      currency: []
    };

    this.currentView = 'storefront';
    this.promoCode = null;
    this.discountPercent = 0;
    this.currency = 'PHP';

    // In-memory Fast O(1) Index Maps
    this.productsMap = new Map();
    this.ordersMap = new Map();

    this.init();
  }

  rebuildIndexMaps() {
    this.productsMap.clear();
    this.products.forEach(p => this.productsMap.set(p.id, p));

    this.ordersMap.clear();
    this.orders.forEach(o => this.ordersMap.set(o.id.toUpperCase(), o));
  }

  init() {
    // Products
    const savedProducts = localStorage.getItem('100201_products');
    const catalogVersion = '100201_v4_all_kits';
    if (!savedProducts || localStorage.getItem('100201_catalog_version') !== catalogVersion) {
      localStorage.setItem('100201_products', JSON.stringify(INITIAL_PRODUCTS));
      localStorage.setItem('100201_catalog_version', catalogVersion);
      this.products = [...INITIAL_PRODUCTS];
    } else {
      try {
        this.products = JSON.parse(savedProducts);
      } catch (e) {
        this.products = [...INITIAL_PRODUCTS];
      }
    }

    // Orders
    const savedOrders = localStorage.getItem('100201_orders');
    const ordersVersion = '100201_v3_clean_orders';
    if (!savedOrders || localStorage.getItem('100201_orders_version') !== ordersVersion) {
      localStorage.setItem('100201_orders', JSON.stringify(INITIAL_ORDERS));
      localStorage.setItem('100201_orders_version', ordersVersion);
      this.orders = [...INITIAL_ORDERS];
    } else {
      try {
        this.orders = JSON.parse(savedOrders);
      } catch (e) {
        this.orders = [...INITIAL_ORDERS];
      }
    }

    // Clear deprecated global payment storage
    localStorage.removeItem('100201_payments');

    // Cart
    const savedCart = localStorage.getItem('100201_cart');
    this.cart = savedCart ? JSON.parse(savedCart) : [];

    this.rebuildIndexMaps();

    // Attempt dynamic backend sync if server API is available
    this.syncWithBackend();
  }

  async syncWithBackend() {
    try {
      const resProds = await apiClient.get('/api/products');
      if (resProds.ok && Array.isArray(resProds.data)) {
        this.products = resProds.data;
        this.rebuildIndexMaps();
        localStorage.setItem('100201_products', JSON.stringify(this.products));
        this.notify('products', this.products);
      }
    } catch (_) {}

    try {
      const resOrders = await apiClient.get('/api/orders');
      if (resOrders.ok && Array.isArray(resOrders.data)) {
        this.orders = resOrders.data;
        this.rebuildIndexMaps();
        localStorage.setItem('100201_orders', JSON.stringify(this.orders));
        this.notify('orders', this.orders);
      }
    } catch (_) {}
  }

  // --- PUB / SUB ---
  subscribe(event, callback) {
    if (this.subscribers[event]) {
      this.subscribers[event].push(callback);
    }
  }

  notify(event, data) {
    if (this.subscribers[event]) {
      this.subscribers[event].forEach(callback => callback(data));
    }
  }

  // --- CURRENCY & PRICING (PHP Official) ---
  getCurrency() {
    return 'PHP';
  }

  formatPrice(val) {
    const num = Number(val) || 0;
    return `₱${num.toLocaleString()}`;
  }

  // --- VIEW MANAGEMENT ---
  setView(viewName) {
    this.currentView = viewName;
    this.notify('view', viewName);
  }

  getView() {
    return this.currentView;
  }

  // --- PRODUCTS CRUD (ADMIN & USER) ---
  getProducts() {
    return [...this.products];
  }

  // Fast O(1) Product Lookup
  getProductById(id) {
    if (!id) return null;
    return this.productsMap.get(id) || this.products.find(p => p.id === id) || null;
  }

  addProduct(productData) {
    const newProduct = {
      id: `kit-100201-${Date.now().toString(36)}`,
      name: productData.name.trim(),
      club: productData.club.trim(),
      league: productData.league || 'Other',
      season: productData.season || '2024/25',
      type: productData.type || 'Home',
      badge: productData.badge || 'Official Release',
      price: parseFloat(productData.price) || 1199,
      originalPrice: productData.originalPrice ? parseFloat(productData.originalPrice) : null,
      rating: 5.0,
      reviewsCount: 1,
      description: productData.description || '100201 Football Shop curated jersey with authentic player detailing and breathable fabric.',
      image: productData.image || 'assets/products/barca-2627-home-1.jpg',
      images: Array.isArray(productData.images) && productData.images.length > 0 ? productData.images : [productData.image || 'assets/products/barca-2627-home-1.jpg'],
      stock: {
        S: parseInt(productData.stock?.S ?? 5, 10),
        M: parseInt(productData.stock?.M ?? 10, 10),
        L: parseInt(productData.stock?.L ?? 8, 10),
        XL: parseInt(productData.stock?.XL ?? 4, 10),
        XXL: parseInt(productData.stock?.XXL ?? 2, 10)
      },
      featured: !!productData.featured,
      isNew: productData.isNew !== undefined ? !!productData.isNew : true,
      availability: productData.availability || 'Pre-Order (2-3 Weeks)'
    };

    this.products.unshift(newProduct);
    this.saveProducts();
    this.notify('products', this.products);
    return newProduct;
  }

  updateProduct(id, updatedFields) {
    const index = this.products.findIndex(p => p.id === id);
    if (index === -1) return null;

    const existing = this.products[index];
    const updated = {
      ...existing,
      ...updatedFields,
      price: parseFloat(updatedFields.price) || existing.price,
      stock: {
        ...existing.stock,
        ...(updatedFields.stock || {})
      }
    };

    this.products[index] = updated;
    this.saveProducts();
    this.notify('products', this.products);
    return updated;
  }

  deleteProduct(id) {
    this.products = this.products.filter(p => p.id !== id);
    this.saveProducts();
    this.notify('products', this.products);
    return true;
  }

  saveProducts() {
    localStorage.setItem('100201_products', JSON.stringify(this.products));
    try {
      fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.products)
      }).catch(() => {});
    } catch (e) {}
  }

  // --- CART MANAGEMENT ---
  getCart() {
    return [...this.cart];
  }

  addToCart(product, size, customization = '', quantity = 1) {
    const cartItemId = `${product.id}-${size}-${customization.trim().toUpperCase()}`;
    const existingIndex = this.cart.findIndex(item => item.cartItemId === cartItemId);

    if (existingIndex > -1) {
      this.cart[existingIndex].quantity += quantity;
    } else {
      this.cart.push({
        cartItemId,
        productId: product.id,
        name: product.name,
        club: product.club,
        price: product.price,
        image: product.image,
        size,
        customization: customization.trim(),
        quantity
      });
    }

    this.saveCart();
    this.notify('cart', this.cart);
  }

  updateCartQuantity(cartItemId, newQuantity) {
    if (newQuantity <= 0) {
      this.removeFromCart(cartItemId);
      return;
    }

    const item = this.cart.find(item => item.cartItemId === cartItemId);
    if (item) {
      item.quantity = newQuantity;
      this.saveCart();
      this.notify('cart', this.cart);
    }
  }

  removeFromCart(cartItemId) {
    this.cart = this.cart.filter(item => item.cartItemId !== cartItemId);
    this.saveCart();
    this.notify('cart', this.cart);
  }

  clearCart() {
    this.cart = [];
    this.promoCode = null;
    this.discountPercent = 0;
    this.saveCart();
    this.notify('cart', this.cart);
  }

  applyPromo(code) {
    const clean = code.trim().toUpperCase();
    if (clean === '100201VIP' || clean === 'GOLAZO10' || clean === 'STORE10') {
      this.promoCode = clean;
      this.discountPercent = 10;
      this.notify('cart', this.cart);
      return { success: true, message: '10% 100201 Football Shop discount applied!' };
    } else if (clean === 'CHAMPION20') {
      this.promoCode = clean;
      this.discountPercent = 20;
      this.notify('cart', this.cart);
      return { success: true, message: '20% Champion discount applied!' };
    }
    return { success: false, message: 'Invalid code. Try "100201VIP" or "GOLAZO10"' };
  }

  getCartSummary() {
    const subtotal = this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    const discountAmount = Math.round((subtotal * this.discountPercent) / 100);
    // Free nationwide shipping threshold: ₱1,500
    const shippingThreshold = 1500;
    const shipping = subtotal >= shippingThreshold || subtotal === 0 ? 0 : 120;
    const finalTotal = Math.max(0, subtotal - discountAmount + shipping);

    return {
      subtotal,
      totalItems,
      discountPercent: this.discountPercent,
      promoCode: this.promoCode,
      discountAmount,
      shipping,
      finalTotal,
      freeShippingQualified: subtotal >= shippingThreshold,
      freeShippingNeeded: Math.max(0, shippingThreshold - subtotal)
    };
  }

  saveCart() {
    localStorage.setItem('100201_cart', JSON.stringify(this.cart));
  }

  // --- PAYMENT METHODS (Isolated Per Buyer Account) ---
  getPaymentMethods() {
    if (typeof auth !== 'undefined' && auth.isCustomerLoggedIn()) {
      return auth.getCurrentCustomerPaymentMethods();
    }
    return [];
  }

  addPaymentMethod(pm) {
    if (typeof auth !== 'undefined' && auth.isCustomerLoggedIn()) {
      const newPm = auth.addCustomerPaymentMethod(pm);
      this.notify('payments', this.getPaymentMethods());
      return newPm;
    }
    return null;
  }

  deletePaymentMethod(id) {
    if (typeof auth !== 'undefined' && auth.isCustomerLoggedIn()) {
      auth.deleteCustomerPaymentMethod(id);
      this.notify('payments', this.getPaymentMethods());
    }
  }

  setDefaultPaymentMethod(id) {
    if (typeof auth !== 'undefined' && auth.isCustomerLoggedIn()) {
      auth.setDefaultCustomerPaymentMethod(id);
      this.notify('payments', this.getPaymentMethods());
    }
  }

  // --- ORDERS & TRACKING ---
  getOrders() {
    return [...this.orders];
  }

  // Fast O(1) Order Lookup
  getOrderById(id) {
    if (!id) return null;
    const cleanId = id.trim().toUpperCase();
    return this.ordersMap.get(cleanId) || this.orders.find(o => o.id.toUpperCase() === cleanId) || null;
  }

  createOrder(orderPayload) {
    // 1. Cost Controls & Spending Cap Enforcement
    const totalAmount = orderPayload.summary?.finalTotal || 0;
    if (totalAmount > MAX_ORDER_AMOUNT_PHP) {
      throw new Error(`Order total (₱${totalAmount.toLocaleString()}) exceeds the maximum spending cap of ₱${MAX_ORDER_AMOUNT_PHP.toLocaleString()}. Please contact store manager.`);
    }

    const totalKits = (orderPayload.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0);
    if (totalKits > MAX_ORDER_ITEMS) {
      throw new Error(`Order quantity (${totalKits} kits) exceeds the quota of ${MAX_ORDER_ITEMS} kits per order.`);
    }

    // 2. Duplicate Payment & Order Prevention (60-second window replay check)
    const customerEmail = (orderPayload.customer?.email || '').trim().toLowerCase();
    const recentDuplicate = this.orders.find(o => {
      const isSameEmail = (o.customer?.email || '').trim().toLowerCase() === customerEmail;
      const isSameTotal = Math.abs((o.total || 0) - totalAmount) < 1;
      const orderAgeMs = Date.now() - new Date(o.date).getTime();
      return isSameEmail && isSameTotal && orderAgeMs < 60000;
    });

    if (recentDuplicate) {
      console.warn('[Store] Duplicate order attempt detected. Returning existing order:', recentDuplicate.id);
      this.clearCart();
      return recentDuplicate;
    }

    const orderId = `100201-ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();
    const formattedNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newOrder = {
      id: orderId,
      date: now.toISOString(),
      customer: {
        name: orderPayload.customer.name,
        email: orderPayload.customer.email,
        phone: orderPayload.customer.phone || '+63 917 000 1201',
        address: orderPayload.customer.address,
        city: orderPayload.customer.city,
        postalCode: orderPayload.customer.postalCode,
        country: orderPayload.customer.country || 'Philippines'
      },
      items: orderPayload.items.map(item => ({
        id: item.productId,
        name: item.name,
        size: item.size,
        quantity: item.quantity,
        price: item.price,
        image: item.image,
        customization: item.customization || null
      })),
      subtotal: orderPayload.summary.subtotal,
      discount: orderPayload.summary.discountAmount,
      shipping: orderPayload.summary.shipping,
      total: orderPayload.summary.finalTotal,
      paymentMethod: orderPayload.paymentMethod,
      status: 'Order Confirmed',
      carrier: 'J&T Express / Store Dispatch',
      trackingNumber: `JT-100201-${Math.floor(100000 + Math.random() * 900000)}`,
      estimatedDelivery: '2-4 Business Days (Nationwide PH)',
      timeline: [
        {
          status: 'Order Confirmed',
          timestamp: formattedNow,
          description: 'Payment acknowledged by 100201 Football Shop. Jersey reservation secured.',
          completed: true
        },
        {
          status: 'Processing & Custom Printing',
          timestamp: null,
          description: 'Authentic heat-press printing applied at store workshop.',
          completed: false
        },
        {
          status: 'Shipped',
          timestamp: null,
          description: 'Dispatched via courier partner (J&T / LBC Express).',
          completed: false
        },
        {
          status: 'Out for Delivery',
          timestamp: null,
          description: 'Courier rider is on delivery route.',
          completed: false
        },
        {
          status: 'Delivered',
          timestamp: null,
          description: 'Delivered to recipient address or collected in-store.',
          completed: false
        }
      ]
    };

    // Deduct stock for ordered items
    orderPayload.items.forEach(item => {
      const prod = this.getProductById(item.productId);
      if (prod && prod.stock && prod.stock[item.size] !== undefined) {
        prod.stock[item.size] = Math.max(0, prod.stock[item.size] - item.quantity);
      }
    });
    this.saveProducts();
    this.notify('products', this.products);

    this.orders.unshift(newOrder);
    this.rebuildIndexMaps();
    this.saveOrders();
    this.notify('orders', this.orders);

    this.clearCart();
    return newOrder;
  }

  updateOrderStatus(orderId, newStatus) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return null;

    const now = new Date();
    const formattedNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    order.status = newStatus;

    const stages = [
      'Order Confirmed',
      'Processing & Custom Printing',
      'Shipped',
      'Out for Delivery',
      'Delivered'
    ];

    if (newStatus === 'Cancelled') {
      order.timeline.push({
        status: 'Cancelled',
        timestamp: formattedNow,
        description: 'Order was cancelled by 100201 Football Shop administration.',
        completed: true
      });
    } else {
      const targetIndex = stages.findIndex(s => s.toLowerCase() === newStatus.toLowerCase());
      if (targetIndex !== -1) {
        order.timeline = order.timeline.map((step, idx) => {
          if (idx <= targetIndex) {
            return {
              ...step,
              completed: true,
              timestamp: step.timestamp || formattedNow
            };
          } else {
            return {
              ...step,
              completed: false,
              timestamp: null
            };
          }
        });
      }
    }

    this.saveOrders();
    this.notify('orders', this.orders);
    return order;
  }

  saveOrders() {
    this.rebuildIndexMaps();
    localStorage.setItem('100201_orders', JSON.stringify(this.orders));
    apiClient.post('/api/orders', this.orders).catch(() => {});
  }

  saveProducts() {
    this.rebuildIndexMaps();
    localStorage.setItem('100201_products', JSON.stringify(this.products));
    apiClient.post('/api/products', this.products).catch(() => {});
  }

  // --- PAGINATION HELPERS ---
  getPaginatedProducts({ page = 1, pageSize = 12, category = 'all', searchQuery = '', sortBy = 'featured' } = {}) {
    let list = [...this.products];

    // Category filter
    if (category && category !== 'all') {
      list = list.filter(p => p.league === category || p.type === category);
    }

    // Search filter
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.club.toLowerCase().includes(q) ||
        p.league.toLowerCase().includes(q) ||
        (p.season && p.season.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (sortBy === 'price-low') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-high') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (currentPage - 1) * pageSize;
    const paginatedItems = list.slice(startIdx, startIdx + pageSize);

    return {
      items: paginatedItems,
      total,
      page: currentPage,
      totalPages,
      hasPrev: currentPage > 1,
      hasNext: currentPage < totalPages
    };
  }

  getPaginatedOrders({ page = 1, pageSize = 10, status = 'all', searchQuery = '' } = {}) {
    let list = [...this.orders];

    if (status && status !== 'all') {
      list = list.filter(o => o.status === status);
    }

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(o =>
        o.id.toLowerCase().includes(q) ||
        (o.customer?.name && o.customer.name.toLowerCase().includes(q)) ||
        (o.customer?.email && o.customer.email.toLowerCase().includes(q)) ||
        (o.trackingNumber && o.trackingNumber.toLowerCase().includes(q))
      );
    }

    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (currentPage - 1) * pageSize;
    const paginatedItems = list.slice(startIdx, startIdx + pageSize);

    return {
      items: paginatedItems,
      total,
      page: currentPage,
      totalPages,
      hasPrev: currentPage > 1,
      hasNext: currentPage < totalPages
    };
  }

  resetAllData() {
    localStorage.removeItem('100201_products');
    localStorage.removeItem('100201_orders');
    localStorage.removeItem('100201_payments');
    localStorage.removeItem('100201_cart');
    localStorage.removeItem('100201_catalog_version');
    localStorage.removeItem('100201_orders_version');
    this.init();
    this.notify('products', this.products);
    this.notify('orders', this.orders);
    this.notify('payments', this.getPaymentMethods());
    this.notify('cart', this.cart);
  }
}

export const store = new Store();
