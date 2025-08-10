export const config = {
    runtime: 'nodejs',
    maxDuration: 300, // 5 minutes pour les tâches lourdes
};

// ===================================================================================
// == TON MOTEUR D'ANALYSE LEMONFOX - INTÉGRÉ ET RESPECTÉ ==
// ===================================================================================
async function transcribeAudioWithLemonfox(videoUrl, lemonfoxApiKey) {
    if (!lemonfoxApiKey || !videoUrl) {
        console.warn("⚠️ ViralScope: Clé Lemonfox ou URL vidéo manquante pour la transcription.");
        return null;
    }
    try {
        console.log("🍋 ViralScope: Démarrage transcription via Lemonfox.ai...");
        const videoResponse = await fetch(videoUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.tiktok.com/' } });
        if (!videoResponse.ok) throw new Error(`Échec du téléchargement de la vidéo pour la transcription: ${videoResponse.status}`);
        
        const videoBuffer = await videoResponse.arrayBuffer();
        console.log(`✅ Vidéo téléchargée: ${(videoBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

        const formData = new FormData();
        formData.append('file', new Blob([videoBuffer], { type: 'video/mp4' }), 'tiktok_video.mp4');
        formData.append('language', 'auto');
        formData.append('model', 'whisper-large-v3');
        formData.append('response_format', 'verbose_json');
        
        const lemonfoxResponse = await fetch('https://api.lemonfox.ai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${lemonfoxApiKey}` },
            body: formData,
        });

        if (!lemonfoxResponse.ok) {
            const errorText = await lemonfoxResponse.text();
            throw new Error(`Erreur API Lemonfox ${lemonfoxResponse.status}: ${errorText}`);
        }
        const transcriptionData = await lemonfoxResponse.json();
        console.log("✅ ViralScope: Transcription Lemonfox complétée.");
        return transcriptionData;
    } catch (error) {
        console.error("❌ ViralScope: Erreur critique durant la transcription Lemonfox:", error.message);
        return null; // Important: on retourne null pour ne pas faire planter le script principal
    }
}

// ===================================================================================
// ==                          FONCTION PRINCIPALE DE L'API                         ==
// ===================================================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Use POST' });
  const { url: tiktokUrl } = req.body;
  if (!tiktokUrl) return res.status(400).json({ success: false, error: 'URL invalide' });

  try {
    // --- ÉTAPE 1: SCRAPING DES DONNÉES DE BASE ---
    console.log("🐝 Démarrage du scraping avec ScrapingBee...");
    const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
    if (!SCRAPINGBEE_API_KEY) throw new Error("Clé API ScrapingBee manquante.");
    
    const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${SCRAPINGBEE_API_KEY}&url=${encodeURIComponent(tiktokUrl)}&render_js=true`;
    const response = await fetch(scrapingBeeUrl);
    if (!response.ok) throw new Error(`ScrapingBee a échoué: ${response.statusText}`);
    
    const html = await response.text();
    const scriptTagContent = html.split('<script id="SIGI_STATE" type="application/json">')[1]?.split('</script>')[0];
    if (!scriptTagContent) throw new Error("Impossible de trouver les données SIGI_STATE. La structure de la page a peut-être changé.");
    
    const data = JSON.parse(scriptTagContent);
    const videoId = Object.keys(data.ItemModule)[0];
    const itemStruct = data.ItemModule[videoId];
    const directVideoUrl = itemStruct.video.playAddr;
    console.log("✅ Scraping des métadonnées réussi.");

    const videoData = {
        description: itemStruct.desc,
        thumbnail: itemStruct.video.cover,
        author: itemStruct.author.uniqueId,
        stats: {
            views: parseInt(itemStruct.stats.playCount) || 0,
            likes: parseInt(itemStruct.stats.diggCount) || 0,
            comments: parseInt(itemStruct.stats.commentCount) || 0,
            shares: parseInt(itemStruct.stats.shareCount) || 0,
        }
    };
    const totalEngagements = videoData.stats.likes + videoData.stats.comments + videoData.stats.shares;
    const engagementRate = videoData.stats.views > 0 ? (totalEngagements / videoData.stats.views) * 100 : 0;

    // --- ÉTAPE 2: TRANSCRIPTION AUDIO (Ton moteur) ---
    const LEMONFOX_API_KEY = process.env.LEMONFOX_API_KEY;
    const audioAnalysis = await transcribeAudioWithLemonfox(directVideoUrl, LEMONFOX_API_KEY);

    // --- ÉTAPE 3: ANALYSE FINALE PAR OPENAI ---
    console.log("🤖 Préparation de la requête pour OpenAI...");
    let userPrompt = `Analyse cette vidéo TikTok.
    **Données quantitatives :** Vues: ${videoData.stats.views}, J'aime: ${videoData.stats.likes}, Taux d'engagement: ${engagementRate.toFixed(2)}%.
    **Contenu :** Description: "${videoData.description}".`;

    if (audioAnalysis && audioAnalysis.text) {
        userPrompt += `\n\n**Transcription audio :**\n"${audioAnalysis.text}"`;
    } else {
        userPrompt += `\n\n**Transcription audio :** N'a pas pu être récupérée.`;
    }

    const system_prompt = `Tu es ViralScope, un expert IA en stratégie de contenu TikTok. Analyse les données fournies et renvoie un objet JSON VALIDE avec la structure: {"score": (0-100), "potentiel_viral": "(faible|moyen|élevé)", "qualitatif": {"hookPuissant": bool, "messageClair": bool, "ctaPresent": bool}, "algorithmique": {"hashtagsPertinents": bool, "dureeOptimale": bool, "tendanceUtilisee": bool}, "comparatif": {"benchmarkER": "(faible|moyen|bon)"}, "points_forts": ["point"], "points_faibles": ["point"], "suggestions": ["suggestion"]}`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`},
        body: JSON.stringify({
            model: "gpt-4o", response_format: { type: "json_object" },
            messages: [
                { role: "system", content: system_prompt },
                { role: "user", content: [{ type: "text", text: userPrompt }, { type: "image_url", image_url: { "url": videoData.thumbnail } }] }
            ]
        })
    });

    if (!r.ok) throw new Error(`Erreur de l'API OpenAI: ${await r.text()}`);
    const aiResponse = await r.json();
    const finalAnalysis = JSON.parse(aiResponse.choices[0].message.content);
    console.log("✅ Analyse OpenAI réussie.");

    const finalResponse = {
        success: true,
        video: videoData,
        metrics: {
            engagementRate: engagementRate,
            likesRatio: videoData.stats.views > 0 ? (videoData.stats.likes / videoData.stats.views) * 100 : 0,
        },
        analysis: finalAnalysis,
        audioAnalysis: audioAnalysis 
    };
    
    return res.status(200).json(finalResponse);

  } catch (error) {
    console.error("❌ Erreur finale dans le handler:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
