const { db } = require('../config/database');
const crypto = require('crypto');

// Standard sandbox test cards
const SANDBOX_TEST_CARDS = {
  SUCCESS: '4242424242424242',
  INSUFFICIENT_FUNDS: '4000000000000002',
  DECLINED: '4000000000000003'
};

/**
 * Simulates a payment gateway sandbox processing
 * @param {object} paymentDetails - card number, expiry, cvv, amountCents, idempotencyKey
 * @returns {object} Payment gateway response
 */
function processSandboxPayment(paymentDetails) {
  const {
    cardNumber,
    cardExpiry,
    cardCvv,
    amountCents,
    idempotencyKey
  } = paymentDetails;

  // Clean card number
  const cleanCard = (cardNumber || '').replace(/\s+/g, '');
  const last4 = cleanCard.slice(-4) || '4242';

  // Check idempotency key: If this key has already been processed successfully, return existing result
  if (idempotencyKey) {
    const existing = db.prepare('SELECT * FROM payments WHERE provider_ref = ?').get(idempotencyKey);
    if (existing) {
      return {
        success: existing.status === 'SUCCESS',
        providerRef: existing.provider_ref,
        amountCents: existing.amount_cents,
        cardLast4: existing.card_last4,
        isIdempotentReplay: true,
        errorMessage: existing.error_message
      };
    }
  }

  const providerRef = idempotencyKey || `SANDBOX-TX-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  // Check card scenarios
  if (cleanCard === SANDBOX_TEST_CARDS.INSUFFICIENT_FUNDS) {
    return {
      success: false,
      providerRef,
      amountCents,
      cardLast4: last4,
      errorMessage: 'Kart reddedildi: Yetersiz Bakiye (Bakiye yetersiz, işlem tamamlanamadı).'
    };
  }

  if (cleanCard === SANDBOX_TEST_CARDS.DECLINED) {
    return {
      success: false,
      providerRef,
      amountCents,
      cardLast4: last4,
      errorMessage: 'Kart reddedildi: Güvenlik kontrolü başarısız / Şüpheli işlem.'
    };
  }

  // Basic validation check
  if (cleanCard.length < 15) {
    return {
      success: false,
      providerRef,
      amountCents,
      cardLast4: last4,
      errorMessage: 'Geçersiz kart numarası.'
    };
  }

  // Any other valid length card or SUCCESS card succeeds in sandbox
  return {
    success: true,
    providerRef,
    amountCents,
    cardLast4: last4,
    errorMessage: null
  };
}

module.exports = {
  SANDBOX_TEST_CARDS,
  processSandboxPayment
};
