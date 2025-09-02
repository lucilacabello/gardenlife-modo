// /api/modo/qr.ts

type ModoTokenResp = { token?: string; access_token?: string };
type ModoQrResp = {
  paymentId?: string;
  qrBase64?: string;
  expiresAt?: string | null;
  [k: string]: unknown;
};

function allowCors(res: any) {
  const origin = `https://${process.env.SHOP_DOMAIN}`;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    allowCors(res);
    return res.status(200).end();
  }

  allowCors(res);

  try {
    const amountParam = req.query?.amount ?? req.body?.amount;
    const amount = Number(amountParam);
    if (!(amount >= 0.01) || Number.isNaN(amount)) {
      return res.status(400).json({ error: "INVALID_AMOUNT", detail: amountParam });
    }

    // --- MODO MOCK: para pruebas desde la tienda sin credenciales reales ---
    if (req.query?.mock === "1") {
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>
        <rect width='200' height='200' fill='#EEEEEE'/>
        <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='14' fill='#333'>MOCK QR</text>
      </svg>`;
      const qrBase64 = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
      return res.status(200).json({
        paymentId: "MOCK-PAYMENT-123",
        qrBase64,
        expiresAt: null,
      });
    }
    // ----------------------------------------------------------------------

    // 1) Obtener TOKEN
    const tRes = await fetch(`${process.env.MODO_BASE_URL}/v2/stores/companies/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Gardenlife-Checkout",
      },
      body: JSON.stringify({
        username: process.env.MODO_USERNAME,
        password: process.env.MODO_PASSWORD,
      }),
    });

    if (!tRes.ok) {
      const txt = await tRes.text().catch(() => "");
      console.error("TOKEN_FAIL", tRes.status, txt);
      return res.status(502).json({ error: "TOKEN_FAIL", status: tRes.status, detail: txt });
    }

    const tJson = (await tRes.json()) as ModoTokenResp;
    const token = tJson.token || tJson.access_token;
    if (!token) {
      console.error("TOKEN_EMPTY", tJson);
      return res.status(502).json({ error: "TOKEN_EMPTY", detail: tJson });
    }

    // 2) Crear pago QR (ajustar según contrato/endpoint real)
    const qRes = await fetch(`${process.env.MODO_BASE_URL}/v2/payments/qr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // centavos
        currency: "ARS",
        description: "Checkout Gardenlife",
        // callbackUrls, processorCode, etc. si MODO lo pide
      }),
    });

    const qJson = (await qRes.json().catch(() => ({}))) as ModoQrResp;

    if (!qRes.ok || !qJson?.qrBase64 || !qJson?.paymentId) {
      console.error("QR_FAIL", qRes.status, qJson);
      return res.status(502).json({ error: "QR_FAIL", status: qRes.status, detail: qJson });
    }

    return res.status(200).json({
      paymentId: qJson.paymentId,
      qrBase64: qJson.qrBase64,
      expiresAt: qJson.expiresAt ?? null,
    });
  } catch (err: any) {
    console.error("UNEXPECTED_QR", err);
    return res.status(500).json({ error: "UNEXPECTED_QR", detail: String(err?.message || err) });
  }
}

