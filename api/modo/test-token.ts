export default async function handler(req: any, res: any) {
  try {
    const r = await fetch(`${process.env.MODO_BASE_URL}/v2/stores/companies/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Gardenlife-Check" },
      body: JSON.stringify({
        username: process.env.MODO_USERNAME,
        password: process.env.MODO_PASSWORD,
      }),
    });
    const text = await r.text(); // evitamos crash por JSON inválido
    return res.status(r.ok ? 200 : 500).json({ ok: r.ok, status: r.status, body: text });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
