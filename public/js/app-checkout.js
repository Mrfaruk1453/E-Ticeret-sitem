/**
 * MultiShop Ödeme (Checkout) Scripti
 * Deneme Ortamı (Sandbox) Test Kartları, Başarılı ve Başarısız Senaryo Yönetimi
 */

let currentCart = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadCheckoutSummary();
  setupTestCardButtons();
  setupCheckoutForm();
});

async function loadCheckoutSummary() {
  const container = document.getElementById('checkout-items-list');
  const subtotalEl = document.getElementById('checkout-subtotal');
  const discountRow = document.getElementById('checkout-discount-row');
  const discountEl = document.getElementById('checkout-discount');
  const shippingEl = document.getElementById('checkout-shipping');
  const totalEl = document.getElementById('checkout-total');

  try {
    const res = await fetch('/api/cart');
    const data = await res.json();

    if (!data.success || !data.cart || data.cart.items.length === 0) {
      alert('Sepetiniz boş. Lütfen önce ürün ekleyiniz.');
      window.location.href = '/cart.html';
      return;
    }

    currentCart = data.cart;

    if (container) {
      container.innerHTML = currentCart.items.map(item => `
        <div class="d-flex justify-content-between mb-2">
          <div>
            <strong>${item.product_name}</strong>
            <div class="small text-muted">${item.size} / ${item.color} &times; ${item.quantity} adet</div>
          </div>
          <span class="font-weight-bold">${formatMoney(item.item_total_cents)}</span>
        </div>
      `).join('');
    }

    if (subtotalEl) subtotalEl.textContent = formatMoney(currentCart.subtotal_cents);
    if (shippingEl) shippingEl.textContent = currentCart.shipping_cents === 0 ? 'ÜCRETSİZ' : formatMoney(currentCart.shipping_cents);
    if (totalEl) totalEl.textContent = formatMoney(currentCart.total_cents);

    if (currentCart.discount_cents > 0) {
      if (discountRow) discountRow.style.display = 'flex';
      if (discountEl) discountEl.textContent = `-${formatMoney(currentCart.discount_cents)}`;
    } else if (discountRow) {
      discountRow.style.display = 'none';
    }

  } catch (err) {
    console.error('Ödeme özeti yüklenemedi:', err);
  }
}

// Sandbox Test Kartlarını Tek Tıkla Doldurma Düğmeleri
function setupTestCardButtons() {
  const cardInput = document.getElementById('card-number');
  const expiryInput = document.getElementById('card-expiry');
  const cvvInput = document.getElementById('card-cvv');

  document.getElementById('btn-fill-success-card')?.addEventListener('click', () => {
    if (cardInput) cardInput.value = '4242 4242 4242 4242';
    if (expiryInput) expiryInput.value = '12/28';
    if (cvvInput) cvvInput.value = '123';
    showToast('Başarılı Test Kartı Dolduruldu (Onaylanan Kart)', 'info');
  });

  document.getElementById('btn-fill-declined-card')?.addEventListener('click', () => {
    if (cardInput) cardInput.value = '4000 0000 0000 0002';
    if (expiryInput) expiryInput.value = '12/28';
    if (cvvInput) cvvInput.value = '123';
    showToast('Başarısız Test Kartı Dolduruldu (Yetersiz Bakiye Reddi)', 'error');
  });

  document.getElementById('btn-fill-security-card')?.addEventListener('click', () => {
    if (cardInput) cardInput.value = '4000 0000 0000 0003';
    if (expiryInput) expiryInput.value = '12/28';
    if (cvvInput) cvvInput.value = '123';
    showToast('Başarısız Test Kartı Dolduruldu (Güvenlik Reddi)', 'error');
  });
}

function setupCheckoutForm() {
  const form = document.getElementById('checkout-form');
  const submitBtn = document.getElementById('btn-place-order');
  const errorContainer = document.getElementById('checkout-error-container');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (errorContainer) errorContainer.innerHTML = '';

    const firstName = document.getElementById('first-name')?.value.trim();
    const lastName = document.getElementById('last-name')?.value.trim();
    const email = document.getElementById('customer-email')?.value.trim();
    const phone = document.getElementById('customer-phone')?.value.trim();
    const address = document.getElementById('shipping-address-1')?.value.trim();
    const city = document.getElementById('shipping-city')?.value.trim();

    const cardNumber = document.getElementById('card-number')?.value.trim();
    const cardExpiry = document.getElementById('card-expiry')?.value.trim();
    const cardCvv = document.getElementById('card-cvv')?.value.trim();

    if (!firstName || !lastName || !email || !address || !city) {
      showToast('Lütfen zorunlu teslimat ve iletişim alanlarını doldurunuz.', 'error');
      return;
    }

    if (!cardNumber) {
      showToast('Lütfen kart bilgilerini giriniz veya test kartlarından birini seçiniz.', 'error');
      return;
    }

    const customerName = `${firstName} ${lastName}`;
    const origBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin mr-2"></i> Ödeme İşleniyor (Sandbox)...';

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerEmail: email,
          customerPhone: phone,
          shippingAddress: address,
          shippingCity: city,
          cardNumber,
          cardExpiry,
          cardCvv
        })
      });

      const data = await res.json();

      if (data.success && data.orderNumber) {
        try {
          const fullOrder = data.order || {};
          if (!fullOrder.items && data.items) fullOrder.items = data.items;
          sessionStorage.setItem('latest_order_' + data.orderNumber, JSON.stringify(fullOrder));
          sessionStorage.setItem('latest_order_current', JSON.stringify(fullOrder));
        } catch (e) {}
        showToast('Ödemeniz onaylandı! Sipariş sayfasına yönlendiriliyorsunuz...', 'success');
        setTimeout(() => {
          window.location.href = `/order-success.html?order=${data.orderNumber}`;
        }, 1000);
      } else {
        // Başarısız Senaryo:
        // Şartname Kuralı: "5. Ödeme hem başarılı hem başarısız senaryoda doğru sonuçlanmalı."
        // "Stok hiç düşmedi, müşteri tekrar deneyebilir"
        const errMessage = data.error || 'Ödeme sağlayıcısı kart işlemini reddetti.';
        if (errorContainer) {
          errorContainer.innerHTML = `
            <div class="alert alert-danger shadow-sm py-3 px-4 mb-4">
              <h5 class="alert-heading font-weight-bold"><i class="fa fa-times-circle mr-2"></i> Ödeme Başarısız Oldu!</h5>
              <p class="mb-2"><strong>Sebep:</strong> ${errMessage}</p>
              <div class="small bg-white p-2 rounded text-dark border">
                <strong>Durum Makinesi:</strong> Sipariş kaydı açıldı ancak durum <code>ODEME_BASARISIZ</code> olarak işaretlendi. Stoktan düşme yapılmadı. Lütfen kart bilgilerinizi kontrol ederek tekrar deneyiniz.
              </div>
            </div>
          `;
          errorContainer.scrollIntoView({ behavior: 'smooth' });
        }
        showToast(errMessage, 'error');
      }
    } catch (err) {
      showToast('Sunucu ile bağlantı kurulamadı: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnHtml;
    }
  });
}
