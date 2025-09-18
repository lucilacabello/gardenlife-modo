// /api/shopify/draft-create.js  (CommonJS)
module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    }
    const shop = process.env.SHOPIFY_SHOP;
    const token = process.env.SHOPIFY_ADMIN_TOKEN;
    if (!shop || !token) {
      return res.status(500).json({ error: "ENV_MISSING_SHOPIFY" });
    }

    const {
      lineItems = [],     // [{ variant_id, quantity, price }]
      customer = {},      // { email, first_name, last_name, phone }
      shipping_address={},// { first_name,last_name,address1,city,zip,province,country,phone }
      note,                // opcional
      tags = ["modo","qr"]
    } = (req.body || {});

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ error: "NO_LINE_ITEMS" });
    }

    const draftBody = {
      draft_order: {
        note: note || "Checkout con MODO",
        tags,
        customer: customer.email ? { email: customer.email } : undefined,
        shipping_address,
        line_items: lineItems.map(li => ({
          variant_id: li.variant_id,
          quantity: li.quantity || 1,
          price: (Number(li.price || 0)).toFixed(2)
        }))
      }
    };

    const resp = await fetch(`https://${shop}/admin/api/2024-10/draft_orders.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(draftBody)
    });
    const data = await resp.json();

    if (!resp.ok) {
      return res.status(resp.status).json({ error: "DRAFT_CREATE_FAIL", detail: data });
    }

    const draft = data.draft_order;
    return res.status(200).json({
      draft_id: draft.id,
      draft_name: draft.name,
      currency: draft.currency,
      subtotal: draft.subtotal_price,
      invoice_url: draft.invoice_url
    });
  } catch (e) {
    return res.status(500).json({ error: "SERVER_ERROR", message: e.message });
  }
};
