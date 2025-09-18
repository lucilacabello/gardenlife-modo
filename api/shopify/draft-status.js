// /api/shopify/draft-status.js
// Devuelve si la Draft Order ya fue completada (=> Order creada/pagada).

module.exports = async (req, res) => {
  try {
    const draft_id = req.query?.draft_id;
    if (!draft_id) {
      return res.status(400).json({ error: "MISSING_DRAFT_ID" });
    }

    const shop  = process.env.SHOPIFY_SHOP;
    const token = process.env.SHOPIFY_ADMIN_TOKEN;
    if (!shop || !token) {
      return res.status(500).json({ error: "ENV_MISSING_SHOPIFY" });
    }

    const r = await fetch(`https://${shop}/admin/api/2024-10/draft_orders/${draft_id}.json`, {
      headers: { "X-Shopify-Access-Token": token }
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: "DRAFT_GET_FAIL", detail: data });
    }

    const draft = data.draft_order;
    return res.status(200).json({
      completed: !!draft.completed_at,
      draft_id,
      name: draft.name
    });
  } catch (e) {
    return res.status(500).json({ error: "SERVER_ERROR", message: e.message });
  }
};
