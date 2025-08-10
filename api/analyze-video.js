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
    // --- Étape 1: Utilisation de l'endpoint oEmbed de TikTok ---
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const oembedResponse = await fetch(oembedUrl);

    if (!oembedResponse.ok) {
      throw new Error("Impossible de récupérer les informations de la vidéo via l'endpoint oEmbed. L'URL est peut-être invalide ou la vidéo est privée.");
    }
    
    const videoData = await oembedResponse.json();
    
    const description = videoData.title || "Aucune description trouvée.";
    const thumbnail = videoData.thumbnail_url;

    if (!thumbnail) {
        throw new Error("Miniature non trouvée dans les données oEmbed.");
    }

    // --- Étape 2: Analyse par l'IA d'OpenAI ---
    const system_prompt = `Tu es un expert en marketing viral sur TikTok. Ton rôle est d'analyser la description textuelle et la miniature d'une vidéo pour évaluer son potentiel de réussite.
    
    Fournis une analyse structurée et concise au format JSON. Le JSON doit contenir les clés suivantes :
    - "score": un nombre entier de 0 à 100 évaluant le potentiel de viralité.
    - "points_forts": un tableau de 2 à 3 points positifs (strings).
    - "points_faibles": un tableau de 2 à 3 points négatifs (strings).
    - "suggestions": un tableau de 2 à 3 conseils concrets pour améliorer la vidéo (strings).
    
    Sois direct, honnête et base ton analyse sur des principes de marketing de contenu (clarté, curiosité, bénéfice, appel à l'action, etc.).`;

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
                text: `Analyse cette vidéo. Description: "${description}"`
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
    
    if (!r.ok) {
        const errText = await r.text();
        throw new Error(`Erreur de l'API OpenAI: ${errText}`);
    }

    const aiResponse = await r.json();
    const analysis = JSON.parse(aiResponse.choices[0].message.content);

    return new Response(JSON.stringify(analysis), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
