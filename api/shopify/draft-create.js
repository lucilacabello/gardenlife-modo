// /api/shopify/draft-create.js
// Crea una Draft Order lista para "complete":
// - customer.email
// - shipping_address
// - billing_address (por defecto = shipping_address)
// - shipping_line (por defecto = { title:"Envío", price:0 })

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
      lineItems = [],            // [{ variant_id, quantity, price }] o [{ title, price, quantity }]
      customer = {},             // { email, ... }
      shipping_address = {},     // { first_name,last_name,address1,city,zip,province,country,phone }
      billing_address = {},      // idem shipping
      shipping_line,             // { title, price }  -> Envío/Retiro (opcional)
      note,
      tags = ["modo", "qr"]      // array o string
    } = (req.body || {});

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ error: "NO_LINE_ITEMS" });
    }

    // --- Normalizaciones ---
    const tagsString = Array.isArray(tags) ? tags.join(", ") : (tags ? String(tags) : "");

    const draftLineItems = lineItems.map((li) => {
      const quantity = li.quantity || 1;
      const price = Number(li.price || 0).toFixed(2);
      if (li.variant_id) return { variant_id: li.variant_id, quantity, price };
      return { title: li.title || "Pago MODO", quantity, price };
    });

    // Si no mandan billing, usamos el shipping para cumplir requisitos de Shopify
    const billing = Object.keys(billing_address || {}).length
      ? billing_address
      : (Object.keys(shipping_address || {}).length ? shipping_address : undefined);

    // Si no mandan shipping_line, ponemos una por defecto (Envío $0).
    // Para "Retiro", podés mandar { title:"Retiro en tienda", price:0 } desde el caller.
    const shippingLineObj = shipping_line && typeof shipping_line === "object"
      ? {
          title: String(shipping_line.title || "Envío"),
          price: Number(shipping_line.price || 0),
          custom: true
        }
      : (Object.keys(shipping_address || {}).length
          ? { title: "Envío", price: 0, custom: true }
          : undefined);

    const draftBody = {
      draft_order: {
        note: note || "Checkout con MODO",
        tags: tagsString,
        customer: customer.email ? { email: customer.email } : undefined,
        shipping_address,
        billing_address: billing,
        shipping_line: shippingLineObj, // Shopify REST acepta un único objeto
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

    const data = await resp.json().catch(() => ({}));
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
