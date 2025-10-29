export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const amount = url.searchParams.get("amount") || "0";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(`<!doctype html>
<html><head><meta charset="utf-8"><title>MODO Start</title></head>
<body style="font-family:sans-serif;text-align:center;padding:32px">
  <h1>💳 MODO — iniciando pago</h1>
  <p><strong>Monto:</strong> <span id="amt">${amount}</span></p>

  <div id="qr" style="display:inline-block;margin:16px;padding:12px;border:1px solid #eee;border-radius:8px;background:#fff"></div>
  <p id="status">Estado: INIT</p>

  <script>
  (async function(){
    const amount = new URL(location.href).searchParams.get("amount") || "0";
    // 1) Pedimos QR
    const qrRes = await fetch("/api/proxy/qr?amount=" + encodeURIComponent(amount));
    const qr = await qrRes.json();
    if (!qr.ok) { document.getElementById('qr').textContent = "Error cargando QR"; return; }

    // 2) Dibujamos el SVG
    const dataUri = "data:image/svg+xml;base64," + btoa(qr.svg);
    const img = new Image(); img.width = 220; img.height = 220; img.src = dataUri;
    document.getElementById('qr').appendChild(img);

    // 3) Polling de estado
    const $status = document.getElementById('status');
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      const r = await fetch("/api/proxy/status/" + encodeURIComponent(qr.paymentId) + "?mock=1");
      const s = await r.json();
      $status.textContent = "Estado: " + (s.status || "UNKNOWN");
      if (s.status === "APPROVED" || tries > 30) clearInterval(timer);
    }, 2000);
  })();
  </script>
</body></html>`);
}

