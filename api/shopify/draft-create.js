// /api/shopify/draft-create.js
const { cors } = require("../../utils/cors");

module.exports = async (req, res) => {
  cors(res, req.headers.origin || "");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    }
    const shop  = process.env.SHOPIFY_SHOP;
    const token = process.env.SHOPIFY_ADMIN_TOKEN;
    if (!shop || !token) return res.status(500).json({ error: "ENV_MISSING_SHOPIFY" });

    const { lineItems = [], customer = {}, shipping_address = {}, note, tags = ["modo","qr"] } = (req.body || {});
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ error: "NO_LINE_ITEMS" });
    }

    const body = {
      draft_order: {
        note: note || "Checkout con MODO",
        tags,
        customer: customer.email ? { email: customer.email } : undefined,
        shipping_address,
        line_items: lineItems.map(li => ({
          variant_id: li.variant_id,
          quantity: li.quantity || 1,
          price: Number(li.price || 0).toFixed(2)
        }))
      }
    };

    const r = await fetch(`https://${shop}/admin/api/2024-10/draft_orders.json`, {
      method: "POST",
      headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: "DRAFT_CREATE_FAIL", detail: data });

    const d = data.draft_order;
    return res.status(200).json({ draft_id: d.id, draft_name: d.name, currency: d.currency, subtotal: d.subtotal_price, invoice_url: d.invoice_url });
  } catch (e) {
    return res.status(500).json({ error: "SERVER_ERROR", message: e.message });
  }
};
