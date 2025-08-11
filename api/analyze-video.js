// api/analyze-video.js - Version finale production avec toutes les fonctionnalités

// --- GESTION DES LOGS ---
let analysisLogs = [];

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

// --- LOGIQUE D'EXTRACTION (SCRAPING) ---

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

function extractStatsModernTikTok(html) {
  console.log("🔥 === EXTRACTION TIKTOK MODERNE ===");
  
  // 1. __NEXT_DATA__
  try {
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (nextDataMatch && nextDataMatch[1]) {
      const nextData = JSON.parse(nextDataMatch[1]);
      const possiblePaths = [
        nextData?.props?.pageProps?.itemInfo?.itemStruct,
        nextData?.props?.pageProps?.videoData,
        nextData?.props?.pageProps?.itemDetail,
        nextData?.props?.pageProps?.serverCode?.ItemModule,
      ].filter(Boolean);

      for (const data of possiblePaths) {
        const stats = createStatsObjectFromItem(data);
        if (stats) {
          console.log(`✅ STATS __NEXT_DATA__: ${stats.views} vues, ${stats.likes} likes`);
          return stats;
        }
      }
      
      if (nextData?.props?.pageProps?.serverCode?.ItemModule) {
        const itemModule = nextData.props.pageProps.serverCode.ItemModule;
        const videoIds = Object.keys(itemModule);
        for (const videoId of videoIds) {
          const stats = createStatsObjectFromItem(itemModule[videoId]);
          if (stats) {
            console.log(`✅ STATS __NEXT_DATA__ ItemModule: ${stats.views} vues, ${stats.likes} likes`);
            return stats;
          }
        }
      }
    }
  } catch (error) {
    console.log(`❌ Erreur __NEXT_DATA__: ${error.message}`);
  }

  // 2. SIGI_STATE
  try {
    const sigiMatch = html.split('<script id="SIGI_STATE" type="application/json">')[1];
    if (sigiMatch) {
      const jsonStr = sigiMatch.split('</script>')[0];
      if (jsonStr) {
        const data = JSON.parse(jsonStr);
        if (data.ItemModule) {
          const videoId = Object.keys(data.ItemModule)[0];
          const item = data.ItemModule[videoId];
          const stats = createStatsObjectFromItem(item);
          if (stats) {
            console.log(`✅ STATS SIGI_STATE: ${stats.views} vues, ${stats.likes} likes`);
            return stats;
          }
        }
        
        if (data['__DEFAULT_SCOPE__']?.['webapp.video-detail']?.itemInfo?.itemStruct) {
          const item = data['__DEFAULT_SCOPE__']['webapp.video-detail'].itemInfo.itemStruct;
          const stats = createStatsObjectFromItem(item);
          if (stats) {
            console.log(`✅ STATS SIGI_STATE __DEFAULT_SCOPE__: ${stats.views} vues, ${stats.likes} likes`);
            return stats;
          }
        }
      }
    }
  } catch (error) {
    console.log(`❌ Erreur SIGI_STATE: ${error.message}`);
  }

  // 3. RECHERCHE AGRESSIVE PAR PATTERNS
  console.log("🎯 Recherche agressive par patterns en dernier recours...");
  
  try {
    const patterns = [
      /window\.__INITIAL_STATE__\s*=\s*({.*?});/s,
      /window\.__UNIVERSAL_DATA_FOR_REHYDRATION__\s*=\s*({.*?});/s,
      /"itemInfo":\s*({.*?"itemStruct".*?})/s,
      /"videoData":\s*({.*?"stats".*?})/s,
    ];

    for (let i = 0; i < patterns.length; i++) {
      const match = html.match(patterns[i]);
      if (match && match[1]) {
        try {
          const data = JSON.parse(match[1]);
          const stats = findStatsInObject(data);
          if (stats) {
            console.log(`✅ STATS PATTERN ${i}: ${stats.views} vues, ${stats.likes} likes`);
            return stats;
          }
        } catch (parseError) {
          continue;
        }
      }
    }

    const playCountMatches = [...html.matchAll(/"playCount":(\d+)/g)];
    const diggCountMatches = [...html.matchAll(/"diggCount":(\d+)/g)];
    const commentCountMatches = [...html.matchAll(/"commentCount":(\d+)/g)];
    const shareCountMatches = [...html.matchAll(/"shareCount":(\d+)/g)];

    if (playCountMatches.length > 0) {
      const views = Math.max(...playCountMatches.map(m => parseInt(m[1])));
      const likes = diggCountMatches.length > 0 ? Math.max(...diggCountMatches.map(m => parseInt(m[1]))) : 0;
      const comments = commentCountMatches.length > 0 ? Math.max(...commentCountMatches.map(m => parseInt(m[1]))) : 0;
      const shares = shareCountMatches.length > 0 ? Math.max(...shareCountMatches.map(m => parseInt(m[1]))) : 0;

      if (views > 0) {
        const stats = { 
          views, likes, comments, shares, 
          description: null, author: null, hashtags: [], 
          music: null, duration: null 
        };
        console.log(`✅ STATS PATTERN INDIVIDUEL: ${views} vues, ${likes} likes`);
        return stats;
      }
    }

  } catch (error) {
    console.log(`❌ Erreur recherche agressive: ${error.message}`);
  }
  
  console.log("❌ Aucune stat trouvée par toutes les méthodes.");
  return null;
}

function findStatsInObject(obj, depth = 0) {
  if (depth > 10) return null;
  
  if (obj && typeof obj === 'object') {
    if (obj.stats && (obj.stats.playCount || obj.stats.viewCount)) {
      return createStatsObjectFromItem(obj);
    }
    
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'itemStruct' || key === 'videoData' || key === 'itemInfo') {
        const stats = createStatsObjectFromItem(value);
        if (stats) return stats;
      }
      
      if (typeof value === 'object' && value !== null) {
        const stats = findStatsInObject(value, depth + 1);
        if (stats) return stats;
      }
    }
  }
  
  return null;
}

// --- ANALYSE & CALCULS ---

async function analyzeWithOpenAI(description, hashtags, author, openaiKey) {
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
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`
      },
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
        const analysis = JSON.parse(content);
        console.log("✅ Analyse OpenAI OK");
        return analysis;
      } catch (parseError) {
        console.error("❌ Erreur de parsing JSON OpenAI:", parseError.message);
        console.log("📝 Contenu reçu:", content);
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
  if (!stats || stats.views === 0) {
    return { 
      engagementRate: 0, 
      totalEngagements: 0, 
      viralityIndex: 0,
      likesRatio: 0,
      commentsRatio: 0,
      sharesRatio: 0
    };
  }
  
  const totalEngagements = stats.likes + stats.comments + stats.shares;
  const engagementRate = (totalEngagements / stats.views) * 100;
  
  return {
    engagementRate,
    totalEngagements,
    viralityIndex: Math.min(100, ((stats.shares * 10) + (stats.comments * 4) + (stats.likes * 2)) / stats.views * 100),
    likesRatio: (stats.likes / stats.views) * 100,
    commentsRatio: (stats.comments / stats.views) * 100,
    sharesRatio: (stats.shares / stats.views) * 100
  };
}

function calculateScore(stats, metrics, aiAnalysis) {
  let score = 50;
  
  if (stats && metrics) {
    if (metrics.engagementRate > 15) score += 15;
    else if (metrics.engagementRate > 10) score += 12;
    else if (metrics.engagementRate > 5) score += 8;
    else if (metrics.engagementRate > 2) score += 4;
    
    if (stats.views > 1000000) score += 15;
    else if (stats.views > 100000) score += 10;
    else if (stats.views > 10000) score += 5;
    else if (stats.views > 1000) score += 2;
    
    if (metrics.sharesRatio > 1) score += 8;
    else if (metrics.sharesRatio > 0.5) score += 5;
  }
  
  if (aiAnalysis) {
    if (aiAnalysis.score_contenu) score += Math.round((aiAnalysis.score_contenu - 50) * 0.3);
    if (aiAnalysis.hook_present) score += 8;
    if (aiAnalysis.cta_present) score += 6;
  }
  
  let potentiel = "moyen";
  if (score >= 85) potentiel = "élevé";
  else if (score >= 70) potentiel = "bon";
  else if (score <= 40) potentiel = "faible";
  
  return { 
    score: Math.max(0, Math.min(100, score)), 
    potentiel,
    details: {
      quantitatif: stats ? Math.min(40, (metrics.engagementRate / 15) * 40) : 0,
      qualitatif: aiAnalysis ? (aiAnalysis.hook_present ? 8 : 0) + (aiAnalysis.cta_present ? 6 : 0) : 0,
      viralite: stats ? Math.min(20, metrics.viralityIndex / 5) : 0
    }
  };
}

function generateRecommendations(stats, metrics, aiAnalysis) {
  const reco = { 
    points_forts: [], 
    points_faibles: [], 
    suggestions: [],
    priorites: []
  };
  
  if (stats && metrics.engagementRate > 10) {
    reco.points_forts.push(`🔥 Excellent engagement (${metrics.engagementRate.toFixed(1)}%)`);
  }
  if (stats && stats.views > 500000) {
    reco.points_forts.push(`🚀 Excellente portée (${formatNumber(stats.views)} vues)`);
  }
  if (stats && metrics.sharesRatio > 1) {
    reco.points_forts.push(`📤 Très bon taux de partage (${metrics.sharesRatio.toFixed(1)}%)`);
  }
  if (aiAnalysis?.niche) {
    reco.points_forts.push(`🎯 Niche identifiée: ${aiAnalysis.niche}`);
  }
  if (aiAnalysis?.hook_present) {
    reco.points_forts.push("🎣 Hook efficace détecté");
  }
  if (aiAnalysis?.cta_present) {
    reco.points_forts.push("📢 Appel à l'action présent");
  }
  
  if (stats && metrics.engagementRate < 3) {
    reco.points_faibles.push("📉 Taux d'engagement faible");
    reco.priorites.push("🔥 PRIORITÉ 1: Améliorer l'engagement (hook + CTA)");
  }
  if (aiAnalysis && !aiAnalysis.hook_present) {
    reco.points_faibles.push("🎣 Absence de hook détectable");
    reco.priorites.push("🎯 PRIORITÉ 2: Créer un hook percutant dans les 3 premières secondes");
  }
  if (aiAnalysis && !aiAnalysis.cta_present) {
    reco.points_faibles.push("📢 Pas d'appel à l'action clair");
  }
  if (stats && metrics.sharesRatio < 0.1) {
    reco.points_faibles.push("📤 Faible taux de partage");
  }
  
  if (aiAnalysis?.ameliorations && Array.isArray(aiAnalysis.ameliorations)) {
    reco.suggestions.push(...aiAnalysis.ameliorations.map(a => `💡 ${a}`));
  }
  
  if (stats) {
    if (metrics.engagementRate < 5) {
      reco.suggestions.push("💬 Poser des questions pour inciter aux commentaires");
      reco.suggestions.push("🎬 Créer du suspense pour maintenir l'attention");
    }
    if (metrics.sharesRatio < 0.5) {
      reco.suggestions.push("📤 Créer du contenu plus partageable (tips, révélations)");
    }
  } else {
    reco.suggestions.push("📊 Les stats sont difficiles à extraire. TikTok renforce ses protections.");
    reco.suggestions.push("🔄 Essayez avec des proxies premium ou une autre méthode.");
  }
  
  reco.suggestions.push("📈 Analysez régulièrement vos vidéos pour identifier les patterns qui marchent");
  
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
  res.setHeader('Cache-Control', 'public, max-age=300');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    const { logs, stats: showStats } = req.query;
    
    if (logs === 'true' || showStats === 'true') {
      const stats = {
        total_analyses: analysisLogs.length,
        derniere_analyse: analysisLogs.length > 0 ? analysisLogs[analysisLogs.length - 1].timestamp : null,
        analyses_24h: analysisLogs.filter(log => 
          new Date(log.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
        ).length,
        performance: {
          temps_moyen_ms: analysisLogs.length > 0 ? 
            Math.round(analysisLogs.reduce((acc, log) => acc + (log.processing_time || 0), 0) / analysisLogs.length) : 0
        }
      };
      
      const response = { success: true, version: "4.1-nodejs-production", stats };
      
      if (logs === 'true') {
        response.recent_analyses = analysisLogs.slice(-20);
      }
      
      return res.status(200).json(response);
    }
    
    return res.status(405).json({ error: 'Utilisez ?logs=true pour voir les statistiques' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const { url: tiktokUrl } = req.body || {};
    if (!tiktokUrl || !isValidTikTokUrl(tiktokUrl)) {
      return res.status(400).json({ 
        error: 'URL TikTok invalide ou manquante',
        hint: 'Format attendu: https://www.tiktok.com/@username/video/123456789'
      });
    }
    
    console.log(`🎯 URL: ${tiktokUrl}`);
    const userInfo = extractUserInfo(req);

    let description = "Description non disponible";
    let thumbnail = null;
    let stats = null;
    let aiAnalysis = null;
    let hasOembedData = false;

    // ÉTAPE 1: oEmbed
    try {
      console.log("📡 oEmbed...");
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`;
      const oembedResponse = await fetchWithTimeout(oembedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        }
      }, 8000);
      
      if (oembedResponse.ok) {
        const oembedData = await oembedResponse.json();
        description = oembedData.title || description;
        thumbnail = oembedData.thumbnail_url;
        hasOembedData = true;
        console.log("✅ oEmbed OK");
      } else {
        console.log(`⚠️ oEmbed status: ${oembedResponse.status}`);
      }
    } catch (error) {
      console.log(`⚠️ oEmbed échec: ${error.message}`);
    }

    // ÉTAPE 2: ScrapingBee
    const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
    if (SCRAPINGBEE_API_KEY) {
      try {
        console.log("🕷️ ScrapingBee moderne...");
        const scrapingUrl = new URL('https://app.scrapingbee.com/api/v1/');
        scrapingUrl.searchParams.set('api_key', SCRAPINGBEE_API_KEY);
        scrapingUrl.searchParams.set('url', tiktokUrl);
        scrapingUrl.searchParams.set('render_js', 'true');
        scrapingUrl.searchParams.set('wait', '6000');
        scrapingUrl.searchParams.set('premium_proxy', 'true');
        scrapingUrl.searchParams.set('stealth_proxy', 'true');
        scrapingUrl.searchParams.set('window_width', '1920');
        scrapingUrl.searchParams.set('window_height', '1080');

        const scrapingResponse = await fetchWithTimeout(scrapingUrl.toString(), {}, 25000);
        console.log(`📊 ScrapingBee status: ${scrapingResponse.status}`);

        if (scrapingResponse.ok) {
          const html = await scrapingResponse.text();
          stats = extractStatsModernTikTok(html);
          if (stats && stats.description && stats.description.length > description.length) {
            description = stats.description;
          }
        } else {
          const errorText = await scrapingResponse.text();
          console.log(`❌ ScrapingBee Erreur: ${errorText.substring(0, 300)}`);
        }
      } catch (error) {
        console.log(`❌ ScrapingBee échec: ${error.message}`);
      }
    } else {
      console.log("⚠️ SCRAPINGBEE_API_KEY non configurée. Scraping impossible.");
    }

    // ÉTAPE 3: Analyse OpenAI
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (OPENAI_API_KEY) {
      aiAnalysis = await analyzeWithOpenAI(description, stats?.hashtags, stats?.author, OPENAI_API_KEY);
    } else {
      console.log("⚠️ OPENAI_API_KEY non configurée. Pas d'analyse IA.");
    }

    // CALCULS ET FORMATAGE FINAL
    const metrics = calculateMetrics(stats);
    const scoreResult = calculateScore(stats, metrics, aiAnalysis);
    const recommendations = generateRecommendations(stats, metrics, aiAnalysis);
    const processingTime = Date.now() - startTime;
    
    const logId = logAnalysis({ 
      url: tiktokUrl, 
      author: stats?.author, 
      stats, 
      score: scoreResult.score,
      user_ip: userInfo.ip,
      processing_time: processingTime
    });
    
    const finalResponse = {
      success: true,
      analysisId: logId,
      timestamp: new Date().toISOString(),
      video: {
        url: tiktokUrl,
        description,
        thumbnail,
        author: stats?.author || null,
        hashtags: stats?.hashtags || [],
        music: stats?.music || null,
        duration: stats?.duration || null,
        createTime: stats?.createTime || null
      },
      stats: stats ? {
        ...stats,
        formatted: {
          views: formatNumber(stats.views),
          likes: formatNumber(stats.likes),
          comments: formatNumber(stats.comments),
          shares: formatNumber(stats.shares)
        }
      } : null,
      metrics,
      analysis: {
        score: scoreResult.score,
        scoreDetails: scoreResult.details,
        potentiel_viral: scoreResult.potentiel,
        ...recommendations,
        openai: aiAnalysis
      },
      metadata: {
        frameworkVersion: "4.1-nodejs-production",
        processingTime: `${processingTime}ms`,
        userInfo: {
          country: userInfo.country,
          timestamp: userInfo.timestamp
        },
        features: {
          hasOembedData,
          hasScrapingData: !!stats,
          hasOpenAIAnalysis: !!aiAnalysis,
          scrapingbee_configured: !!SCRAPINGBEE_API_KEY,
          openai_configured: !!OPENAI_API_KEY
        }
      }
    };
    
    console.log(`✅ TERMINÉ - Score: ${scoreResult.score}/100 [${processingTime}ms]`);
    return res.status(200).json(finalResponse);

  } catch (error) {
    console.error("❌ ERREUR GLOBALE DANS LE HANDLER:", error);
    const processingTime = Date.now() - startTime;
    
    return res.status(500).json({
      error: "Erreur interne du serveur",
      details: process.env.NODE_ENV === 'development' ? error.message : "Erreur de traitement",
      timestamp: new Date().toISOString(),
      processingTime: `${processingTime}ms`,
      support: "Réessayez dans quelques instants"
    });
  }
}
