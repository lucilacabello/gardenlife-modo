// /api/modo/payment-request.js
export default async function handler(req, res) {
  const trace = `PR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }

    // Parseo body seguro
    let body = req.body ?? {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const amount = Number(body.amount || 0);
    const draft_id = body.draft_id || null;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'INVALID_AMOUNT', trace });
    }

    const useMock = String(req.query.mock || '').toLowerCase() === '1'
      || !process.env.MODO_API_KEY; // si falta la API KEY, mockeá

    if (useMock) {
      const id = `mp_${Math.random().toString(36).slice(2,10)}`;
      const qr = `000201MOCKQR...AMOUNT=${amount.toFixed(2)}`;
      const deeplink = 'https://www.modo.com.ar/pagar/';
      return res.status(200).json({
        trace, id, qr, deeplink,
        expiration: new Date(Date.now()+5*60*1000).toISOString(),
        created_at: new Date().toISOString(),
        mock: true
      });
    }

    // ====== PRODUCCIÓN: llamada real a MODO ======
    // EJEMPLO: ajustá a tu integración real
    const resp = await fetch('https://ecommerce-gateway.modo.com.ar/v2/payment-requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.MODO_API_KEY,
      },
      body: JSON.stringify({
        // completa según tu contrato con MODO
        amount: amount.toFixed(2),
        currency: 'ARS',
        metadata: draft_id ? { draft_id } : undefined,
      }),
    });

    const txt = await resp.text();
    let data = {};
    try { data = JSON.parse(txt); } catch {}

    if (!resp.ok) {
      console.error('[MODO][payment-request][UPSTREAM_FAIL]', trace, resp.status, txt);
      return res.status(502).json({ error: 'MODO_UPSTREAM', status: resp.status, trace });
    }

    // Normalizá el retorno
    const checkoutId = data.id || data.checkoutId || `mp_${Math.random().toString(36).slice(2,10)}`;
    const qr = data.qr || data.qrString || '';
    const deeplink = data.deeplink || (data.deeplink?.url ? data.deeplink.url : '');

    return res.status(200).json({
      trace,
      id: checkoutId,
      qr,
      deeplink: deeplink || 'https://www.modo.com.ar/pagar/',
      expiration: data.expiration || null,
      created_at: data.created_at || new Date().toISOString(),
    });
  } catch (e) {
    console.error('[MODO][payment-request][ERROR]', e);
    return res.status(503).json({ error: 'UNAVAILABLE', trace: trace, message: String(e?.message || e) });
  }
}

// (Opcional) Forzar bodyParser si tu runtime lo requiere
export const config = { api: { bodyParser: true } };
