// Vercel serverless function: POST /api/chat
const { handleChat } = require('./_raya.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const { status, json } = await handleChat(req.body || {}, process.env);
  return res.status(status).json(json);
};
