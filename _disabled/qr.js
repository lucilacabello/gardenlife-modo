export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const amount = url.searchParams.get("amount") || "0";
  const paymentId = `mp_${Date.now().toString(36)}`;

  // SVG placeholder de QR (mock)
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220">
  <rect width="220" height="220" fill="#fff"/>
  <rect x="10" y="10" width="60" height="60" fill="#000"/>
  <rect x="150" y="10" width="60" height="60" fill="#000"/>
  <rect x="10" y="150" width="60" height="60" fill="#000"/>
  <text x="110" y="115" font-size="12" text-anchor="middle" fill="#000">MODO ${amount}</text>
</svg>`.trim();

  res.status(200).json({ ok: true, paymentId, svg });
}

