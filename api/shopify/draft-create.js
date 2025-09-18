// /api/shopify/draft-create.js
// Crea una Draft Order. Acepta ítems de catálogo (variant_id) o custom (title+price).
module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    }

    const shop  = process.env.SHOPIFY_SHOP;
    const token = process.env.SHOPIFY_ADMIN_TOKEN;
    if (!shop || !token) {
      return res.status(500).json({ error: "ENV_MISSING_SHOPIFY" });
    }

    const {
      lineItems = [],        // [{ variant_id, quantity, price }] o [{ title, price, quantity }]
      customer = {},         // { email, ... }
      shipping_address = {}, // { first_name,last_name,address1,city,zip,province,country,phone }
      note,
      tags = ["modo", "qr"]  // puede venir array o string
    } = (req.body || {});

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ error: "NO_LINE_ITEMS" });
    }

    // 👉 Normalizamos tags a string coma-separado (Shopify lo requiere como string)
    const tagsString = Array.isArray(tags) ? tags.join(", ") : (tags ? String(tags) : "");

    const draftLineItems = lineItems.map((li) => {
      const quantity = li.quantity || 1;
      const price = Number(li.price || 0).toFixed(2);

      if (li.variant_id) {
        return { variant_id: li.variant_id, quantity, price };
      }
      // Ítem custom (sin variante)
      return { title: li.title || "Pago MODO", quantity, price };
    });

    const draftBody = {
      draft_order: {
        note: note || "Checkout con MODO",
        tags: tagsString, // 👈 ahora es string
        customer: customer.email ? { email: customer.email } : undefined,
        shipping_address,
        line_items: draftLineItems
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

    const d = data.draft_order;
    return res.status(200).json({
      draft_id: d.id,
      draft_name: d.name,
      currency: d.currency,
      subtotal: d.subtotal_price,
      invoice_url: d.invoice_url
    });
  } catch (e) {
    return res.status(500).json({ error: "SERVER_ERROR", message: e.message });
  }
};
