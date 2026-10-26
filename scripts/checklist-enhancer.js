const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const htmlFiles = [
  'index.html',
  'shop.html',
  'cart.html',
  'checkout.html',
  'contact.html',
  'hakkinda.html',
  'sss.html',
  'yardim.html'
];

htmlFiles.forEach(fileName => {
  const filePath = path.join(publicDir, fileName);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Script Entegrasyonu: cookie-consent.js ve analytics.js
  if (!content.includes('cookie-consent.js')) {
    content = content.replace(
      '</body>',
      '    <script src="js/cookie-consent.js"></script>\n    <script src="js/analytics.js"></script>\n</body>'
    );
  }

  // 2. Skip to Content (A11y - Madde 9)
  if (!content.includes('sr-only sr-only-focusable')) {
    content = content.replace(
      /(<body[^>]*>)/i,
      '$1\n    <!-- Accessibility: Skip to Main Content -->\n    <a href="#main-content" class="sr-only sr-only-focusable p-2 bg-primary text-dark font-weight-bold" style="position: absolute; z-index: 10000; top: 10px; left: 10px;">İçeriğe Atla</a>'
    );
  }

  // 3. Footer Menülerine Gizlilik Politikası ve Kullanım Şartları Linkleri (Maddeler 1, 2, 7)
  // Eski mükerrer "Ürün Detayı" linkini "Gizlilik Politikası" ve "Kullanım Şartları" ile değiştir
  if (content.includes('href="/shop.html"><i class="fa fa-angle-right mr-2"></i>Ürün Detayı</a>')) {
    content = content.replace(
      '<a class="text-secondary mb-2" href="/shop.html"><i class="fa fa-angle-right mr-2"></i>Ürün Detayı</a>',
      '<a class="text-secondary mb-2" href="/gizlilik.html"><i class="fa fa-angle-right mr-2"></i>Gizlilik Politikası</a>\n                            <a class="text-secondary mb-2" href="/kullanim-kosullari.html"><i class="fa fa-angle-right mr-2"></i>Kullanım Şartları</a>'
    );
  }

  // Footer telif hakkı yanına Çerez Tercihleri linki
  if (!content.includes('openCookieConsent')) {
    content = content.replace(
      'Tüm Hakları Saklıdır.',
      'Tüm Hakları Saklıdır. | <a href="javascript:void(0)" onclick="openCookieConsent()" class="text-secondary text-decoration-underline ml-1">Çerez Tercihleri</a>'
    );
  }

  // 4. Index.html H1 hiyerarşisi düzeltme (Madde 23)
  if (fileName === 'index.html') {
    // Slide 2
    content = content.replace(
      '<h1 class="hero-title">Zarafetin En Doğal Hali.</h1>',
      '<div class="hero-title h2 font-weight-bold">Zarafetin En Doğal Hali.</div>'
    );
    // Slide 3
    content = content.replace(
      '<h1 class="hero-title">Küçük Adımlara Büyük Neşe.</h1>',
      '<div class="hero-title h2 font-weight-bold">Küçük Adımlara Büyük Neşe.</div>'
    );
  }

  // 5. Görsel Alt Etiketleri & Core Web Vitals (Maddeler 15, 25, 26)
  // Boş veya eksik alt etiketlerini düzelt, ekran altı görsellere decoding="async" ekle
  content = content.replace(/<img([^>]*?)alt=""([^>]*?)>/gi, '<img$1alt="MultiShop Görseli"$2>');
  content = content.replace(/<img\s+(?![^>]*decoding=)([^>]+)>/gi, '<img decoding="async" $1>');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[OK] ${fileName} güncellendi.`);
});

console.log('Tüm sayfalar kontrol listesi maddelerine uygun olarak başarıyla güncellendi.');
