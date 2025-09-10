// /api/modo/payment-request.js
// Usa tu endpoint de token cacheado y crea la intención (QR + deeplink)

function uid() {
  return (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + Date.now();
}

async function getToken() {
  const url = process.env.APP_URL ? `${process.env.APP_URL}/api/modo/token` : '/api/modo/token';
  const r = await fetch(url, { method: 'POST' });
  if (!r.ok) throw new Error(`TOKEN_FAIL ${r.status}`);
  const j = await r.json();
  return j.access_token || j.token || j.accessToken;
}

export default async function handler(req, res) {
  try {
    const token = await getToken();
    const base = process.env.MODO_BASE_URL;

    const amount = Number(req.body?.amount ?? req.query?.amount ?? 1);
    const body = {
      description: "Compra Gardenlife",
      amount,                     // total del pedido
      currency: "ARS",
      cc_code: process.env.MODO_CC_CODE,
      processor_code: process.env.MODO_PROCESSOR_CODE,
      external_intention_id: uid(),
      webhook_notification: process.env.MODO_WEBHOOK_URL, // ej: https://tuapp.vercel.app/api/modo/webhook
      // optional: customer/shipping/items si querés granularidad
      // expiration_date: new Date(Date.now() + 9*60*1000).toISOString(), // 5–10 min si querés setearlo manual
    };

    const r = await fetch(`${base}/v2/payment-requests/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': process.env.MODO_USER_AGENT,
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ error: 'PAYMENT_REQUEST_FAIL', detail: data });

    // Esperamos { id, qr, deeplink, expiration_* }
    return res.status(200).json({
      id: data.id,
      qr: data.qr,
      deeplink: data.deeplink,
      expiration: {
        at: data.expiration_date || data.expirationDate,
        seconds: data.expiration_seconds || data.expirationSeconds
      }
    });
  } catch (e) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: e.message || 'Unexpected' });
  }
}
