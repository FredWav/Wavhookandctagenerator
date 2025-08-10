// analyze-video.js - Version corrigée et sécurisée
export const config = { runtime: "edge" };

// Base de données simulée (en production, utiliser une vraie DB)
let analysisLogs = [];

// Fonction pour logger les analyses
function logAnalysis(data) {
    try {
        const logEntry = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2),
            timestamp: new Date().toISOString(),
            url: data.url || null,
            author: data.author || 'Inconnu',
            stats: data.stats || null,
            metrics: data.metrics || null,
            score: data.score || null,
            potentiel_viral: data.potentiel_viral || null,
            niche_detectee: data.niche_detectee || null,
            contenu_audio: data.contenu_audio || null,
            contenu_visuel: data.contenu_visuel || null,
            user_ip: data.user_ip || null,
            user_agent: data.user_agent || null
        };
        
        analysisLogs.push(logEntry);
        
        // Garder seulement les 1000 dernières entrées en mémoire
        if (analysisLogs.length > 1000) {
            analysisLogs = analysisLogs.slice(-1000);
        }
        
        console.log(`📝 Analyse enregistrée: ${logEntry.id} - ${data.author} - ${data.stats?.views || 0} vues`);
        return logEntry.id;
    } catch (error) {
        console.error("❌ Erreur lors du logging:", error);
        return null;
    }
}

// Fonction pour parser les données JSON TikTok
function findJsonBlob(html) {
    try {
        // Essayer SIGI_STATE en premier
        let scriptContent = html.split('<script id="SIGI_STATE" type="application/json">')[1]?.split('</script>')[0];
        if (scriptContent) {
            console.log("✅ Données via SIGI_STATE");
            return JSON.parse(scriptContent);
        }
        
        // Essayer __UNIVERSAL_DATA_FOR_REHYDRATION__
        scriptContent = html.split('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">')[1]?.split('</script>')[0];
        if (scriptContent) {
            console.log("✅ Données via __UNIVERSAL_DATA_FOR_REHYDRATION__");
            return JSON.parse(scriptContent);
        }
        
        // Essayer __INITIAL_STATE__
        const initialStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/s);
        if (initialStateMatch) {
            console.log("✅ Données via __INITIAL_STATE__");
            return JSON.parse(initialStateMatch[1]);
        }
        
        return null;
    } catch (error) {
        console.error("❌ Erreur parsing JSON:", error.message);
        return null;
    }
}

// Extraction des stats avec URL vidéo pour l'analyse
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
            createTime: null,
            videoUrl: null,
            coverUrl: null
        };

        // Essayer ItemModule en premier
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
                    createTime: itemStruct.createTime ? new Date(itemStruct.createTime * 1000) : null,
                    videoUrl: itemStruct.video?.playAddr || itemStruct.video?.downloadAddr || null,
                    coverUrl: itemStruct.video?.originCover || itemStruct.video?.dynamicCover || null
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
                    createTime: itemStruct.createTime ? new Date(itemStruct.createTime * 1000) : null,
                    videoUrl: itemStruct.video?.playAddr || itemStruct.video?.downloadAddr || null,
                    coverUrl: itemStruct.video?.originCover || itemStruct.video?.dynamicCover || null
                };
            }
        }
        
        return extractedData.views > 0 ? extractedData : null;
        
    } catch (error) {
        console.error("❌ Erreur extraction stats:", error.message);
        return null;
    }
}

// Analyse du contenu vidéo avec OpenAI GPT-4 Vision
async function analyzeVideoContent(videoUrl, thumbnailUrl, description, openaiKey) {
    if (!openaiKey) {
        console.warn("⚠️ OpenAI key manquante - Analyse vidéo désactivée");
        return null;
    }

    try {
        console.log("🎬 Analyse du contenu vidéo via OpenAI GPT-4 Vision...");
        
        const systemPrompt = `Tu es un expert en analyse de contenu TikTok. Analyse cette vidéo et fournis un JSON structuré avec:

1. CONTENU_VISUEL: Que vois-tu dans la vidéo? (décor, personne, objets, actions, esthétique)
2. NICHE_DETECTEE: Quelle niche/catégorie? (fitness, beauté, humour, éducation, lifestyle, business, etc.)
3. TYPE_CONTENU: Quel format? (tutorial, storytime, dance, comedy, educational, review, etc.)
4. QUALITE_PRODUCTION: Niveau de production (amateur, semi-pro, professionnel)
5. ELEMENTS_VIRAUX: Quels éléments peuvent rendre cette vidéo virale?
6. EMOTIONS_SUSCITEES: Quelles émotions cette vidéo provoque-t-elle?
7. CIBLE_AUDIENCE: À qui s'adresse cette vidéo? (âge, genre, intérêts)
8. POINTS_ATTENTION: Moments clés qui captent l'attention
9. RECOMMANDATIONS_VISUELLES: Comment améliorer visuellement

Sois précis et professionnel.`;

        const userPrompt = `Analyse cette vidéo TikTok:

📝 DESCRIPTION: "${description || 'Aucune description'}"

🎯 MISSION: Fournis une analyse complète du contenu visuel et identifie la niche, le type de contenu, et les éléments qui peuvent contribuer à la viralité.`;

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
                    { 
                        role: "user", 
                        content: [
                            { type: "text", text: userPrompt },
                            ...(thumbnailUrl ? [{ type: "image_url", image_url: { url: thumbnailUrl } }] : [])
                        ]
                    }
                ],
                max_tokens: 1500,
                temperature: 0.3
            }),
            signal: AbortSignal.timeout(30000)
        });

        if (response.ok) {
            const data = await response.json();
            const content = data.choices[0]?.message?.content;
            
            if (content) {
                const analysis = JSON.parse(content);
                console.log("✅ Analyse vidéo complétée");
                return analysis;
            }
        } else {
            console.warn(`⚠️ Erreur OpenAI Vision: ${response.status}`);
        }
        
        return null;
    } catch (error) {
        console.error("❌ Erreur analyse vidéo:", error.message);
        return null;
    }
}

// Transcription audio (simulation - en production utiliser Whisper API)
async function transcribeAudio(videoUrl, openaiKey) {
    if (!openaiKey || !videoUrl) {
        console.warn("⚠️ Transcription audio désactivée - Clé OpenAI ou URL vidéo manquante");
        return null;
    }

    try {
        console.log("🎤 Transcription audio simulée...");
        
        // NOTE: Simulation pour éviter les erreurs
        // En production, implémentez Whisper API ici
        
        const simulatedTranscription = {
            text: "Transcription non disponible - Implémentation Whisper requise",
            language: "fr",
            confidence: 0,
            duration: null,
            words: [],
            sentiment: "neutral",
            topics: []
        };
        
        console.log("⚠️ Transcription simulée - Implémentez Whisper API pour la transcription réelle");
        return simulatedTranscription;
        
    } catch (error) {
        console.error("❌ Erreur transcription audio:", error.message);
        return null;
    }
}

// Calcul des métriques avancées
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

// Analyse créative complète
function analyzeCreativeContent(stats, description, hashtags, videoAnalysis = null, audioTranscription = null) {
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
        },
        contenuEnrichi: {
            niche: videoAnalysis?.NICHE_DETECTEE || 'Non déterminée',
            typeContenu: videoAnalysis?.TYPE_CONTENU || 'Non déterminé',
            qualiteProduction: videoAnalysis?.QUALITE_PRODUCTION || 'Non évaluée',
            elementsViraux: videoAnalysis?.ELEMENTS_VIRAUX || [],
            cibleAudience: videoAnalysis?.CIBLE_AUDIENCE || 'Non déterminée',
            contenuParle: audioTranscription?.text || 'Non disponible'
        }
    };
    
    if (description) {
        const desc = description.toLowerCase();
        
        // Détection du hook
        const hookPatterns = {
            question: /^(pourquoi|comment|qui|que|quoi|où|quand)/,
            secret: /(secret|astuce|conseil|truc)/,
            revelation: /(révélation|vérité|découverte)/,
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
        
        // Détection du CTA
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
        
        analysis.structureNarrative.messageClaire = description.length > 10 && description.length < 300;
        analysis.optimisationPlateforme.descriptionEngageante = description.length > 20;
    }
    
    // Analyse des hashtags
    if (hashtags && hashtags.length > 0) {
        analysis.optimisationPlateforme.hashtagsPertinents = hashtags.length >= 3 && hashtags.length <= 8;
        
        const hashtagsTendance = ['fyp', 'viral', 'trending', 'pourtoi', 'france', 'tiktokfrance'];
        analysis.tendances.hashtagsTendance = hashtags.filter(tag => 
            hashtagsTendance.some(trend => tag.toLowerCase().includes(trend))
        );
        analysis.tendances.utiliseTendance = analysis.tendances.hashtagsTendance.length > 0;
    }
    
    return analysis;
}

// Scoring prédictif enrichi
function calculatePredictiveScore(stats, metrics, creativeAnalysis) {
    let score = 50;
    
    // Performance quantitative (40 points)
    if (metrics.engagementRate > 15) score += 15;
    else if (metrics.engagementRate > 10) score += 12;
    else if (metrics.engagementRate > 5) score += 8;
    else if (metrics.engagementRate > 2) score += 4;
    
    if (metrics.likesRatio > 10) score += 10;
    else if (metrics.likesRatio > 5) score += 6;
    
    if (stats.views > 1000000) score += 15;
    else if (stats.views > 100000) score += 10;
    else if (stats.views > 10000) score += 5;
    
    // Analyse créative (30 points)
    if (creativeAnalysis.structureNarrative.hookPresent) score += 8;
    if (creativeAnalysis.structureNarrative.messageClaire) score += 6;
    if (creativeAnalysis.structureNarrative.ctaPresent) score += 4;
    if (creativeAnalysis.optimisationPlateforme.hashtagsPertinents) score += 6;
    if (creativeAnalysis.optimisationPlateforme.descriptionEngageante) score += 3;
    if (creativeAnalysis.tendances.utiliseTendance) score += 3;
    
    // Bonus contenu enrichi (10 points)
    if (creativeAnalysis.contenuEnrichi.niche !== 'Non déterminée') score += 3;
    if (creativeAnalysis.contenuEnrichi.qualiteProduction === 'professionnel') score += 4;
    if (creativeAnalysis.contenuEnrichi.elementsViraux?.length > 0) score += 3;
    
    let potentielViral = "faible";
    if (score >= 85) potentielViral = "élevé";
    else if (score >= 70) potentielViral = "moyen";
    
    return { score: Math.min(100, Math.max(0, score)), potentielViral };
}

// Génération de recommandations enrichies
function generateRecommendations(stats, metrics, creativeAnalysis, videoAnalysis = null) {
    const recommendations = {
        points_forts: [],
        points_faibles: [],
        suggestions: []
    };
    
    // Points forts
    if (metrics.engagementRate > 10) {
        recommendations.points_forts.push(`Excellent taux d'engagement (${metrics.engagementRate.toFixed(1)}%) - Audience très réactive`);
    }
    if (metrics.likesRatio > 8) {
        recommendations.points_forts.push("Ratio likes/vues élevé - Contenu très apprécié");
    }
    if (creativeAnalysis.structureNarrative.hookPresent) {
        recommendations.points_forts.push(`Hook ${creativeAnalysis.structureNarrative.hookType} détecté - Accroche efficace`);
    }
    if (videoAnalysis?.QUALITE_PRODUCTION === 'professionnel') {
        recommendations.points_forts.push("Qualité de production professionnelle détectée");
    }
    if (creativeAnalysis.contenuEnrichi.niche !== 'Non déterminée') {
        recommendations.points_forts.push(`Niche clairement identifiée: ${creativeAnalysis.contenuEnrichi.niche}`);
    }
    
    // Points faibles
    if (metrics.engagementRate < 3) {
        recommendations.points_faibles.push("Taux d'engagement faible - Contenu peu engageant");
    }
    if (!creativeAnalysis.structureNarrative.hookPresent) {
        recommendations.points_faibles.push("Absence de hook détectable - Accroche à renforcer");
    }
    if (!creativeAnalysis.structureNarrative.ctaPresent) {
        recommendations.points_faibles.push("Aucun appel à l'action explicite");
    }
    if (!creativeAnalysis.optimisationPlateforme.hashtagsPertinents) {
        recommendations.points_faibles.push(`Stratégie hashtags non optimale (${creativeAnalysis.optimisationPlateforme.hashtagsCount} hashtags)`);
    }
    
    // Suggestions enrichies
    if (metrics.engagementRate < 5) {
        recommendations.suggestions.push("🎯 Créer un hook plus percutant dans les 3 premières secondes");
        recommendations.suggestions.push("💬 Poser des questions pour inciter aux commentaires");
    }
    
    if (videoAnalysis?.ELEMENTS_VIRAUX?.length > 0) {
        recommendations.suggestions.push(`🔥 Exploiter davantage ces éléments viraux détectés: ${Array.isArray(videoAnalysis.ELEMENTS_VIRAUX) ? videoAnalysis.ELEMENTS_VIRAUX.join(', ') : videoAnalysis.ELEMENTS_VIRAUX}`);
    }
    
    if (creativeAnalysis.contenuEnrichi.niche !== 'Non déterminée') {
        recommendations.suggestions.push(`🎯 Optimiser pour la niche ${creativeAnalysis.contenuEnrichi.niche}: utiliser ses codes et hashtags spécifiques`);
    }
    
    if (!creativeAnalysis.structureNarrative.ctaPresent) {
        recommendations.suggestions.push("📢 Ajouter un CTA clair: 'Abonnez-vous pour plus', 'Dites-moi en commentaire'");
    }
    
    recommendations.suggestions.push("📊 Analyser cette vidéo comme référence pour optimiser les prochaines");
    
    return recommendations;
}

// Validation URL TikTok
function validateTikTokUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }
    
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

// Extraction des infos utilisateur
function extractUserInfo(request) {
    try {
        const headers = request.headers;
        return {
            ip: headers.get('x-forwarded-for') || headers.get('x-real-ip') || 'unknown',
            userAgent: headers.get('user-agent') || 'unknown',
            country: headers.get('cf-ipcountry') || 'unknown',
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error("❌ Erreur extraction infos utilisateur:", error);
        return {
            ip: 'unknown',
            userAgent: 'unknown',
            country: 'unknown',
            timestamp: new Date().toISOString()
        };
    }
}

// Fonction de réponse JSON sécurisée
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

// Handler principal avec analyse complète
export default async function handler(req) {
    if (req.method !== 'POST') {
        return jsonResponse({
            error: 'Méthode non autorisée',
            errorCode: 'METHOD_NOT_ALLOWED',
            supportedMethods: ['POST']
        }, 405);
    }

    let body;
    try {
        body = await req.json();
    } catch (error) {
        return jsonResponse({
            error: 'Corps de requête JSON invalide',
            errorCode: 'INVALID_JSON',
            details: 'Vérifiez le format JSON de votre requête'
        }, 400);
    }

    if (!body || !body.url) {
        return jsonResponse({
            error: 'URL manquante',
            errorCode: 'MISSING_URL',
            details: 'Le paramètre "url" est requis'
        }, 400);
    }

    const { url: tiktokUrl } = body;
    
    if (!validateTikTokUrl(tiktokUrl)) {
        return jsonResponse({
            error: 'URL TikTok invalide',
            errorCode: 'INVALID_TIKTOK_URL',
            details: 'Utilisez le format: https://www.tiktok.com/@username/video/123456789',
            examples: [
                'https://www.tiktok.com/@username/video/123456789',
                'https://vm.tiktok.com/ABC123/',
                'https://www.tiktok.com/t/ABC123/'
            ]
        }, 400);
    }

    console.log(`🚀 Analyse complète: ${tiktokUrl}`);
    
    // Extraction des infos utilisateur
    const userInfo = extractUserInfo(req);
    console.log(`👤 Utilisateur: ${userInfo.ip} (${userInfo.country})`);

    let description = null;
    let thumbnail = null;
    let stats = null;
    let videoAnalysis = null;
    let audioTranscription = null;

    // Étape 1: oEmbed
    try {
        console.log("📡 oEmbed...");
        const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`;
        const oembedResponse = await fetch(oembedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(15000)
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
            details: 'La vidéo est peut-être privée, supprimée ou géo-restreinte',
            troubleshoot: [
                'Vérifiez que la vidéo existe et est publique',
                'Assurez-vous que l\'URL est correcte',
                'Réessayez dans quelques instants'
            ]
        }, 404);
    }

    // Étape 2: Statistiques ScrapingBee
    const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
    if (SCRAPINGBEE_API_KEY) {
        try {
            console.log("🕷️ ScrapingBee...");
            const scrapingBeeUrl = new URL('https://app.scrapingbee.com/api/v1/');
            scrapingBeeUrl.searchParams.set('api_key', SCRAPINGBEE_API_KEY);
            scrapingBeeUrl.searchParams.set('url', tiktokUrl);
            scrapingBeeUrl.searchParams.set('render_js', 'true');
            scrapingBeeUrl.searchParams.set('wait', '4000');

            const response = await fetch(scrapingBeeUrl.toString(), {
                signal: AbortSignal.timeout(35000)
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
            console.warn("⚠️ Échec ScrapingBee:", error.message);
        }
    }

    // Étape 3: Analyse vidéo/audio
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (OPENAI_API_KEY && thumbnail) {
        // Analyse du contenu visuel
        videoAnalysis = await analyzeVideoContent(stats?.videoUrl, thumbnail, description, OPENAI_API_KEY);
        
        // Transcription audio (si URL vidéo disponible)
        if (stats?.videoUrl) {
            audioTranscription = await transcribeAudio(stats.videoUrl, OPENAI_API_KEY);
        }
    }

    // Calculs et analyses
    const metrics = stats ? calculateAdvancedMetrics(stats) : null;
    const creativeAnalysis = analyzeCreativeContent(stats, description, stats?.hashtags, videoAnalysis, audioTranscription);
    const predictiveScore = stats ? calculatePredictiveScore(stats, metrics, creativeAnalysis) : { score: 50, potentielViral: 'moyen' };
    const recommendations = stats ? generateRecommendations(stats, metrics, creativeAnalysis, videoAnalysis) : null;

    // Enregistrement de l'analyse
    const logId = logAnalysis({
        url: tiktokUrl,
        author: stats?.author,
        stats: stats,
        metrics: metrics,
        score: predictiveScore.score,
        potentiel_viral: predictiveScore.potentielViral,
        niche_detectee: videoAnalysis?.NICHE_DETECTEE,
        contenu_audio: audioTranscription?.text,
        contenu_visuel: videoAnalysis?.CONTENU_VISUEL,
        user_ip: userInfo.ip,
        user_agent: userInfo.userAgent
    });

    // Réponse finale enrichie
    const finalResponse = {
        success: true,
        analysisId: logId,
        analysisType: "framework_complet_avec_video_audio",
        video: {
            url: tiktokUrl,
            description,
            thumbnail,
            author: stats?.author || null,
            music: stats?.music || null,
            hashtags: stats?.hashtags || [],
            createTime: stats?.createTime || null,
            videoUrl: stats?.videoUrl || null
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
            creative: creativeAnalysis,
            
            // Contenu enrichi
            contenu_video: videoAnalysis ? {
                niche_detectee: videoAnalysis.NICHE_DETECTEE || 'Non déterminée',
                type_contenu: videoAnalysis.TYPE_CONTENU || 'Non déterminé',
                qualite_production: videoAnalysis.QUALITE_PRODUCTION || 'Non évaluée',
                elements_viraux: videoAnalysis.ELEMENTS_VIRAUX || [],
                emotions_suscitees: videoAnalysis.EMOTIONS_SUSCITEES || [],
                cible_audience: videoAnalysis.CIBLE_AUDIENCE || 'Non déterminée',
                contenu_visuel: videoAnalysis.CONTENU_VISUEL || 'Non analysé',
                recommandations_visuelles: videoAnalysis.RECOMMANDATIONS_VISUELLES || []
            } : null,
            
            contenu_audio: audioTranscription ? {
                transcription: audioTranscription.text || 'Non disponible',
                langue: audioTranscription.language || 'Non détectée',
                duree: audioTranscription.duration || null,
                sentiment: audioTranscription.sentiment || 'Non analysé',
                topics: audioTranscription.topics || [],
                confidence: audioTranscription.confidence || 0
            } : null
        },
        metadata: {
            analysisTimestamp: new Date().toISOString(),
            frameworkVersion: "5.0-video-audio-fixed",
            apiEndpoint: "/api/analyze-video",
            userInfo: {
                country: userInfo.country,
                timestamp: userInfo.timestamp
            },
            features: {
                oembed: !!thumbnail,
                stats_extraction: !!stats,
                video_analysis: !!videoAnalysis,
                audio_transcription: !!audioTranscription,
                logging: !!logId
            }
        }
    };

    console.log(`✅ Analyse complète terminée - ID: ${logId}`);
    console.log(`🎯 Score: ${predictiveScore.score}/100 (${predictiveScore.potentielViral})`);
    
    return jsonResponse(finalResponse, 200, {
        'X-Analysis-ID': logId || 'unknown',
        'X-Framework-Version': '5.0-video-audio-fixed'
    });
}

// Endpoint GET pour les logs d'analyse
export async function GET(req) {
    try {
        const url = new URL(req.url);
        const showLogs = url.searchParams.get('logs') === 'true';
        
        if (showLogs) {
            // Statistiques des analyses
            const stats = {
                total_analyses: analysisLogs.length,
                derniere_analyse: analysisLogs.length > 0 ? analysisLogs[analysisLogs.length - 1].timestamp : null,
                top_auteurs: getTopAuthors(),
                top_niches: getTopNiches(),
                analyse_par_jour: getAnalysesPerDay()
            };
            
            return jsonResponse({
                success: true,
                stats: stats,
                recent_analyses: analysisLogs.slice(-10) // 10 dernières analyses
            });
        }
        
        return jsonResponse({
            error: "Endpoint GET non supporté sans paramètre logs=true",
            usage: "Utilisez GET /api/analyze-video?logs=true pour voir les statistiques"
        }, 405);
        
    } catch (error) {
        console.error("❌ Erreur GET:", error);
        return jsonResponse({
            error: "Erreur lors de la récupération des logs",
            errorCode: 'LOGS_ERROR'
        }, 500);
    }
}

// Fonctions utilitaires pour les statistiques
function getTopAuthors() {
    const authorCounts = {};
    analysisLogs.forEach(log => {
        if (log.author && log.author !== 'Inconnu') {
            authorCounts[log.author] = (authorCounts[log.author] || 0) + 1;
        }
    });
    
    return Object.entries(authorCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([author, count]) => ({ author, analyses: count }));
}

function getTopNiches() {
    const nicheCounts = {};
    analysisLogs.forEach(log => {
        if (log.niche_detectee && log.niche_detectee !== 'Non déterminée') {
            nicheCounts[log.niche_detectee] = (nicheCounts[log.niche_detectee] || 0) + 1;
        }
    });
    
    return Object.entries(nicheCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([niche, count]) => ({ niche, analyses: count }));
}

function getAnalysesPerDay() {
    const daysCounts = {};
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        daysCounts[dateStr] = 0;
    }
    
    analysisLogs.forEach(log => {
        try {
            const dateStr = log.timestamp.split('T')[0];
            if (daysCounts.hasOwnProperty(dateStr)) {
                daysCounts[dateStr]++;
            }
        } catch (error) {
            console.warn("⚠️ Date invalide dans log:", log.timestamp);
        }
    });
    
    return Object.entries(daysCounts).map(([date, count]) => ({ date, analyses: count }));
}
