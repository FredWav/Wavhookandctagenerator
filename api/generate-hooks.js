// api/generate-hooks.js
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
        const { platform = "tiktok", niche = "", theme = "", brief = "", tone = "direct",
                antiBateau = true, putaclic = false, countText = 20, countVisual = 10 } = req.body;

        const maxText = putaclic ? 50 : 50;
        const maxVisual = putaclic ? 50 : 50;
        const safeText = Math.min(Math.max(0, countText | 0), maxText);
        const safeVisual = Math.min(Math.max(0, countVisual | 0), maxVisual);

        const sys = [
            "Tu es un générateur de hooks ultra-efficaces, calibrés par plateforme.",
            "Tu renvoies STRICTEMENT du JSON valide, rien d'autre.",
            "Interdiction d'ajouter une phrase hors JSON.",
            "Évite absolument les formulations banales ('Découvrez', 'Voici', 'Dans cette vidéo').",
            "Respecte la quantité demandée exactement."
        ].join(" ");

        const platformBias = {
            tiktok: "rythme très rapide, pattern interrupt immédiat (0-1s), promesse concrète, conflit léger ok",
            reels: "esthétique + rythme soutenu, clarté, bénéfice concret, style 'clean'",
            shorts: "promesse choc + curiosité, cut rapides, structure 'setup→contradiction→benefit'"
        }[platform] || "rythme rapide, bénéfice concret";

        const putaclicBoost = putaclic ? [
            "Amplifie le contraste (surprise, chiffre inattendu, contre-intuition).",
            "Autorise la polarisation contrôlée sans dérive irrespectueuse.",
            "Concis, percutant, aucun flou, aucun disclaimer."
        ].join(" ") : "Reste impactant mais responsable.";

        const antiFluff = antiBateau ? "Interdiction des platitudes, pas de 'regarde jusqu'à la fin', pas de 'astuces' génériques." : "";

        const visualSpec = "Les hooks visuels sont des objets avec: 'shot' (mise en scène), 'overlay' (texte écran), 'action' (mouvement/prop), adaptés à la plateforme, 3-10 mots par champ.";

        const userPrompt = `
Plateforme: ${platform}. Règles spécifiques: ${platformBias}.
Niche/audience: ${niche}.
Thème/sujet: ${theme}.
Contexte: ${brief || "N/A"}.
Ton: ${tone}.
${putaclicBoost}
${antiFluff}

Génère:
- EXACTEMENT ${safeText} hooks textuels (français), 7-14 mots, promesse claire, pas de ponctuation excessive, pas de hashtags.
- EXACTEMENT ${safeVisual} hooks visuels (objets {shot, overlay, action}).

${visualSpec}

Rends UNIQUEMENT ce JSON:
{
  "textHooks": ["..."],
  "visualHooks": [{"shot":"...", "overlay":"...", "action":"..."}]
}
        `.trim();

        const response = await fetch(OPENAI_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: MODEL,
                temperature: putaclic ? 0.9 : 0.7,
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
            parsed = { textHooks: [], visualHooks: [] };
        }

        res.json({
            textHooks: Array.isArray(parsed.textHooks) ? parsed.textHooks : [],
            visualHooks: Array.isArray(parsed.visualHooks) ? parsed.visualHooks : []
        });

    } catch (error) {
        console.error('Generate hooks error:', error);
        res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
});

module.exports = router;
