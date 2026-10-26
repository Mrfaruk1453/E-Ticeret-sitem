const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');

router.post('/', async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      shippingCity,
      cardNumber,
      cardExpiry,
      cardCvv,
      idempotencyKey
    } = req.body;

    const result = await orderService.checkoutOrder(req.sessionToken, {
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      shippingCity,
      cardNumber,
      cardExpiry,
      cardCvv,
      idempotencyKey
    });

    if (result.success) {
      if (result.order) {
        result.order.items = result.items || [];
        result.order.payment = result.payment || null;
      }
      res.json({
        success: true,
        order: result.order,
        items: result.items,
        orderNumber: result.order.order_number,
        payment: result.payment,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        order: result.order,
        orderNumber: result.order.order_number,
        payment: result.payment,
        error: result.errorMessage
      });
    }
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
