
export default async function handler(req, res) {
  const { slug = [] } = req.query;

  // --- Health check ---
  if (slug[0] === "health") {
    return res.status(200).json({ ok: true, msg: "Health OK (proxy)", time: Date.now() });
  }

  // --- Start page ---
  if (slug[0] === "start.html") {
    const amount = req.query.amount || "0";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(`
<!doctype html>
<html>
  <head><meta charset="utf-8"><title>MODO Start</title></head>
  <body style="font-family:sans-serif;text-align:center;padding-top:40px">
    <h1>💳 MODO — iniciando pago</h1>
    <p>Monto: ${amount}</p>
    <p>Todo OK: el proxy está respondiendo ✅</p>
  </body>
</html>
`);
  }

  // --- Fallback ---
  return res.status(404).json({ error: "NOT_FOUND", slug });
}

