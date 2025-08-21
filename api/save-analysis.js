// api/save-analysis.js
const express = require('express');
const router = express.Router();

function corsHeaders(res) {
    res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
}

router.options('/', (req, res) => {
    corsHeaders(res);
    res.status(200).end();
});

router.post('/', async (req, res) => {
    corsHeaders(res);
    
    try {
        const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL || '';
        if (!SHEETS_WEBHOOK_URL) {
            return res.status(500).json({ error: 'SHEETS_WEBHOOK_URL manquante' });
        }

        const payload = {
            record: req.body.record || null,
            retentionPoints: Array.isArray(req.body.retentionPoints) ? req.body.retentionPoints : []
        };

        const response = await fetch(SHEETS_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();

        if (!response.ok) {
            return res.status(502).json({ error: 'Sheets webhook a échoué', details: responseText });
        }

        res.status(200).json({ success: true, sheetsResponse: responseText });

    } catch (error) {
        console.error('save-analysis error', error);
        res.status(500).json({ error: 'Erreur lors de la sauvegarde' });
    }
});

module.exports = router;
