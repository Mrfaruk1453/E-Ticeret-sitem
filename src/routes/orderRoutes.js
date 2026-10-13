const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');

// Get order details by order number
router.get('/:orderNumber', (req, res) => {
  try {
    const order = orderService.getOrderByNumber(req.params.orderNumber);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Sipariş bulunamadı.' });
    }
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
