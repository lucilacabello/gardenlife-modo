// /api/modo/status/[id].js
import { __getStatus } from '../webhook';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { id } = req.query || {};
  const s = __getStatus(id);
  return res.status(200).json({ id, ...(s || { status: 'PENDING' }) });
}

