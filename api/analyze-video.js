// api/analyze-video.js - Version COMPLÈTE avec Node.js runtime (60s timeout)
export const config = { runtime: "nodejs" };

// Base de données en mémoire (CONSERVÉE)
let analyticsDatabase = [];

// Headers CORS
const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=300'
};

function json(res, status = 200) {
    return new Response(JSON.stringify(res), { status, headers: corsHeaders });
}

// Validation URL TikTok (CONSERVÉE)
function validateTikTokUrl(url) {
    const patterns = [
        /^https?:\/\/(www\.|vm\.|m\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
        /^https?:\/\/vm\.tiktok\.com\/[\w]+/,
        /^https?:\/\/www\.tiktok\.com\/t\/[\w]+/
    ];
    return patterns.some(pattern => pattern.test(url));
}

// Hashtags TikTok 2025 COMPLETS (CONSERVÉS)
function getTrendingHashtags2025() {
    return {
        generaux: [
            'fyp', 'foryou', 'foryoupage', 'pourtoi', 'pourvouspage',
            'viral', 'trending', 'trend', 'explorer', 'découvrir'
        ],
        tendance2025: [
            'tiktokmademebuyit', 'coquette', 'charger', 'aurafarming',
            'triangledesbermudes', 'rapfr', 'raptok'
        ],
        france: [
            'tiktokfrance', 'france', 'psg', 'marseille', 'lyon'
        ],
        niches: [
            'foodtok', 'cooking', 'cook', 'fashionhaul', 'ootd', 'style',
            'glowup', 'capcuttemplate', 'capcutedit', 'learnfrench',
            'frenchlesson', 'booktok', 'fitness', 'musculation',
            'photography', 'shootingtime', 'diy', 'lifestyle'
        ]
    };
}

// Extraction description optimisée (CONSERVÉE)
function extractDescription(oembedData, htmlContent = null) {
    let description = "";
    
    if (oembedData?.title) {
        description = oembedData.title;
    }
    
    if (!description && htmlContent) {
        const metaMatches = [
            htmlContent.match(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"[^>]*>/i),
            htmlContent.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"[^>]*>/i)
        ];
        
        for (const match of metaMatches) {
            if (match && match[1]) {
                description = match[1];
                break;
            }
        }
    }
    
    return description
        .replace(/\s+/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .trim() || "Description non disponible";
}

// Extraction hashtags 2025 (CONSERVÉE)
function extractHashtags(description, htmlContent = null) {
    const hashtags = new Set();
    
    if (description) {
        const hashtagRegex = /#[\w\u00C0-\u017F]+/g;
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
    
    return Array.from(hashtags).slice(0, 15);
}

// Parsing JSON TikTok COMPLET (CONSERVÉ)
function findJsonBlob(html) {
    const methods = [
        { name: "SIGI_STATE", regex: /<script id="SIGI_STATE" type="application\/json">([^<]*)<\/script>/ },
        { name: "__UNIVERSAL_DATA_FOR_REHYDRATION__", regex: /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([^<]*)<\/script>/ },
        { name: "__INITIAL_STATE__", regex: /window\.__INITIAL_STATE__\s*=\s*({.*?});/s }
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
            continue;
        }
    }
    
    return null;
}

// Extraction stats COMPLÈTE avec données utilisateur (CONSERVÉE)
function extractStats(data, description, htmlContent) {
    const stats = {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        author: null,
        authorFollowers: null,
        music: null,
        createTime: null,
        hashtags: [],
        description: description
    };

    try {
        let itemStruct = null;
        let userInfo = null;
        
        // Extraction données vidéo
        if (data.ItemModule) {
            const videoId = Object.keys(data.ItemModule)[0];
            itemStruct = data.ItemModule[videoId];
        } else if (data['__DEFAULT_SCOPE__']?.['webapp.video-detail']?.itemInfo?.itemStruct) {
            itemStruct = data['__DEFAULT_SCOPE__']['webapp.video-detail'].itemInfo.itemStruct;
        }
        
        if (itemStruct?.stats) {
            stats.views = parseInt(itemStruct.stats.playCount) || 0;
            stats.likes = parseInt(itemStruct.stats.diggCount) || 0;
            stats.comments = parseInt(itemStruct.stats.commentCount) || 0;
            stats.shares = parseInt(itemStruct.stats.shareCount) || 0;
            
            stats.author = itemStruct.author?.uniqueId || null;
            stats.authorFollowers = parseInt(itemStruct.author?.stats?.followerCount) || null;
            stats.music = itemStruct.music?.title || null;
            stats.createTime = itemStruct.createTime ? new Date(itemStruct.createTime * 1000) : null;
            
            if (itemStruct.desc && itemStruct.desc.length > description.length) {
                stats.description = itemStruct.desc;
            }
        }
        
        // Extraction données utilisateur si disponibles
        if (data.UserModule && stats.author) {
            userInfo = data.UserModule[stats.author];
            if (userInfo?.stats?.followerCount) {
                stats.authorFollowers = parseInt(userInfo.stats.followerCount);
            }
        }
        
        stats.hashtags = extractHashtags(stats.description, htmlContent);
        
        return stats.views > 0 ? stats : null;
        
    } catch (error) {
        console.error("❌ Erreur extraction stats:", error.message);
        return null;
    }
}

// Métriques de base (CONSERVÉES)
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
        engagementRate: (totalEngagements / stats.views) * 100,
        likesRatio: (stats.likes / stats.views) * 100,
        commentsRatio: (stats.comments / stats.views) * 100,
        sharesRatio: (stats.shares / stats.views) * 100,
        totalEngagements
    };
}

// Analyse SEO TikTok 2025 COMPLÈTE (CONSERVÉE)
function analyzeSEO(description, hashtags) {
    const trending = getTrendingHashtags2025();
    const allTrendingTags = [
        ...trending.generaux,
        ...trending.tendance2025,
        ...trending.france,
        ...trending.niches
    ];
    
    const analysis = {
        description: {
            longueur: description.length,
            longueurOptimale: description.length >= 50 && description.length <= 200,
            contientMotsCles: false,
            lisibilite: 'moyenne'
        },
        hashtags: {
            nombre: hashtags.length,
            nombreOptimal: hashtags.length >= 3 && hashtags.length <= 6,
            tendance2025: [],
            generiques: [],
            niche: []
        },
        score_seo: 0
    };
    
    // Analyse description
    const desc = description.toLowerCase();
    const motsClesTikTok = ['comment', 'pourquoi', 'astuce', 'conseil', 'secret', 'découvrez'];
    analysis.description.contientMotsCles = motsClesTikTok.some(mot => desc.includes(mot));
    
    if (description.length < 30) analysis.description.lisibilite = 'faible';
    else if (description.length > 300) analysis.description.lisibilite = 'trop_longue';
    else analysis.description.lisibilite = 'bonne';
    
    // Analyse hashtags
    hashtags.forEach(tag => {
        if (trending.generaux.includes(tag) || trending.tendance2025.includes(tag)) {
            analysis.hashtags.tendance2025.push(tag);
        } else if (trending.france.includes(tag)) {
            analysis.hashtags.generiques.push(tag);
        } else if (trending.niches.includes(tag)) {
            analysis.hashtags.niche.push(tag);
        }
    });
    
    // Score SEO
    let score = 0;
    if (analysis.description.longueurOptimale) score += 25;
    if (analysis.description.contientMotsCles) score += 15;
    if (analysis.hashtags.nombreOptimal) score += 20;
    if (analysis.hashtags.tendance2025.length > 0) score += 20;
    if (analysis.hashtags.niche.length > 0) score += 20;
    
    analysis.score_seo = score;
    
    return analysis;
}

// Scoring réaliste TikTok 2025 (CONSERVÉ)
function calculateRealisticScore(stats, metrics, seoAnalysis) {
    let score = 20;
    
    if (!stats || !metrics) {
        return { score: 25, potentielViral: 'faible', niveau: 'Données insuffisantes' };
    }
    
    // PERFORMANCE (60 points max)
    if (metrics.engagementRate > 20) score += 30;
    else if (metrics.engagementRate > 10) score += 25;
    else if (metrics.engagementRate > 5) score += 20;
    else if (metrics.engagementRate > 2) score += 15;
    else if (metrics.engagementRate > 1) score += 10;
    
    // Volume pondéré par ER
    if (stats.views > 1000000 && metrics.engagementRate > 3) score += 20;
    else if (stats.views > 100000 && metrics.engagementRate > 2) score += 15;
    else if (stats.views > 10000 && metrics.engagementRate > 1) score += 10;
    else if (stats.views > 1000) score += 5;
    
    // Partages = indicateur de viralité
    if (metrics.sharesRatio > 1) score += 10;
    else if (metrics.sharesRatio > 0.3) score += 5;
    
    // SEO (20 points max)
    score += Math.round(seoAnalysis.score_seo * 0.2);
    
    // Plafonnement
    score = Math.min(95, Math.max(15, score));
    
    let potentielViral = "faible";
    let niveau = "Débutant";
    
    if (score >= 80) {
        potentielViral = "élevé";
        niveau = "Viral";
    } else if (score >= 65) {
        potentielViral = "bon";
        niveau = "Performant";
    } else if (score >= 50) {
        potentielViral = "moyen";
        niveau = "Correct";
    }
    
    return { score, potentielViral, niveau };
}

// Analyse IA avec OpenAI (CONSERVÉE avec timeout optimisé)
async function generateAIRecommendations(stats, metrics, seoAnalysis, scoreResult, openaiKey) {
    if (!openaiKey) {
        return {
            diagnostic: "Clé OpenAI manquante - Analyse basique disponible",
            recommandations: [
                "🔧 Configurez une clé OpenAI pour obtenir des recommandations personnalisées",
                "📊 Votre taux d'engagement actuel: " + (metrics?.engagementRate?.toFixed(1) || 'N/A') + "%"
            ]
        };
    }

    try {
        const systemPrompt = `Tu es un expert TikTok qui analyse la performance des vidéos. Fournis un diagnostic précis et des recommandations actionables.

Règles importantes:
- Corrèle TOUJOURS le taux d'engagement et les vues
- Si bon ER (>5%) + peu de vues (<10k) = hook faible (majorité des cas)
- Si bon ER + bonnes vues = contenu performant, optimiser pour viralité
- Évite les phrases pré-construites, sois spécifique aux données
- Fournis max 4 recommandations concrètes
- Utilise les données réelles, pas de généralités

Format JSON attendu:
{
  "diagnostic": "Analyse personnalisée basée sur les données",
  "recommandations": ["Action 1", "Action 2", "Action 3", "Action 4"]
}`;

        const userPrompt = `Analyse cette vidéo TikTok:

📊 STATISTIQUES:
- Vues: ${stats?.views?.toLocaleString() || 'N/A'}
- Likes: ${stats?.likes?.toLocaleString() || 'N/A'} 
- Commentaires: ${stats?.comments?.toLocaleString() || 'N/A'}
- Partages: ${stats?.shares?.toLocaleString() || 'N/A'}
- Auteur: @${stats?.author || 'Inconnu'}
- Abonnés auteur: ${stats?.authorFollowers?.toLocaleString() || 'N/A'}

📈 MÉTRIQUES:
- Taux d'engagement: ${metrics?.engagementRate?.toFixed(1) || 'N/A'}%
- Ratio likes: ${metrics?.likesRatio?.toFixed(1) || 'N/A'}%
- Ratio partages: ${metrics?.sharesRatio?.toFixed(1) || 'N/A'}%

🎯 SEO TIKTOK:
- Score SEO: ${seoAnalysis?.score_seo || 'N/A'}/100
- Hashtags: ${stats?.hashtags?.length || 0} utilisés
- Description: ${seoAnalysis?.description?.longueur || 0} caractères

🏆 SCORE GLOBAL: ${scoreResult.score}/100 (${scoreResult.potentielViral})

Analyse en profondeur cette corrélation ER/vues et donne des recommandations précises.`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${openaiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                max_tokens: 800,
                temperature: 0.3
            }),
            signal: AbortSignal.timeout(25000) // Node.js: timeout généreux 25s
        });

        if (response.ok) {
            const data = await response.json();
            const analysis = JSON.parse(data.choices[0]?.message?.content || '{}');
            console.log("✅ Analyse IA générée");
            return analysis;
        } else {
            throw new Error(`OpenAI error: ${response.status}`);
        }
        
    } catch (error) {
        console.error("❌ Erreur analyse IA:", error.message);
        return {
            diagnostic: "Analyse IA temporairement indisponible",
            recommandations: [
                "📊 Analysez la corrélation entre votre taux d'engagement et vos vues",
                "🎯 Optimisez vos hashtags selon les tendances 2025",
                "🚀 Testez différents hooks dans les 3 premières secondes"
            ]
        };
    }
}

// Enregistrement base de données analytique (CONSERVÉ)
function saveToAnalyticsDB(data) {
    const entry = {
        id: `TKA_${Date.now().toString(36).toUpperCase()}`,
        timestamp: new Date().toISOString(),
        url: data.url,
        author: data.author,
        authorFollowers: data.authorFollowers,
        stats: {
            views: data.views,
            likes: data.likes,
            comments: data.comments,
            shares: data.shares
        },
        metrics: data.metrics,
        score: data.score,
        potentielViral: data.potentielViral,
        hashtags: data.hashtags,
        seoScore: data.seoScore
    };
    
    analyticsDatabase.push(entry);
    
    // Garder seulement les 1000 dernières entrées (CONSERVÉ)
    if (analyticsDatabase.length > 1000) {
        analyticsDatabase = analyticsDatabase.slice(-1000);
    }
    
    console.log(`💾 Données sauvegardées: ${entry.id} - @${data.author}`);
    return entry.id;
}

// Formatage nombres (CONSERVÉ)
function formatNumber(num) {
    if (!num || num === 0) return '0';
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    else if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    else if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// Handler principal (OPTIMISÉ seulement pour les timeouts)
export default async function handler(req) {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }
    
    if (req.method !== 'POST') {
        console.log(`❌ Méthode ${req.method} non autorisée`);
        return json({ error: 'Méthode non autorisée', method: req.method }, 405);
    }

    try {
        console.log(`🚀 Analyse TikTok 2025 démarrée (Node.js Runtime - 60s timeout)`);
        
        const body = await req.json().catch(() => null);
        if (!body || !body.url) {
            return json({ error: 'URL manquante' }, 400);
        }

        const { url: tiktokUrl } = body;
        
        if (!validateTikTokUrl(tiktokUrl)) {
            return json({ error: 'URL TikTok invalide' }, 400);
        }

        console.log(`🎯 URL: ${tiktokUrl}`);
        
        let oembedData = null;
        let stats = null;
        let htmlContent = null;

        // ÉTAPE 1: oEmbed (Node.js: timeout confortable)
        try {
            console.log("📡 oEmbed...");
            const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`;
            const oembedResponse = await fetch(oembedUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TikTokAnalyzer/2025)' },
                signal: AbortSignal.timeout(12000) // 12s - plus confortable
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

        // ÉTAPE 2: ScrapingBee (Node.js: timeout généreux)
        const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
        if (SCRAPINGBEE_API_KEY) {
            try {
                console.log("🕷️ ScrapingBee...");
                const scrapingBeeUrl = new URL('https://app.scrapingbee.com/api/v1/');
                scrapingBeeUrl.searchParams.set('api_key', SCRAPINGBEE_API_KEY);
                scrapingBeeUrl.searchParams.set('url', tiktokUrl);
                scrapingBeeUrl.searchParams.set('render_js', 'true');
                scrapingBeeUrl.searchParams.set('wait', '4000'); // Retour aux 4s originaux

                const response = await fetch(scrapingBeeUrl.toString(), {
                    signal: AbortSignal.timeout(35000) // Retour aux 35s originaux
                });

                if (response.ok) {
                    htmlContent = await response.text();
                    const data = findJsonBlob(htmlContent); // FONCTION COMPLÈTE CONSERVÉE
                    
                    if (data) {
                        const description = extractDescription(oembedData, htmlContent);
                        stats = extractStats(data, description, htmlContent); // FONCTION COMPLÈTE CONSERVÉE
                        console.log("✅ Stats extraites");
                    }
                } else {
                    console.warn(`⚠️ ScrapingBee échec: ${response.status}`);
                }
            } catch (error) {
                console.warn("⚠️ Échec ScrapingBee:", error.message);
            }
        }

        // ÉTAPE 3: Analyse COMPLÈTE (CONSERVÉE)
        const description = extractDescription(oembedData, htmlContent);
        const thumbnail = oembedData?.thumbnail_url || null;
        const hashtags = stats?.hashtags || extractHashtags(description, htmlContent);

        const metrics = stats ? calculateMetrics(stats) : null;
        const seoAnalysis = analyzeSEO(description, hashtags); // FONCTION COMPLÈTE CONSERVÉE
        const scoreResult = calculateRealisticScore(stats, metrics, seoAnalysis);

        // ÉTAPE 4: Analyse IA (CONSERVÉE avec timeout optimisé)
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        const aiAnalysis = await generateAIRecommendations(
            stats, metrics, seoAnalysis, scoreResult, OPENAI_API_KEY
        );

        // ÉTAPE 5: Sauvegarde base de données (CONSERVÉE)
        let analyticsId = null;
        if (stats) {
            analyticsId = saveToAnalyticsDB({
                url: tiktokUrl,
                author: stats.author,
                authorFollowers: stats.authorFollowers,
                views: stats.views,
                likes: stats.likes,
                comments: stats.comments,
                shares: stats.shares,
                metrics,
                score: scoreResult.score,
                potentielViral: scoreResult.potentielViral,
                hashtags,
                seoScore: seoAnalysis.score_seo
            });
        }

        // RÉPONSE FINALE COMPLÈTE (CONSERVÉE)
        const finalResponse = {
            success: true,
            video: {
                url: tiktokUrl,
                description,
                thumbnail,
                author: stats?.author || null,
                authorFollowers: stats?.authorFollowers || null,
                music: stats?.music || null,
                hashtags,
                createTime: stats?.createTime || null
            },
            
            // SECTION STATS (CONSERVÉE)
            stats: stats ? {
                views: stats.views,
                likes: stats.likes,
                comments: stats.comments,
                shares: stats.shares,
                formatted: {
                    views: formatNumber(stats.views),
                    likes: formatNumber(stats.likes),
                    comments: formatNumber(stats.comments),
                    shares: formatNumber(stats.shares),
                    followers: formatNumber(stats.authorFollowers)
                },
                metrics: {
                    engagementRate: metrics.engagementRate,
                    likesRatio: metrics.likesRatio,
                    commentsRatio: metrics.commentsRatio,
                    sharesRatio: metrics.sharesRatio,
                    totalEngagements: metrics.totalEngagements
                }
            } : null,
            
            // SECTION SEO COMPLÈTE (CONSERVÉE)
            seo: {
                score: seoAnalysis.score_seo,
                description: seoAnalysis.description,
                hashtags: seoAnalysis.hashtags,
                recommandations_hashtags_2025: {
                    tendance: getTrendingHashtags2025().tendance2025.slice(0, 5),
                    generaux: getTrendingHashtags2025().generaux.slice(0, 3),
                    niche_suggestions: getTrendingHashtags2025().niches.slice(0, 4)
                }
            },
            
            // SECTION ANALYSE (CONSERVÉE)
            analysis: {
                score: scoreResult.score,
                niveau: scoreResult.niveau,
                potentiel_viral: scoreResult.potentielViral,
                diagnostic_ia: aiAnalysis.diagnostic,
                recommandations_ia: aiAnalysis.recommandations
            },
            
            metadata: {
                analysisTimestamp: new Date().toISOString(),
                analysisId: analyticsId,
                frameworkVersion: "2025-nodejs-runtime",
                totalAnalyses: analyticsDatabase.length,
                features: {
                    oembed: !!oembedData,
                    stats_extraction: !!stats,
                    ai_analysis: !!OPENAI_API_KEY,
                    database_storage: !!analyticsId
                }
            }
        };

        console.log(`✅ Analyse terminée - Score: ${scoreResult.score}/100 (${scoreResult.niveau})`);
        
        return json(finalResponse);

    } catch (error) {
        console.error("❌ Erreur critique:", error.message);
        
        return json({ 
            error: "Erreur interne du serveur",
            details: error.message,
            timestamp: new Date().toISOString()
        }, 500);
    }
}

// ENDPOINT pour statistiques base de données (CONSERVÉ)
export async function GET(req) {
    try {
        const url = new URL(req.url);
        const action = url.searchParams.get('action');
        
        if (action === 'stats') {
            const stats = {
                totalAnalyses: analyticsDatabase.length,
                derniereAnalyse: analyticsDatabase.length > 0 ? 
                    analyticsDatabase[analyticsDatabase.length - 1].timestamp : null,
                
                topAuteurs: getTopAuthors(),
                tendancesHashtags: getTrendingHashtagsUsage(),
                scoresMoyens: getAverageScores()
            };
            
            return json({ success: true, stats });
        }
        
        return json({ error: "Action non supportée" }, 400);
        
    } catch (error) {
        return json({ error: "Erreur lors de la récupération des stats" }, 500);
    }
}

// Fonctions utilitaires pour les statistiques (CONSERVÉES)
function getTopAuthors() {
    const authorStats = {};
    analyticsDatabase.forEach(entry => {
        if (entry.author) {
            if (!authorStats[entry.author]) {
                authorStats[entry.author] = {
                    analyses: 0,
                    totalViews: 0,
                    avgScore: 0,
                    followers: entry.authorFollowers
                };
            }
            authorStats[entry.author].analyses++;
            authorStats[entry.author].totalViews += entry.stats.views;
        }
    });
    
    return Object.entries(authorStats)
        .sort(([,a], [,b]) => b.totalViews - a.totalViews)
        .slice(0, 10)
        .map(([author, stats]) => ({ author, ...stats }));
}

function getTrendingHashtagsUsage() {
    const hashtagCounts = {};
    analyticsDatabase.forEach(entry => {
        entry.hashtags?.forEach(tag => {
            hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
        });
    });
    
    return Object.entries(hashtagCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 20)
        .map(([hashtag, count]) => ({ hashtag, count }));
}

function getAverageScores() {
    if (analyticsDatabase.length === 0) return { avg: 0, distribution: {} };
    
    const scores = analyticsDatabase.map(entry => entry.score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    const distribution = {
        viral: scores.filter(s => s >= 80).length,
        bon: scores.filter(s => s >= 65 && s < 80).length,
        moyen: scores.filter(s => s >= 50 && s < 65).length,
        faible: scores.filter(s => s < 50).length
    };
    
    return { avg: avg.toFixed(1), distribution };
}
