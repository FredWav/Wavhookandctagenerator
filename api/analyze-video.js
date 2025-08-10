// ANALYSEUR TIKTOK CLEAN - Version optimisée sans audio
export const config = { runtime: "edge" };

// Logging simple
let analysisCount = 0;

function json(res, status = 200) {
    return new Response(JSON.stringify(res), { 
        status, 
        headers: { 
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300" // Cache 5min
        }
    });
}

// Validation URL TikTok robuste
function validateTikTokUrl(url) {
    const patterns = [
        /^https?:\/\/(www\.|vm\.|m\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
        /^https?:\/\/vm\.tiktok\.com\/[\w]+/,
        /^https?:\/\/www\.tiktok\.com\/t\/[\w]+/,
        /^https?:\/\/(www\.)?tiktok\.com\/.*\/video\/\d+/
    ];
    return patterns.some(pattern => pattern.test(url));
}

// Extraction description optimisée
function extractDescription(oembedData, htmlContent = null) {
    let description = "";
    
    // 1. Priorité oEmbed (plus fiable)
    if (oembedData?.title) {
        description = oembedData.title;
    }
    
    // 2. Fallback meta tags
    if (!description && htmlContent) {
        const metaMatches = [
            htmlContent.match(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"[^>]*>/i),
            htmlContent.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"[^>]*>/i),
            htmlContent.match(/<title>([^<]*)<\/title>/i)
        ];
        
        for (const match of metaMatches) {
            if (match && match[1]) {
                description = match[1];
                break;
            }
        }
    }
    
    // 3. Nettoyage
    return description
        .replace(/\s+/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim() || "Description non disponible";
}

// Extraction hashtags fiable
function extractHashtags(description, htmlContent = null) {
    const hashtags = new Set();
    
    if (description) {
        // Regex améliorée pour hashtags
        const hashtagRegex = /#[\w\u00C0-\u017F\u4e00-\u9fff]+/g;
        const matches = description.match(hashtagRegex);
        
        if (matches) {
            matches.forEach(tag => {
                const cleanTag = tag.slice(1).toLowerCase();
                if (cleanTag.length > 1 && cleanTag.length < 30) {
                    hashtags.add(cleanTag);
                }
            });
        }
    }
    
    // Fallback HTML si peu de hashtags
    if (hashtags.size < 2 && htmlContent) {
        const htmlHashtags = htmlContent.match(/#[\w\u00C0-\u017F]+/g);
        if (htmlHashtags) {
            htmlHashtags.forEach(tag => {
                const cleanTag = tag.slice(1).toLowerCase();
                if (cleanTag.length > 1 && cleanTag.length < 30) {
                    hashtags.add(cleanTag);
                }
            });
        }
    }
    
    return Array.from(hashtags).slice(0, 15); // Max 15 hashtags
}

// Parsing JSON TikTok robuste
function findJsonBlob(html) {
    const methods = [
        {
            name: "SIGI_STATE",
            regex: /<script id="SIGI_STATE" type="application\/json">([^<]*)<\/script>/
        },
        {
            name: "__UNIVERSAL_DATA_FOR_REHYDRATION__",
            regex: /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([^<]*)<\/script>/
        },
        {
            name: "__INITIAL_STATE__",
            regex: /window\.__INITIAL_STATE__\s*=\s*({.*?});/s
        }
    ];
    
    for (const method of methods) {
        try {
            const match = html.match(method.regex);
            if (match && match[1]) {
                const data = JSON.parse(match[1]);
                console.log(`✅ Données via ${method.name}`);
                return data;
            }
        } catch (error) {
            console.warn(`⚠️ Échec ${method.name}:`, error.message);
            continue;
        }
    }
    
    console.warn("❌ Aucune structure JSON trouvée");
    return null;
}

// Extraction stats optimisée
function extractStats(data, description, htmlContent) {
    const stats = {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        author: null,
        music: null,
        createTime: null,
        hashtags: [],
        description: description
    };

    try {
        let itemStruct = null;
        
        // Méthode 1: ItemModule
        if (data.ItemModule) {
            const videoId = Object.keys(data.ItemModule)[0];
            itemStruct = data.ItemModule[videoId];
        }
        // Méthode 2: webapp.video-detail
        else if (data['__DEFAULT_SCOPE__']?.['webapp.video-detail']?.itemInfo?.itemStruct) {
            itemStruct = data['__DEFAULT_SCOPE__']['webapp.video-detail'].itemInfo.itemStruct;
        }
        
        if (itemStruct?.stats) {
            stats.views = parseInt(itemStruct.stats.playCount) || 0;
            stats.likes = parseInt(itemStruct.stats.diggCount) || 0;
            stats.comments = parseInt(itemStruct.stats.commentCount) || 0;
            stats.shares = parseInt(itemStruct.stats.shareCount) || 0;
            
            // Métadonnées
            stats.author = itemStruct.author?.uniqueId || null;
            stats.music = itemStruct.music?.title || null;
            stats.createTime = itemStruct.createTime ? new Date(itemStruct.createTime * 1000) : null;
            
            // Description plus complète
            if (itemStruct.desc && itemStruct.desc.length > description.length) {
                stats.description = itemStruct.desc;
            }
        }
        
        // Hashtags depuis description finale
        stats.hashtags = extractHashtags(stats.description, htmlContent);
        
        return stats.views > 0 ? stats : null;
        
    } catch (error) {
        console.error("❌ Erreur extraction stats:", error.message);
        return null;
    }
}

// Calcul métriques
function calculateMetrics(stats) {
    if (!stats || stats.views === 0) {
        return {
            engagementRate: 0,
            likesRatio: 0,
            commentsRatio: 0,
            sharesRatio: 0,
            totalEngagements: 0,
            viralityIndex: 0
        };
    }

    const totalEngagements = stats.likes + stats.comments + stats.shares;
    
    return {
        engagementRate: (totalEngagements / stats.views) * 100,
        likesRatio: (stats.likes / stats.views) * 100,
        commentsRatio: (stats.comments / stats.views) * 100,
        sharesRatio: (stats.shares / stats.views) * 100,
        totalEngagements,
        viralityIndex: Math.min(100, ((stats.shares * 10) + (stats.comments * 4) + (stats.likes * 2)) / stats.views * 100)
    };
}

// Analyse créative améliorée
function analyzeCreativeContent(stats, description, hashtags) {
    const analysis = {
        structureNarrative: {
            hookPresent: false,
            hookType: null,
            messageClaire: false,
            ctaPresent: false,
            ctaType: null
        },
        optimisationPlateforme: {
            hashtagsPertinents: false,
            hashtagsCount: hashtags?.length || 0,
            descriptionEngageante: false,
            longueurOptimale: false
        },
        tendances: {
            utiliseTendance: false,
            hashtagsTendance: []
        }
    };
    
    if (!description) return analysis;
    
    const desc = description.toLowerCase();
    
    // DÉTECTION HOOKS TikTok réels
    const hookPatterns = {
        question: /^(pourquoi|comment|qui|que|quoi|où|quand|est-ce que|vous savez)/,
        chiffres: /^\d+/,
        secret: /(secret|astuce|conseil|truc|technique|méthode)/,
        negatif: /(jamais|pas|arrête|stop|erreur|problème|mal)/,
        fomo: /(urgent|limité|dernier|rapidement|maintenant|dernière chance)/,
        controverse: /(personne ne|tout le monde|on vous ment|vérité|révélation)/,
        promesse: /(voici comment|je vais vous|découvrez|apprenez)/
    };
    
    for (const [type, pattern] of Object.entries(hookPatterns)) {
        if (pattern.test(desc)) {
            analysis.structureNarrative.hookPresent = true;
            analysis.structureNarrative.hookType = type;
            break;
        }
    }
    
    // DÉTECTION CTA
    const ctaPatterns = {
        subscribe: /(abonne|follow|suit|subscribe)/,
        engage: /(like|commente|partage|réagis|comment)/,
        save: /(sauvegarde|enregistre|garde|save)/,
        action: /(clique|va sur|regarde|découvre|lien|bio|swipe)/
    };
    
    for (const [type, pattern] of Object.entries(ctaPatterns)) {
        if (pattern.test(desc)) {
            analysis.structureNarrative.ctaPresent = true;
            analysis.structureNarrative.ctaType = type;
            break;
        }
    }
    
    // ANALYSE DESCRIPTION
    analysis.structureNarrative.messageClaire = description.length > 15 && description.length < 500;
    analysis.optimisationPlateforme.descriptionEngageante = description.length > 30 && description.length < 300;
    analysis.optimisationPlateforme.longueurOptimale = description.length >= 50 && description.length <= 200;
    
    // ANALYSE HASHTAGS
    if (hashtags && hashtags.length > 0) {
        analysis.optimisationPlateforme.hashtagsPertinents = hashtags.length >= 3 && hashtags.length <= 10;
        
        // Hashtags tendance TikTok FR 2024
        const trendingHashtags = [
            'fyp', 'foryou', 'pourtoi', 'viral', 'trending', 'tiktokfrance', 'france',
            'comedy', 'funny', 'humour', 'dance', 'danse', 'tutorial', 'tuto',
            'lifestyle', 'ootd', 'mood', 'aesthetic', 'storytime', 'pov', 
            'transition', 'challenge', 'duet', 'makeup', 'beauté', 'fitness',
            'motivation', 'business', 'entrepreneur', 'food', 'cuisine', 'diy'
        ];
        
        analysis.tendances.hashtagsTendance = hashtags.filter(tag => 
            trendingHashtags.some(trend => tag.includes(trend) || trend.includes(tag))
        );
        analysis.tendances.utiliseTendance = analysis.tendances.hashtagsTendance.length > 0;
    }
    
    return analysis;
}

// Scoring TikTok réaliste
function calculateTikTokScore(stats, metrics, creativeAnalysis) {
    let score = 20; // Base plus réaliste
    
    if (!stats || !metrics) {
        return { score: 30, potentielViral: 'faible' };
    }
    
    // 1. PERFORMANCE QUANTITATIVE (50 points)
    // Taux d'engagement (critère #1 TikTok)
    if (metrics.engagementRate > 20) score += 25; // Viral
    else if (metrics.engagementRate > 10) score += 20; // Excellent
    else if (metrics.engagementRate > 5) score += 15; // Bon
    else if (metrics.engagementRate > 2) score += 10; // Moyen
    else if (metrics.engagementRate > 1) score += 5; // Faible
    
    // Volume ajusté selon ER
    if (stats.views > 10000000 && metrics.engagementRate > 3) score += 15;
    else if (stats.views > 1000000 && metrics.engagementRate > 2) score += 12;
    else if (stats.views > 100000 && metrics.engagementRate > 1) score += 8;
    else if (stats.views > 10000) score += 4;
    
    // Partages = viralité
    if (metrics.sharesRatio > 1) score += 10;
    else if (metrics.sharesRatio > 0.5) score += 6;
    else if (metrics.sharesRatio > 0.1) score += 3;
    
    // 2. OPTIMISATION CRÉATIVE (30 points)
    if (creativeAnalysis.structureNarrative.hookPresent) score += 8;
    if (creativeAnalysis.structureNarrative.ctaPresent) score += 5;
    if (creativeAnalysis.optimisationPlateforme.hashtagsPertinents) score += 7;
    if (creativeAnalysis.optimisationPlateforme.longueurOptimale) score += 5;
    if (creativeAnalysis.tendances.utiliseTendance) score += 5;
    
    // 3. FACTEURS ALGORITHMIQUES (20 points)
    // Comments = engagement fort
    if (metrics.commentsRatio > 2) score += 8;
    else if (metrics.commentsRatio > 1) score += 5;
    
    // Ratio global d'engagement
    if (metrics.viralityIndex > 50) score += 7;
    else if (metrics.viralityIndex > 20) score += 4;
    
    // Hashtags optimisés
    if (creativeAnalysis.optimisationPlateforme.hashtagsCount >= 5) score += 5;
    
    // Plafonnement réaliste
    score = Math.min(95, Math.max(15, score));
    
    let potentielViral = "faible";
    if (score >= 80) potentielViral = "élevé";
    else if (score >= 60) potentielViral = "moyen";
    
    return { score, potentielViral };
}

// Recommandations personnalisées
function generateRecommendations(stats, metrics, creativeAnalysis) {
    const recommendations = {
        points_forts: [],
        points_faibles: [],
        suggestions: []
    };
    
    if (!stats) {
        recommendations.suggestions.push("🔧 Vidéo inaccessible - Vérifiez les paramètres de confidentialité");
        return recommendations;
    }
    
    // Points forts
    if (metrics.engagementRate > 10) {
        recommendations.points_forts.push(`🚀 Excellent taux d'engagement (${metrics.engagementRate.toFixed(1)}%)`);
    }
    if (metrics.sharesRatio > 0.5) {
        recommendations.points_forts.push("📤 Fort taux de partage - Contenu viral");
    }
    if (creativeAnalysis.structureNarrative.hookPresent) {
        recommendations.points_forts.push(`🎯 Hook ${creativeAnalysis.structureNarrative.hookType} détecté`);
    }
    if (creativeAnalysis.tendances.utiliseTendance) {
        recommendations.points_forts.push("🔥 Utilise des hashtags tendance");
    }
    
    // Points faibles
    if (metrics.engagementRate < 2) {
        recommendations.points_faibles.push("📉 Taux d'engagement faible (< 2%)");
    }
    if (!creativeAnalysis.structureNarrative.hookPresent) {
        recommendations.points_faibles.push("🎣 Aucun hook détecté dans la description");
    }
    if (!creativeAnalysis.structureNarrative.ctaPresent) {
        recommendations.points_faibles.push("📢 Pas d'appel à l'action explicite");
    }
    if (creativeAnalysis.optimisationPlateforme.hashtagsCount < 3) {
        recommendations.points_faibles.push("🏷️ Pas assez de hashtags (3-8 recommandés)");
    }
    
    // Suggestions
    if (metrics.engagementRate < 5) {
        recommendations.suggestions.push("💡 Créer un hook plus percutant dans les 3 premières secondes");
        recommendations.suggestions.push("🤔 Poser des questions pour inciter aux commentaires");
    }
    
    if (!creativeAnalysis.structureNarrative.ctaPresent) {
        recommendations.suggestions.push("📣 Ajouter un CTA: 'Likez si vous êtes d'accord', 'Commentez votre avis'");
    }
    
    if (creativeAnalysis.optimisationPlateforme.hashtagsCount < 5) {
        recommendations.suggestions.push("🏷️ Ajouter des hashtags de niche + hashtags larges (#fyp, #pourtoi)");
    }
    
    if (metrics.commentsRatio < 1) {
        recommendations.suggestions.push("💬 Inciter davantage aux commentaires avec des questions controversées");
    }
    
    recommendations.suggestions.push("📊 Analyser les heures de publication optimales pour votre audience");
    
    return recommendations;
}

// Formatage nombres
function formatNumber(num) {
    if (!num || num === 0) return '0';
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    else if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    else if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// Handler principal optimisé
export default async function handler(req) {
    if (req.method !== 'POST') {
        return json({ error: 'Méthode non autorisée' }, 405);
    }

    try {
        const body = await req.json().catch(() => null);
        if (!body || !body.url) {
            return json({ error: 'URL manquante' }, 400);
        }

        const { url: tiktokUrl } = body;
        
        if (!validateTikTokUrl(tiktokUrl)) {
            return json({ error: 'URL TikTok invalide' }, 400);
        }

        analysisCount++;
        console.log(`🚀 Analyse #${analysisCount}: ${tiktokUrl}`);
        
        let oembedData = null;
        let stats = null;
        let htmlContent = null;

        // ÉTAPE 1: oEmbed (toujours en premier)
        try {
            console.log("📡 oEmbed...");
            const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`;
            const oembedResponse = await fetch(oembedUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; TikTokAnalyzer/2.0)'
                },
                signal: AbortSignal.timeout(10000)
            });

            if (oembedResponse.ok) {
                oembedData = await oembedResponse.json();
                console.log("✅ oEmbed réussi");
            } else {
                throw new Error(`oEmbed failed: ${oembedResponse.status}`);
            }
        } catch (error) {
            console.error("❌ Erreur oEmbed:", error.message);
            return json({ error: "Vidéo TikTok inaccessible ou privée" }, 404);
        }

        // ÉTAPE 2: ScrapingBee (si clé disponible)
        const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
        if (SCRAPINGBEE_API_KEY) {
            try {
                console.log("🕷️ ScrapingBee...");
                const scrapingBeeUrl = new URL('https://app.scrapingbee.com/api/v1/');
                scrapingBeeUrl.searchParams.set('api_key', SCRAPINGBEE_API_KEY);
                scrapingBeeUrl.searchParams.set('url', tiktokUrl);
                scrapingBeeUrl.searchParams.set('render_js', 'true');
                scrapingBeeUrl.searchParams.set('wait', '4000');
                scrapingBeeUrl.searchParams.set('premium_proxy', 'true');

                const response = await fetch(scrapingBeeUrl.toString(), {
                    signal: AbortSignal.timeout(35000)
                });

                if (response.ok) {
                    htmlContent = await response.text();
                    const data = findJsonBlob(htmlContent);
                    
                    if (data) {
                        const description = extractDescription(oembedData, htmlContent);
                        stats = extractStats(data, description, htmlContent);
                        
                        if (stats) {
                            console.log("✅ Stats extraites");
                        }
                    }
                } else {
                    console.warn(`⚠️ ScrapingBee échec: ${response.status}`);
                }
            } catch (error) {
                console.warn("⚠️ Échec ScrapingBee:", error.message);
            }
        }

        // ÉTAPE 3: Préparation données finales
        const description = extractDescription(oembedData, htmlContent);
        const thumbnail = oembedData?.thumbnail_url || null;
        const hashtags = stats?.hashtags || extractHashtags(description, htmlContent);

        // ÉTAPE 4: Calculs
        const metrics = stats ? calculateMetrics(stats) : null;
        const creativeAnalysis = analyzeCreativeContent(stats, description, hashtags);
        const scoreResult = calculateTikTokScore(stats, metrics, creativeAnalysis);
        const recommendations = generateRecommendations(stats, metrics, creativeAnalysis);

        // RÉPONSE FINALE
        const finalResponse = {
            success: true,
            video: {
                url: tiktokUrl,
                description,
                thumbnail,
                author: stats?.author || null,
                music: stats?.music || null,
                hashtags,
                createTime: stats?.createTime || null
            },
            stats: stats ? {
                views: stats.views,
                likes: stats.likes,
                comments: stats.comments,
                shares: stats.shares,
                formatted: {
                    views: formatNumber(stats.views),
                    likes: formatNumber(stats.likes),
                    comments: formatNumber(stats.comments),
                    shares: formatNumber(stats.shares)
                }
            } : null,
            metrics,
            analysis: {
                score: scoreResult.score,
                potentiel_viral: scoreResult.potentielViral,
                creative: creativeAnalysis,
                points_forts: recommendations.points_forts,
                points_faibles: recommendations.points_faibles,
                suggestions: recommendations.suggestions
            },
            metadata: {
                analysisTimestamp: new Date().toISOString(),
                analysisId: `TKA_${Date.now().toString(36).toUpperCase()}`,
                features: {
                    oembed: !!oembedData,
                    stats_extraction: !!stats,
                    scrapingbee: !!htmlContent
                }
            }
        };

        console.log(`✅ Analyse terminée - Score: ${scoreResult.score}/100 (${scoreResult.potentielViral})`);
        
        return json(finalResponse);

    } catch (error) {
        console.error("❌ Erreur critique:", error.message);
        
        return json({ 
            error: "Erreur interne du serveur",
            timestamp: new Date().toISOString()
        }, 500);
    }
}
