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
                    description: itemStruct.desc || null
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
                    description: itemStruct.desc || null
                };
            }
        }
        
        return null;
    } catch (error) {
        console.error("❌ Erreur extraction stats:", error.message);
        return null;
    }
}

// Fonction pour calculer le taux d'engagement
function calculateEngagementRate(stats) {
    if (!stats || stats.views === 0) return 0;
    const totalEngagements = stats.likes + stats.comments + stats.shares;
    return (totalEngagements / stats.views) * 100;
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

        console.log(`🔍 Analyse de: ${tiktokUrl}`);

        let description = null;
        let thumbnail = null;
        let stats = null;
        let engagementRate = null;

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
                        engagementRate = calculateEngagementRate(stats);
                        console.log("✅ Stats récupérées avec succès");
                        
                        // Utiliser la description du scraping si elle est meilleure
                        if (stats.description && stats.description.length > description.length) {
                            description = stats.description;
                        }
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

        // --- ÉTAPE 3: Analyse IA ---
        let analysis = null;
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        
        if (OPENAI_API_KEY && thumbnail) {
            try {
                console.log("🤖 Analyse IA en cours...");
                
                let userPrompt = `Analyse cette vidéo TikTok :\n- Description: "${description}"`;
                
                if (stats) {
                    userPrompt += `\n- Vues: ${formatNumber(stats.views)} (${stats.views})`;
                    userPrompt += `\n- J'aime: ${formatNumber(stats.likes)} (${stats.likes})`;
                    userPrompt += `\n- Commentaires: ${formatNumber(stats.comments)} (${stats.comments})`;
                    userPrompt += `\n- Partages: ${formatNumber(stats.shares)} (${stats.shares})`;
                    userPrompt += `\n- Taux d'engagement: ${engagementRate.toFixed(2)}%`;
                } else {
                    userPrompt += `\n(Statistiques non disponibles - analyse basée sur le contenu visuel et la description uniquement)`;
                }

                const systemPrompt = `Tu es un expert en marketing viral TikTok. Analyse la vidéo et fournis une réponse JSON structurée avec:
                - "score": note sur 100 (performance globale)
                - "points_forts": array de 3-5 points positifs
                - "points_faibles": array de 2-4 points d'amélioration  
                - "suggestions": array de 3-5 recommandations concrètes
                - "potentiel_viral": "faible"/"moyen"/"élevé"
                
                Critères: ER>5% = excellent, ratio likes/vues>10% = très bon, >1M vues = viral.`;

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
                        max_tokens: 1000,
                        temperature: 0.7
                    }),
                    timeout: 30000
                });

                if (!aiResponse.ok) {
                    const errorText = await aiResponse.text();
                    throw new Error(`OpenAI API error: ${aiResponse.status} - ${errorText}`);
                }

                const aiData = await aiResponse.json();
                const content = aiData.choices[0]?.message?.content;
                
                if (content) {
                    analysis = JSON.parse(content);
                    console.log("✅ Analyse IA terminée");
                }
                
            } catch (error) {
                console.error("❌ Erreur analyse IA:", error.message);
                // L'analyse IA est optionnelle, on continue sans
            }
        }

        // --- RÉPONSE FINALE ---
        const finalResponse = {
            success: true,
            video: {
                url: tiktokUrl,
                description,
                thumbnail
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
            metrics: {
                engagementRate: engagementRate ? parseFloat(engagementRate.toFixed(2)) : null,
                likesRatio: stats ? parseFloat(((stats.likes / stats.views) * 100).toFixed(2)) : null
            },
            analysis,
            timestamp: new Date().toISOString()
        };

        console.log("✅ Analyse terminée avec succès");
        
        return new Response(
            JSON.stringify(finalResponse), 
            { 
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=300' // Cache 5 minutes
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
