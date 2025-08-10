export const config = { runtime: "edge" };

// Fonction pour parser les données JSON cachées dans le HTML
function findJsonBlob(html) {
    // Plan B: On cherche d'abord SIGI_STATE
    let scriptContent = html.split('<script id="SIGI_STATE" type="application/json">')[1]?.split('</script>')[0];
    if (scriptContent) {
        console.log("Données trouvées via SIGI_STATE.");
        return JSON.parse(scriptContent);
    }
    
    // Plan C: Si SIGI_STATE n'est pas là, on cherche la nouvelle méthode
    scriptContent = html.split('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">')[1]?.split('</script>')[0];
    if (scriptContent) {
        console.log("Données trouvées via __UNIVERSAL_DATA_FOR_REHYDRATION__.");
        return JSON.parse(scriptContent);
    }
    
    console.log("Aucun blob JSON principal (SIGI_STATE ou UNIVERSAL_DATA) n'a été trouvé.");
    return null;
}


export default async function handler(req) {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405 });

  const { url: tiktokUrl } = await req.json();
  if (!tiktokUrl || !tiktokUrl.includes('tiktok.com')) return new Response(JSON.stringify({ error: 'URL invalide' }), { status: 400 });

  try {
    let description, thumbnail, stats = null, engagementRate = null;

    // --- PLAN A: L'ATTAQUE OEMBED (rapide et fiable pour les bases) ---
    try {
        const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`;
        const oembedResponse = await fetch(oembedUrl);
        if (!oembedResponse.ok) throw new Error("oEmbed a échoué, la vidéo est peut-être privée/invalide.");
        
        const oembedData = await oembedResponse.json();
        description = oembedData.title || "Description non trouvée.";
        thumbnail = oembedData.thumbnail_url;
        console.log("Plan A réussi : Description et miniature récupérées via oEmbed.");
    } catch (e) {
        console.error("Erreur du Plan A (oEmbed):", e.message);
        throw new Error("Impossible de récupérer les informations de base de la vidéo. Elle est probablement privée ou l'URL est incorrecte.");
    }

    // --- PLAN B & C: L'ATTAQUE SCRAPINGBEE (pour les stats) ---
    const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
    if (SCRAPINGBEE_API_KEY) {
        try {
            const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${SCRAPINGBEE_API_KEY}&url=${encodeURIComponent(tiktokUrl)}&render_js=true`;
            const response = await fetch(scrapingBeeUrl);
            if (!response.ok) throw new Error(`ScrapingBee a échoué. Status: ${response.status}`);
            
            const html = await response.text();
            const data = findJsonBlob(html);

            if (data) {
                const videoId = Object.keys(data.ItemModule || {})[0] || Object.keys(data['__DEFAULT_SCOPE__']['webapp.video-detail'].itemInfo.itemStruct || {})[0];
                const itemStruct = data.ItemModule?.[videoId] || data['__DEFAULT_SCOPE__']['webapp.video-detail'].itemInfo.itemStruct;

                if (itemStruct && itemStruct.stats) {
                    stats = {
                        views: parseInt(itemStruct.stats.playCount) || 0,
                        likes: parseInt(itemStruct.stats.diggCount) || 0,
                        comments: parseInt(itemStruct.stats.commentCount) || 0,
                        shares: parseInt(itemStruct.stats.shareCount) || 0,
                    };
                    const totalEngagements = stats.likes + stats.comments + stats.shares;
                    engagementRate = stats.views > 0 ? (totalEngagements / stats.views) * 100 : 0;
                    console.log("Plan B/C réussi : Stats récupérées !");
                }
            }
        } catch (e) {
            console.warn("Échec du scraping des stats :", e.message, ". On continue avec les infos de base.");
        }
    }
    
    // --- Étape 3: Analyse par l'IA (dynamique) ---
    let userPrompt = `Analyse cette vidéo.\n- Description: "${description}"`;
    if (stats) {
        userPrompt += `\n- Vues: ${stats.views}\n- J'aime: ${stats.likes}\n- Commentaires: ${stats.comments}\n- Partages: ${stats.shares}\n- Taux d'engagement calculé: ${engagementRate.toFixed(2)}%`;
    } else {
        userPrompt += `\n(Les statistiques de performance n'ont pas pu être récupérées, concentre-toi uniquement sur le contenu : description et miniature).`;
    }

    const system_prompt = `Tu es un expert en marketing viral sur TikTok. Ton rôle est d'analyser une vidéo en te basant sur ses statistiques de performance et son contenu. Fournis une analyse structurée au format JSON avec les clés "score", "points_forts", "points_faibles", "suggestions". Interprète les stats si elles sont là. Un ER > 5% est excellent. Un ratio j'aime/vues > 10% est très bon.`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`},
        body: JSON.stringify({
            model: "gpt-4o", response_format: { type: "json_object" },
            messages: [
                { role: "system", content: system_prompt },
                { role: "user", content: [{ type: "text", text: userPrompt }, { type: "image_url", image_url: { "url": thumbnail } }] }
            ]
        })
    });

    if (!r.ok) throw new Error(`Erreur de l'API OpenAI: ${await r.text()}`);

    const aiResponse = await r.json();
    const content = aiResponse.choices[0].message.content;
    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (e) {
      console.error("OpenAI response was not valid JSON:", content);
      throw new Error(`L'IA a renvoyé une réponse invalide. Contenu : "${content}"`);
    }

    const finalResponse = { stats, engagementRate: engagementRate ? engagementRate.toFixed(2) : null, analysis };
    return new Response(JSON.stringify(finalResponse), { status: 200 });

  } catch (error) {
    console.error("Erreur finale dans le handler:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
