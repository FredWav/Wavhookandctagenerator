export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  const { url } = await req.json();
  if (!url || !url.includes('tiktok.com')) {
    return new Response(JSON.stringify({ error: 'URL is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    // --- Étape 1: Scraping "agressif" de la page TikTok ---
    const tiktokResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const html = await tiktokResponse.text();
    
    // On cherche le trésor : le JSON dans la balise <script id="__NEXT_DATA__">
    const scriptTagContent = html.split('<script id="__NEXT_DATA__" type="application/json">')[1]?.split('</script>')[0];

    if (!scriptTagContent) {
        throw new Error("Impossible de trouver les données de la vidéo. La structure de la page a peut-être changé ou la vidéo est indisponible.");
    }
    
    const data = JSON.parse(scriptTagContent);
    const itemStruct = data.props.pageProps.itemInfo.itemStruct;
    
    // --- Étape 2: Extraction de toutes les stats ---
    const stats = {
        views: parseInt(itemStruct.stats.playCount) || 0,
        likes: parseInt(itemStruct.stats.diggCount) || 0,
        comments: parseInt(itemStruct.stats.commentCount) || 0,
        shares: parseInt(itemStruct.stats.shareCount) || 0,
    };
    const description = itemStruct.desc;
    const thumbnail = itemStruct.video.cover;

    // --- Étape 3: Calcul du Taux d'Engagement (ER) ---
    const totalEngagements = stats.likes + stats.comments + stats.shares;
    const engagementRate = stats.views > 0 ? (totalEngagements / stats.views) * 100 : 0;


    // --- Étape 4: Analyse par l'IA, boostée avec les stats ---
    const system_prompt = `Tu es un expert en marketing viral sur TikTok. Ton rôle est d'analyser une vidéo en te basant sur ses statistiques de performance et son contenu (description, miniature).

    Fournis une analyse structurée au format JSON. Le JSON doit contenir :
    - "score": un nombre de 0 à 100 évaluant le potentiel global.
    - "points_forts": un tableau de 2-3 points positifs (strings).
    - "points_faibles": un tableau de 2-3 points négatifs (strings).
    - "suggestions": un tableau de 2-3 conseils concrets.
    
    Interprète les statistiques fournies. Un taux d'engagement > 5% est excellent. Un ratio j'aime/vues > 10% est très bon. Commente ces chiffres dans ton analyse.`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system_prompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyse cette vidéo.
                - Description: "${description}"
                - Vues: ${stats.views}
                - J'aime: ${stats.likes}
                - Commentaires: ${stats.comments}
                - Partages: ${stats.shares}
                - Taux d'engagement calculé: ${engagementRate.toFixed(2)}%`
              },
              {
                type: "image_url",
                image_url: { "url": thumbnail }
              }
            ]
          }
        ]
      })
    });
    
    if (!r.ok) throw new Error(`Erreur de l'API OpenAI: ${await r.text()}`);

    const aiResponse = await r.json();
    const analysis = JSON.parse(aiResponse.choices[0].message.content);

    // On renvoie TOUT au frontend
    const finalResponse = {
        stats,
        engagementRate: engagementRate.toFixed(2),
        analysis
    };

    return new Response(JSON.stringify(finalResponse), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
