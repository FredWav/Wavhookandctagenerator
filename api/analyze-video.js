// analyze-video.js - Version finale avec Framework d'Analyse TikTok complet
export const config = { runtime: "edge" };

// Fonction pour parser les données JSON cachées dans le HTML TikTok
function findJsonBlob(html) {
    try {
        // Plan A: SIGI_STATE (structure ancienne mais toujours utilisée)
        let scriptContent = html.split('<script id="SIGI_STATE" type="application/json">')[1]?.split('</script>')[0];
        if (scriptContent) {
            console.log("✅ Données trouvées via SIGI_STATE");
            return JSON.parse(scriptContent);
        }
        
        // Plan B: __UNIVERSAL_DATA_FOR_REHYDRATION__ (structure moderne)
        scriptContent = html.split('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">')[1]?.split('</script>')[0];
        if (scriptContent) {
            console.log("✅ Données trouvées via __UNIVERSAL_DATA_FOR_REHYDRATION__");
            return JSON.parse(scriptContent);
        }
        
        // Plan C: window.__INITIAL_STATE__ (fallback pour cas spéciaux)
        const initialStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/s);
        if (initialStateMatch) {
            console.log("✅ Données trouvées via __INITIAL_STATE__");
            return JSON.parse(initialStateMatch[1]);
        }
        
        // Plan D: Recherche de patterns JSON alternatifs
        const jsonPatterns = [
            /window\['SIGI_STATE'\]\s*=\s*({.*?});/s,
            /"ItemModule":\s*({.*?}),"UserModule"/s,
            /"webapp\.video-detail":\s*({.*?}),"webapp\.user-detail"/s
        ];
        
        for (const pattern of jsonPatterns) {
            const match = html.match(pattern);
            if (match) {
                console.log("✅ Données trouvées via pattern alternatif");
                return JSON.parse(match[1]);
            }
        }
        
        console.warn("⚠️ Aucun blob JSON trouvé - structure TikTok peut avoir changé");
        return null;
        
    } catch (error) {
        console.error("❌ Erreur parsing JSON:", error.message);
        return null;
    }
}

// Extraction optimisée des statistiques TikTok
function extractStats(data) {
    try {
        let extractedData = {
            views: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            duration: null,
            description: null,
            author: null,
            music: null,
            hashtags: [],
            createTime: null
        };

        // Structure SIGI_STATE (la plus courante)
        if (data.ItemModule) {
            const videoId = Object.keys(data.ItemModule)[0];
            const itemStruct = data.ItemModule[videoId];
            
            if (itemStruct?.stats) {
                extractedData = {
                    views: parseInt(itemStruct.stats.playCount) || 0,
                    likes: parseInt(itemStruct.stats.diggCount) || 0,
                    comments: parseInt(itemStruct.stats.commentCount) || 0,
                    shares: parseInt(itemStruct.stats.shareCount) || 0,
                    duration: itemStruct.video?.duration || null,
                    description: itemStruct.desc || null,
                    author: itemStruct.author?.uniqueId || null,
                    music: itemStruct.music?.title || null,
                    hashtags: itemStruct.textExtra?.map(tag => tag.hashtagName).filter(Boolean) || [],
                    createTime: itemStruct.createTime ? new Date(itemStruct.createTime * 1000) : null
                };
            }
        }
        
        // Structure __UNIVERSAL_DATA_FOR_REHYDRATION__ (moderne)
        else if (data['__DEFAULT_SCOPE__']?.['webapp.video-detail']?.itemInfo?.itemStruct) {
            const itemStruct = data['__DEFAULT_SCOPE__']['webapp.video-detail'].itemInfo.itemStruct;
            
            if (itemStruct.stats) {
                extractedData = {
                    views: parseInt(itemStruct.stats.playCount) || 0,
                    likes: parseInt(itemStruct.stats.diggCount) || 0,
                    comments: parseInt(itemStruct.stats.commentCount) || 0,
                    shares: parseInt(itemStruct.stats.shareCount) || 0,
                    duration: itemStruct.video?.duration || null,
                    description: itemStruct.desc || null,
                    author: itemStruct.author?.uniqueId || null,
                    music: itemStruct.music?.title || null,
                    hashtags: itemStruct.textExtra?.map(tag => tag.hashtagName).filter(Boolean) || [],
                    createTime: itemStruct.createTime ? new Date(itemStruct.createTime * 1000) : null
                };
            }
        }
        
        // Structure directe (cas de fallback)
        else if (data.stats || data.video || data.author) {
            extractedData = {
                views: parseInt(data.stats?.playCount) || 0,
                likes: parseInt(data.stats?.diggCount) || 0,
                comments: parseInt(data.stats?.commentCount) || 0,
                shares: parseInt(data.stats?.shareCount) || 0,
                duration: data.video?.duration || null,
                description: data.desc || null,
                author: data.author?.uniqueId || null,
                music: data.music?.title || null,
                hashtags: data.textExtra?.map(tag => tag.hashtagName).filter(Boolean) || [],
                createTime: data.createTime ? new Date(data.createTime * 1000) : null
            };
        }
        
        return extractedData.views > 0 ? extractedData : null;
        
    } catch (error) {
        console.error("❌ Erreur extraction stats:", error.message);
        return null;
    }
}

// Calcul des métriques selon le Framework d'Analyse TikTok
function calculateAdvancedMetrics(stats) {
    if (!stats || stats.views === 0) {
        return {
            engagementRate: 0,
            likesRatio: 0,
            commentsRatio: 0,
            sharesRatio: 0,
            totalEngagements: 0,
            viralityIndex: 0,
            retentionScore: 0
        };
    }

    const totalEngagements = stats.likes + stats.comments + stats.shares;
    
    // Calculs selon le guide d'analyse professionnel
    const metrics = {
        // Taux d'engagement : (Likes + Commentaires + Partages) / Vues × 100
        engagementRate: (totalEngagements / stats.views) * 100,
        
        // Ratio Likes/Vues : Pourcentage de spectateurs qui ont aimé
        likesRatio: (stats.likes / stats.views) * 100,
        
        // Ratio Commentaires/Vues : Niveau d'interaction conversationnelle
        commentsRatio: (stats.comments / stats.views) * 100,
        
        // Ratio Partages/Vues : Potentiel de diffusion organique
        sharesRatio: (stats.shares / stats.views) * 100,
        
        totalEngagements,
        
        // Index de viralité (formule pondérée)
        viralityIndex: Math.min(100, (
            (stats.shares * 10) + 
            (stats.comments * 4) + 
            (stats.likes * 2)
        ) / stats.views * 100),
        
        // Score de rétention estimé (basé sur les ratios)
        retentionScore: Math.min(100, (stats.likes / stats.views) * 1000)
    };
    
    return metrics;
}

// Analyse temporelle avancée selon le guide
function analyzeTemporalPerformance(stats) {
    const { views, duration, createTime } = stats;
    
    let analysis = {
        dureeOptimale: false,
        tempsVisionnage: "Non disponible",
        rythmeMontage: "Inconnu",
        performanceTemporelle: "Standard",
        ageVideo: null,
        velocityScore: 0
    };
    
    // Analyse de la durée optimale (15-60 secondes selon le guide)
    if (duration) {
        analysis.dureeOptimale = duration >= 15 && duration <= 60;
        analysis.tempsVisionnage = `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`;
        
        // Estimation du rythme de montage
        if (duration <= 15) analysis.rythmeMontage = "Très rapide";
        else if (duration <= 30) analysis.rythmeMontage = "Rapide";
        else if (duration <= 45) analysis.rythmeMontage = "Modéré";
        else analysis.rythmeMontage = "Lent";
    }
    
    // Analyse de la vélocité (performance dans le temps)
    if (createTime) {
        const ageInHours = (Date.now() - createTime.getTime()) / (1000 * 60 * 60);
        analysis.ageVideo = ageInHours;
        
        // Score de vélocité : vues par heure depuis publication
        analysis.velocityScore = ageInHours > 0 ? views / ageInHours : 0;
        
        if (analysis.velocityScore > 10000) analysis.performanceTemporelle = "Virale";
        else if (analysis.velocityScore > 1000) analysis.performanceTemporelle = "Excellente";
        else if (analysis.velocityScore > 100) analysis.performanceTemporelle = "Bonne";
    }
    
    return analysis;
}

// Analyse créative approfondie selon le framework
function analyzeAdvancedCreativeContent(stats, description, hashtags) {
    const analysis = {
        structureNarrative: {
            hookPresent: false,
            hookType: null,
            messageClaire: false,
            ctaPresent: false,
            ctaType: null,
            storytellingScore: 0
        },
        optimisationPlateforme: {
            hashtagsPertinents: false,
            hashtagsCount: hashtags?.length || 0,
            descriptionEngageante: false,
            descriptionLength: description?.length || 0,
            seoOptimized: false
        },
        tendances: {
            utiliseTendance: false,
            hashtagsTendance: [],
            trendingScore: 0
        },
        psychologicalTriggers: {
            fomo: false,
            curiosity: false,
            emotion: false,
            controversy: false
        }
    };
    
    if (description) {
        const desc = description.toLowerCase();
        
        // Détection du hook et de son type
        const hookPatterns = {
            question: /^(pourquoi|comment|qui|que|quoi|où|quand)/,
            secret: /(secret|astuce|conseil|truc)/,
            revelation: /(révélation|vérité|découverte|shocking)/,
            negation: /(pas|jamais|aucun|stop|arrête)/,
            number: /^\d+/,
            controversial: /(personne ne|tout le monde|on vous ment)/
        };
        
        for (const [type, pattern] of Object.entries(hookPatterns)) {
            if (pattern.test(desc)) {
                analysis.structureNarrative.hookPresent = true;
                analysis.structureNarrative.hookType = type;
                break;
            }
        }
        
        // Détection du CTA et de son type
        const ctaPatterns = {
            subscribe: /(abonne|follow|suit)/,
            engage: /(like|commente|partage|réagis)/,
            action: /(clique|va sur|regarde|découvre)/,
            save: /(sauvegarde|enregistre|garde)/
        };
        
        for (const [type, pattern] of Object.entries(ctaPatterns)) {
            if (pattern.test(desc)) {
                analysis.structureNarrative.ctaPresent = true;
                analysis.structureNarrative.ctaType = type;
                break;
            }
        }
        
        // Score de storytelling (0-100)
        let storyScore = 0;
        if (analysis.structureNarrative.hookPresent) storyScore += 30;
        if (analysis.structureNarrative.ctaPresent) storyScore += 20;
        if (description.length > 20 && description.length < 300) storyScore += 25;
        if (desc.includes('!') || desc.includes('?')) storyScore += 15;
        if (/(émot|sent|ressent|éprouv)/.test(desc)) storyScore += 10;
        
        analysis.structureNarrative.storytellingScore = storyScore;
        analysis.structureNarrative.messageClaire = description.length > 10 && description.length < 300;
        analysis.optimisationPlateforme.descriptionEngageante = description.length > 20;
        analysis.optimisationPlateforme.descriptionLength = description.length;
        
        // Détection des triggers psychologiques
        analysis.psychologicalTriggers.fomo = /(urgent|limité|dernière chance|avant qu|plus que)/.test(desc);
        analysis.psychologicalTriggers.curiosity = /(secret|mystère|découvre|révèle|cache)/.test(desc);
        analysis.psychologicalTriggers.emotion = /(incroyable|choc|fou|dingue|émotionnel)/.test(desc);
        analysis.psychologicalTriggers.controversy = /(controverse|polémique|interdit|scandale)/.test(desc);
        
        // Optimisation SEO
        analysis.optimisationPlateforme.seoOptimized = 
            description.length > 50 && 
            hashtags?.length > 0 && 
            (analysis.structureNarrative.hookPresent || analysis.structureNarrative.ctaPresent);
    }
    
    // Analyse avancée des hashtags
    if (hashtags && hashtags.length > 0) {
        analysis.optimisationPlateforme.hashtagsPertinents = hashtags.length >= 3 && hashtags.length <= 8;
        
        // Hashtags tendance 2025 (à adapter selon l'actualité)
        const hashtagsTendance = [
            'fyp', 'viral', 'trending', 'pourtoi', 'france', 'tiktokfrance',
            'reels', 'explore', 'mood', 'aesthetic', 'relatable', 'storytime',
            'tutorial', 'tips', 'life', 'motivation', 'inspiration', 'daily'
        ];
        
        analysis.tendances.hashtagsTendance = hashtags.filter(tag => 
            hashtagsTendance.some(trend => tag.toLowerCase().includes(trend))
        );
        
        analysis.tendances.utiliseTendance = analysis.tendances.hashtagsTendance.length > 0;
        
        // Score trending (0-100)
        analysis.tendances.trendingScore = Math.min(100, 
            (analysis.tendances.hashtagsTendance.length / hashtags.length) * 100
        );
    }
    
    return analysis;
}

// Scoring prédictif avancé selon le framework complet
function calculateAdvancedPredictiveScore(stats, metrics, creativeAnalysis, temporalAnalysis) {
    let score = 40; // Score de base plus conservateur
    
    // 1. PILIER QUANTITATIF (35 points max)
    // Taux d'engagement (critère le plus important)
    if (metrics.engagementRate > 20) score += 15; // Exceptionnel
    else if (metrics.engagementRate > 15) score += 12; // Excellent
    else if (metrics.engagementRate > 10) score += 10; // Très bon
    else if (metrics.engagementRate > 5) score += 6; // Correct
    else if (metrics.engagementRate > 2) score += 3; // Faible
    
    // Ratio likes/vues
    if (metrics.likesRatio > 15) score += 8;
    else if (metrics.likesRatio > 10) score += 6;
    else if (metrics.likesRatio > 5) score += 4;
    
    // Performance absolue
    if (stats.views > 5000000) score += 12; // Mega viral
    else if (stats.views > 1000000) score += 10; // Viral
    else if (stats.views > 100000) score += 7; // Populaire
    else if (stats.views > 10000) score += 4; // Bien
    else if (stats.views > 1000) score += 2; // Début
    
    // 2. PILIER QUALITATIF (25 points max)
    if (creativeAnalysis.structureNarrative.hookPresent) score += 8;
    if (creativeAnalysis.structureNarrative.messageClaire) score += 5;
    if (creativeAnalysis.structureNarrative.ctaPresent) score += 4;
    if (creativeAnalysis.structureNarrative.storytellingScore > 70) score += 4;
    if (creativeAnalysis.optimisationPlateforme.descriptionEngageante) score += 2;
    if (creativeAnalysis.psychologicalTriggers.curiosity || creativeAnalysis.psychologicalTriggers.emotion) score += 2;
    
    // 3. PILIER ALGORITHMIQUE (20 points max)
    if (creativeAnalysis.optimisationPlateforme.hashtagsPertinents) score += 6;
    if (creativeAnalysis.tendances.utiliseTendance) score += 4;
    if (temporalAnalysis.dureeOptimale) score += 6;
    if (temporalAnalysis.performanceTemporelle === "Virale") score += 4;
    
    // 4. PILIER COMPARATIF (20 points max)
    if (metrics.viralityIndex > 80) score += 8;
    else if (metrics.viralityIndex > 60) score += 6;
    else if (metrics.viralityIndex > 40) score += 4;
    
    if (temporalAnalysis.velocityScore > 5000) score += 6;
    else if (temporalAnalysis.velocityScore > 1000) score += 4;
    else if (temporalAnalysis.velocityScore > 100) score += 2;
    
    if (metrics.sharesRatio > 5) score += 6; // Très partageable
    else if (metrics.sharesRatio > 2) score += 4;
    else if (metrics.sharesRatio > 1) score += 2;
    
    // Calcul du potentiel viral
    let potentielViral = "faible";
    if (score >= 85 && metrics.engagementRate > 10) potentielViral = "élevé";
    else if (score >= 70 && metrics.engagementRate > 5) potentielViral = "moyen";
    
    return {
        score: Math.min(100, Math.max(0, Math.round(score))),
        potentielViral,
        breakdown: {
            quantitatif: Math.min(35, score > 75 ? 30 : score > 50 ? 25 : 20),
            qualitatif: Math.min(25, creativeAnalysis.structureNarrative.storytellingScore * 0.25),
            algorithmique: Math.min(20, (creativeAnalysis.optimisationPlateforme.hashtagsPertinents ? 10 : 0) + (temporalAnalysis.dureeOptimale ? 10 : 0)),
            comparatif: Math.min(20, metrics.viralityIndex * 0.2)
        }
    };
}

// Génération de recommandations intelligentes
function generateIntelligentRecommendations(stats, metrics, creativeAnalysis, temporalAnalysis, predictiveScore) {
    const recommendations = {
        points_forts: [],
        points_faibles: [],
        suggestions: []
    };
    
    // === POINTS FORTS ===
    if (metrics.engagementRate > 10) {
        recommendations.points_forts.push(`Taux d'engagement exceptionnel (${metrics.engagementRate.toFixed(1)}%) - Votre audience est très engagée`);
    } else if (metrics.engagementRate > 5) {
        recommendations.points_forts.push(`Bon taux d'engagement (${metrics.engagementRate.toFixed(1)}%) - Au-dessus de la moyenne TikTok`);
    }
    
    if (metrics.likesRatio > 8) {
        recommendations.points_forts.push("Ratio likes/vues excellent - Contenu très apprécié par l'audience");
    }
    
    if (metrics.sharesRatio > 3) {
        recommendations.points_forts.push("Fort taux de partage - Contenu viral avec potentiel de diffusion organique");
    }
    
    if (creativeAnalysis.structureNarrative.hookPresent) {
        recommendations.points_forts.push(`Hook ${creativeAnalysis.structureNarrative.hookType} détecté - Accroche efficace pour capter l'attention`);
    }
    
    if (temporalAnalysis.dureeOptimale) {
        recommendations.points_forts.push("Durée optimale pour la rétention - Format adapté à l'algorithme TikTok");
    }
    
    if (temporalAnalysis.performanceTemporelle === "Virale" || temporalAnalysis.performanceTemporelle === "Excellente") {
        recommendations.points_forts.push(`Performance temporelle ${temporalAnalysis.performanceTemporelle.toLowerCase()} - Forte vélocité de croissance`);
    }
    
    if (stats.views > 100000) {
        recommendations.points_forts.push("Forte visibilité algorithmique - Contenu poussé par l'algorithme TikTok");
    }
    
    // === POINTS FAIBLES ===
    if (metrics.engagementRate < 2) {
        recommendations.points_faibles.push("Taux d'engagement faible - Contenu peu engageant pour l'audience");
    }
    
    if (metrics.commentsRatio < 0.5) {
        recommendations.points_faibles.push("Peu de commentaires - Manque d'interaction conversationnelle");
    }
    
    if (!creativeAnalysis.structureNarrative.hookPresent) {
        recommendations.points_faibles.push("Absence de hook détectable - Accroche initiale à renforcer");
    }
    
    if (!creativeAnalysis.structureNarrative.ctaPresent) {
        recommendations.points_faibles.push("Aucun appel à l'action explicite - Manque d'incitation à l'engagement");
    }
    
    if (!creativeAnalysis.optimisationPlateforme.hashtagsPertinents) {
        recommendations.points_faibles.push(`Stratégie hashtags non optimale (${creativeAnalysis.optimisationPlateforme.hashtagsCount} hashtags) - Recommandé: 3-8 hashtags`);
    }
    
    if (!temporalAnalysis.dureeOptimale) {
        recommendations.points_faibles.push(`Durée non optimale (${temporalAnalysis.tempsVisionnage}) - Recommandé: 15-60 secondes`);
    }
    
    if (metrics.sharesRatio < 1) {
        recommendations.points_faibles.push("Faible taux de partage - Contenu peu viral ou partageable");
    }
    
    // === SUGGESTIONS PERSONNALISÉES ===
    
    // Suggestions basées sur l'engagement
    if (metrics.engagementRate < 5) {
        recommendations.suggestions.push("🎯 Créer un hook plus percutant dans les 3 premières secondes (question, affirmation choc, chiffre surprenant)");
        recommendations.suggestions.push("💬 Poser des questions directes pour inciter aux commentaires ('Dites-moi en commentaire...', 'Êtes-vous d'accord?')");
    }
    
    // Suggestions créatives
    if (!creativeAnalysis.structureNarrative.hookPresent) {
        recommendations.suggestions.push("🔥 Commencer par une phrase d'accroche forte: 'Le secret que personne ne vous dit...', 'Voici pourquoi vous échouez...'");
    }
    
    if (!creativeAnalysis.structureNarrative.ctaPresent) {
        recommendations.suggestions.push("📢 Ajouter un CTA clair: 'Abonnez-vous pour plus de conseils', 'Double-tap si ça vous parle'");
    }
    
    // Suggestions algorithmiques
    if (creativeAnalysis.optimisationPlateforme.hashtagsCount < 3) {
        recommendations.suggestions.push("🏷️ Utiliser 3-5 hashtags pertinents: mix de hashtags niche + généralistes + trending");
    }
    
    if (!creativeAnalysis.tendances.utiliseTendance) {
        recommendations.suggestions.push("📈 Intégrer des hashtags tendance avec modération (#fyp, #pourtoi, #viral) sans en abuser");
    }
    
    // Suggestions temporelles
    if (temporalAnalysis.rythmeMontage === "Lent") {
        recommendations.suggestions.push("⚡ Accélérer le rythme de montage: coupes plus fréquentes, transitions dynamiques");
    }
    
    // Suggestions basées sur les triggers psychologiques
    if (!creativeAnalysis.psychologicalTriggers.curiosity && !creativeAnalysis.psychologicalTriggers.emotion) {
        recommendations.suggestions.push("🧠 Utiliser des triggers psychologiques: curiosité ('Voici ce qui va vous choquer...'), émotion, FOMO");
    }
    
    // Suggestions basées sur le score
    if (predictiveScore.score < 70) {
        recommendations.suggestions.push("🔄 Tester différents formats de contenu pour identifier ce qui résonne avec votre audience");
        recommendations.suggestions.push("📊 Analyser vos meilleures performances pour reproduire les éléments qui fonctionnent");
    }
    
    // Suggestions de timing
    recommendations.suggestions.push("⏰ Publier aux heures de forte activité de votre audience (généralement 18h-22h)");
    
    // Suggestions de suivi
    if (temporalAnalysis.ageVideo && temporalAnalysis.ageVideo > 48) {
        recommendations.suggestions.push("📈 Analyser cette vidéo comme référence pour optimiser les prochaines publications");
    }
    
    return recommendations;
}

// Validation URL TikTok renforcée
function validateTikTokUrl(url) {
    const patterns = [
        /^https?:\/\/(www\.|vm\.|m\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
        /^https?:\/\/vm\.tiktok\.com\/[\w]+/,
        /^https?:\/\/www\.tiktok\.com\/t\/[\w]+/,
        /^https?:\/\/tiktok\.com\/@[\w.-]+\/video\/\d+/
    ];
    
    return patterns.some(pattern => pattern.test(url));
}

// Formatage intelligent des nombres
function formatNumber(num) {
    if (!num || num === 0) return '0';
    
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(1) + 'B';
    } else if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Handler principal optimisé
export default async function handler(req) {
    // Vérification de la méthode HTTP
    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ 
                error: 'Méthode non autorisée. Utilisez POST.',
                supportedMethods: ['POST']
            }), 
            { 
                status: 405,
                headers: { 
                    'Content-Type': 'application/json',
                    'Allow': 'POST'
                }
            }
        );
    }

    try {
        // Parse du body avec validation
        const body = await req.json().catch(() => null);
        if (!body || !body.url) {
            return new Response(
                JSON.stringify({ 
                    error: 'URL manquante dans le body de la requête',
                    expectedFormat: { url: 'https://www.tiktok.com/@username/video/...' }
                }), 
                { 
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        const { url: tiktokUrl } = body;

        // Validation renforcée de l'URL TikTok
        if (!validateTikTokUrl(tiktokUrl)) {
            return new Response(
                JSON.stringify({ 
                    error: 'URL TikTok invalide',
                    details: 'Format attendu: https://www.tiktok.com/@username/video/... ou https://vm.tiktok.com/...',
                    receivedUrl: tiktokUrl
                }), 
                { 
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        console.log(`🚀 Démarrage analyse Framework TikTok: ${tiktokUrl}`);

        // Variables pour stocker les résultats
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
            console.log("📡 Récupération oEmbed...");
            const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`;
            const oembedResponse = await fetch(oembedUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json',
                    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
                },
                signal: AbortSignal.timeout(15000)
            });

            if (!oembedResponse.ok) {
                throw new Error(`oEmbed HTTP ${oembedResponse.status}: ${oembedResponse.statusText}`);
            }
            
            const oembedData = await oembedResponse.json();
            description = oembedData.title || "Description non disponible";
            thumbnail = oembedData.thumbnail_url;
            
            console.log("✅ oEmbed réussi - Infos de base récupérées");
        } catch (error) {
            console.error("❌ Erreur oEmbed:", error.message);
            return new Response(
                JSON.stringify({ 
                    error: "Impossible d'accéder à cette vidéo TikTok",
                    details: "La vidéo est peut-être privée, supprimée, géo-restreinte, ou l'URL est incorrecte",
                    troubleshooting: [
                        "Vérifiez que l'URL est correcte",
                        "Assurez-vous que la vidéo est publique",
                        "Testez depuis un autre navigateur ou réseau"
                    ]
                }), 
                { 
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        // --- ÉTAPE 2: Récupération des statistiques détaillées via ScrapingBee ---
        const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
        
        if (SCRAPINGBEE_API_KEY) {
            try {
                console.log("🕷️ Extraction statistiques via ScrapingBee...");
                
                const scrapingBeeUrl = new URL('https://app.scrapingbee.com/api/v1/');
                scrapingBeeUrl.searchParams.set('api_key', SCRAPINGBEE_API_KEY);
                scrapingBeeUrl.searchParams.set('url', tiktokUrl);
                scrapingBeeUrl.searchParams.set('render_js', 'true');
                scrapingBeeUrl.searchParams.set('wait', '4000');
                scrapingBeeUrl.searchParams.set('block_resources', 'true');
                scrapingBeeUrl.searchParams.set('window_width', '1920');
                scrapingBeeUrl.searchParams.set('window_height', '1080');

                const response = await fetch(scrapingBeeUrl.toString(), {
                    signal: AbortSignal.timeout(35000)
                });

                if (!response.ok) {
                    throw new Error(`ScrapingBee HTTP ${response.status}: ${response.statusText}`);
                }
                
                const html = await response.text();
                console.log(`📄 HTML récupéré: ${html.length} caractères`);
                
                const data = findJsonBlob(html);

                if (data) {
                    stats = extractStats(data);
                    if (stats) {
                        console.log("✅ Statistiques extraites avec succès");
                        console.log(`📊 Métriques: ${stats.views} vues, ${stats.likes} likes, ${stats.comments} commentaires`);
                        
                        // Utiliser la description du scraping si elle est plus complète
                        if (stats.description && stats.description.length > description.length) {
                            description = stats.description;
                        }
                        
                        // === ANALYSE FRAMEWORK COMPLET ===
                        console.log("🔬 Démarrage analyse Framework 4 piliers...");
                        
                        // Calculs des métriques avancées
                        metrics = calculateAdvancedMetrics(stats);
                        console.log(`📈 Métriques calculées: ER=${metrics.engagementRate.toFixed(2)}%, VI=${metrics.viralityIndex.toFixed(1)}`);
                        
                        // Analyse créative approfondie
                        creativeAnalysis = analyzeAdvancedCreativeContent(stats, description, stats.hashtags);
                        console.log(`🎨 Analyse créative: Hook=${creativeAnalysis.structureNarrative.hookPresent}, CTA=${creativeAnalysis.structureNarrative.ctaPresent}`);
                        
                        // Analyse temporelle
                        temporalAnalysis = analyzeTemporalPerformance(stats);
                        console.log(`⏱️ Analyse temporelle: Durée=${temporalAnalysis.tempsVisionnage}, Performance=${temporalAnalysis.performanceTemporelle}`);
                        
                        // Score prédictif framework
                        predictiveScore = calculateAdvancedPredictiveScore(stats, metrics, creativeAnalysis, temporalAnalysis);
                        console.log(`🎯 Score Framework: ${predictiveScore.score}/100, Potentiel=${predictiveScore.potentielViral}`);
                        
                        // Recommandations intelligentes
                        recommendations = generateIntelligentRecommendations(stats, metrics, creativeAnalysis, temporalAnalysis, predictiveScore);
                        console.log(`💡 Recommandations générées: ${recommendations.suggestions.length} suggestions`);
                        
                    } else {
                        console.warn("⚠️ Impossible d'extraire les statistiques du JSON");
                    }
                } else {
                    console.warn("⚠️ Aucun JSON valide trouvé dans le HTML - Structure TikTok peut avoir changé");
                }
                
            } catch (error) {
                console.warn("⚠️ Échec ScrapingBee:", error.message);
                console.log("ℹ️ Poursuite avec analyse limitée...");
            }
        } else {
            console.warn("⚠️ SCRAPINGBEE_API_KEY non configurée - Analyse limitée aux données oEmbed");
        }

        // --- ÉTAPE 3: Analyse IA avancée (optionnelle) ---
        let advancedAiAnalysis = null;
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        
        if (OPENAI_API_KEY && thumbnail && stats) {
            try {
                console.log("🤖 Analyse IA avancée avec Framework...");
                
                const systemPrompt = `Tu es un expert en marketing viral TikTok maîtrisant le Framework d'Analyse à 4 Piliers :

1. QUANTITATIF: Métriques de performance, taux d'engagement, ratios
2. QUALITATIF: Structure narrative, hooks, storytelling, triggers psychologiques  
3. ALGORITHMIQUE: Optimisation plateforme, hashtags, timing, tendances
4. COMPARATIF: Benchmarking, positionnement industrie, potentiel viral

Analyse cette vidéo selon ce framework professionnel et fournis des insights actionnables.`;

                let userPrompt = `ANALYSE FRAMEWORK TIKTOK PRO - Données complètes :

📊 PILIER QUANTITATIF:
- Vues: ${formatNumber(stats.views)} (${stats.views.toLocaleString()})
- Likes: ${formatNumber(stats.likes)} (${stats.likes.toLocaleString()})  
- Commentaires: ${formatNumber(stats.comments)} (${stats.comments.toLocaleString()})
- Partages: ${formatNumber(stats.shares)} (${stats.shares.toLocaleString()})
- Taux d'engagement: ${metrics.engagementRate.toFixed(2)}%
- Index viralité: ${metrics.viralityIndex.toFixed(1)}
- Vélocité: ${temporalAnalysis.velocityScore.toFixed(0)} vues/h

🎨 PILIER QUALITATIF:
- Description: "${description}"
- Hashtags: ${stats.hashtags?.join(', ') || 'Aucun'}
- Hook détecté: ${creativeAnalysis.structureNarrative.hookType || 'Non'}
- CTA présent: ${creativeAnalysis.structureNarrative.ctaPresent ? 'Oui' : 'Non'}
- Score storytelling: ${creativeAnalysis.structureNarrative.storytellingScore}/100

⚙️ PILIER ALGORITHMIQUE:
- Durée: ${temporalAnalysis.tempsVisionnage} (optimal: ${temporalAnalysis.dureeOptimale ? 'Oui' : 'Non'})
- Hashtags: ${creativeAnalysis.optimisationPlateforme.hashtagsCount} (optimal: ${creativeAnalysis.optimisationPlateforme.hashtagsPertinents ? 'Oui' : 'Non'})
- Tendances: ${creativeAnalysis.tendances.trendingScore.toFixed(0)}%
- Performance temporelle: ${temporalAnalysis.performanceTemporelle}

📈 PILIER COMPARATIF:
- Score Framework actuel: ${predictiveScore.score}/100
- Potentiel viral: ${predictiveScore.potentielViral}
- Benchmark industrie: ${metrics.engagementRate > 5 ? 'Au-dessus' : 'Standard'}

🎯 MISSION: Analyse cette vidéo et fournis un JSON avec des insights expert-level.`;

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
                        max_tokens: 2000,
                        temperature: 0.2
                    }),
                    signal: AbortSignal.timeout(35000)
                });

                if (aiResponse.ok) {
                    const aiData = await aiResponse.json();
                    const content = aiData.choices[0]?.message?.content;
                    
                    if (content) {
                        advancedAiAnalysis = JSON.parse(content);
                        console.log("✅ Analyse IA avancée complétée");
                    }
                } else {
                    console.warn(`⚠️ Erreur API OpenAI: ${aiResponse.status}`);
                }
                
            } catch (error) {
                console.error("❌ Erreur analyse IA:", error.message);
            }
        }

        // --- RÉPONSE FINALE FRAMEWORK COMPLET ---
        const frameworkResponse = {
            success: true,
            analysisType: "framework_integre_4_piliers",
            video: {
                url: tiktokUrl,
                description,
                thumbnail,
                author: stats?.author || null,
                music: stats?.music || null,
                hashtags: stats?.hashtags || [],
                createTime: stats?.createTime || null
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
                sharesRatio: null,
                totalEngagements: null,
                viralityIndex: null
            },
            framework: {
                quantitatif: {
                    score: predictiveScore?.breakdown?.quantitatif || null,
                    metriques: metrics || null
                },
                qualitatif: {
                    score: predictiveScore?.breakdown?.qualitatif || null,
                    analyse: creativeAnalysis || null
                },
                algorithmique: {
                    score: predictiveScore?.breakdown?.algorithmique || null,
                    temporal: temporalAnalysis || null
                },
                comparatif: {
                    score: predictiveScore?.breakdown?.comparatif || null,
                    benchmark: {
                        industrie: metrics?.engagementRate > 5 ? "au_dessus" : "standard",
                        position: stats?.views > 100000 ? "top_10_pct" : stats?.views > 10000 ? "top_30_pct" : "standard"
                    }
                }
            },
            analysis: {
                // Scoring Framework
                score: predictiveScore?.score || (advancedAiAnalysis?.score || 50),
                potentiel_viral: predictiveScore?.potentielViral || (advancedAiAnalysis?.potentiel_viral || 'moyen'),
                
                // Recommandations Framework
                points_forts: recommendations?.points_forts || (advancedAiAnalysis?.points_forts || []),
                points_faibles: recommendations?.points_faibles || (advancedAiAnalysis?.points_faibles || []),
                suggestions: recommendations?.suggestions || (advancedAiAnalysis?.suggestions || []),
                
                // Analyses détaillées
                creative: creativeAnalysis,
                temporal: temporalAnalysis,
                advanced: advancedAiAnalysis,
                
                // Métadonnées d'analyse
                completeness: {
                    oembed: !!thumbnail,
                    stats: !!stats,
                    framework: !!(predictiveScore && recommendations),
                    ai_analysis: !!advancedAiAnalysis
                }
            },
            metadata: {
                analysisTimestamp: new Date().toISOString(),
                frameworkVersion: "4.0-pro",
                apiEndpoint: "/api/analyze-video",
                processingTime: Date.now()
            }
        };

        // Log final
        const completeness = Object.values(frameworkResponse.analysis.completeness).filter(Boolean).length;
        console.log(`✅ Analyse Framework complétée: ${completeness}/4 modules actifs`);
        console.log(`🎯 Score final: ${frameworkResponse.analysis.score}/100 (${frameworkResponse.analysis.potentiel_viral})`);
        
        return new Response(
            JSON.stringify(frameworkResponse), 
            { 
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=300, s-maxage=600',
                    'X-Framework-Version': '4.0-pro',
                    'X-Analysis-Completeness': completeness.toString()
                }
            }
        );

    } catch (error) {
        console.error("❌ Erreur critique Framework:", error.message);
        console.error("Stack trace:", error.stack);
        
        return new Response(
            JSON.stringify({ 
                error: "Erreur interne du serveur d'analyse",
                errorCode: "FRAMEWORK_ERROR",
                details: process.env.NODE_ENV === 'development' ? {
                    message: error.message,
                    stack: error.stack
                } : "Erreur de traitement - Réessayez dans quelques instants",
                timestamp: new Date().toISOString(),
                support: "Contactez le support si le problème persiste"
            }), 
            { 
                status: 500,
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Error-Type': 'framework-error'
                }
            }
        );
    }
}
