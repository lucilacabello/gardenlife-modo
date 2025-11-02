// /api/modo/webhook.js
// Webhook MODO – compatible Vercel (Node runtimes) con import dinámico de `jose`.
// Soporta mock (?mock=accepted&draft_id=...&amount=...).

const JWKS_URL = 'https://merchants.playdigital.com.ar/v2/payment-requests/.well-known/jwks.json';

const APP_URL = process.env.APP_URL || 'https://gardenlife-modo.vercel.app';
const SHOP   = process.env.SHOPIFY_SHOP;
const TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN;

// TextDecoder seguro en todos los runtimes
const TD = (typeof TextDecoder !== 'undefined')
  ? TextDecoder
  : require('util').TextDecoder;

module.exports = async (req, res) => {
  const trace = `WB-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  try {
    // ---- MODO MOCK ----------------------------------------------------------
    const mock = req.query?.mock;
    if (mock) {
      const draft_id = req.query?.draft_id || 'MOCK_DRAFT';
      const amount   = req.query?.amount   || 0;

      if (mock === 'accepted') {
        const dc = await draftComplete(draft_id);
        return res.status(200).json({ ok:true, trace, mock:true, note:'Order paid by completing draft', dc });
      }
      return res.status(200).json({ ok:true, trace, mock:true, note:`status=${mock}` });
    }

    // ---- Parseo body --------------------------------------------------------
    let body = req.body ?? {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

    // ---- Firma JWS ----------------------------------------------------------
    const signature = req.headers['modo-signature'] || body?.signature;
    if (!signature) return res.status(400).json({ error:'MISSING_SIGNATURE' });

    const payload = await verifySignature(signature);
    const data    = payload?.data ?? {};
    const status  = String(data.status || '').toUpperCase();

    if (status !== 'ACCEPTED') {
      return res.status(200).json({ ok:true, trace, ignored:`status=${status}` });
    }

    const draft_id = data?.metadata?.draft_id;
    if (!draft_id) return res.status(400).json({ error:'MISSING_DRAFT_ID', trace });

    const dc = await draftComplete(draft_id);
    return res.status(200).json({ ok:true, trace, note:'Order paid by completing draft', dc });
  } catch (e) {
    console.error('[MODO][WEBHOOK][ERR]', trace, e);
    return res.status(500).json({ error:'WEBHOOK_FAIL', trace, detail:String(e) });
  }
};

// ----------------------- helpers --------------------------------------------

async function verifySignature(signature) {
  // Import dinámico ESM de `jose` (evita ERR_REQUIRE_ESM)
  const { createLocalJWKSet, compactVerify } = await import('jose');
  const jwksResp = await fetch(JWKS_URL);
  const jwks     = await jwksResp.json();
  const JWKS     = createLocalJWKSet(jwks);

  try {
    const { payload } = await compactVerify(signature, JWKS);
    return JSON.parse(new TD().decode(payload));
  } catch (e) {
    console.error('[MODO][WEBHOOK] Firma inválida:', e);
    throw new Error('SIGNATURE_INVALID');
  }
}

async function draftComplete(draft_id) {
  const url = `${APP_URL}/apps/modo/shopify/draft-complete`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ draft_id })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('DRAFT_COMPLETE_FAIL:' + JSON.stringify(data));
  return data;
}
