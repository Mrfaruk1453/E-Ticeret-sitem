/**
 * MultiShop Sipariş Takip & Onay Scripti
 * Gerçek Zamanlı Durum Akışı, Dinamik Başlıklar ve Çoklu Sekme Eşitlemesi
 */

let currentOrderData = null;

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  let orderNumber = params.get('order');

  // 1. Önce yerel hafızadan ve önbellekten sipariş verisini çek
  let cachedOrder = null;
  try {
    if (orderNumber) {
      const raw = sessionStorage.getItem('latest_order_' + orderNumber);
      if (raw) cachedOrder = JSON.parse(raw);
    }
    if (!cachedOrder) {
      const rawCurrent = sessionStorage.getItem('latest_order_current');
      if (rawCurrent) {
        cachedOrder = JSON.parse(rawCurrent);
        if (!orderNumber && cachedOrder.order_number) {
          orderNumber = cachedOrder.order_number;
        }
      }
    }
  } catch (e) {
    console.warn('SessionStorage okuma hatası:', e);
  }

  if (!orderNumber) {
    window.location.href = '/shop.html';
    return;
  }

  // Yerel depodaki güncel durumu kontrol et ve uygula
  if (cachedOrder) {
    applyLocalStatusOverride(orderNumber, cachedOrder);
    currentOrderData = cachedOrder;
    renderOrderUI(cachedOrder);
  } else {
    // Eğer önbellek boşsa en azından sipariş numarasını hemen göster
    const displayEl = document.getElementById('display-order-number');
    if (displayEl) {
      displayEl.textContent = `Sipariş No: ${orderNumber}`;
    }
  }

  // 2. Sunucudan en güncel durumu sorgula
  await loadOrderDetails(orderNumber, cachedOrder);

  // 3. Çoklu sekme eşitlemesi (Admin panelinde kargolandı yapıldığında anında bu sekmeye yansır)
  window.addEventListener('storage', (e) => {
    if (e.key === 'order_status_sync' || e.key === 'order_status_' + orderNumber) {
      handleStorageStatusSync(orderNumber);
    }
  });

  // 4. Düzenli aralıklarla sunucu durumunu kontrol et (5 saniyede bir)
  setInterval(() => {
    loadOrderDetails(orderNumber, currentOrderData, true);
  }, 5000);
});

function applyLocalStatusOverride(orderNumber, order) {
  if (!order) return;
  const localStatus = localStorage.getItem('order_status_' + orderNumber) || 
                      (order.id ? localStorage.getItem('admin_order_status_' + order.id) : null);
  const localTracking = localStorage.getItem('order_tracking_' + orderNumber) || 
                        (order.id ? localStorage.getItem('admin_order_tracking_' + order.id) : null);
  
  if (localStatus) order.status = localStatus;
  if (localTracking) order.tracking_number = localTracking;
}

function handleStorageStatusSync(orderNumber) {
  try {
    const syncRaw = localStorage.getItem('order_status_sync');
    if (syncRaw) {
      const syncData = JSON.parse(syncRaw);
      if (syncData.orderNumber === orderNumber || (currentOrderData && syncData.orderId == currentOrderData.id)) {
        if (!currentOrderData) currentOrderData = { order_number: orderNumber };
        currentOrderData.status = syncData.status;
        if (syncData.trackingNumber) currentOrderData.tracking_number = syncData.trackingNumber;
        renderOrderUI(currentOrderData);
        return;
      }
    }

    const localStatus = localStorage.getItem('order_status_' + orderNumber);
    const localTracking = localStorage.getItem('order_tracking_' + orderNumber);
    if (localStatus && currentOrderData) {
      currentOrderData.status = localStatus;
      if (localTracking) currentOrderData.tracking_number = localTracking;
      renderOrderUI(currentOrderData);
    }
  } catch (e) {}
}

function renderOrderUI(o) {
  if (!o) return;
  currentOrderData = o;
  const status = o.status || 'ODENDI';
  const trackingNumber = o.tracking_number || null;

  // 1. Dinamik Hero Durum Kartı (Başlık, Açıklama, İkon ve Rozet)
  updateHeroStatus(status, trackingNumber);

  // 2. Sipariş Numarası ve Bilgiler
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
  if (trackEl) {
    trackEl.textContent = trackingNumber || 'Henüz Kargo Takip Numarası Girilmedi';
  }

  const subtotalEl = document.getElementById('summary-subtotal');
  if (subtotalEl && o.subtotal_cents !== undefined) {
    subtotalEl.textContent = typeof formatMoney === 'function' ? formatMoney(o.subtotal_cents) : (o.subtotal_cents / 100).toFixed(2) + ' TL';
  }

  const shipEl = document.getElementById('summary-shipping');
  if (shipEl && o.shipping_cents !== undefined) {
    shipEl.textContent = o.shipping_cents === 0 ? 'ÜCRETSİZ' : (typeof formatMoney === 'function' ? formatMoney(o.shipping_cents) : (o.shipping_cents / 100).toFixed(2) + ' TL');
  }

  const totalEl = document.getElementById('summary-total');
  if (totalEl && o.total_cents !== undefined) {
    totalEl.textContent = typeof formatMoney === 'function' ? formatMoney(o.total_cents) : (o.total_cents / 100).toFixed(2) + ' TL';
  }

  if (o.discount_cents > 0) {
    const discRow = document.getElementById('summary-discount-row');
    const discVal = document.getElementById('summary-discount');
    if (discRow) discRow.style.display = 'flex';
    if (discVal) discVal.textContent = `-${typeof formatMoney === 'function' ? formatMoney(o.discount_cents) : (o.discount_cents / 100).toFixed(2) + ' TL'}`;
  }

  // 3. Ürün Listesi
  const tbody = document.getElementById('order-items-tbody');
  if (tbody && o.items && o.items.length > 0) {
    tbody.innerHTML = o.items.map(it => `
      <tr>
        <td class="text-left font-weight-bold">
          ${it.product_name}
          <div class="small text-muted font-weight-normal">${it.variant_info || ''}</div>
        </td>
        <td>${typeof formatMoney === 'function' ? formatMoney(it.price_cents) : (it.price_cents / 100).toFixed(2) + ' TL'}</td>
        <td>${it.quantity}</td>
        <td class="text-right font-weight-bold text-primary">${typeof formatMoney === 'function' ? formatMoney(it.total_cents || (it.price_cents * it.quantity)) : ((it.total_cents || (it.price_cents * it.quantity)) / 100).toFixed(2) + ' TL'}</td>
      </tr>
    `).join('');
  }

  // 4. Durum Makinesi İlerleme Çubuğu (Stepper)
  updateProgressStepper(status, trackingNumber);
}

function updateHeroStatus(status, trackingNumber) {
  const iconWrapper = document.getElementById('order-icon-wrapper');
  const titleEl = document.getElementById('order-status-title');
  const descEl = document.getElementById('order-status-desc');
  const badgeContainer = document.getElementById('order-status-badge-container');

  const configs = {
    'ODENDI': {
      icon: '<i class="fa fa-check-circle text-success" style="font-size: 64px;"></i>',
      title: 'Siparişiniz Başarıyla Alındı!',
      desc: 'Ödemeniz onaylandı ve siparişiniz hazırlık sürecine alındı.',
      badge: '<span class="badge badge-success px-3 py-2 font-weight-bold" style="font-size: 14px;"><i class="fa fa-check mr-1"></i> ÖDENDİ (HAZIRLIKTA)</span>'
    },
    'HAZIRLANIYOR': {
      icon: '<i class="fa fa-box-open text-warning" style="font-size: 64px;"></i>',
      title: 'Siparişiniz Hazırlanıyor!',
      desc: 'Ürünleriniz depomuzda özenle kontrol ediliyor ve paketleniyor.',
      badge: '<span class="badge badge-warning text-dark px-3 py-2 font-weight-bold" style="font-size: 14px;"><i class="fa fa-cog fa-spin mr-1"></i> HAZIRLANIYOR</span>'
    },
    'KARGOLANDI': {
      icon: '<i class="fa fa-shipping-fast text-primary" style="font-size: 64px;"></i>',
      title: 'Siparişiniz Kargoya Verildi! 🚚',
      desc: trackingNumber 
        ? `Paketiniz kargo firmasına teslim edilmiştir. Kargo Takip Numarası: <strong>${trackingNumber}</strong>`
        : 'Paketiniz kargo firmasına teslim edilmiştir.',
      badge: '<span class="badge badge-primary px-3 py-2 font-weight-bold" style="font-size: 14px;"><i class="fa fa-truck mr-1"></i> KARGOLANDI</span>'
    },
    'TESLIM_EDILDI': {
      icon: '<i class="fa fa-check-double text-success" style="font-size: 64px;"></i>',
      title: 'Siparişiniz Teslim Edildi! 🏠',
      desc: 'Paketiniz teslim edilmiştir. 14 günlük yasal cayma ve iade hakkınız başlamıştır.',
      badge: '<span class="badge badge-dark px-3 py-2 font-weight-bold" style="font-size: 14px;"><i class="fa fa-home mr-1"></i> TESLİM EDİLDİ</span>'
    },
    'IPTAL': {
      icon: '<i class="fa fa-times-circle text-danger" style="font-size: 64px;"></i>',
      title: 'Sipariş İptal Edildi 🚫',
      desc: 'Bu sipariş iptal edilmiştir. Stoklar mağazamıza iade edilmiştir.',
      badge: '<span class="badge badge-danger px-3 py-2 font-weight-bold" style="font-size: 14px;"><i class="fa fa-ban mr-1"></i> İPTAL EDİLDİ</span>'
    },
    'IADE': {
      icon: '<i class="fa fa-undo text-warning" style="font-size: 64px;"></i>',
      title: 'Sipariş İade Alındı ↩',
      desc: 'Sipariş iade süreciniz tamamlanmış, ücret iadeniz başlatılmıştır.',
      badge: '<span class="badge badge-warning text-dark px-3 py-2 font-weight-bold" style="font-size: 14px;"><i class="fa fa-undo mr-1"></i> İADE ALINDI</span>'
    }
  };

  const c = configs[status] || configs['ODENDI'];
  if (iconWrapper) iconWrapper.innerHTML = c.icon;
  if (titleEl) titleEl.textContent = c.title;
  if (descEl) descEl.innerHTML = c.desc;
  if (badgeContainer) badgeContainer.innerHTML = c.badge;
}

async function loadOrderDetails(orderNumber, fallbackOrder = null, isSilent = false) {
  let attempts = 0;
  const maxAttempts = isSilent ? 1 : 3;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const res = await fetch(`/api/orders/${orderNumber}?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          applyLocalStatusOverride(orderNumber, data.order);
          renderOrderUI(data.order);
          try {
            sessionStorage.setItem('latest_order_' + orderNumber, JSON.stringify(data.order));
          } catch (e) {}
          return;
        }
      }
    } catch (err) {
      if (!isSilent) console.warn(`Sipariş sorgusu ${attempts}. deneme:`, err);
    }

    if (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 600));
    }
  }

  if (fallbackOrder) {
    try {
      const syncRes = await fetch('/api/orders/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: fallbackOrder })
      });
      const syncData = await syncRes.json();
      if (syncData.success && syncData.order) {
        applyLocalStatusOverride(orderNumber, syncData.order);
        renderOrderUI(syncData.order);
        return;
      }
    } catch (e) {}
    renderOrderUI(fallbackOrder);
    return;
  }

  const displayEl = document.getElementById('display-order-number');
  if (displayEl) displayEl.textContent = `Sipariş: ${orderNumber}`;
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

  // Reset all
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
        <div class="alert alert-success mb-0 font-weight-bold">
          <i class="fa fa-truck mr-2"></i> Siparişiniz kargoya verilmiştir! Kargo Takip Numarası: <strong>${trackingNumber}</strong>
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
  } else if (status === 'HAZIRLANIYOR') {
    if (alertBox) {
      alertBox.innerHTML = `
        <div class="alert alert-warning text-dark mb-0 font-weight-bold">
          <i class="fa fa-box mr-2"></i> Siparişiniz depomuzda hazırlanıyor ve kargolanmak üzere paketleniyor.
        </div>
      `;
    }
  } else {
    if (alertBox) {
      alertBox.innerHTML = `
        <div class="alert alert-success mb-0">
          <i class="fa fa-check mr-2"></i> Ödemeniz onaylandı. Siparişiniz hazırlanma sırasına alındı.
        </div>
      `;
    }
  }
}
