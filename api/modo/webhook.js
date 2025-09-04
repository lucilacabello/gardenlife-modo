// /api/modo/webhook.js
// Guardamos estados recientes en memoria (simple). En prod real, usar DB.
const statuses = new Map();

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end();

    // Parse manual para soportar raw body
    const body = req.body || (await new Promise((resolve) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => resolve(data ? JSON.parse(data) : {}));
    }));

    // Ejemplo de campos comunes: id, status, external_intention_id, etc.
    const { id, status } = body || {};
    if (id && status) {
      statuses.set(id, { status, at: Date.now(), body });
    }

    // Siempre responder 200 a webhooks para no reintentar infinito
    return res.status(200).json({ ok: true });
  } catch (e) {
    // No romper el flujo de MODO: devolver 200 aunque no parsee
    return res.status(200).json({ ok: true, note: 'parse-error' });
  }
}

// Export util para el reader
export function __getStatus(id) {
  return statuses.get(id) || null;
}

