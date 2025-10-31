// /api/modo/payment-request.js  (CommonJS, MODO Directa)
// Crea payment-request en MODO y devuelve { id, qr, deeplink, expiration }.
// Importante: usa APP_URL para pedir el token aunque la request venga por /apps/modopay/...

const crypto = require("crypto");

function shortId(prefix = "GL") {
  const rand = crypto.randomBytes(8).toString("hex");
  const ts = Date.now().toString(36);
  return `${prefix}-${ts}-${rand}`.slice(0, 39);
}

function getBaseUrl() {
  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error("ENV_MISSING APP_URL");
  return appUrl.replace(/\/+$/,""); // sin barra final
}

let CACHED_TOKEN = null; 
let CACHED_TOKEN_EXP = 0;

async function getToken() {
  if (CACHED_TOKEN && Date.now() < CACHED_TOKEN_EXP) return CACHED_TOKEN;
  const base = getBaseUrl();
  const r = await fetch(`${base}/api/modo/token`, { method: "POST" });
  if (!r.ok) throw new Error(`TOKEN_FAIL ${r.status}`);
  const j = await r.json();
  CACHED_TOKEN = j.access_token;
  CACHED_TOKEN_EXP = Date.now() + 6 * 60 * 60 * 1000; // 6h
  return CACHED_TOKEN;
}

function normalizeAmount(v) {
  if (typeof v === "string") v = v.replace(",", ".");
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : 0;
}

function assertEnv() {
  const req = ["APP_URL","MODO_BASE_URL","MODO_CC_CODE","MODO_PROCESSOR_CODE","MODO_USER_AGENT","MODO_WEBHOOK_URL"];
  const miss = req.filter(k => !process.env[k]);
  if (miss.length) throw new Error(`ENV_MISSING ${miss.join(",")}`);
}

// === MiPyME ===
const MIPYME_CODE_BY_QTY = { 3: 13, 6: 16 };
const toMiPymeCode = qty => MIPYME_CODE_BY_QTY[qty] || null;

module.exports = async function handler(req, res) {
  const debug = req.query?.debug === "1" || req.body?.debug === 1;
  const trace = `TRACE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

  try {
    assertEnv();

    const method = req.method || "GET";
    const rawAmount = method === "POST"
      ? (req.body && req.body.amount) ?? (req.query && req.query.amount)
      : (req.query && req.query.amount);

    const draft_id  = method === "POST"
      ? (req.body && req.body.draft_id)
      : (req.query && req.query.draft_id);

    // cuotas MiPyME deseadas (0|3|6)
    const mipyme_installments = Number(
      method === "POST"
        ? (req.body && req.body.mipyme_installments)
        : (req.query && req.query.mipyme_installments)
    ) || 0;
    const mipyme_code = toMiPymeCode(mipyme_installments);

    const amountNum = normalizeAmount(rawAmount);
    if (amountNum <= 0) {
      return res.status(400).json({ error: "INVALID_AMOUNT", detail: String(rawAmount) });
    }
    const amount = Number(amountNum.toFixed(2));

    const token = await getToken();
    const base = process.env.MODO_BASE_URL;  // e.g. https://api.modo.com.ar
    const allowedInstallments = [1, 3, 6];

    const body = {
      description: "Compra Gardenlife",
      amount,
      currency: "ARS",
      cc_code: process.env.MODO_CC_CODE,
      processor_code: process.env.MODO_PROCESSOR_CODE,
      external_intention_id: shortId("GL"),
      webhook_notification: process.env.MODO_WEBHOOK_URL,
      allowed_payment_methods: ["CARD","ACCOUNT"],
      allowed_schemes: ["VISA","MASTERCARD"],
      installments: allowedInstallments,

      // trazabilidad MiPyME (opcional)
      ...(mipyme_installments ? {
        installments_detail: {
          plan: "MiPyME",
          quantity: mipyme_installments, // 3 o 6
          option_code: mipyme_code       // 13 o 16
        }
      } : {}),
      ...(mipyme_code ? {
        gateway_extra:   { installments_option: mipyme_code },
        acquirer_extra:  { installments_option: mipyme_code },
        processor_data:  { installments_option: mipyme_code }
      } : {}),

      metadata: {
        draft_id,
        gl_mipyme_qty: mipyme_installments || 0,
        gl_mipyme_option_code: mipyme_code || 0
      }
    };

    if (debug) console.error("[DEBUG][payment-request][REQUEST]", { trace, amount, body });

    const r = await fetch(`${base.replace(/\/+$/,"")}/v2/payment-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": process.env.MODO_USER_AGENT, // usar NOMBRE REAL del comercio
        "Authorization": `Bearer ${token}`,
        "X-Trace-Id": trace,
        "X-Idempotency-Key": shortId("IPK") // evita duplicados si se reintenta la creación
      },
      body: JSON.stringify(body)
    });

    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch(_) { data = { raw: text }; }

    if (debug) console.error("[DEBUG][payment-request][RESPONSE]", { trace, status: r.status, response: data });

    if (!r.ok) {
      return res.status(r.status).json({
        error: "PAYMENT_REQUEST_FAIL",
        status: r.status,
        trace,
        detail: data
      });
    }

    return res.status(200).json({
      trace,
      id: data.id,
      qr: data.qr,
      deeplink: typeof data.deeplink === "string"
        ? data.deeplink
        : (data.deeplink && data.deeplink.url) || null,
      expiration: data.expiration_date || data.expirationDate || data.expiration_at || null,
      created_at: data.created_at || null,
      ...(debug ? { _debug_request: body, _debug_response: data } : {})
    });
  } catch (e) {
    console.error("[MODO][payment-request][ERROR]", { trace, msg: e.message, stack: e.stack });
    return res.status(500).json({ error: "SERVER_ERROR", trace, message: e.message || "Unexpected" });
  }
};

