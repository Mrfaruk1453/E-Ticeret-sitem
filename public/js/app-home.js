/**
 * MultiShop Anasayfa Dinamik Veri Yükleyici
 */

document.addEventListener('DOMContentLoaded', async () => {
  loadCategories();
  loadHomeProducts();
});

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
            <div class="cat-item d-flex align-items-center mb-4 p-3 shadow-sm" style="transition: all 0.3s; border-radius: 4px;">
              <div class="overflow-hidden" style="width: 60px; height: 60px;">
                <img class="img-fluid" src="${cat.image || 'img/cat-1.jpg'}" alt="${cat.name}">
              </div>
              <div class="flex-fill pl-3">
                <h6 class="font-weight-bold text-dark m-0">${cat.name}</h6>
                <small class="text-muted">${cat.product_count} Ürün</small>
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
  } catch (err) {
    console.error('Anasayfa ürünleri yüklenemedi:', err);
  }
}

function renderProductCard(p) {
  const isOutOfStock = p.total_stock <= 0;
  return `
    <div class="col-lg-3 col-md-4 col-sm-6 pb-1">
      <div class="product-item bg-light mb-4 shadow-sm" style="border-radius: 4px; overflow: hidden;">
        <div class="product-img position-relative overflow-hidden">
          <img class="img-fluid w-100" src="${p.image || 'img/product-1.jpg'}" alt="${p.name}" style="height: 250px; object-fit: cover;">
          <div class="product-action">
            <a class="btn btn-outline-dark btn-square" href="/detail.html?slug=${p.slug}" title="İncele"><i class="fa fa-eye"></i></a>
            <a class="btn btn-outline-dark btn-square" href="/detail.html?slug=${p.slug}" title="Seçenekleri Gör"><i class="fa fa-shopping-cart"></i></a>
          </div>
          ${isOutOfStock ? `<span class="badge badge-danger position-absolute" style="top: 10px; right: 10px; font-size: 13px; padding: 6px 10px;">TÜKENDİ</span>` : ''}
        </div>
        <div class="text-center py-4 px-2">
          <small class="text-muted d-block mb-1">${p.category_name || 'E-Ticaret'}</small>
          <a class="h6 text-decoration-none text-truncate d-block font-weight-bold" href="/detail.html?slug=${p.slug}" title="${p.name}">${p.name}</a>
          <div class="d-flex align-items-center justify-content-center mt-2">
            <h5 class="text-primary font-weight-bold m-0">${formatMoney(p.base_price_cents)}</h5>
          </div>
          <div class="d-flex align-items-center justify-content-center mt-2">
            <small class="fa fa-star text-primary mr-1"></small>
            <small class="font-weight-bold mr-1">${p.rating.toFixed(1)}</small>
            <small class="text-muted">(${p.review_count})</small>
          </div>
          <div class="mt-3">
            <a href="/detail.html?slug=${p.slug}" class="btn btn-sm ${isOutOfStock ? 'btn-secondary disabled' : 'btn-primary'} btn-block font-weight-bold">
              ${isOutOfStock ? 'Tükendi' : '<i class="fa fa-shopping-cart mr-1"></i> İncele & Satın Al'}
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}
