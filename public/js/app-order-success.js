/**
 * MultiShop Sipariş Takip & Onay Scripti
 * Serverless ve çoklu instance uyumlu anlık yükleme ve yedekli önbellekleme
 */

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const orderNumber = params.get('order');

  if (!orderNumber) {
    window.location.href = '/shop.html';
    return;
  }

  // 1. Önce sessionStorage'dan anlık olarak yükle (Serverless soğuk başlangıç ve örnek ayrışmalarına karşı sıfır gecikme)
  let cachedOrder = null;
  try {
    const raw = sessionStorage.getItem('latest_order_' + orderNumber) || sessionStorage.getItem('latest_order_current');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.order_number === orderNumber || !parsed.order_number)) {
        cachedOrder = parsed;
        renderOrderUI(cachedOrder);
      }
    }
  } catch (e) {
    console.warn('SessionStorage sipariş okuma hatası:', e);
  }

  // 2. Sunucudan en güncel durumu sorgula (yeniden deneme ile)
  await loadOrderDetails(orderNumber, cachedOrder);
});

function renderOrderUI(o) {
  if (!o) return;

  const displayEl = document.getElementById('display-order-number');
  if (displayEl) {
    displayEl.textContent = `Sipariş No: ${o.order_number || '-'}`;
  }

  const nameEl = document.getElementById('info-name');
  if (nameEl) nameEl.textContent = o.customer_name || '-';

  const emailEl = document.getElementById('info-email');
  if (emailEl) emailEl.textContent = o.customer_email || '-';

  const phoneEl = document.getElementById('info-phone');
  if (phoneEl) phoneEl.textContent = o.customer_phone || '-';

  const addrEl = document.getElementById('info-address');
  if (addrEl) addrEl.textContent = `${o.shipping_address || ''}, ${o.shipping_city || ''}`;

  const trackEl = document.getElementById('info-tracking');
  if (trackEl) trackEl.textContent = o.tracking_number || 'Henüz Kargo Takip Numarası Girilmedi';

  const subtotalEl = document.getElementById('summary-subtotal');
  if (subtotalEl && o.subtotal_cents !== undefined) {
    subtotalEl.textContent = formatMoney(o.subtotal_cents);
  }

  const shipEl = document.getElementById('summary-shipping');
  if (shipEl && o.shipping_cents !== undefined) {
    shipEl.textContent = o.shipping_cents === 0 ? 'ÜCRETSİZ' : formatMoney(o.shipping_cents);
  }

  const totalEl = document.getElementById('summary-total');
  if (totalEl && o.total_cents !== undefined) {
    totalEl.textContent = formatMoney(o.total_cents);
  }

  if (o.discount_cents > 0) {
    const discRow = document.getElementById('summary-discount-row');
    const discVal = document.getElementById('summary-discount');
    if (discRow) discRow.style.display = 'flex';
    if (discVal) discVal.textContent = `-${formatMoney(o.discount_cents)}`;
  }

  // Ürün listesini oluştur
  const tbody = document.getElementById('order-items-tbody');
  if (tbody && o.items && o.items.length > 0) {
    tbody.innerHTML = o.items.map(it => `
      <tr>
        <td class="text-left font-weight-bold">
          ${it.product_name}
          <div class="small text-muted font-weight-normal">${it.variant_info || ''}</div>
        </td>
        <td>${formatMoney(it.price_cents)}</td>
        <td>${it.quantity}</td>
        <td class="text-right font-weight-bold text-primary">${formatMoney(it.total_cents || (it.price_cents * it.quantity))}</td>
      </tr>
    `).join('');
  }

  // Durum çubuğunu güncelle
  updateProgressStepper(o.status || 'ODENDI', o.tracking_number);
}

async function loadOrderDetails(orderNumber, fallbackOrder = null) {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const res = await fetch(`/api/orders/${orderNumber}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          renderOrderUI(data.order);
          try {
            sessionStorage.setItem('latest_order_' + orderNumber, JSON.stringify(data.order));
          } catch (e) {}
          return;
        }
      }
    } catch (err) {
      console.warn(`Sipariş sorgusu ${attempts}. deneme başarısız:`, err);
    }

    if (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 800));
    }
  }

  // Eğer sunucu örneği henüz eşitlenmediyse ama elimizde fallback sipariş varsa sessizce UI'ı koru
  if (fallbackOrder) {
    return;
  }

  // Her ikisi de yoksa bilgilendirici hata göster
  const displayEl = document.getElementById('display-order-number');
  if (displayEl) {
    displayEl.textContent = `Sipariş: ${orderNumber} (İşleniyor)`;
  }
  const alertBox = document.getElementById('status-alert-box');
  if (alertBox) {
    alertBox.innerHTML = `
      <div class="alert alert-info mb-0">
        <i class="fa fa-info-circle mr-2"></i> Siparişiniz güvenle alındı ve sisteme kaydedildi. Detaylar yüklenemiyorsa sayfayı yenileyebilir veya destek için bizimle iletişime geçebilirsiniz.
      </div>
    `;
  }
}

function updateProgressStepper(status, trackingNumber) {
  const steps = ['ODENDI', 'HAZIRLANIYOR', 'KARGOLANDI', 'TESLIM_EDILDI'];
  const stepOdendi = document.getElementById('step-odendi');
  const stepHazirlaniyor = document.getElementById('step-hazirlaniyor');
  const stepKargolandi = document.getElementById('step-kargolandi');
  const stepTeslim = document.getElementById('step-teslim-edildi');
  const alertBox = document.getElementById('status-alert-box');

  const elMap = {
    'ODENDI': stepOdendi,
    'HAZIRLANIYOR': stepHazirlaniyor,
    'KARGOLANDI': stepKargolandi,
    'TESLIM_EDILDI': stepTeslim
  };

  // Reset
  Object.values(elMap).forEach(el => el?.classList.remove('active', 'completed'));

  if (status === 'IPTAL') {
    if (alertBox) {
      alertBox.innerHTML = `
        <div class="alert alert-danger mb-0 font-weight-bold">
          <i class="fa fa-ban mr-2"></i> BU SİPARİŞ İPTAL EDİLMİŞTİR. Stok mağazaya geri iade edilmiştir.
        </div>
      `;
    }
    return;
  }

  if (status === 'IADE') {
    if (alertBox) {
      alertBox.innerHTML = `
        <div class="alert alert-warning mb-0 font-weight-bold">
          <i class="fa fa-undo mr-2"></i> BU SİPARİŞ İADE EDİLMİŞTİR. Stok mağazaya geri eklenmiş ve iade kaydı açılmıştır.
        </div>
      `;
    }
    return;
  }

  const currentIndex = steps.indexOf(status);
  steps.forEach((st, idx) => {
    const el = elMap[st];
    if (!el) return;
    if (idx < currentIndex) {
      el.classList.add('completed');
    } else if (idx === currentIndex) {
      el.classList.add('active');
    }
  });

  if (status === 'KARGOLANDI' && trackingNumber) {
    if (alertBox) {
      alertBox.innerHTML = `
        <div class="alert alert-success mb-0">
          <i class="fa fa-truck mr-2"></i> Siparişiniz kargoya verilmiştir! Takip Numarası: <strong>${trackingNumber}</strong>
        </div>
      `;
    }
  } else if (status === 'TESLIM_EDILDI') {
    if (alertBox) {
      alertBox.innerHTML = `
        <div class="alert alert-success mb-0 font-weight-bold">
          <i class="fa fa-check-double mr-2"></i> Sipariş teslim edilmiştir. 14 günlük yasal iade penceresi başlamıştır.
        </div>
      `;
    }
  }
}
