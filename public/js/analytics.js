/**
 * MultiShop Web Analytics & Event Tracking Modülü
 * 30 Madde Kontrol Listesi - Madde 10
 * Google Analytics (GA4) / GTM uyumlu veri katmanı ve yerel izleme
 */

(function () {
  'use strict';

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = window.gtag || gtag;

  const Analytics = {
    // Sayfa görüntüleme
    trackPageView: function (pageTitle, pagePath) {
      const data = {
        event: 'page_view',
        page_title: pageTitle || document.title,
        page_location: window.location.href,
        page_path: pagePath || window.location.pathname,
        timestamp: new Date().toISOString()
      };
      window.gtag('event', 'page_view', data);
      this.log('📄 [PageView]', data);
    },

    // Sepete Ekleme
    trackAddToCart: function (item) {
      const data = {
        event: 'add_to_cart',
        currency: 'TRY',
        value: (item.priceCents || 0) / 100,
        items: [{
          item_id: item.id || item.variantId,
          item_name: item.title || item.name,
          item_category: item.category || 'Moda',
          price: (item.priceCents || 0) / 100,
          quantity: item.quantity || 1
        }]
      };
      window.gtag('event', 'add_to_cart', data);
      this.log('🛒 [AddToCart]', data);
    },

    // Arama
    trackSearch: function (searchTerm) {
      const data = {
        event: 'search',
        search_term: searchTerm
      };
      window.gtag('event', 'search', data);
      this.log('🔍 [Search]', data);
    },

    // Satın Alma (Checkout Success)
    trackPurchase: function (order) {
      const data = {
        event: 'purchase',
        transaction_id: order.order_code || order.orderId,
        value: (order.total_cents || order.totalCents || 0) / 100,
        currency: 'TRY',
        tax: 0,
        shipping: (order.shipping_cents || 0) / 100,
        coupon: order.coupon_code || order.couponCode || ''
      };
      window.gtag('event', 'purchase', data);
      this.log('💰 [Purchase]', data);
    },

    // Konsol Günlüğü (Development/Sunum Kolaylığı)
    log: function (action, payload) {
      if (console && console.info) {
        console.info(`%cMultiShop Analytics ${action}`, 'background: #3D464D; color: #FFD333; font-weight: bold; padding: 2px 6px; border-radius: 3px;', payload);
      }
    }
  };

  window.MultiShopAnalytics = Analytics;

  // Sayfa yüklendiğinde otomatik page_view kaydet
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      Analytics.trackPageView();
    });
  } else {
    Analytics.trackPageView();
  }
})();
