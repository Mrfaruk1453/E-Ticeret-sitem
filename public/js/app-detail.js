/**
 * MultiShop Ürün Detay & Varyant Yönetimi Scripti
 * Beden, Renk Seçimi, Anlık Stok Takibi ve "Tükendi" Durumu
 */

let currentProduct = null;
let selectedSize = null;
let selectedColor = null;
let selectedVariant = null;

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug') || params.get('id');

  if (!slug) {
    window.location.href = '/shop.html';
    return;
  }

  await loadProductDetail(slug);
});

async function loadProductDetail(slug) {
  try {
    const res = await fetch(`/api/products/${slug}`);
    const data = await res.json();

    if (!data.success || !data.data) {
      document.getElementById('product-detail-container').innerHTML = `
        <div class="col-12 text-center py-5">
          <h3>Ürün bulunamadı.</h3>
          <a href="/shop.html" class="btn btn-primary mt-3">Mağazaya Dön</a>
        </div>
      `;
      return;
    }

    currentProduct = data.data;
    renderProductDetail(currentProduct);
  } catch (err) {
    console.error('Ürün detay hatası:', err);
  }
}

function renderProductDetail(p) {
  // Update breadcrumbs and titles
  document.title = `${p.name} - MultiShop`;
  const nameEls = document.querySelectorAll('.product-title');
  nameEls.forEach(el => el.textContent = p.name);

  const catEls = document.querySelectorAll('.product-category');
  catEls.forEach(el => {
    el.textContent = p.category_name || '';
    if (el.tagName === 'A') el.href = `/shop.html?category=${p.category_slug}`;
  });

  // Base price
  document.getElementById('product-price').textContent = formatMoney(p.base_price_cents);
  document.getElementById('product-description').textContent = p.description || 'Kaliteli ve şık tasarım.';
  document.getElementById('product-reviews-count').textContent = `(${p.review_count} Değerlendirme)`;
  document.getElementById('product-rating-val').textContent = p.rating.toFixed(1);

  // Images
  const mainImg = document.getElementById('product-main-image');
  if (mainImg) {
    mainImg.src = p.image || 'img/product-1.jpg';
    mainImg.alt = p.name;
  }

  // Render Size Options
  const sizeContainer = document.getElementById('variant-sizes-container');
  if (sizeContainer) {
    sizeContainer.innerHTML = p.available_sizes.map((size, idx) => `
      <div class="custom-control custom-radio custom-control-inline mr-3 mb-2">
        <input type="radio" class="custom-control-input variant-size-radio" id="size-${idx}" name="size" value="${size}" ${idx === 0 ? 'checked' : ''}>
        <label class="custom-control-label font-weight-bold" for="size-${idx}" style="cursor: pointer; padding-left: 24px;">${size}</label>
      </div>
    `).join('');

    selectedSize = p.available_sizes[0];

    sizeContainer.querySelectorAll('.variant-size-radio').forEach(radio => {
      radio.addEventListener('change', (e) => {
        selectedSize = e.target.value;
        onVariantSelectionChanged();
      });
    });
  }

  // Render Color Options
  const colorContainer = document.getElementById('variant-colors-container');
  if (colorContainer) {
    colorContainer.innerHTML = p.available_colors.map((color, idx) => `
      <div class="custom-control custom-radio custom-control-inline mr-3 mb-2">
        <input type="radio" class="custom-control-input variant-color-radio" id="color-${idx}" name="color" value="${color}" ${idx === 0 ? 'checked' : ''}>
        <label class="custom-control-label font-weight-bold" for="color-${idx}" style="cursor: pointer; padding-left: 24px;">${color}</label>
      </div>
    `).join('');

    selectedColor = p.available_colors[0];

    colorContainer.querySelectorAll('.variant-color-radio').forEach(radio => {
      radio.addEventListener('change', (e) => {
        selectedColor = e.target.value;
        onVariantSelectionChanged();
      });
    });
  }

  // Initial variant check
  onVariantSelectionChanged();

  // Setup quantity controls
  const qtyInput = document.getElementById('product-quantity-input');
  const minusBtn = document.getElementById('btn-qty-minus');
  const plusBtn = document.getElementById('btn-qty-plus');

  minusBtn?.addEventListener('click', () => {
    let val = parseInt(qtyInput.value, 10) || 1;
    if (val > 1) {
      qtyInput.value = val - 1;
    }
  });

  plusBtn?.addEventListener('click', () => {
    let val = parseInt(qtyInput.value, 10) || 1;
    const maxStock = selectedVariant ? selectedVariant.stock : 1;
    if (val < maxStock) {
      qtyInput.value = val + 1;
    } else {
      showToast(`Bu varyant için en fazla ${maxStock} adet seçebilirsiniz.`, 'error');
    }
  });

  // Setup Add to Cart button
  const addToCartBtn = document.getElementById('btn-add-to-cart');
  addToCartBtn?.addEventListener('click', handleAddToCart);

  // Render related products
  renderRelatedProducts(p.related_products);
}

// Beden veya Renk değiştiğinde çalışan stok kontrol mantığı
function onVariantSelectionChanged() {
  const stockBadge = document.getElementById('variant-stock-status');
  const skuDisplay = document.getElementById('variant-sku-display');
  const priceDisplay = document.getElementById('product-price');
  const addToCartBtn = document.getElementById('btn-add-to-cart');
  const qtyInput = document.getElementById('product-quantity-input');

  if (!currentProduct || !currentProduct.variants) return;

  // Find exact matching variant
  selectedVariant = currentProduct.variants.find(v => v.size === selectedSize && v.color === selectedColor);

  if (!selectedVariant) {
    // If exact combination doesn't exist, fallback to first variant with matching size or color
    selectedVariant = currentProduct.variants.find(v => v.size === selectedSize) || currentProduct.variants[0];
  }

  if (selectedVariant) {
    skuDisplay.textContent = `SKU: ${selectedVariant.sku}`;
    priceDisplay.textContent = formatMoney(selectedVariant.price_cents);

    if (selectedVariant.stock > 0) {
      stockBadge.innerHTML = `
        <span class="badge badge-success px-2 py-1"><i class="fa fa-check-circle mr-1"></i> Stokta ${selectedVariant.stock} Adet Var</span>
      `;
      addToCartBtn.disabled = false;
      addToCartBtn.classList.remove('btn-secondary');
      addToCartBtn.classList.add('btn-primary');
      addToCartBtn.innerHTML = '<i class="fa fa-shopping-cart mr-1"></i> Sepete Ekle';
      qtyInput.disabled = false;
      qtyInput.value = '1';
      qtyInput.max = selectedVariant.stock;
    } else {
      // Stoğu tükenen varyant "tükendi" görünmeli
      stockBadge.innerHTML = `
        <span class="badge badge-danger px-2 py-1"><i class="fa fa-times-circle mr-1"></i> TÜKENDİ</span>
      `;
      addToCartBtn.disabled = true;
      addToCartBtn.classList.remove('btn-primary');
      addToCartBtn.classList.add('btn-secondary');
      addToCartBtn.innerHTML = '<i class="fa fa-ban mr-1"></i> Tükendi (Stok Yok)';
      qtyInput.disabled = true;
      qtyInput.value = '0';
    }
  }
}

// Sepete Ekleme İsteği
async function handleAddToCart() {
  if (!selectedVariant) {
    showToast('Lütfen geçerli bir varyant seçiniz.', 'error');
    return;
  }

  if (selectedVariant.stock <= 0) {
    showToast('Bu ürünün seçilen varyantı tükenmiştir.', 'error');
    return;
  }

  const qtyInput = document.getElementById('product-quantity-input');
  const quantity = parseInt(qtyInput?.value, 10) || 1;

  if (quantity > selectedVariant.stock) {
    showToast(`Stok miktarından fazla ürün ekleyemezsiniz (Maks: ${selectedVariant.stock}).`, 'error');
    return;
  }

  const btn = document.getElementById('btn-add-to-cart');
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa fa-spinner fa-spin mr-1"></i> Ekleniyor...';

  try {
    const res = await fetch('/api/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variant_id: selectedVariant.id,
        quantity
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast(`✨ ${currentProduct.name} (${selectedVariant.size}/${selectedVariant.color}) sepete eklendi!`, 'success');
      updateNavCartBadge();
      if (typeof openCartDrawer === 'function') {
        openCartDrawer();
      }
    } else {
      showToast(data.error || 'Sepete eklenirken hata oluştu.', 'error');
    }
  } catch (err) {
    showToast('Bağlantı hatası oluştu.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
  }
}

function renderRelatedProducts(related) {
  const container = document.getElementById('related-products-container');
  if (!container || !related || related.length === 0) return;

  container.innerHTML = related.map(p => {
    const wishlisted = typeof isWishlisted === 'function' ? isWishlisted(p.id) : false;
    const escapedName = p.name.replace(/'/g, "\\'");

    return `
      <div class="col-lg-3 col-md-4 col-sm-6 pb-4">
        <div class="modern-product-card">
          <div class="modern-product-img-wrap" style="height: 220px;">
            <a href="/detail.html?slug=${p.slug}">
              <img src="${p.image || 'img/product-1.jpg'}" alt="${p.name}" loading="lazy">
            </a>
            <button class="btn-wishlist ${wishlisted ? 'active' : ''}" 
                    data-product-id="${p.id}" 
                    onclick="toggleWishlist(${p.id}, '${escapedName}')" 
                    title="${wishlisted ? 'Favorilerden Çıkar' : 'Favoriye Ekle'}">
              <i class="${wishlisted ? 'fas fa-heart text-danger' : 'far fa-heart'}"></i>
            </button>
          </div>
          <div class="modern-product-info p-3">
            <a href="/detail.html?slug=${p.slug}" class="product-title-link mb-2" title="${p.name}">
              ${p.name}
            </a>
            <div class="product-price-current mt-1">${formatMoney(p.base_price_cents)}</div>
            <a href="/detail.html?slug=${p.slug}" class="btn btn-sm btn-outline-dark btn-block font-weight-bold mt-2" style="border-radius: 6px;">
              İncele
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}
