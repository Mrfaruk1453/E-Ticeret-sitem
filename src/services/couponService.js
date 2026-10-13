const { db } = require('../config/database');

/**
 * Validates a coupon against a given cart subtotal
 * @param {string} code - The coupon code to check
 * @param {number} subtotalCents - Current subtotal in kuruş
 * @returns {object} Validation result and calculated discount
 */
function validateCoupon(code, subtotalCents) {
  if (!code || typeof code !== 'string') {
    return { valid: false, message: 'Geçersiz kupon kodu.' };
  }

  const cleanCode = code.trim().toUpperCase();
  const coupon = db.prepare('SELECT * FROM coupons WHERE code = ?').get(cleanCode);

  if (!coupon) {
    return { valid: false, message: 'Böyle bir kupon kodu bulunamadı.' };
  }

  if (!coupon.is_active) {
    return { valid: false, message: 'Bu kupon şu anda aktif değil.' };
  }

  // Check expiration date
  const now = new Date();
  const expiresAt = new Date(coupon.expires_at);
  if (now > expiresAt) {
    return { valid: false, message: 'Bu kuponun son kullanma tarihi geçmiştir.' };
  }

  // Check minimum cart amount
  if (subtotalCents < coupon.min_cart_cents) {
    const minTL = (coupon.min_cart_cents / 100).toFixed(2);
    return { 
      valid: false, 
      message: `Bu kupon en az ${minTL} TL tutarındaki sepetlerde geçerlidir.` 
    };
  }

  // Calculate discount in kuruş
  let discountCents = 0;
  if (coupon.discount_type === 'PERCENT') {
    discountCents = Math.round((subtotalCents * coupon.discount_value) / 100);
  } else if (coupon.discount_type === 'FIXED') {
    discountCents = Math.min(coupon.discount_value, subtotalCents);
  }

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      discount_cents: discountCents,
      min_cart_cents: coupon.min_cart_cents
    },
    message: 'Kupon başarıyla uygulandı.'
  };
}

module.exports = {
  validateCoupon
};
