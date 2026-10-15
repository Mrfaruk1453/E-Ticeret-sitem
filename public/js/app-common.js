/**
 * MultiShop Ortak Yardımcı Fonksiyonlar
 * Kuruş Para Formatlama, Sepet Sayacı, Slide-Over Sepet Yan Paneli, Favoriler ve Bildirimler
 */

// Kuruş tamsayısını Türk Lirası para birimine dönüştürür
function formatMoney(cents) {
  if (cents === null || cents === undefined || isNaN(cents)) return '0,00 TL';
  return (cents / 100).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' TL';
}

// Navigasyon çubuğundaki sepet sayacını günceller
async function updateNavCartBadge() {
  try {
    const res = await fetch('/api/cart');
    const data = await res.json();
    if (data.success && data.cart) {
      const badges = document.querySelectorAll('.cart-badge');
      badges.forEach(b => {
        const prevCount = parseInt(b.textContent || '0', 10);
        const newCount = data.cart.item_count || 0;
        b.textContent = newCount;
        if (newCount !== prevCount) {
          b.classList.remove('badge-bounce');
          void b.offsetWidth; // trigger reflow
          b.classList.add('badge-bounce');
        }
      });
      return data.cart;
    }
  } catch (err) {
    console.warn('Sepet sayısı alınamadı:', err);
  }
  return null;
}

// Sayfa üzerinde modern bildirim (Toast / Alert) gösterir
function showToast(message, type = 'success') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.position = 'fixed';
    toastContainer.style.top = '24px';
    toastContainer.style.right = '24px';
    toastContainer.style.zIndex = '99999';
    document.body.appendChild(toastContainer);
  }

  const alertDiv = document.createElement('div');
  const bgClass = type === 'success' ? 'alert-success' : (type === 'danger' || type === 'error' ? 'alert-danger' : 'alert-info');
  const icon = type === 'success' ? 'fa-check-circle' : (type === 'danger' || type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');

  alertDiv.className = `alert ${bgClass} alert-dismissible fade show shadow-lg mb-2`;
  alertDiv.style.minWidth = '290px';
  alertDiv.style.borderRadius = '8px';
  alertDiv.style.fontSize = '14px';
  alertDiv.style.border = 'none';
  alertDiv.innerHTML = `
    <div class="d-flex align-items-center">
      <i class="fa ${icon} mr-2 fa-lg"></i>
      <strong class="flex-grow-1">${message}</strong>
      <button type="button" class="close ml-2" data-dismiss="alert" style="outline: none;">&times;</button>
    </div>
  `;

  toastContainer.appendChild(alertDiv);

  setTimeout(() => {
    alertDiv.classList.remove('show');
    setTimeout(() => alertDiv.remove(), 300);
  }, 4000);
}

// Kupon Kodunu Panoya Kopyalar
function copyCouponCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    showToast(`🎉 "${code}" kupon kodu kopyalandı! Sepette hemen kullanabilirsiniz.`, 'info');
  }).catch(() => {
    showToast(`Kupon Kodu: ${code}`, 'info');
  });
}

/* ==========================================================================
   Favoriler (Wishlist) Sistemi (LocalStorage)
   ========================================================================== */
function getWishlist() {
  try {
    const list = localStorage.getItem('multishop_wishlist');
    return list ? JSON.parse(list) : [];
  } catch (e) {
    return [];
  }
}

function isWishlisted(productId) {
  const list = getWishlist();
  return list.includes(Number(productId));
}

function toggleWishlist(productId, productName = 'Ürün') {
  const pId = Number(productId);
  let list = getWishlist();
  const exists = list.includes(pId);

  if (exists) {
    list = list.filter(id => id !== pId);
    showToast(`${productName} favorilerden çıkarıldı.`, 'info');
  } else {
    list.push(pId);
    showToast(`❤️ ${productName} favorilerinize eklendi!`, 'success');
  }

  localStorage.setItem('multishop_wishlist', JSON.stringify(list));

  // Sayfadaki tüm eşleşen kalp butonlarını güncelle
  document.querySelectorAll(`.btn-wishlist[data-product-id="${pId}"]`).forEach(btn => {
    if (exists) {
      btn.classList.remove('active');
      btn.innerHTML = '<i class="far fa-heart"></i>';
    } else {
      btn.classList.add('active');
      btn.innerHTML = '<i class="fas fa-heart"></i>';
    }
  });
}

/* ==========================================================================
   Slide-Over Cart Drawer (Sağdan Açılan Mini Sepet Yan Paneli)
   ========================================================================== */
function ensureCartDrawerElements() {
  let overlay = document.getElementById('cart-drawer-overlay');
  let drawer = document.getElementById('cart-drawer');

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'cart-drawer-overlay';
    overlay.className = 'cart-drawer-overlay';
    overlay.onclick = closeCartDrawer;
    document.body.appendChild(overlay);
  }

  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'cart-drawer';
    drawer.className = 'cart-drawer';
    drawer.innerHTML = `
      <div class="cart-drawer-header">
        <h5 class="cart-drawer-title"><i class="fa fa-shopping-bag text-primary mr-2"></i>Alışveriş Sepetim</h5>
        <button class="cart-drawer-close" onclick="closeCartDrawer()">&times;</button>
      </div>
      <div id="cart-drawer-shipping-box" class="free-shipping-box"></div>
      <div id="cart-drawer-items" class="cart-drawer-body">
        <div class="cart-drawer-empty">
          <i class="fa fa-shopping-cart cart-drawer-empty-icon"></i>
          <h6>Sepetiniz Yükleniyor...</h6>
        </div>
      </div>
      <div id="cart-drawer-footer" class="cart-drawer-footer" style="display: none;"></div>
    `;
    document.body.appendChild(drawer);
  }

  return { overlay, drawer };
}

async function openCartDrawer() {
  const { overlay, drawer } = ensureCartDrawerElements();
  overlay.classList.add('is-open');
  drawer.classList.add('is-open');
  document.body.style.overflow = 'hidden';

  await renderCartDrawer();
}

function closeCartDrawer() {
  const overlay = document.getElementById('cart-drawer-overlay');
  const drawer = document.getElementById('cart-drawer');
  if (overlay) overlay.classList.remove('is-open');
  if (drawer) drawer.classList.remove('is-open');
  document.body.style.overflow = '';
}

async function renderCartDrawer() {
  const itemsContainer = document.getElementById('cart-drawer-items');
  const shippingBox = document.getElementById('cart-drawer-shipping-box');
  const footerBox = document.getElementById('cart-drawer-footer');

  try {
    const res = await fetch('/api/cart');
    const json = await res.json();
    if (!json.success || !json.cart) return;

    const cart = json.cart;
    updateNavCartBadge();

    // Ücretsiz Kargo İlerleme Çubuğu (500 TL = 50000 kuruş)
    const thresholdCents = 50000;
    const subtotal = cart.subtotal_cents || 0;
    const remaining = Math.max(0, thresholdCents - subtotal);
    const percent = Math.min(100, Math.round((subtotal / thresholdCents) * 100));

    if (shippingBox) {
      if (percent >= 100) {
        shippingBox.innerHTML = `
          <div class="free-shipping-text">
            <span><i class="fa fa-check-circle text-success mr-1"></i> <strong>Tebrikler!</strong> Kargonuz <strong>Ücretsiz</strong>!</span>
            <span class="text-success font-weight-bold">%100</span>
          </div>
          <div class="free-shipping-bar-bg">
            <div class="free-shipping-bar-fill success" style="width: 100%;"></div>
          </div>
        `;
      } else {
        shippingBox.innerHTML = `
          <div class="free-shipping-text">
            <span>Ücretsiz Kargo için <strong>${formatMoney(remaining)}</strong> daha ekleyin</span>
            <span class="text-muted font-weight-bold">%${percent}</span>
          </div>
          <div class="free-shipping-bar-bg">
            <div class="free-shipping-bar-fill" style="width: ${percent}%;"></div>
          </div>
        `;
      }
    }

    // Sepet Boşsa
    if (!cart.items || cart.items.length === 0) {
      itemsContainer.innerHTML = `
        <div class="cart-drawer-empty">
          <i class="fa fa-shopping-bag cart-drawer-empty-icon"></i>
          <h5 class="font-weight-bold text-dark mb-2">Sepetiniz Boş</h5>
          <p class="small text-muted mb-4">Yeni sezon koleksiyonlarımıza göz atarak sepetinizi doldurabilirsiniz.</p>
          <a href="/shop.html" class="btn btn-primary btn-sm px-4 font-weight-bold" onclick="closeCartDrawer()">Alışverişe Başla</a>
        </div>
      `;
      if (footerBox) footerBox.style.display = 'none';
      return;
    }

    // Ürünleri Listele
    itemsContainer.innerHTML = cart.items.map(item => `
      <div class="cart-drawer-item">
        <img src="${item.product_image || 'img/product-1.jpg'}" alt="${item.product_name}" class="cart-drawer-item-img">
        <div class="cart-drawer-item-info">
          <a href="/detail.html?slug=${item.product_slug}" class="cart-drawer-item-name" title="${item.product_name}">
            ${item.product_name}
          </a>
          <div class="cart-drawer-item-meta">
            <span class="badge badge-light border">${item.size || 'Standart'}</span>
            <span class="badge badge-light border ml-1">${item.color || 'Standart'}</span>
          </div>
          <div class="cart-drawer-item-actions">
            <div class="cart-stepper">
              <button class="cart-stepper-btn" onclick="updateDrawerItemQty(${item.cart_item_id}, ${item.quantity - 1})">-</button>
              <span class="cart-stepper-val">${item.quantity}</span>
              <button class="cart-stepper-btn" onclick="updateDrawerItemQty(${item.cart_item_id}, ${item.quantity + 1})">+</button>
            </div>
            <span class="cart-drawer-item-price">${formatMoney(item.item_total_cents)}</span>
            <button class="cart-drawer-item-remove" onclick="removeDrawerItem(${item.cart_item_id})" title="Sil">
              <i class="fa fa-trash-alt"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');

    // Alt Toplam ve Butonlar
    if (footerBox) {
      footerBox.style.display = 'block';
      footerBox.innerHTML = `
        <div class="cart-drawer-summary-row">
          <span>Ara Toplam:</span>
          <span>${formatMoney(cart.subtotal_cents)}</span>
        </div>
        ${cart.discount_cents > 0 ? `
          <div class="cart-drawer-summary-row text-success">
            <span>İndirim (${cart.applied_coupon?.code || 'Kupon'}):</span>
            <span>-${formatMoney(cart.discount_cents)}</span>
          </div>
        ` : ''}
        <div class="cart-drawer-summary-row">
          <span>Kargo:</span>
          <span>${percent >= 100 ? '<strong class="text-success">ÜCRETSİZ</strong>' : '49,90 TL'}</span>
        </div>
        <div class="cart-drawer-total-row">
          <span>Toplam Tutar:</span>
          <span class="text-primary">${formatMoney(cart.total_cents)}</span>
        </div>
        <div class="cart-drawer-buttons">
          <a href="/cart.html" class="btn-drawer-cart" onclick="closeCartDrawer()">Sepete Git</a>
          <a href="/checkout.html" class="btn-drawer-checkout" onclick="closeCartDrawer()">
            <i class="fa fa-lock mr-2"></i> Siparişi Tamamla
          </a>
        </div>
      `;
    }

  } catch (err) {
    console.error('Sepet çekilemedi:', err);
  }
}

async function updateDrawerItemQty(itemId, newQty) {
  try {
    const res = await fetch('/api/cart/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart_item_id: itemId, quantity: newQty })
    });
    const json = await res.json();
    if (json.success) {
      renderCartDrawer();
      updateNavCartBadge();
    } else {
      showToast(json.error || 'Adet güncellenemedi.', 'danger');
    }
  } catch (err) {
    showToast('Bağlantı hatası.', 'danger');
  }
}

async function removeDrawerItem(itemId) {
  try {
    const res = await fetch('/api/cart/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart_item_id: itemId })
    });
    const json = await res.json();
    if (json.success) {
      renderCartDrawer();
      updateNavCartBadge();
      showToast('Ürün sepetten kaldırıldı.', 'info');
    } else {
      showToast(json.error || 'Ürün kaldırılamadı.', 'danger');
    }
  } catch (err) {
    showToast('Bağlantı hatası.', 'danger');
  }
}

// Kart Üzerinden Hızlı Sepete Ekleme Fonksiyonu
async function quickAddToCart(variantId, productName = 'Ürün') {
  if (!variantId) {
    showToast('Lütfen ürün detayından beden/renk seçiniz.', 'info');
    return;
  }

  try {
    const res = await fetch('/api/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant_id: Number(variantId), quantity: 1 })
    });
    const json = await res.json();
    if (json.success) {
      updateNavCartBadge();
      openCartDrawer();
      showToast(`✨ ${productName} sepete eklendi!`, 'success');
    } else {
      showToast(json.error || 'Sepete eklenemedi.', 'danger');
    }
  } catch (err) {
    showToast('Bağlantı hatası oluştu.', 'danger');
  }
}

/* ==========================================================================
   Scroll Reveal & Sticky Header Gözlemcisi
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  updateNavCartBadge();
  ensureCartDrawerElements();

  // Sticky Nav Gözlemcisi
  const navWrapper = document.querySelector('.sticky-nav-wrapper');
  if (navWrapper) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 80) {
        navWrapper.classList.add('is-scrolled');
      } else {
        navWrapper.classList.remove('is-scrolled');
      }
    });
  }

  // Scroll Reveal (Animasyonlu Yumuşak Giriş)
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal-on-scroll').forEach(el => observer.observe(el));
  } else {
    document.querySelectorAll('.reveal-on-scroll').forEach(el => el.classList.add('is-revealed'));
  }

  // Navigasyondaki sepet butonuna tıklandığında çekmeceyi aç
  document.querySelectorAll('.open-cart-drawer-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const isCartOrCheckoutPage = window.location.pathname.includes('cart.html') || window.location.pathname.includes('checkout.html');
      if (!isCartOrCheckoutPage) {
        e.preventDefault();
        openCartDrawer();
      }
    });
  });

  // Arama formu
  const searchForms = document.querySelectorAll('.header-search-form');
  searchForms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="text"]');
      if (input) {
        const query = encodeURIComponent(input.value.trim());
        window.location.href = `/shop.html?search=${query}`;
      }
    });
  });
});
