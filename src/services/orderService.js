const { db, transaction } = require('../config/database');
const { getCartDetails, clearCart } = require('./cartService');
const { transitionOrder, STATUSES } = require('./stateMachine');
const { processSandboxPayment } = require('./paymentService');
const { sendOrderConfirmationEmail } = require('./emailService');
const crypto = require('crypto');

/**
 * Creates an order, processes sandbox payment, and runs state machine
 */
async function checkoutOrder(sessionToken, checkoutData) {
  const {
    customerName,
    customerEmail,
    customerPhone,
    shippingAddress,
    shippingCity,
    cardNumber,
    cardExpiry,
    cardCvv,
    idempotencyKey
  } = checkoutData;

  if (!customerName || !customerEmail || !customerAddressValidation(shippingAddress, shippingCity)) {
    throw new Error('Lütfen tüm zorunlu müşteri ve teslimat bilgilerini eksiksiz doldurunuz.');
  }

  // 1. Fetch current cart and calculate prices on server
  const cart = getCartDetails(sessionToken);
  if (!cart.items || cart.items.length === 0) {
    throw new Error('Sepetiniz boş. Sipariş oluşturmak için sepetinize ürün ekleyin.');
  }

  // 2. Pre-check stock before initiating
  for (const item of cart.items) {
    if (item.stock < item.quantity) {
      throw new Error(`"${item.product_name} (${item.size} / ${item.color})" için yetersiz stok! Kalan stok: ${item.stock}`);
    }
  }

  const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  // 3. Step 1: Create Order in ODEME_BEKLIYOR status (Stok serbest, ödeme bekleniyor)
  let orderId = null;
  transaction(() => {
    const res = db.prepare(`
      INSERT INTO orders (
        order_number, session_token, status,
        customer_name, customer_email, customer_phone,
        shipping_address, shipping_city,
        subtotal_cents, discount_cents, shipping_cents, total_cents,
        coupon_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderNumber, sessionToken, STATUSES.ODEME_BEKLIYOR,
      customerName.trim(), customerEmail.trim(), (customerPhone || '').trim(),
      shippingAddress.trim(), shippingCity.trim(),
      cart.subtotal_cents, cart.discount_cents, cart.shipping_cents, cart.total_cents,
      cart.coupon ? cart.coupon.code : null
    );

    orderId = res.lastInsertRowid;

    // Insert order items
    const insertItemStmt = db.prepare(`
      INSERT INTO order_items (
        order_id, product_id, variant_id, product_name, variant_info, price_cents, quantity, total_cents
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of cart.items) {
      insertItemStmt.run(
        orderId,
        item.product_id,
        item.variant_id,
        item.product_name,
        `Beden: ${item.size}, Renk: ${item.color} (SKU: ${item.sku})`,
        item.price_cents,
        item.quantity,
        item.item_total_cents
      );
    }

    // Record initial status in history
    db.prepare(`
      INSERT INTO order_status_history (order_id, from_status, to_status, note)
      VALUES (?, ?, ?, ?)
    `).run(orderId, STATUSES.SEPET, STATUSES.ODEME_BEKLIYOR, 'Ödeme sayfasına yönlendirildi');
  });

  // 4. Process payment through sandbox simulator
  const paymentResult = processSandboxPayment({
    cardNumber,
    cardExpiry,
    cardCvv,
    amountCents: cart.total_cents,
    idempotencyKey
  });

  // Record payment record
  db.prepare(`
    INSERT INTO payments (order_id, provider_ref, status, error_message, amount_cents, card_last4)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    orderId,
    paymentResult.providerRef,
    paymentResult.success ? 'SUCCESS' : 'FAILED',
    paymentResult.errorMessage || null,
    cart.total_cents,
    paymentResult.cardLast4
  );

  // 5. Handle payment result with State Machine
  if (paymentResult.success) {
    // ODEME_BEKLIYOR -> ODENDI
    // Stock is deducted AT THIS MOMENT in transaction!
    transitionOrder(orderId, STATUSES.ODENDI, {
      idempotency_key: paymentResult.providerRef,
      note: `Ödeme başarılı (Sağlayıcı Ref: ${paymentResult.providerRef})`
    });

    // Clear cart
    clearCart(sessionToken);

    // Fetch full order for email and return
    const finalOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const finalItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

    // Send confirmation email asynchronously
    sendOrderConfirmationEmail(finalOrder, finalItems).catch(err => {
      console.error('Email gönderilemedi:', err.message);
    });

    return {
      success: true,
      order: finalOrder,
      items: finalItems,
      payment: paymentResult,
      message: 'Ödemeniz başarıyla alındı ve siparişiniz onaylandı!'
    };
  } else {
    // ODEME_BEKLIYOR -> ODEME_BASARISIZ
    // Stock was never deducted, customer can retry!
    transitionOrder(orderId, STATUSES.ODEME_BASARISIZ, {
      note: `Ödeme başarısız: ${paymentResult.errorMessage}`
    });

    const failedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

    return {
      success: false,
      order: failedOrder,
      payment: paymentResult,
      errorMessage: paymentResult.errorMessage || 'Ödeme sağlayıcısı işlemi reddetti.'
    };
  }
}

function customerAddressValidation(address, city) {
  return address && address.trim().length > 3 && city && city.trim().length > 1;
}

/**
 * Gets order by order number with items and history
 */
function getOrderByNumber(orderNumber) {
  const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber);
  if (!order) return null;

  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  order.history = db.prepare(`
    SELECT * FROM order_status_history 
    WHERE order_id = ? 
    ORDER BY created_at ASC
  `).all(order.id);
  order.payment = db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1').get(order.id);

  return order;
}

/**
 * Gets all orders for admin panel
 */
function getAllOrders() {
  const orders = db.prepare(`
    SELECT o.*, 
      (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
    FROM orders o 
    ORDER BY o.created_at DESC
  `).all();

  for (const order of orders) {
    order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  }

  return orders;
}

/**
 * Gets real-time stock levels for admin monitoring
 */
function getInventoryStatus() {
  return db.prepare(`
    SELECT 
      pv.id,
      pv.sku,
      pv.size,
      pv.color,
      pv.stock,
      pv.price_cents,
      p.name as product_name,
      c.name as category_name
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    ORDER BY pv.stock ASC, p.name ASC
  `).all();
}

module.exports = {
  checkoutOrder,
  getOrderByNumber,
  getAllOrders,
  getInventoryStatus
};
