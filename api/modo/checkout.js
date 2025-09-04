// /api/modo/checkout.js
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function getTokenInternal() {
  // Llama a nuestro endpoint de token dentro del mismo proyecto (hostname dinámico)
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
  const r = await fetch(`${base}/api/modo/token`);
  if (!r.ok) throw new Error(`Token error: ${r.status}`);
  const j = await r.json();
  return j.access_token;
}

export default async function handler(req, res) {
  // CORS para la extensión
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

    // Si Vercel no parsea JSON automáticamente
    const body = req.body || (await new Promise((resolve) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => resolve(data ? JSON.parse(data) : {}));
    }));

    const { amount, orderId, customer } = body || {};
    if (amount == null) return res.status(400).json({ error: 'AMOUNT_REQUIRED' });

    const access_token = await getTokenInternal();

    // external_intention_id SIEMPRE único
    const externalId = orderId || uuid();

    const payload = {
      description: `Pedido ${externalId}`,
      amount: Number(amount),
      currency: 'ARS',
      cc_code: process.env.MODO_CC_CODE,
      processor_code: process.env.MODO_PROCESSOR_CODE, // P1018
      external_intention_id: externalId,
      webhook_notification: process.env.MODO_WEBHOOK_URL,
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
      // Te devuelvo detalle crudo para debug rápido
      return res.status(r.status).json({ error: 'CREATE_FAIL', detail: j });
    }

    // Respuesta mínima que necesita la UI
    return res.status(200).json({
      id: j.id,
      qr: j.qr,
      deeplink: j.deeplink,
      expiration_date: j.expiration_date
    });
  } catch (e) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: e?.message || 'Unexpected' });
  }
}

