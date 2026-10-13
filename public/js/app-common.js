/**
 * MultiShop Ortak Yardımcı Fonksiyonlar
 * Kuruş Para Formatlama, Sepet Sayacı ve Bildirimler
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
        b.textContent = data.cart.item_count || 0;
      });
    }
  } catch (err) {
    console.warn('Sepet sayısı alınamadı:', err);
  }
}

// Sayfa üzerinde modern bildirim (Toast / Alert) gösterir
function showToast(message, type = 'success') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.position = 'fixed';
    toastContainer.style.top = '20px';
    toastContainer.style.right = '20px';
    toastContainer.style.zIndex = '99999';
    document.body.appendChild(toastContainer);
  }

  const alertDiv = document.createElement('div');
  const bgClass = type === 'success' ? 'alert-success' : (type === 'danger' || type === 'error' ? 'alert-danger' : 'alert-info');
  const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle';

  alertDiv.className = `alert ${bgClass} alert-dismissible fade show shadow-lg mb-2`;
  alertDiv.style.minWidth = '280px';
  alertDiv.innerHTML = `
    <i class="fa ${icon} mr-2"></i>
    <strong>${message}</strong>
    <button type="button" class="close" data-dismiss="alert">&times;</button>
  `;

  toastContainer.appendChild(alertDiv);

  setTimeout(() => {
    alertDiv.classList.remove('show');
    setTimeout(() => alertDiv.remove(), 300);
  }, 4000);
}

// Ortak arama formu yönetimi
document.addEventListener('DOMContentLoaded', () => {
  updateNavCartBadge();

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
