const { db, transaction } = require('../config/database');

const STATUSES = {
  SEPET: 'SEPET',
  ODEME_BEKLIYOR: 'ODEME_BEKLIYOR',
  ODEME_BASARISIZ: 'ODEME_BASARISIZ',
  ODENDI: 'ODENDI',
  HAZIRLANIYOR: 'HAZIRLANIYOR',
  KARGOLANDI: 'KARGOLANDI',
  TESLIM_EDILDI: 'TESLIM_EDILDI',
  IPTAL: 'IPTAL',
  IADE: 'IADE'
};

// 10 Permitted transitions defined in specifications (Şekil 02.1)
const PERMITTED_TRANSITIONS = {
  [STATUSES.SEPET]: [STATUSES.ODEME_BEKLIYOR],
  [STATUSES.ODEME_BEKLIYOR]: [STATUSES.ODENDI, STATUSES.ODEME_BASARISIZ, STATUSES.IPTAL],
  [STATUSES.ODEME_BASARISIZ]: [STATUSES.ODEME_BEKLIYOR, STATUSES.IPTAL],
  [STATUSES.ODENDI]: [STATUSES.HAZIRLANIYOR, STATUSES.IPTAL],
  [STATUSES.HAZIRLANIYOR]: [STATUSES.KARGOLANDI, STATUSES.IPTAL],
  [STATUSES.KARGOLANDI]: [STATUSES.TESLIM_EDILDI],
  [STATUSES.TESLIM_EDILDI]: [STATUSES.IADE],
  [STATUSES.IPTAL]: [], // Terminal state
  [STATUSES.IADE]: []   // Terminal state
};

/**
 * Checks if a transition from fromStatus to toStatus is valid
 */
function canTransition(fromStatus, toStatus) {
  const allowed = PERMITTED_TRANSITIONS[fromStatus];
  return !!(allowed && allowed.includes(toStatus));
}

function getForwardPipelinePath(fromStatus, toStatus) {
  const pipeline = [STATUSES.ODENDI, STATUSES.HAZIRLANIYOR, STATUSES.KARGOLANDI, STATUSES.TESLIM_EDILDI, STATUSES.IADE];
  const fromIdx = pipeline.indexOf(fromStatus);
  const toIdx = pipeline.indexOf(toStatus);
  if (fromIdx !== -1 && toIdx !== -1 && toIdx > fromIdx) {
    return pipeline.slice(fromIdx + 1, toIdx + 1);
  }
  return null;
}

function executeSingleTransition(orderId, toStatus, meta = {}) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    throw new Error(`Sipariş bulunamadı (ID: ${orderId})`);
  }

  const fromStatus = order.status;
  if (fromStatus === toStatus) {
    return {
      orderId,
      fromStatus,
      toStatus,
      trackingNumber: order.tracking_number
    };
  }

  if (!canTransition(fromStatus, toStatus)) {
    throw new Error(`Geçersiz durum geçişi: ${fromStatus} -> ${toStatus}. Bu geçiş izin tablosunda yer almamaktadır.`);
  }

  if (toStatus === STATUSES.KARGOLANDI && !meta.tracking_number && !order.tracking_number) {
    throw new Error('Kargolandı durumuna geçerken kargo takip numarası girilmesi zorunludur.');
  }

  if (toStatus === STATUSES.IADE) {
    if (order.delivered_at) {
      const deliveredDate = new Date(order.delivered_at);
      const now = new Date();
      const diffDays = (now - deliveredDate) / (1000 * 60 * 60 * 24);
      if (diffDays > 14) {
        throw new Error('Yasal 14 günlük iade süresi dolmuştur.');
      }
    }
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

  // Stock management
  if (toStatus === STATUSES.ODENDI && fromStatus !== STATUSES.ODENDI) {
    for (const item of items) {
      const variant = db.prepare('SELECT id, stock, sku FROM product_variants WHERE id = ?').get(item.variant_id);
      if (!variant) throw new Error(`Ürün varyantı bulunamadı (ID: ${item.variant_id})`);
      if (variant.stock < item.quantity) {
        throw new Error(`Yetersiz stok! Varyant: ${variant.sku}, Kalan stok: ${variant.stock}, İstenen: ${item.quantity}`);
      }
      const res = db.prepare('UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock >= ?')
        .run(item.quantity, item.variant_id, item.quantity);
      if (res.changes === 0) {
        throw new Error(`Stok düşme işlemi başarısız oldu (Stok tükendi): ${variant.sku}`);
      }
    }
  }

  if ((toStatus === STATUSES.IPTAL || toStatus === STATUSES.IADE) && 
      (fromStatus === STATUSES.ODENDI || fromStatus === STATUSES.HAZIRLANIYOR || fromStatus === STATUSES.KARGOLANDI || fromStatus === STATUSES.TESLIM_EDILDI)) {
    for (const item of items) {
      db.prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ?')
        .run(item.quantity, item.variant_id);
    }
  }

  let updateSql = 'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP';
  const params = [toStatus];

  if (meta.tracking_number) {
    updateSql += ', tracking_number = ?';
    params.push(meta.tracking_number);
  }
  if (toStatus === STATUSES.TESLIM_EDILDI && !order.delivered_at) {
    updateSql += ', delivered_at = CURRENT_TIMESTAMP';
  }
  if (meta.idempotency_key && !order.idempotency_key) {
    updateSql += ', idempotency_key = ?';
    params.push(meta.idempotency_key);
  }

  updateSql += ' WHERE id = ?';
  params.push(orderId);

  db.prepare(updateSql).run(...params);

  db.prepare(`
    INSERT INTO order_status_history (order_id, from_status, to_status, note)
    VALUES (?, ?, ?, ?)
  `).run(orderId, fromStatus, toStatus, meta.note || null);

  return {
    orderId,
    fromStatus,
    toStatus,
    trackingNumber: meta.tracking_number || order.tracking_number
  };
}

/**
 * Executes a transition on an order inside an atomic transaction.
 * Automatically catches up forward lifecycle stages if serverless instances desync.
 */
function transitionOrder(orderId, toStatus, meta = {}) {
  return transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      throw new Error(`Sipariş bulunamadı (ID: ${orderId})`);
    }

    const fromStatus = order.status;

    if (canTransition(fromStatus, toStatus)) {
      return executeSingleTransition(orderId, toStatus, meta);
    }

    const forwardPath = getForwardPipelinePath(fromStatus, toStatus);
    if (forwardPath && forwardPath.length > 0) {
      let lastResult = null;
      for (const step of forwardPath) {
        lastResult = executeSingleTransition(orderId, step, meta);
      }
      return lastResult;
    }

    throw new Error(`Geçersiz durum geçişi: ${fromStatus} -> ${toStatus}. Bu geçiş izin tablosunda yer almamaktadır.`);
  });
}

module.exports = {
  STATUSES,
  PERMITTED_TRANSITIONS,
  canTransition,
  transitionOrder
};
