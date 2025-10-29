export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const amount = url.searchParams.get("amount") || "0";

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(`<!doctype html>
<html><head><meta charset="utf-8"><title>MODO Start</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; text-align:center; padding:32px; }
  #qr { display:inline-block; margin:16px; padding:12px; border:1px solid #eee; border-radius:8px; background:#fff }
  pre { text-align:left; display:inline-block; padding:12px; border:1px solid #eee; background:#fafafa; border-radius:8px; max-width:90vw; overflow:auto; }
</style>
</head>
<body>
  <h1>💳 MODO — iniciando pago</h1>
  <p><strong>Monto:</strong> <span id="amt">${amount}</span></p>

  <div id="qr">Cargando QR…</div>
  <p id="status">Estado: INIT</p>
  <div id="err" style="color:#b00020"></div>

  <script>
  (async function(){
    const elQR = document.getElementById('qr');
    const elStatus = document.getElementById('status');
    const elErr = document.getElementById('err');
    const logErr = (e) => {
      console.error(e);
      elErr.textContent = 'Error: ' + (e && e.message ? e.message : e);
    };

    try {
      const amount = new URL(location.href).searchParams.get("amount") || "0";

      // 1) Pedir QR al proxy
	const r1 = await fetch("qr?amount=" + encodeURIComponent(amount), { credentials: "omit" });
      if (!r1.ok) throw new Error("QR HTTP " + r1.status);
      const q = await r1.json();
      if (!q.ok) throw new Error("QR payload not ok");
      if (!q.svg || !q.paymentId) throw new Error("QR payload missing svg/paymentId");

      // 2) Renderizar SVG directamente (sin btoa)
      elQR.innerHTML = q.svg;

      // 3) Polling de estado
      let tries = 0;
      const maxTries = 30;
      const timer = setInterval(async () => {
        try {
          tries++;
const r2 = await fetch("status?id=" + encodeURIComponent(q.paymentId) + "&mock=1", { credentials: "omit" });
          if (!r2.ok) throw new Error("Status HTTP " + r2.status);
          const s = await r2.json();
          const st = (s && s.status) || "UNKNOWN";
          elStatus.textContent = "Estado: " + st;

          if (st === "APPROVED") {
            clearInterval(timer);
          } else if (tries >= maxTries) {
            clearInterval(timer);
            elErr.textContent = "Timeout esperando aprobación (mock).";
          }
        } catch (e) {
          logErr(e);
        }
      }, 1500);
    } catch (e) {
      logErr(e);
    }
  })();
  </script>
</body></html>`);
}

