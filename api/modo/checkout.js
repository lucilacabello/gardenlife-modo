// /api/modo/checkout.js
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { amount, orderId, customer } = req.body || {};
    if (!amount) {
      return res.status(400).json({ error: 'AMOUNT_REQUIRED' });
    }

    // 1) Pedir token a nuestro propio endpoint
    const tokenRes = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : ''}/api/modo/token`);
    const { access_token } = await tokenRes.json();

    // 2) Payload para crear payment request en MODO
    const payload = {
      description: `Pedido ${orderId || ''}`.trim(),
      amount: Number(amount),
      currency: 'ARS',
      cc_code: process.env.MODO_CC_CODE,
      processor_code: process.env.MODO_PROCESSOR_CODE, // P1018
      external_intention_id: orderId || uuid(), // siempre único
      webhook_notification: `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : ''}/api/modo/webhook`,
      customer: customer || undefined
    };

    const r = await fetch(process.env.MODO_BASE_URL + '/v2/payment-requests/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': process.env.MODO_USER_AGENT,
        'Authorization': `Bearer ${access_token}`
      },
      body: JSON.stringify(payload)
    });

    const j = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({ error: 'CREATE_FAIL', detail: j });
    }

    // Lo que va a consumir Shopify
    res.status(200).json({
      id: j.id,
      qr: j.qr,
      deeplink: j.deeplink,
      expiration_date: j.expiration_date
    });
  } catch (e) {
    console.error('ERROR CHECKOUT:', e);
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
}
