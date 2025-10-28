// /api/modo/token.js
// Devuelve { access_token, expires_in } desde MODO PROD

function assertEnv() {
  const required = ['MODO_BASE_URL','MODO_USER_AGENT','MODO_USERNAME','MODO_PASSWORD'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) throw new Error(`ENV_MISSING ${missing.join(',')}`);
}

export default async function handler(req, res) {
  try {
    assertEnv();
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }

    const r = await fetch(`${process.env.MODO_BASE_URL}/v2/stores/companies/token`, {
      method: 'POST',
      headers: {
        'User-Agent': process.env.MODO_USER_AGENT,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        username: process.env.MODO_USERNAME,   // ej: GARDENLIFESA-373602-production
        password: process.env.MODO_PASSWORD
      })
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({ error: 'TOKEN_FAIL', detail: data });
    }

    // data: { access_token, expires_in: 604800, ... }
    return res.status(201).json({ access_token: data.access_token, expires_in: data.expires_in });
  } catch (e) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: e?.message || 'Unexpected' });
  }
}
