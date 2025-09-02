// /api/modo/status/[id].ts

type ModoStatusResp = {
  status?: "APPROVED" | "PENDING" | "REJECTED" | "EXPIRED" | string;
  [k: string]: unknown;
};

function allowCors(res: any) {
  const origin = `https://${process.env.SHOP_DOMAIN}`;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    allowCors(res);
    return res.status(200).end();
  }

  allowCors(res);

  const { id } = req.query || {};
  if (!id) return res.status(400).json({ error: "MISSING_ID" });

  try {
    // 1) Token
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
      console.error("TOKEN_FAIL_STATUS", tRes.status, txt);
      return res.status(502).json({ error: "TOKEN_FAIL", status: tRes.status, detail: txt });
    }

    const { token } = (await tRes.json()) as { token?: string };
    if (!token) return res.status(502).json({ error: "TOKEN_EMPTY" });

    // 2) Consultar estado
    const sRes = await fetch(`${process.env.MODO_BASE_URL}/v2/payments/${id}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const sJson = (await sRes.json().catch(() => ({}))) as ModoStatusResp;

    if (!sRes.ok) {
      console.error("STATUS_FAIL", sRes.status, sJson);
      return res.status(502).json({ error: "STATUS_FAIL", status: sRes.status, detail: sJson });
    }

    // Esperado: { status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'EXPIRED' }
    return res.status(200).json(sJson);
  } catch (err: any) {
    console.error("UNEXPECTED_STATUS", err);
    return res.status(500).json({ error: "UNEXPECTED_STATUS", detail: String(err?.message || err) });
  }
}
