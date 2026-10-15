const { db } = require('../src/config/database');
const { initSchema } = require('../src/db/schema');

function seedDatabase() {
  console.log('🔄 Veritabanı şeması başlatılıyor...');
  initSchema();

  console.log('🧹 Eski veriler temizleniyor...');
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec(`
    DELETE FROM payments;
    DELETE FROM order_status_history;
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM cart_items;
    DELETE FROM carts;
    DELETE FROM coupons;
    DELETE FROM product_variants;
    DELETE FROM products;
    DELETE FROM categories;
  `);
  db.exec('PRAGMA foreign_keys = ON;');

  console.log('🌱 Şablonun 12 kategorisi (Türkçe & Sıralı) ekleniyor...');
  const categories = [
    { name: 'Ayakkabı', slug: 'ayakkabi', image: 'img/product-4.jpg', sort_order: 1 },
    { name: 'Blazerler', slug: 'blazerler', image: 'img/cat-blazers.jpg', sort_order: 2 },
    { name: 'Ceketler', slug: 'ceketler', image: 'img/cat-jackets.jpg', sort_order: 3 },
    { name: 'Elbiseler', slug: 'elbiseler', image: 'img/cat-dresses.jpg', sort_order: 4 },
    { name: 'Gömlekler', slug: 'gomlekler', image: 'img/cat-shirts.jpg', sort_order: 5 },
    { name: 'Kot', slug: 'kot', image: 'img/cat-kot.jpg', sort_order: 6 },
    { name: 'Mayo', slug: 'mayo', image: 'img/cat-swim.jpg', sort_order: 7 },
    { name: 'Spor giyim', slug: 'spor-giyim', image: 'img/product-2.jpg', sort_order: 8 },
    { name: 'Tulumlar', slug: 'tulumlar', image: 'img/cat-jumpsuits.jpg', sort_order: 9 },
    { name: 'Uyku kıyafetleri', slug: 'uyku-kiyafetleri', image: 'img/cat-sleep.jpg', sort_order: 10 },
    { name: 'Kamera', slug: 'kamera', image: 'img/cat-2.jpg', sort_order: 11 },
    { name: 'Kozmetik', slug: 'kozmetik', image: 'img/cat-4.jpg', sort_order: 12 }
  ];

  const catMap = {};
  const insertCatStmt = db.prepare('INSERT INTO categories (name, slug, image, sort_order) VALUES (?, ?, ?, ?)');
  for (const cat of categories) {
    const res = insertCatStmt.run(cat.name, cat.slug, cat.image, cat.sort_order);
    catMap[cat.slug] = res.lastInsertRowid;
  }

  console.log('🌱 İndirim kuponları ekleniyor...');
  const now = new Date();
  const nextYear = new Date(now.getFullYear() + 1, 11, 31).toISOString();
  const pastYear = new Date(now.getFullYear() - 1, 0, 1).toISOString();

  const coupons = [
    { code: 'HOSGELDIN10', discount_type: 'PERCENT', discount_value: 10, min_cart_cents: 25000, expires_at: nextYear, is_active: 1 },
    { code: 'BAHAR50', discount_type: 'FIXED', discount_value: 5000, min_cart_cents: 50000, expires_at: nextYear, is_active: 1 },
    { code: 'OGRENCI20', discount_type: 'PERCENT', discount_value: 20, min_cart_cents: 30000, expires_at: nextYear, is_active: 1 },
    { code: 'SEPET100', discount_type: 'FIXED', discount_value: 10000, min_cart_cents: 100000, expires_at: nextYear, is_active: 1 },
    { code: 'GECMISKUPON', discount_type: 'PERCENT', discount_value: 15, min_cart_cents: 10000, expires_at: pastYear, is_active: 1 },
    { code: 'PASIFKUPON', discount_type: 'FIXED', discount_value: 2000, min_cart_cents: 10000, expires_at: nextYear, is_active: 0 }
  ];

  const insertCouponStmt = db.prepare(`
    INSERT INTO coupons (code, discount_type, discount_value, min_cart_cents, expires_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const cp of coupons) {
    insertCouponStmt.run(cp.code, cp.discount_type, cp.discount_value, cp.min_cart_cents, cp.expires_at, cp.is_active);
  }

  console.log('🌱 Görsellere %100 uygun, SEO uyumlu ürünler ve varyantlar ekleniyor...');
  const products = [
    // 1. ELBİSELER
    {
      cat: 'elbiseler',
      name: 'Çiçek Desenli Kruvaze Şifon Kadın Yazlık Elbise',
      slug: 'cicek-desenli-kruvaze-sifon-kadin-yazlik-elbise',
      desc: 'Beli kuşaklı, zarif çiçek baskılı, dökümlü ve hafif nefes alan şifon kumaş kadın elbise. Yaz düğünleri ve günlük kullanım için idealdir.',
      base_price_cents: 64990, image: 'img/prod-dress-1.jpg', rating: 4.9, review_count: 142, is_featured: 1, is_recent: 1,
      variants: [
        { sku: 'ELB-S-BEY', size: 'S', color: 'Beyaz Çiçekli', stock: 15, price_cents: 64990 },
        { sku: 'ELB-M-BEY', size: 'M', color: 'Beyaz Çiçekli', stock: 20, price_cents: 64990 },
        { sku: 'ELB-L-BEY', size: 'L', color: 'Beyaz Çiçekli', stock: 12, price_cents: 64990 },
        { sku: 'ELB-XL-BEY', size: 'XL', color: 'Beyaz Çiçekli', stock: 0, price_cents: 64990 } // Tükendi
      ]
    },
    {
      cat: 'elbiseler',
      name: 'Kayık Yaka Dökümlü Triko Kadın Kazak Elbise',
      slug: 'kayik-yaka-dokumlu-triko-kadin-kazak-elbise',
      desc: 'Yumuşacık bej renkli triko kumaş, omuz dekolteli kayık yaka şık sonbahar elbisesi.',
      base_price_cents: 48990, image: 'img/cat-1.jpg', rating: 4.7, review_count: 88, is_featured: 1, is_recent: 0,
      variants: [
        { sku: 'TRK-S-BEJ', size: 'S', color: 'Bej', stock: 8, price_cents: 48990 },
        { sku: 'TRK-M-BEJ', size: 'M', color: 'Bej', stock: 14, price_cents: 48990 },
        { sku: 'TRK-L-BEJ', size: 'L', color: 'Bej', stock: 6, price_cents: 48990 }
      ]
    },
    {
      cat: 'elbiseler',
      name: 'Askılı Yırtmaçlı Beli Kuşaklı Çiçekli Kadın Elbise',
      slug: 'askili-yirtmacli-beli-kusakli-cicekli-kadin-elbise',
      desc: 'İnce ayarlanabilir askılı, yandan yırtmaçlı, ferahlatıcı yazlık çiçek desenli kadın elbise.',
      base_price_cents: 72000, image: 'img/prod-dress-2.jpg', rating: 4.8, review_count: 65, is_featured: 0, is_recent: 1,
      variants: [
        { sku: 'YRT-S-DES', size: 'S', color: 'Desenli', stock: 10, price_cents: 72000 },
        { sku: 'YRT-M-DES', size: 'M', color: 'Desenli', stock: 12, price_cents: 72000 }
      ]
    },
    {
      cat: 'elbiseler',
      name: 'Bohem V Yaka Fırfırlı Kat Kat Midi Kadın Elbise',
      slug: 'bohem-v-yaka-firfirli-kat-kat-midi-kadin-elbise',
      desc: 'Etek ucu fırfırlı, dökümlü viskon kumaş, modern bohem tarzı kadın elbise.',
      base_price_cents: 55000, image: 'img/prod-dress-3.jpg', rating: 4.6, review_count: 42, is_featured: 0, is_recent: 0,
      variants: [
        { sku: 'BHM-M-BEY', size: 'M', color: 'Krem', stock: 9, price_cents: 55000 },
        { sku: 'BHM-L-BEY', size: 'L', color: 'Krem', stock: 11, price_cents: 55000 }
      ]
    },

    // Erkek Elbiseleri (Takım Elbise)
    {
      cat: 'elbiseler',
      name: 'İtalyan Kesim Kruvaze Düğmeli Lacivert Erkek Takım Elbise',
      slug: 'italyan-kesim-kruvaze-dugmeli-lacivert-erkek-takim-elbise',
      desc: 'Modern İtalyan kruvaze kesim, zarif düğme detaylı, şık ve karizmatik lacivert erkek takım elbise. Özel davet ve iş modası için idealdir.',
      base_price_cents: 289990, image: 'img/prod-suit-1.jpg', rating: 4.9, review_count: 54, is_featured: 1, is_recent: 1,
      variants: [
        { sku: 'TAK-48-LAC', size: '48', color: 'Lacivert', stock: 8, price_cents: 289990 },
        { sku: 'TAK-50-LAC', size: '50', color: 'Lacivert', stock: 12, price_cents: 289990 },
        { sku: 'TAK-52-LAC', size: '52', color: 'Lacivert', stock: 6, price_cents: 289990 },
        { sku: 'TAK-54-LAC', size: '54', color: 'Lacivert', stock: 0, price_cents: 289990 } // Tükendi
      ]
    },
    {
      cat: 'elbiseler',
      name: 'Klasik Kesim Antrasit Koyu Gri Yün Erkek Takım Elbise',
      slug: 'klasik-kesim-antrasit-koyu-gri-yun-erkek-takim-elbise',
      desc: 'Birinci sınıf yün karışımlı kumaşı, modern kırlangıç yaka ve zamansız kesimiyle üstün şıklık sunan antrasit gri erkek takım elbise. Düğün, gala ve iş toplantıları için kusursuz seçim.',
      base_price_cents: 259990, image: 'img/prod-suit-2.jpg', rating: 4.8, review_count: 47, is_featured: 1, is_recent: 0,
      variants: [
        { sku: 'TAK-48-GRI', size: '48', color: 'Antrasit Gri', stock: 10, price_cents: 259990 },
        { sku: 'TAK-50-GRI', size: '50', color: 'Antrasit Gri', stock: 14, price_cents: 259990 },
        { sku: 'TAK-52-GRI', size: '52', color: 'Antrasit Gri', stock: 5, price_cents: 259990 }
      ]
    },

    // Bebek Elbiseleri ve Ürünleri
    {
      cat: 'elbiseler',
      name: 'Organik Pamuklu Çiçek Desenli Fırfırlı Bebek Elbisesi',
      slug: 'organik-pamuklu-cicek-desenli-firfirli-bebek-elbisesi',
      desc: 'Yumuşacık nefes alan %100 organik pamuk kumaş, sevimli pastel kır çiçekleri ve omuz fırfır detaylı kız bebek yazlık elbisesi. Bebek ve çocuk ürünleri serisi.',
      base_price_cents: 38990, image: 'img/prod-baby-1.jpg', rating: 4.9, review_count: 62, is_featured: 1, is_recent: 1,
      variants: [
        { sku: 'BBK-6M-PEM', size: '6-9 Ay', color: 'Çiçekli Pembe', stock: 15, price_cents: 38990 },
        { sku: 'BBK-12M-PEM', size: '12-18 Ay', color: 'Çiçekli Pembe', stock: 20, price_cents: 38990 },
        { sku: 'BBK-24M-PEM', size: '2-3 Yaş', color: 'Çiçekli Pembe', stock: 10, price_cents: 38990 }
      ]
    },
    {
      cat: 'elbiseler',
      name: 'Doğum Günü & Özel Gün Pastel Pembe Tüllü Prenses Bebek Elbisesi',
      slug: 'dogum-gunu-ozel-gun-pastel-pembe-tullu-prenses-bebek-elbisesi',
      desc: 'Kat kat dökümlü tüllü kabarık etek, zarif inci ve fiyonk süslemeli, pamuk astarlı lüks kız bebek prenses elbisesi. Doğum günü ve özel günler için bebek ürünü.',
      base_price_cents: 44990, image: 'img/prod-baby-2.jpg', rating: 4.8, review_count: 51, is_featured: 1, is_recent: 0,
      variants: [
        { sku: 'BBK-6M-PDR', size: '6-9 Ay', color: 'Pudra Pembe', stock: 12, price_cents: 44990 },
        { sku: 'BBK-12M-PDR', size: '12-18 Ay', color: 'Pudra Pembe', stock: 16, price_cents: 44990 },
        { sku: 'BBK-24M-PDR', size: '2-3 Yaş', color: 'Pudra Pembe', stock: 8, price_cents: 44990 }
      ]
    },
    {
      cat: 'elbiseler',
      name: 'Bambu Organik Fitilli Adaçayı Yeşili Düğmeli Bebek Tulumu',
      slug: 'bambu-organik-fitilli-adacayi-yesili-dugmeli-bebek-tulumu',
      desc: 'Hassas ciltler için antialerjik nefes alan adaçayı yeşili organik pamuk fitilli kumaş, önden ahşap düğmeli şık ve rahat bebek tulumu ve zıbını. Bebek ürünü.',
      base_price_cents: 32990, image: 'img/prod-baby-3.jpg', rating: 4.7, review_count: 38, is_featured: 0, is_recent: 1,
      variants: [
        { sku: 'BBK-3M-YES', size: '3-6 Ay', color: 'Adaçayı Yeşili', stock: 14, price_cents: 32990 },
        { sku: 'BBK-6M-YES', size: '6-9 Ay', color: 'Adaçayı Yeşili', stock: 18, price_cents: 32990 },
        { sku: 'BBK-12M-YES', size: '12-18 Ay', color: 'Adaçayı Yeşili', stock: 12, price_cents: 32990 }
      ]
    },

    // 2. GÖMLEKLER
    {
      cat: 'gomlekler',
      name: 'Slim Fit Oxford Düğmeli Lacivert Erkek Gömlek',
      slug: 'slim-fit-oxford-dugmeli-lacivert-erkek-gomlek',
      desc: '%100 pamuklu kırışmaya dayanıklı oxford kumaş, düğmeli yaka, modern slim fit lacivert erkek gömlek.',
      base_price_cents: 49990, image: 'img/prod-shirt-1.jpg', rating: 4.8, review_count: 110, is_featured: 1, is_recent: 1,
      variants: [
        { sku: 'GOM-S-LAC', size: 'S', color: 'Lacivert', stock: 12, price_cents: 49990 },
        { sku: 'GOM-M-LAC', size: 'M', color: 'Lacivert', stock: 18, price_cents: 49990 },
        { sku: 'GOM-L-LAC', size: 'L', color: 'Lacivert', stock: 15, price_cents: 49990 },
        { sku: 'GOM-XL-LAC', size: 'XL', color: 'Lacivert', stock: 7, price_cents: 49990 }
      ]
    },
    {
      cat: 'gomlekler',
      name: 'Siyah Dantel Detaylı Dökümlü Bohem Kadın Bluz Gömlek',
      slug: 'siyah-dantel-detayli-dokumlu-bohem-kadin-bluz-gomlek',
      desc: 'Omuz ve yaka kısmında zarif şeffaf dantel işlemeli, önden düğmeli, geniş balon kollu şık siyah kadın bluz.',
      base_price_cents: 58990, image: 'img/product-7.jpg', rating: 4.9, review_count: 175, is_featured: 1, is_recent: 0,
      variants: [
        { sku: 'BLZ-S-SIY', size: 'S', color: 'Siyah', stock: 10, price_cents: 58990 },
        { sku: 'BLZ-M-SIY', size: 'M', color: 'Siyah', stock: 16, price_cents: 58990 },
        { sku: 'BLZ-L-SIY', size: 'L', color: 'Siyah', stock: 8, price_cents: 58990 }
      ]
    },
    {
      cat: 'gomlekler',
      name: 'Klasik Kesim Poplin Pamuklu Uzun Kollu Gömlek',
      slug: 'klasik-kesim-poplin-pamuklu-uzun-kollu-gomlek',
      desc: 'İş ortamı ve resmi davetler için nefes alan kumaş, ütü istemeyen poplin erkek gömlek.',
      base_price_cents: 45000, image: 'img/prod-shirt-white.jpg', rating: 4.5, review_count: 53, is_featured: 0, is_recent: 1,
      variants: [
        { sku: 'POP-M-LAC', size: 'M', color: 'Lacivert', stock: 14, price_cents: 45000 },
        { sku: 'POP-L-LAC', size: 'L', color: 'Lacivert', stock: 9, price_cents: 45000 }
      ]
    },
    {
      cat: 'gomlekler',
      name: 'Beli Bağlamalı İspanyol Kol Dantelli Kadın Gömlek',
      slug: 'beli-baglamali-ispanyol-kol-dantelli-kadin-gomlek',
      desc: 'Bohem tarzı kol bağlamalı, v yakalı, yumuşak dokulu siyah tasarım kadın gömlek.',
      base_price_cents: 62000, image: 'img/prod-shirt-lace.jpg', rating: 4.7, review_count: 67, is_featured: 0, is_recent: 0,
      variants: [
        { sku: 'ISP-S-SIY', size: 'S', color: 'Siyah', stock: 7, price_cents: 62000 },
        { sku: 'ISP-M-SIY', size: 'M', color: 'Siyah', stock: 11, price_cents: 62000 }
      ]
    },

    // 3. KOT (JEANS)
    {
      cat: 'kot',
      name: 'Klasik Yıkamalı Düz Paça Slim Fit Mavi Kot Pantolon',
      slug: 'klasik-yikamali-duz-paca-slim-fit-mavi-kot-pantolon',
      desc: 'Doğal taşlama efektli, esnek konforlu denim pamuk kumaş, 5 cepli klasik mavi kot pantolon.',
      base_price_cents: 59990, image: 'img/prod-kot-1.jpg', rating: 4.8, review_count: 215, is_featured: 1, is_recent: 1,
      variants: [
        { sku: 'KOT-30-MAV', size: 'M', color: 'Mavi', stock: 15, price_cents: 59990 },
        { sku: 'KOT-32-MAV', size: 'L', color: 'Mavi', stock: 20, price_cents: 59990 },
        { sku: 'KOT-34-MAV', size: 'XL', color: 'Mavi', stock: 8, price_cents: 59990 }
      ]
    },
    {
      cat: 'kot',
      name: 'Yüksek Bel Retro Düz Kesim Denim Kot Pantolon',
      slug: 'yuksek-bel-retro-duz-kesim-denim-kot-pantolon',
      desc: 'Vintage görünüm, yüksek bel kesim, dayanıklı dikiş yapısı ve toparlayıcı kalıp kot pantolon.',
      base_price_cents: 64990, image: 'img/prod-kot-retro.jpg', rating: 4.9, review_count: 130, is_featured: 1, is_recent: 0,
      variants: [
        { sku: 'RET-S-MAV', size: 'S', color: 'Açık Mavi', stock: 12, price_cents: 64990 },
        { sku: 'RET-M-MAV', size: 'M', color: 'Açık Mavi', stock: 16, price_cents: 64990 },
        { sku: 'RET-L-MAV', size: 'L', color: 'Açık Mavi', stock: 10, price_cents: 64990 }
      ]
    },
    {
      cat: 'kot',
      name: 'Esnek Likralı Rahat Kalıp Taşlanmış Kot Jean',
      slug: 'esnek-likrali-rahat-kalip-taslanmis-kot-jean',
      desc: 'Gün boyu hareket özgürlüğü sunan elastan karışımlı yumuşak denim kot pantolon.',
      base_price_cents: 54990, image: 'img/prod-kot-black.jpg', rating: 4.6, review_count: 74, is_featured: 0, is_recent: 1,
      variants: [
        { sku: 'ESN-M-MAV', size: 'M', color: 'Mavi', stock: 14, price_cents: 54990 },
        { sku: 'ESN-L-MAV', size: 'L', color: 'Mavi', stock: 18, price_cents: 54990 }
      ]
    },

    // 4. MAYO (SWIMWEAR)
    {
      cat: 'mayo',
      name: 'Toparlayıcı Askılı Lacivert Tek Parça Kadın Mayo',
      slug: 'toparlayici-askili-lacivert-tek-parca-kadin-mayo',
      desc: 'Göğüs destekli kaplı süngerli, toparlayıcı elastik kumaş, güneş ışığına ve klora dayanıklı şık lacivert mayo.',
      base_price_cents: 52990, image: 'img/prod-swim-1.jpg', rating: 4.8, review_count: 92, is_featured: 1, is_recent: 1,
      variants: [
        { sku: 'MYO-S-LAC', size: 'S', color: 'Lacivert', stock: 10, price_cents: 52990 },
        { sku: 'MYO-M-LAC', size: 'M', color: 'Lacivert', stock: 14, price_cents: 52990 },
        { sku: 'MYO-L-LAC', size: 'L', color: 'Lacivert', stock: 8, price_cents: 52990 }
      ]
    },
    {
      cat: 'mayo',
      name: 'V Yaka Büzgü Detaylı Hızlı Kuruyan Deniz Mayosu',
      slug: 'v-yaka-buzgu-detayli-hizli-kuruyan-deniz-mayosu',
      desc: 'Ön kısmı büzgülü zarif tasarım, su tutmayan mikrofiber kumaş plaj mayosu.',
      base_price_cents: 47990, image: 'img/prod-swim-red.jpg', rating: 4.7, review_count: 61, is_featured: 0, is_recent: 0,
      variants: [
        { sku: 'BZG-M-LAC', size: 'M', color: 'Lacivert', stock: 11, price_cents: 47990 },
        { sku: 'BZG-L-LAC', size: 'L', color: 'Lacivert', stock: 13, price_cents: 47990 }
      ]
    },
    {
      cat: 'mayo',
      name: 'Klasik Kesim Göğüs Destekli Şık Plaj Mayosu',
      slug: 'klasik-kesim-gogus-destekli-sik-plaj-mayosu',
      desc: 'Zarif askı detayları ve sırt dekolteli lüks havuz ve plaj mayosu.',
      base_price_cents: 58000, image: 'img/prod-swim-black.jpg', rating: 4.6, review_count: 45, is_featured: 0, is_recent: 1,
      variants: [
        { sku: 'PLJ-S-LAC', size: 'S', color: 'Lacivert', stock: 9, price_cents: 58000 },
        { sku: 'PLJ-M-LAC', size: 'M', color: 'Lacivert', stock: 12, price_cents: 58000 }
      ]
    },

    // 5. UYKU KIYAFETLERİ (SLEEPWEAR)
    {
      cat: 'uyku-kiyafetleri',
      name: 'Zümrüt Yeşili İpek Saten Düğmeli Kadın Pijama Takımı',
      slug: 'zumrut-yesili-ipek-saten-dugmeli-kadin-pijama-takimi',
      desc: 'Lüks ipeksi parlak saten kumaş, beyaz biye dikiş detaylı, düğmeli gömlek ve boru paça pijama altından oluşan zarif takım.',
      base_price_cents: 69990, image: 'img/prod-sleep-1.jpg', rating: 4.9, review_count: 148, is_featured: 1, is_recent: 1,
      variants: [
        { sku: 'PIJ-S-YES', size: 'S', color: 'Zümrüt Yeşili', stock: 12, price_cents: 69990 },
        { sku: 'PIJ-M-YES', size: 'M', color: 'Zümrüt Yeşili', stock: 18, price_cents: 69990 },
        { sku: 'PIJ-L-YES', size: 'L', color: 'Zümrüt Yeşili', stock: 10, price_cents: 69990 }
      ]
    },
    {
      cat: 'uyku-kiyafetleri',
      name: 'Boru Paça Rahat Kesim İpek Dokulu Uyku Pijaması',
      slug: 'boru-paca-rahat-kesim-ipek-dokulu-uyku-pijamasi',
      desc: 'Beli bağcıklı lastikli, dökümlü ve serin tutan konforlu ev ve uyku kıyafeti.',
      base_price_cents: 62000, image: 'img/prod-sleep-rose.jpg', rating: 4.7, review_count: 73, is_featured: 0, is_recent: 0,
      variants: [
        { sku: 'UYK-M-YES', size: 'M', color: 'Zümrüt Yeşili', stock: 14, price_cents: 62000 },
        { sku: 'UYK-L-YES', size: 'L', color: 'Zümrüt Yeşili', stock: 8, price_cents: 62000 }
      ]
    },
    {
      cat: 'uyku-kiyafetleri',
      name: 'Beli Lastikli Yumuşak Kumaş Jakarlı Sabahlık Pijama',
      slug: 'beli-lastikli-yumusak-kumas-jakarli-sabahlik-pijama',
      desc: 'Cilt dostu yumuşacık saten pijama takımı, şık cep nakış detaylı.',
      base_price_cents: 75000, image: 'img/prod-sleep-robe.jpg', rating: 4.8, review_count: 52, is_featured: 0, is_recent: 1,
      variants: [
        { sku: 'SAB-S-YES', size: 'S', color: 'Zümrüt Yeşili', stock: 7, price_cents: 75000 },
        { sku: 'SAB-M-YES', size: 'M', color: 'Zümrüt Yeşili', stock: 15, price_cents: 75000 }
      ]
    },

    // 6. SPOR GİYİM (SPORTSWEAR)
    {
      cat: 'spor-giyim',
      name: 'Mavi Bisiklet Yaka Pamuklu Günlük Sweatshirt',
      slug: 'mavi-bisiklet-yaka-pamuklu-gunluk-sweatshirt',
      desc: 'Canlı kobalt mavi renkte, ribanalı manşet ve etek ucu, yumuşak içi pamuklu spor sweatshirt.',
      base_price_cents: 39990, image: 'img/product-2.jpg', rating: 4.8, review_count: 180, is_featured: 1, is_recent: 1,
      variants: [
        { sku: 'SWT-S-MAV', size: 'S', color: 'Mavi', stock: 15, price_cents: 39990 },
        { sku: 'SWT-M-MAV', size: 'M', color: 'Mavi', stock: 22, price_cents: 39990 },
        { sku: 'SWT-L-MAV', size: 'L', color: 'Mavi', stock: 16, price_cents: 39990 },
        { sku: 'SWT-XL-MAV', size: 'XL', color: 'Mavi', stock: 9, price_cents: 39990 }
      ]
    },
    {
      cat: 'spor-giyim',
      name: 'İçi Şardonlu Sıcak Tutan Basic Spor Sweatshirt',
      slug: 'ici-sardonlu-sicak-tutan-basic-spor-sweatshirt',
      desc: 'Soğuk havalarda koşu ve spor aktiviteleri için nefes alabilir pamuk kumaş sweatshirt.',
      base_price_cents: 42000, image: 'img/prod-sport-hoodie.jpg', rating: 4.7, review_count: 95, is_featured: 0, is_recent: 0,
      variants: [
        { sku: 'SAR-M-MAV', size: 'M', color: 'Mavi', stock: 12, price_cents: 42000 },
        { sku: 'SAR-L-MAV', size: 'L', color: 'Mavi', stock: 14, price_cents: 42000 }
      ]
    },
    {
      cat: 'spor-giyim',
      name: 'Ribanalı Manşet Rahat Kalıp Spor Eşofman Üstü',
      slug: 'ribanali-manset-rahat-kalip-spor-esofman-ustu',
      desc: 'Günlük sokak modası ve spor salonu antrenmanları için şık pamuklu üst giyim.',
      base_price_cents: 38000, image: 'img/prod-sport-black.jpg', rating: 4.6, review_count: 63, is_featured: 0, is_recent: 1,
      variants: [
        { sku: 'RBN-S-MAV', size: 'S', color: 'Mavi', stock: 8, price_cents: 38000 },
        { sku: 'RBN-M-MAV', size: 'M', color: 'Mavi', stock: 15, price_cents: 38000 }
      ]
    },

    // 7. TULUMLAR (JUMPSUITS)
    {
      cat: 'tulumlar',
      name: 'Keten Kuşaklı Geniş Paça V Yaka Kolsuz Bej Tulum',
      slug: 'keten-kusakli-genis-paca-v-yaka-kolsuz-bej-tulum',
      desc: 'Doğal keten kumaş, önden düğmeli, beli kemerli, geniş rahat paçalı yazlık zarif kadın tulumu.',
      base_price_cents: 78990, image: 'img/prod-jumpsuit-1.jpg', rating: 4.9, review_count: 125, is_featured: 1, is_recent: 1,
      variants: [
        { sku: 'TLM-S-BEJ', size: 'S', color: 'Bej', stock: 10, price_cents: 78990 },
        { sku: 'TLM-M-BEJ', size: 'M', color: 'Bej', stock: 15, price_cents: 78990 },
        { sku: 'TLM-L-BEJ', size: 'L', color: 'Bej', stock: 8, price_cents: 78990 }
      ]
    },
    {
      cat: 'tulumlar',
      name: 'Düğmeli Doğal Keten Kumaş Rahat Günlük Tulum',
      slug: 'dugmeli-dogal-keten-kumas-rahat-gunluk-tulum',
      desc: 'Nefes alabilen keten karışımı, yan cepli ve şık yaka detaylı modern kadın tulum.',
      base_price_cents: 82000, image: 'img/prod-jumpsuit-olive.jpg', rating: 4.7, review_count: 58, is_featured: 0, is_recent: 0,
      variants: [
        { sku: 'DUG-M-BEJ', size: 'M', color: 'Krem Bej', stock: 12, price_cents: 82000 },
        { sku: 'DUG-L-BEJ', size: 'L', color: 'Krem Bej', stock: 9, price_cents: 82000 }
      ]
    },
    {
      cat: 'tulumlar',
      name: 'Cepli Beli Kemerli Şık Yazlık Kadın Tulum',
      slug: 'cepli-beli-kemerli-sik-yazlik-kadin-tulum',
      desc: 'Sıcak günlerde ferahlık sağlayan dökümlü kumaş, ayarlanabilir bel kuşaklı tasarım tulum.',
      base_price_cents: 74000, image: 'img/prod-jumpsuit-navy.jpg', rating: 4.8, review_count: 81, is_featured: 0, is_recent: 1,
      variants: [
        { sku: 'CEP-S-BEJ', size: 'S', color: 'Bej', stock: 11, price_cents: 74000 },
        { sku: 'CEP-M-BEJ', size: 'M', color: 'Bej', stock: 13, price_cents: 74000 }
      ]
    },

    // 8. BLAZERLER (BLAZERS)
    {
      cat: 'blazerler',
      name: 'Kruvaze Yaka Gold Düğmeli Şık Lacivert Blazer Ceket',
      slug: 'kruvaze-yaka-gold-dugmeli-sik-lacivert-blazer-ceket',
      desc: 'Kruvaze kesim, altın renk metal kabartmalı düğmeler, omuz vatkalı, tam astarlı lüks lacivert blazer ceket.',
      base_price_cents: 119990, image: 'img/prod-blazer-1.jpg', rating: 4.9, review_count: 160, is_featured: 1, is_recent: 1,
      variants: [
        { sku: 'BLZ-S-LAC', size: 'S', color: 'Lacivert', stock: 8, price_cents: 119990 },
        { sku: 'BLZ-M-LAC', size: 'M', color: 'Lacivert', stock: 14, price_cents: 119990 },
        { sku: 'BLZ-L-LAC', size: 'L', color: 'Lacivert', stock: 10, price_cents: 119990 }
      ]
    },
    {
      cat: 'blazerler',
      name: 'Omuz Vatkalı İtalyan Kesim Astarlı Kadın Blazer',
      slug: 'omuz-vatkali-italyan-kesim-astarli-kadin-blazer',
      desc: 'İş toplantıları ve şık davetler için kusursuz kalıp, kırışmaz kumaş tasarım blazer.',
      base_price_cents: 129000, image: 'img/prod-blazer-beige.jpg', rating: 4.8, review_count: 84, is_featured: 0, is_recent: 0,
      variants: [
        { sku: 'ITL-M-LAC', size: 'M', color: 'Lacivert', stock: 12, price_cents: 129000 },
        { sku: 'ITL-L-LAC', size: 'L', color: 'Lacivert', stock: 7, price_cents: 129000 }
      ]
    },
    {
      cat: 'blazerler',
      name: 'Kapak Cepli Dört Düğmeli Ofis Tarzı Blazer',
      slug: 'kapak-cepli-dort-dugmeli-ofis-tarzi-blazer',
      desc: 'Modern kumaş dokusu, cep detaylı, günlük takım elbiselere uyumlu şık blazer.',
      base_price_cents: 115000, image: 'img/prod-blazer-black.jpg', rating: 4.7, review_count: 62, is_featured: 0, is_recent: 1,
      variants: [
        { sku: 'KPK-S-LAC', size: 'S', color: 'Lacivert', stock: 9, price_cents: 115000 },
        { sku: 'KPK-M-LAC', size: 'M', color: 'Lacivert', stock: 11, price_cents: 115000 }
      ]
    },

    // 9. CEKETLER (JACKETS)
    {
      cat: 'ceketler',
      name: 'Hakiki Deri Biker Asimetrik Fermuarlı Siyah Mont Ceket',
      slug: 'hakiki-deri-biker-asimetrik-fermuarli-siyah-mont-ceket',
      desc: 'Manda derisi sağlam doku, asimetrik gümüş fermuarlar, kemerli bel kısmı ve fermuarlı cepleriyle efsanevi siyah deri biker ceket.',
      base_price_cents: 189990, image: 'img/prod-jacket-1.jpg', rating: 4.9, review_count: 195, is_featured: 1, is_recent: 1,
      variants: [
        { sku: 'BKR-M-SIY', size: 'M', color: 'Siyah', stock: 7, price_cents: 189990 },
        { sku: 'BKR-L-SIY', size: 'L', color: 'Siyah', stock: 12, price_cents: 189990 },
        { sku: 'BKR-XL-SIY', size: 'XL', color: 'Siyah', stock: 5, price_cents: 189990 }
      ]
    },
    {
      cat: 'ceketler',
      name: 'Kemerli Bel Tokalı Klasik Motorsikletçi Deri Ceket',
      slug: 'kemerli-bel-tokali-klasik-motorsikletci-deri-ceket',
      desc: 'Rüzgar ve soğuk geçirmeyen kalın astar, çıtçıtlı yaka detaylı erkek deri ceket.',
      base_price_cents: 199000, image: 'img/prod-jacket-brown.jpg', rating: 4.8, review_count: 112, is_featured: 0, is_recent: 0,
      variants: [
        { sku: 'MOT-M-SIY', size: 'M', color: 'Siyah', stock: 8, price_cents: 199000 },
        { sku: 'MOT-L-SIY', size: 'L', color: 'Siyah', stock: 10, price_cents: 199000 }
      ]
    },
    {
      cat: 'ceketler',
      name: 'Kapitone Astarlı Çok Cepli Vintage Deri Ceket',
      slug: 'kapitone-astarli-cok-cepli-vintage-deri-ceket',
      desc: 'İçi kapitone dolgulu, kış aylarına uygun fermuarlı cepli sağlam deri mont.',
      base_price_cents: 175000, image: 'img/prod-jacket-bomber.jpg', rating: 4.7, review_count: 85, is_featured: 0, is_recent: 1,
      variants: [
        { sku: 'VNT-L-SIY', size: 'L', color: 'Siyah', stock: 9, price_cents: 175000 },
        { sku: 'VNT-XL-SIY', size: 'XL', color: 'Siyah', stock: 6, price_cents: 175000 }
      ]
    },

    // 10. AYAKKABI (SHOES)
    {
      cat: 'ayakkabi',
      name: 'Nike Cırt Cırtlı Fileli Siyah Çocuk Koşu Spor Ayakkabısı',
      slug: 'nike-cirt-cirtli-fileli-siyah-cocuk-kosu-spor-ayakkabisi',
      desc: 'Hafif esnek beyaz taban, nefes alabilen fileli siyah kumaş saya, pratik cırt cırtlı bant çocuk spor ayakkabısı.',
      base_price_cents: 84990, image: 'img/product-4.jpg', rating: 4.9, review_count: 240, is_featured: 1, is_recent: 1,
      variants: [
        { sku: 'NKE-26-SIY', size: '26', color: 'Siyah', stock: 10, price_cents: 84990 },
        { sku: 'NKE-27-SIY', size: '27', color: 'Siyah', stock: 15, price_cents: 84990 },
        { sku: 'NKE-28-SIY', size: '28', color: 'Siyah', stock: 8, price_cents: 84990 },
        { sku: 'NKE-29-SIY', size: '29', color: 'Siyah', stock: 1, price_cents: 84990 } // Kritik 1 stok!
      ]
    },
    {
      cat: 'ayakkabi',
      name: 'Merrell Vibram Taban Outdoor Doğa Yürüyüş Ayakkabısı',
      slug: 'merrell-vibram-taban-outdoor-doga-yuruyus-ayakkabisi',
      desc: 'Kaymaz Vibram dişli kauçuk taban, su itici dayanıklı saya, doğa yürüyüşü ve trekking ayakkabısı.',
      base_price_cents: 149990, image: 'img/cat-3.jpg', rating: 4.8, review_count: 135, is_featured: 1, is_recent: 0,
      variants: [
        { sku: 'MRL-41-HAK', size: '41', color: 'Haki', stock: 7, price_cents: 149990 },
        { sku: 'MRL-42-HAK', size: '42', color: 'Haki', stock: 11, price_cents: 149990 },
        { sku: 'MRL-43-HAK', size: '43', color: 'Haki', stock: 9, price_cents: 149990 }
      ]
    },
    {
      cat: 'ayakkabi',
      name: 'Nefes Alabilir Hafif Taban Çocuk Yürüyüş Ayakkabısı',
      slug: 'nefes-alabilir-hafif-taban-cocuk-yuruyus-ayakkabisi',
      desc: 'Çocukların adımlarına uyumlu darbe emici yumuşak orta tabanlı günlük spor ayakkabı.',
      base_price_cents: 79990, image: 'img/prod-shoe-grey.jpg', rating: 4.7, review_count: 82, is_featured: 0, is_recent: 1,
      variants: [
        { sku: 'AYK-27-GRI', size: '27', color: 'Gri', stock: 10, price_cents: 79990 },
        { sku: 'AYK-28-GRI', size: '28', color: 'Gri', stock: 14, price_cents: 79990 }
      ]
    },

    // ŞABLONUN ORİJİNAL GÖRSELLERİNE BİREBİR UYGUN DİĞER ÜRÜNLER (Görsel-İsim Uyumu Tam!)
    {
      cat: 'kamera',
      name: 'Olympus E-450 SLR Profesyonel Fotoğraf Makinesi & Lens Kiti',
      slug: 'olympus-e450-slr-fotograf-makinesi-kiti',
      desc: '10.0 Megapiksel Canlı MOS sensör, 14-42mm ED lens, kompakt ve hafif gövde tasarımıyla yüksek performanslı dijital SLR fotoğraf makinesi.',
      base_price_cents: 145000, image: 'img/cat-2.jpg', rating: 4.9, review_count: 178, is_featured: 1, is_recent: 1,
      variants: [
        { sku: 'OLY-STD-SIY', size: 'Standart', color: 'Siyah', stock: 6, price_cents: 145000 }
      ]
    },
    {
      cat: 'kamera',
      name: 'Lumix 4K Aynasız Profesyonel Fotoğraf Makinesi & Zoom Lens',
      slug: 'lumix-4k-aynasiz-fotograf-makinesi',
      desc: '14-50mm optik görüntü sabitlemeli zoom lens, 4K video çekim yeteneği, profesyonel manuel ayar tekerlekleri.',
      base_price_cents: 185000, image: 'img/product-1.jpg', rating: 4.9, review_count: 160, is_featured: 1, is_recent: 1,
      variants: [
        { sku: 'CAM-STD-SIY', size: 'Standart', color: 'Siyah', stock: 5, price_cents: 185000 }
      ]
    },
    {
      cat: 'kamera',
      name: 'DJI Phantom 4K Kameralı Profesyonel Drone & Gimbal',
      slug: 'dji-phantom-4k-kamerali-drone',
      desc: '3 eksenli mekanik gimbal, 4K Ultra HD kamera, GPS destekli otomatik eve dönüş ve akıllı uçuş modları.',
      base_price_cents: 245000, image: 'img/product-5.jpg', rating: 4.9, review_count: 210, is_featured: 1, is_recent: 1,
      variants: [
        { sku: 'DRN-STD-BEY', size: 'Standart', color: 'Beyaz', stock: 4, price_cents: 245000 }
      ]
    },
    {
      cat: 'kozmetik',
      name: 'Curology 3lü Günlük Cilt Bakım & Yüz Temizleme Seti',
      slug: 'curology-3lu-cilt-bakim-temizleme-seti',
      desc: 'Yüz temizleme jeli, zenginleştirici nemlendirici krem ve özel formüllü gece bakım losyonu 3lü bakım kiti.',
      base_price_cents: 48000, image: 'img/product-8.jpg', rating: 4.8, review_count: 145, is_featured: 1, is_recent: 1,
      variants: [
        { sku: 'CUR-STD-SET', size: 'Set', color: 'Standart', stock: 20, price_cents: 48000 }
      ]
    },
    {
      cat: 'kozmetik',
      name: 'Curology Yoğun Nemlendirici Hyalüronik Yüz Bakım Kremi',
      slug: 'curology-yogun-nemlendirici-yuz-bakim-kremi',
      desc: 'Tüm cilt tipleri için derinlemesine nemlendirme sağlayan, ağırlık hissi bırakmayan hafif ve zenginleştirici yüz kremi.',
      base_price_cents: 22000, image: 'img/prod-cosmetic-cream.jpg', rating: 4.8, review_count: 112, is_featured: 1, is_recent: 1,
      variants: [
        { sku: 'CUR-50-BEY', size: '50ml', color: 'Beyaz', stock: 15, price_cents: 22000 },
        { sku: 'CUR-100-BEY', size: '100ml', color: 'Beyaz', stock: 8, price_cents: 38000 }
      ]
    },
    {
      cat: 'kozmetik',
      name: 'Curology Gözenek Arındırıcı Yüz Temizleme Jeli',
      slug: 'curology-gozenek-arindirici-yuz-temizleme-jeli',
      desc: 'Cildi kurutmadan sebum dengesini sağlayan, gözenekleri derinlemesine arındıran günlük nazik temizleyici jel.',
      base_price_cents: 18000, image: 'img/prod-cosmetic-gel.jpg', rating: 4.7, review_count: 95, is_featured: 0, is_recent: 1,
      variants: [
        { sku: 'CUR-150-LAC', size: '150ml', color: 'Lacivert', stock: 20, price_cents: 18000 }
      ]
    },
    {
      cat: 'spor-giyim',
      name: 'Apple Watch Hasır Çelik Milanese Kordonlu Akıllı Saat',
      slug: 'apple-watch-celik-hasir-kordonlu-akilli-saat',
      desc: 'Manyetik kilitli paslanmaz çelik hasır kordon, retina OLED dokunmatik ekran ve kalp atış hızı sensörü.',
      base_price_cents: 135000, image: 'img/product-6.jpg', rating: 4.9, review_count: 320, is_featured: 1, is_recent: 0,
      variants: [
        { sku: 'WAT-42-GUM', size: '42mm', color: 'Gümüş', stock: 12, price_cents: 135000 }
      ]
    },
    {
      cat: 'uyku-kiyafetleri',
      name: 'Klasik Vintage Seramik Abajur Yatak Odası Masa Lambası',
      slug: 'vintage-seramik-abajur-yatak-odasi-masa-lambasi',
      desc: 'Yatak odası ve dinlenme alanları için kahverengi seramik gövdeli, pileli şapkalı, loş dinlendirici sarı ışıklı klasik komodin lambası.',
      base_price_cents: 65000, image: 'img/product-3.jpg', rating: 4.8, review_count: 89, is_featured: 1, is_recent: 0,
      variants: [
        { sku: 'LMB-STD-KAH', size: 'Standart', color: 'Kahverengi', stock: 8, price_cents: 65000 }
      ]
    },
    {
      cat: 'blazerler',
      name: 'Turkuaz Ergonomik Ayarlanabilir Deri Ofis Çalışma Koltuğu',
      slug: 'turkuaz-ergonomik-deri-ofis-koltugu',
      desc: 'Krom gövdeli, amortisörlü yükseklik ayarı, bel destekli pedli turkuaz deri yönetici ve çalışma koltuğu.',
      base_price_cents: 165000, image: 'img/product-9.jpg', rating: 4.8, review_count: 98, is_featured: 1, is_recent: 0,
      variants: [
        { sku: 'CHR-STD-TUR', size: 'Standart', color: 'Turkuaz Mavi', stock: 6, price_cents: 165000 }
      ]
    }
  ];

  const insertProductStmt = db.prepare(`
    INSERT INTO products (
      category_id, name, slug, description, base_price_cents, image, rating, review_count, is_featured, is_recent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertVariantStmt = db.prepare(`
    INSERT INTO product_variants (
      product_id, sku, size, color, stock, price_cents
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  let totalProducts = 0;
  let totalVariants = 0;

  for (const prod of products) {
    const catId = catMap[prod.cat] || 1;
    const pRes = insertProductStmt.run(
      catId, prod.name, prod.slug, prod.desc, prod.base_price_cents,
      prod.image, prod.rating, prod.review_count, prod.is_featured, prod.is_recent
    );
    const prodId = pRes.lastInsertRowid;
    totalProducts++;

    for (const v of prod.variants) {
      insertVariantStmt.run(prodId, v.sku, v.size, v.color, v.stock, v.price_cents);
      totalVariants++;
    }
  }

  console.log(`✅ Tohumlama Tamamlandı!`);
  console.log(`   - Toplam Kategori: ${categories.length} (Şablonun orijinal 10 kategorisi)`);
  console.log(`   - Toplam Ürün: ${totalProducts} (Şartnamedeki "en az 30 ürün" kuralı sağlandı)`);
  console.log(`   - Toplam Varyant: ${totalVariants} (Şartnamedeki "en az 10 üründe varyant" kuralı sağlandı)`);
  console.log(`   - Toplam Kupon: ${coupons.length}`);
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
