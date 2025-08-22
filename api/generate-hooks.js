const express = require('express');
const router = express.Router();
const { requireUser } = require('./utils/auth-util');
const pool = require('./db/connection');

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// Déduire le modèle selon le plan utilisateur
function getOpenAIModelForPlan(plan) {
    if (plan === 'pro') return 'gpt-4o';
    if (plan === 'plus') return 'gpt-4o';
    // Par défaut pour free et inconnu
    return 'gpt-4o'; // 'gpt-4o-mini' aprés tests
}

// Anti-patterns à éviter absolument
const CLICHE_PATTERNS = [
    "Découvrez", "Voici", "Dans cette vidéo", "Salut c'est", "Aujourd'hui on va voir",
    "Je vais vous montrer", "Bonjour à tous", "Hey les amis", "Restez jusqu'à la fin",
    "N'oubliez pas de", "Pensez à", "Il faut que", "Vous devez absolument"
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
            platform = "tiktok",
            niche = "",
            theme = "",
            brief = "",
            tone = "direct",
            originalityMode = true,
            putaclic = false,
            countText = 20,
            countVisual = 10
        } = req.body;
        const user = await requireUser(req);

        const MODEL = getOpenAIModelForPlan(user.plan);
        console.log(`Utilisateur plan=${user.plan} utilise modèle ${MODEL}`);

        const maxText = 50;
        const maxVisual = 50;
        const safeText = Math.min(Math.max(1, countText | 0), maxText);
        const safeVisual = Math.min(Math.max(0, countVisual | 0), maxVisual);

        // Contexte enrichi selon la tonalité
        const toneContext = {
            "direct": "Franc, sans détour, promesses concrètes, verbes d'action",
            "autorité": "Expert, crédible, data-driven, référence authority",
            "story": "Narratif, personnel, émotionnel, 'j'ai vécu ça'",
            "humour": "Léger, décalé, auto-dérision, relatabilité fun",
            "urgent": "Temporalité, FOMO, conséquences, 'maintenant ou jamais'"
        };

        // Spécifications plateformes
        const platformSpecs = {
            tiktok: {
                attention_span: "0.5-1.5 secondes",
                language_style: "familier, génération Z, slang ok",
                emotional_triggers: "surprise, contradiction, FOMO, relatabilité",
                format_preference: "POV, storytime, hot takes, tutorials rapides",
                algorithm_bias: "favorise l'engagement immédiat (commentaires, partages)",
                hook_mechanics: "pattern interrupt + promesse concrète + curiosité gap"
            },
            reels: {
                attention_span: "1-3 secondes",
                language_style: "accessible mais soigné, aspirationnel",
                emotional_triggers: "inspiration, transformation, esthétique, lifestyle",
                format_preference: "avant/après, routines, lifestyle, tips esthétiques",
                algorithm_bias: "favorise les saves et partages en story",
                hook_mechanics: "accroche visuelle + bénéfice clair + call to value"
            },
            shorts: {
                attention_span: "1-2 secondes",
                language_style: "éducatif, clair, autorité",
                emotional_triggers: "apprentissage, efficacité, curiosité, résolution",
                format_preference: "tutorials, explications, top lists, mythbusting",
                algorithm_bias: "favorise watch time et abonnements",
                hook_mechanics: "question/problème + solution teaser + bénéfice mesurable"
            }
        };

        const currentPlatform = platformSpecs[platform] || platformSpecs.tiktok;

        // Instructions spécialisées selon les paramètres
        const getModeInstructions = (putaclic, originalityMode) => {
            if (putaclic) {
                return {
                    systemAddition: "Tu es en MODE PUTACLIC EXTRÊME. Tes hooks doivent être VIOLENTS, PERCUTANTS, POLARISANTS. Objectif: choquer, provoquer, créer de l'émotion brutale.",
                    guidelines: [
                        "VIOLENCE ÉMOTIONNELLE MAXIMALE: Utilise peur, colère, frustration, FOMO extrême",
                        "POLARISATION CONTRÔLÉE: Crée du débat, divise, provoque (reste respectueux des personnes)",
                        "MOTS CHOCS OBLIGATOIRES: 'ERREUR FATALE', 'DÉTRUIT', 'RUINE', 'CATASTROPHE', 'JAMAIS', 'TOUJOURS'",
                        "URGENCE BRUTALE: 'MAINTENANT OU JAMAIS', 'DERNIÈRE CHANCE', 'AVANT QU'IL SOIT TROP TARD'",
                        "CHIFFRES CHOCS: Statistics extrêmes, pourcentages dramatiques",
                        "CONTRASTE MAXIMUM: Avant/après dramatique, paradoxes violents",
                        "AUTORITÉ CASSÉE: 'Tout le monde te ment sur X', 'La vérité qu'ils cachent'",
                        "INTERDICTION: Aucune nuance, aucun disclaimer, aucune politesse, sois BRUTAL"
                    ],
                    stylePrinciples: "Patterns à privilégier: '[ERREUR] + [CONSÉQUENCE DRAMATIQUE]', '[AUTORITÉ] + [MENSONGE RÉVÉLÉ]', '[URGENCE] + [PERTE POTENTIELLE]'"
                };
            } else if (originalityMode) {
                return {
                    systemAddition: "Mode créativité maximale: originalité absolue, zéro cliché, formulations révolutionnaires.",
                    guidelines: [
                        `BANNISSEMENT TOTAL: ${CLICHE_PATTERNS.slice(0, 8).join(', ')} et toute variation`,
                        "ORIGINALITÉ FORCÉE: Structures atypiques, angles inattendus, néologismes",
                        "CRÉATIVITÉ LINGUISTIQUE: Tournures modernes, slang générationnel, formulations inédites",
                        "ÉVITE: Toute formulation vue 1000 fois, structures prévisibles, patterns usés"
                    ],
                    stylePrinciples: "Patterns créatifs: '[ANGLE INATTENDU] + [BÉNÉFICE]', '[CONTRADICTION] + [RÉVÉLATION]', '[MÉTAPHORE MODERNE] + [ACTION]'"
                };
            } else {
                return {
                    systemAddition: "Mode équilibré: impact mesuré, professionnalisme créatif.",
                    guidelines: [
                        "Impact contrôlé mais efficace",
                        "Créativité mesurée, respect de l'audience",
                        "Évite les formulations trop banales mais reste accessible"
                    ],
                    stylePrinciples: "Patterns équilibrés: '[PROBLÈME] + [SOLUTION]', '[BÉNÉFICE] + [PREUVE]', '[CURIOSITÉ] + [PROMESSE]'"
                };
            }
        };

        // Résolution des options
        const resolveOptions = () => {
            let intensity = "normale";
            let creativityBoost = 0;
            let mode = "standard";

            // HIÉRARCHIE: Putaclic écrase tout > Originalité > Standard
            if (putaclic) {
                mode = "putaclic_extreme";
                intensity = "maximale";
                creativityBoost = 0.25;
            } else if (originalityMode) {
                mode = "creativity_max";
                intensity = "élevée";
                creativityBoost = 0.15;
            } else {
                mode = "balanced";
                intensity = "normale";
                creativityBoost = 0;
            }

            return { mode, intensity, creativityBoost };
        };

        const { mode: resolvedMode, intensity, creativityBoost } = resolveOptions();
        const modeConfig = getModeInstructions(putaclic, originalityMode);

        // System prompt adapté au mode résolu
        const systemPrompt = `Tu es un expert en création de contenu viral spécialisé en ${platform}.
        
${modeConfig.systemAddition}

EXPERTISE PLATEFORME ${platform.toUpperCase()}:
- Durée d'attention: ${currentPlatform.attention_span}
- Style linguistique: ${currentPlatform.language_style}  
- Triggers émotionnels: ${currentPlatform.emotional_triggers}
- Préférences format: ${currentPlatform.format_preference}
- Biais algorithmique: ${currentPlatform.algorithm_bias}
- Mécanique de hook: ${currentPlatform.hook_mechanics}

RÈGLES SYSTÈME:
- Génère UNIQUEMENT du JSON valide, aucun texte hors JSON
- Hooks de 6-14 mots maximum, français naturel
- Optimise pour les 3 premières secondes d'attention
- Vise l'émotion immédiate selon intensité: ${intensity}

GUIDELINES ${resolvedMode.toUpperCase()}:
${modeConfig.guidelines.map(g => `• ${g}`).join('\n')}

PRINCIPES DE STYLE À SUIVRE:
${modeConfig.stylePrinciples}

ATTENTION: Ne reproduis JAMAIS d'exemples existants. Crée des formulations totalement originales basées sur les principes donnés.`;

        // User prompt contextuel ultra-optimisé
        let userPrompt = `MISSION ${intensity.toUpperCase()}: Créer ${safeText} hooks textuels + ${safeVisual} hooks visuels qui STOPPENT le scroll instantanément sur ${platform}

CONTEXTE STRATÉGIQUE:
🎯 Audience: ${niche || "audience générale"}
📋 Sujet: ${theme || "contenu général"}  
💡 Brief: ${brief || "aucune contrainte particulière"}
🎨 Tonalité ${tone}: ${toneContext[tone] || "Style naturel"}

MODE ACTIVÉ: ${resolvedMode.toUpperCase()} - Intensité ${intensity}

${putaclic ? `
🔥 PUTACLIC EXTRÊME - INSTRUCTIONS BRUTALES:
• PROVOQUE une réaction émotionnelle VIOLENTE en 3 mots
• UTILISE des mots qui CHOQUENT: erreur fatale, détruit, ruine, catastrophe  
• CRÉE de la PEUR: "si tu ne fais pas X, tu vas perdre Y"
• URGENCE BRUTALE: maintenant ou jamais, dernière chance
• CHIFFRES DRAMATIQUES: 90% échouent, 99% ignorent
• AUCUNE NUANCE, AUCUNE POLITESSE: Sois DIRECT et BRUTAL
` : originalityMode ? `
🎯 CRÉATIVITÉ MAXIMALE: Formulations révolutionnaires, zéro cliché toléré
${modeConfig.guidelines.map(g => `• ${g}`).join('\n')}
` : `
🎯 MODE ÉQUILIBRÉ: Impact mesuré, professionnalisme créatif
${modeConfig.guidelines.map(g => `• ${g}`).join('\n')}
`}

ALGORITHME ${platform.toUpperCase()} - OPTIMISATION:
• Fenêtre critique: ${currentPlatform.attention_span}
• Mécaniques gagnantes: ${currentPlatform.hook_mechanics}
• Triggers émotionnels: ${currentPlatform.emotional_triggers}
• Style linguistique: ${currentPlatform.language_style}
• Biais algorithme: ${currentPlatform.algorithm_bias}

SPÉCIFICATIONS HOOKS TEXTUELS (${safeText} unités):
- Longueur: 6-14 mots MAXIMUM
- Impact: Émotion ${intensity} dans les 3 premiers mots
- Structure: [Accroche ${putaclic ? 'VIOLENTE' : 'percutante'}] + [Promesse/Peur] + [Urgence ${putaclic ? 'brutale' : 'subtile'}]
- Français: Naturel, parlé, génération actuelle
- Mécaniques: Pattern interrupt + curiosity gap + tension émotionnelle
- ORIGINALITÉ: Formulations totalement inédites, jamais vues

SPÉCIFICATIONS HOOKS VISUELS (${safeVisual} unités):
Chaque objet contient:
- "shot": Angle/cadrage/mise en scène (4-8 mots précis)
- "overlay": Texte incrusté ${intensity} (3-10 mots percutants)  
- "action": Mouvement/prop/transition (3-8 mots dynamiques)
Calibrés codes visuels ${platform} + mécaniques attention.`;

        // Contexte spécialisé sans exemples dangereux
        if (niche && theme) {
            userPrompt += `\n\nCONTEXTE SPÉCIALISÉ: Adapte tes hooks au thème "${theme}" pour l'audience "${niche}". Utilise leur vocabulaire et leurs pain points spécifiques.`;
        }

        userPrompt += `\n\nRETOURNE EXACTEMENT ce format JSON:
{
  "textHooks": ["hook1", "hook2", ...],
  "visualHooks": [{"shot":"...", "overlay":"...", "action":"..."}, ...]
}`;

        // Température adaptative selon résolution
        let temperature = 0.75 + creativityBoost;
        if (resolvedMode === "putaclic_extreme") temperature = 0.95;
        else if (tone === "urgent") temperature = Math.min(temperature + 0.1, 1.0);

        // Appel API OpenAI
        let response = await fetch(OPENAI_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: MODEL,
                temperature: Math.min(temperature, 1.0),
                top_p: 0.9,
                frequency_penalty: 0.3,
                presence_penalty: 0.1,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                response_format: { type: "json_object" }
            })
        });

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
            parsed = { textHooks: [], visualHooks: [] };
        }

        // Validation et filtrage
        const textHooks = Array.isArray(parsed.textHooks) ? parsed.textHooks : [];
        let filteredHooks = textHooks;

        if (originalityMode && !putaclic) {
            // Mode créativité maximale: filtrage strict
            filteredHooks = textHooks.filter(hook => {
                const lowerHook = hook.toLowerCase();
                const hasCliche = CLICHE_PATTERNS.some(cliche => lowerHook.includes(cliche.toLowerCase()));
                const hasRepetitiveStructure = /^(comment|pourquoi|voici|découvrez)\s/.test(lowerHook);
                return !hasCliche && !hasRepetitiveStructure;
            });
        } else if (putaclic) {
            // Mode putaclic: filtre seulement les clichés mous, garde l'intensité
            filteredHooks = textHooks.filter(hook => {
                const lowerHook = hook.toLowerCase();
                const softCliches = ["découvrez", "voici", "dans cette vidéo", "bonjour à tous", "hey les amis"];
                const hasSoftCliche = softCliches.some(cliche => lowerHook.includes(cliche.toLowerCase()));
                return !hasSoftCliche;
            });
        }

        // Validation longueur optimale (6-14 mots)
        const validatedHooks = filteredHooks.filter(hook => {
            const wordCount = hook.split(/\s+/).length;
            return wordCount >= 6 && wordCount <= 14;
        });

        // Hooks finaux avec fallback intelligent
        let finalHooks = validatedHooks;
        if (validatedHooks.length < Math.floor(safeText * 0.7)) {
            finalHooks = filteredHooks; // Fallback si pas assez de hooks validés
        }

        // Système de retry si qualité insuffisante
        const shouldRetry = (finalCount, targetCount) => {
            if (putaclic) {
                return finalCount < Math.floor(targetCount * 0.4); // Plus tolérant pour putaclic
            } else if (originalityMode) {
                return finalCount < Math.floor(targetCount * 0.6); // Plus exigeant pour créativité
            } else {
                return finalCount < Math.floor(targetCount * 0.5); // Standard
            }
        };

        if (shouldRetry(finalHooks.length, safeText) && safeText >= 10) {
            console.log(`Qualité insuffisante mode ${resolvedMode} (${finalHooks.length}/${safeText}), retry...`);

            // Retry prompt adapté au mode
            let retryBoost = "";
            if (putaclic) {
                retryBoost = `\n\n🔥 RETRY PUTACLIC ULTRA-INTENSIF: La génération précédente n'était PAS ASSEZ VIOLENTE. DOUBLE l'intensité émotionnelle. Utilise des mots encore plus CHOQUANTS. Crée plus de PEUR et d'URGENCE. Sois encore plus BRUTAL et POLARISANT.`;
            } else if (originalityMode) {
                retryBoost = `\n\n🎯 RETRY CRÉATIVITÉ MAXIMALE: La génération précédente contenait trop de clichés. CONCENTRE-TOI sur des formulations RÉVOLUTIONNAIRES. Évite absolument toute formulation banale. Sois INNOVANT dans tes tournures. Crée des structures jamais vues.`;
            } else {
                retryBoost = `\n\n🔄 RETRY OPTIMISÉ: Améliore la créativité et l'impact émotionnel.`;
            }

            const retryPrompt = userPrompt + retryBoost;

            // Paramètres retry adaptés
            let retryTemperature = temperature + 0.1;
            let retryFrequency = 0.4;
            let retryPresence = 0.2;

            if (putaclic) {
                retryTemperature = Math.min(temperature + 0.05, 1.0);
                retryFrequency = 0.3; // Moins de diversité, plus d'intensité
                retryPresence = 0.3;
            } else if (originalityMode) {
                retryTemperature = Math.min(temperature + 0.2, 1.0);
                retryFrequency = 0.5; // Plus de diversité
                retryPresence = 0.4;
            }

            const retryResponse = await fetch(OPENAI_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: MODEL,
                    temperature: retryTemperature,
                    top_p: 0.9,
                    frequency_penalty: retryFrequency,
                    presence_penalty: retryPresence,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: retryPrompt }
                    ],
                    response_format: { type: "json_object" }
                })
            });

            if (retryResponse.ok) {
                const retryData = await retryResponse.json();
                try {
                    const retryParsed = JSON.parse(retryData.choices?.[0]?.message?.content || "{}");
                    const retryTextHooks = Array.isArray(retryParsed.textHooks) ? retryParsed.textHooks : [];

                    // Re-validation adaptée
                    let retryFiltered = retryTextHooks;
                    if (originalityMode && !putaclic) {
                        retryFiltered = retryTextHooks.filter(hook => {
                            const lowerHook = hook.toLowerCase();
                            const hasCliche = CLICHE_PATTERNS.some(cliche =>
                                lowerHook.includes(cliche.toLowerCase())
                            );
                            const hasRepetitiveStructure = /^(comment|pourquoi|voici|découvrez)\s/.test(lowerHook);
                            return !hasCliche && !hasRepetitiveStructure;
                        });
                    } else if (putaclic) {
                        retryFiltered = retryTextHooks.filter(hook => {
                            const lowerHook = hook.toLowerCase();
                            const softCliches = ["découvrez", "voici", "dans cette vidéo", "bonjour à tous"];
                            const hasSoftCliche = softCliches.some(cliche =>
                                lowerHook.includes(cliche.toLowerCase())
                            );
                            return !hasSoftCliche;
                        });
                    }

                    const retryValidated = retryFiltered.filter(hook => {
                        const wordCount = hook.split(/\s+/).length;
                        return wordCount >= 6 && wordCount <= 14;
                    });

                    // Si le retry est meilleur, on l'utilise
                    if (retryValidated.length > finalHooks.length) {
                        finalHooks = retryValidated;
                        parsed.visualHooks = retryParsed.visualHooks || parsed.visualHooks;
                    }
                } catch (e) {
                    console.log('Retry parsing failed, keeping original');
                }
            }
        }

        try {
            const connection = await pool.getConnection();
            try {
                const historyData = {
                    platform,
                    niche: niche || null,
                    theme: theme || null,
                    brief: brief || null,
                    tone,
                    originalityMode,
                    putaclic,
                    countText: safeText,
                    countVisual: safeVisual,
                    textHooks: finalHooks.slice(0, safeText),
                    visualHooks: (Array.isArray(parsed.visualHooks) ? parsed.visualHooks : []).slice(0, safeVisual)
                };

                await connection.execute(`
      INSERT INTO user_history (user_id, type, theme, platform, tone, niche, brief, results)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
                    user.id,
                    'hooks',
                    theme || 'Hooks généraux',
                    platform,
                    tone,
                    niche || null,
                    brief || null,
                    JSON.stringify(historyData)
                ]);

                // Nettoyage automatique pour les comptes gratuits
                if (user.plan !== 'pro') {
                    await connection.execute(`
        DELETE FROM user_history 
        WHERE user_id = ? 
        AND id NOT IN (
          SELECT id FROM (
            SELECT id FROM user_history 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 30
          ) AS recent
        )
      `, [user.id, user.id]);
                }

                console.log('✅ Hooks sauvegardés dans l\'historique utilisateur');
            } finally {
                connection.release();
            }
        } catch (historyError) {
            console.error('❌ Erreur sauvegarde historique:', historyError);
        }

        // RÉPONSE FINALE
        res.json({
            ok: true, // ← Ajouter cette propriété pour cohérence avec CTAs
            textHooks: finalHooks.slice(0, safeText),
            visualHooks: (Array.isArray(parsed.visualHooks) ? parsed.visualHooks : []).slice(0, safeVisual),
            metadata: {
                platform,
                mode: resolvedMode,
                intensity,
                putaclic,
                originalityMode,
                generated_count: textHooks.length,
                filtered_count: textHooks.length - filteredHooks.length,
                validated_count: finalHooks.length,
                quality_score: Math.round((finalHooks.length / Math.max(textHooks.length, 1)) * 100),
                temperature_used: temperature,
                conflict_resolution: resolvedMode !== "balanced" ? `Résolu en mode ${resolvedMode}` : "Aucun conflit",
                user_plan: user.plan, // ← Ajouter cette info
                timestamp: new Date().toISOString()
            },
            message: `${finalHooks.length} hooks générés avec succès` // ← Ajouter message de succès
        });

    } catch (error) {
        console.error('Generate hooks error:', error);

        if (error.message && error.message.includes('Not authenticated')) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        return res.status(500).json({
            error: 'Erreur serveur',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
        });
    }

});

module.exports = router;
