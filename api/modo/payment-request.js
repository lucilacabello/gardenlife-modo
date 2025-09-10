// /api/modo/payment-request.js

function uid() {
  return (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + Date.now();
}

// Construye la base URL en runtime (sirve en Vercel)
function getBaseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL; // ej: https://gardenlife-modo.vercel.app
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  return `${proto}://${host}`;
}

async function getToken(req) {
  const base = getBaseUrl(req);
  const r = await fetch(`${base}/api/modo/token`, { method: 'POST' });
  if (!r.ok) throw new Error(`TOKEN_FAIL ${r.status}`);
  const j = await r.json();
  return j.access_token || j.token || j.accessToken;
}

export default async function handler(req, res) {
  try {
    const method = req.method || 'GET';
    const token = await getToken(req);
    const base = process.env.MODO_BASE_URL;

    const rawAmount =
      method === 'POST'
        ? req.body?.amount
        : req.query?.amount;
    const amount = Number(rawAmount ?? 1);

    const body = {
      description: "Compra Gardenlife",
      amount,
      currency: "ARS",
      cc_code: process.env.MODO_CC_CODE,
      processor_code: process.env.MODO_PROCESSOR_CODE,
      external_intention_id: uid(),
      webhook_notification: process.env.MODO_WEBHOOK_URL,
      // Opcional: definir expiración manual (5–10 min)
      // expiration_date: new Date(Date.now() + 9*60*1000).toISOString(),
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
    if (!r.ok) {
      return res.status(r.status).json({ error: 'PAYMENT_REQUEST_FAIL', detail: data });
    }

    // Respuesta esperada: { id, qr, deeplink, expiration_* }
    return res.status(200).json({
      id: data.id,
      qr: data.qr,
      deeplink: data.deeplink,
      expiration: data.expiration_date || data.expirationDate || null
    });
  } catch (e) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: e.message || 'Unexpected' });
  }
}
