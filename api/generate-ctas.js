// api/generate-ctas.js
const express = require('express');
const router = express.Router();

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

function corsHeaders(res) {
    const origin = process.env.CORS_ORIGIN || "*";
    res.set({
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
}

router.options('/', (req, res) => {
    corsHeaders(res);
    res.json({ ok: true });
});

router.post('/', async (req, res) => {
    corsHeaders(res);
    
    try {
        const { intent = "follow", platform = "tiktok", tone = "direct",
                constraints = "", count = 20, putaclic = false } = req.body;

        const max = putaclic ? 50 : 50;
        const qty = Math.min(Math.max(1, count | 0), max);

        const sys = [
            "Tu génères des CTAs courts et actionnables, adaptés par plateforme.",
            "Toujours en français. 1 ligne par CTA. Pas de hashtags, pas d'émojis excessifs.",
            "Réponse STRICTEMENT en JSON valide, sans texte hors JSON."
        ].join(" ");

        const platformHints = {
            tiktok: "accent sur l'action immédiate, langage parlé, 0-1s d'ancrage",
            reels: "call to action clair, doux, intégré au visuel clean",
            shorts: "CTA tranchant, concis, orienté curiosité/répétition"
        }[platform] || "CTA clair et concret";

        const putaclicBoost = putaclic
            ? "Augmente l'intensité, propose des formulations plus polarisantes mais non insultantes."
            : "Reste ferme mais respectueux.";

        const userPrompt = `
Objectif CTA: ${intent}
Plateforme: ${platform} (${platformHints})
Ton: ${tone}
Contexte: ${constraints || "N/A"}
${putaclicBoost}

Génère EXACTEMENT ${qty} CTAs, 5-12 mots, zero fluff, pas de 'abonne-toi si...', préfère 'Abonne-toi pour… [bénéfice concret]'.

Renvoie UNIQUEMENT ce JSON:
{ "ctas": ["..."] }
        `.trim();

        const response = await fetch(OPENAI_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: MODEL,
                temperature: putaclic ? 0.85 : 0.65,
                messages: [
                    { role: "system", content: sys },
                    { role: "user", content: userPrompt }
                ],
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            return res.status(500).json({ error: "OpenAI error", details: errorText });
        }

        const data = await response.json();
        let parsed;
        try {
            parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
        } catch {
            parsed = { ctas: [] };
        }

        res.json({ ctas: Array.isArray(parsed.ctas) ? parsed.ctas : [] });

    } catch (error) {
        console.error('Generate CTAs error:', error);
        res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
});

module.exports = router;
