// analyze-video.js - Enhanced avec le framework d'analyse TikTok complet
export const config = { runtime: "edge" };

// Fonction pour parser les données JSON cachées dans le HTML
function findJsonBlob(html) {
    try {
        // Plan A: SIGI_STATE (ancienne méthode)
        let scriptContent = html.split('<script id="SIGI_STATE" type="application/json">')[1]?.split('</script>')[0];
        if (scriptContent) {
            console.log("✅ Données trouvées via SIGI_STATE");
            return JSON.parse(scriptContent);
        }
        
        // Plan B: __UNIVERSAL_DATA_FOR_REHYDRATION__ (nouvelle méthode)
        scriptContent = html.split('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">')[1]?.split('</script>')[0];
        if (scriptContent) {
            console.log("✅ Données trouvées via __UNIVERSAL_DATA_FOR_REHYDRATION__");
            return JSON.parse(scriptContent);
        }
        
        // Plan C: window.__INITIAL_STATE__ (fallback)
        const initialStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/s);
        if (initialStateMatch) {
            console.log("✅ Données trouvées via __INITIAL_STATE__");
            return JSON.parse(initialStateMatch[1]);
        }
        
        console.warn("⚠️ Aucun blob JSON principal trouvé");
        return null;
        
    } catch (error) {
        console.error("❌ Erreur lors du parsing JSON:", error.message);
        return null;
    }
}

// Fonction pour extraire les stats depuis différentes structures de données
function extractStats(data) {
    try {
        // Structure SIGI_STATE
        if (data.ItemModule) {
            const videoId = Object.keys(data.ItemModule)[0];
            const itemStruct = data.ItemModule[videoId];
            if (itemStruct?.stats) {
                return {
                    views: parseInt(itemStruct.stats.playCount) || 0,
                    likes: parseInt(itemStruct.stats.diggCount) || 0,
                    comments: parseInt(itemStruct.stats.commentCount) || 0,
                    shares: parseInt(itemStruct.stats.shareCount) || 0,
                    duration: itemStruct.video?.duration || null,
                    description: itemStruct.desc || null,
                    author: itemStruct.author?.uniqueId || null,
                    music: itemStruct.music?.title || null,
                    hashtags: itemStruct.textExtra?.map(tag => tag.hashtagName).filter(Boolean) || []
                };
            }
        }
        
        // Structure __UNIVERSAL_DATA_FOR_REHYDRATION__
        if (data['__DEFAULT_SCOPE__']?.['webapp.video-detail']?.itemInfo?.itemStruct) {
            const itemStruct = data['__DEFAULT_SCOPE__']['webapp.video-detail'].itemInfo.itemStruct;
            if (itemStruct.stats) {
                return {
                    views: parseInt(itemStruct.stats.playCount) || 0,
                    likes: parseInt(itemStruct.stats.diggCount) || 0,
                    comments: parseInt(itemStruct.stats.commentCount) || 0,
                    shares: parseInt(itemStruct.stats.shareCount) || 0,
                    duration: itemStruct.video?.duration || null,
                    description: itemStruct.desc || null,
                    author: itemStruct.author?.uniqueId || null,
                    music: itemStruct.music?.title || null,
                    hashtags: itemStruct.textExtra?.map(tag => tag.hashtagName).filter(Boolean) || []
                };
            }
        }
        
        return null;
    } catch (error) {
        console.error("❌ Erreur extraction stats:", error.message);
        return null;
    }
}

// Calcul des métriques selon le guide d'analyse
function calculateMetrics(stats) {
    if (!stats || stats.views === 0) {
        return {
            engagementRate: 0,
            likesRatio: 0,
            commentsRatio: 0,
            sharesRatio: 0,
            totalEngagements: 0
        };
    }

    const totalEngagements = stats.likes + stats.comments + stats.shares;
    
    return {
        // Taux d'engagement : (Likes + Commentaires + Partages) / Vues × 100
        engagementRate: (totalEngagements / stats.views) * 100,
        
        // Ratio Likes/Vues : Pourcentage de spectateurs qui ont aimé
        likesRatio: (stats.likes / stats.views) * 100,
        
        // Ratio Commentaires/Vues : Niveau d'interaction conversationnelle
        commentsRatio: (stats.comments / stats.views) * 100,
        
        // Ratio Partages/Vues : Potentiel de diffusion organique
        sharesRatio: (stats.shares / stats.views) * 100,
        
        totalEngagements
    };
}

// Analyse temporelle selon le guide
function analyzeTemporalPerformance(stats) {
    const { views, duration } = stats;
    
    let dureeOptimale = false;
    let tempsVisionnage = "Non disponible";
    
    // Durée optimale entre 15-60 secondes selon la niche
    if (duration) {
        dureeOptimale = duration >= 15 && duration <= 60;
        tempsVisionnage = `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`;
    }
    
    return {
        dureeOptimale,
        tempsVisionnage,
        // Estimation du rythme de montage (approximation)
        rythmeMontage: duration ? (duration > 30 ? "Lent" : "Rapide") : "Inconnu"
    };
}

// Analyse du contenu créatif
function analyzeCreativeContent(stats, description, hashtags) {
    const analysis = {
        structureNarrative: {
            hookPresent: false,
            messageClaire: false,
            ctaPresent: false
        },
        optimisationPlateforme: {
            hashtagsPertinents: false,
            hashtagsCount: hashtags?.length || 0,
            descriptionEngageante: false
        },
        tendances: {
            utiliseTendance: false,
            hashtagsTendance: []
        }
    };
    
    if (description) {
        const desc = description.toLowerCase();
        
        // Détection du hook (mots accrocheurs au début)
        const hookWords = ['secret', 'pourquoi', 'comment', 'astuce', 'conseil', 'révélation', 'vérité'];
        analysis.structureNarrative.hookPresent = hookWords.some(word => desc.includes(word));
        
        // Détection du message clair (longueur et structure)
        analysis.structureNarrative.messageClaire = description.length > 10 && description.length < 300;
        
        // Détection CTA
        const ctaWords = ['abonne', 'like', 'partage', 'commente', 'follow', 'suit'];
        analysis.structureNarrative.ctaPresent = ctaWords.some(word => desc.includes(word));
        
        // Description engageante
        analysis.optimisationPlateforme.descriptionEngageante = description.length > 20;
    }
    
    // Analyse des hashtags
    if (hashtags && hashtags.length > 0) {
        analysis.optimisationPlateforme.hashtagsPertinents = hashtags.length >= 3 && hashtags.length <= 8;
        
        // Hashtags tendance courants (à adapter selon l'actualité)
        const hashtagsTendance = ['fyp', 'viral', 'trending', 'pourtoi', 'france', 'tiktokfrance'];
        analysis.tendances.hashtagsTendance = hashtags.filter(tag => 
            hashtagsTendance.some(trend => tag.toLowerCase().includes(trend))
        );
        analysis.tendances.utiliseTendance = analysis.tendances.hashtagsTendance.length > 0;
    }
    
    return analysis;
}

// Scoring prédictif selon le guide
function calculatePredictiveScore(stats, metrics, creativeAnalysis, temporalAnalysis) {
    let score = 50; // Score de base
    
    // Performance quantitative (40 points max)
    if (metrics.engagementRate > 15) score += 15; // Excellent
    else if (metrics.engagementRate > 10) score += 12; // Très bon
    else if (metrics.engagementRate > 5) score += 8; // Correct
    else if (metrics.engagementRate > 2) score += 4; // Faible
    
    if (metrics.likesRatio > 10) score += 10;
    else if (metrics.likesRatio > 5) score += 6;
    
    if (stats.views > 1000000) score += 15; // Viral
    else if (stats.views > 100000) score += 10; // Populaire
    else if (stats.views > 10000) score += 5; // Bien
    
    // Analyse créative (30 points max)
    if (creativeAnalysis.structureNarrative.hookPresent) score += 8;
    if (creativeAnalysis.structureNarrative.messageClaire) score += 6;
    if (creativeAnalysis.structureNarrative.ctaPresent) score += 4;
    if (creativeAnalysis.optimisationPlateforme.hashtagsPertinents) score += 6;
    if (creativeAnalysis.optimisationPlateforme.descriptionEngageante) score += 3;
    if (creativeAnalysis.tendances.utiliseTendance) score += 3;
    
    // Analyse temporelle (15 points max)
    if (temporalAnalysis.dureeOptimale) score += 8;
    if (temporalAnalysis.rythmeMontage === "Rapide") score += 4;
    
    // Potentiel viral
    let potentielViral = "faible";
    if (score >= 85) potentielViral = "élevé";
    else if (score >= 70) potentielViral = "moyen";
    
    return {
        score: Math.min(100, Math.max(0, score)),
        potentielViral
    };
}

// Génération des recommandations selon le framework
function generateRecommendations(stats, metrics, creativeAnalysis, temporalAnalysis, predictiveScore) {
    const recommendations = {
        points_forts: [],
        points_faibles: [],
        suggestions: []
    };
    
    // Points forts
    if (metrics.engagementRate > 10) {
        recommendations.points_forts.push("Excellent taux d'engagement - votre audience est très réactive");
    }
    if (metrics.likesRatio > 8) {
        recommendations.points_forts.push("Ratio likes/vues élevé - contenu très apprécié");
    }
    if (creativeAnalysis.structureNarrative.hookPresent) {
        recommendations.points_forts.push("Hook accrocheur détecté dans la description");
    }
    if (temporalAnalysis.dureeOptimale) {
        recommendations.points_forts.push("Durée optimale pour maintenir l'attention");
    }
    if (stats.views > 100000) {
        recommendations.points_forts.push("Forte visibilité - algorithme favorable");
    }
    
    // Points faibles
    if (metrics.engagementRate < 3) {
        recommendations.points_faibles.push("Taux d'engagement faible - contenu peu engageant");
    }
    if (metrics.commentsRatio < 1) {
        recommendations.points_faibles.push("Peu de commentaires - manque d'interaction conversationnelle");
    }
    if (!creativeAnalysis.structureNarrative.ctaPresent) {
        recommendations.points_faibles.push("Absence d'appel à l'action explicite");
    }
    if (!creativeAnalysis.optimisationPlateforme.hashtagsPertinents) {
        recommendations.points_faibles.push("Stratégie hashtags à optimiser (3-8 hashtags recommandés)");
    }
    if (!temporalAnalysis.dureeOptimale) {
        recommendations.points_faibles.push("Durée non optimale pour la rétention");
    }
    
    // Suggestions
    if (metrics.engagementRate < 5) {
        recommendations.suggestions.push("Créer un hook plus percutant dans les 3 premières secondes");
        recommendations.suggestions.push("Poser des questions pour inciter aux commentaires");
    }
    
    if (metrics.sharesRatio < 2) {
        recommendations.suggestions.push("Créer du contenu plus partageable (valeur ajoutée, émotionnel)");
    }
    
    if (!creativeAnalysis.structureNarrative.ctaPresent) {
        recommendations.suggestions.push("Ajouter un appel à l'action clair (abonnez-vous, commentez...)");
    }
    
    if (creativeAnalysis.optimisationPlateforme.hashtagsCount < 3) {
        recommendations.suggestions.push("Utiliser 3-5 hashtags pertinents pour améliorer la découvrabilité");
    }
    
    if (!creativeAnalysis.tendances.utiliseTendance) {
        recommendations.suggestions.push("Intégrer des hashtags tendance (#fyp, #pourtoi) avec modération");
    }
    
    recommendations.suggestions.push("Publier aux heures de forte activité de votre audience");
    
    if (predictiveScore.score < 70) {
        recommendations.suggestions.push("Tester différents formats de contenu pour identifier ce qui fonctionne");
    }
    
    return recommendations;
}

// Fonction pour valider l'URL TikTok
function validateTikTokUrl(url) {
    const tiktokRegex = /^https?:\/\/(www\.|vm\.|m\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/;
    const shortUrlRegex = /^https?:\/\/vm\.tiktok\.com\/[\w]+/;
    return tiktokRegex.test(url) || shortUrlRegex.test(url);
}

// Fonction pour formater les nombres
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

export default async function handler(req) {
    // Vérification de la méthode HTTP
    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Méthode non autorisée. Utilisez POST.' }), 
            { 
                status: 405,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }

    try {
        // Parse du body de la requête
        const body = await req.json().catch(() => null);
        if (!body || !body.url) {
            return new Response(
                JSON.stringify({ error: 'URL manquante dans le body de la requête' }), 
                { 
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        const { url: tiktokUrl } = body;

        // Validation de l'URL TikTok
        if (!validateTikTokUrl(tiktokUrl)) {
            return new Response(
                JSON.stringify({ 
                    error: 'URL TikTok invalide. Format attendu: https://www.tiktok.com/@username/video/...' 
                }), 
                { 
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        console.log(`🔍 Analyse complète de: ${tiktokUrl}`);

        let description = null;
        let thumbnail = null;
        let stats = null;
        let metrics = null;
        let creativeAnalysis = null;
        let temporalAnalysis = null;
        let predictiveScore = null;
        let recommendations = null;

        // --- ÉTAPE 1: Récupération des informations de base via oEmbed ---
        try {
            console.log("📡 Tentative oEmbed...");
            const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`;
            const oembedResponse = await fetch(oembedUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            });

            if (!oembedResponse.ok) {
                throw new Error(`oEmbed failed: ${oembedResponse.status}`);
            }
            
            const oembedData = await oembedResponse.json();
            description = oembedData.title || "Description non disponible";
            thumbnail = oembedData.thumbnail_url;
            
            console.log("✅ oEmbed réussi");
        } catch (error) {
            console.error("❌ Erreur oEmbed:", error.message);
            return new Response(
                JSON.stringify({ 
                    error: "Impossible d'accéder à cette vidéo TikTok. Elle est peut-être privée, supprimée, ou l'URL est incorrecte." 
                }), 
                { 
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        // --- ÉTAPE 2: Récupération des statistiques via ScrapingBee ---
        const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
        
        if (SCRAPINGBEE_API_KEY) {
            try {
                console.log("🕷️ Tentative ScrapingBee pour les stats...");
                
                const scrapingBeeUrl = new URL('https://app.scrapingbee.com/api/v1/');
                scrapingBeeUrl.searchParams.set('api_key', SCRAPINGBEE_API_KEY);
                scrapingBeeUrl.searchParams.set('url', tiktokUrl);
                scrapingBeeUrl.searchParams.set('render_js', 'true');
                scrapingBeeUrl.searchParams.set('wait', '3000');
                scrapingBeeUrl.searchParams.set('block_resources', 'false');

                const response = await fetch(scrapingBeeUrl.toString(), {
                    timeout: 30000
                });

                if (!response.ok) {
                    throw new Error(`ScrapingBee failed: ${response.status}`);
                }
                
                const html = await response.text();
                const data = findJsonBlob(html);

                if (data) {
                    stats = extractStats(data);
                    if (stats) {
                        console.log("✅ Stats récupérées avec succès");
                        
                        // Utiliser la description du scraping si elle est meilleure
                        if (stats.description && stats.description.length > description.length) {
                            description = stats.description;
                        }
                        
                        // Calculs des métriques selon le guide
                        metrics = calculateMetrics(stats);
                        creativeAnalysis = analyzeCreativeContent(stats, description, stats.hashtags);
                        temporalAnalysis = analyzeTemporalPerformance(stats);
                        predictiveScore = calculatePredictiveScore(stats, metrics, creativeAnalysis, temporalAnalysis);
                        recommendations = generateRecommendations(stats, metrics, creativeAnalysis, temporalAnalysis, predictiveScore);
                    }
                } else {
                    console.warn("⚠️ Données JSON non trouvées dans le HTML");
                }
                
            } catch (error) {
                console.warn("⚠️ Échec ScrapingBee:", error.message);
            }
        } else {
            console.warn("⚠️ Clé ScrapingBee manquante");
        }

        // --- ÉTAPE 3: Analyse IA avancée (si disponible) ---
        let advancedAnalysis = null;
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        
        if (OPENAI_API_KEY && thumbnail && stats) {
            try {
                console.log("🤖 Analyse IA avancée en cours...");
                
                const systemPrompt = `Tu es un expert en marketing viral TikTok. Utilise le framework d'analyse à 4 piliers :

1. QUANTITATIF : Métriques de performance
2. QUALITATIF : Structure narrative et créative
3. ALGORITHMIQUE : Optimisation plateforme
4. COMPARATIF : Benchmarking industrie

Fournis une analyse JSON structurée avec scoring précis selon les critères du guide d'analyse TikTok professionnel.`;

                let userPrompt = `ANALYSE FRAMEWORK INTÉGRÉ - Vidéo TikTok :

📊 DONNÉES QUANTITATIVES :
- Vues: ${formatNumber(stats.views)} (${stats.views})
- J'aime: ${formatNumber(stats.likes)} (${stats.likes})
- Commentaires: ${formatNumber(stats.comments)} (${stats.comments})
- Partages: ${formatNumber(stats.shares)} (${stats.shares})
- Taux d'engagement: ${metrics.engagementRate.toFixed(2)}%
- Ratio likes/vues: ${metrics.likesRatio.toFixed(2)}%

🎨 ANALYSE CRÉATIVE :
- Description: "${description}"
- Hashtags: ${stats.hashtags?.join(', ') || 'Non disponibles'}
- Durée: ${temporalAnalysis.tempsVisionnage}
- Auteur: @${stats.author || 'Inconnu'}

🔍 ÉVALUATION REQUISE :
- Score global /100 selon framework professionnel
- Analyse des 4 piliers (Quantitatif, Qualitatif, Algorithmique, Comparatif)
- Potentiel viral : faible/moyen/élevé
- Optimisations prioritaires`;

                const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: "gpt-4o",
                        response_format: { type: "json_object" },
                        messages: [
                            { role: "system", content: systemPrompt },
                            { 
                                role: "user", 
                                content: [
                                    { type: "text", text: userPrompt },
                                    { type: "image_url", image_url: { url: thumbnail } }
                                ]
                            }
                        ],
                        max_tokens: 1500,
                        temperature: 0.3
                    }),
                    timeout: 30000
                });

                if (aiResponse.ok) {
                    const aiData = await aiResponse.json();
                    const content = aiData.choices[0]?.message?.content;
                    
                    if (content) {
                        advancedAnalysis = JSON.parse(content);
                        console.log("✅ Analyse IA avancée terminée");
                    }
                }
                
            } catch (error) {
                console.error("❌ Erreur analyse IA avancée:", error.message);
            }
        }

        // --- RÉPONSE FINALE ENRICHIE ---
        const finalResponse = {
            success: true,
            video: {
                url: tiktokUrl,
                description,
                thumbnail,
                author: stats?.author || null,
                music: stats?.music || null,
                hashtags: stats?.hashtags || []
            },
            stats: stats ? {
                ...stats,
                formatted: {
                    views: formatNumber(stats.views),
                    likes: formatNumber(stats.likes),
                    comments: formatNumber(stats.comments),
                    shares: formatNumber(stats.shares)
                }
            } : null,
            metrics: metrics || {
                engagementRate: null,
                likesRatio: null,
                commentsRatio: null,
                sharesRatio: null
            },
            analysis: {
                // Score et potentiel du framework
                score: predictiveScore?.score || (advancedAnalysis?.score || 50),
                potentiel_viral: predictiveScore?.potentielViral || (advancedAnalysis?.potentiel_viral || 'moyen'),
                
                // Recommandations du framework
                points_forts: recommendations?.points_forts || (advancedAnalysis?.points_forts || []),
                points_faibles: recommendations?.points_faibles || (advancedAnalysis?.points_faibles || []),
                suggestions: recommendations?.suggestions || (advancedAnalysis?.suggestions || []),
                
                // Analyses détaillées
                creative: creativeAnalysis,
                temporal: temporalAnalysis,
                advanced: advancedAnalysis
            },
            timestamp: new Date().toISOString()
        };

        console.log("✅ Analyse framework complète terminée");
        
        return new Response(
            JSON.stringify(finalResponse), 
            { 
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=300'
                }
            }
        );

    } catch (error) {
        console.error("❌ Erreur finale:", error.message);
        
        return new Response(
            JSON.stringify({ 
                error: "Erreur interne du serveur",
                details: process.env.NODE_ENV === 'development' ? error.message : undefined,
                timestamp: new Date().toISOString()
            }), 
            { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}
