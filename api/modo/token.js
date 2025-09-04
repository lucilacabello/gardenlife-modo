// /api/modo/token.js
let cache = { token: null, exp: 0 }; // cache simple en memoria (se reinicia por deploy)

export default async function handler(req, res) {
  try {
    const now = Date.now();
    if (cache.token && now < cache.exp) {
      return res.status(200).json({ access_token: cache.token, cached: true });
    }

    const r = await fetch(process.env.MODO_BASE_URL + '/v2/stores/companies/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': process.env.MODO_USER_AGENT
      },
      body: JSON.stringify({
        username: process.env.MODO_USERNAME,
        password: process.env.MODO_PASSWORD
      })
    });

    // Si falla, devolveme texto para ver el error real
    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).json({ error: 'TOKEN_FAIL', detail: txt });
    }

    const j = await r.json(); // { access_token, token_type, expires_in }
    // El manual indica expires_in ~ 604800s (7 días). Cacheo 6 días para evitar borde.
    cache.token = j.access_token;
    cache.exp = now + 6 * 24 * 60 * 60 * 1000;

    return res.status(200).json({ access_token: cache.token, cached: false });
  } catch (e) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: e?.message || 'Unexpected' });
  }
}

