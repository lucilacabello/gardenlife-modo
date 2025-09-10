// /api/modo/payment-request.js
// Crea la intención de pago y devuelve { id, qr, deeplink, expiration }

function uid() {
  return (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + Date.now();
}

// Construye base URL absoluta (sirve en Vercel)
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
  return j.access_token;
}

const normalizeAmount = (v) => {
  if (typeof v === 'string') v = v.replace(',', '.');
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : 0;
};

export default async function handler(req, res) {
  try {
    const method = req.method || 'GET';
    const raw = method === 'POST' ? req.body?.amount : req.query?.amount;
    const amount = normalizeAmount(raw);
    if (amount <= 0) {
      return res.status(400).json({ error: 'INVALID_AMOUNT', detail: String(raw) });
    }

    const token = await getToken(req);
    const base = process.env.MODO_BASE_URL;

    const body = {
      description: 'Compra Gardenlife',
      amount,
      currency: 'ARS',
      cc_code: process.env.MODO_CC_CODE,
      processor_code: process.env.MODO_PROCESSOR_CODE,
      external_intention_id: uid(),
      webhook_notification: process.env.MODO_WEBHOOK_URL, // apunta a TU proyecto de webhooks
      // Opcional: controlar expiración (5–10 min)
      // expiration_date: new Date(Date.now() + 9 * 60 * 1000).toISOString(),
      // Opcional: datos de cliente/envío/ítems para conciliación
      // customer: {...}, shipping_address: {...}, items: [...]
    };

    const r = await fetch(`${base}/v2/payment-requests/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': process.env.MODO_USER_AGENT, // OBLIGATORIO
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({ error: 'PAYMENT_REQUEST_FAIL', detail: data });
    }

    // Esperado por el manual: id, qr (string EMVCo), deeplink (URL), expiration_*
    return res.status(200).json({
      id: data.id,
      qr: data.qr,
      deeplink: data.deeplink,
      expiration: data.expiration_date || data.expirationDate || null,
    });
  } catch (e) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: e?.message || 'Unexpected' });
  }
}
