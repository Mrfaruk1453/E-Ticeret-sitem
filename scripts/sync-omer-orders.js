const { db, transaction } = require('../src/config/database');

transaction(() => {
  // 1. Delete all old mock test orders
  const testOrderIds = db.prepare(`
    SELECT id FROM orders 
    WHERE customer_name IN ('Test Müşteri', 'Faruk Öğrenci', 'Müşteri A (Ali Yılmaz)', 'Müşteri B (Ayşe Demir)')
       OR customer_email LIKE '%test%' 
       OR customer_email LIKE '%ogrenci%'
  `).all().map(r => r.id);

  if (testOrderIds.length > 0) {
    const placeholders = testOrderIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM order_items WHERE order_id IN (${placeholders})`).run(...testOrderIds);
    db.prepare(`DELETE FROM order_status_history WHERE order_id IN (${placeholders})`).run(...testOrderIds);
    db.prepare(`DELETE FROM payments WHERE order_id IN (${placeholders})`).run(...testOrderIds);
    db.prepare(`DELETE FROM orders WHERE id IN (${placeholders})`).run(...testOrderIds);
    console.log(`Deleted ${testOrderIds.length} test orders.`);
  }

  // 2. Clear any conflicting order IDs for 63 and 64
  db.prepare(`DELETE FROM order_items WHERE order_id IN (63, 64)`).run();
  db.prepare(`DELETE FROM order_status_history WHERE order_id IN (63, 64)`).run();
  db.prepare(`DELETE FROM payments WHERE order_id IN (63, 64)`).run();
  db.prepare(`DELETE FROM orders WHERE id IN (63, 64) OR order_number IN ('ORD-284194-3657', 'ORD-231641-E929')`).run();

  // 3. Insert Ömer Faruk Üzer's Order 1 (ID 63: ORD-231641-E929 - 649.90 TL)
  db.prepare(`
    INSERT INTO orders (
      id, order_number, session_token, status, tracking_number,
      customer_name, customer_email, customer_phone, shipping_address, shipping_city,
      subtotal_cents, discount_cents, shipping_cents, total_cents, coupon_code,
      idempotency_key, created_at, updated_at
    ) VALUES (
      63, 'ORD-231641-E929', 'session-omer-63', 'ODENDI', NULL,
      'Ömer Faruk Üzer', 'farukuzer1453@gmail.com', '05513514680', 'Piri Reis Mah. 550017. Sokak No:9/2', 'Kahramanmaraş',
      64990, 0, 0, 64990, NULL,
      'SANDBOX-TX-63', '2026-10-26 12:00:00', '2026-10-26 12:00:00'
    )
  `).run();

  const prod1 = db.prepare('SELECT id, name FROM products WHERE slug = ?').get('cicek-desenli-kruvaze-sifon-kadin-yazlik-elbise') || { id: 1, name: 'Çiçek Desenli Kruvaze Şifon Kadın Yazlık Elbise' };
  const var1 = db.prepare('SELECT id, sku FROM product_variants WHERE product_id = ? LIMIT 1').get(prod1.id) || { id: 1, sku: 'ELB-S-BEY' };

  db.prepare(`
    INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_info, price_cents, quantity, total_cents)
    VALUES (63, ?, ?, ?, 'Beden: S / Renk: Beyaz', 64990, 1, 64990)
  `).run(prod1.id, var1.id, prod1.name);

  db.prepare(`
    INSERT INTO order_status_history (order_id, from_status, to_status, note, created_at)
    VALUES (63, 'SEPET', 'ODENDI', 'Sanal POS ödemesi başarıyla onaylandı.', '2026-10-26 12:00:00')
  `).run();

  db.prepare(`
    INSERT INTO payments (order_id, provider_ref, status, error_message, amount_cents, card_last4, created_at)
    VALUES (63, 'SANDBOX-TX-63', 'SUCCESS', NULL, 64990, '4242', '2026-10-26 12:00:00')
  `).run();

  // 4. Insert Ömer Faruk Üzer's Order 2 (ID 64: ORD-284194-3657 - 2899.90 TL)
  db.prepare(`
    INSERT INTO orders (
      id, order_number, session_token, status, tracking_number,
      customer_name, customer_email, customer_phone, shipping_address, shipping_city,
      subtotal_cents, discount_cents, shipping_cents, total_cents, coupon_code,
      idempotency_key, created_at, updated_at
    ) VALUES (
      64, 'ORD-284194-3657', 'session-omer-64', 'ODENDI', NULL,
      'Ömer Faruk Üzer', 'farukuzer1453@gmail.com', '05513514680', 'Piri Reis Mah. 550017. Sokak No:9/2', 'Kahramanmaraş',
      289990, 0, 0, 289990, NULL,
      'SANDBOX-TX-64', '2026-10-26 12:12:00', '2026-10-26 12:12:00'
    )
  `).run();

  const prod2 = db.prepare('SELECT id, name FROM products WHERE slug LIKE ? LIMIT 1').get('%takim%') || prod1;
  const var2 = db.prepare('SELECT id, sku FROM product_variants WHERE product_id = ? LIMIT 1').get(prod2.id) || var1;

  db.prepare(`
    INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_info, price_cents, quantity, total_cents)
    VALUES (64, ?, ?, ?, 'Beden: 52 / Renk: İtalyan Lacivert', 289990, 1, 289990)
  `).run(prod2.id, var2.id, prod2.name);

  db.prepare(`
    INSERT INTO order_status_history (order_id, from_status, to_status, note, created_at)
    VALUES (64, 'SEPET', 'ODENDI', 'Sanal POS ödemesi başarıyla onaylandı.', '2026-10-26 12:12:00')
  `).run();

  db.prepare(`
    INSERT INTO payments (order_id, provider_ref, status, error_message, amount_cents, card_last4, created_at)
    VALUES (64, 'SANDBOX-TX-64', 'SUCCESS', NULL, 289990, '4242', '2026-10-26 12:12:00')
  `).run();

  console.log('Successfully synchronized Ömer Faruk Üzer orders (ID: 63, 64) and purged all test mock data.');
});
