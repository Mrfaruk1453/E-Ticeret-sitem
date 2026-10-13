/**
 * MultiShop Katalog & Filtreleme Scripti
 * Kategori, Fiyat Aralığı, Metin Araması, Renk, Beden ve Sıralama
 * "Seçim adreste saklanmalı" kuralı: Tüm filtreler URL query parametrelerine senkronize edilir.
 */

let currentFilters = {
  category: '',
  search: '',
  min_price: '',
  max_price: '',
  color: '',
  size: '',
  sort: 'newest',
  page: 1,
  limit: 9
};

document.addEventListener('DOMContentLoaded', async () => {
  readFiltersFromURL();
  await loadCategoriesSidebar();
  setupFilterEventListeners();
  fetchAndRenderCatalog();
});

// URL Query Parametrelerinden filtre durumunu okur
function readFiltersFromURL() {
  const params = new URLSearchParams(window.location.search);
  currentFilters.category = params.get('category') || '';
  currentFilters.search = params.get('search') || '';
  currentFilters.min_price = params.get('min_price') || '';
  currentFilters.max_price = params.get('max_price') || '';
  currentFilters.color = params.get('color') || '';
  currentFilters.size = params.get('size') || '';
  currentFilters.sort = params.get('sort') || 'newest';
  currentFilters.page = parseInt(params.get('page') || '1', 10);

  // Sync inputs
  const searchInput = document.getElementById('catalog-search-input');
  if (searchInput && currentFilters.search) {
    searchInput.value = currentFilters.search;
  }

  const sortSelect = document.getElementById('catalog-sort-select');
  if (sortSelect && currentFilters.sort) {
    sortSelect.value = currentFilters.sort;
  }
}

// Filtreleri URL Query Parametrelerine yazar ("seçim adreste saklanmalı")
function syncFiltersToURL() {
  const params = new URLSearchParams();
  if (currentFilters.category) params.set('category', currentFilters.category);
  if (currentFilters.search) params.set('search', currentFilters.search);
  if (currentFilters.min_price) params.set('min_price', currentFilters.min_price);
  if (currentFilters.max_price) params.set('max_price', currentFilters.max_price);
  if (currentFilters.color) params.set('color', currentFilters.color);
  if (currentFilters.size) params.set('size', currentFilters.size);
  if (currentFilters.sort && currentFilters.sort !== 'newest') params.set('sort', currentFilters.sort);
  if (currentFilters.page > 1) params.set('page', currentFilters.page);

  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.pushState(null, '', newUrl);
}

// Sol panel kategorilerini sunucudan yükler
async function loadCategoriesSidebar() {
  const container = document.getElementById('category-filter-list');
  if (!container) return;

  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    if (data.success && data.data) {
      container.innerHTML = `
        <div class="custom-control custom-radio d-flex align-items-center justify-content-between mb-3">
          <input type="radio" class="custom-control-input" id="cat-all" name="category-radio" value="" ${!currentFilters.category ? 'checked' : ''}>
          <label class="custom-control-label" for="cat-all">Tüm Kategoriler</label>
        </div>
        ${data.data.map(cat => `
          <div class="custom-control custom-radio d-flex align-items-center justify-content-between mb-3">
            <input type="radio" class="custom-control-input" id="cat-${cat.slug}" name="category-radio" value="${cat.slug}" ${currentFilters.category === cat.slug ? 'checked' : ''}>
            <label class="custom-control-label" for="cat-${cat.slug}">${cat.name}</label>
            <span class="badge border font-weight-normal">${cat.product_count}</span>
          </div>
        `).join('')}
      `;

      // Event listener for category radios
      container.querySelectorAll('input[name="category-radio"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          currentFilters.category = e.target.value;
          currentFilters.page = 1;
          syncFiltersToURL();
          fetchAndRenderCatalog();
        });
      });
    }
  } catch (err) {
    console.error('Kategoriler yüklenemedi:', err);
  }
}

// Filtre dinleyicilerini ayarlar
function setupFilterEventListeners() {
  // Fiyat filtreleri
  document.querySelectorAll('input[name="price-filter"]').forEach(radio => {
    // Check if matching current min/max
    const val = radio.value;
    if (val === `${currentFilters.min_price}-${currentFilters.max_price}`) {
      radio.checked = true;
    }
    radio.addEventListener('change', (e) => {
      const parts = e.target.value.split('-');
      currentFilters.min_price = parts[0] || '';
      currentFilters.max_price = parts[1] || '';
      currentFilters.page = 1;
      syncFiltersToURL();
      fetchAndRenderCatalog();
    });
  });

  // Renk filtreleri
  document.querySelectorAll('input[name="color-filter"]').forEach(radio => {
    if (radio.value === currentFilters.color) {
      radio.checked = true;
    }
    radio.addEventListener('change', (e) => {
      currentFilters.color = e.target.value;
      currentFilters.page = 1;
      syncFiltersToURL();
      fetchAndRenderCatalog();
    });
  });

  // Beden filtreleri
  document.querySelectorAll('input[name="size-filter"]').forEach(radio => {
    if (radio.value === currentFilters.size) {
      radio.checked = true;
    }
    radio.addEventListener('change', (e) => {
      currentFilters.size = e.target.value;
      currentFilters.page = 1;
      syncFiltersToURL();
      fetchAndRenderCatalog();
    });
  });

  // Arama inputu
  const searchForm = document.getElementById('catalog-search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('catalog-search-input');
      currentFilters.search = input ? input.value.trim() : '';
      currentFilters.page = 1;
      syncFiltersToURL();
      fetchAndRenderCatalog();
    });
  }

  // Sıralama seçici
  const sortSelect = document.getElementById('catalog-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentFilters.sort = e.target.value;
      currentFilters.page = 1;
      syncFiltersToURL();
      fetchAndRenderCatalog();
    });
  }

  // Filtreleri temizle butonu
  const resetBtn = document.getElementById('reset-filters-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      currentFilters = {
        category: '',
        search: '',
        min_price: '',
        max_price: '',
        color: '',
        size: '',
        sort: 'newest',
        page: 1,
        limit: 9
      };
      // Reset radio buttons
      document.querySelectorAll('input[type="radio"]').forEach(r => {
        if (r.value === '' || r.id === 'price-all' || r.id === 'color-all' || r.id === 'size-all' || r.id === 'cat-all') {
          r.checked = true;
        } else {
          r.checked = false;
        }
      });
      const searchInput = document.getElementById('catalog-search-input');
      if (searchInput) searchInput.value = '';
      syncFiltersToURL();
      fetchAndRenderCatalog();
    });
  }
}

// API'den filtreli ürünleri çeker ve DOM'u günceller
async function fetchAndRenderCatalog() {
  const container = document.getElementById('products-grid-container');
  const countBadge = document.getElementById('total-results-count');
  const activeFiltersDisplay = document.getElementById('active-filters-display');

  if (!container) return;

  container.innerHTML = `
    <div class="col-12 text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-2 text-muted">Ürünler yükleniyor...</p>
    </div>
  `;

  // Aktif filtre etiketleri
  if (activeFiltersDisplay) {
    const tags = [];
    if (currentFilters.category) tags.push(`Kategori: <strong>${currentFilters.category}</strong>`);
    if (currentFilters.search) tags.push(`Arama: "<strong>${currentFilters.search}</strong>"`);
    if (currentFilters.min_price || currentFilters.max_price) {
      tags.push(`Fiyat: <strong>${currentFilters.min_price || 0} - ${currentFilters.max_price || '∞'} TL</strong>`);
    }
    if (currentFilters.color) tags.push(`Renk: <strong>${currentFilters.color}</strong>`);
    if (currentFilters.size) tags.push(`Beden: <strong>${currentFilters.size}</strong>`);

    if (tags.length > 0) {
      activeFiltersDisplay.innerHTML = `
        <div class="alert alert-secondary py-2 px-3 mb-3 d-flex align-items-center justify-content-between flex-wrap" style="font-size: 14px;">
          <div><i class="fa fa-filter mr-1 text-primary"></i> Aktif Filtreler: ${tags.join(' | ')}</div>
          <button id="quick-reset-btn" class="btn btn-sm btn-outline-danger py-0 px-2 mt-1 mt-md-0">Filtreleri Temizle</button>
        </div>
      `;
      document.getElementById('quick-reset-btn')?.addEventListener('click', () => {
        document.getElementById('reset-filters-btn')?.click();
      });
    } else {
      activeFiltersDisplay.innerHTML = '';
    }
  }

  try {
    const query = new URLSearchParams();
    if (currentFilters.category) query.set('category', currentFilters.category);
    if (currentFilters.search) query.set('search', currentFilters.search);
    if (currentFilters.min_price) query.set('min_price', currentFilters.min_price);
    if (currentFilters.max_price) query.set('max_price', currentFilters.max_price);
    if (currentFilters.color) query.set('color', currentFilters.color);
    if (currentFilters.size) query.set('size', currentFilters.size);
    if (currentFilters.sort) query.set('sort', currentFilters.sort);
    query.set('page', currentFilters.page);
    query.set('limit', currentFilters.limit);

    const res = await fetch(`/api/products?${query.toString()}`);
    const data = await res.json();

    if (!data.success || !data.products || data.products.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-5">
          <i class="fa fa-search fa-3x text-muted mb-3"></i>
          <h4>Aradığınız kriterlere uygun ürün bulunamadı.</h4>
          <p class="text-muted">Filtreleri temizleyerek veya farklı bir arama yaparak tekrar deneyebilirsiniz.</p>
          <button class="btn btn-primary" onclick="document.getElementById('reset-filters-btn').click();">Tüm Ürünleri Göster</button>
        </div>
      `;
      if (countBadge) countBadge.textContent = '0 Ürün';
      renderPagination({ total: 0, totalPages: 0, page: 1 });
      return;
    }

    if (countBadge) {
      countBadge.textContent = `${data.pagination.total} Ürün Bulundu`;
    }

    container.innerHTML = data.products.map(p => {
      const isOutOfStock = p.total_stock <= 0;
      return `
        <div class="col-lg-4 col-md-6 col-sm-6 pb-1">
          <div class="product-item bg-light mb-4 shadow-sm" style="border-radius: 4px; overflow: hidden;">
            <div class="product-img position-relative overflow-hidden">
              <img class="img-fluid w-100" src="${p.image || 'img/product-1.jpg'}" alt="${p.name}" style="height: 260px; object-fit: cover;">
              <div class="product-action">
                <a class="btn btn-outline-dark btn-square" href="/detail.html?slug=${p.slug}"><i class="fa fa-eye"></i></a>
                <a class="btn btn-outline-dark btn-square" href="/detail.html?slug=${p.slug}"><i class="fa fa-shopping-cart"></i></a>
              </div>
              ${isOutOfStock ? `<span class="badge badge-danger position-absolute" style="top: 10px; right: 10px; font-size: 13px; padding: 6px 10px;">TÜKENDİ</span>` : ''}
            </div>
            <div class="text-center py-4 px-2">
              <small class="text-muted d-block mb-1">${p.category_name || ''}</small>
              <a class="h6 text-decoration-none text-truncate d-block font-weight-bold" href="/detail.html?slug=${p.slug}" title="${p.name}">${p.name}</a>
              <div class="d-flex align-items-center justify-content-center mt-2">
                <h5 class="text-primary font-weight-bold m-0">${formatMoney(p.base_price_cents)}</h5>
              </div>
              <div class="d-flex align-items-center justify-content-center mt-2">
                <small class="fa fa-star text-primary mr-1"></small>
                <small class="font-weight-bold mr-1">${p.rating.toFixed(1)}</small>
                <small class="text-muted">(${p.review_count})</small>
              </div>
              <div class="mt-2 text-muted" style="font-size: 12px;">
                ${p.variant_count > 1 ? `<span class="badge badge-info mr-1">${p.variant_count} Farklı Varyant</span>` : ''}
                ${!isOutOfStock ? `<span class="text-success"><i class="fa fa-check-circle"></i> Stokta Var</span>` : `<span class="text-danger font-weight-bold">Tükendi</span>`}
              </div>
              <div class="mt-3">
                <a href="/detail.html?slug=${p.slug}" class="btn btn-sm ${isOutOfStock ? 'btn-secondary disabled' : 'btn-primary'} btn-block font-weight-bold">
                  ${isOutOfStock ? 'Tükendi' : '<i class="fa fa-shopping-cart mr-1"></i> İncele & Seç'}
                </a>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    renderPagination(data.pagination);

  } catch (err) {
    container.innerHTML = `<div class="col-12 alert alert-danger">Katalog yüklenirken hata oluştu: ${err.message}</div>`;
  }
}

// Sayfalama kontrollerini oluşturur
function renderPagination(pagination) {
  const navContainer = document.getElementById('catalog-pagination');
  if (!navContainer) return;

  if (pagination.totalPages <= 1) {
    navContainer.innerHTML = '';
    return;
  }

  let html = `<ul class="pagination justify-content-center">`;

  // Previous button
  html += `
    <li class="page-item ${pagination.page <= 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${pagination.page - 1}">&laquo; Önceki</a>
    </li>
  `;

  // Page numbers
  for (let i = 1; i <= pagination.totalPages; i++) {
    html += `
      <li class="page-item ${i === pagination.page ? 'active' : ''}">
        <a class="page-link" href="#" data-page="${i}">${i}</a>
      </li>
    `;
  }

  // Next button
  html += `
    <li class="page-item ${pagination.page >= pagination.totalPages ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${pagination.page + 1}">Sonraki &raquo;</a>
    </li>
  `;

  html += `</ul>`;
  navContainer.innerHTML = html;

  // Add click handlers
  navContainer.querySelectorAll('a.page-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const pageNum = parseInt(link.getAttribute('data-page'), 10);
      if (pageNum && pageNum !== currentFilters.page && pageNum >= 1 && pageNum <= pagination.totalPages) {
        currentFilters.page = pageNum;
        syncFiltersToURL();
        fetchAndRenderCatalog();
        window.scrollTo({ top: 300, behavior: 'smooth' });
      }
    });
  });
}
