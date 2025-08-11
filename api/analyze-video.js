// analyze-video.js - Version CORRIGÉE qui fonctionne

let analysisLogs = [];

function logAnalysis(data) {
  const logEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    timestamp: new Date().toISOString(),
    url: data.url,
    author: data.author || 'Inconnu',
    stats: data.stats || null,
    score: data.score || null,
    user_ip: data.user_ip || null
  };
  
  analysisLogs.push(logEntry);
  if (analysisLogs.length > 1000) {
    analysisLogs = analysisLogs.slice(-1000);
  }
  
  console.log(`📝 Analyse enregistrée: ${logEntry.id}`);
  return logEntry.id;
}

function isValidTikTokUrl(url) {
  const patterns = [
    /tiktok\.com\/@[\w.-]+\/video\/\d+/,
    /vm\.tiktok\.com\/[\w]+/,
    /tiktok\.com\/t\/[\w]+/
  ];
  return patterns.some(pattern => pattern.test(url));
}

// Fonction de timeout personnalisée
function fetchWithTimeout(url, options, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout'));
    }, timeoutMs);
    
    fetch(url, options)
      .then(response => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// EXTRACTION TIKTOK SIMPLIFIÉE mais robuste
function findJsonBlob(html) {
  try {
    console.log("🔍 Recherche des données TikTok...");
    
    // Stratégie 1: SIGI_STATE
    let match = html.split('<script id="SIGI_STATE" type="application/json">')[1];
    if (match) {
      const jsonStr = match.split('</script>')[0];
      if (jsonStr) {
        console.log("✅ SIGI_STATE trouvé");
        return JSON.parse(jsonStr);
      }
    }
    
    // Stratégie 2: __NEXT_DATA__
    match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (match && match[1]) {
      console.log("✅ __NEXT_DATA__ trouvé");
      return JSON.parse(match[1]);
    }
    
    console.log("❌ Aucune structure JSON trouvée");
    return null;
  } catch (error) {
    console.error("❌ Erreur parsing JSON:", error.message);
    return null;
  }
}

// EXTRACTION STATS SIMPLIFIÉE
function extractStats(data) {
  try {
    console.log("📊 Extraction des statistiques...");
    
    let stats = {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      description: null,
      author: null,
      hashtags: []
    };

    // Path 1: ItemModule
    if (data.ItemModule) {
      const videoId = Object.keys(data.ItemModule)[0];
      const item = data.ItemModule[videoId];
      
      if (item && item.stats) {
        stats = {
          views: parseInt(item.stats.playCount) || 0,
          likes: parseInt(item.stats.diggCount) || 0,
          comments: parseInt(item.stats.commentCount) || 0,
          shares: parseInt(item.stats.shareCount) || 0,
          description: item.desc || null,
          author: item.author?.uniqueId || null,
          hashtags: item.textExtra?.map(tag => tag.hashtagName).filter(Boolean) || []
        };
        console.log(`✅ Stats extraites: ${stats.views} vues, ${stats.likes} likes`);
        return stats;
      }
    }
    
    // Path 2: Search dans JSON
    const jsonStr = JSON.stringify(data);
    const viewsMatch = jsonStr.match(/"playCount"[:\s]*(\d+)/);
    const likesMatch = jsonStr.match(/"diggCount"[:\s]*(\d+)/);
    
    if (viewsMatch) {
      stats.views = parseInt(viewsMatch[1]);
      stats.likes = likesMatch ? parseInt(likesMatch[1]) : 0;
      console.log(`✅ Stats par regex: ${stats.views} vues, ${stats.likes} likes`);
      return stats;
    }
    
    console.log("❌ Aucune stat trouvée");
    return null;
    
  } catch (error) {
    console.error("❌ Erreur extraction:", error.message);
    return null;
  }
}

// ANALYSE OPENAI SIMPLIFIÉE
async function analyzeWithOpenAI(description, hashtags, author, openaiKey) {
  if (!openaiKey || !description || description === "Description non disponible") {
    console.log("⚠️ Analyse OpenAI non possible");
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
        messages: [
          { role: "user", content: prompt }
        ],
        max_tokens: 800,
        temperature: 0.3
      })
    }, 15000);

    if (response.ok) {
      const data = await response.json();
      const analysis = JSON.parse(data.choices[0]?.message?.content || '{}');
      console.log("✅ Analyse OpenAI OK");
      return analysis;
    } else {
      console.log(`⚠️ OpenAI Error: ${response.status}`);
    }
    
    return null;
  } catch (error) {
    console.error("❌ Erreur OpenAI:", error.message);
    return null;
  }
}

function calculateMetrics(stats) {
  if (!stats || stats.views === 0) {
    return {
      engagementRate: 0,
      totalEngagements: 0,
      viralityIndex: 0
    };
  }

  const totalEngagements = stats.likes + stats.comments + stats.shares;
  
  return {
    engagementRate: (totalEngagements / stats.views) * 100,
    totalEngagements,
    viralityIndex: Math.min(100, ((stats.shares * 10) + (stats.comments * 4) + (stats.likes * 2)) / stats.views * 100)
  };
}

function calculateScore(stats, metrics, aiAnalysis) {
  let score = 50;
  
  // Stats (40 points)
  if (stats && metrics) {
    if (metrics.engagementRate > 15) score += 15;
    else if (metrics.engagementRate > 10) score += 12;
    else if (metrics.engagementRate > 5) score += 8;
    
    if (stats.views > 1000000) score += 15;
    else if (stats.views > 100000) score += 10;
    else if (stats.views > 10000) score += 5;
  }
  
  // IA (30 points)
  if (aiAnalysis) {
    if (aiAnalysis.score_contenu) {
      score += Math.round((aiAnalysis.score_contenu - 50) * 0.3);
    }
    if (aiAnalysis.hook_present) score += 8;
    if (aiAnalysis.cta_present) score += 6;
  }
  
  let potentiel = "moyen";
  if (score >= 80) potentiel = "élevé";
  else if (score <= 40) potentiel = "faible";
  
  return { score: Math.max(0, Math.min(100, score)), potentiel };
}

function formatNumber(num) {
  if (!num || num === 0) return '0';
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  else if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  else if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function generateRecommendations(stats, metrics, aiAnalysis) {
  const reco = {
    points_forts: [],
    points_faibles: [],
    suggestions: []
  };
  
  // Points forts
  if (stats && metrics.engagementRate > 10) {
    reco.points_forts.push(`🔥 Excellent engagement (${metrics.engagementRate.toFixed(1)}%)`);
  }
  if (aiAnalysis?.niche) {
    reco.points_forts.push(`🎯 Niche identifiée: ${aiAnalysis.niche}`);
  }
  if (aiAnalysis?.hook_present) {
    reco.points_forts.push("🎣 Hook efficace détecté");
  }
  
  // Points faibles
  if (stats && metrics.engagementRate < 3) {
    reco.points_faibles.push("📉 Taux d'engagement faible");
  }
  if (aiAnalysis && !aiAnalysis.hook_present) {
    reco.points_faibles.push("🎣 Absence de hook détectable");
  }
  if (aiAnalysis && !aiAnalysis.cta_present) {
    reco.points_faibles.push("📢 Pas d'appel à l'action clair");
  }
  
  // Suggestions IA
  if (aiAnalysis?.ameliorations && Array.isArray(aiAnalysis.ameliorations)) {
    reco.suggestions.push(...aiAnalysis.ameliorations.map(a => `💡 ${a}`));
  }
  
  // Suggestions par défaut
  if (!stats) {
    reco.suggestions.push("📊 Configurez ScrapingBee pour les stats détaillées");
  }
  if (!aiAnalysis) {
    reco.suggestions.push("🤖 Configurez OpenAI pour l'analyse sémantique");
  }
  
  reco.suggestions.push("📈 Utilisez cette analyse pour optimiser vos prochaines vidéos");
  
  return reco;
}

// HANDLER PRINCIPAL
export default async function handler(req, res) {
  const startTime = Date.now();
  
  console.log("🚀 API analyze-video appelée");
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  try {
    if (req.method === 'OPTIONS') {
      return res.status(200).json({ ok: true });
    }
    
    if (req.method !== 'POST') {
      console.log(`❌ Méthode incorrecte: ${req.method}`);
      return res.status(405).json({ error: 'Méthode non autorisée' });
    }
    
    const { url: tiktokUrl } = req.body || {};
    
    if (!tiktokUrl) {
      console.log("❌ URL manquante");
      return res.status(400).json({ error: 'URL manquante' });
    }
    
    if (!isValidTikTokUrl(tiktokUrl)) {
      console.log(`❌ URL invalide: ${tiktokUrl}`);
      return res.status(400).json({ error: 'URL TikTok invalide' });
    }
    
    console.log(`🎯 Analyse: ${tiktokUrl}`);

    let description = "Description non disponible";
    let thumbnail = null;
    let stats = null;
    let aiAnalysis = null;
    let hasOembedData = false;
    let hasScrapingData = false;
    let hasOpenAI = false;

    // ÉTAPE 1: oEmbed (5s timeout)
    try {
      console.log("📡 Tentative oEmbed...");
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`;
      
      const oembedResponse = await fetchWithTimeout(oembedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, 5000);

      if (oembedResponse.ok) {
        const oembedData = await oembedResponse.json();
        description = oembedData.title || description;
        thumbnail = oembedData.thumbnail_url;
        hasOembedData = true;
        console.log("✅ oEmbed réussi");
      } else {
        throw new Error(`Status ${oembedResponse.status}`);
      }
    } catch (error) {
      console.log(`⚠️ oEmbed échec: ${error.message}`);
    }

    // ÉTAPE 2: ScrapingBee (15s timeout)
    const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
    if (SCRAPINGBEE_API_KEY) {
      try {
        console.log("🕷️ Tentative ScrapingBee...");
        const scrapingUrl = new URL('https://app.scrapingbee.com/api/v1/');
        scrapingUrl.searchParams.set('api_key', SCRAPINGBEE_API_KEY);
        scrapingUrl.searchParams.set('url', tiktokUrl);
        scrapingUrl.searchParams.set('render_js', 'true');
        scrapingUrl.searchParams.set('wait', '3000');

        const response = await fetchWithTimeout(scrapingUrl.toString(), {}, 15000);

        if (response.ok) {
          const html = await response.text();
          console.log(`📄 HTML reçu: ${html.length} caractères`);
          
          const data = findJsonBlob(html);
          if (data) {
            stats = extractStats(data);
            hasScrapingData = !!stats;
            
            if (stats && stats.description && stats.description.length > description.length) {
              description = stats.description;
            }
          }
        } else {
          console.log(`⚠️ ScrapingBee Status: ${response.status}`);
        }
      } catch (error) {
        console.log(`⚠️ ScrapingBee échec: ${error.message}`);
      }
    } else {
      console.log("⚠️ SCRAPINGBEE_API_KEY non configurée");
    }

    // ÉTAPE 3: Analyse OpenAI
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (OPENAI_API_KEY) {
      aiAnalysis = await analyzeWithOpenAI(
        description, 
        stats?.hashtags || [], 
        stats?.author, 
        OPENAI_API_KEY
      );
      hasOpenAI = !!aiAnalysis;
    } else {
      console.log("⚠️ OPENAI_API_KEY non configurée");
    }

    // CALCULS FINAUX
    const metrics = calculateMetrics(stats);
    const scoreResult = calculateScore(stats, metrics, aiAnalysis);
    const recommendations = generateRecommendations(stats, metrics, aiAnalysis);

    // Log
    const logId = logAnalysis({
      url: tiktokUrl,
      author: stats?.author,
      stats: stats,
      score: scoreResult.score,
      user_ip: req.headers['x-forwarded-for'] || 'unknown'
    });

    // RÉPONSE FINALE
    const response = {
      success: true,
      analysisId: logId,
      timestamp: new Date().toISOString(),
      debug: {
        duration: `${Date.now() - startTime}ms`,
        hasOembedData,
        hasScrapingData,
        hasStats: !!stats,
        hasOpenAIAnalysis: hasOpenAI,
        frameworkVersion: "3.1-stable"
      },
      video: {
        url: tiktokUrl,
        description,
        thumbnail,
        author: stats?.author || null,
        hashtags: stats?.hashtags || []
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
      metrics: metrics,
      analysis: {
        score: scoreResult.score,
        potentiel_viral: scoreResult.potentiel,
        points_forts: recommendations.points_forts,
        points_faibles: recommendations.points_faibles,
        suggestions: recommendations.suggestions,
        openai: aiAnalysis
      },
      metadata: {
        analysisTimestamp: new Date().toISOString(),
        frameworkVersion: "3.1-stable",
        features: {
          oembed: hasOembedData,
          stats_extraction: hasScrapingData,
          openai_analysis: hasOpenAI,
          predictive_scoring: true,
          logging: true
        }
      }
    };

    console.log(`✅ Analyse terminée - Score: ${scoreResult.score}/100 (${scoreResult.potentiel})`);
    
    return res.status(200).json(response);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ ERREUR CRITIQUE:", error);
    console.error("Stack:", error.stack);
    
    return res.status(500).json({
      error: "Erreur interne du serveur",
      debug: {
        duration: `${duration}ms`,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }
    });
  }
}
