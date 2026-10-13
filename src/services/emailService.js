const nodemailer = require('nodemailer');

const STORE_EMAIL = process.env.STORE_EMAIL || 'siparis@magaza.com';

// Setup email transporter (Console / Test JSON transport if no SMTP specified)
let transporter;

if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
} else {
  // Test transporter that logs to console / ethereal
  transporter = {
    sendMail: async (mailOptions) => {
      console.log('\n================== [E-POSTA SİMÜLASYONU] ==================');
      console.log(`Kime: ${mailOptions.to}`);
      console.log(`Gizli Kopya (BCC): ${mailOptions.bcc}`);
      console.log(`Konu: ${mailOptions.subject}`);
      console.log('İçerik Özeti:');
      console.log(mailOptions.text || '(HTML İçerik Gönderildi)');
      console.log('===========================================================\n');
      return { messageId: `mock-${Date.now()}` };
    }
  };
}

/**
 * Sends order confirmation email to customer with BCC to store
 */
async function sendOrderConfirmationEmail(order, items) {
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.product_name} (${item.variant_info})</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity} adet</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${(item.price_cents / 100).toFixed(2)} TL</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${(item.total_cents / 100).toFixed(2)} TL</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <div style="background-color: #ffd333; padding: 15px; text-align: center; border-radius: 6px;">
        <h2 style="margin: 0; color: #3d464d;">MultiShop - Siparişiniz Alındı!</h2>
      </div>
      <p style="margin-top: 20px;">Sayın <strong>${order.customer_name}</strong>,</p>
      <p>Siparişiniz başarıyla alınmış ve onaylanmıştır. Sipariş detaylarınız aşağıdadır:</p>

      <table style="width: 100%; margin: 15px 0; background-color: #f8f9fa; padding: 10px; border-radius: 4px;">
        <tr><td><strong>Sipariş Numarası:</strong></td><td>${order.order_number}</td></tr>
        <tr><td><strong>Tarih:</strong></td><td>${new Date(order.created_at || Date.now()).toLocaleString('tr-TR')}</td></tr>
        <tr><td><strong>Durum:</strong></td><td><span style="color: green; font-weight: bold;">ÖDENDİ</span></td></tr>
        <tr><td><strong>Teslimat Adresi:</strong></td><td>${order.shipping_address}, ${order.shipping_city}</td></tr>
      </table>

      <h3>Ürünler</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
        <thead>
          <tr style="background-color: #3d464d; color: white;">
            <th style="padding: 8px; text-align: left;">Ürün</th>
            <th style="padding: 8px; text-align: center;">Adet</th>
            <th style="padding: 8px; text-align: right;">Birim Fiyat</th>
            <th style="padding: 8px; text-align: right;">Toplam</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="text-align: right; margin-top: 15px;">
        <p style="margin: 4px 0;">Ara Toplam: <strong>${(order.subtotal_cents / 100).toFixed(2)} TL</strong></p>
        ${order.discount_cents > 0 ? `<p style="margin: 4px 0; color: red;">İndirim: <strong>-${(order.discount_cents / 100).toFixed(2)} TL</strong></p>` : ''}
        <p style="margin: 4px 0;">Kargo: <strong>${order.shipping_cents === 0 ? 'ÜCRETSİZ' : (order.shipping_cents / 100).toFixed(2) + ' TL'}</strong></p>
        <h3 style="margin: 8px 0; color: #3d464d;">Genel Toplam: ${(order.total_cents / 100).toFixed(2)} TL</h3>
      </div>

      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #777; text-align: center;">Bu e-posta otomatik olarak oluşturulmuştur. Mağaza kopyası: ${STORE_EMAIL}</p>
    </div>
  `;

  const mailOptions = {
    from: `"MultiShop E-Ticaret" <no-reply@multishop.com>`,
    to: order.customer_email,
    bcc: STORE_EMAIL, // Requirement: gizli bir kopya mağazaya düşmeli
    subject: `Sipariş Onayı - ${order.order_number}`,
    text: `Sayın ${order.customer_name}, siparişiniz onaylandı. Sipariş No: ${order.order_number}, Toplam: ${(order.total_cents / 100).toFixed(2)} TL`,
    html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (err) {
    console.error('E-posta gönderim hatası:', err.message);
    return null;
  }
}

module.exports = {
  sendOrderConfirmationEmail
};
