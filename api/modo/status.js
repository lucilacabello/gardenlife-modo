// api/modo/status.js — MODO Directa (api.modo.com.ar)
let CACHED_TOKEN = null;
let CACHED_TOKEN_EXP = 0;

function getBaseAppUrl() {
  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error("ENV_MISSING APP_URL");
  return appUrl.replace(/\/+$/, "");
}

async function getToken() {
  if (CACHED_TOKEN && Date.now() < CACHED_TOKEN_EXP) return CACHED_TOKEN;
  const r = await fetch(`${getBaseAppUrl()}/api/modo/token`, { method: "POST" });
  if (!r.ok) throw new Error(`TOKEN_FAIL ${r.status}`);
  const j = await r.json();
  CACHED_TOKEN = j.access_token;
  CACHED_TOKEN_EXP = Date.now() + 6 * 60 * 60 * 1000;
  return CACHED_TOKEN;
}

function assertEnv() {
  const req = ["APP_URL","MODO_BASE_URL","MODO_USER_AGENT"];
  const miss = req.filter(k => !process.env[k]);
  if (miss.length) throw new Error(`ENV_MISSING ${miss.join(",")}`);
}

module.exports = async function handler(req, res) {
  const trace = `STS-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const debug = req.query?.debug === "1";
  try {
    assertEnv();
    if (req.method !== "GET") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });

    const id = (req.query?.id || "").toString().trim();
    if (!id) return res.status(400).json({ error: "MISSING_ID" });

    const token = await getToken();
    const base = process.env.MODO_BASE_URL.replace(/\/+$/,"");
    const url = `${base}/v2/payment-requests/${encodeURIComponent(id)}/data`;

    const r = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": process.env.MODO_USER_AGENT,
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

// --- Normalización según nuevo esquema MODO SDK v2 ---
const statusRaw = (data?.status || "").toString().toUpperCase();
const amount = data?.amount ?? null;
const payer = data?.payer || null;
const metadata = {
  external_intention_id: data?.external_intention_id || null,
  gateway_transaction_id: data?.gateway_transaction_id || null,
  card_authorization_code: data?.card_authorization_code || null,
  message: data?.message || null
};
const installments = data?.installments || null;
const card = data?.card || null;

return res.status(200).json({
  trace,
  id,
  status: statusRaw, // SCANNED | PROCESSING | ACCEPTED | REJECTED
  amount,
  payer,
  metadata,
  card,
  installments,
  raw: debug ? data : undefined
});

