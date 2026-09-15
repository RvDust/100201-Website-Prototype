import { store } from './store.js';
import { auth } from './auth.js';
import { openProductModal } from './admin.js';

let activeLeague = 'all';
let activeType = 'all';
let searchQuery = '';
let currentSort = 'featured';

export const CATALOG_PAGE_SIZE = 12;
let catalogCurrentPage = 1;

let selectedProductForModal = null;
let selectedSizeForModal = null;
let modalQuantity = 1;
let modalCustomName = '';
let modalCustomNumber = '';

export function initStorefront() {
  setupFilterEventListeners();
  renderCatalog();

  store.subscribe('products', () => {
    renderCatalog();
  });

  store.subscribe('currency', () => {
    renderCatalog();
  });
}

export function setCatalogLeagueFilter(league) {
  activeLeague = league;
  activeType = 'all';
  searchQuery = '';
  catalogCurrentPage = 1;

  const searchInput = document.getElementById('catalog-search-input');
  if (searchInput) searchInput.value = '';

  const searchClear = document.getElementById('catalog-search-clear');
  if (searchClear) searchClear.style.display = 'none';

  document.querySelectorAll('.league-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.league.toLowerCase() === league.toLowerCase());
  });

  document.querySelectorAll('.type-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.type === 'all');
  });

  renderCatalog();
}

function setupFilterEventListeners() {
  // League tabs
  const leagueTabs = document.querySelectorAll('.league-tab-btn');
  leagueTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      leagueTabs.forEach(t => t.classList.remove('active'));
      e.currentTarget.classList.add('active');
      activeLeague = e.currentTarget.dataset.league;
      catalogCurrentPage = 1;
      renderCatalog();
    });
  });

  // Type chips
  const typeChips = document.querySelectorAll('.type-chip');
  typeChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      typeChips.forEach(c => c.classList.remove('active'));
      e.currentTarget.classList.add('active');
      activeType = e.currentTarget.dataset.type;
      catalogCurrentPage = 1;
      renderCatalog();
    });
  });

  // Search input
  const searchInput = document.getElementById('catalog-search-input');
  const searchClear = document.getElementById('catalog-search-clear');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      catalogCurrentPage = 1;
      if (searchClear) {
        searchClear.style.display = searchQuery ? 'block' : 'none';
      }
      renderCatalog();
    });
  }

  if (searchClear && searchInput) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      catalogCurrentPage = 1;
      searchClear.style.display = 'none';
      renderCatalog();
    });
  }

  // Active filter reset button
  const resetFilterBtn = document.getElementById('active-filter-reset-pill');
  if (resetFilterBtn) {
    resetFilterBtn.addEventListener('click', () => {
      setCatalogLeagueFilter('all');
    });
  }

  // Sort dropdown
  const sortSelect = document.getElementById('catalog-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      catalogCurrentPage = 1;
      renderCatalog();
    });
  }


  // Quick View Modal Close
  const closeQuickViewBtn = document.getElementById('close-quickview-btn');
  const quickViewBackdrop = document.getElementById('quickview-modal-backdrop');
  if (closeQuickViewBtn && quickViewBackdrop) {
    closeQuickViewBtn.addEventListener('click', closeQuickView);
    quickViewBackdrop.addEventListener('click', (e) => {
      if (e.target === quickViewBackdrop) closeQuickView();
    });
  }

  // Hero Shop Button
  const heroShopBtn = document.getElementById('hero-shop-btn');
  if (heroShopBtn) {
    heroShopBtn.addEventListener('click', () => {
      const catalogEl = document.getElementById('catalog-section');
      if (catalogEl) catalogEl.scrollIntoView({ behavior: 'smooth' });
    });
  }


  // Initialize Hero Carousel
  initHeroCarousel();
}

let carouselTimer = null;
let currentSlide = 0;

export function initHeroCarousel() {
  const carouselCard = document.getElementById('hero-vault-carousel');
  if (!carouselCard) return;

  const slides = carouselCard.querySelectorAll('.hero-carousel-slide');
  const dots = carouselCard.querySelectorAll('.carousel-dot');
  const prevBtn = document.getElementById('hero-carousel-prev');
  const nextBtn = document.getElementById('hero-carousel-next');

  if (slides.length <= 1) return;

  function showSlide(index) {
    currentSlide = (index + slides.length) % slides.length;
    slides.forEach((s, idx) => {
      s.classList.toggle('active', idx === currentSlide);
    });
    dots.forEach((d, idx) => {
      d.classList.toggle('active', idx === currentSlide);
    });
  }

  function startRotation() {
    stopRotation();
    carouselTimer = setInterval(() => {
      showSlide(currentSlide + 1);
    }, 4500);
  }

  function stopRotation() {
    if (carouselTimer) {
      clearInterval(carouselTimer);
      carouselTimer = null;
    }
  }

  if (prevBtn) {
    prevBtn.onclick = (e) => {
      e.stopPropagation();
      showSlide(currentSlide - 1);
      startRotation();
    };
  }

  if (nextBtn) {
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      showSlide(currentSlide + 1);
      startRotation();
    };
  }

  dots.forEach(dot => {
    dot.onclick = (e) => {
      e.stopPropagation();
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      if (!isNaN(idx)) {
        showSlide(idx);
        startRotation();
      }
    };
  });

  carouselCard.onmouseenter = stopRotation;
  carouselCard.onmouseleave = startRotation;

  carouselCard.onclick = () => {
    const catalogEl = document.getElementById('catalog-section');
    if (catalogEl) catalogEl.scrollIntoView({ behavior: 'smooth' });
  };

  startRotation();
}

export function syncHeroCarouselWithProducts() {
  const track = document.getElementById('hero-carousel-track');
  const dotsContainer = document.getElementById('hero-carousel-dots');
  if (!track || !dotsContainer) return;

  const products = store.getProducts();
  if (products && products.length >= 2) {
    const featuredList = products.slice(0, 4);
    track.innerHTML = featuredList.map((p, idx) => {
      const isBest = p.featured;
      const isNew = p.isNew;
      const tag = isNew ? 'Newest Release' : (isBest ? 'Best Seller' : (p.type === 'Retro' ? 'Archive Vault' : 'Official Kit'));
      const badge = isNew ? 'NEW DROP // PASIG VAULT' : (isBest ? 'BEST SELLER // PASIG' : 'PHYSICAL STOCK');
      const tagClass = isNew ? 'new-tag' : (isBest ? 'best-tag' : (p.type === 'Retro' ? 'retro-tag' : 'terrace-tag'));
      return `
        <div class="hero-carousel-slide ${idx === 0 ? 'active' : ''}" data-index="${idx}">
          <img class="hero-card-img" src="${p.image}" alt="${p.name}" onerror="this.src='assets/products/brasil-06-1.jpg'">
          <div class="hero-card-floating-badge">
            <span>${badge}</span>
          </div>
          <div class="hero-card-overlay">
            <div>
              <span class="hero-card-tag ${tagClass}">${tag}</span>
              <div class="hero-card-name">${p.name}</div>
              <div class="hero-card-sub">${p.club} &bull; ${p.season} &bull; ${store.formatPrice(p.price)}</div>
            </div>
            <div class="hero-card-cta-pill">
              Customize &bull; ${store.formatPrice(p.price)} &rarr;
            </div>
          </div>
        </div>
      `;
    }).join('');

    dotsContainer.innerHTML = featuredList.map((_, idx) => `
      <span class="carousel-dot ${idx === 0 ? 'active' : ''}" data-index="${idx}"></span>
    `).join('');
  }

  initHeroCarousel();
}

export function renderCatalog() {
  syncHeroCarouselWithProducts();

  const container = document.getElementById('products-grid');
  if (!container) return;

  let products = store.getProducts();

  // Filter by League
  if (activeLeague !== 'all') {
    products = products.filter(p => p.league.toLowerCase() === activeLeague.toLowerCase());
  }

  // Filter by Type
  if (activeType !== 'all') {
    products = products.filter(p => p.type.toLowerCase() === activeType.toLowerCase());
  }

  // Filter by Search Query
  if (searchQuery) {
    products = products.filter(p =>
      p.name.toLowerCase().includes(searchQuery) ||
      p.club.toLowerCase().includes(searchQuery) ||
      p.league.toLowerCase().includes(searchQuery) ||
      p.season.toLowerCase().includes(searchQuery)
    );
  }

  // Sort
  if (currentSort === 'price-asc') {
    products.sort((a, b) => a.price - b.price);
  } else if (currentSort === 'price-desc') {
    products.sort((a, b) => b.price - a.price);
  } else if (currentSort === 'newest') {
    products.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
  }

  // Update counter & active reset pill
  const counterEl = document.getElementById('catalog-results-count');
  if (counterEl) {
    counterEl.textContent = `Showing ${products.length} ${products.length === 1 ? 'kit' : 'kits'} in Collection`;
  }

  const resetWrap = document.getElementById('filter-reset-wrap');
  if (resetWrap) {
    const isFiltered = activeLeague !== 'all' || activeType !== 'all' || searchQuery !== '';
    resetWrap.style.display = isFiltered ? 'block' : 'none';
  }

  const paginationContainer = document.getElementById('catalog-pagination-container');

  if (products.length === 0) {
    if (paginationContainer) paginationContainer.style.display = 'none';
    const isFiltered = activeLeague !== 'all' || activeType !== 'all' || searchQuery !== '';
    container.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <div class="empty-state-title">${isFiltered ? 'No matching jerseys found' : 'New Season Kits Dropping Soon'}</div>
        <div class="empty-state-text">${isFiltered ? 'We couldn\'t find any kits matching your current filters or search terms. Try clearing your search or browsing another league.' : 'Our collection is currently being updated with fresh on-hand kits & retro archives.'}</div>
        ${isFiltered
        ? `<button id="reset-filter-btn-empty" class="btn btn-primary btn-sm">&times; Clear All Filters</button>`
        : ''
      }
      </div>
    `;
    const resetEmptyBtn = document.getElementById('reset-filter-btn-empty');
    if (resetEmptyBtn) {
      resetEmptyBtn.addEventListener('click', () => {
        setCatalogLeagueFilter('all');
      });
    }
    return;
  }

  // Pagination slicing (12 kits per page)
  const totalPages = Math.ceil(products.length / CATALOG_PAGE_SIZE);
  catalogCurrentPage = Math.max(1, Math.min(catalogCurrentPage, totalPages));

  const startIndex = (catalogCurrentPage - 1) * CATALOG_PAGE_SIZE;
  const paginatedProducts = products.slice(startIndex, startIndex + CATALOG_PAGE_SIZE);

  container.innerHTML = paginatedProducts.map(kit => {
    const totalStock = Object.values(kit.stock || {}).reduce((a, b) => a + b, 0);
    const isSoldOut = totalStock === 0;
    const isPreOrder = kit.availability && kit.availability.toLowerCase().includes('pre-order');
    const photoCount = (kit.images && kit.images.length) || 1;

    return `
      <div class="product-card" data-product-id="${kit.id}">
        <div class="card-img-container">
          <img class="card-img" src="${kit.image}" alt="${kit.name}" loading="lazy" onerror="this.src='assets/products/brasil-06-1.jpg'">
          <div class="card-badges">
            ${kit.badge ? `<span class="badge ${kit.type === 'Retro' ? 'badge-retro' : 'badge-authentic'}">${kit.badge}</span>` : ''}
            <span class="badge ${isPreOrder ? 'badge-retro' : 'badge-new'}">
              ${isPreOrder ? '⚡ Pre-Order' : '✓ On-Hand'}
            </span>
          </div>
          <div class="card-photo-count-pill" title="Product Photo Gallery">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            ${photoCount} Photos
          </div>
          <div class="card-quick-view-overlay">
            <span class="card-quick-view-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              Preview & Customize (${photoCount} Photos)
            </span>
          </div>
        </div>
        <div class="card-info">
          <div class="card-club-meta">
            <span>${kit.club}</span>
            <span>${kit.season}</span>
          </div>
          <h4 class="card-title">${kit.name}</h4>
          
          <div class="card-sizes-row" title="Available Sizes">
            ${['S', 'M', 'L', 'XL', 'XXL'].map(sz => {
      const qty = kit.stock?.[sz] || 0;
      return `<span class="size-pill-tag ${qty > 0 ? 'in-stock' : 'out-of-stock'}">${sz}</span>`;
    }).join('')}
          </div>

          <div class="card-footer-row">
            <div class="card-price-block">
              <span class="current-price">${store.formatPrice(kit.price)}</span>
              ${kit.originalPrice ? `<span class="original-price">${store.formatPrice(kit.originalPrice)}</span>` : ''}
            </div>
            <button class="card-action-btn" data-action="quick-add" data-id="${kit.id}" ${isSoldOut ? 'disabled' : ''}>
              ${isSoldOut ? 'Sold Out' : 'Preview &rarr;'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => {
      const prodId = card.dataset.productId;
      const product = store.getProductById(prodId);
      if (product) openQuickView(product);
    });
  });

  // Render Catalog Pagination Controls
  if (paginationContainer) {
    if (totalPages > 1) {
      paginationContainer.style.display = 'flex';
      let html = `
        <button class="page-btn" id="catalog-prev-page" ${catalogCurrentPage === 1 ? 'disabled' : ''} title="Previous Page">&larr; Prev</button>
      `;

      for (let p = 1; p <= totalPages; p++) {
        html += `<button class="page-btn ${p === catalogCurrentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
      }

      html += `
        <button class="page-btn" id="catalog-next-page" ${catalogCurrentPage === totalPages ? 'disabled' : ''} title="Next Page">Next &rarr;</button>
      `;

      paginationContainer.innerHTML = html;

      paginationContainer.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          catalogCurrentPage = parseInt(e.target.dataset.page, 10);
          renderCatalog();
          document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
        });
      });

      document.getElementById('catalog-prev-page')?.addEventListener('click', () => {
        if (catalogCurrentPage > 1) {
          catalogCurrentPage--;
          renderCatalog();
          document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
        }
      });

      document.getElementById('catalog-next-page')?.addEventListener('click', () => {
        if (catalogCurrentPage < totalPages) {
          catalogCurrentPage++;
          renderCatalog();
          document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
        }
      });
    } else {
      paginationContainer.style.display = 'none';
      paginationContainer.innerHTML = '';
    }
  }
}

// Shimmer Skeleton Loader Renderer
export function renderCatalogSkeletons(count = 8) {
  const container = document.getElementById('products-grid');
  if (!container) return;
  container.innerHTML = Array.from({ length: count }).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-media skeleton-shimmer"></div>
      <div class="skeleton-content">
        <div class="skeleton-line skeleton-line-title skeleton-shimmer"></div>
        <div class="skeleton-line skeleton-line-subtitle skeleton-shimmer"></div>
        <div class="skeleton-line skeleton-line-price skeleton-shimmer"></div>
      </div>
    </div>
  `).join('');
}

// Client-side Canvas Image Compressor
export async function compressImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Invalid image file. Please choose a JPEG, PNG, or WebP photo.'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read photo file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to parse photo format'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mime, quality);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

let currentPreviewPhotoIdx = 0;
let currentPreviewImages = [];

export function openQuickView(product) {
  selectedProductForModal = product;
  modalQuantity = 1;
  modalCustomName = '';
  modalCustomNumber = '';
  currentPreviewPhotoIdx = 0;
  currentPreviewImages = (product.images && product.images.length > 0) ? product.images.slice(0, 4) : [product.image];

  const modalBackdrop = document.getElementById('quickview-modal-backdrop');
  const modalContainer = document.getElementById('quickview-modal-body');
  if (!modalBackdrop || !modalContainer) return;

  const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
  selectedSizeForModal = sizes.find(s => (product.stock?.[s] || 0) > 0) || 'M';

  renderQuickViewModalContent(product);
  modalBackdrop.classList.add('open');
  window.addEventListener('keydown', handleQuickViewKeydown);
}

function handleQuickViewKeydown(e) {
  const modalBackdrop = document.getElementById('quickview-modal-backdrop');
  if (!modalBackdrop || !modalBackdrop.classList.contains('open')) return;

  if (e.key === 'ArrowLeft') {
    changePreviewPhoto(-1);
  } else if (e.key === 'ArrowRight') {
    changePreviewPhoto(1);
  } else if (e.key === 'Escape') {
    closeQuickView();
  }
}

function changePreviewPhoto(direction) {
  if (!currentPreviewImages.length) return;
  let newIdx = currentPreviewPhotoIdx + direction;
  if (newIdx < 0) newIdx = currentPreviewImages.length - 1;
  if (newIdx >= currentPreviewImages.length) newIdx = 0;
  setPreviewPhoto(newIdx);
}

function setPreviewPhoto(idx) {
  if (!currentPreviewImages.length) return;
  currentPreviewPhotoIdx = idx;

  const mainImg = document.getElementById('preview-main-img');
  const badge = document.getElementById('preview-photo-badge');
  const thumbBtns = document.querySelectorAll('.gallery-thumb-btn');

  if (mainImg) {
    mainImg.style.opacity = '0.4';
    mainImg.src = currentPreviewImages[currentPreviewPhotoIdx];
    mainImg.onload = () => { mainImg.style.opacity = '1'; };
  }
  if (badge) {
    badge.textContent = `Photo ${currentPreviewPhotoIdx + 1} of ${currentPreviewImages.length}`;
  }
  thumbBtns.forEach((btn, i) => {
    btn.classList.toggle('active', i === currentPreviewPhotoIdx);
  });
}

function renderQuickViewModalContent(product) {
  const modalContainer = document.getElementById('quickview-modal-body');
  if (!modalContainer) return;

  const currentStockForSelected = product.stock?.[selectedSizeForModal] || 0;
  const isPreOrder = product.availability && product.availability.toLowerCase().includes('pre-order');
  const images = currentPreviewImages;

  modalContainer.innerHTML = `
    <div class="modal-product-detail">
      <!-- 4-PHOTO INTERACTIVE PREVIEW GALLERY -->
      <div class="product-preview-gallery" id="product-preview-gallery">
        <div class="gallery-viewport">
          <img id="preview-main-img" class="gallery-main-img" src="${images[currentPreviewPhotoIdx]}" alt="${product.name}" onerror="this.src='https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?auto=format&fit=crop&w=800&q=80'">
          
          <span class="gallery-photo-badge" id="preview-photo-badge">Photo 1 of ${images.length}</span>

          ${images.length > 1 ? `
            <button class="gallery-nav-btn prev" id="preview-nav-prev" aria-label="Previous Photo" title="Previous Photo (Left Arrow)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button class="gallery-nav-btn next" id="preview-nav-next" aria-label="Next Photo" title="Next Photo (Right Arrow)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          ` : ''}
        </div>

        <!-- 4 Thumbnail Strip -->
        <div class="gallery-thumbs-row">
          ${images.map((imgSrc, idx) => `
            <button class="gallery-thumb-btn ${idx === 0 ? 'active' : ''}" data-index="${idx}" title="Preview Photo ${idx + 1}">
              <img src="${imgSrc}" alt="Thumbnail ${idx + 1}" onerror="this.src='https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?auto=format&fit=crop&w=200&q=80'">
            </button>
          `).join('')}
        </div>
        <div class="gallery-hint">
          <span>Swipe or click arrows to view all ${images.length} photo angles</span>
        </div>
      </div>

      <div class="modal-prod-info">
        <div class="modal-prod-club">${product.club} &bull; ${product.league} &bull; ${product.season}</div>
        <h2 class="modal-prod-title">${product.name}</h2>
        
        <div class="modal-price-wrap">
          <span class="modal-current-price" id="modal-price-display">${store.formatPrice(product.price * modalQuantity)}</span>
          ${product.originalPrice ? `<span class="original-price" style="font-size:1.1rem;">${store.formatPrice(product.originalPrice)}</span>` : ''}
          <span class="badge ${isPreOrder ? 'badge-retro' : 'badge-new'}">${product.availability || 'On-Hand Ready'}</span>
        </div>

        <p class="modal-prod-desc">${product.description}</p>

        <!-- Sizing Selection -->
        <div class="size-selector-header">
          <span>Select Size:</span>
          <span class="size-chart-trigger" id="modal-open-sizechart-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
            Official Size Guide
          </span>
        </div>

        <div class="size-btn-group" id="quickview-size-group">
          ${['S', 'M', 'L', 'XL', 'XXL'].map(sz => {
    const stock = product.stock?.[sz] || 0;
    const isSelected = sz === selectedSizeForModal;
    return `
              <button class="size-btn ${isSelected ? 'selected' : ''}" 
                data-size="${sz}" 
                ${stock === 0 ? 'disabled' : ''}>
                <span>${sz}</span>
                <span class="size-stock-sub">${stock > 0 ? `${stock} left` : 'Out'}</span>
              </button>
            `;
  }).join('')}
        </div>

        <!-- Interactive Heat-Press Kit Lettering Customizer -->
        <div class="custom-print-box">
          <div class="custom-print-header">
            <div class="custom-print-label">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              <span>Official Heat-Press Custom Printing</span>
            </div>
            <span style="font-size: 0.72rem; color: var(--accent-pitch); font-weight: 700;">OPTIONAL / FREE</span>
          </div>

          <div class="custom-print-grid">
            <input type="text" id="custom-name-input" class="custom-print-input" placeholder="PLAYER / SURNAMES (e.g. MESSI)" maxlength="14" value="${modalCustomName}">
            <input type="text" id="custom-num-input" class="custom-print-input" placeholder="NUMBER (e.g. 10)" maxlength="2" value="${modalCustomNumber}">
          </div>

          <!-- Live Visual Jersey Canvas Preview -->
          <div class="jersey-preview-canvas" id="jersey-preview-box">
            <div class="jersey-preview-name" id="preview-render-name">YOUR NAME</div>
            <div class="jersey-preview-num" id="preview-render-num">10</div>
            <div class="jersey-preview-placeholder" id="preview-render-sub">Type above to preview live heat-press printing</div>
          </div>
        </div>

        <!-- Bottom Actions Row: Merchant Management vs Customer Bag -->
        ${auth.isMerchantLoggedIn() ? `
        <div class="modal-actions-row">
          <button id="modal-merchant-edit-btn" class="btn btn-primary modal-add-cart-btn" style="width: 100%; justify-content: center;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            <span>Edit Kit in Merchant Portal</span>
          </button>
        </div>
        ` : `
        <div class="modal-actions-row">
          <div class="qty-stepper-lg">
            <button class="qty-btn" id="modal-qty-minus">&minus;</button>
            <span class="qty-val" id="modal-qty-val">1</span>
            <button class="qty-btn" id="modal-qty-plus">&plus;</button>
          </div>

          <button id="modal-add-cart-btn" class="btn btn-primary modal-add-cart-btn" ${currentStockForSelected === 0 ? 'disabled' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            <span id="modal-add-btn-text">Add to Bag &bull; ${store.formatPrice(product.price)}</span>
          </button>
        </div>
        `}
      </div>
    </div>
  `;

  // Gallery interactions
  const prevBtn = document.getElementById('preview-nav-prev');
  const nextBtn = document.getElementById('preview-nav-next');
  if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); changePreviewPhoto(-1); });
  if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); changePreviewPhoto(1); });

  const thumbBtns = modalContainer.querySelectorAll('.gallery-thumb-btn');
  thumbBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index, 10);
      setPreviewPhoto(idx);
    });
  });

  // Mobile Touch Swipe on Gallery
  const viewportEl = modalContainer.querySelector('.gallery-viewport');
  if (viewportEl) {
    let startX = 0;
    let endX = 0;
    viewportEl.addEventListener('touchstart', (e) => {
      startX = e.changedTouches[0].screenX;
    }, { passive: true });
    viewportEl.addEventListener('touchend', (e) => {
      endX = e.changedTouches[0].screenX;
      if (startX - endX > 40) {
        changePreviewPhoto(1); // Swipe left -> Next photo
      } else if (endX - startX > 40) {
        changePreviewPhoto(-1); // Swipe right -> Prev photo
      }
    }, { passive: true });
  }

  // Hook up Size Buttons
  const sizeButtons = modalContainer.querySelectorAll('.size-btn');
  sizeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      sizeButtons.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedSizeForModal = btn.dataset.size;

      const stock = product.stock?.[selectedSizeForModal] || 0;
      const addBtn = document.getElementById('modal-add-cart-btn');
      if (addBtn) {
        addBtn.disabled = stock === 0;
      }
    });
  });

  // Hook up Size Chart Trigger
  const sizeChartBtn = document.getElementById('modal-open-sizechart-btn');
  if (sizeChartBtn) {
    sizeChartBtn.addEventListener('click', () => {
      window.openSizeChartModal?.();
    });
  }

  // Hook up Custom Lettering Live Preview
  const nameInput = document.getElementById('custom-name-input');
  const numInput = document.getElementById('custom-num-input');
  const previewName = document.getElementById('preview-render-name');
  const previewNum = document.getElementById('preview-render-num');
  const previewSub = document.getElementById('preview-render-sub');

  function updateLetteringPreview() {
    const rawName = (nameInput?.value || '').trim().toUpperCase();
    const rawNum = (numInput?.value || '').trim().replace(/[^0-9]/g, '');

    modalCustomName = rawName;
    modalCustomNumber = rawNum;

    if (previewName) previewName.textContent = rawName || 'YOUR NAME';
    if (previewNum) previewNum.textContent = rawNum || '10';

    if (previewSub) {
      if (rawName || rawNum) {
        previewSub.textContent = `Applied to ${product.club} ${product.season} Backplate`;
        previewSub.style.color = 'var(--accent-pitch)';
      } else {
        previewSub.textContent = 'Type above to preview live heat-press printing';
        previewSub.style.color = 'var(--text-muted)';
      }
    }
  }

  if (nameInput) nameInput.addEventListener('input', updateLetteringPreview);
  if (numInput) numInput.addEventListener('input', updateLetteringPreview);

  // Hook up Quantity Stepper
  const qtyMinus = document.getElementById('modal-qty-minus');
  const qtyPlus = document.getElementById('modal-qty-plus');
  const qtyVal = document.getElementById('modal-qty-val');
  const priceDisplay = document.getElementById('modal-price-display');
  const addBtnText = document.getElementById('modal-add-btn-text');

  function updateQuantityDisplay() {
    if (qtyVal) qtyVal.textContent = modalQuantity;
    const total = product.price * modalQuantity;
    if (priceDisplay) priceDisplay.textContent = store.formatPrice(total);
    if (addBtnText) addBtnText.textContent = `Add to Bag \u2022 ${store.formatPrice(total)}`;
  }

  if (qtyMinus) {
    qtyMinus.addEventListener('click', () => {
      if (modalQuantity > 1) {
        modalQuantity--;
        updateQuantityDisplay();
      }
    });
  }

  if (qtyPlus) {
    qtyPlus.addEventListener('click', () => {
      const maxAvailable = product.stock?.[selectedSizeForModal] || 10;
      if (modalQuantity < maxAvailable) {
        modalQuantity++;
        updateQuantityDisplay();
      } else {
        window.showToast?.(`Only ${maxAvailable} available in stock`, 'info');
      }
    });
  }

  // Hook up Add to Cart Button (Customers only)
  const addCartBtn = document.getElementById('modal-add-cart-btn');
  if (addCartBtn) {
    addCartBtn.addEventListener('click', () => {
      let customPrintText = '';
      if (modalCustomName || modalCustomNumber) {
        customPrintText = `${modalCustomName || 'CUSTOM'} #${modalCustomNumber || '00'}`;
      }

      store.addToCart(product, selectedSizeForModal, customPrintText, modalQuantity);
      closeQuickView();
      window.showToast?.(`Added ${modalQuantity}x ${product.name} (${selectedSizeForModal}) to bag!`);
      window.openCartDrawer?.();
    });
  }

  // Hook up Merchant Edit Kit button
  const merchantEditBtn = document.getElementById('modal-merchant-edit-btn');
  if (merchantEditBtn) {
    merchantEditBtn.addEventListener('click', () => {
      closeQuickView();
      window.navigateToView?.('admin');
      openProductModal(product);
    });
  }
}

export function closeQuickView() {
  const modalBackdrop = document.getElementById('quickview-modal-backdrop');
  if (modalBackdrop) modalBackdrop.classList.remove('open');
  window.removeEventListener('keydown', handleQuickViewKeydown);
  selectedProductForModal = null;
}
