import { INITIAL_PRODUCTS, INITIAL_ORDERS, SHOP_INFO } from './mock-data.js';
import { auth } from './auth.js';
import { apiClient } from './apiClient.js';

export const MAX_ORDER_AMOUNT_PHP = 100000;
export const MAX_ORDER_ITEMS = 15;
export const MIN_ORDER_AMOUNT_PHP = 100;

export function isPickupOrder(order) {
  if (!order) return false;
  if (order.fulfillmentMode === 'pickup' || order.fulfillmentType === 'pickup') return true;
  if (order.customer?.fulfillmentMode === 'pickup') return true;
  if (order.carrier && /pick-?up|store collection|counter/i.test(order.carrier)) return true;
  if (order.customer?.address && /shop counter|pick-?up|counter collection/i.test(order.customer.address)) return true;
  if (order.trackingNumber && /^(PK|PICKUP)-/i.test(order.trackingNumber)) return true;
  if (order.paymentMethod?.type === 'pickup') return true;
  return false;
}

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
    const maxStock = product.stock?.[size] || 0;
    const cartItemId = `${product.id}-${size}-${customization.trim().toUpperCase()}`;
    const existingIndex = this.cart.findIndex(item => item.cartItemId === cartItemId);

    let newQuantity = quantity;
    if (existingIndex > -1) {
      newQuantity += this.cart[existingIndex].quantity;
    }

    if (newQuantity > maxStock) {
      window.showToast?.(`Only ${maxStock} items available for this size.`, 'warning');
      return;
    }

    if (existingIndex > -1) {
      this.cart[existingIndex].quantity = newQuantity;
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
      const product = this.getProductById(item.productId);
      const maxStock = product?.stock?.[item.size] || 0;
      if (newQuantity > maxStock) {
        window.showToast?.(`Only ${maxStock} items available for this size.`, 'warning');
        return;
      }
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

  getCartSummary(fulfillmentMode = 'delivery') {
    const subtotal = this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    const discountAmount = Math.round((subtotal * this.discountPercent) / 100);
    // Free nationwide shipping threshold: ₱1,500; In-Store Pick-up is always FREE
    const isPickup = fulfillmentMode === 'pickup';
    const shippingThreshold = 1500;
    const shipping = isPickup ? 0 : (subtotal >= shippingThreshold || subtotal === 0 ? 0 : 120);
    const finalTotal = Math.max(0, subtotal - discountAmount + shipping);

    return {
      subtotal,
      totalItems,
      discountPercent: this.discountPercent,
      promoCode: this.promoCode,
      discountAmount,
      shipping,
      finalTotal,
      freeShippingQualified: isPickup || subtotal >= shippingThreshold,
      freeShippingNeeded: isPickup ? 0 : Math.max(0, shippingThreshold - subtotal),
      fulfillmentMode
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

  // --- CHECKOUT PAYMENT METHODS (Contextual per fulfillment mode: COD vs Pick-up + Digital) ---
  getCheckoutPaymentMethods(fulfillmentMode = 'delivery') {
    const isPickup = fulfillmentMode === 'pickup';
    const customerMethods = this.getPaymentMethods(); // saved in buyer account

    const list = [];

    // 1. If customer has saved payment methods, include them first
    customerMethods.forEach(pm => {
      // Filter out fulfillment-incompatible methods
      if (pm.type === 'cod' && isPickup) return;
      if (pm.type === 'pickup' && !isPickup) return;

      list.push({
        ...pm,
        isSaved: true
      });
    });

    // 2. Add contextual cash fulfillment method
    if (isPickup) {
      if (!list.some(m => m.type === 'pickup')) {
        list.push({
          id: 'pm-pickup-counter',
          type: 'pickup',
          brand: 'Payment on Pick-up',
          accountName: 'Store Collection Desk',
          accountNumber: 'Pay at Counter (Cash, GCash, or POS Terminal)',
          badgeText: 'PICKUP',
          isDefault: list.length === 0,
          isBuiltin: true
        });
      }
    } else {
      if (!list.some(m => m.type === 'cod')) {
        list.push({
          id: 'pm-cod-nationwide',
          type: 'cod',
          brand: 'Cash on Delivery (COD)',
          accountName: 'Pay Courier Rider',
          accountNumber: 'Exact Cash Upon Arrival',
          badgeText: 'COD',
          isDefault: list.length === 0,
          isBuiltin: true
        });
      }
    }

    // 3. Add standard Philippine digital options (GCash, Maya, BDO Bank Transfer, Card)
    if (!list.some(m => m.type === 'gcash')) {
      list.push({
        id: 'pm-gcash-store',
        type: 'gcash',
        brand: 'GCash',
        accountName: '100201 Football Shop',
        accountNumber: '0917-555-1201',
        badgeText: 'GCASH',
        isDefault: false,
        isBuiltin: true
      });
    }

    if (!list.some(m => m.type === 'maya')) {
      list.push({
        id: 'pm-maya-store',
        type: 'maya',
        brand: 'Maya (PayMaya)',
        accountName: '100201 Football Shop',
        accountNumber: '0917-555-1201',
        badgeText: 'MAYA',
        isDefault: false,
        isBuiltin: true
      });
    }

    if (!list.some(m => m.type === 'bdo' || m.type === 'bank')) {
      list.push({
        id: 'pm-bdo-store',
        type: 'bdo',
        brand: 'BDO Bank Transfer',
        accountName: '100201 SPORTS',
        accountNumber: '0041-8890-2101',
        badgeText: 'BDO',
        isDefault: false,
        isBuiltin: true
      });
    }

    if (!list.some(m => m.type === 'card')) {
      list.push({
        id: 'pm-card-gateway',
        type: 'card',
        brand: 'Credit / Debit Card',
        accountName: 'Online Card Gateway',
        accountNumber: 'Visa / Mastercard / JCB',
        badgeText: 'CARD',
        isDefault: false,
        isBuiltin: true
      });
    }

    // Ensure a default is present if none marked
    if (!list.some(m => m.isDefault) && list.length > 0) {
      list[0].isDefault = true;
    }

    return list;
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
    // 0. Stock Validation (Hard Check before creation)
    for (const item of (orderPayload.items || [])) {
      const prod = this.getProductById(item.productId);
      if (!prod) throw new Error(`Product not found: ${item.name}`);
      const available = prod.stock?.[item.size] || 0;
      if (item.quantity > available) {
        throw new Error(`Insufficient stock for ${item.name} (${item.size}). Only ${available} available.`);
      }
    }

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

    const fulfillmentMode = orderPayload.fulfillmentMode || orderPayload.customer?.fulfillmentMode || 'delivery';
    const isPickup = fulfillmentMode === 'pickup';
    const pmType = orderPayload.paymentMethod?.type || 'gcash';

    const orderId = `100201-ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();
    const formattedNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const carrier = isPickup ? '100201 Store Pick-up Counter' : 'J&T Express / Store Dispatch';
    const trackingNumber = isPickup
      ? `PK-100201-${Math.floor(100000 + Math.random() * 900000)}`
      : `JT-100201-${Math.floor(100000 + Math.random() * 900000)}`;
    const estimatedDelivery = isPickup
      ? 'Ready for Pick-up in 1-2 Hours (Same-Day Store Collection)'
      : '2-4 Business Days (Nationwide PH)';

    const pickupStep1Desc = pmType === 'pickup'
      ? 'Reservation secured for store collection. Payment will be settled at 100201 counter.'
      : 'Payment acknowledged by 100201 Football Shop. Jersey reservation secured.';

    const deliveryStep1Desc = pmType === 'cod'
      ? 'Order confirmed for Cash on Delivery (COD). Exact cash will be collected by courier rider.'
      : 'Payment acknowledged by 100201 Football Shop. Jersey reservation secured.';

    const pickupTimeline = [
      {
        status: 'Order Confirmed',
        timestamp: formattedNow,
        description: pickupStep1Desc,
        completed: true
      },
      {
        status: 'Processing & Custom Printing',
        timestamp: null,
        description: 'Authentic kit preparation & heat-press customization in progress.',
        completed: false
      },
      {
        status: 'Ready for Pick-up',
        timestamp: null,
        description: 'Packaged & waiting at 100201 store counter for customer collection.',
        completed: false
      },
      {
        status: 'Picked Up',
        timestamp: null,
        description: 'Order claimed & released to customer at 100201 store counter.',
        completed: false
      }
    ];

    const deliveryTimeline = [
      {
        status: 'Order Confirmed',
        timestamp: formattedNow,
        description: deliveryStep1Desc,
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
    ];

    const newOrder = {
      id: orderId,
      date: now.toISOString(),
      fulfillmentMode: isPickup ? 'pickup' : 'delivery',
      customer: {
        name: orderPayload.customer.name,
        email: orderPayload.customer.email,
        phone: orderPayload.customer.phone || '+63 917 000 1201',
        address: isPickup ? '100201 Football Shop Counter, Ortigas Center' : orderPayload.customer.address,
        city: isPickup ? 'Pasig City' : (orderPayload.customer.city || 'Metro Manila'),
        postalCode: isPickup ? '1605' : (orderPayload.customer.postalCode || '1600'),
        country: orderPayload.customer.country || 'Philippines',
        fulfillmentMode: isPickup ? 'pickup' : 'delivery'
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
      shipping: isPickup ? 0 : orderPayload.summary.shipping,
      total: isPickup
        ? Math.max(0, orderPayload.summary.subtotal - orderPayload.summary.discountAmount)
        : orderPayload.summary.finalTotal,
      paymentMethod: orderPayload.paymentMethod,
      status: 'Order Confirmed',
      carrier,
      trackingNumber,
      estimatedDelivery,
      timeline: isPickup ? pickupTimeline : deliveryTimeline
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

    const isPickup = isPickupOrder(order);

    if (newStatus === 'Cancelled') {
      order.status = 'Cancelled';
      order.timeline.push({
        status: 'Cancelled',
        timestamp: formattedNow,
        description: 'Order was cancelled by 100201 Football Shop administration.',
        completed: true
      });
      this.saveOrders();
      this.notify('orders', this.orders);
      return order;
    }

    if (isPickup) {
      // Pick-up stage definitions (4 Stages)
      const pickupStages = [
        'Order Confirmed',
        'Processing & Custom Printing',
        'Ready for Pick-up',
        'Picked Up'
      ];

      // Normalize status aliases for pickup
      let canonicalStatus = newStatus;
      const lower = newStatus.trim().toLowerCase();
      if (lower.includes('ready') || lower.includes('shipped') || lower.includes('out for delivery')) {
        canonicalStatus = 'Ready for Pick-up';
      } else if (lower.includes('deliver') || lower.includes('picked') || lower.includes('complete')) {
        canonicalStatus = 'Picked Up';
      } else if (lower.includes('process') || lower.includes('print')) {
        canonicalStatus = 'Processing & Custom Printing';
      } else if (lower.includes('confirm')) {
        canonicalStatus = 'Order Confirmed';
      }

      order.status = canonicalStatus;

      // Update estimated delivery note based on status
      if (canonicalStatus === 'Ready for Pick-up') {
        order.estimatedDelivery = 'Ready for Collection Now at Store Counter';
      } else if (canonicalStatus === 'Picked Up') {
        order.estimatedDelivery = 'Claimed & Picked Up at Store Counter';
      } else if (canonicalStatus === 'Processing & Custom Printing') {
        order.estimatedDelivery = 'Preparing in Store Workshop (Ready in ~1 Hour)';
      } else {
        order.estimatedDelivery = 'Ready for Pick-up in 1-2 Hours (Same-Day Collection)';
      }

      // If existing timeline was courier-based (5 steps) or incomplete, migrate to pickup (4 steps)
      if (!order.timeline || order.timeline.length !== 4 || order.timeline.some(t => t.status === 'Shipped')) {
        order.timeline = [
          {
            status: 'Order Confirmed',
            timestamp: order.timeline?.[0]?.timestamp || formattedNow,
            description: 'Payment acknowledged by 100201 Football Shop. Jersey reservation secured.',
            completed: true
          },
          {
            status: 'Processing & Custom Printing',
            timestamp: order.timeline?.[1]?.timestamp || null,
            description: 'Authentic kit preparation & heat-press customization in progress.',
            completed: false
          },
          {
            status: 'Ready for Pick-up',
            timestamp: order.timeline?.[2]?.timestamp || null,
            description: 'Packaged & waiting at 100201 store counter for customer collection.',
            completed: false
          },
          {
            status: 'Picked Up',
            timestamp: order.timeline?.[4]?.timestamp || order.timeline?.[3]?.timestamp || null,
            description: 'Order claimed & released to customer at 100201 store counter.',
            completed: false
          }
        ];
      }

      const targetIndex = pickupStages.findIndex(s => s.toLowerCase() === canonicalStatus.toLowerCase());
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
    } else {
      // Courier Delivery Flow (5 Stages)
      const stages = [
        'Order Confirmed',
        'Processing & Custom Printing',
        'Shipped',
        'Out for Delivery',
        'Delivered'
      ];

      order.status = newStatus;
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
