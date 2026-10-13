const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const orderService = require('../services/orderService');
const { transitionOrder, STATUSES, PERMITTED_TRANSITIONS } = require('../services/stateMachine');
const { db } = require('../config/database');

// Admin Credentials requested by the user
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Mrfaruk46';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '966171154Uzer.';

// In-memory active admin sessions store
const activeAdminSessions = new Set();

/**
 * Authentication Middleware for Admin routes
 */
function requireAdminAuth(req, res, next) {
  const token = req.cookies && req.cookies['admin_session'];
  if (!token || !activeAdminSessions.has(token)) {
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
    const sessionToken = crypto.randomBytes(32).toString('hex');
    activeAdminSessions.add(sessionToken);

    res.cookie('admin_session', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    return res.json({
      success: true,
      message: 'Yönetici girişi başarılı.',
      username: ADMIN_USERNAME
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Hatalı kullanıcı adı veya şifre!'
  });
});

// 2. Admin Logout Endpoint
router.post('/logout', (req, res) => {
  const token = req.cookies && req.cookies['admin_session'];
  if (token) {
    activeAdminSessions.delete(token);
  }
  res.clearCookie('admin_session');
  res.json({ success: true, message: 'Çıkış yapıldı.' });
});

// 3. Admin Auth Status Check
router.get('/auth-status', (req, res) => {
  const token = req.cookies && req.cookies['admin_session'];
  const authenticated = !!(token && activeAdminSessions.has(token));
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
