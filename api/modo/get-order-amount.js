/**
 * GET /apps/modo/get-order-amount?orderId=<GID_o_numérico>
 * Devuelve: { amount: number, currency: "ARS" }
 *
 * - Acepta GID: "gid://shopify/Order/1234567890" o ID numérico "1234567890"
 * - Usa Shopify Admin REST. Requiere:
 *   SHOPIFY_SHOP_DOMAIN, SHOPIFY_ADMIN_TOKEN
 */
export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    }

    const orderIdRaw = String(req.query?.orderId || "").trim();
    if (!orderIdRaw) {
      return res.status(400).json({ error: "MISSING_ORDER_ID" });
    }

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

    // Soporta GID o numérico
    const match = orderIdRaw.match(/(\d+)$/);
    const numericId = match ? match[1] : null;
    if (!numericId) {
      return res.status(400).json({ error: "INVALID_ORDER_ID_FORMAT", orderIdRaw });
    }

    // Admin REST
    const url = `https://${shop}/admin/api/2025-07/orders/${numericId}.json`;
    const r = await fetch(url, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
    });

    // Rate limit simple (reintento 1 vez)
    if (r.status === 429) {
      const retry = Number(r.headers.get("Retry-After") || 2);
      await new Promise((resolve) => setTimeout(resolve, retry * 1000));
      const rr = await fetch(url, {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
      });
      if (!rr.ok) {
        const txt = await rr.text();
        return res.status(rr.status).json({ error: "RATE_LIMIT", detail: txt });
      }
      const j2 = await rr.json();
      const amount2 = Number(j2?.order?.total_price ?? 0);
      const currency2 = j2?.order?.currency || "ARS";
      return res.json({ amount: amount2, currency: currency2, order_name: j2?.order?.name });
    }

    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).json({ error: "SHOPIFY_FETCH_FAILED", detail: txt });
    }

    const j = await r.json();
    const amount = Number(j?.order?.total_price ?? 0);
    const currency = j?.order?.currency || "ARS";
    return res.json({ amount, currency, order_name: j?.order?.name });
  } catch (err) {
    console.error("[get-order-amount]", err);
    return res.status(500).json({ error: err?.message || "INTERNAL_ERROR" });
  }
}
