// /api/modo/qr.ts

type ModoTokenResp = { token?: string; access_token?: string };
type ModoQrResp = {
  paymentId?: string;
  qrBase64?: string;
  expiresAt?: string | null;
  // otros campos posibles...
  [k: string]: unknown;
};

function allowCors(res: any) {
  const origin = `https://${process.env.SHOP_DOMAIN}`;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
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
    if (!amount || Number.isNaN(amount)) {
      return res.status(400).json({ error: "INVALID_AMOUNT", detail: amountParam });
    }

    // 1) Obtener TOKEN
    const tRes = await fetch(`${process.env.MODO_BASE_URL}/v2/stores/companies/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Gardenlife-Checkout",
      },
      body: JSON.stringify({
        username: process.env.MODO_USERNAME, // "PLAYDIGITAL SA-318979-preprod"
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

    // 2) Crear pago QR (ajustar payload si tu contrato difiere)
    const qRes = await fetch(`${process.env.MODO_BASE_URL}/v2/payments/qr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // en centavos si aplica
        currency: "ARS",
        description: "Checkout Gardenlife",
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


