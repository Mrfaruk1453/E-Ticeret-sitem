const { db } = require('../config/database');
const { validateCoupon } = require('./couponService');

// Free shipping threshold: 500 TL (50,000 kuruş). Default shipping fee: 49.90 TL (4990 kuruş)
const FREE_SHIPPING_THRESHOLD_CENTS = 50000;
const STANDARD_SHIPPING_CENTS = 4990;

/**
 * Gets or creates a cart by session token
 */
function getOrCreateCart(sessionToken) {
  let cart = db.prepare('SELECT * FROM carts WHERE session_token = ?').get(sessionToken);
  if (!cart) {
    const res = db.prepare('INSERT INTO carts (session_token) VALUES (?)').run(sessionToken);
    cart = db.prepare('SELECT * FROM carts WHERE id = ?').get(res.lastInsertRowid);
  }
  return cart;
}

/**
 * Retrieves full cart details with server-computed prices and applied coupon
 */
function getCartDetails(sessionToken) {
  const cart = getOrCreateCart(sessionToken);

  const items = db.prepare(`
    SELECT 
      ci.id as cart_item_id,
      ci.quantity,
      pv.id as variant_id,
      pv.sku,
      pv.size,
      pv.color,
      pv.stock,
      pv.price_cents,
      p.id as product_id,
      p.name as product_name,
      p.slug as product_slug,
      p.image as product_image
    FROM cart_items ci
    JOIN product_variants pv ON ci.variant_id = pv.id
    JOIN products p ON pv.product_id = p.id
    WHERE ci.cart_id = ?
    ORDER BY ci.id ASC
  `).all(cart.id);

  let subtotalCents = 0;
  let totalItemCount = 0;

  for (const item of items) {
    item.item_total_cents = item.price_cents * item.quantity;
    subtotalCents += item.item_total_cents;
    totalItemCount += item.quantity;
    item.is_out_of_stock = item.stock <= 0;
    item.is_exceeding_stock = item.quantity > item.stock;
  }

  // Handle applied coupon
  let appliedCoupon = null;
  let discountCents = 0;

  if (cart.coupon_id) {
    const couponRow = db.prepare('SELECT code FROM coupons WHERE id = ?').get(cart.coupon_id);
    if (couponRow) {
      const validation = validateCoupon(couponRow.code, subtotalCents);
      if (validation.valid) {
        appliedCoupon = validation.coupon;
        discountCents = validation.coupon.discount_cents;
      } else {
        // Invalidate coupon if cart conditions no longer met
        db.prepare('UPDATE carts SET coupon_id = NULL WHERE id = ?').run(cart.id);
      }
    }
  }

  // Shipping calculation
  let shippingCents = 0;
  if (subtotalCents > 0) {
    shippingCents = (subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS) ? 0 : STANDARD_SHIPPING_CENTS;
  }

  const totalCents = Math.max(0, subtotalCents - discountCents) + shippingCents;

  return {
    cart_id: cart.id,
    session_token: sessionToken,
    items,
    item_count: totalItemCount,
    subtotal_cents: subtotalCents,
    discount_cents: discountCents,
    shipping_cents: shippingCents,
    total_cents: totalCents,
    coupon: appliedCoupon
  };
}

/**
 * Adds an item (variant) to the cart with strict stock limit
 */
function addToCart(sessionToken, variantId, quantity = 1) {
  const cart = getOrCreateCart(sessionToken);
  const qty = Math.max(1, parseInt(quantity, 10) || 1);

  const variant = db.prepare('SELECT id, stock, sku FROM product_variants WHERE id = ?').get(variantId);
  if (!variant) {
    throw new Error('Seçilen ürün varyantı bulunamadı.');
  }

  if (variant.stock <= 0) {
    throw new Error('Bu varyantın stoğu tükenmiştir.');
  }

  // Check if item already in cart
  const existing = db.prepare('SELECT id, quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?')
    .get(cart.id, variantId);

  const currentCartQty = existing ? existing.quantity : 0;
  const newTotalQty = currentCartQty + qty;

  if (newTotalQty > variant.stock) {
    throw new Error(`Stok sınırına ulaşıldı! Bu üründen en fazla ${variant.stock} adet ekleyebilirsiniz.`);
  }

  if (existing) {
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(newTotalQty, existing.id);
  } else {
    db.prepare('INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES (?, ?, ?)')
      .run(cart.id, variantId, qty);
  }

  db.prepare('UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(cart.id);

  return getCartDetails(sessionToken);
}

/**
 * Updates item quantity in the cart
 */
function updateCartItem(sessionToken, cartItemId, quantity) {
  const cart = getOrCreateCart(sessionToken);
  const qty = parseInt(quantity, 10);

  const item = db.prepare(`
    SELECT ci.id, ci.variant_id, pv.stock 
    FROM cart_items ci
    JOIN product_variants pv ON ci.variant_id = pv.id
    WHERE ci.id = ? AND ci.cart_id = ?
  `).get(cartItemId, cart.id);

  if (!item) {
    throw new Error('Sepet öğesi bulunamadı.');
  }

  if (qty <= 0) {
    db.prepare('DELETE FROM cart_items WHERE id = ?').run(cartItemId);
  } else {
    if (qty > item.stock) {
      throw new Error(`Yetersiz stok! En fazla ${item.stock} adet seçebilirsiniz.`);
    }
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(qty, cartItemId);
  }

  db.prepare('UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(cart.id);

  return getCartDetails(sessionToken);
}

/**
 * Removes an item from the cart
 */
function removeFromCart(sessionToken, cartItemId) {
  const cart = getOrCreateCart(sessionToken);
  db.prepare('DELETE FROM cart_items WHERE id = ? AND cart_id = ?').run(cartItemId, cart.id);
  db.prepare('UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(cart.id);
  return getCartDetails(sessionToken);
}

/**
 * Applies a coupon to the cart
 */
function applyCouponToCart(sessionToken, couponCode) {
  const cart = getOrCreateCart(sessionToken);
  const cartDetails = getCartDetails(sessionToken);

  if (cartDetails.subtotal_cents === 0) {
    throw new Error('Sepetiniz boşken kupon uygulayamazsınız.');
  }

  const result = validateCoupon(couponCode, cartDetails.subtotal_cents);
  if (!result.valid) {
    throw new Error(result.message);
  }

  db.prepare('UPDATE carts SET coupon_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(result.coupon.id, cart.id);

  return getCartDetails(sessionToken);
}

/**
 * Removes applied coupon from the cart
 */
function removeCouponFromCart(sessionToken) {
  const cart = getOrCreateCart(sessionToken);
  db.prepare('UPDATE carts SET coupon_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(cart.id);
  return getCartDetails(sessionToken);
}

/**
 * Clears the cart after successful order
 */
function clearCart(sessionToken) {
  const cart = getOrCreateCart(sessionToken);
  db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cart.id);
  db.prepare('UPDATE carts SET coupon_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(cart.id);
}

module.exports = {
  getOrCreateCart,
  getCartDetails,
  addToCart,
  updateCartItem,
  removeFromCart,
  applyCouponToCart,
  removeCouponFromCart,
  clearCart
};
