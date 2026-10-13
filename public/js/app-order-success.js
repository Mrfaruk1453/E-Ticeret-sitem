/**
 * MultiShop Sipariş Takip & Onay Scripti
 */

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const orderNumber = params.get('order');

  if (!orderNumber) {
    window.location.href = '/shop.html';
    return;
  }

  await loadOrderDetails(orderNumber);
});

async function loadOrderDetails(orderNumber) {
  try {
    const res = await fetch(`/api/orders/${orderNumber}`);
    const data = await res.json();

    if (!data.success || !data.order) {
      alert('Sipariş bulunamadı.');
      window.location.href = '/shop.html';
      return;
    }

    const o = data.order;

    document.getElementById('display-order-number').textContent = `Sipariş No: ${o.order_number}`;
    document.getElementById('info-name').textContent = o.customer_name;
    document.getElementById('info-email').textContent = o.customer_email;
    document.getElementById('info-phone').textContent = o.customer_phone || '-';
    document.getElementById('info-address').textContent = `${o.shipping_address}, ${o.shipping_city}`;
    document.getElementById('info-tracking').textContent = o.tracking_number || 'Henüz Kargo Takip Numarası Girilmedi';

    document.getElementById('summary-subtotal').textContent = formatMoney(o.subtotal_cents);
    document.getElementById('summary-shipping').textContent = o.shipping_cents === 0 ? 'ÜCRETSİZ' : formatMoney(o.shipping_cents);
    document.getElementById('summary-total').textContent = formatMoney(o.total_cents);

    if (o.discount_cents > 0) {
      const discRow = document.getElementById('summary-discount-row');
      const discVal = document.getElementById('summary-discount');
      if (discRow) discRow.style.display = 'flex';
      if (discVal) discVal.textContent = `-${formatMoney(o.discount_cents)}`;
    }

    // Render order items
    const tbody = document.getElementById('order-items-tbody');
    if (tbody && o.items) {
      tbody.innerHTML = o.items.map(it => `
        <tr>
          <td class="text-left font-weight-bold">
            ${it.product_name}
            <div class="small text-muted font-weight-normal">${it.variant_info}</div>
          </td>
          <td>${formatMoney(it.price_cents)}</td>
          <td>${it.quantity}</td>
          <td class="text-right font-weight-bold text-primary">${formatMoney(it.total_cents)}</td>
        </tr>
      `).join('');
    }

    // Update Stepper
    updateProgressStepper(o.status, o.tracking_number);

  } catch (err) {
    console.error('Sipariş detay hatası:', err);
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
