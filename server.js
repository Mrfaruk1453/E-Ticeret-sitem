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

// 28. HTTPS & SSL Yönlendirmesi (Production ortamında) ve HSTS
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, 'https://' + req.headers.host + req.url);
  }
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
});

// 29. Modern Güvenlik Başlıkları (Security Headers)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// 6. Newsletter / E-Bülten Kayıt Formu API Uç Noktası
app.post('/api/newsletter', (req, res) => {
  const email = (req.body && req.body.email) || '';
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'Geçerli bir e-posta adresi giriniz.' });
  }
  return res.json({
    success: true,
    message: 'Tebrikler! Bültenimize başarıyla abone oldunuz. Kampanya ve indirimlerden ilk siz haberdar olacaksınız.'
  });
});

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

// Dynamic XML Sitemap for Technical SEO
app.get(['/sitemap.xml', '/sitemap'], (req, res) => {
  try {
    const { db } = require('./src/config/database');
    const baseUrl = 'https://e-ticeret-sitem.vercel.app';
    const today = new Date().toISOString().split('T')[0];

    const categories = db.prepare('SELECT slug FROM categories').all();
    const products = db.prepare('SELECT slug FROM products').all();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    const staticPages = [
      { path: '/', priority: '1.0', changefreq: 'daily' },
      { path: '/shop.html', priority: '0.9', changefreq: 'daily' },
      { path: '/hakkinda.html', priority: '0.6', changefreq: 'monthly' },
      { path: '/contact.html', priority: '0.6', changefreq: 'monthly' },
      { path: '/sss.html', priority: '0.6', changefreq: 'monthly' },
      { path: '/yardim.html', priority: '0.6', changefreq: 'monthly' },
      { path: '/gizlilik.html', priority: '0.5', changefreq: 'monthly' },
      { path: '/kullanim-kosullari.html', priority: '0.5', changefreq: 'monthly' },
    ];

    staticPages.forEach(sp => {
      xml += '  <url>\n';
      xml += '    <loc>' + baseUrl + sp.path + '</loc>\n';
      xml += '    <lastmod>' + today + '</lastmod>\n';
      xml += '    <changefreq>' + sp.changefreq + '</changefreq>\n';
      xml += '    <priority>' + sp.priority + '</priority>\n';
      xml += '  </url>\n';
    });

    categories.forEach(cat => {
      xml += '  <url>\n';
      xml += '    <loc>' + baseUrl + '/shop.html?category=' + cat.slug + '</loc>\n';
      xml += '    <lastmod>' + today + '</lastmod>\n';
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
      xml += '  <url>\n';
      xml += '    <loc>' + baseUrl + '/kategori/' + cat.slug + '</loc>\n';
      xml += '    <lastmod>' + today + '</lastmod>\n';
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    });

    products.forEach(p => {
      xml += '  <url>\n';
      xml += '    <loc>' + baseUrl + '/detail.html?slug=' + p.slug + '</loc>\n';
      xml += '    <lastmod>' + today + '</lastmod>\n';
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
      xml += '  <url>\n';
      xml += '    <loc>' + baseUrl + '/urun/' + p.slug + '</loc>\n';
      xml += '    <lastmod>' + today + '</lastmod>\n';
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    });

    xml += '</urlset>';

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error('Sitemap generation error:', err);
    res.status(500).send('Error generating sitemap');
  }
});

// Clean SEO Page Routes
app.get(['/shop', '/magaza'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'shop.html')));
app.get(['/cart', '/sepet'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'cart.html')));
app.get(['/checkout', '/odeme'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'checkout.html')));
app.get(['/contact', '/iletisim'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'contact.html')));
app.get(['/hakkinda', '/about'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'hakkinda.html')));
app.get(['/sss', '/faq'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'sss.html')));
app.get(['/yardim', '/help'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'yardim.html')));
app.get(['/gizlilik', '/privacy', '/gizlilik-politikasi'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'gizlilik.html')));
app.get(['/kullanim-kosullari', '/terms', '/sozlesme'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'kullanim-kosullari.html')));
app.get(['/urun/:slug', '/detail'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'detail.html')));
app.get('/kategori/:slug', (req, res) => res.sendFile(path.join(__dirname, 'public', 'shop.html')));

// Direct /admin route to serve admin panel
app.get(['/admin', '/admin/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 27. Tarayıcı Önbellekleme (Caching) ile statik dosyaların sunumu
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    } else if (filePath.match(/\.(jpg|jpeg|png|gif|svg|ico|webp|woff2?|ttf|eot)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    } else if (filePath.match(/\.(css|js)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

// 17. Özel 404 Sayfa Yönlendirmesi (Tüm eşleşmeyen istekler için)
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'API uç noktası bulunamadı' });
  }
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
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
