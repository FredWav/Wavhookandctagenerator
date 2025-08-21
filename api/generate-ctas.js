// api/generate-ctas.js - Version Corrigée - GPT-4o
const express = require('express');
const router = express.Router();

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o";

// CTAs génériques à éviter absolument
const FORBIDDEN_PATTERNS = [
    "N'oubliez pas de", "Pensez à", "Cliquez sur", "Suivez-moi", 
    "Abonne-toi si", "Laisse un commentaire si", "Like si"
];

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
        const { 
            intent = "follow", 
            platform = "tiktok", 
            tone = "direct",
            constraints = "", 
            count = 20, 
            putaclic = false 
        } = req.body;

        const max = 50;
        const safeCount = Math.min(Math.max(1, count | 0), max);
        
        // SPÉCIFICATIONS PLATEFORMES
        const platformSpecs = {
            tiktok: {
                psychology: "Action immédiate, FOMO, appartenance communauté. Réflexe instantané.",
                language_style: "Très direct, familier, verbes d'action forts. 'Rejoins', 'Chope', 'Teste'.",
                best_practice: "Intégrer dans les 2 dernières secondes, souvent lié à un trend."
            },
            reels: {
                psychology: "Inspiration, utilité, sauvegarde pour plus tard. Valeur ajoutée.",
                language_style: "Aspirationnel et doux. 'Enregistre ce post', 'Partage à un ami'.",
                best_practice: "CTA esthétique et bien intégré, overlay discret."
            },
            shorts: {
                psychology: "Curiosité, binge-watching, abonnement pour ne rien rater. Créer une boucle.",
                language_style: "Clair, concis, orienté bénéfice. 'Abonne-toi pour la partie 2'.",
                best_practice: "CTA très court qui incite à regarder la suite."
            }
        };

        // SPÉCIFICATIONS INTENTIONS (SYNCHRONISÉES AVEC LE FRONT)
        const intentSpecs = {
            follow: {
                goal: "Convertir un spectateur en abonné.",
                trigger: "Promesse de valeur future claire et immédiate.",
                structure: "Abonne-toi pour [BÉNÉFICE CONCRET]"
            },
            comment: {
                goal: "Générer engagement et débat.",
                trigger: "Question ouverte, prise de position, validation sociale.",
                structure: "Dis-moi en commentaire [QUESTION SIMPLE]"
            },
            click: {
                goal: "Diriger le trafic vers une ressource externe.",
                trigger: "Urgence, exclusivité, solution à un problème.",
                structure: "Le lien en bio pour [RÉSULTAT CONCRET]"
            },
            save: {
                goal: "Augmenter le replay value et la considération.",
                trigger: "Utilité, gain de temps, peur de perdre une info précieuse.",
                structure: "Enregistre ce post pour [UTILITÉ FUTURE]"
            },
            dm: {
                goal: "Générer des messages privés pour conversion.",
                trigger: "Personnalisation, exclusivité, aide individuelle.",
                structure: "Écris-moi en DM pour [AIDE PERSONNALISÉE]"
            },
            optin: {
                goal: "Collecter des emails pour nurturing.",
                trigger: "Valeur exclusive, formation gratuite, ressource premium.",
                structure: "Email en bio pour recevoir [RESSOURCE EXCLUSIVE]"
            }
        };

        const currentPlatform = platformSpecs[platform] || platformSpecs.tiktok;
        const currentIntent = intentSpecs[intent] || intentSpecs.follow;

        // RÉSOLUTION DES OPTIONS
        const resolveOptions = () => {
            let intensity = "normale";
            let mode = "balanced";
            let temperature = 0.8; // CORRIGÉ: Augmenté de 0.7 à 0.8

            if (putaclic) {
                mode = "putaclic_extreme";
                intensity = "maximale";
                temperature = 0.95; // CORRIGÉ: Augmenté de 0.9 à 0.95
            }
            return { mode, intensity, temperature };
        };

        const { mode: resolvedMode, intensity, temperature } = resolveOptions();

        // SYSTEM PROMPT OPTIMISÉ
        const systemPrompt = `Tu es une experte en copywriting et marketing de conversion. Ta mission est de créer des Call-to-Actions (CTAs) irrésistibles.

EXPERTISE FONCTIONNELLE:
- Objectif du CTA (${intent}): ${currentIntent.goal}
- Levier psychologique: ${currentIntent.trigger}
- Structure recommandée: ${currentIntent.structure}

EXPERTISE PLATEFORME (${platform.toUpperCase()}):
- Psychologie audience: ${currentPlatform.psychology}
- Style linguistique: ${currentPlatform.language_style}
- Best practice: ${currentPlatform.best_practice}

RÈGLES SYSTÈME ABSOLUES:
- Génère UNIQUEMENT du JSON valide, aucun texte hors JSON
- Tous les CTAs en français, 3-8 mots MAXIMUM
- Chaque CTA doit être percutant et actionnable
- Format de sortie strict respecté`;

        // USER PROMPT INTENSIFIÉ
        let userPrompt = `MISSION (Intensité ${intensity.toUpperCase()}): Créer ${safeCount} CTAs ultra-efficaces.

CONTEXTE:
- Plateforme: ${platform}
- Intention: ${intent}
- Ton: ${tone}
- Contraintes: ${constraints || "Aucune"}

${putaclic ? `
🔥 PUTACLIC EXTRÊME - MODE BRUTAL ACTIVÉ:
• VIOLENCE ÉMOTIONNELLE: 'FAIS-LE MAINTENANT', 'DERNIÈRE CHANCE', 'URGENT'
• MOTS CHOCS OBLIGATOIRES: 'CRITIQUE', 'VITAL', 'MAINTENANT OU JAMAIS'
• AUTORITÉ BRUTALE: Ordonne directement, aucune politesse, impératif sec
• URGENCE DRAMATIQUE: 'Avant qu'il soit trop tard', 'Plus que 24h'
• FOMO EXTRÊME: 'Dernière place', 'Offre expire', 'Ne rate pas ça'
• AUCUNE NUANCE: Sois DIRECTIF, AUTORITAIRE, SANS COMPROMIS
` : `
🎯 MODE ÉQUILIBRÉ (Impact contrôlé):
• BÉNÉFICE CLAIR: Le gain pour l'utilisateur doit être évident
• ACTION SIMPLE: Une seule action, facile à réaliser
• INSPIRANT: Donne envie de passer à l'action
• CRÉDIBLE: Promesses réalistes et atteignables
`}

SPÉCIFICATIONS TECHNIQUES:
- Longueur: 3-8 mots MAXIMUM (CORRIGÉ: plus strict)
- Structure: [VERBE D'ACTION] pour [BÉNÉFICE UTILISATEUR]
- Interdictions: Jamais "${FORBIDDEN_PATTERNS.slice(0, 4).join('", "')}"
- Originalité: Chaque CTA unique et mémorable
- Impact: Émotion immédiate dans les 2 premiers mots

RETOURNE EXACTEMENT:
{
  "ctas": ["cta1", "cta2", ...]
}`;

        // GÉNÉRATION AVEC RETRY INTELLIGENT
        const generate = async (prompt, temp) => {
            return await fetch(OPENAI_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: MODEL,
                    temperature: temp,
                    top_p: 0.9,
                    frequency_penalty: 0.3,
                    presence_penalty: 0.1,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: prompt }
                    ],
                    response_format: { type: "json_object" }
                })
            });
        };

        // Première tentative
        let response = await generate(userPrompt, temperature);

        if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            console.error("OpenAI API Error:", errorText);
            return res.status(500).json({ error: "OpenAI error", details: errorText });
        }

        let data = await response.json();
        let parsed;
        try {
            parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
        } catch {
            parsed = { ctas: [] };
        }

        let initialCtas = Array.isArray(parsed.ctas) ? parsed.ctas : [];
        
        // VALIDATION STRICTE (CORRIGÉE)
        const validatedCtas = initialCtas.filter(cta => {
            if (typeof cta !== 'string') return false;
            const wordCount = cta.trim().split(/\s+/).length;
            const hasForbiddenPattern = FORBIDDEN_PATTERNS.some(p => 
                cta.toLowerCase().includes(p.toLowerCase())
            );
            // CORRIGÉ: 3-8 mots au lieu de 5-15
            return wordCount >= 3 && wordCount <= 8 && !hasForbiddenPattern;
        });

        // SYSTÈME DE RETRY AMÉLIORÉ
        const qualityThreshold = Math.floor(safeCount * (putaclic ? 0.5 : 0.7));
        if (validatedCtas.length < qualityThreshold && safeCount >= 10) {
            console.log(`Qualité insuffisante (${validatedCtas.length}/${safeCount}), retry...`);

            const retryBoost = putaclic ? `
🔥 RETRY PUTACLIC ULTRA-BRUTAL: La génération précédente n'était PAS ASSEZ VIOLENTE.
• TRIPLE l'intensité émotionnelle
• Utilise des mots encore plus CHOQUANTS et AUTORITAIRES  
• Crée plus de PEUR et d'URGENCE DRAMATIQUE
• Sois encore plus BRUTAL et DIRECTIF dans tes ordres
• AUCUNE POLITESSE: Commande, n'invite pas
` : `
🎯 RETRY CRÉATIVITÉ MAXIMALE: La génération précédente était trop générique.
• SOIS PLUS CRÉATIF: Évite les formulations basiques
• CONCENTRE-TOI SUR LE BÉNÉFICE: 'Qu'est-ce que j'y gagne ?'
• RESPECTE 3-8 mots: Concision maximale
• DOUBLE l'originalité et l'impact émotionnel
`;
            
            const retryPrompt = userPrompt + retryBoost;
            const retryResponse = await generate(retryPrompt, Math.min(temperature + 0.1, 1.0));

            if (retryResponse.ok) {
                const retryData = await retryResponse.json();
                try {
                    const retryParsed = JSON.parse(retryData.choices?.[0]?.message?.content || "{}");
                    const retryCtas = Array.isArray(retryParsed.ctas) ? retryParsed.ctas : [];
                    
                    const retryValidated = retryCtas.filter(cta => {
                        if (typeof cta !== 'string') return false;
                        const wordCount = cta.trim().split(/\s+/).length;
                        const hasForbiddenPattern = FORBIDDEN_PATTERNS.some(p => 
                            cta.toLowerCase().includes(p.toLowerCase())
                        );
                        return wordCount >= 3 && wordCount <= 8 && !hasForbiddenPattern;
                    });

                    if (retryValidated.length > validatedCtas.length) {
                        console.log("Retry réussi, nouveaux CTAs utilisés");
                        parsed.ctas = retryValidated;
                    }
                } catch (e) {
                    console.log('Retry parsing failed, keeping original');
                }
            }
        }
        
        // FINALISATION
        let finalCtas = Array.isArray(parsed.ctas) ? parsed.ctas : [];
        finalCtas = finalCtas.filter(cta => {
            if (typeof cta !== 'string') return false;
            const wordCount = cta.trim().split(/\s+/).length;
            return wordCount >= 3 && wordCount <= 8;
        });

        res.json({
            ctas: finalCtas.slice(0, safeCount),
            metadata: {
                platform,
                intent,
                tone,
                mode: resolvedMode,
                intensity,
                requested_count: safeCount,
                generated_count: initialCtas.length,
                validated_count: finalCtas.length,
                quality_score: Math.round((finalCtas.length / Math.max(initialCtas.length, 1)) * 100),
                temperature_used: temperature,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Generate CTAs error:', error);
        res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
});

module.exports = router;
