// Email subscription endpoint
// v0: just logs to Vercel function logs (acceptable for first 100 signups)
// v1: will integrate with MailerLite API later this week

module.exports = async (req, res) => {
  // CORS for safety (same-origin in production but useful for local dev)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const email = (body.email || '').trim().toLowerCase();

    // Basic validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    if (email.length > 254) {
      return res.status(400).json({ error: 'Email too long' });
    }

    // Log to Vercel function logs (visible in dashboard)
    // We'll wire MailerLite/Resend in v1
    console.log(JSON.stringify({
      event: 'email_subscribe',
      email,
      ip: req.headers['x-forwarded-for'] || 'unknown',
      ua: (req.headers['user-agent'] || '').slice(0, 200),
      timestamp: new Date().toISOString()
    }));

    return res.status(200).json({ ok: true, message: 'Subscribed' });
  } catch (err) {
    console.error('subscribe error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
};
