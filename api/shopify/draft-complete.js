// /api/shopify/draft-complete.js

async function getOrder(shop, token, orderId) {
  const url = `https://${shop}/admin/api/2024-10/orders/${encodeURIComponent(orderId)}.json`;
  const r = await fetch(url, { headers: { 'X-Shopify-Access-Token': token, 'Accept': 'application/json' } });
  const t = await r.text(); let j=null; try{ j=JSON.parse(t); }catch{}
  if (!r.ok) return { ok:false, data:j||t };
  return { ok:true, data:j };
}

module.exports = async (req, res) => {
  const trace = `DC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

    const shop  = process.env.SHOPIFY_SHOP;
    const token = process.env.SHOPIFY_ADMIN_TOKEN;
    if (!shop || !token) return res.status(500).json({ error: 'ENV_MISSING_SHOPIFY' });

    let body = req.body ?? {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const draft_id = body.draft_id;
    if (!draft_id) return res.status(400).json({ error: 'MISSING_DRAFT_ID' });

    const base = `https://${shop}/admin/api/2024-10`;
    const completeUrl = `${base}/draft_orders/${encodeURIComponent(draft_id)}/complete.json?payment_pending=false`;
    const getDraftUrl  = `${base}/draft_orders/${encodeURIComponent(draft_id)}.json`;

    // ---------- intento principal: POST
    let r = await fetch(completeUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // ---------- fallback si 406/409 → PUT
    if (r.status === 406 || r.status === 409) {
      r = await fetch(completeUrl, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': token,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
    }

    const txt = await r.text();
    let data = null; try { data = JSON.parse(txt); } catch {}

    // ---------- caso feliz
    if (r.ok) {
      const order_id =
        data?.order?.id ||
        data?.draft_order?.order_id ||
        null;
      const order_name =
        data?.order?.name ||
        data?.draft_order?.name ||
        null;

      let order_status_url = null;
      if (order_id) {
        try {
          const got = await getOrder(shop, token, order_id);
          if (got.ok) {
            order_status_url =
              got.data?.order?.order_status_url ||
              got.data?.order?.status_url || null;
          }
        } catch(_) {}
      }

      return res.status(200).json({ ok: true, trace, draft_id, order_id, order_name, order_status_url, raw: data });
    }

    // ---------- idempotencia: "This order has been paid"
    const msg = (data && (data.errors || data.error)) || txt || '';
    if (typeof msg === 'string' && /has been paid/i.test(msg)) {
      const g = await fetch(getDraftUrl, { headers: { 'X-Shopify-Access-Token': token } });
      const gTxt = await g.text();
      let gData = null; try { gData = JSON.parse(gTxt); } catch {}
      if (g.ok && gData?.draft_order) {
        let order_status_url = null;
        const oid = gData.draft_order.order_id || null;
        if (oid) {
          try {
            const got = await getOrder(shop, token, oid);
            if (got.ok) {
              order_status_url =
                got.data?.order?.order_status_url ||
                got.data?.order?.status_url || null;
            }
          } catch(_) {}
        }

        return res.status(200).json({
          ok: true,
          trace,
          draft_id,
          order_id: oid,
          order_name: gData.draft_order.name || null,
          order_status_url,
          already_paid: true,
          raw: gData,
        });
      }
      // Si no se pudo leer la draft, devolvemos 200 igualmente con flag:
      return res.status(200).json({
        ok: true,
        trace,
        draft_id,
        order_id: null,
        order_name: null,
        already_paid: true,
        warning: 'PAID_BUT_DRAFT_GET_FAILED',
        detail: gData || gTxt
      });
    }

    // ---------- cualquier otro error real
    return res.status(r.status).json({ error: 'DRAFT_COMPLETE_FAIL', trace, detail: data || txt });
  } catch (e) {
    return res.status(500).json({ error: 'UNEXPECTED', detail: String(e) });
  }
};
