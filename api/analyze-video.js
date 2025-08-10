export const config = {
    // IMPORTANT: On passe en runtime Node.js car Edge ne gère pas les gros fichiers
    runtime: 'nodejs',
    maxDuration: 300, // On augmente la durée max à 5 minutes pour les transcriptions longues
};

// ===================================================================================
// == DÉBUT DE TON CODE - L'INTÉGRALITÉ DE TON MOTEUR D'ANALYSE LEMONFOX ==
// ===================================================================================

async function transcribeAudioWithLemonfox(videoUrl, lemonfoxApiKey) {
    if (!lemonfoxApiKey || !videoUrl) {
        console.warn("⚠️ ViralScope: Clé Lemonfox ou URL vidéo manquante");
        return null;
    }
    try {
        console.log("🍋 ViralScope: Transcription audio via Lemonfox.ai...");
        console.log("📥 Téléchargement de la vidéo...");
        const videoResponse = await fetch(videoUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.tiktok.com/'
            },
        });
        if (!videoResponse.ok) throw new Error(`Échec téléchargement vidéo: ${videoResponse.status}`);
        const videoBuffer = await videoResponse.arrayBuffer();
        console.log(`✅ Vidéo téléchargée: ${(videoBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

        const formData = new FormData();
        const videoBlob = new Blob([videoBuffer], { type: 'video/mp4' });
        formData.append('file', videoBlob, 'tiktok_video.mp4');
        formData.append('language', 'auto');
        formData.append('model', 'whisper-large-v3');
        formData.append('response_format', 'verbose_json');
        formData.append('temperature', '0.2');
        formData.append('timestamp_granularities[]', 'word');
        formData.append('timestamp_granularities[]', 'segment');

        console.log("🔄 Envoi à Lemonfox.ai API...");
        const lemonfoxResponse = await fetch('https://api.lemonfox.ai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${lemonfoxApiKey}` },
            body: formData,
        });
        if (!lemonfoxResponse.ok) {
            const errorText = await lemonfoxResponse.text();
            throw new Error(`Lemonfox API error ${lemonfoxResponse.status}: ${errorText}`);
        }
        const transcriptionData = await lemonfoxResponse.json();
        console.log("✅ ViralScope: Transcription Lemonfox complétée");

        const enrichedAnalysis = await enrichLemonfoxTranscription(transcriptionData);
        return {
            transcription: transcriptionData.text || '',
            langue: transcriptionData.language || 'auto',
            duree: transcriptionData.duration || null,
            segments: transcriptionData.segments || [],
            words: transcriptionData.words || [],
            confidence: calculateLemonfoxConfidence(transcriptionData),
            quality_score: assessLemonfoxQuality(transcriptionData),
            ...enrichedAnalysis,
            provider: 'Lemonfox.ai',
            model_used: 'whisper-large-v3',
            processed_at: new Date().toISOString()
        };
    } catch (error) {
        console.error("❌ ViralScope: Erreur transcription Lemonfox:", error.message);
        return null;
    }
}

function calculateLemonfoxConfidence(transcriptionData) {
    if (!transcriptionData.segments || transcriptionData.segments.length === 0) return 0;
    const scores = transcriptionData.segments.map(s => s.avg_logprob || s.confidence || 0).filter(s => s !== 0);
    if (scores.length === 0) return 0.5;
    const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    return avg < 0 ? Math.max(0, Math.min(1, Math.exp(avg))) : Math.max(0, Math.min(1, avg));
}

function assessLemonfoxQuality(transcriptionData) {
    let score = 100;
    const text = transcriptionData.text || '';
    if (text.length < 10) score -= 40;
    if ((transcriptionData.segments || []).length === 0) score -= 30;
    [/\[.*?\]/g, /\(.*?\)/g, /\.{3,}/g, /\s{3,}/g].forEach(p => { score -= (text.match(p) || []).length * 5; });
    if (transcriptionData.words && transcriptionData.words.length > 0) score += 10;
    return Math.max(0, Math.min(100, score));
}

async function enrichLemonfoxTranscription(transcriptionData) {
    const { text = '', segments = [], words = [] } = transcriptionData;
    if (!text.trim()) return getEmptyAnalysis();
    console.log("🔍 ViralScope: Enrichissement de la transcription...");
    const temporal = analyzeTemporalPatterns(segments, words);
    const hooks = detectHooksWithTimestamps(segments, text);
    const ctas = detectCTAsWithTimestamps(segments, text);
    const speech = analyzeSpeechPatterns(segments, words);
    return {
        sentiment: "non analysé", topics: [], emotions: [], keywords: [], viral_words: [],
        speech_patterns: speech,
        hooks_detected: hooks,
        cta_detected: ctas,
        temporal_analysis: temporal,
        viralscope_insights: generateViralScopeAudioInsights(segments, hooks, ctas),
        audio_optimization: generateAudioOptimizationTips(speech, temporal, hooks, ctas)
    };
}

function analyzeTemporalPatterns(segments, words) {
    if (!segments || segments.length === 0) return { total_duration: 0, words_per_minute: 0, speech_rhythm: 'inconnu' };
    const duration = segments[segments.length - 1]?.end || 0;
    const totalWords = words.length || segments.reduce((sum, s) => sum + (s.text?.split(' ').length || 0), 0);
    const wpm = duration > 0 ? (totalWords / duration) * 60 : 0;
    return { total_duration: duration, words_per_minute: wpm, speech_rhythm: wpm > 170 ? 'rapide' : wpm > 120 ? 'normal' : 'lent' };
}

function detectHooksWithTimestamps(segments, text) {
    const hooks = [];
    const patterns = [ { p: /^(pourquoi|comment|qui|que|quoi|où|quand)/i, t: 'question' }, { p: /(secret|astuce|méthode|technique)/i, t: 'secret' }, { p: /(incroyable|choc|fou|dingue)/i, t: 'emotion' }, { p: /(personne ne|jamais|interdit)/i, t: 'controversial' } ];
    segments.forEach(seg => {
        patterns.forEach(({ p, t }) => {
            if (p.test(seg.text || '')) hooks.push({ type: t, text: seg.text.trim(), start_time: seg.start });
        });
    });
    return hooks;
}

function detectCTAsWithTimestamps(segments, text) {
    const ctas = [];
    const patterns = [ { p: /(abonne|follow|s'abonner)/i, t: 'subscribe' }, { p: /(like|j'aime|double.*tap)/i, t: 'like' }, { p: /(commente|commentaire|dis.*moi)/i, t: 'comment' }, { p: /(partage|share|montre)/i, t: 'share' } ];
    segments.forEach(seg => {
        patterns.forEach(({ p, t }) => {
            if (p.test(seg.text || '')) ctas.push({ type: t, text: seg.text.trim(), start_time: seg.start });
        });
    });
    return ctas;
}

function analyzeSpeechPatterns(segments, words) {
    if (!segments || !segments.length === 0) return { filler_words_count: 0 };
    const wordFreq = {};
    words.forEach(w => {
        const clean = w.word?.toLowerCase().replace(/[^\w]/g, '') || '';
        if (clean.length > 2) wordFreq[clean] = (wordFreq[clean] || 0) + 1;
    });
    const fillerCount = ['euh', 'hum', 'alors', 'donc', 'voilà'].reduce((c, fw) => c + (wordFreq[fw] || 0), 0);
    return { filler_words_count: fillerCount };
}

function generateViralScopeAudioInsights(segments, hooks, ctas) {
    const insights = [];
    const duration = segments[segments.length - 1]?.end || 0;
    if (duration > 60) insights.push("📏 Contenu audio long - Risque de perte d'attention.");
    else insights.push(`✅ Durée audio optimale (${duration.toFixed(1)}s).`);
    if (hooks.some(h => h.start_time < 3)) insights.push("🎣 Hook efficace détecté dans les 3 premières secondes.");
    else insights.push("❌ Aucun hook audio détecté en début de vidéo.");
    if (ctas.length > 0) insights.push("📢 Appel à l'action verbal détecté.");
    else insights.push("📢 Aucun appel à l'action verbal détecté.");
    return insights;
}

function generateAudioOptimizationTips(speechPatterns, temporalAnalysis, hooks, ctas) {
    const tips = [];
    if (temporalAnalysis?.words_per_minute > 180) tips.push("🚨 Débit trop rapide - Ralentir pour améliorer la compréhension.");
    if (speechPatterns?.filler_words_count > 3) tips.push("🗣️ Réduire les mots de remplissage ('euh', 'alors').");
    if (hooks.length === 0) tips.push("🎣 Ajouter une phrase d'accroche forte dans les 3 premières secondes.");
    return tips;
}

function getEmptyAnalysis() { return { viralscope_insights: ['❌ Échec de la transcription audio'], audio_optimization: ['🔧 Vérifier la qualité audio de la vidéo'] }; }


// ===================================================================================
// ==                          FONCTION PRINCIPALE DE L'API                         ==
// ===================================================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const { url: tiktokUrl } = req.body;
  if (!tiktokUrl) return res.status(400).json({ error: 'URL invalide' });

  try {
    // --- ÉTAPE 1: SCRAPING DES STATS ET DU LIEN VIDÉO ---
    const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
    if (!SCRAPINGBEE_API_KEY) throw new Error("Clé ScrapingBee manquante.");
    
    const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${SCRAPINGBEE_API_KEY}&url=${encodeURIComponent(tiktokUrl)}&render_js=true`;
    const response = await fetch(scrapingBeeUrl);
    if (!response.ok) throw new Error(`ScrapingBee a échoué: ${response.statusText}`);
    
    const html = await response.text();
    const scriptTagContent = html.split('<script id="SIGI_STATE" type="application/json">')[1]?.split('</script>')[0];
    if (!scriptTagContent) throw new Error("Impossible de trouver les données SIGI_STATE.");
    
    const data = JSON.parse(scriptTagContent);
    const videoId = Object.keys(data.ItemModule)[0];
    const itemStruct = data.ItemModule[videoId];
    const directVideoUrl = itemStruct.video.playAddr;

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

    // --- ÉTAPE 2: TRANSCRIPTION AUDIO VIA TON MOTEUR LEMONFOX ---
    const LEMONFOX_API_KEY = process.env.LEMONFOX_API_KEY;
    const audioAnalysis = await transcribeAudioWithLemonfox(directVideoUrl, LEMONFOX_API_KEY);

    // --- ÉTAPE 3: LE GRAND FINAL - ANALYSE PAR OPENAI ---
    let userPrompt = `Analyse cette vidéo TikTok.
    **Données quantitatives :** Vues: ${videoData.stats.views}, J'aime: ${videoData.stats.likes}, Taux d'engagement: ${engagementRate.toFixed(2)}%.
    **Contenu textuel & visuel :** Description: "${videoData.description}".`;

    if (audioAnalysis && audioAnalysis.transcription) {
        userPrompt += `\n\n**Transcription audio complète :**\n"${audioAnalysis.transcription}"`;
    } else {
        userPrompt += `\n\n**Transcription audio :** N'a pas pu être récupérée.`;
    }

    const system_prompt = `Tu es ViralScope, un expert IA en stratégie de contenu sur TikTok. Analyse les données fournies et renvoie un objet JSON valide avec la structure: {"score": (0-100), "potentiel_viral": "(faible|moyen|élevé)", "qualitatif": {"hookPuissant": bool, "messageClair": bool, "ctaPresent": bool}, "algorithmique": {"hashtagsPertinents": bool, "dureeOptimale": bool, "tendanceUtilisee": bool}, "comparatif": {"benchmarkER": "(faible|moyen|bon)", "potentielViral": "(faible|moyen|élevé)"}, "points_forts": ["point"], "points_faibles": ["point"], "suggestions": ["suggestion"]}`;

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
    console.error("Erreur finale dans le handler:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
