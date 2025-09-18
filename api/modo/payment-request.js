// /api/modo/payment-request.js
// Crea la intención de pago y devuelve { id, qr, deeplink, expiration }

import crypto from "crypto";

function shortId(prefix = "GL") {
  const rand = crypto.randomBytes(8).toString("hex"); // 16 chars
  const ts = Date.now().toString(36);                 // 8-10 chars
  const id = `${prefix}-${ts}-${rand}`;
  return id.slice(0, 39); // siempre <= 39
}

function getBaseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL; // ej: https://gardenlife-modo.vercel.app
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  return `${proto}://${host}`;
}

let CACHED_TOKEN = null;
let CACHED_TOKEN_EXP = 0;

async function getToken(req) {
  if (CACHED_TOKEN && Date.now() < CACHED_TOKEN_EXP) return CACHED_TOKEN;
  const base = getBaseUrl(req);
  const r = await fetch(`${base}/api/modo/token`, { method: "POST" });
  if (!r.ok) throw new Error(`TOKEN_FAIL ${r.status}`);
  const j = await r.json();
  CACHED_TOKEN = j.access_token;
  CACHED_TOKEN_EXP = Date.now() + 6 * 60 * 60 * 1000; // 6h de margen
  return CACHED_TOKEN;
}

const normalizeAmount = (v) => {
  if (typeof v === "string") v = v.replace(",", ".");
  const n = Number(v);
  // devolvemos number con 2 decimales (para logs/cálculos internos)
  return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : 0;
};

function assertEnv() {
  const required = [
    "MODO_BASE_URL",
    "MODO_CC_CODE",
    "MODO_PROCESSOR_CODE",
    "MODO_USER_AGENT",
    "MODO_WEBHOOK_URL",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`ENV_MISSING ${missing.join(",")}`);
}

export default async function handler(req, res) {
  const debug = req.query?.debug === "1" || req.body?.debug === 1;
  const trace = `TRACE-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  try {
    assertEnv();

    const method = req.method || "GET";
    const raw =
      method === "POST"
        ? req.body?.amount ?? req.query?.amount
        : req.query?.amount;

    const amountNum = normalizeAmount(raw);
    if (amountNum <= 0) {
      return res
        .status(400)
        .json({ error: "INVALID_AMOUNT", detail: String(raw) });
    }

    // El gateway espera "589.00" (string con 2 decimales), no 589 ni 5.89 ni 10
    const amountStr = amountNum.toFixed(2);

    const token = await getToken(req);
    const base = process.env.MODO_BASE_URL;

    const body = {
      description: "Compra Gardenlife",
      amount: amountStr, // <-- FIX: string con 2 decimales
      currency: "ARS",
      cc_code: process.env.MODO_CC_CODE,
      processor_code: process.env.MODO_PROCESSOR_CODE,
      external_intention_id: shortId(), // siempre <=39
      webhook_notification: process.env.MODO_WEBHOOK_URL,
      // Habilitar tarjetas + cuotas
      allowed_payment_methods: ["CARD", "ACCOUNT"],
      allowed_schemes: ["VISA", "MASTERCARD", "AMEX"],
      installments: [1, 3, 6, 12],
      // Evitar expiraciones cortas en pruebas
      expiration_date: new Date(Date.now() + 9 * 60 * 1000).toISOString(),
    };

    const r = await fetch(`${base}/v2/payment-requests/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": process.env.MODO_USER_AGENT,
        Authorization: `Bearer ${token}`,
        "X-Trace-Id": trace,
      },
      body: JSON.stringify(body),
    });

    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (debug) {
      console.error("[MODO][payment-request]", {
        trace,
        status: r.status,
        sent_amount_num: amountNum,
        sent_amount_str: amountStr,
        request_body: body,
        response: data,
      });
    }

    if (!r.ok) {
      return res.status(r.status).json({
        error: "PAYMENT_REQUEST_FAIL",
        status: r.status,
        trace,
        detail: data,
      });
    }

    return res.status(200).json({
      trace,
      id: data.id,
      qr: data.qr,
      deeplink:
        typeof data.deeplink === "string"
          ? data.deeplink
          : data.deeplink?.url || null,
      expiration:
        data.expiration_date ||
        data.expirationDate ||
        data.expiration_at ||
        null,
      created_at: data.created_at || null,
      ...(debug ? { _debug_request: body, _debug_response: data } : {}),
    });
  } catch (e) {
    console.error("[MODO][payment-request][ERROR]", {
      trace,
      msg: e?.message,
      stack: e?.stack,
    });
    return res.status(500).json({
      error: "SERVER_ERROR",
      trace,
      message: e?.message || "Unexpected",
    });
  }
}
