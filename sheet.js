// /api/sheet.js
// Tiny serverless proxy to forward JSON rows to SheetBest.
// Avoids CORS/403 by sending from your own domain (Vercel).
//
// Frontend: fetch('/api/sheet', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(row) })
//
// Optional: You can override the URL via an environment variable SHEETBEST_URL in Vercel.

const SHEETBEST_URL =
  process.env.SHEETBEST_URL ||
  'https://api.sheetbest.com/sheets/578f6242-bd5a-4373-8096-2a7c7c6bae62';

// Basic CORS helper (safe even if same-origin; helps with tools or previews)
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  setCors(res);

  // Handle preflight quickly
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    // Ensure we have the body as an object or stringified JSON
    let incoming = req.body;

    // If body is empty and not parsed (e.g., raw stream), read it
    if (
      incoming == null ||
      (typeof incoming === 'string' && incoming.trim().length === 0)
    ) {
      let raw = '';
      await new Promise((resolve) => {
        req.on('data', (chunk) => (raw += chunk));
        req.on('end', resolve);
      });
      incoming = raw ? JSON.parse(raw) : {};
    }

    // Accept either a single object or an array of objects
    const payload =
      typeof incoming === 'string' ? incoming : JSON.stringify(incoming);

    const upstream = await fetch(SHEETBEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // If you ever add a SheetBest key, pass it like:
        // 'X-API-KEY': process.env.SHEETBEST_KEY
      },
      body: payload,
    });

    const text = await upstream.text();
    // Try to parse JSON but don't break if it isn't
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
