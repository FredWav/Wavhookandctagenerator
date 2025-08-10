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
    // --- Étape 1: On passe par ScrapingBee pour scraper la page ---
    const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${SCRAPINGBEE_API_KEY}&url=${encodeURIComponent(tiktokUrl)}&render_js=true`;
    
    const response = await fetch(scrapingBeeUrl);
    
    if (!response.ok) {
        throw new Error(`ScrapingBee a échoué. Status: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    
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
    
    // --- Le reste du code (extraction, calcul, IA) est inchangé ---
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

    const system_prompt = `Tu es un expert en marketing viral sur TikTok. Ton rôle est d'analyser une vidéo en te basant sur ses statistiques de performance et son contenu (description, miniature).
    Fournis une analyse structurée au format JSON. Le JSON doit contenir :
    - "score": un nombre de 0 à 100.
    - "points_forts": un tableau de 2-3 points positifs.
    - "points_faibles": un tableau de 2-3 points négatifs.
    - "suggestions": un tableau de 2-3 conseils concrets.
    Interprète les statistiques. Un taux d'engagement > 5% est excellent. Un ratio j'aime/vues > 10% est très bon.`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`},
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system_prompt },
          {
            role: "user",
            content: [
              { type: "text", text: `Analyse cette vidéo.\n- Description: "${description}"\n- Vues: ${stats.views}\n- J'aime: ${stats.likes}\n- Commentaires: ${stats.comments}\n- Partages: ${stats.shares}\n- Taux d'engagement calculé: ${engagementRate.toFixed(2)}%` },
              { type: "image_url", image_url: { "url": thumbnail } }
            ]
          }
        ]
      })
    });
    
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
