const express = require('express');
const router = express.Router();
const catalogService = require('../services/catalogService');

// Get categories
router.get('/categories', (req, res) => {
  try {
    const categories = catalogService.getCategories();
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get products list with filters, search, price range, variants, sorting, pagination
router.get('/products', (req, res) => {
  try {
    const {
      category,
      search,
      min_price,
      max_price,
      color,
      size,
      sort,
      page,
      limit
    } = req.query;

    const minPriceCents = min_price ? Math.round(parseFloat(min_price) * 100) : undefined;
    const maxPriceCents = max_price ? Math.round(parseFloat(max_price) * 100) : undefined;

    const result = catalogService.getProducts({
      category,
      search,
      minPriceCents,
      maxPriceCents,
      color,
      size,
      sort,
      page,
      limit
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single product by ID or Slug
router.get('/products/:identifier', (req, res) => {
  try {
    const product = catalogService.getProductBySlugOrId(req.params.identifier);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Ürün bulunamadı.' });
    }
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get home featured and recent products
router.get('/home', (req, res) => {
  try {
    const data = catalogService.getHomeProducts();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
