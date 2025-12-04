// /api/sheet.js
// Proxy to Google Apps Script Web App (GAS) for EzMate "users" table.
// Supports: GET (list or by ?email=), POST (upsert), PATCH (emulated via method=PATCH).
// Set env var: GAS_WEB_APP_URL  -> your Apps Script Web App URL (ending in /exec)

const GAS_URL = process.env.GAS_WEB_APP_URL; // e.g. https://script.google.com/macros/s/.../exec

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function buildTargetUrl(req) {
  if (!GAS_URL) throw new Error('GAS_WEB_APP_URL is not set');
  const url = new URL(GAS_URL);
  // Pass through query params (e.g., ?table=users&email=...)
  const q = new URL(req.url, 'http://localhost').searchParams;
  q.forEach((v, k) => url.searchParams.set(k, v));
  // Default table
  if (!url.searchParams.get('table')) url.searchParams.set('table', 'users');
  return url.toString();
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  await new Promise((resolve) => {
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', resolve);
  });
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(204).end();

  let upstreamUrl;
  try {
    upstreamUrl = buildTargetUrl(req);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }

  try {
    const method = req.method.toUpperCase();

    // Emulate PATCH → POST to GAS with method=PATCH&email=...
    if (method === 'PATCH') {
      const u = new URL(upstreamUrl);
      u.searchParams.set('method', 'PATCH');
      // Email must be in query; accept from body if missing
      const bodyObj = await readBody(req);
      if (!u.searchParams.get('email') && bodyObj && bodyObj.email) {
        u.searchParams.set('email', bodyObj.email);
      }
      if (!u.searchParams.get('email')) {
        return res.status(400).json({ ok: false, error: 'PATCH requires ?email=...' });
      }

      const upstream = await fetch(u.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj || {}),
      });

      const text = await upstream.text();
      let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return res.status(upstream.status).json(data);
    }

    // GET → pass-through to GAS (list or by ?email=)
    if (method === 'GET') {
      const upstream = await fetch(upstreamUrl, { method: 'GET' });
      const text = await upstream.text();
      let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return res.status(upstream.status).json(data);
    }

    // POST → upsert array/object to GAS
    if (method === 'POST') {
      const bodyObj = await readBody(req);
      const upstream = await fetch(upstreamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj || {}),
      });
      const text = await upstream.text();
      let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return res.status(upstream.status).json(data);
    }

    res.setHeader('Allow', 'GET, POST, PATCH, OPTIONS');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
