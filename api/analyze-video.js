// ANALYSEUR TIKTOK CORRIGÉ - VERSION RÉALISTE
export const config = { runtime: "edge" };

// Validation URL TikTok améliorée
function validateTikTokUrl(url) {
    const patterns = [
        /^https?:\/\/(www\.|vm\.|m\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
        /^https?:\/\/vm\.tiktok\.com\/[\w]+/,
        /^https?:\/\/www\.tiktok\.com\/t\/[\w]+/
    ];
    return patterns.some(pattern => pattern.test(url));
}

// Extraction description améliorée
function extractDescription(oembedData, htmlContent) {
    let description = "";
    
    // 1. Priorité oEmbed title (plus fiable)
    if (oembedData?.title) {
        description = oembedData.title;
    }
    
    // 2. Fallback: parsing HTML meta tags
    if (!description && htmlContent) {
        const metaMatch = htmlContent.match(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"[^>]*>/i);
        if (metaMatch) {
            description = metaMatch[1];
        }
    }
    
    // 3. Nettoyage
    description = description.replace(/\s+/g, ' ').trim();
    
    return description || "Description non disponible";
}

// Extraction hashtags réaliste
function extractHashtags(description, htmlContent = null) {
    const hashtags = [];
    
    if (!description) return hashtags;
    
    // 1. Regex pour hashtags dans la description
    const hashtagRegex = /#[\w\u00C0-\u017F]+/g;
    const matches = description.match(hashtagRegex);
    
    if (matches) {
        hashtags.push(...matches.map(tag => tag.slice(1))); // Enlever le #
    }
    
    // 2. Si peu de hashtags trouvés, chercher dans le HTML
    if (hashtags.length < 2 && htmlContent) {
        const htmlHashtags = htmlContent.match(/#[\w\u00C0-\u017F]+/g);
        if (htmlHashtags) {
            htmlHashtags.forEach(tag => {
                const cleanTag = tag.slice(1);
                if (!hashtags.includes(cleanTag)) {
                    hashtags.push(cleanTag);
                }
            });
        }
    }
    
    // 3. Limiter et nettoyer
    return hashtags.slice(0, 20).filter(tag => tag.length > 1);
}

// Parsing JSON TikTok plus robuste
function findJsonBlob(html) {
    try {
        // Méthode 1: SIGI_STATE
        let match = html.match(/<script id="SIGI_STATE" type="application\/json">([^<]*)<\/script>/);
        if (match) {
            console.log("✅ Données via SIGI_STATE");
            return JSON.parse(match[1]);
        }
        
        // Méthode 2: __UNIVERSAL_DATA_FOR_REHYDRATION__
        match = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([^<]*)<\/script>/);
        if (match) {
            console.log("✅ Données via __UNIVERSAL_DATA_FOR_REHYDRATION__");
            return JSON.parse(match[1]);
        }
        
        // Méthode 3: window.__INITIAL_STATE__
        match = html.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/s);
        if (match) {
            console.log("✅ Données via __INITIAL_STATE__");
            return JSON.parse(match[1]);
        }
        
        return null;
    } catch (error) {
        console.error("❌ Erreur parsing JSON:", error.message);
        return null;
    }
}

// Extraction stats réaliste
function extractStats(data, description, htmlContent) {
    try {
        let extractedData = {
            views: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            author: null,
            hashtags: [],
            description: description
        };

        // Méthode 1: ItemModule structure
        if (data.ItemModule) {
            const videoId = Object.keys(data.ItemModule)[0];
            const itemStruct = data.ItemModule[videoId];
            
            if (itemStruct?.stats) {
                extractedData.views = parseInt(itemStruct.stats.playCount) || 0;
                extractedData.likes = parseInt(itemStruct.stats.diggCount) || 0;
                extractedData.comments = parseInt(itemStruct.stats.commentCount) || 0;
                extractedData.shares = parseInt(itemStruct.stats.shareCount) || 0;
                extractedData.author = itemStruct.author?.uniqueId || null;
                
                // Description plus complète si disponible
                if (itemStruct.desc && itemStruct.desc.length > description.length) {
                    extractedData.description = itemStruct.desc;
                }
            }
        }
        
        // Méthode 2: webapp.video-detail structure
        else if (data['__DEFAULT_SCOPE__']?.['webapp.video-detail']?.itemInfo?.itemStruct) {
            const itemStruct = data['__DEFAULT_SCOPE__']['webapp.video-detail'].itemInfo.itemStruct;
            
            if (itemStruct.stats) {
                extractedData.views = parseInt(itemStruct.stats.playCount) || 0;
                extractedData.likes = parseInt(itemStruct.stats.diggCount) || 0;
                extractedData.comments = parseInt(itemStruct.stats.commentCount) || 0;
                extractedData.shares = parseInt(itemStruct.stats.shareCount) || 0;
                extractedData.author = itemStruct.author?.uniqueId || null;
                
                if (itemStruct.desc && itemStruct.desc.length > description.length) {
                    extractedData.description = itemStruct.desc;
                }
            }
        }
        
        // Extraction hashtags depuis la description finale
        extractedData.hashtags = extractHashtags(extractedData.description, htmlContent);
        
        return extractedData.views > 0 ? extractedData : null;
        
    } catch (error) {
        console.error("❌ Erreur extraction stats:", error.message);
        return null;
    }
}

// Analyse créative RÉALISTE (basée sur données réelles)
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
    
    // DÉTECTION HOOK (basée sur vraies patterns TikTok)
    const hookPatterns = {
        question: /^(pourquoi|comment|qui|que|quoi|où|quand|est-ce que)/,
        secret: /(secret|astuce|conseil|truc|technique)/,
        chiffres: /^\d+/,
        negatif: /(jamais|pas|arrête|stop|erreur)/,
        fomo: /(urgent|limité|dernier|rapidement|maintenant)/,
        promesse: /(comment|façon de|méthode|tutorial)/
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
        action: /(clique|va sur|regarde|découvre|lien|bio)/
    };
    
    for (const [type, pattern] of Object.entries(ctaPatterns)) {
        if (pattern.test(desc)) {
            analysis.structureNarrative.ctaPresent = true;
            analysis.structureNarrative.ctaType = type;
            break;
        }
    }
    
    // ANALYSE DESCRIPTION
    analysis.structureNarrative.messageClaire = description.length > 10 && description.length < 500;
    analysis.optimisationPlateforme.descriptionEngageante = description.length > 20 && description.length < 300;
    analysis.optimisationPlateforme.longueurOptimale = description.length >= 50 && description.length <= 200;
    
    // ANALYSE HASHTAGS
    if (hashtags && hashtags.length > 0) {
        analysis.optimisationPlateforme.hashtagsPertinents = hashtags.length >= 3 && hashtags.length <= 10;
        
        // Hashtags tendance TikTok réels
        const hashtagsTrendingFR = [
            'fyp', 'foryou', 'pourtoi', 'viral', 'trending', 'france', 'tiktokfrance',
            'comedy', 'funny', 'dance', 'tutorial', 'lifestyle', 'ootd', 'mood',
            'storytime', 'pov', 'transition', 'challenge', 'duet', 'makeup'
        ];
        
        analysis.tendances.hashtagsTendance = hashtags.filter(tag => 
            hashtagsTrendingFR.some(trend => tag.toLowerCase().includes(trend))
        );
        analysis.tendances.utiliseTendance = analysis.tendances.hashtagsTendance.length > 0;
    }
    
    return analysis;
}

// Scoring RÉALISTE basé sur benchmarks TikTok
function calculateRealisticScore(stats, metrics, creativeAnalysis) {
    let score = 30; // Score de base plus bas
    
    if (!stats || !metrics) return { score: 30, potentielViral: 'faible' };
    
    // PERFORMANCE QUANTITATIVE (50 points max)
    // Taux d'engagement (critère principal)
    if (metrics.engagementRate > 20) score += 25; // Exceptionnel
    else if (metrics.engagementRate > 10) score += 20; // Excellent
    else if (metrics.engagementRate > 5) score += 15; // Bon
    else if (metrics.engagementRate > 2) score += 10; // Moyen
    else if (metrics.engagementRate > 1) score += 5; // Faible
    
    // Volume de vues (pondéré selon l'ER)
    if (stats.views > 10000000) score += 15; // 10M+
    else if (stats.views > 1000000) score += 12; // 1M+
    else if (stats.views > 100000) score += 8; // 100K+
    else if (stats.views > 10000) score += 4; // 10K+
    
    // Ratio partages (très important pour viralité)
    if (metrics.sharesRatio > 1) score += 10;
    else if (metrics.sharesRatio > 0.5) score += 6;
    else if (metrics.sharesRatio > 0.1) score += 3;
    
    // OPTIMISATION CRÉATIVE (30 points max)
    if (creativeAnalysis.structureNarrative.hookPresent) score += 8;
    if (creativeAnalysis.structureNarrative.ctaPresent) score += 5;
    if (creativeAnalysis.optimisationPlateforme.hashtagsPertinents) score += 7;
    if (creativeAnalysis.optimisationPlateforme.longueurOptimale) score += 5;
    if (creativeAnalysis.tendances.utiliseTendance) score += 5;
    
    // BONUS ALGORITHME (20 points max)
    if (creativeAnalysis.optimisationPlateforme.hashtagsCount >= 5) score += 5;
    if (metrics.commentsRatio > 1) score += 8; // Comments = engagement fort
    if (stats.views > 0 && (stats.likes + stats.comments + stats.shares) / stats.views > 0.1) score += 7;
    
    // Plafonnement réaliste
    score = Math.min(95, Math.max(20, score));
    
    let potentielViral = "faible";
    if (score >= 80) potentielViral = "élevé";
    else if (score >= 60) potentielViral = "moyen";
    
    return { score, potentielViral };
}

// Handler principal SIMPLIFIÉ
export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { 
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await req.json().catch(() => null);
        if (!body || !body.url) {
            return new Response(JSON.stringify({ error: 'URL manquante' }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const { url: tiktokUrl } = body;
        
        if (!validateTikTokUrl(tiktokUrl)) {
            return new Response(JSON.stringify({ error: 'URL TikTok invalide' }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log(`🚀 Analyse réaliste: ${tiktokUrl}`);
        
        let oembedData = null;
        let stats = null;
        let htmlContent = null;

        // ÉTAPE 1: oEmbed (infos de base fiables)
        try {
            console.log("📡 Récupération oEmbed...");
            const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`;
            const oembedResponse = await fetch(oembedUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                signal: AbortSignal.timeout(10000)
            });

            if (oembedResponse.ok) {
                oembedData = await oembedResponse.json();
                console.log("✅ oEmbed réussi");
            }
        } catch (error) {
            console.error("❌ Erreur oEmbed:", error.message);
            return new Response(JSON.stringify({ 
                error: "Impossible d'accéder à cette vidéo TikTok"
            }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // ÉTAPE 2: ScrapingBee (stats détaillées)
        const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
        if (SCRAPINGBEE_API_KEY) {
            try {
                console.log("🕷️ Récupération stats via ScrapingBee...");
                const scrapingBeeUrl = new URL('https://app.scrapingbee.com/api/v1/');
                scrapingBeeUrl.searchParams.set('api_key', SCRAPINGBEE_API_KEY);
                scrapingBeeUrl.searchParams.set('url', tiktokUrl);
                scrapingBeeUrl.searchParams.set('render_js', 'true');
                scrapingBeeUrl.searchParams.set('wait', '3000');

                const response = await fetch(scrapingBeeUrl.toString(), {
                    signal: AbortSignal.timeout(30000)
                });

                if (response.ok) {
                    htmlContent = await response.text();
                    const data = findJsonBlob(htmlContent);
                    if (data) {
                        const description = extractDescription(oembedData, htmlContent);
                        stats = extractStats(data, description, htmlContent);
                        console.log("✅ Stats extraites via ScrapingBee");
                    }
                }
            } catch (error) {
                console.warn("⚠️ Échec ScrapingBee:", error.message);
            }
        }

        // PRÉPARATION DES DONNÉES
        const description = extractDescription(oembedData, htmlContent);
        const thumbnail = oembedData?.thumbnail_url || null;
        const author = stats?.author || null;
        const hashtags = stats?.hashtags || extractHashtags(description);

        // CALCULS RÉALISTES
        const metrics = stats ? {
            engagementRate: ((stats.likes + stats.comments + stats.shares) / stats.views) * 100,
            likesRatio: (stats.likes / stats.views) * 100,
            commentsRatio: (stats.comments / stats.views) * 100,
            sharesRatio: (stats.shares / stats.views) * 100,
            totalEngagements: stats.likes + stats.comments + stats.shares
        } : null;

        const creativeAnalysis = analyzeCreativeContent(stats, description, hashtags);
        const predictiveScore = calculateRealisticScore(stats, metrics, creativeAnalysis);

        // RECOMMANDATIONS RÉALISTES
        const recommendations = [];
        if (stats) {
            if (metrics.engagementRate < 3) {
                recommendations.push("🎯 Taux d'engagement faible - Améliorer le hook des 3 premières secondes");
            }
            if (!creativeAnalysis.structureNarrative.hookPresent) {
                recommendations.push("🪝 Aucun hook détecté - Commencer par une question ou chiffre marquant");
            }
            if (hashtags.length < 3) {
                recommendations.push("🏷️ Ajouter plus d'hashtags pertinents (3-8 recommandés)");
            }
            if (!creativeAnalysis.structureNarrative.ctaPresent) {
                recommendations.push("📢 Ajouter un appel à l'action clair en fin de vidéo");
            }
        }

        // RÉPONSE FINALE RÉALISTE
        const response = {
            success: true,
            video: {
                url: tiktokUrl,
                description,
                thumbnail,
                author,
                hashtags
            },
            stats: stats ? {
                views: stats.views,
                likes: stats.likes,
                comments: stats.comments,
                shares: stats.shares,
                formatted: {
                    views: stats.views.toLocaleString(),
                    likes: stats.likes.toLocaleString(),
                    comments: stats.comments.toLocaleString(),
                    shares: stats.shares.toLocaleString()
                }
            } : null,
            metrics,
            analysis: {
                score: predictiveScore.score,
                potentiel_viral: predictiveScore.potentielViral,
                creative: creativeAnalysis,
                suggestions: recommendations
            },
            metadata: {
                analysisTimestamp: new Date().toISOString(),
                features: {
                    oembed: !!oembedData,
                    stats_extraction: !!stats,
                    realistic_scoring: true
                }
            }
        };

        console.log(`✅ Analyse terminée - Score: ${predictiveScore.score}/100`);
        
        return new Response(JSON.stringify(response), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("❌ Erreur critique:", error.message);
        
        return new Response(JSON.stringify({ 
            error: "Erreur interne du serveur",
            details: process.env.NODE_ENV === 'development' ? error.message : "Erreur de traitement"
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
