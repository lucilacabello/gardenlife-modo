export default async function handler(req, res) {
  const trace = `A-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }

    // --- Autorización suave: x-api-key opcional o referer del dominio ---
    const apiKey = req.headers['x-api-key'];
    const referer = req.headers['referer'] || '';
    const REQUIRED_KEY = process.env.INTERNAL_API_KEY || '';
    const ALLOWED_HOST = process.env.ALLOWED_PROXY_HOST || 'gardenlife.com.ar';

    const authorized =
      (REQUIRED_KEY ? apiKey === REQUIRED_KEY : true) || referer.includes(ALLOWED_HOST);

    if (!authorized) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const { orderId } = req.query || {};
    if (!orderId) {
      return res.status(400).json({ error: 'MISSING_ORDER_ID' });
    }

    // Acepta GID o numérico
    const numericId = String(orderId).includes('/Order/')
      ? String(orderId).split('/').pop()
      : String(orderId).replace(/\D+/g, '');

    if (!numericId) {
      return res.status(400).json({ error: 'INVALID_ORDER_ID' });
    }

    const store = process.env.SHOPIFY_STORE || ''; // ej: gardenlife-com-ar.myshopify.com
    const token = process.env.SHOPIFY_ADMIN_TOKEN || '';

    if (!store || !token) {
      return res.status(500).json({ error: 'MISSING_SHOPIFY_ENV' });
    }

    // REST Admin 2025-07 (traemos total_price listo)
    const url = `https://${store}/admin/api/2025-07/orders/${numericId}.json?fields=total_price,currency`;
    const r = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      }
    });

    const txt = await r.text();
    if (!r.ok) {
      return res.status(r.status).json({ error: 'SHOPIFY_ERROR', raw: txt });
    }

    let data = {};
    try { data = JSON.parse(txt); } catch {}

    const totalStr = data?.order?.total_price;
    const currency = data?.order?.currency || 'ARS';
    const amount = Number(totalStr);

    if (!isFinite(amount) || amount <= 0) {
      return res.status(422).json({ error: 'INVALID_AMOUNT', raw: data });
    }

    return res.status(200).json({ ok: true, amount, currency, trace });
  } catch (e) {
    return res.status(500).json({ error: 'UNEXPECTED', message: e?.message || String(e) });
  }
}
