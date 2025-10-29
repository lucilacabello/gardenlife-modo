export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const id = url.searchParams.get("id") || "unknown";
  const mock = url.searchParams.get("mock");

  // Mock: si viene mock=1, respondemos APPROVED, sino PENDING
  const status = mock === "1" ? "APPROVED" : "PENDING";
  res.status(200).json({ ok: true, id, status });
}

