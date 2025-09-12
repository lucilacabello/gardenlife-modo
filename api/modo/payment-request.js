// /api/modo/payment-request.js
// Crea la intención de pago y devuelve { id, qr, deeplink, expiration }

function uid() {
  return (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + Date.now();
}

function getBaseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL; // ej: https://gardenlife-modo.vercel.app
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  return `${proto}://${host}`;
}

let CACHED_TOKEN = null;
let CACHED_TOKEN_EXP = 0;

async function getToken(req) {
  if (CACHED_TOKEN && Date.now() < CACHED_TOKEN_EXP) return CACHED_TOKEN;
  const base = getBaseUrl(req);
  const r = await fetch(`${base}/api/modo/token`, { method: 'POST' });
  if (!r.ok) throw new Error(`TOKEN_FAIL ${r.status}`);
  const j = await r.json();
  CACHED_TOKEN = j.access_token;
  CACHED_TOKEN_EXP = Date.now() + 6 * 60 * 60 * 1000; // 6h de margen
  return CACHED_TOKEN;
}

const normalizeAmount = (v) => {
  if (typeof v === 'string') v = v.replace(',', '.');
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : 0;
};

function assertEnv() {
  const required = ['MODO_BASE_URL','MODO_CC_CODE','MODO_PROCESSOR_CODE','MODO_USER_AGENT','MODO_WEBHOOK_URL'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) throw new Error(`ENV_MISSING ${missing.join(',')}`);
}

export default async function handler(req, res) {
  try {
    assertEnv();

    const method = req.method || 'GET';
    const raw = method === 'POST' ? (req.body?.amount ?? req.query?.amount) : req.query?.amount;
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
      webhook_notification: process.env.MODO_WEBHOOK_URL
      // Opcional: expiration_date: new Date(Date.now() + 9 * 60 * 1000).toISOString(),
      // Opcional: customer / shipping_address / items ...
    };

    const r = await fetch(`${base}/v2/payment-requests/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': process.env.MODO_USER_AGENT,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({
        error: 'PAYMENT_REQUEST_FAIL',
        status: r.status,
        detail: data
      });
    }

return res.status(200).json({
  id: data.id,
  qr: data.qr,
  // normaliza: si llega objeto {url: "..."} lo convierte a string
  deeplink: typeof data.deeplink === 'string' ? data.deeplink : (data.deeplink?.url || null),
  expiration: data.expiration_date || data.expirationDate || data.expiration_at || null,
  created_at: data.created_at || null
});

  } catch (e) {
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: e?.message || 'Unexpected'
    });
  }
}
