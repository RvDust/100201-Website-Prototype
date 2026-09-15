// Authentication & Access Control Controller for 100201 Football Shop
// Provides separated Customer Authentication and Cryptographically Secured Merchant Portal Access

const MERCHANT_SALT = "100201_PASIG_SALT_2026";
const MERCHANT_HASH = "1afbc5c225084df1d34a11e5c5a548c66e4025bcb173ad9ab1bb4edef0761373"; // SHA-256(salt + 'admin')
const MERCHANT_VALID_USERS = ["admin@100201footballshop.ph", "admin"];
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds cooldown
const SESSION_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours

const DEFAULT_CUSTOMERS = [
  {
    id: "cust-princess",
    name: "PRINCESS LOUELLA AGUI",
    email: "agui.princess@gmail.com",
    phone: "+639617668255",
    address: "100201 Football Shop Counter, Ortigas Center, Pasig City",
    city: "Makati City",
    postalCode: "1213",
    passwordHash: "e30b86c3a34ee4deddcbb93683350d0be0275b47813f53dc49d1422343922870", // SHA-256(email + 'password123')
    createdAt: "2026-09-10T08:00:00.000Z",
    paymentMethods: [
      {
        id: "pm-gcash-8255",
        type: "gcash",
        brand: "GCash",
        accountName: "Princess Louella Agui",
        accountNumber: "0961-766-8255",
        last4: "8255",
        badgeText: "GCASH",
        isDefault: true
      }
    ]
  },
  {
    id: "cust-sinaia",
    name: "Sinaia Rodriguez",
    email: "rodzjeanne@gmail.com",
    phone: "+639617668255",
    address: "Unit 14B, Sapphire Tower, Ortigas Center",
    city: "Makati City",
    postalCode: "1213",
    passwordHash: "756c4959d3ec2ba78f6896a2ef4e8951c7f39795356112cc8121611fef3a43d3", // SHA-256(email + 'password123')
    createdAt: "2026-09-10T06:00:00.000Z",
    paymentMethods: [
      {
        id: "pm-gcash-2219",
        type: "gcash",
        brand: "GCash",
        accountName: "Sinaia Rodriguez",
        accountNumber: "0961-766-2219",
        last4: "2219",
        badgeText: "GCASH",
        isDefault: true
      }
    ]
  }
];

class AuthService {
  constructor() {
    this.subscribers = [];
    this.authIntent = 'account'; // 'account' | 'checkout'
    this.onAuthSuccessCallback = null;
    this.onAuthCancelCallback = null;
  }

  // --- CRYPTO HELPER ---
  async hashPassword(salt, password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // --- CUSTOMER AUTHENTICATION ---
  getCustomers() {
    try {
      const stored = localStorage.getItem('100201_customers');
      if (!stored) {
        localStorage.setItem('100201_customers', JSON.stringify(DEFAULT_CUSTOMERS));
        return DEFAULT_CUSTOMERS.map(c => ({
          ...c,
          paymentMethods: Array.isArray(c.paymentMethods) ? c.paymentMethods : []
        }));
      }
      const list = JSON.parse(stored);
      return list.map(c => ({
        ...c,
        paymentMethods: Array.isArray(c.paymentMethods) ? c.paymentMethods : []
      }));
    } catch (e) {
      return DEFAULT_CUSTOMERS;
    }
  }

  saveCustomers(customers) {
    localStorage.setItem('100201_customers', JSON.stringify(customers));
  }

  getCurrentCustomer() {
    try {
      const stored = localStorage.getItem('100201_current_customer');
      if (!stored) return null;
      const cust = JSON.parse(stored);
      if (cust) {
        const allCusts = this.getCustomers();
        const found = allCusts.find(c => c.id === cust.id || c.email.toLowerCase() === cust.email.toLowerCase());
        cust.paymentMethods = found && Array.isArray(found.paymentMethods) ? found.paymentMethods : (Array.isArray(cust.paymentMethods) ? cust.paymentMethods : []);
      }
      return cust;
    } catch (e) {
      return null;
    }
  }

  isCustomerLoggedIn() {
    return !!this.getCurrentCustomer();
  }

  // --- BUYER ACCOUNT ISOLATED PAYMENT METHODS ---
  getCurrentCustomerPaymentMethods() {
    const current = this.getCurrentCustomer();
    if (!current) return [];
    const customers = this.getCustomers();
    const found = customers.find(c => c.id === current.id || c.email.toLowerCase() === current.email.toLowerCase());
    return found && Array.isArray(found.paymentMethods) ? [...found.paymentMethods] : (Array.isArray(current.paymentMethods) ? [...current.paymentMethods] : []);
  }

  addCustomerPaymentMethod(pm) {
    const current = this.getCurrentCustomer();
    if (!current) return null;

    const customers = this.getCustomers();
    const customerIndex = customers.findIndex(c => c.id === current.id || c.email.toLowerCase() === current.email.toLowerCase());
    if (customerIndex === -1) return null;

    const customer = customers[customerIndex];
    if (!Array.isArray(customer.paymentMethods)) {
      customer.paymentMethods = [];
    }

    const newPm = {
      id: `pm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      type: pm.type || 'gcash',
      brand: pm.brand || (pm.type === 'gcash' ? 'GCash' : pm.type === 'maya' ? 'Maya' : pm.type === 'bdo' ? 'BDO Bank' : 'Visa Card'),
      accountName: pm.accountName || pm.cardHolder || customer.name,
      accountNumber: pm.accountNumber || (pm.last4 ? `•••• ${pm.last4}` : '0917-000-0000'),
      cardHolder: pm.cardHolder || null,
      last4: pm.last4 || (pm.accountNumber ? pm.accountNumber.replace(/\D/g, '').slice(-4) : '0000'),
      expiry: pm.expiry || null,
      badgeText: pm.badgeText || (pm.type === 'gcash' ? 'GCASH' : pm.type === 'maya' ? 'MAYA' : pm.type === 'bdo' ? 'BDO' : 'CARD'),
      isDefault: pm.isDefault || customer.paymentMethods.length === 0
    };

    if (newPm.isDefault) {
      customer.paymentMethods.forEach(p => (p.isDefault = false));
    }

    customer.paymentMethods.push(newPm);
    customers[customerIndex] = customer;
    this.saveCustomers(customers);

    // Update current active session
    current.paymentMethods = customer.paymentMethods;
    localStorage.setItem('100201_current_customer', JSON.stringify(current));

    this.notify();
    return newPm;
  }

  deleteCustomerPaymentMethod(id) {
    const current = this.getCurrentCustomer();
    if (!current) return false;

    const customers = this.getCustomers();
    const customerIndex = customers.findIndex(c => c.id === current.id || c.email.toLowerCase() === current.email.toLowerCase());
    if (customerIndex === -1) return false;

    const customer = customers[customerIndex];
    if (!Array.isArray(customer.paymentMethods)) return false;

    const wasDefault = customer.paymentMethods.find(p => p.id === id)?.isDefault;
    customer.paymentMethods = customer.paymentMethods.filter(p => p.id !== id);
    if (wasDefault && customer.paymentMethods.length > 0) {
      customer.paymentMethods[0].isDefault = true;
    }

    customers[customerIndex] = customer;
    this.saveCustomers(customers);

    current.paymentMethods = customer.paymentMethods;
    localStorage.setItem('100201_current_customer', JSON.stringify(current));

    this.notify();
    return true;
  }

  setDefaultCustomerPaymentMethod(id) {
    const current = this.getCurrentCustomer();
    if (!current) return false;

    const customers = this.getCustomers();
    const customerIndex = customers.findIndex(c => c.id === current.id || c.email.toLowerCase() === current.email.toLowerCase());
    if (customerIndex === -1) return false;

    const customer = customers[customerIndex];
    if (!Array.isArray(customer.paymentMethods)) return false;

    customer.paymentMethods.forEach(p => {
      p.isDefault = p.id === id;
    });

    customers[customerIndex] = customer;
    this.saveCustomers(customers);

    current.paymentMethods = customer.paymentMethods;
    localStorage.setItem('100201_current_customer', JSON.stringify(current));

    this.notify();
    return true;
  }

  async customerRegister(customerData) {
    const customers = this.getCustomers();
    const cleanEmail = customerData.email.trim().toLowerCase();

    if (MERCHANT_VALID_USERS.some(u => u.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'This email is reserved for store administration. Please sign in.' };
    }

    if (customers.some(c => c.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'An account with this email already exists. Please sign in.' };
    }

    if (!customerData.password || customerData.password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    const hashedPassword = await this.hashPassword(cleanEmail, customerData.password);

    const newCustomer = {
      id: `cust-${Date.now()}`,
      name: customerData.name.trim(),
      email: cleanEmail,
      phone: customerData.phone?.trim() || '',
      address: customerData.address?.trim() || '',
      city: customerData.city?.trim() || 'Pasig City',
      postalCode: customerData.postalCode?.trim() || '1600',
      passwordHash: hashedPassword,
      createdAt: new Date().toISOString(),
      paymentMethods: [] // Each created buyer account holds its own private payment methods
    };

    customers.push(newCustomer);
    this.saveCustomers(customers);

    // Auto login
    const sessionUser = { ...newCustomer };
    delete sessionUser.passwordHash;
    localStorage.setItem('100201_current_customer', JSON.stringify(sessionUser));

    this.notify();
    return { success: true, customer: sessionUser };
  }

  async customerLogin(email, password) {
    const customers = this.getCustomers();
    const cleanEmail = email.trim().toLowerCase();
    const customer = customers.find(c => c.email.toLowerCase() === cleanEmail);

    if (!customer) {
      return { success: false, error: 'No account found with this email. Please check or register.' };
    }

    const hashedInput = await this.hashPassword(cleanEmail, password);
    if (hashedInput !== customer.passwordHash) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }

    if (!Array.isArray(customer.paymentMethods)) {
      customer.paymentMethods = [];
      this.saveCustomers(customers);
    }

    const sessionUser = { ...customer };
    delete sessionUser.passwordHash;
    localStorage.setItem('100201_current_customer', JSON.stringify(sessionUser));

    this.notify();
    return { success: true, customer: sessionUser };
  }

  customerLogout() {
    localStorage.removeItem('100201_current_customer');
    this.notify();
  }

  // --- SECURE MERCHANT AUTHENTICATION ---
  isMerchantLoggedIn() {
    const token = sessionStorage.getItem('100201_merchant_token');
    const timestamp = sessionStorage.getItem('100201_merchant_token_time');

    if (!token || !timestamp) return false;

    const age = Date.now() - parseInt(timestamp, 10);
    if (age > SESSION_EXPIRY_MS) {
      this.merchantLogout();
      return false;
    }

    return true;
  }

  async merchantLogin(usernameOrEmail, password) {
    const cleanUser = usernameOrEmail.trim().toLowerCase();

    // Check rate limiting lockout
    const lockoutUntil = parseInt(sessionStorage.getItem('100201_merchant_lockout') || '0', 10);
    const now = Date.now();
    if (lockoutUntil > now) {
      const remainingSeconds = Math.ceil((lockoutUntil - now) / 1000);
      return {
        success: false,
        error: `Security lock active due to repeated failures. Please wait ${remainingSeconds}s.`
      };
    }

    const isUserValid = MERCHANT_VALID_USERS.some(u => u.toLowerCase() === cleanUser);
    const hashedInput = await this.hashPassword(MERCHANT_SALT, password);
    const isPasswordValid = hashedInput === MERCHANT_HASH;

    if (!isUserValid || !isPasswordValid) {
      let failCount = parseInt(sessionStorage.getItem('100201_merchant_fails') || '0', 10) + 1;
      sessionStorage.setItem('100201_merchant_fails', failCount.toString());

      if (failCount >= MAX_FAILED_ATTEMPTS) {
        sessionStorage.setItem('100201_merchant_lockout', (now + LOCKOUT_DURATION_MS).toString());
        sessionStorage.removeItem('100201_merchant_fails');
        return {
          success: false,
          error: `Too many failed attempts. Merchant portal locked for 60 seconds.`
        };
      }

      return {
        success: false,
        error: `Invalid merchant credentials. (${MAX_FAILED_ATTEMPTS - failCount} attempts remaining)`
      };
    }

    // Success: Generate secure session token
    const tokenBytes = new Uint8Array(24);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    sessionStorage.setItem('100201_merchant_token', token);
    sessionStorage.setItem('100201_merchant_token_time', Date.now().toString());
    sessionStorage.removeItem('100201_merchant_fails');
    sessionStorage.removeItem('100201_merchant_lockout');

    this.notify();
    return { success: true };
  }

  merchantLogout() {
    sessionStorage.removeItem('100201_merchant_token');
    sessionStorage.removeItem('100201_merchant_token_time');
    this.notify();
  }

  // --- UNIFIED SMART LOGIN (Auto-recognizes Merchant or Customer) ---
  async unifiedLogin(identifier, password) {
    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanPass = password || '';

    if (!cleanId) {
      return { success: false, error: 'Please enter your email address or username.' };
    }
    if (!cleanPass) {
      return { success: false, error: 'Please enter your password.' };
    }

    // 1. Check if the identifier is recognized as Merchant
    const isMerchantId = MERCHANT_VALID_USERS.some(u => u.toLowerCase() === cleanId);
    if (isMerchantId) {
      const merchantRes = await this.merchantLogin(cleanId, cleanPass);
      if (merchantRes.success) {
        return {
          success: true,
          role: 'merchant',
          message: 'Merchant credentials verified! Accessing Merchant Portal...'
        };
      }
      return {
        success: false,
        role: 'merchant',
        error: merchantRes.error
      };
    }

    // 2. Check if the identifier is recognized as a Customer
    const customerRes = await this.customerLogin(cleanId, cleanPass);
    if (customerRes.success) {
      return {
        success: true,
        role: 'customer',
        customer: customerRes.customer,
        message: `Welcome back, ${customerRes.customer.name}!`
      };
    }

    // 3. Neither matched
    return {
      success: false,
      error: customerRes.error || 'No account found with this email or username. Please check your credentials.'
    };
  }

  // --- OBSERVER ---
  subscribe(callback) {
    this.subscribers.push(callback);
  }

  notify() {
    this.subscribers.forEach(cb => cb());
  }
}

export const auth = new AuthService();

// --- UI CONTROLLER & MODALS ---
export function initAuth() {
  setupCustomerAuthModal();
  setupHeaderAccountButton();
  setupMerchantLoginView();

  auth.subscribe(() => {
    updateHeaderAccountUI();
  });

  updateHeaderAccountUI();
}

export function openCustomerAuthModal(intent = 'account', onSuccess = null, onCancel = null) {
  auth.authIntent = intent;
  auth.onAuthSuccessCallback = onSuccess;
  auth.onAuthCancelCallback = onCancel;

  const backdrop = document.getElementById('customer-auth-modal-backdrop');
  const checkoutNotice = document.getElementById('auth-checkout-prompt');
  const titleEl = document.getElementById('auth-modal-title');
  const subtitleEl = document.getElementById('auth-modal-subtitle');
  const badgeEl = document.getElementById('auth-modal-badge');

  if (checkoutNotice) {
    checkoutNotice.style.display = intent === 'checkout' ? 'flex' : 'none';
  }

  // Reset to Sign In tab by default
  const tabLogin = document.getElementById('auth-tab-login');
  const tabRegister = document.getElementById('auth-tab-register');
  const formLogin = document.getElementById('auth-form-login');
  const formRegister = document.getElementById('auth-form-register');

  if (tabLogin && tabRegister && formLogin && formRegister) {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.style.display = 'block';
    formRegister.style.display = 'none';
  }

  if (intent === 'checkout') {
    if (badgeEl) badgeEl.textContent = 'Checkout Verification';
    if (titleEl) titleEl.textContent = 'Log In';
    if (subtitleEl) subtitleEl.textContent = 'Log in or register to complete your order';
  } else {
    if (badgeEl) badgeEl.textContent = '100201 Football Shop';
    if (titleEl) titleEl.textContent = 'Log In';
    if (subtitleEl) subtitleEl.textContent = 'Welcome back • Log in to your account';
  }

  // Clear previous error banners
  const errEl = document.getElementById('auth-error-banner');
  if (errEl) {
    errEl.style.display = 'none';
    errEl.textContent = '';
  }

  if (backdrop) {
    backdrop.classList.add('open');
  }
}

export function closeCustomerAuthModal(isCancelled = true) {
  const backdrop = document.getElementById('customer-auth-modal-backdrop');
  if (backdrop) {
    backdrop.classList.remove('open');
  }

  if (isCancelled) {
    const cancelCb = auth.onAuthCancelCallback;
    auth.onAuthCancelCallback = null;
    auth.onAuthSuccessCallback = null;

    if (typeof cancelCb === 'function') {
      cancelCb();
    } else {
      // Safety guard: If user is not logged in and tracker or blank view was active, restore storefront
      const isLogged = auth.isCustomerLoggedIn() || auth.isMerchantLoggedIn();
      const storefrontView = document.getElementById('view-storefront');
      const trackerView = document.getElementById('view-tracker');
      if (!isLogged && (window.store?.getView?.() === 'tracker' || (storefrontView && storefrontView.style.display === 'none' && (!trackerView || trackerView.style.display !== 'block')))) {
        window.navigateToView?.('storefront');
      }
    }
  }
}

function setupCustomerAuthModal() {
  const closeBtn = document.getElementById('close-auth-modal-btn');
  const backdrop = document.getElementById('customer-auth-modal-backdrop');

  if (closeBtn) closeBtn.addEventListener('click', () => closeCustomerAuthModal(true));
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeCustomerAuthModal(true);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop && backdrop.classList.contains('open')) {
      closeCustomerAuthModal(true);
    }
  });

  // Tabs switching
  const tabLogin = document.getElementById('auth-tab-login');
  const tabRegister = document.getElementById('auth-tab-register');
  const formLogin = document.getElementById('auth-form-login');
  const formRegister = document.getElementById('auth-form-register');

  if (tabLogin && tabRegister && formLogin && formRegister) {
    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      formLogin.style.display = 'block';
      formRegister.style.display = 'none';

      const titleEl = document.getElementById('auth-modal-title');
      const subtitleEl = document.getElementById('auth-modal-subtitle');
      const badgeEl = document.getElementById('auth-modal-badge');
      if (titleEl) titleEl.textContent = 'Log In';
      if (subtitleEl) subtitleEl.textContent = 'Welcome back • Log in to your account';
      if (badgeEl) badgeEl.textContent = '100201 Football Shop';

      hideAuthError();
    });

    tabRegister.addEventListener('click', () => {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      formLogin.style.display = 'none';
      formRegister.style.display = 'block';

      const titleEl = document.getElementById('auth-modal-title');
      const subtitleEl = document.getElementById('auth-modal-subtitle');
      const badgeEl = document.getElementById('auth-modal-badge');
      if (titleEl) titleEl.textContent = 'Create Account';
      if (subtitleEl) subtitleEl.textContent = 'Join 100201 Football Shop for fast ordering & kit tracking';
      if (badgeEl) badgeEl.textContent = 'New Buyer Registration';

      hideAuthError();
    });
  }

  // Password reveal toggles
  document.querySelectorAll('.password-reveal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const inputId = btn.dataset.targetInput;
      const input = document.getElementById(inputId);
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
      }
    });
  });

  // Handle Login Form Submit with Automatic Merchant/Customer Detection
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifier = document.getElementById('login-email')?.value || '';
      const password = document.getElementById('login-password')?.value || '';

      const submitBtn = formLogin.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verifying...';
      }

      const res = await auth.unifiedLogin(identifier, password);

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In to Account';
      }

      if (!res.success) {
        showAuthError(res.error);
        return;
      }

      closeCustomerAuthModal();

      // Automatic recognition and role redirection
      if (res.role === 'merchant') {
        window.showToast?.('Merchant recognized! Opening Merchant Control Portal...', 'normal');
        window.navigateToView?.('admin');
        return;
      }

      // Customer role
      window.showToast?.(res.message, 'normal');
      finishAuthSuccess();
    });
  }

  // Handle Register Form Submit
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name')?.value || '';
      const email = document.getElementById('reg-email')?.value || '';
      const phone = document.getElementById('reg-phone')?.value || '';
      const address = document.getElementById('reg-address')?.value || '';
      const city = document.getElementById('reg-city')?.value || 'Pasig City';
      const postalCode = document.getElementById('reg-postal')?.value || '1600';
      const password = document.getElementById('reg-password')?.value || '';
      const confirmPassword = document.getElementById('reg-confirm-password')?.value || '';

      if (password !== confirmPassword) {
        showAuthError('Passwords do not match. Please re-enter.');
        return;
      }

      const res = await auth.customerRegister({
        name,
        email,
        phone,
        address,
        city,
        postalCode,
        password
      });

      if (!res.success) {
        showAuthError(res.error);
        return;
      }

      window.showToast?.(`Account created! Welcome, ${res.customer.name}!`, 'normal');
      finishAuthSuccess();
    });
  }
}

function showAuthError(msg) {
  const errEl = document.getElementById('auth-error-banner');
  if (errEl) {
    errEl.textContent = msg;
    errEl.style.display = 'block';
  }
}

function hideAuthError() {
  const errEl = document.getElementById('auth-error-banner');
  if (errEl) {
    errEl.style.display = 'none';
    errEl.textContent = '';
  }
}

function finishAuthSuccess() {
  const successCb = auth.onAuthSuccessCallback;
  auth.onAuthCancelCallback = null;
  auth.onAuthSuccessCallback = null;

  closeCustomerAuthModal(false);

  if (typeof successCb === 'function') {
    successCb();
  } else if (auth.authIntent === 'checkout') {
    window.openCheckoutModal?.();
  }
}

function setupHeaderAccountButton() {
  const authBtn = document.getElementById('user-auth-btn');
  const dropdown = document.getElementById('user-account-dropdown');

  if (authBtn && dropdown) {
    authBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!auth.isCustomerLoggedIn() && !auth.isMerchantLoggedIn()) {
        openCustomerAuthModal('account');
      } else {
        dropdown.classList.toggle('open');
      }
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== authBtn) {
        dropdown.classList.remove('open');
      }
    });

    const logoutBtn = document.getElementById('user-dropdown-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        const wasMerchant = auth.isMerchantLoggedIn();
        if (wasMerchant) {
          auth.merchantLogout();
          window.showToast?.('Merchant session closed.', 'info');
          window.navigateToView?.('storefront');
        } else {
          auth.customerLogout();
          window.showToast?.('Signed out successfully.', 'info');
          if (store.getView() === 'tracker') {
            window.navigateToView?.('storefront');
          }
        }
        dropdown.classList.remove('open');
      });
    }

    const trackerBtn = document.getElementById('user-dropdown-tracker');
    if (trackerBtn) {
      trackerBtn.addEventListener('click', () => {
        dropdown.classList.remove('open');
        if (auth.isMerchantLoggedIn()) {
          window.navigateToView?.('admin');
        } else {
          window.navigateToView?.('tracker');
        }
      });
    }

    const paymentsBtn = document.getElementById('user-dropdown-payments');
    if (paymentsBtn) {
      paymentsBtn.addEventListener('click', () => {
        dropdown.classList.remove('open');
        if (auth.isCustomerLoggedIn()) {
          window.openPaymentsModal?.();
        } else {
          openCustomerAuthModal('account');
        }
      });
    }
  }
}

export function updateHeaderAccountUI() {
  const authBtn = document.getElementById('user-auth-btn');
  const authLabel = document.getElementById('user-auth-label');
  const dropdownName = document.getElementById('user-dropdown-name');
  const dropdownEmail = document.getElementById('user-dropdown-email');
  const trackerBtn = document.getElementById('user-dropdown-tracker');
  const paymentsBtn = document.getElementById('user-dropdown-payments');

  const customer = auth.getCurrentCustomer();
  const isMerchant = auth.isMerchantLoggedIn();

  if (authBtn && authLabel) {
    if (isMerchant) {
      authBtn.classList.add('logged-in', 'merchant-user');
      authLabel.textContent = 'Merchant';
      authBtn.title = 'Merchant Control Session Active';

      if (dropdownName) dropdownName.textContent = 'Merchant Admin';
      if (dropdownEmail) dropdownEmail.textContent = 'admin@100201footballshop.ph';
      if (trackerBtn) {
        trackerBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          <span>Merchant Dashboard</span>
        `;
      }
      if (paymentsBtn) {
        paymentsBtn.style.display = 'none'; // Merchants manage the store, not customer buyer wallets
      }
    } else if (customer) {
      authBtn.classList.remove('merchant-user');
      authBtn.classList.add('logged-in');
      const firstName = customer.name.split(' ')[0] || 'Account';
      authLabel.textContent = firstName;
      authBtn.title = `Signed in as ${customer.name}`;

      if (dropdownName) dropdownName.textContent = customer.name;
      if (dropdownEmail) dropdownEmail.textContent = customer.email;
      if (trackerBtn) {
        trackerBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
          <span>Track My Orders</span>
        `;
      }
      if (paymentsBtn) {
        paymentsBtn.style.display = 'flex'; // Buyer account payment options
      }
    } else {
      authBtn.classList.remove('logged-in', 'merchant-user');
      authLabel.textContent = 'Sign In';
      authBtn.title = 'Sign In or Create Account';
      if (paymentsBtn) {
        paymentsBtn.style.display = 'none';
      }
    }
  }

  // Remove the bag option for the merchant
  const cartToggleBtn = document.getElementById('cart-toggle-btn');
  const mobNavCart = document.getElementById('mob-nav-cart');
  if (cartToggleBtn) {
    cartToggleBtn.style.display = isMerchant ? 'none' : 'flex';
  }
  if (mobNavCart) {
    mobNavCart.style.display = isMerchant ? 'none' : 'flex';
  }
  document.body.classList.toggle('merchant-logged-in', isMerchant);

  // Track Order option visibility: strictly available ONLY for logged-in accounts
  const navTracker = document.getElementById('nav-link-tracker');
  const mobTrack = document.getElementById('mob-nav-track');
  const footerTrackerItem = document.getElementById('footer-tracker-item');
  const heroTrackerBtn = document.getElementById('hero-tracker-btn');
  const hasTrackAccess = !!(customer || isMerchant);

  if (navTracker) {
    navTracker.style.display = hasTrackAccess ? 'inline-flex' : 'none';
  }
  if (mobTrack) {
    mobTrack.style.display = hasTrackAccess ? 'flex' : 'none';
  }
  if (footerTrackerItem) {
    footerTrackerItem.style.display = hasTrackAccess ? 'list-item' : 'none';
  }
  if (heroTrackerBtn) {
    heroTrackerBtn.style.display = hasTrackAccess ? 'inline-flex' : 'none';
  }

  const navLinksDock = document.querySelector('.nav-links');
  if (navLinksDock) {
    navLinksDock.style.display = hasTrackAccess ? 'flex' : 'none';
  }
}

function setupMerchantLoginView() {
  const merchantForm = document.getElementById('merchant-login-form');
  const merchantLogoutAdminBtn = document.getElementById('merchant-logout-admin-btn');

  if (merchantForm) {
    merchantForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = document.getElementById('merchant-username')?.value || '';
      const pass = document.getElementById('merchant-password')?.value || '';
      const submitBtn = document.getElementById('merchant-submit-btn');

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verifying Credentials...';
      }

      const res = await auth.unifiedLogin(user, pass);

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Access Merchant Dashboard';
      }

      if (!res.success) {
        const errBanner = document.getElementById('merchant-error-banner');
        if (errBanner) {
          errBanner.textContent = res.error;
          errBanner.style.display = 'block';
        }
        return;
      }

      if (res.role === 'merchant') {
        window.showToast?.('Merchant credentials verified. Welcome!', 'normal');
        window.navigateToView?.('admin');
      } else if (res.role === 'customer') {
        window.showToast?.(`Customer account recognized (${res.customer.name}). Redirecting to Storefront...`, 'normal');
        window.navigateToView?.('storefront');
      }
    });
  }

  const handleLogout = () => {
    auth.merchantLogout();
    window.showToast?.('Merchant session closed.', 'info');
    window.navigateToView?.('storefront');
  };

  if (merchantLogoutAdminBtn) merchantLogoutAdminBtn.addEventListener('click', handleLogout);
}
