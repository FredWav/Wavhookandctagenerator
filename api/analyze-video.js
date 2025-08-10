// api/analyze-video.js - Version minimale pour debug
export const config = { runtime: "edge" };

export default async function handler(req) {
    // Log pour debug
    console.log(`🚀 Analyze-video called - Method: ${req.method}`);
    
    // CORS headers
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers });
    }
    
    // Only POST allowed
    if (req.method !== 'POST') {
        console.log(`❌ Méthode ${req.method} non autorisée`);
        return new Response(JSON.stringify({ 
            error: 'Méthode non autorisée',
            method: req.method,
            allowed: 'POST'
        }), { 
            status: 405, 
            headers 
        });
    }

    try {
        // Parse body
        const body = await req.json().catch(() => null);
        console.log('📝 Body reçu:', body);
        
        if (!body || !body.url) {
            return new Response(JSON.stringify({ 
                error: 'URL manquante',
                received: body 
            }), { 
                status: 400, 
                headers 
            });
        }

        const { url: tiktokUrl } = body;
        console.log(`🎯 URL à analyser: ${tiktokUrl}`);
        
        // Validation URL simple
        if (!tiktokUrl.includes('tiktok.com')) {
            return new Response(JSON.stringify({ 
                error: 'URL TikTok invalide' 
            }), { 
                status: 400, 
                headers 
            });
        }

        // Test oEmbed simple
        let oembedData = null;
        try {
            console.log("📡 Test oEmbed...");
            const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`;
            const oembedResponse = await fetch(oembedUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TikTokAnalyzer/2025)' },
                signal: AbortSignal.timeout(10000)
            });

            if (oembedResponse.ok) {
                oembedData = await oembedResponse.json();
                console.log("✅ oEmbed réussi");
            } else {
                console.log(`⚠️ oEmbed échec: ${oembedResponse.status}`);
            }
        } catch (error) {
            console.error("❌ Erreur oEmbed:", error.message);
            return new Response(JSON.stringify({ 
                error: "Vidéo TikTok inaccessible",
                details: error.message 
            }), { 
                status: 404, 
                headers 
            });
        }

        // Réponse minimale
        const response = {
            success: true,
            message: "Analyse basique réussie",
            video: {
                url: tiktokUrl,
                title: oembedData?.title || "Titre non disponible",
                thumbnail: oembedData?.thumbnail_url || null,
                author: oembedData?.author_name || null
            },
            debug: {
                timestamp: new Date().toISOString(),
                method: req.method,
                oembedSuccess: !!oembedData
            }
        };

        console.log("✅ Réponse générée avec succès");
        
        return new Response(JSON.stringify(response), { 
            status: 200, 
            headers 
        });

    } catch (error) {
        console.error("❌ Erreur critique:", error);
        
        return new Response(JSON.stringify({ 
            error: "Erreur interne du serveur",
            details: error.message,
            stack: error.stack
        }), { 
            status: 500, 
            headers 
        });
    }
}
