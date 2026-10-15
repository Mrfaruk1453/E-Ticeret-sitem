const { db } = require('../config/database');

/**
 * Returns all active categories with product counts
 */
function getCategories() {
  return db.prepare(`
    SELECT c.*, COUNT(p.id) AS product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.name ASC
  `).all();
}

/**
 * Generates search term variants to handle Turkish ASCII/UTF-8 character matching in SQLite.
 * SQLite's default LIKE is ASCII-only case insensitive and cannot match 'i' with 'ı' or 'İ' with 'I'.
 */
function buildSearchVariants(term) {
  const variations = new Set();
  const raw = term.trim();
  if (!raw) return [];

  variations.add(raw);
  variations.add(raw.toLowerCase());
  variations.add(raw.toUpperCase());
  variations.add(raw.toLocaleLowerCase('tr-TR'));
  variations.add(raw.toLocaleUpperCase('tr-TR'));

  const trToEn = (str) => str
    .replace(/[ıİ]/g, 'i')
    .replace(/[çÇ]/g, 'c')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o');

  const enLower = trToEn(raw.toLowerCase());
  variations.add(enLower);
  variations.add(enLower.toUpperCase());

  const commonPairs = [
    ['kadin', 'kadın'],
    ['erkek', 'erkek'],
    ['bebek', 'bebek'],
    ['elbise', 'elbise'],
    ['elbiseler', 'elbiseler'],
    ['gomlek', 'gömlek'],
    ['gomlekler', 'gömlekler'],
    ['ayakkabi', 'ayakkabı'],
    ['kiyafet', 'kıyafet'],
    ['kiyafetleri', 'kıyafetleri'],
    ['takim', 'takım'],
    ['tisort', 'tişört'],
    ['kazak', 'kazak'],
    ['kazaklar', 'kazaklar'],
    ['cocuk', 'çocuk'],
    ['tulum', 'tulum'],
    ['tulumlar', 'tulumlar']
  ];

  for (const [en, tr] of commonPairs) {
    if (enLower.includes(en)) {
      const replaced = enLower.replace(new RegExp(en, 'g'), tr);
      variations.add(replaced);
      variations.add(replaced.toLocaleUpperCase('tr-TR'));
      variations.add(replaced.charAt(0).toUpperCase() + replaced.slice(1));
    }
    if (raw.toLocaleLowerCase('tr-TR').includes(tr)) {
      const replaced = raw.toLocaleLowerCase('tr-TR').replace(new RegExp(tr, 'g'), en);
      variations.add(replaced);
      variations.add(replaced.toUpperCase());
      variations.add(replaced.charAt(0).toUpperCase() + replaced.slice(1));
    }
  }

  const withDotlessI = enLower.replace(/i/g, 'ı');
  variations.add(withDotlessI);
  variations.add(withDotlessI.charAt(0).toUpperCase() + withDotlessI.slice(1));
  variations.add(withDotlessI.toLocaleUpperCase('tr-TR'));

  const withDottedI = enLower.replace(/ı/g, 'i');
  variations.add(withDottedI);
  variations.add(withDottedI.charAt(0).toUpperCase() + withDottedI.slice(1));

  return Array.from(variations).filter(v => v && v.length > 0);
}

/**
 * Filtered product catalog with search, price range, variants, sorting & pagination
 */
function getProducts(options = {}) {
  const {
    category,
    search,
    minPriceCents,
    maxPriceCents,
    color,
    size,
    sort = 'newest',
    page = 1,
    limit = 9
  } = options;

  let whereClauses = ['1=1'];
  let params = [];

  if (category) {
    whereClauses.push('(c.slug = ? OR c.id = ?)');
    params.push(category, category);
  }

  if (search && search.trim() !== '') {
    const variants = buildSearchVariants(search);
    const searchConditions = variants.map(() => '(p.name LIKE ? OR p.description LIKE ?)').join(' OR ');
    whereClauses.push(`(${searchConditions})`);
    for (const v of variants) {
      params.push(`%${v}%`, `%${v}%`);
    }
  }

  if (minPriceCents !== undefined && minPriceCents !== null && minPriceCents !== '') {
    whereClauses.push('p.base_price_cents >= ?');
    params.push(Number(minPriceCents));
  }

  if (maxPriceCents !== undefined && maxPriceCents !== null && maxPriceCents !== '') {
    whereClauses.push('p.base_price_cents <= ?');
    params.push(Number(maxPriceCents));
  }

  if (color && color !== 'all') {
    whereClauses.push(`EXISTS (
      SELECT 1 FROM product_variants pv 
      WHERE pv.product_id = p.id AND LOWER(pv.color) = LOWER(?)
    )`);
    params.push(color);
  }

  if (size && size !== 'all') {
    whereClauses.push(`EXISTS (
      SELECT 1 FROM product_variants pv 
      WHERE pv.product_id = p.id AND LOWER(pv.size) = LOWER(?)
    )`);
    params.push(size);
  }

  const whereSql = whereClauses.join(' AND ');

  // Count total matching products
  const countSql = `
    SELECT COUNT(DISTINCT p.id) as total
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE ${whereSql}
  `;
  const countRow = db.prepare(countSql).get(...params);
  const total = countRow ? countRow.total : 0;

  // Sorting
  let orderSql = 'p.created_at DESC';
  if (sort === 'price-asc') {
    orderSql = 'p.base_price_cents ASC';
  } else if (sort === 'price-desc') {
    orderSql = 'p.base_price_cents DESC';
  } else if (sort === 'rating') {
    orderSql = 'p.rating DESC, p.review_count DESC';
  } else if (sort === 'popular') {
    orderSql = 'p.review_count DESC';
  }

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const itemsPerPage = Math.max(1, parseInt(limit, 10) || 9);
  const offset = (currentPage - 1) * itemsPerPage;

  const dataSql = `
    SELECT 
      p.*,
      c.name as category_name,
      c.slug as category_slug,
      (SELECT SUM(stock) FROM product_variants WHERE product_id = p.id) as total_stock,
      (SELECT COUNT(*) FROM product_variants WHERE product_id = p.id) as variant_count
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE ${whereSql}
    ORDER BY ${orderSql}
    LIMIT ? OFFSET ?
  `;

  const products = db.prepare(dataSql).all(...params, itemsPerPage, offset);

  // Attach available colors and sizes for each product
  for (const product of products) {
    product.variants = db.prepare(`
      SELECT id, sku, size, color, stock, price_cents
      FROM product_variants
      WHERE product_id = ?
      ORDER BY id ASC
    `).all(product.id);
  }

  return {
    products,
    pagination: {
      total,
      page: currentPage,
      limit: itemsPerPage,
      totalPages: Math.ceil(total / itemsPerPage)
    }
  };
}

/**
 * Gets a single product by ID or Slug with all variants
 */
function getProductBySlugOrId(identifier) {
  const isNumeric = !isNaN(identifier);
  const sql = isNumeric 
    ? 'SELECT p.*, c.name as category_name, c.slug as category_slug FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?'
    : 'SELECT p.*, c.name as category_name, c.slug as category_slug FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.slug = ?';
  
  const product = db.prepare(sql).get(identifier);
  if (!product) return null;

  product.variants = db.prepare(`
    SELECT id, sku, size, color, stock, price_cents
    FROM product_variants
    WHERE product_id = ?
    ORDER BY id ASC
  `).all(product.id);

  // Extract distinct sizes & colors
  product.available_sizes = [...new Set(product.variants.map(v => v.size))];
  product.available_colors = [...new Set(product.variants.map(v => v.color))];
  product.total_stock = product.variants.reduce((acc, v) => acc + v.stock, 0);

  // Related products in same category
  product.related_products = db.prepare(`
    SELECT id, name, slug, base_price_cents, image, rating, review_count
    FROM products
    WHERE category_id = ? AND id != ?
    LIMIT 4
  `).all(product.category_id, product.id);

  return product;
}

/**
 * Returns featured and recent products for homepage
 */
function getHomeProducts() {
  const featured = db.prepare(`
    SELECT p.*, c.name as category_name,
      (SELECT SUM(stock) FROM product_variants WHERE product_id = p.id) as total_stock,
      (SELECT id FROM product_variants WHERE product_id = p.id AND stock > 0 ORDER BY id ASC LIMIT 1) as default_variant_id,
      (SELECT COUNT(DISTINCT color) FROM product_variants WHERE product_id = p.id) as color_count
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_featured = 1
    ORDER BY p.id ASC
    LIMIT 8
  `).all();

  const recent = db.prepare(`
    SELECT p.*, c.name as category_name,
      (SELECT SUM(stock) FROM product_variants WHERE product_id = p.id) as total_stock,
      (SELECT id FROM product_variants WHERE product_id = p.id AND stock > 0 ORDER BY id ASC LIMIT 1) as default_variant_id,
      (SELECT COUNT(DISTINCT color) FROM product_variants WHERE product_id = p.id) as color_count
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ORDER BY p.created_at DESC
    LIMIT 8
  `).all();

  return { featured, recent };
}

module.exports = {
  getCategories,
  getProducts,
  getProductBySlugOrId,
  getHomeProducts
};
