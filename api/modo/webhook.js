// /api/modo-webhook.js
// Plan A: intentar /complete.json
// Plan B: si 406 (u otro), crear la Order directamente desde la Draft y borrar la Draft.
// + Conciliación MODO: consulta /v2/payment-requests/{id}/data y guarda en metafields de la orden.

export default async function handler(req, res) {
  const trace = `W-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    }

    // ---------- Parseo payload ----------
    let payload = req.body ?? {};
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch { payload = {}; }
    }
    console.log("[MODO][WEBHOOK][IN]", trace, JSON.stringify(payload));

    const status = String(payload.status || "").toUpperCase();
    const draft_id = payload?.metadata?.draft_id;
    const paymentRequestId =
      payload.payment_request_id || payload.id || payload.paymentRequestId || payload.payment_requestId || payload?.metadata?.payment_request_id;

    if (!draft_id) {
      return res.status(400).json({ error: "MISSING_DRAFT_ID_IN_METADATA" });
    }
    if (status !== "APPROVED") {
      return res.status(200).json({ ok: true, ignored: true, status, draft_id });
    }

    // ---------- ENV Shopify ----------
    const shop  = process.env.SHOPIFY_SHOP;
    const token = process.env.SHOPIFY_ADMIN_TOKEN;
    if (!shop || !token) {
      return res.status(500).json({ error: "ENV_MISSING_SHOPIFY" });
    }

    // ---------- Helpers ----------
    const assertEnv = () => {
      const miss = ["APP_URL","MODO_BASE_URL","MODO_USER_AGENT"].filter(k => !process.env[k]);
      if (miss.length) throw new Error(`ENV_MISSING ${miss.join(",")}`);
    };
    const getModoToken = async () => {
      const base = process.env.APP_URL?.replace(/\/+$/, "");
      const r = await fetch(`${base}/api/modo/token`, { method: "POST" });
      if (!r.ok) throw new Error(`TOKEN_FAIL ${r.status}`);
      return (await r.json()).access_token;
    };
    const getModoData = async (prId, accessToken) => {
      if (!prId) return null;
      const base = process.env.MODO_BASE_URL.replace(/\/+$/, "");
      const r = await fetch(`${base}/v2/payment-requests/${prId}/data`, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          "User-Agent": process.env.MODO_USER_AGENT
        }
      });
      const txt = await r.text();
      let data; try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
      if (!r.ok) throw new Error(`MODO_DATA_FAIL ${r.status} ${txt}`);
      return data;
    };
    const setOrderMetafields = async ({ orderId, fields }) => {
      const endpoint = `https://${shop}/admin/api/2024-10/graphql.json`;
      const metafields = [
        { namespace: "modo", key: "payment_request_id", value: String(fields.payment_request_id || ""), type: "single_line_text_field" },
        { namespace: "modo", key: "status", value: String(fields.modo_status || ""), type: "single_line_text_field" },
        { namespace: "modo", key: "payment_method", value: String(fields.payment_method || ""), type: "single_line_text_field" },
        { namespace: "modo", key: "scheme", value: String(fields.scheme || ""), type: "single_line_text_field" },
        { namespace: "modo", key: "installments_quantity", value: String(fields.installments_quantity ?? ""), type: "single_line_text_field" },
        { namespace: "modo", key: "installments_real_quantity", value: String(fields.installments_real_quantity ?? ""), type: "single_line_text_field" },
        { namespace: "modo", key: "installments_amount", value: String(fields.installments_amount ?? ""), type: "single_line_text_field" },
        { namespace: "modo", key: "installments_cft", value: String(fields.installments_cft ?? ""), type: "single_line_text_field" }
      ];
      const mutation = `
        mutation metafieldsSet($ownerId: ID!, $metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(ownerId: $ownerId, metafields: $metafields) {
            metafields { namespace key value }
            userErrors { field message }
          }
        }
      `;
      const variables = {
        ownerId: `gid://shopify/Order/${orderId}`,
        metafields
      };
      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token
        },
        body: JSON.stringify({ query: mutation, variables })
      });
      const j = await r.json();
      if (j.errors || j.data?.metafieldsSet?.userErrors?.length) {
        throw new Error(`SHOPIFY_META_FAIL ${JSON.stringify(j)}`);
      }
      return j;
    };

    assertEnv();

    // ---------- (1) Completar Draft: PLAN A ----------
    const completeUrl = `https://${shop}/admin/api/2024-10/draft_orders/${draft_id}/complete.json`;
    console.log("[SHOPIFY][DRAFT_COMPLETE][REQ]", trace, completeUrl);
    let resp = await fetch(completeUrl, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ payment_pending: false }) // ya cobrado por MODO
    });

    let data = {};
    try { data = await resp.json(); } catch {}
    console.log("[SHOPIFY][DRAFT_COMPLETE][RESP]", trace, resp.status, data);

    let orderId =
      data?.draft_order?.order_id ||
      data?.order?.id ||
      null;

    // ---------- (2) Si no funcionó, PLAN B ----------
    if (!resp.ok) {
      console.log("[WEBHOOK] Plan A falló, vamos a Plan B (crear Order manual).", trace);

      // 2.1 Leer la Draft
      const getDraftUrl = `https://${shop}/admin/api/2024-10/draft_orders/${draft_id}.json`;
      const dRes = await fetch(getDraftUrl, {
        headers: { "X-Shopify-Access-Token": token }
      });
      const dJson = await dRes.json();
      if (!dRes.ok) {
        return res.status(dRes.status).json({ error: "DRAFT_FETCH_FAIL", detail: dJson });
      }
      const draft = dJson.draft_order;

      // 2.2 Mapear line items
      const orderLineItems = (draft.line_items || []).map(li => {
        if (li.variant_id) {
          return { variant_id: li.variant_id, quantity: li.quantity || 1, price: li.price };
        }
        return { title: li.title || "Item", quantity: li.quantity || 1, price: li.price };
      });

      // 2.3 Crear la Order pagada
      const orderBody = {
        order: {
          email: draft.customer?.email || draft.email,
          customer: draft.customer ? { id: draft.customer.id, email: draft.customer.email } : undefined,
          line_items: orderLineItems,
          billing_address: draft.billing_address || draft.shipping_address || undefined,
          shipping_address: draft.shipping_address || undefined,
          tags: draft.tags ? `${draft.tags}, modo, qr` : "modo, qr",
          note: draft.note || "Pago con MODO",
          financial_status: "paid",
          transactions: [
            {
              kind: "sale",
              status: "success",
              amount: String(draft.total_price || payload.amount || 0),
              gateway: "MODO"
            }
          ]
        }
      };

      const createOrderUrl = `https://${shop}/admin/api/2024-10/orders.json`;
      console.log("[SHOPIFY][ORDER_CREATE][REQ]", trace, createOrderUrl);
      const oRes = await fetch(createOrderUrl, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(orderBody)
      });
      const oJson = await oRes.json().catch(() => ({}));
      console.log("[SHOPIFY][ORDER_CREATE][RESP]", trace, oRes.status, oJson);

      if (!oRes.ok) {
        return res.status(oRes.status).json({ error: "ORDER_CREATE_FAIL", detail: oJson });
      }
      orderId = oJson?.order?.id;

      // 2.4 Borrar Draft (evita duplicados)
      try {
        const delUrl = `https://${shop}/admin/api/2024-10/draft_orders/${draft_id}.json`;
        const delRes = await fetch(delUrl, {
          method: "DELETE",
          headers: { "X-Shopify-Access-Token": token }
        });
        console.log("[SHOPIFY][DRAFT_DELETE][RESP]", trace, delRes.status);
      } catch (e) {
        console.warn("[SHOPIFY][DRAFT_DELETE][WARN]", trace, e?.message);
      }
    }

    // ---------- (3) Conciliación MODO: leer /data y setear metafields ----------
    let savedMeta = null;
    try {
      if (orderId && paymentRequestId) {
        const modoToken = await getModoToken();
        const modoData = await getModoData(paymentRequestId, modoToken);
        const installments = modoData?.installments || {};

        const fields = {
          payment_request_id: paymentRequestId || "",
          modo_status: modoData?.status || "APPROVED",
          payment_method: modoData?.payment_method || modoData?.method || "",
          scheme: modoData?.scheme || "",
          installments_quantity: installments?.quantity ?? null,
          installments_real_quantity: installments?.real_quantity ?? null,
          installments_amount: installments?.amount ?? null,
          installments_cft: installments?.cft ?? null
        };

        savedMeta = await setOrderMetafields({ orderId, fields });
      } else {
        console.warn("[MODO][WEBHOOK] Salté conciliación: faltan orderId o paymentRequestId", { orderId, paymentRequestId, trace });
      }
    } catch (e) {
      console.error("[MODO][WEBHOOK][CONCIL_FAIL]", trace, e?.message);
    }

    return res.status(200).json({
      ok: true,
      trace,
      completed: true,
      draft_id,
      order_id: orderId,
      payment_request_id: paymentRequestId || null,
      metafields_saved: Boolean(savedMeta)
    });

  } catch (e) {
    console.error("[WEBHOOK][EXCEPTION]", trace, e);
    return res.status(500).json({ error: "SERVER_ERROR", message: e.message, trace });
  }
}
