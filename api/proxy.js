export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const amount = url.searchParams.get("amount") || "0";

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(`<!doctype html>
<html>
  <head><meta charset="utf-8"><title>MODO Start</title></head>
  <body style="font-family:sans-serif;text-align:center;padding:40px 16px">
    <h1>💳 MODO — iniciando pago</h1>
    <p>Monto: ${amount}</p>
    <p>Todo OK: el proxy está respondiendo ✅</p>
  </body>
</html>`);
}

