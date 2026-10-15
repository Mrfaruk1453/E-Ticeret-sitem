/**
 * MultiShop Anasayfa Dinamik Veri Yükleyici & Rafine Ürün Kartı Sistemi
 */

document.addEventListener('DOMContentLoaded', async () => {
  renderHomeSkeletons();
  loadCategories();
  loadHomeProducts();
});

// Veriler yüklenirken sayfa zıplamasını (CLS) önleyen şık skeleton yer tutucuları
function renderHomeSkeletons() {
  const featuredContainer = document.getElementById('featured-products-container');
  const recentContainer = document.getElementById('recent-products-container');

  const skeletonHtml = Array.from({ length: 4 }).map(() => `
    <div class="col-lg-3 col-md-4 col-sm-6 pb-1">
      <div class="skeleton-card">
        <div class="skeleton-box skeleton-img"></div>
        <div class="skeleton-box skeleton-text-sm mx-auto"></div>
        <div class="skeleton-box skeleton-text-md mx-auto"></div>
        <div class="skeleton-box skeleton-text-lg mx-auto"></div>
      </div>
    </div>
  `).join('');

  if (featuredContainer && featuredContainer.children.length <= 1) {
    featuredContainer.innerHTML = skeletonHtml;
  }
  if (recentContainer && recentContainer.children.length <= 1) {
    recentContainer.innerHTML = skeletonHtml;
  }
}

async function loadCategories() {
  const container = document.getElementById('categories-container');
  if (!container) return;

  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    if (data.success && data.data) {
      container.innerHTML = data.data.map(cat => `
        <div class="col-lg-2 col-md-4 col-sm-6 pb-1">
          <a class="text-decoration-none" href="/shop.html?category=${cat.slug}">
            <div class="cat-item d-flex align-items-center mb-4 p-3 shadow-sm" style="transition: all 0.3s; border-radius: 8px; border: 1px solid var(--border-subtle); background: #FFFFFF;">
              <div class="overflow-hidden" style="width: 54px; height: 54px; border-radius: 6px;">
                <img class="img-fluid" src="${cat.image || 'img/cat-1.jpg'}" alt="${cat.name}" style="width: 100%; height: 100%; object-fit: cover;">
              </div>
              <div class="flex-fill pl-3">
                <h6 class="font-weight-bold text-dark m-0" style="font-size: 14px;">${cat.name}</h6>
                <small class="text-muted" style="font-size: 12px;">${cat.product_count} Ürün</small>
              </div>
            </div>
          </a>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Kategoriler yüklenemedi:', err);
  }
}

async function loadHomeProducts() {
  const featuredContainer = document.getElementById('featured-products-container');
  const recentContainer = document.getElementById('recent-products-container');

  try {
    const res = await fetch('/api/home');
    const json = await res.json();
    if (!json.success || !json.data) return;

    if (featuredContainer) {
      featuredContainer.innerHTML = json.data.featured.map(renderProductCard).join('');
    }

    if (recentContainer) {
      recentContainer.innerHTML = json.data.recent.map(renderProductCard).join('');
    }

    // Scroll reveal animasyonlarını tetikle
    document.querySelectorAll('.modern-product-card').forEach((card, index) => {
      card.style.animationDelay = `${(index % 4) * 0.1}s`;
    });

  } catch (err) {
    console.error('Anasayfa ürünleri yüklenemedi:', err);
  }
}

function renderProductCard(p) {
  const isOutOfStock = p.total_stock <= 0;
  const wishlisted = isWishlisted(p.id);
  const escapedName = p.name.replace(/'/g, "\\'");

  return `
    <div class="col-lg-3 col-md-4 col-sm-6 pb-4">
      <div class="modern-product-card">
        <!-- Ürün Görseli & Rozetler -->
        <div class="modern-product-img-wrap">
          <a href="/detail.html?slug=${p.slug}">
            <img src="${p.image || 'img/product-1.jpg'}" alt="${p.name}" loading="lazy">
          </a>

          <!-- Favori Kalp Butonu -->
          <button class="btn-wishlist ${wishlisted ? 'active' : ''}" 
                  data-product-id="${p.id}" 
                  onclick="toggleWishlist(${p.id}, '${escapedName}')" 
                  title="${wishlisted ? 'Favorilerden Çıkar' : 'Favoriye Ekle'}">
            <i class="${wishlisted ? 'fas fa-heart text-danger' : 'far fa-heart'}"></i>
          </button>

          <!-- İndirim veya Stok Rozeti -->
          ${isOutOfStock 
            ? `<span class="card-badge-stock">TÜKENDİ</span>` 
            : (p.is_featured ? `<span class="card-badge-discount">%15 İNDİRİM</span>` : '')
          }

          <!-- Hızlı Sepete Ekle Butonu (Hover'da yukarı kayar) -->
          ${!isOutOfStock && p.default_variant_id ? `
            <div class="quick-add-overlay">
              <button class="btn-quick-add" onclick="quickAddToCart(${p.default_variant_id}, '${escapedName}')">
                <i class="fa fa-shopping-cart mr-2"></i> Hızlı Ekle
              </button>
            </div>
          ` : ''}
        </div>

        <!-- Ürün Bilgisi -->
        <div class="modern-product-info">
          <div>
            <div class="product-category-sub">${p.category_name || 'MultiShop Koleksiyonu'}</div>
            <a href="/detail.html?slug=${p.slug}" class="product-title-link" title="${p.name}">
              ${p.name}
            </a>
          </div>

          <div class="mt-2">
            <!-- Fiyat Satırı -->
            <div class="product-price-row">
              <span class="product-price-current">${formatMoney(p.base_price_cents)}</span>
              ${p.is_featured ? `
                <span class="product-price-old">${formatMoney(Math.round(p.base_price_cents * 1.18))}</span>
              ` : ''}
            </div>

            <!-- Yıldız Değerlendirmesi -->
            <div class="d-flex align-items-center justify-content-center">
              <small class="fa fa-star text-primary mr-1" style="font-size: 11px;"></small>
              <small class="font-weight-bold mr-1" style="font-size: 12px;">${p.rating ? p.rating.toFixed(1) : '4.8'}</small>
              <small class="text-muted" style="font-size: 11px;">(${p.review_count || 12})</small>
            </div>

            <!-- Renk / Seçenek Bilgisi -->
            ${p.color_count && p.color_count > 1 ? `
              <div class="product-colors-pill">${p.color_count} Renk Seçeneği</div>
            ` : ''}
          </div>

          <div class="mt-3">
            <a href="/detail.html?slug=${p.slug}" 
               class="btn btn-sm ${isOutOfStock ? 'btn-secondary disabled' : 'btn-outline-dark'} btn-block font-weight-bold" 
               style="border-radius: 6px; padding: 7px;">
              ${isOutOfStock ? 'Tükendi' : '<i class="fa fa-eye mr-1"></i> Detaylı İncele'}
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}
