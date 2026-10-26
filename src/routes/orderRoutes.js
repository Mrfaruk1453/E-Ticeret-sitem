const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');
const { db } = require('../config/database');

// Sync order to current instance (Serverless rehydration)
router.post('/sync', (req, res) => {
  try {
    const { order } = req.body;
    if (!order || !order.order_number) {
      return res.status(400).json({ success: false, error: 'Geçersiz sipariş verisi.' });
    }

    const existing = orderService.getOrderByNumber(order.order_number);
    if (!existing) {
      const ins = db.prepare(`
        INSERT OR REPLACE INTO orders (
          id, order_number, session_token, status, tracking_number,
          customer_name, customer_email, customer_phone, shipping_address, shipping_city,
          subtotal_cents, discount_cents, shipping_cents, total_cents, coupon_code,
          idempotency_key, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        order.id || null,
        order.order_number,
        order.session_token || 'serverless-sync',
        order.status || 'ODENDI',
        order.tracking_number || null,
        order.customer_name || 'Ömer Faruk Üzer',
        order.customer_email || 'farukuzer1453@gmail.com',
        order.customer_phone || '-',
        order.shipping_address || 'Adres',
        order.shipping_city || 'Şehir',
        order.subtotal_cents || 0,
        order.discount_cents || 0,
        order.shipping_cents || 0,
        order.total_cents || 0,
        order.coupon_code || null,
        order.idempotency_key || `SYNC-${order.order_number}`,
        order.created_at || new Date().toISOString(),
        order.updated_at || new Date().toISOString()
      );

      const insertedOrderId = order.id || ins.lastInsertRowid;
      if (Array.isArray(order.items)) {
        const itemStmt = db.prepare(`
          INSERT INTO order_items (
            order_id, product_id, variant_id, product_name, variant_info, price_cents, quantity, total_cents
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const it of order.items) {
          try {
            itemStmt.run(
              insertedOrderId,
              it.product_id || 1,
              it.variant_id || 1,
              it.product_name || 'Ürün',
              it.variant_info || '',
              it.price_cents || 0,
              it.quantity || 1,
              it.total_cents || (it.price_cents * (it.quantity || 1)) || 0
            );
          } catch (e) {}
        }

        // Deduct stock if order is active
        if (['ODENDI', 'HAZIRLANIYOR', 'KARGOLANDI', 'TESLIM_EDILDI'].includes(order.status)) {
          for (const it of order.items) {
            const variantId = it.variant_id || it.id;
            const qty = parseInt(it.quantity, 10) || 1;
            if (variantId) {
              db.prepare('UPDATE product_variants SET stock = MAX(0, stock - ?) WHERE id = ?').run(qty, variantId);
            }
          }
        }
      }
    }

    const current = orderService.getOrderByNumber(order.order_number);
    res.json({ success: true, order: current });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get order details by order number
router.get('/:orderNumber', (req, res) => {
  try {
    const order = orderService.getOrderByNumber(req.params.orderNumber);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Sipariş bulunamadı.' });
    }
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
