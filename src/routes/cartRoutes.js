const express = require('express');
const router = express.Router();
const cartService = require('../services/cartService');

// Get cart details
router.get('/', (req, res) => {
  try {
    const cart = cartService.getCartDetails(req.sessionToken);
    res.json({ success: true, cart });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Sync cart from client cache (Vercel serverless multi-instance support)
router.post('/sync', (req, res) => {
  try {
    const { items, couponCode } = req.body;
    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        const variantId = it.variant_id || it.id;
        const qty = parseInt(it.quantity, 10) || 1;
        if (variantId && qty > 0) {
          try {
            cartService.addToCart(req.sessionToken, variantId, qty);
          } catch (e) {}
        }
      }
    }
    if (couponCode) {
      try {
        cartService.applyCouponToCart(req.sessionToken, couponCode);
      } catch (e) {}
    }
    const cart = cartService.getCartDetails(req.sessionToken);
    res.json({ success: true, cart, message: 'Sepet eşitlendi.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Add item to cart
router.post('/add', (req, res) => {
  try {
    const { variant_id, quantity } = req.body;
    if (!variant_id) {
      return res.status(400).json({ success: false, error: 'Lütfen ürün beden/renk varyantı seçiniz.' });
    }
    const cart = cartService.addToCart(req.sessionToken, variant_id, quantity);
    res.json({ success: true, cart, message: 'Ürün sepete eklendi.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Update cart item quantity
router.post('/update', (req, res) => {
  try {
    const { cart_item_id, quantity } = req.body;
    if (!cart_item_id || quantity === undefined) {
      return res.status(400).json({ success: false, error: 'Geçersiz parametreler.' });
    }
    const cart = cartService.updateCartItem(req.sessionToken, cart_item_id, quantity);
    res.json({ success: true, cart });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Remove item from cart
router.post('/remove', (req, res) => {
  try {
    const { cart_item_id } = req.body;
    if (!cart_item_id) {
      return res.status(400).json({ success: false, error: 'Geçersiz öğe ID.' });
    }
    const cart = cartService.removeFromCart(req.sessionToken, cart_item_id);
    res.json({ success: true, cart, message: 'Ürün sepetten çıkarıldı.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Apply coupon code
router.post('/coupon', (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Lütfen bir kupon kodu giriniz.' });
    }
    const cart = cartService.applyCouponToCart(req.sessionToken, code);
    res.json({ success: true, cart, message: 'Kupon uygulandı!' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Remove coupon code
router.post('/coupon/remove', (req, res) => {
  try {
    const cart = cartService.removeCouponFromCart(req.sessionToken);
    res.json({ success: true, cart, message: 'Kupon kaldırıldı.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
