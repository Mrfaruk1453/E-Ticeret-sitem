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

// Transition an order status
router.post('/orders/:id/transition', (req, res) => {
  try {
    const { to_status, tracking_number, note } = req.body;
    const orderId = parseInt(req.params.id, 10);

    if (!to_status) {
      return res.status(400).json({ success: false, error: 'Hedef durum (to_status) belirtilmelidir.' });
    }

    const result = transitionOrder(orderId, to_status, {
      tracking_number,
      note
    });

    const updatedOrder = orderService.getOrderByNumber(db.prepare('SELECT order_number FROM orders WHERE id = ?').get(orderId).order_number);

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
