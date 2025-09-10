// /api/modo/token.js
// Genera y cachea el token de MODO por ~7 días (TTL real: 604800 s)

let cache = { token: null, exp: 0 };

export default async function handler(req, res) {
  try {
    const now = Date.now();
    if (cache.token && now < cache.exp) {
      return res.status(200).json({ access_token: cache.token, cached: true });
    }

    const base = process.env.MODO_BASE_URL; // ej: https://merchants.preprod.playdigital.com.ar
    const r = await fetch(`${base}/v2/stores/companies/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': process.env.MODO_USER_AGENT, // OBLIGATORIO
      },
      body: JSON.stringify({
        username: process.env.MODO_USERNAME,
        password: process.env.MODO_PASSWORD,
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({ error: 'TOKEN_FAIL', detail: data });
    }

    // Guardar en cache (TTL 7 días)
    const ttlMs = (Number(data.expires_in || 604800) * 1000) - 60_000; // 1 min colchón
    cache = { token: data.access_token, exp: now + ttlMs };

    return res.status(200).json({ access_token: data.access_token, expires_in: data.expires_in });
  } catch (e) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: e?.message || 'Unexpected' });
  }
}

