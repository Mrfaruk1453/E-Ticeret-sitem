require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const { initSchema } = require('./src/db/schema');
const catalogRoutes = require('./src/routes/catalogRoutes');
const cartRoutes = require('./src/routes/cartRoutes');
const checkoutRoutes = require('./src/routes/checkoutRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database schema
initSchema();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// HttpOnly Guest Session Token Middleware
const COOKIE_NAME = 'session_token';
app.use((req, res, next) => {
  let token = req.cookies[COOKIE_NAME];
  if (!token) {
    token = crypto.randomUUID();
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
  }
  req.sessionToken = token;
  next();
});

// API Routes
app.use('/api', catalogRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

// Direct /admin route to serve admin panel
app.get(['/admin', '/admin/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve MultiShop frontend static assets
app.use(express.static(path.join(__dirname, 'public')));

// Fallback for SPA/routing or 404
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'Endpoint bulunamadı' });
  }
  next();
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` MultiShop E-Ticaret Sistemi Yayında!`);
    console.log(` Adres: http://localhost:${PORT}`);
    console.log(` Admin Paneli: http://localhost:${PORT}/admin.html`);
    console.log(`====================================================`);
  });
}

module.exports = app;
