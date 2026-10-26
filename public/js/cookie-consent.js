/**
 * MultiShop Çerez Onay ve KVKK Bildirim Modülü (Cookie Consent Banner)
 * 30 Madde Kontrol Listesi - Madde 3
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'multishop_cookie_consent';

  function initCookieConsent() {
    const savedConsent = localStorage.getItem(STORAGE_KEY);
    if (savedConsent) {
      return; // Daha önce tercih belirtilmiş
    }

    renderConsentBanner();
  }

  function renderConsentBanner() {
    // Varsa eskiyi kaldır
    const existing = document.getElementById('multishop-cookie-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'multishop-cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Çerez ve Gizlilik Bildirimi');

    // Inline modern MultiShop styling (Composited & Zero-CLS)
    banner.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #3D464D;
      color: #ffffff;
      padding: 18px 24px;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.35);
      z-index: 999999;
      border-top: 4px solid #FFD333;
      font-family: 'Roboto', 'Inter', sans-serif;
      transition: opacity 0.3s ease;
      opacity: 1;
    `;

    banner.innerHTML = `
      <div class="container d-flex flex-column flex-md-row align-items-center justify-content-between">
        <div class="d-flex align-items-center mb-3 mb-md-0 pr-md-4">
          <div style="font-size: 32px; color: #FFD333; margin-right: 16px; flex-shrink: 0;">
            <i class="fa fa-cookie-bite"></i>
          </div>
          <div>
            <h6 style="color: #FFD333; margin-bottom: 4px; font-weight: 700; font-size: 15px;">
              Çerez (Cookie) ve Gizlilik Bildirimi
            </h6>
            <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #f8f9fa;">
              Alışveriş deneyiminizi kusursuzlaştırmak, sepetinizi korumak ve güvenli ödeme sunmak için çerezler kullanıyoruz.
              Detaylı bilgi için <a href="/gizlilik.html" style="color: #FFD333; text-decoration: underline; font-weight: 600;">Gizlilik Politikası ve KVKK Metnini</a> inceleyebilirsiniz.
            </p>
          </div>
        </div>
        <div class="d-flex flex-wrap align-items-center" style="gap: 8px; flex-shrink: 0;">
          <button id="ms-cookie-reject" type="button" class="btn btn-sm btn-outline-light font-weight-bold px-3 py-2" style="font-size: 13px;">
            Yalnızca Gerekli Olanlar
          </button>
          <button id="ms-cookie-accept" type="button" class="btn btn-sm btn-primary text-dark font-weight-bold px-4 py-2" style="background-color: #FFD333; border-color: #FFD333; font-size: 13px;">
            Tümünü Kabul Et
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    // Event Dinleyicileri
    document.getElementById('ms-cookie-accept').addEventListener('click', function () {
      saveConsent('all');
    });

    document.getElementById('ms-cookie-reject').addEventListener('click', function () {
      saveConsent('necessary');
    });
  }

  function saveConsent(type) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      choice: type,
      date: new Date().toISOString()
    }));

    const banner = document.getElementById('multishop-cookie-banner');
    if (banner) {
      banner.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      banner.style.opacity = '0';
      banner.style.transform = 'translateY(100%)';
      setTimeout(() => banner.remove(), 300);
    }

    if (window.showToast) {
      window.showToast('Çerez tercihleriniz kaydedildi.', 'info');
    }
  }

  // Global fonksiyon: Kullanıcı footer'daki "Çerez Ayarları"na tıklarsa tekrar açar
  window.openCookieConsent = function () {
    localStorage.removeItem(STORAGE_KEY);
    renderConsentBanner();
  };

  // Sayfa ilk render ve FCP/CLS ölçümlerini tamamladıktan sonra göster (CLS & Reflow Önleme)
  function scheduleCookieConsent() {
    let fired = false;
    function trigger() {
      if (fired) return;
      fired = true;
      window.removeEventListener('scroll', trigger);
      window.removeEventListener('touchstart', trigger);
      window.removeEventListener('click', trigger);
      initCookieConsent();
    }
    window.addEventListener('scroll', trigger, { passive: true, once: true });
    window.addEventListener('touchstart', trigger, { passive: true, once: true });
    window.addEventListener('click', trigger, { passive: true, once: true });
    setTimeout(trigger, 3500);
  }

  if (document.readyState === 'complete') {
    scheduleCookieConsent();
  } else {
    window.addEventListener('load', scheduleCookieConsent);
  }
})();
