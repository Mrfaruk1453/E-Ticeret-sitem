const { db, transaction } = require('../src/config/database');
const { initSchema } = require('../src/db/schema');
const { checkoutOrder } = require('../src/services/orderService');
const { addToCart } = require('../src/services/cartService');

async function runConcurrencyTest() {
  console.log('================================================================');
  console.log('  EŞZAMANLILIK (CONCURRENCY / RACE CONDITION) STOK YARIŞI TESTİ ');
  console.log('  Osmaniye Korkut Ata Üniversitesi - Bilgisayar Programcılığı   ');
  console.log('================================================================\n');

  initSchema();

  // 1. Create a dedicated test product and a variant with EXACTLY 1 stock
  console.log('1. Test Ürünü Hazırlanıyor:');
  const testSku = `CONCURRENCY-TEST-${Date.now()}`;
  let testVariantId = null;
  let testProductId = null;

  transaction(() => {
    // Find available category
    const cat = db.prepare("SELECT id FROM categories LIMIT 1").get();
    const catId = cat ? cat.id : null;

    const prodRes = db.prepare(`
      INSERT INTO products (category_id, name, slug, description, base_price_cents, is_featured, is_recent)
      VALUES (?, ?, ?, ?, ?, 0, 0)
    `).run(catId, 'Kritik Stok Yarış Testi Ürünü', `kritik-stok-${Date.now()}`, 'Eşzamanlılık testi için özel stok', 10000);

    const varRes = db.prepare(`
      INSERT INTO product_variants (product_id, sku, size, color, stock, price_cents)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(prodRes.lastInsertRowid, testSku, 'M', 'Siyah', 1, 10000); // STOK: SADECE 1 ADET!

    testVariantId = varRes.lastInsertRowid;
    testProductId = prodRes.lastInsertRowid;
  });

  try {
    const initialStock = db.prepare('SELECT stock FROM product_variants WHERE id = ?').get(testVariantId).stock;
    console.log(`   - Ürün varyantı oluşturuldu. SKU: ${testSku}`);
    console.log(`   - Başlangıç Stok Adedi: ${initialStock} (Yalnızca 1 adet son ürün!)`);

    // 2. Prepare two different customers with separate sessions
    const sessionUserA = `session-user-a-${Date.now()}`;
    const sessionUserB = `session-user-b-${Date.now()}`;

    // Both users add the last item to their cart
    addToCart(sessionUserA, testVariantId, 1);
    addToCart(sessionUserB, testVariantId, 1);
    console.log('   - İki farklı müşteri (Müşteri A ve Müşteri B) son 1 ürünü sepetine ekledi.\n');

    console.log('2. Eşzamanlı İstekler Başlatılıyor:');
    console.log('   - Her iki kullanıcı AYNI ANDA ödeme tamamlama isteği gönderiyor...');

    const checkoutPayloadA = {
      customerName: 'Müşteri A (Ali Yılmaz)',
      customerEmail: 'ali@example.com',
      customerPhone: '05551112233',
      shippingAddress: 'Atatürk Cad. No:1',
      shippingCity: 'Osmaniye',
      cardNumber: '4242424242424242',
      cardExpiry: '12/28',
      cardCvv: '123'
    };

    const checkoutPayloadB = {
      customerName: 'Müşteri B (Ayşe Demir)',
      customerEmail: 'ayse@example.com',
      customerPhone: '05554445566',
      shippingAddress: 'Cumhuriyet Mah. No:2',
      shippingCity: 'Osmaniye',
      cardNumber: '4242424242424242',
      cardExpiry: '12/28',
      cardCvv: '123'
    };

    // Launch both checkout requests concurrently
    const startTime = Date.now();
    const results = await Promise.allSettled([
      checkoutOrder(sessionUserA, checkoutPayloadA),
      checkoutOrder(sessionUserB, checkoutPayloadB)
    ]);
    const duration = Date.now() - startTime;

    console.log(`   - İstekler tamamlandı (${duration} ms).\n`);

    // 3. Analyze results
    console.log('3. Test Sonuçlarının İncelenmesi:');
    let successCount = 0;
    let failCount = 0;

    results.forEach((res, index) => {
      const userLabel = index === 0 ? 'Müşteri A' : 'Müşteri B';
      if (res.status === 'fulfilled') {
        if (res.value.success) {
          successCount++;
          console.log(`   ✅ ${userLabel}: BAŞARILI! Sipariş No: ${res.value.order.order_number}`);
        } else {
          failCount++;
          console.log(`   ❌ ${userLabel}: BAŞARISIZ! Hata: ${res.value.errorMessage}`);
        }
      } else {
        failCount++;
        console.log(`   ❌ ${userLabel}: REDDEDİLDİ! Hata Mesajı: ${res.reason.message}`);
      }
    });

    // 4. Verify Database Integrity
    const finalVariant = db.prepare('SELECT stock FROM product_variants WHERE id = ?').get(testVariantId);
    console.log('\n4. Veritabanı ve Stok Sağlama Denetimi:');
    console.log(`   - Son Stok Değeri: ${finalVariant.stock}`);

    if (successCount === 1 && failCount === 1 && finalVariant.stock === 0) {
      console.log('\n================================================================');
      console.log('  TEST BAŞARILI! (PASSED)');
      console.log('  1. Tek bir sipariş onaylandı, diğeri stok yetersizliği nedeniyle güvenle engellendi.');
      console.log('  2. Stok eksiye düşmedi (Son Stok: 0).');
      console.log('  3. Veritabanı atomik satır/işlem kilitleme kuralı tam olarak sağlandı.');
      console.log('================================================================\n');
    } else {
      console.error('\n⚠️ TEST BAŞARISIZ: Stok bütünlüğü bozuldu!');
      process.exit(1);
    }
  } finally {
    // 5. Test Verilerini Canlı Katalogdan Temizleme
    try {
      if (testProductId) {
        const orders = db.prepare('SELECT DISTINCT order_id FROM order_items WHERE product_id = ?').all(testProductId);
        for (const o of orders) {
          db.prepare('DELETE FROM order_status_history WHERE order_id = ?').run(o.order_id);
          db.prepare('DELETE FROM payments WHERE order_id = ?').run(o.order_id);
          db.prepare('DELETE FROM order_items WHERE order_id = ?').run(o.order_id);
          db.prepare('DELETE FROM orders WHERE id = ?').run(o.order_id);
        }
        db.prepare('DELETE FROM cart_items WHERE variant_id = ?').run(testVariantId);
        db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(testProductId);
        db.prepare('DELETE FROM products WHERE id = ?').run(testProductId);
      }
    } catch (cleanErr) {
      console.warn('Test temizleme uyarısı:', cleanErr.message);
    }
  }
}

if (require.main === module) {
  runConcurrencyTest().catch(err => {
    console.error('Test hatası:', err);
    process.exit(1);
  });
}

module.exports = { runConcurrencyTest };
