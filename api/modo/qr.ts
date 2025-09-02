export default async function handler(req, res) {
  // CORS (checkout real)
  const origin = `https://${process.env.SHOP_DOMAIN}`;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const amountParam = req.query.amount ?? req.body?.amount;
    const amount = Number(amountParam);
    if (!amount || Number.isNaN(amount)) {
      return res.status(400).json({ error: 'INVALID_AMOUNT', detail: amountParam });
    }

    // 1) TOKEN
    const tRes = await fetch(`${process.env.MODO_BASE_URL}/v2/stores/companies/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Gardenlife-Checkout' },
      body: JSON.stringify({
        username: process.env.MODO_USERNAME,
        password: process.env.MODO_PASSWORD
      })
    });

    if (!tRes.ok) {
      const txt = await tRes.text();
      console.error('TOKEN_FAIL', tRes.status, txt);
      return res.status(502).json({ error: 'TOKEN_FAIL', status: tRes.status, detail: txt });
    }
    const tJson = await tRes.json();
    const token = tJson.token || tJson.access_token;

    // 2) CREAR QR (ajustá el endpoint/shape si tu contrato difiere)
    const qRes = await fetch(`${process.env.MODO_BASE_URL}/v2/payments/qr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // centavos si aplica
        currency: 'ARS',
        description: 'Checkout Gardenlife',
      })
    });

    const qJson = await qRes.json().catch(() => ({}));

    if (!qRes.ok || !qJson?.qrBase64 || !qJson?.paymentId) {
      console.error('QR_FAIL', qRes.status, qJson);
      return res.status(502).json({ error: 'QR_FAIL', status: qRes.status, detail: qJson });

