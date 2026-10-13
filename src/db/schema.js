const { db } = require('../config/database');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      image TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      base_price_cents INTEGER NOT NULL,
      image TEXT,
      rating REAL DEFAULT 5.0,
      review_count INTEGER DEFAULT 0,
      is_featured INTEGER DEFAULT 0,
      is_recent INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      sku TEXT UNIQUE NOT NULL,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      stock INTEGER NOT NULL CHECK(stock >= 0),
      price_cents INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      discount_type TEXT NOT NULL CHECK(discount_type IN ('PERCENT', 'FIXED')),
      discount_value INTEGER NOT NULL,
      min_cart_cents INTEGER NOT NULL DEFAULT 0,
      expires_at DATETIME NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_token TEXT UNIQUE NOT NULL,
      coupon_id INTEGER REFERENCES coupons(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id INTEGER REFERENCES carts(id) ON DELETE CASCADE,
      variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(cart_id, variant_id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      session_token TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN (
        'SEPET', 'ODEME_BEKLIYOR', 'ODEME_BASARISIZ', 'ODENDI', 
        'HAZIRLANIYOR', 'KARGOLANDI', 'TESLIM_EDILDI', 'IPTAL', 'IADE'
      )),
      tracking_number TEXT,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      shipping_address TEXT NOT NULL,
      shipping_city TEXT NOT NULL,
      subtotal_cents INTEGER NOT NULL,
      discount_cents INTEGER NOT NULL DEFAULT 0,
      shipping_cents INTEGER NOT NULL DEFAULT 0,
      total_cents INTEGER NOT NULL,
      coupon_code TEXT,
      idempotency_key TEXT UNIQUE,
      delivered_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      variant_id INTEGER REFERENCES product_variants(id),
      product_name TEXT NOT NULL,
      variant_info TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      total_cents INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      provider_ref TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('SUCCESS', 'FAILED')),
      error_message TEXT,
      amount_cents INTEGER NOT NULL,
      card_last4 TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Performance indexes for fast catalog search & filtering
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_price ON products(base_price_cents);
    CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(session_token);
  `);

  try {
    db.exec('ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0;');
  } catch (_) {}

  // Auto-seed if database is empty (e.g. freshly created in cloud /tmp)
  try {
    const row = db.prepare('SELECT COUNT(*) as count FROM products').get();
    if (!row || row.count === 0) {
      console.log('Database has 0 products, auto-seeding catalog...');
      const { seedDatabase } = require('../../scripts/seed');
      seedDatabase();
    }
  } catch (err) {
    console.error('Auto-seed check error:', err);
  }
}

module.exports = {
  initSchema
};
