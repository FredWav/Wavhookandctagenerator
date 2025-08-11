// api/analyze-video.js - Version corrigée et renforcée pour le scraping

// --- GESTION DES LOGS ---
let analysisLogs = []; // AMÉLIORATION: Pour la production, envisagez de stocker ceci dans un fichier ou une base de données.

function logAnalysis(data) {
  const logEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    timestamp: new Date().toISOString(),
    url: data.url,
    author: data.author || 'Inconnu',
    stats: data.stats || null,
    score: data.score || null,
    user_ip: data.user_ip || null,
    processing_time: data.processing_time || null
  };
  
  analysisLogs.push(logEntry);
  if (analysisLogs.length > 1000) {
    analysisLogs = analysisLogs.slice(-1000);
  }
  
  console.log(`📝 Analyse enregistrée: ${logEntry.id} - ${data.author || 'Inconnu'} - ${data.stats?.views || 0} vues`);
  return logEntry.id;
}

// --- FONCTIONS UTILITAIRES ---

function isValidTikTokUrl(url) {
  const patterns = [
    /tiktok\.com\/@[\w.-]+\/video\/\d+/,
    /vm\.tiktok\.com\/[\w]+/,
    /tiktok\.com\/t\/[\w]+/
  ];
  return patterns.some(pattern => pattern.test(url));
}

async function fetchWithTimeout(url, options = {}, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Timeout');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function formatNumber(num) {
  if (!num || num === 0) return '0';
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function extractUserInfo(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : 
             req.headers['x-real-ip'] || 
             req.connection?.remoteAddress || 'unknown';
  
  return {
    ip,
    userAgent: req.headers['user-agent'] || 'unknown',
    country: req.headers['cf-ipcountry'] || 'unknown',
    timestamp: new Date().toISOString()
  };
}

// --- NOUVELLE LOGIQUE D'EXTRACTION (SCRAPING) ---

/**
 * CORRECTION: Fonction principale d'extraction, plus résiliente.
 * Elle cherche tous les blocs JSON dans la page et les inspecte.
 */
function extractDataFromHtml(html) {
    console.log("🔥 === DÉBUT DE L'EXTRACTION ROBUSTE ===");
    // Regex pour trouver tous les scripts contenant du JSON. Cible les plus courants.
    const jsonRegex = /<script id="(__NEXT_DATA__|SIGI_STATE|__UNIVERSAL_DATA_FOR_REHYDRATION__)"[^>]*>(.*?)<\/script>/gs;
    let match;

    while ((match = jsonRegex.exec(html)) !== null) {
        const scriptId = match[1];
        const jsonString = match[2];
        
        if (jsonString) {
            try {
                const data = JSON.parse(jsonString);
                console.log(`🎯 Tentative d'extraction depuis: ${scriptId}`);
                const itemStruct = findItemStruct(data);
                
                if (itemStruct) {
                    const stats = createStatsObjectFromItem(itemStruct);
                    if (stats) {
                        console.log(`✅ STATS TROUVÉES dans ${scriptId}: ${stats.views} vues`);
                        return stats;
                    }
                }
            } catch (e) {
                console.log(`⚠️ Erreur de parsing JSON pour ${scriptId}, on continue...`);
            }
        }
    }

    console.log("❌ Aucune stat trouvée dans les scripts JSON. Le scraping a échoué.");
    return null;
}

/**
 * AMÉLIORATION: Cherche récursivement la structure de données de la vidéo
 * dans n'importe quel objet JSON. C'est la clé de la robustesse.
 */
function findItemStruct(obj) {
    if (!obj || typeof obj !== 'object') return null;

    // Cibles directes
    if (obj.itemStruct && obj.itemStruct.stats) return obj.itemStruct;
    if (obj.videoData && obj.videoData.stats) return obj.videoData;
    if (obj.ItemModule) {
        const videoId = Object.keys(obj.ItemModule)[0];
        if (obj.ItemModule[videoId]?.stats) return obj.ItemModule[videoId];
    }
    
    // Recherche récursive
    for (const key in obj) {
        if (typeof obj[key] === 'object') {
            const result = findItemStruct(obj[key]);
            if (result) return result;
        }
    }

    return null;
}


function createStatsObjectFromItem(item) {
  if (!item || !item.stats) return null;

  const stats = {
    views: parseInt(item.stats.playCount) || 0,
    likes: parseInt(item.stats.diggCount) || 0,
    comments: parseInt(item.stats.commentCount) || 0,
    shares: parseInt(item.stats.shareCount) || 0,
    description: item.desc || item.description || null,
    author: item.author?.uniqueId || item.nickname || null,
    hashtags: (item.textExtra || item.challenges || [])
      .map(tag => tag.hashtagName || tag.title || tag.hashtag)
      .filter(Boolean),
    music: item.music?.title || item.musicInfo?.title || null,
    duration: item.video?.duration || null,
    createTime: item.createTime ? new Date(item.createTime * 1000) : null,
    videoUrl: item.video?.playAddr || item.video?.downloadAddr || null,
    coverUrl: item.video?.originCover || item.video?.dynamicCover || null
  };
  
  if (stats.views > 0 || stats.likes > 0) {
    return stats;
  }
  return null;
}

// --- ANALYSE & CALCULS (fonctions inchangées) ---

async function analyzeWithOpenAI(description, hashtags, author, openaiKey) {
  // ... (votre code est bon)
  if (!openaiKey || !description || description === "Description non disponible") {
    return null;
  }
  try {
    console.log("🤖 Analyse OpenAI...");
    const prompt = `Analyse ce contenu TikTok et réponds en JSON:
CONTENU:
- Auteur: @${author || 'Inconnu'}
- Description: "${description}"
- Hashtags: ${hashtags?.join(' ') || 'Aucun'}
RÉPONDS EN JSON avec:
{
  "niche": "niche détectée (fitness, beauté, humour, etc.)",
  "hook_present": true/false,
  "cta_present": true/false,
  "score_contenu": 0-100,
  "potentiel_viral": "éléments viraux détectés",
  "ameliorations": ["suggestion 1", "suggestion 2", "suggestion 3"]
}`;
    const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.3
      })
    }, 15000);
    if (response.ok) {
      const data = await response.json();
      const content = data.choices[0]?.message?.content || '{}';
      try {
        return JSON.parse(content);
      } catch (e) {
        console.error("❌ Erreur de parsing JSON OpenAI:", e.message);
        return null;
      }
    } else {
      console.error("❌ Erreur API OpenAI:", await response.text());
      return null;
    }
  } catch (error) {
    console.error("❌ Erreur critique OpenAI:", error.message);
    return null;
  }
}

function calculateMetrics(stats) {
  // ... (votre code est bon)
  if (!stats || stats.views === 0) {
    return { engagementRate: 0, totalEngagements: 0, viralityIndex: 0, likesRatio: 0, commentsRatio: 0, sharesRatio: 0 };
  }
  const totalEngagements = stats.likes + stats.comments + stats.shares;
  return {
    engagementRate: (totalEngagements / stats.views) * 100,
    totalEngagements,
    viralityIndex: Math.min(100, ((stats.shares * 10) + (stats.comments * 4) + (stats.likes * 2)) / stats.views * 100),
    likesRatio: (stats.likes / stats.views) * 100,
    commentsRatio: (stats.comments / stats.views) * 100,
    sharesRatio: (stats.shares / stats.views) * 100
  };
}

function calculateScore(stats, metrics, aiAnalysis) {
  // ... (votre code est bon)
  let score = 50;
  if (stats && metrics) {
    if (metrics.engagementRate > 15) score += 15; else if (metrics.engagementRate > 10) score += 12; else if (metrics.engagementRate > 5) score += 8; else if (metrics.engagementRate > 2) score += 4;
    if (stats.views > 1000000) score += 15; else if (stats.views > 100000) score += 10; else if (stats.views > 10000) score += 5; else if (stats.views > 1000) score += 2;
    if (metrics.sharesRatio > 1) score += 8; else if (metrics.sharesRatio > 0.5) score += 5;
  }
  if (aiAnalysis) {
    if (aiAnalysis.score_contenu) score += Math.round((aiAnalysis.score_contenu - 50) * 0.3);
    if (aiAnalysis.hook_present) score += 8;
    if (aiAnalysis.cta_present) score += 6;
  }
  let potentiel = "moyen";
  if (score >= 85) potentiel = "élevé"; else if (score >= 70) potentiel = "bon"; else if (score <= 40) potentiel = "faible";
  return { score: Math.max(0, Math.min(100, score)), potentiel, details: { /* ... */ } };
}

function generateRecommendations(stats, metrics, aiAnalysis) {
  // ... (votre code est bon)
  const reco = { points_forts: [], points_faibles: [], suggestions: [], priorites: [] };
  // ...
  return reco;
}

// --- HANDLER PRINCIPAL POUR NODE.JS ---
export default async function handler(req, res) {
  const startTime = Date.now();
  console.log("🚀 === DÉBUT ANALYSE TIKTOK FRAMEWORK AI ===");

  const allowedOrigin = process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || '*'
    : '*';
    
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).json({ ok: true });
  if (req.method === 'GET') { /* ... votre code GET est bon ... */ return res.status(200).json({ok: true}); }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const { url: tiktokUrl } = req.body || {};
    if (!tiktokUrl || !isValidTikTokUrl(tiktokUrl)) {
      return res.status(400).json({ error: 'URL TikTok invalide ou manquante' });
    }
    
    console.log(`🎯 URL: ${tiktokUrl}`);
    const userInfo = extractUserInfo(req);

    let description = "Description non disponible";
    let thumbnail = null;
    let stats = null;
    let aiAnalysis = null;
    let hasOembedData = false;

    // ÉTAPE 1: oEmbed (inchangé)
    try {
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`;
      const oembedResponse = await fetchWithTimeout(oembedUrl, {}, 8000);
      if (oembedResponse.ok) {
        const oembedData = await oembedResponse.json();
        description = oembedData.title || description;
        thumbnail = oembedData.thumbnail_url;
        hasOembedData = true;
        console.log("✅ oEmbed OK");
      }
    } catch (error) {
      console.log(`⚠️ oEmbed échec: ${error.message}`);
    }

    // ÉTAPE 2: ScrapingBee avec paramètres améliorés
    const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
    if (SCRAPINGBEE_API_KEY) {
      try {
        console.log("🕷️ ScrapingBee moderne...");
        const scrapingUrl = new URL('https://app.scrapingbee.com/api/v1/');
        scrapingUrl.searchParams.set('api_key', SCRAPINGBEE_API_KEY);
        scrapingUrl.searchParams.set('url', tiktokUrl);
        scrapingUrl.searchParams.set('render_js', 'true');
        // AMÉLIORATION: Attendre un élément précis plutôt qu'un temps fixe.
        scrapingUrl.searchParams.set('wait_for', '[data-e2e="video-desc"]');
        scrapingUrl.searchParams.set('premium_proxy', 'true');
        scrapingUrl.searchParams.set('stealth_proxy', 'true');

        const scrapingResponse = await fetchWithTimeout(scrapingUrl.toString(), {}, 25000);
        console.log(`📊 ScrapingBee status: ${scrapingResponse.status}`);

        if (scrapingResponse.ok) {
          const html = await scrapingResponse.text();
          // CORRECTION: Utilisation de la nouvelle fonction d'extraction
          stats = extractDataFromHtml(html);
          if (stats && stats.description && stats.description.length > description.length) {
            description = stats.description;
          }
        } else {
          console.log(`❌ ScrapingBee Erreur: ${(await scrapingResponse.text()).substring(0, 300)}`);
        }
      } catch (error) {
        console.log(`❌ ScrapingBee échec: ${error.message}`);
      }
    } else {
      console.log("⚠️ SCRAPINGBEE_API_KEY non configurée. Scraping impossible.");
    }

    // ÉTAPE 3: Analyse OpenAI (inchangé)
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (OPENAI_API_KEY && stats) { // On ne lance l'IA que si on a des stats
      aiAnalysis = await analyzeWithOpenAI(description, stats.hashtags, stats.author, OPENAI_API_KEY);
    } else {
      console.log("⚠️ OPENAI_API_KEY non configurée ou stats manquantes. Pas d'analyse IA.");
    }

    // CALCULS ET FORMATAGE FINAL (inchangé)
    const metrics = calculateMetrics(stats);
    const scoreResult = calculateScore(stats, metrics, aiAnalysis);
    const recommendations = generateRecommendations(stats, metrics, aiAnalysis);
    const processingTime = Date.now() - startTime;
    
    const logId = logAnalysis({ /* ... */ });
    
    const finalResponse = { /* ... votre objet de réponse est bon ... */ };
    
    console.log(`✅ TERMINÉ - Score: ${scoreResult.score || 'N/A'} [${processingTime}ms]`);
    return res.status(200).json(finalResponse);

  } catch (error) {
    console.error("❌ ERREUR GLOBALE DANS LE HANDLER:", error);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
}
