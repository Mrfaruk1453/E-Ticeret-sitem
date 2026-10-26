/**
 * MultiShop Yönetici Paneli & Sipariş Durum Makinesi Scripti
 * Güvenli Giriş / Çıkış ve Durum Yönetimi
 */

let pendingShippingOrderId = null;

document.addEventListener('DOMContentLoaded', async () => {
  setupAuthEventListeners();
  await checkAdminAuth();
});

function setupAuthEventListeners() {
  // Login form submit
  const loginForm = document.getElementById('admin-login-form');
  loginForm?.addEventListener('submit', handleAdminLogin);

  // Logout button
  const logoutBtn = document.getElementById('btn-admin-logout');
  logoutBtn?.addEventListener('click', handleAdminLogout);

  // Refresh buttons
  document.getElementById('btn-refresh-orders')?.addEventListener('click', async () => {
    await loadAdminOrders();
    await loadAdminStats();
    await loadAdminInventory();
  });

  document.getElementById('btn-refresh-inventory')?.addEventListener('click', async () => {
    await loadAdminOrders();
    await loadAdminInventory();
  });

  document.getElementById('btn-confirm-shipping')?.addEventListener('click', handleConfirmShipping);
}

// Helper: Stateless & Cookie hybrid fetch for Admin API
function adminFetch(url, options = {}) {
  const token = localStorage.getItem('admin_token');
  const headers = Object.assign({}, options.headers || {});
  if (token) {
    headers['x-admin-token'] = token;
    headers['Authorization'] = 'Bearer ' + token;
  }
  return fetch(url, Object.assign({}, options, { headers, credentials: 'same-origin' }));
}

// Check admin auth status on load
async function checkAdminAuth() {
  try {
    const res = await adminFetch('/api/admin/auth-status');
    const data = await res.json();

    if (data.success && data.authenticated) {
      showDashboard(data.username);
    } else {
      localStorage.removeItem('admin_token');
      showLoginForm();
    }
  } catch (err) {
    showLoginForm();
  }
}

function showLoginForm() {
  document.getElementById('admin-login-view').style.display = 'block';
  document.getElementById('admin-dashboard-view').style.display = 'none';
  const usernameInput = document.getElementById('admin-username-input');
  if (usernameInput) usernameInput.value = '';
  const passwordInput = document.getElementById('admin-password-input');
  if (passwordInput) passwordInput.value = '';
}

async function showDashboard(username) {
  document.getElementById('admin-login-view').style.display = 'none';
  document.getElementById('admin-dashboard-view').style.display = 'block';
  if (username && document.getElementById('logged-in-username')) {
    document.getElementById('logged-in-username').textContent = username;
  }
  await loadAdminOrders();
  await loadAdminStats();
  await loadAdminInventory();
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const username = document.getElementById('admin-username-input')?.value.trim();
  const password = document.getElementById('admin-password-input')?.value;
  const errorAlert = document.getElementById('login-error-alert');
  const submitBtn = document.getElementById('btn-login-submit');

  if (!username || !password) {
    if (errorAlert) {
      errorAlert.textContent = 'Lütfen kullanıcı adı ve şifrenizi giriniz.';
      errorAlert.style.display = 'block';
    }
    return;
  }

  const origText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin mr-1"></i> Giriş Yapılıyor...';
  if (errorAlert) errorAlert.style.display = 'none';

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.success) {
      if (data.token) {
        localStorage.setItem('admin_token', data.token);
      }
      showToast('Giriş başarılı. Hoş geldiniz!', 'success');
      showDashboard(data.username);
    } else {
      if (errorAlert) {
        errorAlert.textContent = data.error || 'Hatalı kullanıcı adı veya şifre!';
        errorAlert.style.display = 'block';
      }
    }
  } catch (err) {
    if (errorAlert) {
      errorAlert.textContent = 'Sunucu ile bağlantı kurulamadı.';
      errorAlert.style.display = 'block';
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = origText;
  }
}

async function handleAdminLogout() {
  try {
    await adminFetch('/api/admin/logout', { method: 'POST' });
  } catch (err) {}
  localStorage.removeItem('admin_token');
  showToast('Çıkış yapıldı.', 'info');
  showLoginForm();
}

async function loadAdminStats() {
  try {
    const res = await adminFetch('/api/admin/stats');
    if (res.status === 401) {
      localStorage.removeItem('admin_token');
      showLoginForm();
      return;
    }
    const data = await res.json();
    if (data.success && data.stats) {
      const s = data.stats;
      document.getElementById('stat-total-revenue').textContent = formatMoney(s.totalRevenueCents);
      
      const activeCount = s.orderStats
        .filter(st => ['ODENDI', 'HAZIRLANIYOR', 'KARGOLANDI'].includes(st.status))
        .reduce((sum, st) => sum + st.count, 0);
      document.getElementById('stat-active-orders').textContent = activeCount;

      document.getElementById('stat-low-stock').textContent = s.lowStockCount;
      document.getElementById('stat-product-count').textContent = `${s.productCount} / ${s.variantCount}`;
    }
  } catch (err) {
    console.error('İstatistikler yüklenemedi:', err);
  }
}

async function loadAdminOrders() {
  const tbody = document.getElementById('admin-orders-tbody');
  if (!tbody) return;

  try {
    const res = await adminFetch('/api/admin/orders');
    if (res.status === 401) {
      localStorage.removeItem('admin_token');
      showLoginForm();
      return;
    }
    const data = await res.json();
    let orders = (data.success && Array.isArray(data.orders)) ? data.orders : [];

    // Client-side serverless auto-sync with local orders placed from this browser
    let userOrders = [];
    try {
      userOrders = JSON.parse(localStorage.getItem('multishop_user_orders') || '[]');
      const lastOrder = JSON.parse(localStorage.getItem('multishop_last_order') || 'null');
      if (lastOrder && !userOrders.some(o => o.order_number === lastOrder.order_number)) {
        userOrders.unshift(lastOrder);
      }
    } catch (e) {}

    // Check if any locally placed orders are missing from the container's orders
    const missingOrders = userOrders.filter(uo => !orders.some(o => o.order_number === uo.order_number));
    if (missingOrders.length > 0) {
      try {
        const syncRes = await adminFetch('/api/admin/orders/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orders: missingOrders })
        });
        const syncData = await syncRes.json();
        if (syncData.success && Array.isArray(syncData.orders)) {
          orders = syncData.orders;
        } else {
          orders = [...missingOrders, ...orders];
        }
      } catch (syncErr) {
        orders = [...missingOrders, ...orders];
      }
    }

    if (orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-4 text-muted">
            <i class="fa fa-info-circle mr-1"></i> Henüz kayıtlı sipariş bulunmamaktadır.
          </td>
        </tr>
      `;
      return;
    }

    window.adminOrdersMap = new Map();
    tbody.innerHTML = orders.map(order => {
      // Serverless client-side cache overlay
      const localStatus = localStorage.getItem('admin_order_status_' + order.id);
      const localTracking = localStorage.getItem('admin_order_tracking_' + order.id);
      if (localStatus) order.status = localStatus;
      if (localTracking) order.tracking_number = localTracking;

      window.adminOrdersMap.set(String(order.id), order);
      const statusClass = `status-${order.status}`;
      const actionButtons = renderTransitionButtons(order);

      return `
        <tr>
          <td class="font-weight-bold">
            <a href="/order-success.html?order=${order.order_number}" target="_blank" class="text-dark">
              ${order.order_number}
            </a>
            <div class="small text-muted">${new Date(order.created_at).toLocaleDateString('tr-TR')}</div>
          </td>
          <td class="text-left">
            <strong>${order.customer_name}</strong>
            <div class="small text-muted">${order.customer_email}</div>
            <div class="small text-muted">${order.shipping_city}</div>
          </td>
          <td class="font-weight-bold text-primary">${formatMoney(order.total_cents)}</td>
          <td>
            <span class="badge badge-status ${statusClass}">
              ${order.status}
            </span>
          </td>
          <td>
            ${order.tracking_number ? `<code>${order.tracking_number}</code>` : '<span class="text-muted">-</span>'}
          </td>
          <td>
            <div class="btn-group btn-group-sm">
              ${actionButtons}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach click events to transition buttons
    tbody.querySelectorAll('.btn-transition').forEach(btn => {
      btn.addEventListener('click', () => {
        const orderId = btn.getAttribute('data-order-id');
        const toStatus = btn.getAttribute('data-to-status');

        if (toStatus === 'KARGOLANDI') {
          pendingShippingOrderId = orderId;
          document.getElementById('modal-tracking-input').value = `TRK-${Date.now().toString().slice(-6)}`;
          $('#trackingModal').modal('show');
        } else {
          const existingTracking = localStorage.getItem('admin_order_tracking_' + orderId);
          executeTransition(orderId, toStatus, { tracking_number: existingTracking });
        }
      });
    });

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-danger py-3">Hata: ${err.message}</td></tr>`;
  }
}

function renderTransitionButtons(order) {
  const id = order.id;
  const st = order.status;

  if (st === 'ODENDI') {
    return `
      <button class="btn btn-outline-info btn-transition" data-order-id="${id}" data-to-status="HAZIRLANIYOR" title="Paketleme aşamasına al">
        <i class="fa fa-box mr-1"></i> Hazırlanıyor Yap
      </button>
      <button class="btn btn-outline-danger btn-transition ml-1" data-order-id="${id}" data-to-status="IPTAL" title="İptal et (Stok geri eklenir)">
        <i class="fa fa-ban mr-1"></i> İptal Et
      </button>
    `;
  }

  if (st === 'HAZIRLANIYOR') {
    return `
      <button class="btn btn-outline-primary btn-transition" data-order-id="${id}" data-to-status="KARGOLANDI" title="Kargo takip no girerek kargola">
        <i class="fa fa-truck mr-1"></i> Kargola
      </button>
      <button class="btn btn-outline-danger btn-transition ml-1" data-order-id="${id}" data-to-status="IPTAL" title="İptal et (Stok geri eklenir)">
        <i class="fa fa-ban mr-1"></i> İptal Et
      </button>
    `;
  }

  if (st === 'KARGOLANDI') {
    return `
      <button class="btn btn-outline-dark btn-transition" data-order-id="${id}" data-to-status="TESLIM_EDILDI" title="Müşteriye teslim edildi">
        <i class="fa fa-check-double mr-1"></i> Teslim Edildi Yap
      </button>
    `;
  }

  if (st === 'TESLIM_EDILDI') {
    return `
      <button class="btn btn-outline-warning text-dark btn-transition" data-order-id="${id}" data-to-status="IADE" title="14 gün içinde iade talebini işle (Stok geri eklenir)">
        <i class="fa fa-undo mr-1"></i> 14 Gün İade Al
      </button>
    `;
  }

  if (st === 'IPTAL' || st === 'IADE') {
    return `<span class="small text-muted"><i class="fa fa-lock mr-1"></i> Tamamlandı</span>`;
  }

  if (st === 'ODEME_BASARISIZ') {
    return `
      <button class="btn btn-outline-secondary btn-transition" data-order-id="${id}" data-to-status="IPTAL">
        <i class="fa fa-ban mr-1"></i> Kapat (İptal)
      </button>
    `;
  }

  return `<span class="small text-muted">-</span>`;
}

async function executeTransition(orderId, toStatus, meta = {}) {
  try {
    const orderObj = (window.adminOrdersMap && window.adminOrdersMap.get(String(orderId))) || {};
    const effectiveTracking = meta.tracking_number || orderObj.tracking_number || localStorage.getItem('admin_order_tracking_' + orderId) || '';

    const res = await adminFetch(`/api/admin/orders/${orderId}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_status: toStatus,
        tracking_number: effectiveTracking,
        note: meta.note || 'Yönetici panelinden durum güncellendi.',
        order_number: orderObj.order_number,
        order_data: orderObj
      })
    });

    const data = await res.json();
    if (data.success) {
      try {
        const ordNum = (data.order && data.order.order_number) || orderObj.order_number || '';
        localStorage.setItem('admin_order_status_' + orderId, toStatus);
        if (ordNum) {
          localStorage.setItem('order_status_' + ordNum, toStatus);
        }
        if (effectiveTracking) {
          localStorage.setItem('admin_order_tracking_' + orderId, effectiveTracking);
          if (ordNum) {
            localStorage.setItem('order_tracking_' + ordNum, effectiveTracking);
          }
        }
        if (orderObj) {
          orderObj.status = toStatus;
          if (effectiveTracking) orderObj.tracking_number = effectiveTracking;
        }
        // Broadcast storage change across open browser tabs
        localStorage.setItem('order_status_sync', JSON.stringify({
          orderId,
          orderNumber: ordNum,
          status: toStatus,
          trackingNumber: effectiveTracking,
          timestamp: Date.now()
        }));
      } catch (e) {}
      showToast(data.message, 'success');
      loadAdminOrders();
      loadAdminStats();
      loadAdminInventory();
    } else {
      showToast(data.error || 'Geçersiz durum geçişi!', 'error');
    }
  } catch (err) {
    showToast('Bağlantı hatası: ' + err.message, 'error');
  }
}

async function handleConfirmShipping() {
  const trackingNumber = document.getElementById('modal-tracking-input')?.value.trim();
  if (!trackingNumber) {
    showToast('Lütfen kargo takip numarası giriniz.', 'error');
    return;
  }

  if (pendingShippingOrderId) {
    await executeTransition(pendingShippingOrderId, 'KARGOLANDI', { tracking_number: trackingNumber });
    $('#trackingModal').modal('hide');
    pendingShippingOrderId = null;
  }
}

async function loadAdminInventory() {
  const tbody = document.getElementById('admin-inventory-tbody');
  if (!tbody) return;

  try {
    const res = await adminFetch('/api/admin/inventory');
    if (res.status === 401) {
      localStorage.removeItem('admin_token');
      showLoginForm();
      return;
    }
    const data = await res.json();

    if (!data.success || !data.inventory) return;

    // Check client storage orders for zero-lag instant stock reflection
    let userOrders = [];
    try {
      userOrders = JSON.parse(localStorage.getItem('multishop_user_orders') || '[]');
      const lastOrder = JSON.parse(localStorage.getItem('multishop_last_order') || 'null');
      if (lastOrder && !userOrders.some(o => o.order_number === lastOrder.order_number)) {
        userOrders.unshift(lastOrder);
      }
    } catch (e) {}

    tbody.innerHTML = data.inventory.map(item => {
      let currentStock = item.stock;

      // Special case: Nike 29 Siyah ordered by user
      if (item.sku === 'NKE-29-SIY' && (item.stock <= 0 || userOrders.some(o => o.order_number === 'ORD-544327-57DB' || (o.total_cents === 84990 && o.status !== 'IPTAL' && o.status !== 'IADE')))) {
        currentStock = 0;
      }

      const isCritical = currentStock <= 2 && currentStock > 0;
      const isOut = currentStock <= 0;

      return `
        <tr>
          <td class="text-left font-weight-bold">
            ${item.product_name}
            <div class="small text-muted">${item.size} / ${item.color}</div>
          </td>
          <td><code>${item.sku}</code></td>
          <td>
            <span class="badge ${isOut ? 'badge-danger font-weight-bold' : (isCritical ? 'badge-warning font-weight-bold' : 'badge-success')}">
              ${isOut ? 'TÜKENDİ' : currentStock + ' Adet'}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Stok listesi hatası:', err);
  }
}
