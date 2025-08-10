// analyze-video.js - Version optimisée pour éviter les timeouts 504
export const config = { runtime: "edge" };

// Base de données simulée
let analysisLogs = [];

// Fonction pour logger les analyses (version optimisée)
function logAnalysis(data) {
    try {
        const logEntry = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2),
            timestamp: new Date().toISOString(),
            url: data.url || null,
            author: data.author || 'Inconnu',
            stats: data.stats || null,
            user_ip: data.user_ip || null
        };
        
        analysisLogs.push(logEntry);
        if (analysisLogs.length > 500) { // Réduit de 1000 à 500
            analysisLogs = analysisLogs.slice(-500);
        }
        
        console.log(`📝 Analyse: ${logEntry.id}`);
        return logEntry.id;
    } catch (error) {
        console.error("❌ Erreur logging:", error);
        return null;
    }
}

// Fonction pour parser les données JSON TikTok (optimisée)
function findJsonBlob(html) {
    try {
        // Essayer SIGI_STATE en premier (plus rapide)
        let scriptContent = html.split('<script id="SIGI_STATE" type="application/json">')[1]?.split('</script>')[0];
        if (scriptContent) {
            return JSON.parse(scriptContent);
        }
        
        // Essayer __UNIVERSAL_DATA_FOR_REHYDRATION__
        scriptContent = html.split('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">')[1]?.split('</script>')[0];
        if (scriptContent) {
            return JSON.parse(scriptContent);
        }
        
        return null;
    } catch (error) {
        console.error("❌ Erreur parsing JSON:", error.message);
        return null;
    }
}

// Extraction des stats (version simplifiée)
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

        // Essayer ItemModule
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
        // Essayer __DEFAULT_SCOPE__
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
        
        return extractedData.views > 0 ? extractedData : null;
        
    } catch (error) {
        console.error("❌ Erreur extraction stats:", error.message);
        return null;
    }
}

// Calcul des métriques (version rapide)
function calculateAdvancedMetrics(stats) {
    if (!stats || !stats.views || stats.views === 0) {
        return {
            engagementRate: 0,
            likesRatio: 0,
            commentsRatio: 0,
            sharesRatio: 0,
            totalEngagements: 0,
            viralityIndex: 0
        };
    }

    const totalEngagements = (stats.likes || 0) + (stats.comments || 0) + (stats.shares || 0);
    
    return {
        engagementRate: (totalEngagements / stats.views) * 100,
        likesRatio: ((stats.likes || 0) / stats.views) * 100,
        commentsRatio: ((stats.comments || 0) / stats.views) * 100,
        sharesRatio: ((stats.shares || 0) / stats.views) * 100,
        totalEngagements,
        viralityIndex: Math.min(100, (((stats.shares || 0) * 10) + ((stats.comments || 0) * 4) + ((stats.likes || 0) * 2)) / stats.views * 100)
    };
}

// Analyse créative (version simplifiée et rapide)
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
            descriptionEngageante: false
        },
        tendances: {
            utiliseTendance: false,
            hashtagsTendance: []
        }
    };
    
    if (description) {
        const desc = description.toLowerCase();
        
        // Détection rapide du hook
        const hookPatterns = {
            question: /^(pourquoi|comment|qui|que|quoi|où|quand)/,
            secret: /(secret|astuce|conseil|truc)/,
            number: /^\d+/,
            negation: /(pas|jamais|aucun|stop)/
        };
        
        for (const [type, pattern] of Object.entries(hookPatterns)) {
            if (pattern.test(desc)) {
                analysis.structureNarrative.hookPresent = true;
                analysis.structureNarrative.hookType = type;
                break;
            }
        }
        
        // Détection rapide du CTA
        const ctaPatterns = {
            subscribe: /(abonne|follow|suit)/,
            engage: /(like|commente|partage)/,
            action: /(clique|va sur|regarde)/
        };
        
        for (const [type, pattern] of Object.entries(ctaPatterns)) {
            if (pattern.test(desc)) {
                analysis.structureNarrative.ctaPresent = true;
                analysis.structureNarrative.ctaType = type;
                break;
            }
        }
        
        analysis.structureNarrative.messageClaire = description.length > 10 && description.length < 300;
        analysis.optimisationPlateforme.descriptionEngageante = description.length > 20;
    }
    
    // Analyse des hashtags
    if (hashtags && hashtags.length > 0) {
        analysis.optimisationPlateforme.hashtagsPertinents = hashtags.length >= 3 && hashtags.length <= 8;
        
        const hashtagsTendance = ['fyp', 'viral', 'trending', 'pourtoi'];
        analysis.tendances.hashtagsTendance = hashtags.filter(tag => 
            hashtagsTendance.some(trend => tag.toLowerCase().includes(trend))
        );
        analysis.tendances.utiliseTendance = analysis.tendances.hashtagsTendance.length > 0;
    }
    
    return analysis;
}

// Scoring prédictif (version rapide)
function calculatePredictiveScore(stats, metrics, creativeAnalysis) {
    let score = 50;
    
    // Performance quantitative (60% du score)
    if (metrics.engagementRate > 15) score += 20;
    else if (metrics.engagementRate > 10) score += 15;
    else if (metrics.engagementRate > 5) score += 10;
    else if (metrics.engagementRate > 2) score += 5;
    
    if (metrics.likesRatio > 10) score += 15;
    else if (metrics.likesRatio > 5) score += 10;
    
    if (stats.views > 1000000) score += 15;
    else if (stats.views > 100000) score += 10;
    else if (stats.views > 10000) score += 5;
    
    // Analyse créative (40% du score)
    if (creativeAnalysis.structureNarrative.hookPresent) score += 8;
    if (creativeAnalysis.structureNarrative.messageClaire) score += 6;
    if (creativeAnalysis.structureNarrative.ctaPresent) score += 4;
    if (creativeAnalysis.optimisationPlateforme.hashtagsPertinents) score += 6;
    if (creativeAnalysis.optimisationPlateforme.descriptionEngageante) score += 3;
    if (creativeAnalysis.tendances.utiliseTendance) score += 3;
    
    let potentielViral = "faible";
    if (score >= 85) potentielViral = "élevé";
    else if (score >= 70) potentielViral = "moyen";
    
    return { score: Math.min(100, Math.max(0, score)), potentielViral };
}

// Génération de recommandations (version simplifiée)
function generateRecommendations(stats, metrics, creativeAnalysis) {
    const recommendations = {
        points_forts: [],
        points_faibles: [],
        suggestions: []
    };
    
    // Points forts (max 3)
    if (metrics.engagementRate > 10) {
        recommendations.points_forts.push(`Excellent taux d'engagement (${metrics.engagementRate.toFixed(1)}%)`);
    }
    if (metrics.likesRatio > 8) {
        recommendations.points_forts.push("Ratio likes/vues élevé - Contenu apprécié");
    }
    if (creativeAnalysis.structureNarrative.hookPresent) {
        recommendations.points_forts.push(`Hook ${creativeAnalysis.structureNarrative.hookType} détecté`);
    }
    
    // Points faibles (max 3)
    if (metrics.engagementRate < 3) {
        recommendations.points_faibles.push("Taux d'engagement faible");
    }
    if (!creativeAnalysis.structureNarrative.hookPresent) {
        recommendations.points_faibles.push("Absence de hook détectable");
    }
    if (!creativeAnalysis.structureNarrative.ctaPresent) {
        recommendations.points_faibles.push("Aucun appel à l'action explicite");
    }
    
    // Suggestions (max 3)
    if (metrics.engagementRate < 5) {
        recommendations.suggestions.push("🎯 Créer un hook plus percutant");
    }
    if (!creativeAnalysis.structureNarrative.ctaPresent) {
        recommendations.suggestions.push("📢 Ajouter un CTA clair");
    }
    recommendations.suggestions.push("📊 Analyser cette vidéo comme référence");
    
    return recommendations;
}

// Validation URL TikTok (version optimisée)
function validateTikTokUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    const patterns = [
        /^https?:\/\/(www\.|vm\.|m\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
        /^https?:\/\/vm\.tiktok\.com\/[\w]+/,
        /^https?:\/\/www\.tiktok\.com\/t\/[\w]+/
    ];
    return patterns.some(pattern => pattern.test(url));
}

// Formatage des nombres
function formatNumber(num) {
    if (!num || num === 0) return '0';
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    else if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    else if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// Extraction des infos utilisateur (version rapide)
function extractUserInfo(request) {
    try {
        const headers = request.headers;
        return {
            ip: headers.get('x-forwarded-for') || headers.get('x-real-ip') || 'unknown',
            userAgent: headers.get('user-agent') || 'unknown',
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        return {
            ip: 'unknown',
            userAgent: 'unknown',
            timestamp: new Date().toISOString()
        };
    }
}

// Fonction de réponse JSON
function jsonResponse(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': status === 200 ? 'public, max-age=300' : 'no-cache',
            ...headers
        }
    });
}

// Handler principal OPTIMISÉ pour éviter les timeouts
export default async function handler(req) {
    // Timeout global de la fonction - 25 secondes max
    const globalTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('GLOBAL_TIMEOUT')), 25000);
    });

    try {
        return await Promise.race([globalTimeout, analyzeVideoHandler(req)]);
    } catch (error) {
        if (error.message === 'GLOBAL_TIMEOUT') {
            console.error('❌ Timeout global atteint');
            return jsonResponse({
                error: 'Analyse trop longue',
                errorCode: 'TIMEOUT_ERROR',
                details: 'L\'analyse a pris trop de temps. Réessayez avec une vidéo plus simple.'
            }, 504);
        }
        throw error;
    }
}

async function analyzeVideoHandler(req) {
    if (req.method !== 'POST') {
        return jsonResponse({
            error: 'Méthode non autorisée',
            errorCode: 'METHOD_NOT_ALLOWED'
        }, 405);
    }

    let body;
    try {
        body = await req.json();
    } catch (error) {
        return jsonResponse({
            error: 'Corps de requête JSON invalide',
            errorCode: 'INVALID_JSON'
        }, 400);
    }

    if (!body || !body.url) {
        return jsonResponse({
            error: 'URL manquante',
            errorCode: 'MISSING_URL'
        }, 400);
    }

    const { url: tiktokUrl } = body;
    
    if (!validateTikTokUrl(tiktokUrl)) {
        return jsonResponse({
            error: 'URL TikTok invalide',
            errorCode: 'INVALID_TIKTOK_URL',
            details: 'Format attendu: https://www.tiktok.com/@username/video/123456789'
        }, 400);
    }

    console.log(`🚀 Analyse rapide: ${tiktokUrl}`);
    
    // Extraction des infos utilisateur
    const userInfo = extractUserInfo(req);

    let description = null;
    let thumbnail = null;
    let stats = null;

    // Étape 1: oEmbed (timeout réduit à 8 secondes)
    try {
        console.log("📡 oEmbed...");
        const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`;
        const oembedResponse = await fetch(oembedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: AbortSignal.timeout(8000) // Réduit de 15s à 8s
        });

        if (oembedResponse.ok) {
            const oembedData = await oembedResponse.json();
            description = oembedData.title || "Description non disponible";
            thumbnail = oembedData.thumbnail_url;
            console.log("✅ oEmbed réussi");
        } else {
            throw new Error(`oEmbed failed: ${oembedResponse.status}`);
        }
    } catch (error) {
        console.error("❌ Erreur oEmbed:", error.message);
        return jsonResponse({
            error: "Impossible d'accéder à cette vidéo TikTok",
            errorCode: 'OEMBED_FAILED',
            details: 'La vidéo est peut-être privée, supprimée ou géo-restreinte'
        }, 404);
    }

    // Étape 2: ScrapingBee (timeout réduit et optionnel)
    const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
    if (SCRAPINGBEE_API_KEY) {
        try {
            console.log("🕷️ ScrapingBee...");
            const scrapingBeeUrl = new URL('https://app.scrapingbee.com/api/v1/');
            scrapingBeeUrl.searchParams.set('api_key', SCRAPINGBEE_API_KEY);
            scrapingBeeUrl.searchParams.set('url', tiktokUrl);
            scrapingBeeUrl.searchParams.set('render_js', 'true');
            scrapingBeeUrl.searchParams.set('wait', '2000'); // Réduit de 4000 à 2000

            const response = await fetch(scrapingBeeUrl.toString(), {
                signal: AbortSignal.timeout(15000) // Réduit de 35s à 15s
            });

            if (response.ok) {
                const html = await response.text();
                const data = findJsonBlob(html);
                if (data) {
                    stats = extractStats(data);
                    if (stats) {
                        console.log("✅ Stats extraites");
                        if (stats.description && stats.description.length > description.length) {
                            description = stats.description;
                        }
                    }
                }
            }
        } catch (error) {
            console.warn("⚠️ ScrapingBee timeout/échec - Continuation avec données de base");
            // On continue avec les données oEmbed même si ScrapingBee échoue
        }
    }

    // Calculs et analyses (version rapide)
    const metrics = stats ? calculateAdvancedMetrics(stats) : null;
    const creativeAnalysis = analyzeCreativeContent(stats, description, stats?.hashtags);
    const predictiveScore = stats ? calculatePredictiveScore(stats, metrics, creativeAnalysis) : { score: 50, potentielViral: 'moyen' };
    const recommendations = stats ? generateRecommendations(stats, metrics, creativeAnalysis) : null;

    // Enregistrement de l'analyse (rapide)
    const logId = logAnalysis({
        url: tiktokUrl,
        author: stats?.author,
        stats: stats,
        user_ip: userInfo.ip,
        user_agent: userInfo.userAgent
    });

    // Réponse finale (optimisée)
    const finalResponse = {
        success: true,
        analysisId: logId,
        analysisType: "framework_optimise_rapide",
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
        analysis: {
            score: predictiveScore.score,
            potentiel_viral: predictiveScore.potentielViral,
            points_forts: recommendations?.points_forts || [],
            points_faibles: recommendations?.points_faibles || [],
            suggestions: recommendations?.suggestions || [],
            creative: creativeAnalysis
        },
        metadata: {
            analysisTimestamp: new Date().toISOString(),
            frameworkVersion: "5.1-optimized",
            apiEndpoint: "/api/analyze-video",
            userInfo: {
                timestamp: userInfo.timestamp
            },
            features: {
                oembed: !!thumbnail,
                stats_extraction: !!stats,
                video_analysis: false, // Désactivé pour la rapidité
                audio_transcription: false, // Désactivé pour la rapidité
                logging: !!logId
            }
        }
    };

    console.log(`✅ Analyse rapide terminée - ID: ${logId}`);
    console.log(`🎯 Score: ${predictiveScore.score}/100 (${predictiveScore.potentielViral})`);
    
    return jsonResponse(finalResponse, 200, {
        'X-Analysis-ID': logId || 'unknown',
        'X-Framework-Version': '5.1-optimized'
    });
}

// Endpoint GET simplifié
export async function GET(req) {
    try {
        const url = new URL(req.url);
        const showLogs = url.searchParams.get('logs') === 'true';
        
        if (showLogs) {
            return jsonResponse({
                success: true,
                stats: {
                    total_analyses: analysisLogs.length,
                    derniere_analyse: analysisLogs.length > 0 ? analysisLogs[analysisLogs.length - 1].timestamp : null
                },
                recent_analyses: analysisLogs.slice(-5) // Seulement 5 dernières
            });
        }
        
        return jsonResponse({
            error: "Endpoint GET non supporté sans paramètre logs=true"
        }, 405);
        
    } catch (error) {
        return jsonResponse({
            error: "Erreur lors de la récupération des logs"
        }, 500);
    }
}
