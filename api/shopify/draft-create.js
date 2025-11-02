/**
 * POST /api/shopify/draft-create
 * Body:
 * {
 *   note, tags[], lineItems:[{variant_id?, title?, price?, quantity}],
 *   customer:{email},
 *   shipping_address:{...},
 *   billing_address?:{...},
 *   shipping_line?:{ title, price }
 * }
 */

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    }

    // ---- Parse body (permitir stringified JSON) ----
    let body = req.body ?? {};
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const {
      note,
      tags = [],
      lineItems = [],            // [{ variant_id, quantity, price }] o [{ title, price, quantity }]
      customer = {},             // { email }
      shipping_address = {},
      billing_address = {},
      shipping_line              // { title, price }  -> Envío/Retiro (opcional)
    } = body;

    // ---- Shop & Token desde ENV ----
    const shop =
      process.env.SHOPIFY_SHOP_DOMAIN ||
      process.env.SHOP ||
      process.env.SHOPIFY_SHOP ||
      process.env.SHOPIFY_DOMAIN;

    const token =
      process.env.SHOPIFY_ADMIN_TOKEN ||
      process.env.SHOPIFY_ACCESS_TOKEN ||
      process.env.PRIVATE_SHOPIFY_ACCESS_TOKEN;

    if (!shop || !token) {
      return res.status(500).json({ error: "MISSING_SHOP_ENV", shop: !!shop, token: !!token });
    }

    // ---- Mapear line_items para Shopify ----
    const draftLineItems = (lineItems || []).map((li) => {
      const quantity = li?.quantity ? Number(li.quantity) : 1;

      // Si viene variant_id: NO mandar price (que lo tome del catálogo)
      if (li?.variant_id) {
        return { variant_id: Number(li.variant_id), quantity };
      }

      // Custom line: usar title + price numérico
      const price = Number(li?.price || 0);
      return { title: li?.title || "Pago MODO", quantity, price };
    });

    // ---- Billing fallback a Shipping si no vino ----
    const billing =
      (billing_address && Object.keys(billing_address).length > 0)
        ? billing_address
        : ((shipping_address && Object.keys(shipping_address).length > 0) ? shipping_address : undefined);

    // ---- Shipping line opcional (único objeto) ----
    const shippingLineObj = shipping_line && typeof shipping_line === "object"
      ? {
          title: String(shipping_line.title || "Envío"),
          price: Number(shipping_line.price || 0),
          custom: true
        }
      : ((shipping_address && Object.keys(shipping_address).length > 0)
          ? { title: "Envío", price: 0, custom: true }
          : undefined);

    // ---- Tags a string ----
    const tagsString = Array.isArray(tags) ? tags.join(", ") : String(tags || "");

    // ---- Draft body Shopify REST ----
    const draftBody = {
      draft_order: {
        note: note || "Checkout con MODO",
        tags: tagsString,
        customer: customer?.email ? { email: String(customer.email) } : undefined,
        shipping_address,
        billing_address: billing,
        shipping_line: shippingLineObj,     // único objeto
        line_items: draftLineItems
      }
    };

    // ---- Llamado a Shopify ----
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
      // devolvemos detalle crudo para depurar en start.html
      return res.status(resp.status).json({ error: "DRAFT_CREATE_FAIL", detail: data });
    }

    const d = data?.draft_order;
    return res.status(200).json({
      draft_id: d?.id,
      draft_name: d?.name,
      currency: d?.currency,
      subtotal: d?.subtotal_price,
      invoice_url: d?.invoice_url
    });

  } catch (e) {
    return res.status(500).json({ error: "SERVER_ERROR", message: e?.message || String(e) });
  }
}
