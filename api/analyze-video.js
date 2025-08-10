export const config = { runtime: "edge" };

export default async function handler(req) {
  // ... (le début du code reste inchangé) ...
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
    
    const system_prompt = `Tu es un expert en marketing viral sur TikTok... (prompt inchangé)`;
    
    const r = await fetch("https://api.openai.com/v1/chat/completions", { /* ... options inchangées ... */ });
    
    if (!r.ok) throw new Error(`Erreur de l'API OpenAI: ${await r.text()}`);

    const aiResponse = await r.json();
    const content = aiResponse.choices[0].message.content;
    
    // --- CORRECTIF : On ajoute une sécurité ici ---
    let analysis;
    try {
      // On essaie de lire la réponse comme du JSON
      analysis = JSON.parse(content);
    } catch (e) {
      // Si ça échoue, c'est que l'IA a renvoyé du texte. On renvoie une erreur claire.
      console.error("OpenAI response was not valid JSON:", content);
      throw new Error(`L'IA a renvoyé une réponse invalide. Contenu : "${content}"`);
    }

    const finalResponse = { stats, engagementRate: engagementRate.toFixed(2), analysis };
    return new Response(JSON.stringify(finalResponse), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
