// api/modo/status.js — Consulta estado de un Payment Request (MODO v2, PROD)

let CACHED_TOKEN = null;
let CACHED_TOKEN_EXP = 0;

function requireEnv(keys) {
  const miss = keys.filter(k => !process.env[k]);
  if (miss.length) throw new Error(`ENV_MISSING ${miss.join(",")}`);
}

function baseAppUrl() {
  requireEnv(["APP_URL"]);
  return process.env.APP_URL.replace(/\/+$/, "");
}

async function getModoToken() {
  if (CACHED_TOKEN && Date.now() < CACHED_TOKEN_EXP) return CACHED_TOKEN;
  const r = await fetch(`${baseAppUrl()}/api/modo/token`, { method: "POST" });
  if (!r.ok) throw new Error(`TOKEN_FAIL ${r.status}`);
  const j = await r.json();
  CACHED_TOKEN = j.access_token;
  CACHED_TOKEN_EXP = Date.now() + 6 * 60 * 60 * 1000; // 6h cache
  return CACHED_TOKEN;
}

module.exports = async function handler(req, res) {
  const trace = `STS-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const debug = String(req.query?.debug || "") === "1";

  try {
    requireEnv(["APP_URL", "MODO_BASE_URL", "MODO_USER_AGENT"]);

    if (req.method !== "GET") {
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    }

    const id = (req.query?.id || "").toString().trim();
    if (!id) return res.status(400).json({ error: "MISSING_ID" });

    const token = await getModoToken();
    const base = process.env.MODO_BASE_URL.replace(/\/+$/, "");
    // ✅ Endpoint correcto en PROD (sin /data)
    const url = `${base}/v2/payment-requests/${encodeURIComponent(id)}`;

    const r = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": process.env.MODO_USER_AGENT,   // ej. Gardenlife-Shopify
        "Authorization": `Bearer ${token}`,
        "X-Trace-Id": trace
      }
    });

    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (debug) console.error("[DEBUG][status][RESPONSE]", { trace, status: r.status, response: data });

    if (!r.ok) {
      return res.status(r.status).json({ error: "STATUS_FAIL", status: r.status, trace, detail: data });
    }

    // --- Normalización MODO v2 ---
    const statusRaw = (data?.status || "").toString().toUpperCase(); // SCANNED|PROCESSING|ACCEPTED|REJECTED|EXPIRED|CANCELLED
    const amount    = data?.amount ?? null;
    const payer     = data?.payer  ?? null;
    const card      = data?.card   ?? null;
    const installments = data?.installments ?? null;

    const metadata = {
      external_intention_id: data?.external_intention_id ?? null,
      gateway_transaction_id: data?.gateway_transaction_id ?? null,
      card_authorization_code: data?.card_authorization_code ?? null,
      message: data?.message ?? null
    };

    return res.status(200).json({
      trace, id, status: statusRaw, amount, payer, metadata, card, installments,
      raw: debug ? data : undefined
    });

  } catch (e) {
    console.error("[MODO][status][ERROR]", { trace, msg: e.message });
    return res.status(500).json({ error: "SERVER_ERROR", trace, message: e.message || "Unexpected" });
  }
};

