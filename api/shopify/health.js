export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    where: "api/shopify/health",
    time: Date.now(),
  });
}
