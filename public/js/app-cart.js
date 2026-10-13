/**
 * MultiShop Sepet Scripti
 * Dinamik Sepet Tablosu, Miktar Güncelleme, Kupon Doğrulama ve Tutar Özeti
 */

document.addEventListener('DOMContentLoaded', () => {
  loadCart();
  setupCouponForm();
});

async function loadCart() {
  const tableBody = document.getElementById('cart-items-tbody');
  const subtotalEl = document.getElementById('cart-subtotal');
  const discountRow = document.getElementById('cart-discount-row');
  const discountEl = document.getElementById('cart-discount');
  const shippingEl = document.getElementById('cart-shipping');
  const totalEl = document.getElementById('cart-total');
  const checkoutBtn = document.getElementById('btn-proceed-checkout');
  const appliedCouponBox = document.getElementById('applied-coupon-box');

  if (!tableBody) return;

  try {
    const res = await fetch('/api/cart');
    const data = await res.json();

    if (!data.success || !data.cart || data.cart.items.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="py-5 text-center">
            <i class="fa fa-shopping-cart fa-3x text-muted mb-3"></i>
            <h4>Sepetinizde ürün bulunmamaktadır.</h4>
            <p class="text-muted">Hemen alışverişe başlayarak sepetinizi doldurabilirsiniz.</p>
            <a href="/shop.html" class="btn btn-primary mt-2 font-weight-bold">Alışverişe Başla</a>
          </td>
        </tr>
      `;
      subtotalEl.textContent = '0,00 TL';
      shippingEl.textContent = '0,00 TL';
      totalEl.textContent = '0,00 TL';
      if (discountRow) discountRow.style.display = 'none';
      if (appliedCouponBox) appliedCouponBox.innerHTML = '';
      if (checkoutBtn) {
        checkoutBtn.classList.add('disabled');
        checkoutBtn.removeAttribute('href');
      }
      updateNavCartBadge();
      return;
    }

    const cart = data.cart;

    // Render items
    tableBody.innerHTML = cart.items.map(item => `
      <tr>
        <td class="align-middle text-left">
          <div class="d-flex align-items-center">
            <img src="${item.product_image || 'img/product-1.jpg'}" alt="${item.product_name}" style="width: 55px; height: 55px; object-fit: cover; border-radius: 4px;" class="mr-3">
            <div>
              <a href="/detail.html?slug=${item.product_slug}" class="text-dark font-weight-bold text-decoration-none">${item.product_name}</a>
              <div class="small text-muted">
                Beden: <strong>${item.size}</strong> | Renk: <strong>${item.color}</strong> (SKU: ${item.sku})
              </div>
              ${item.stock <= 2 ? `<span class="badge badge-warning">Son ${item.stock} Adet!</span>` : ''}
            </div>
          </div>
        </td>
        <td class="align-middle font-weight-bold">${formatMoney(item.price_cents)}</td>
        <td class="align-middle">
          <div class="input-group quantity mx-auto" style="width: 110px;">
            <div class="input-group-btn">
              <button class="btn btn-sm btn-primary btn-cart-minus" data-id="${item.cart_item_id}" data-qty="${item.quantity - 1}">
                <i class="fa fa-minus"></i>
              </button>
            </div>
            <input type="text" class="form-control form-control-sm bg-secondary border-0 text-center font-weight-bold" value="${item.quantity}" readonly>
            <div class="input-group-btn">
              <button class="btn btn-sm btn-primary btn-cart-plus" data-id="${item.cart_item_id}" data-qty="${item.quantity + 1}" ${item.quantity >= item.stock ? 'disabled' : ''}>
                <i class="fa fa-plus"></i>
              </button>
            </div>
          </div>
        </td>
        <td class="align-middle font-weight-bold text-primary">${formatMoney(item.item_total_cents)}</td>
        <td class="align-middle">
          <button class="btn btn-sm btn-danger btn-cart-remove" data-id="${item.cart_item_id}" title="Sepetten Sil">
            <i class="fa fa-times"></i>
          </button>
        </td>
      </tr>
    `).join('');

    // Summary calculations
    subtotalEl.textContent = formatMoney(cart.subtotal_cents);
    shippingEl.textContent = cart.shipping_cents === 0 ? 'ÜCRETSİZ' : formatMoney(cart.shipping_cents);
    totalEl.textContent = formatMoney(cart.total_cents);

    // Coupon discount display
    if (cart.coupon && cart.discount_cents > 0) {
      if (discountRow) discountRow.style.display = 'flex';
      if (discountEl) discountEl.textContent = `-${formatMoney(cart.discount_cents)}`;
      if (appliedCouponBox) {
        appliedCouponBox.innerHTML = `
          <div class="alert alert-success d-flex justify-content-between align-items-center mb-3">
            <div>
              <i class="fa fa-tag mr-2"></i>
              <strong>${cart.coupon.code}</strong> kuponu uygulandı (${cart.coupon.discount_type === 'PERCENT' ? `%${cart.coupon.discount_value}` : formatMoney(cart.coupon.discount_cents)} indirim)
            </div>
            <button id="btn-remove-coupon" class="btn btn-sm btn-outline-danger py-0 px-2">Kaldır</button>
          </div>
        `;
        document.getElementById('btn-remove-coupon')?.addEventListener('click', handleRemoveCoupon);
      }
    } else {
      if (discountRow) discountRow.style.display = 'none';
      if (appliedCouponBox) appliedCouponBox.innerHTML = '';
    }

    // Enable checkout button
    if (checkoutBtn) {
      checkoutBtn.classList.remove('disabled');
      checkoutBtn.href = '/checkout.html';
    }

    // Attach row events
    tableBody.querySelectorAll('.btn-cart-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const qty = parseInt(btn.getAttribute('data-qty'), 10);
        updateItemQuantity(id, qty);
      });
    });

    tableBody.querySelectorAll('.btn-cart-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const qty = parseInt(btn.getAttribute('data-qty'), 10);
        updateItemQuantity(id, qty);
      });
    });

    tableBody.querySelectorAll('.btn-cart-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        removeCartItem(id);
      });
    });

    updateNavCartBadge();

  } catch (err) {
    console.error('Sepet yükleme hatası:', err);
  }
}

async function updateItemQuantity(cartItemId, newQty) {
  try {
    const res = await fetch('/api/cart/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart_item_id: cartItemId, quantity: newQty })
    });
    const data = await res.json();
    if (data.success) {
      loadCart();
    } else {
      showToast(data.error || 'Miktar güncellenemedi.', 'error');
    }
  } catch (err) {
    showToast('Bağlantı hatası.', 'error');
  }
}

async function removeCartItem(cartItemId) {
  try {
    const res = await fetch('/api/cart/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart_item_id: cartItemId })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Ürün sepetten çıkarıldı.', 'info');
      loadCart();
    } else {
      showToast(data.error || 'Silinemedi.', 'error');
    }
  } catch (err) {
    showToast('Bağlantı hatası.', 'error');
  }
}

function setupCouponForm() {
  const couponForm = document.getElementById('coupon-form');
  const couponInput = document.getElementById('coupon-code-input');

  couponForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = couponInput?.value.trim();
    if (!code) {
      showToast('Lütfen bir kupon kodu giriniz.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/cart/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Kupon başarıyla uygulandı!', 'success');
        couponInput.value = '';
        loadCart();
      } else {
        showToast(data.error || 'Kupon uygulanamadı.', 'error');
      }
    } catch (err) {
      showToast('Bağlantı hatası.', 'error');
    }
  });
}

async function handleRemoveCoupon() {
  try {
    const res = await fetch('/api/cart/coupon/remove', {
      method: 'POST'
    });
    const data = await res.json();
    if (data.success) {
      showToast('Kupon kaldırıldı.', 'info');
      loadCart();
    }
  } catch (err) {
    showToast('Bağlantı hatası.', 'error');
  }
}
