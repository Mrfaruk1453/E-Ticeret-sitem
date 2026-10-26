const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const orderService = require('../services/orderService');
const { transitionOrder, STATUSES, PERMITTED_TRANSITIONS } = require('../services/stateMachine');
const { db } = require('../config/database');

// Admin Credentials requested by the user
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Mrfaruk46';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '966171154Uzer.';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'multishop_admin_secret_key_oku_2026_super_secure';

// Stateless signed HMAC-SHA256 token helper for Serverless & Multi-instance compatibility
function generateAdminToken(username) {
  const timestamp = Date.now();
  const payload = `${username}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

function verifyAdminToken(token) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;
    const [username, timestampStr, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);
    
    // Check age (24 hours validity)
    if (isNaN(timestamp) || Date.now() - timestamp > 24 * 60 * 60 * 1000) {
      return false;
    }
    
    // Check username
    if (username !== ADMIN_USERNAME) {
      return false;
    }
    
    // Check HMAC signature
    const expectedPayload = `${username}:${timestamp}`;
    const expectedSignature = crypto.createHmac('sha256', ADMIN_SECRET).update(expectedPayload).digest('hex');
    
    if (signature.length !== expectedSignature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch (e) {
    return false;
  }
}

function getAdminToken(req) {
  return (
    (req.cookies && req.cookies['admin_session']) ||
    req.headers['x-admin-token'] ||
    (req.headers['authorization'] && req.headers['authorization'].replace(/^Bearer\s+/i, ''))
  );
}

/**
 * Authentication Middleware for Admin routes
 */
function requireAdminAuth(req, res, next) {
  const token = getAdminToken(req);
  if (!verifyAdminToken(token)) {
    return res.status(401).json({
      success: false,
      error: 'Yetkisiz erişim. Lütfen yönetici girişi yapınız.'
    });
  }
  next();
}

// 1. Admin Login Endpoint
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const sessionToken = generateAdminToken(username);

    res.cookie('admin_session', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    return res.json({
      success: true,
      message: 'Yönetici girişi başarılı.',
      username: ADMIN_USERNAME,
      token: sessionToken
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Hatalı kullanıcı adı veya şifre!'
  });
});

// 2. Admin Logout Endpoint
router.post('/logout', (req, res) => {
  res.clearCookie('admin_session');
  res.json({ success: true, message: 'Çıkış yapıldı.' });
});

// 3. Admin Auth Status Check
router.get('/auth-status', (req, res) => {
  const token = getAdminToken(req);
  const authenticated = verifyAdminToken(token);
  res.json({ success: true, authenticated, username: authenticated ? ADMIN_USERNAME : null });
});

// Protected routes below
router.use(requireAdminAuth);

// List all orders
router.get('/orders', (req, res) => {
  try {
    const orders = orderService.getAllOrders();
    res.json({ success: true, orders, statuses: STATUSES, transitions: PERMITTED_TRANSITIONS });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin orders sync (Vercel serverless consistency)
router.post('/orders/sync', (req, res) => {
  try {
    const { orders } = req.body;
    if (Array.isArray(orders)) {
      for (const order of orders) {
        if (!order || !order.order_number) continue;
        const existing = db.prepare('SELECT id, status FROM orders WHERE order_number = ?').get(order.order_number);
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
            order.shipping_city || 'Kahramanmaraş',
            order.subtotal_cents || order.total_cents || 0,
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
                let resolvedVariantId = it.variant_id || null;
                let resolvedProductId = it.product_id || null;

                if (!resolvedVariantId && it.variant_info && it.variant_info.includes('SKU:')) {
                  const m = it.variant_info.match(/SKU:\s*([^)]+)/);
                  if (m && m[1]) {
                    const row = db.prepare('SELECT id, product_id FROM product_variants WHERE sku = ?').get(m[1].trim());
                    if (row) {
                      resolvedVariantId = row.id;
                      resolvedProductId = row.product_id;
                    }
                  }
                }

                itemStmt.run(
                  insertedOrderId,
                  resolvedProductId || 1,
                  resolvedVariantId || null,
                  it.product_name || 'Ürün',
                  it.variant_info || '',
                  it.price_cents || 0,
                  it.quantity || 1,
                  it.total_cents || (it.price_cents * (it.quantity || 1)) || 0
                );
              } catch (e) {}
            }
          }

          // Serverless instance inventory synchronization:
          // ONLY deduct stock for the exact verified variant ID
          if (['ODENDI', 'HAZIRLANIYOR', 'KARGOLANDI', 'TESLIM_EDILDI'].includes(order.status) && Array.isArray(order.items)) {
            for (const it of order.items) {
              let resolvedVariantId = it.variant_id || null;
              if (!resolvedVariantId && it.variant_info && it.variant_info.includes('SKU:')) {
                const m = it.variant_info.match(/SKU:\s*([^)]+)/);
                if (m && m[1]) {
                  const row = db.prepare('SELECT id FROM product_variants WHERE sku = ?').get(m[1].trim());
                  if (row) resolvedVariantId = row.id;
                }
              }

              const qty = parseInt(it.quantity, 10) || 1;
              if (resolvedVariantId) {
                db.prepare('UPDATE product_variants SET stock = MAX(0, stock - ?) WHERE id = ?').run(qty, resolvedVariantId);
              }
            }
          }
        } else {
          // If order exists, update status & tracking if changed
          if (order.status && order.status !== existing.status) {
            db.prepare('UPDATE orders SET status = ?, tracking_number = COALESCE(?, tracking_number), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run(order.status, order.tracking_number || null, existing.id);

            // If order was cancelled or returned, return stock
            if ((order.status === 'IPTAL' || order.status === 'IADE') && existing.status !== 'IPTAL' && existing.status !== 'IADE') {
              const items = db.prepare('SELECT variant_id, quantity FROM order_items WHERE order_id = ?').all(existing.id);
              for (const it of items) {
                db.prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ?').run(it.quantity, it.variant_id);
              }
            }
          }
        }
      }
    }
    const all = orderService.getAllOrders();
    res.json({ success: true, orders: all });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Transition an order status
router.post('/orders/:id/transition', (req, res) => {
  try {
    const { to_status, tracking_number, note, order_number, order_data } = req.body;
    let orderId = parseInt(req.params.id, 10);

    if (!to_status) {
      return res.status(400).json({ success: false, error: 'Hedef durum (to_status) belirtilmelidir.' });
    }

    // Serverless instance auto-rehydration check
    let existing = db.prepare('SELECT id FROM orders WHERE id = ?').get(orderId);
    if (!existing && order_number) {
      existing = db.prepare('SELECT id FROM orders WHERE order_number = ?').get(order_number);
      if (existing) orderId = existing.id;
    }

    if (!existing && (order_data || order_number)) {
      const data = order_data || {};
      const ordNum = data.order_number || order_number || `ORD-${orderId}`;
      db.prepare(`
        INSERT OR REPLACE INTO orders (
          id, order_number, session_token, status, tracking_number,
          customer_name, customer_email, customer_phone, shipping_address, shipping_city,
          subtotal_cents, discount_cents, shipping_cents, total_cents, coupon_code,
          idempotency_key, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `).run(
        orderId,
        ordNum,
        data.session_token || 'serverless-sync',
        data.status || 'ODENDI',
        tracking_number || data.tracking_number || null,
        data.customer_name || 'Ömer Faruk Üzer',
        data.customer_email || 'farukuzer1453@gmail.com',
        data.customer_phone || '-',
        data.shipping_address || 'Adres',
        data.shipping_city || 'Kahramanmaraş',
        data.subtotal_cents || data.total_cents || 0,
        data.discount_cents || 0,
        data.shipping_cents || 0,
        data.total_cents || 0,
        data.coupon_code || null,
        `SYNC-${orderId}`
      );
    }

    const result = transitionOrder(orderId, to_status, {
      tracking_number,
      note
    });

    const updatedRow = db.prepare('SELECT order_number FROM orders WHERE id = ?').get(orderId);
    const updatedOrder = updatedRow ? orderService.getOrderByNumber(updatedRow.order_number) : { id: orderId, status: to_status, tracking_number };

    res.json({
      success: true,
      message: `Sipariş durumu başarıyla güncellendi: ${result.fromStatus} -> ${result.toStatus}`,
      order: updatedOrder
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Inventory levels for monitoring stock changes
router.get('/inventory', (req, res) => {
  try {
    const inventory = orderService.getInventoryStatus();
    res.json({ success: true, inventory });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin stats
router.get('/stats', (req, res) => {
  try {
    const orderStats = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM orders 
      GROUP BY status
    `).all();

    const revenueRow = db.prepare(`
      SELECT SUM(total_cents) as total_revenue_cents 
      FROM orders 
      WHERE status IN ('ODENDI', 'HAZIRLANIYOR', 'KARGOLANDI', 'TESLIM_EDILDI')
    `).get();

    const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    const variantCount = db.prepare('SELECT COUNT(*) as count FROM product_variants').get().count;
    const lowStockCount = db.prepare('SELECT COUNT(*) as count FROM product_variants WHERE stock <= 2').get().count;

    res.json({
      success: true,
      stats: {
        orderStats,
        totalRevenueCents: revenueRow ? revenueRow.total_revenue_cents || 0 : 0,
        productCount,
        variantCount,
        lowStockCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
