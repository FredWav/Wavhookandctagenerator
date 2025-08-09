export const config = { runtime: "edge" };

async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Failed to fetch after multiple retries');
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405 });
  }

  const { url } = await req.json();
  if (!url) {
    return new Response(JSON.stringify({ error: 'URL is required' }), { status: 400 });
  }

  try {
    // --- Étape 1: Scraping de la page TikTok ---
    const tiktokResponse = await fetchWithRetry(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const html = await tiktokResponse.text();
    
    // On cherche le JSON de la page, c'est plus fiable que de parser le HTML
    const scriptTagContent = html.split('<script id="__NEXT_DATA__" type="application/json">')[1]?.split('</script>')[0];

    if (!scriptTagContent) {
        throw new Error("Impossible de trouver les données de la vidéo. La structure de la page a peut-être changé.");
    }
    
    const data = JSON.parse(scriptTagContent);
    const videoData = data.props.pageProps.itemInfo.itemStruct;
    
    const description = videoData.desc;
    const thumbnail = videoData.video.cover;

    if (!description || !thumbnail) {
        throw new Error("Description ou miniature non trouvée dans les données.");
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

    return new Response(JSON.stringify(analysis), { status: 200 });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
