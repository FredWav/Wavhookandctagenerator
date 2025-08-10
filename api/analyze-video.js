export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  const { url: tiktokUrl } = await req.json();
  if (!tiktokUrl || !tiktokUrl.includes('tiktok.com')) {
    return new Response(JSON.stringify({ error: 'URL is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
  if (!SCRAPINGBEE_API_KEY) {
    return new Response(JSON.stringify({ error: 'ScrapingBee API key is not configured' }), { status: 500 });
  }

  try {
    // --- NOUVEAU : Logique de relance automatique ---
    let response;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        attempts++;
        const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${SCRAPINGBEE_API_KEY}&url=${encodeURIComponent(tiktokUrl)}&render_js=true`;
        
        response = await fetch(scrapingBeeUrl);

        // Si la requête réussit (status 2xx), on sort de la boucle.
        if (response.ok) {
            break;
        }

        // Si c'est une erreur serveur (5xx) et qu'on n'a pas atteint le max d'essais, on attend avant de réessayer.
        if (response.status >= 500 && attempts < maxAttempts) {
            console.log(`Attempt ${attempts} failed with status ${response.status}. Retrying in 1 second...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Attendre 1 seconde
        } else {
            // Si ce n'est pas une erreur 5xx ou si on a atteint le max d'essais, on jette l'erreur.
            throw new Error(`ScrapingBee a échoué. Status: ${response.status} ${response.statusText}`);
        }
    }

    const html = await response.text();
    
    // Le reste du code est inchangé...
    const scriptTagContent = html.split('<script id="SIGI_STATE" type="application/json">')[1]?.split('</script>')[0];
    if (!scriptTagContent) {
        throw new Error("Impossible de trouver les données SIGI_STATE même après scraping. La vidéo est peut-être privée ou inaccessible.");
    }
    
    const data = JSON.parse(scriptTagContent);
    const videoId = Object.keys(data.ItemModule)[0];
    const itemStruct = data.ItemModule[videoId];
    if (!itemStruct) {
        throw new Error("Impossible d'extraire les détails de la vidéo. La structure interne de SIGI_STATE a peut-être changé.");
    }
    
    const stats = {
        views: parseInt(itemStruct.stats.playCount) || 0,
        likes: parseInt(itemStruct.stats.diggCount) || 0,
        comments: parseInt(itemStruct.stats.commentCount) || 0,
        shares: parseInt(itemStruct.stats.shareCount) || 0,
    };
    const description = itemStruct.desc;
    const thumbnail = itemStruct.video.cover;

    const totalEngagements = stats.likes + stats.comments + stats.shares;
    const engagementRate = stats.views > 0 ? (totalEngagements / stats.views) * 100 : 0;

    // ... (Appel à l'API OpenAI, inchangé)
    const system_prompt = `Tu es un expert en marketing viral sur TikTok. Ton rôle est d'analyser une vidéo en te basant sur ses statistiques de performance et son contenu (description, miniature).
    Fournis une analyse structurée au format JSON. Le JSON doit contenir :
    - "score": un nombre de 0 à 100.
    - "points_forts": un tableau de 2-3 points positifs.
    - "points_faibles": un tableau de 2-3 points négatifs.
    - "suggestions": un tableau de 2-3 conseils concrets.
    Interprète les statistiques. Un taux d'engagement > 5% est excellent. Un ratio j'aime/vues > 10% est très bon.`;
    const r = await fetch("https://api.openai.com/v1/chat/completions", { /* ...options inchangées... */ });
    if (!r.ok) throw new Error(`Erreur de l'API OpenAI: ${await r.text()}`);
    const aiResponse = await r.json();
    const analysis = JSON.parse(aiResponse.choices[0].message.content);
    const finalResponse = { stats, engagementRate: engagementRate.toFixed(2), analysis };

    return new Response(JSON.stringify(finalResponse), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
