// /api/save-analysis.js
// Reçoit { record, retentionPoints? } et forwarde vers Google Apps Script (Google Sheets).
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  let body = req.body;
  if (!body && req.headers['content-type']?.includes('application/json')) {
    try {
      const raw = await new Promise((resolve, reject) => {
        let data=''; req.on('data',c=>data+=c); req.on('end',()=>resolve(data)); req.on('error',reject);
      });
      body = raw ? JSON.parse(raw) : {};
    } catch { return res.status(400).json({ error:'JSON invalide' }); }
  }

  const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL || '';
  if (!SHEETS_WEBHOOK_URL) return res.status(500).json({ error: 'SHEETS_WEBHOOK_URL manquante' });

  const payload = {
    record: body.record || null,
    retentionPoints: Array.isArray(body.retentionPoints) ? body.retentionPoints : []
  };

  try {
    const resp = await fetch(SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const txt = await resp.text();
    if (!resp.ok) {
      return res.status(502).json({ error: 'Sheets webhook a échoué', details: txt });
    }
    return res.status(200).json({ success: true, sheetsResponse: txt });
  } catch (e) {
    console.error('save-analysis error', e);
    return res.status(500).json({ error: 'Erreur lors de la sauvegarde' });
  }
}
