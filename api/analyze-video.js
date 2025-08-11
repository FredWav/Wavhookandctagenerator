// analyze-video.js - SCRAPER ADAPTÉ STRUCTURE TIKTOK 2024/2025

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

// EXTRACTION ADAPTÉE STRUCTURE TIKTOK MODERNE
function extractStatsModernTikTok(html) {
  console.log("🔥 === EXTRACTION TIKTOK MODERNE ===");
  console.log(`📄 HTML: ${html.length} caractères`);
  
  // 1. NEXT_DATA (structure principale maintenant)
  try {
    console.log("🎯 Extraction __NEXT_DATA__...");
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    
    if (nextDataMatch && nextDataMatch[1]) {
      console.log("✅ __NEXT_DATA__ trouvé");
      const nextData = JSON.parse(nextDataMatch[1]);
      
      // Nouvelle structure TikTok 2024/2025
      const possiblePaths = [
        nextData?.props?.pageProps?.itemInfo?.itemStruct,
        nextData?.props?.pageProps?.videoDetail,
        nextData?.props?.pageProps?.itemDetail,
        nextData?.props?.pageProps?.serverCode === 10000 ? nextData?.props?.pageProps : null,
        nextData?.props?.pageProps?.data
      ].filter(Boolean);
      
      for (const data of possiblePaths) {
        if (data && data.stats) {
          const stats = {
            views: parseInt(data.stats.playCount) || 0,
            likes: parseInt(data.stats.diggCount) || 0,
            comments: parseInt(data.stats.commentCount) || 0,
            shares: parseInt(data.stats.shareCount) || 0,
            description: data.desc || data.description || null,
            author: data.author?.uniqueId || data.nickname || null,
            hashtags: (data.textExtra || data.challenges || [])
              .map(item => item.hashtagName || item.title || item.hashtag)
              .filter(Boolean),
            music: data.music?.title || data.musicInfo?.title || null,
            duration: data.video?.duration || null
          };
          
          console.log(`✅ STATS __NEXT_DATA__: ${stats.views} vues, ${stats.likes} likes`);
          return stats;
        }
      }
      
      console.log("❌ __NEXT_DATA__ sans stats valides");
    }
  } catch (error) {
    console.log(`❌ Erreur __NEXT_DATA__: ${error.message}`);
  }
  
  // 2. SIGI_STATE (fallback)
  try {
    console.log("🎯 Fallback SIGI_STATE...");
    const sigiMatch = html.split('<script id="SIGI_STATE" type="application/json">')[1];
    
    if (sigiMatch) {
      const jsonStr = sigiMatch.split('</script>')[0];
      if (jsonStr) {
        const data = JSON.parse(jsonStr);
        
        if (data.ItemModule) {
          const videoId = Object.keys(data.ItemModule)[0];
          const item = data.ItemModule[videoId];
          
          if (item && item.stats) {
            const stats = {
              views: parseInt(item.stats.playCount) || 0,
              likes: parseInt(item.stats.diggCount) || 0,
              comments: parseInt(item.stats.commentCount) || 0,
              shares: parseInt(item.stats.shareCount) || 0,
              description: item.desc || null,
              author: item.author?.uniqueId || null,
              hashtags: item.textExtra?.map(tag => tag.hashtagName).filter(Boolean) || [],
              music: item.music?.title || null
            };
            
            console.log(`✅ STATS SIGI_STATE: ${stats.views} vues, ${stats.likes} likes`);
            return stats;
          }
        }
      }
    }
  } catch (error) {
    console.log(`❌ Erreur SIGI_STATE: ${error.message}`);
  }
  
  // 3. RECHERCHE AGRESSIVE PAR PATTERNS
  console.log("🎯 Recherche agressive patterns...");
  
  // Patterns pour TikTok moderne (propriétés parfois obfusquées)
  const modernPatterns = [
    // Standards
    /"playCount"[:\s]*(\d+)/g,
    /"diggCount"[:\s]*(\d+)/g,
    /"commentCount"[:\s]*(\d+)/g,
    /"shareCount"[:\s]*(\d+)/g,
    
    // Échappés
    /playCount&quot;:(\d+)/g,
    /diggCount&quot;:(\d+)/g,
    /commentCount&quot;:(\d+)/g,
    /shareCount&quot;:(\d+)/g,
    
    // Variations modernes
    /"play_count"[:\s]*(\d+)/g,
    /"like_count"[:\s]*(\d+)/g,
    /"comment_count"[:\s]*(\d+)/g,
    /"share_count"[:\s]*(\d+)/g,
    
    // Propriétés minifiées possibles (TikTok obfusque parfois)
    /"p"[:\s]*(\d{5,})/g,  // playCount minifié
    /"d"[:\s]*(\d{4,})/g,  // diggCount minifié
    /"c"[:\s]*(\d{3,})/g,  // commentCount minifié
    /"s"[:\s]*(\d{2,})/g,  // shareCount minifié
    
    // Nouveaux formats 2024
    /"views?"[:\s]*(\d+)/g,
    /"likes?"[:\s]*(\d+)/g,
    /"comments?"[:\s]*(\d+)/g,
    /"shares?"[:\s]*(\d+)/g
  ];
  
  const foundStats = { views: [], likes: [], comments: [], shares: [] };
  
  modernPatterns.forEach((pattern, index) => {
    const matches = [...html.matchAll(pattern)];
    matches.forEach(match => {
      const number = parseInt(match[1]);
      if (number > 0) {
        const patternStr = pattern.source.toLowerCase();
        
        if (patternStr.includes('play') || patternStr.includes('view') || (patternStr.includes('"p"') && number > 1000)) {
          foundStats.views.push(number);
        } else if (patternStr.includes('digg') || patternStr.includes('like') || (patternStr.includes('"d"') && number > 10)) {
          foundStats.likes.push(number);
        } else if (patternStr.includes('comment') || (patternStr.includes('"c"') && number > 1)) {
          foundStats.comments.push(number);
        } else if (patternStr.includes('share') || (patternStr.includes('"s"') && number > 0)) {
          foundStats.shares.push(number);
        }
      }
    });
  });
  
  // Prendre les valeurs max pour chaque métrique (souvent plus précises)
  if (foundStats.views.length > 0 || foundStats.likes.length > 0) {
    const stats = {
      views: foundStats.views.length > 0 ? Math.max(...foundStats.views) : 0,
      likes: foundStats.likes.length > 0 ? Math.max(...foundStats.likes) : 0,
      comments: foundStats.comments.length > 0 ? Math.max(...foundStats.comments) : 0,
      shares: foundStats.shares.length > 0 ? Math.max(...foundStats.shares) : 0,
      description: null,
      author: null,
      hashtags: []
    };
    
    // Essayer d'extraire description et auteur
    const authorMatch = html.match(/"uniqueId"[:\s]*"([^"]+)"|"nickname"[:\s]*"([^"]+)"/);
    const descMatch = html.match(/"desc"[:\s]*"([^"]{10,200})"|"description"[:\s]*"([^"]{10,200})"/);
    
    if (authorMatch) {
      stats.author = authorMatch[1] || authorMatch[2];
    }
    
    if (descMatch) {
      stats.description = descMatch[1] || descMatch[2];
    }
    
    console.log(`✅ STATS PATTERNS: ${stats.views} vues, ${stats.likes} likes`);
    return stats;
  }
  
  console.log("❌ Aucune stat trouvée");
  return null;
}

// ANALYSE OPENAI SIMPLIFIÉE
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
  if (stats && stats.views > 500000) {
    reco.points_forts.push(`🚀 Excellente portée (${formatNumber(stats.views)} vues)`);
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
    reco.suggestions.push("📊 TikTok bloque actuellement l'extraction des stats - Structure anti-bot renforcée");
    reco.suggestions.push("🔄 Essayez avec des proxies résidentiels ou l'API officielle TikTok");
  }
  
  reco.suggestions.push("📈 Analysez régulièrement vos vidéos pour identifier les patterns qui marchent");
  
  return reco;
}

// HANDLER PRINCIPAL
export default async function handler(req, res) {
  const startTime = Date.now();
  
  console.log("🚀 === ANALYSE TIKTOK MODERNE ===");
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  try {
    if (req.method === 'OPTIONS') {
      return res.status(200).json({ ok: true });
    }
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Méthode non autorisée' });
    }
    
    const { url: tiktokUrl } = req.body || {};
    
    if (!tiktokUrl) {
      return res.status(400).json({ error: 'URL manquante' });
    }
    
    if (!isValidTikTokUrl(tiktokUrl)) {
      return res.status(400).json({ error: 'URL TikTok invalide' });
    }
    
    console.log(`🎯 URL: ${tiktokUrl}`);

    let description = "Description non disponible";
    let thumbnail = null;
    let stats = null;
    let aiAnalysis = null;
    let hasOembedData = false;
    let hasScrapingData = false;
    let hasOpenAI = false;

    // ÉTAPE 1: oEmbed
    try {
      console.log("📡 oEmbed...");
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`;
      
      const oembedResponse = await fetchWithTimeout(oembedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }, 8000);

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

    // ÉTAPE 2: ScrapingBee avec configuration moderne
    const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
    if (SCRAPINGBEE_API_KEY) {
      try {
        console.log("🕷️ ScrapingBee moderne...");
        
        const scrapingUrl = new URL('https://app.scrapingbee.com/api/v1/');
        scrapingUrl.searchParams.set('api_key', SCRAPINGBEE_API_KEY);
        scrapingUrl.searchParams.set('url', tiktokUrl);
        scrapingUrl.searchParams.set('render_js', 'true');
        scrapingUrl.searchParams.set('wait', '6000');  // Plus de temps pour Next.js
        scrapingUrl.searchParams.set('premium_proxy', 'true');
        scrapingUrl.searchParams.set('stealth_proxy', 'true');  // Anti-détection
        scrapingUrl.searchParams.set('country_code', 'US');
        scrapingUrl.searchParams.set('block_ads', 'true');

        const response = await fetchWithTimeout(scrapingUrl.toString(), {}, 25000);

        console.log(`📊 ScrapingBee: ${response.status}`);

        if (response.ok) {
          const html = await response.text();
          console.log(`📄 HTML: ${html.length} chars`);
          
          // EXTRACTION MODERNE
          stats = extractStatsModernTikTok(html);
          hasScrapingData = !!stats;
          
          if (stats && stats.description && stats.description.length > description.length) {
            description = stats.description;
          }
        } else {
          const errorText = await response.text();
          console.log(`❌ ScrapingBee Error: ${errorText.substring(0, 300)}`);
        }
      } catch (error) {
        console.log(`❌ ScrapingBee échec: ${error.message}`);
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
        frameworkVersion: "4.0-modern-tiktok",
        extractionMethod: stats ? "Modern patterns" : "No extraction"
      },
      video: {
        url: tiktokUrl,
        description,
        thumbnail,
        author: stats?.author || null,
        hashtags: stats?.hashtags || [],
        music: stats?.music || null,
        duration: stats?.duration || null
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
        frameworkVersion: "4.0-modern-tiktok",
        features: {
          oembed: hasOembedData,
          stats_extraction: hasScrapingData,
          openai_analysis: hasOpenAI,
          modern_extraction: true,
          anti_bot_bypass: true,
          logging: true
        }
      }
    };

    console.log(`✅ TERMINÉ - Score: ${scoreResult.score}/100`);
    console.log(`📊 Stats: ${stats ? 'EXTRAITES' : 'ÉCHEC'}`);
    
    return res.status(200).json(response);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ ERREUR:", error.message);
    
    return res.status(500).json({
      error: "Erreur interne du serveur",
      debug: {
        duration: `${duration}ms`,
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
}
