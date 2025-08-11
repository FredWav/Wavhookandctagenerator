// analyze-video.js - Version COMPLÈTE avec OpenAI + ScrapingBee fixé

let analysisLogs = [];

function logAnalysis(data) {
  const logEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    timestamp: new Date().toISOString(),
    url: data.url,
    author: data.author || 'Inconnu',
    stats: data.stats || null,
    metrics: data.metrics || null,
    score: data.score || null,
    potentiel_viral: data.potentiel_viral || null,
    niche_detectee: data.niche_detectee || null,
    user_ip: data.user_ip || null
  };
  
  analysisLogs.push(logEntry);
  if (analysisLogs.length > 1000) {
    analysisLogs = analysisLogs.slice(-1000);
  }
  
  console.log(`📝 Analyse enregistrée: ${logEntry.id} - ${data.author} - ${data.stats?.views || 0} vues`);
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

// EXTRACTION TIKTOK AMÉLIORÉE - Multiple stratégies
function findJsonBlob(html) {
  try {
    console.log("🔍 Recherche des données TikTok dans le HTML...");
    
    // Stratégie 1: SIGI_STATE (principal)
    let scriptContent = html.split('<script id="SIGI_STATE" type="application/json">')[1]?.split('</script>')[0];
    if (scriptContent) {
      console.log("✅ Données trouvées via SIGI_STATE");
      return JSON.parse(scriptContent);
    }
    
    // Stratégie 2: __UNIVERSAL_DATA_FOR_REHYDRATION__
    scriptContent = html.split('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">')[1]?.split('</script>')[0];
    if (scriptContent) {
      console.log("✅ Données trouvées via __UNIVERSAL_DATA_FOR_REHYDRATION__");
      return JSON.parse(scriptContent);
    }
    
    // Stratégie 3: __INITIAL_STATE__
    const initialStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/s);
    if (initialStateMatch) {
      console.log("✅ Données trouvées via __INITIAL_STATE__");
      return JSON.parse(initialStateMatch[1]);
    }
    
    // Stratégie 4: Nouvelle structure TikTok 2024/2025
    const reactPropsMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (reactPropsMatch) {
      console.log("✅ Données trouvées via __NEXT_DATA__");
      const nextData = JSON.parse(reactPropsMatch[1]);
      return nextData?.props?.pageProps || nextData;
    }
    
    console.log("❌ Aucune structure de données TikTok reconnue");
    return null;
  } catch (error) {
    console.error("❌ Erreur parsing JSON TikTok:", error.message);
    return null;
  }
}

// EXTRACTION STATS AMÉLIORÉE - Multiple chemins
function extractStats(data) {
  try {
    console.log("📊 Extraction des statistiques...");
    
    let extractedData = {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      duration: null,
      description: null,
      author: null,
      music: null,
      hashtags: [],
      createTime: null
    };

    // Path 1: ItemModule (structure classique)
    if (data.ItemModule) {
      console.log("🔍 Tentative extraction via ItemModule");
      const videoId = Object.keys(data.ItemModule)[0];
      const itemStruct = data.ItemModule[videoId];
      
      if (itemStruct?.stats) {
        extractedData = {
          views: parseInt(itemStruct.stats.playCount) || 0,
          likes: parseInt(itemStruct.stats.diggCount) || 0,
          comments: parseInt(itemStruct.stats.commentCount) || 0,
          shares: parseInt(itemStruct.stats.shareCount) || 0,
          duration: itemStruct.video?.duration || null,
          description: itemStruct.desc || null,
          author: itemStruct.author?.uniqueId || null,
          music: itemStruct.music?.title || null,
          hashtags: itemStruct.textExtra?.map(tag => tag.hashtagName).filter(Boolean) || [],
          createTime: itemStruct.createTime ? new Date(itemStruct.createTime * 1000) : null
        };
        console.log("✅ Stats extraites via ItemModule");
      }
    }
    
    // Path 2: __DEFAULT_SCOPE__ (structure alternative)
    else if (data['__DEFAULT_SCOPE__']?.['webapp.video-detail']?.itemInfo?.itemStruct) {
      console.log("🔍 Tentative extraction via __DEFAULT_SCOPE__");
      const itemStruct = data['__DEFAULT_SCOPE__']['webapp.video-detail'].itemInfo.itemStruct;
      
      if (itemStruct.stats) {
        extractedData = {
          views: parseInt(itemStruct.stats.playCount) || 0,
          likes: parseInt(itemStruct.stats.diggCount) || 0,
          comments: parseInt(itemStruct.stats.commentCount) || 0,
          shares: parseInt(itemStruct.stats.shareCount) || 0,
          duration: itemStruct.video?.duration || null,
          description: itemStruct.desc || null,
          author: itemStruct.author?.uniqueId || null,
          music: itemStruct.music?.title || null,
          hashtags: itemStruct.textExtra?.map(tag => tag.hashtagName).filter(Boolean) || [],
          createTime: itemStruct.createTime ? new Date(itemStruct.createTime * 1000) : null
        };
        console.log("✅ Stats extraites via __DEFAULT_SCOPE__");
      }
    }
    
    // Path 3: Nouvelle structure Next.js (TikTok 2024+)
    else if (data.props?.pageProps?.videoDetail) {
      console.log("🔍 Tentative extraction via Next.js pageProps");
      const videoDetail = data.props.pageProps.videoDetail;
      
      if (videoDetail.stats) {
        extractedData = {
          views: parseInt(videoDetail.stats.playCount) || 0,
          likes: parseInt(videoDetail.stats.diggCount) || 0,
          comments: parseInt(videoDetail.stats.commentCount) || 0,
          shares: parseInt(videoDetail.stats.shareCount) || 0,
          duration: videoDetail.video?.duration || null,
          description: videoDetail.desc || null,
          author: videoDetail.author?.uniqueId || null,
          music: videoDetail.music?.title || null,
          hashtags: videoDetail.challenges?.map(c => c.title).filter(Boolean) || [],
          createTime: videoDetail.createTime ? new Date(videoDetail.createTime * 1000) : null
        };
        console.log("✅ Stats extraites via Next.js");
      }
    }
    
    // Path 4: Search dans toute la structure (fallback)
    else {
      console.log("🔍 Recherche exhaustive dans la structure JSON...");
      const jsonStr = JSON.stringify(data);
      
      // Recherche des patterns de stats
      const viewsMatch = jsonStr.match(/"playCount"[:\s]*(\d+)/);
      const likesMatch = jsonStr.match(/"diggCount"[:\s]*(\d+)/);
      const commentsMatch = jsonStr.match(/"commentCount"[:\s]*(\d+)/);
      const sharesMatch = jsonStr.match(/"shareCount"[:\s]*(\d+)/);
      
      if (viewsMatch || likesMatch) {
        extractedData = {
          views: viewsMatch ? parseInt(viewsMatch[1]) : 0,
          likes: likesMatch ? parseInt(likesMatch[1]) : 0,
          comments: commentsMatch ? parseInt(commentsMatch[1]) : 0,
          shares: sharesMatch ? parseInt(sharesMatch[1]) : 0,
          duration: null,
          description: null,
          author: null,
          music: null,
          hashtags: [],
          createTime: null
        };
        console.log("✅ Stats extraites via recherche pattern");
      }
    }
    
    // Validation finale
    if (extractedData.views > 0 || extractedData.likes > 0) {
      console.log(`📊 Stats finales: ${extractedData.views} vues, ${extractedData.likes} likes`);
      return extractedData;
    }
    
    console.log("❌ Aucune statistique valide trouvée");
    return null;
    
  } catch (error) {
    console.error("❌ Erreur extraction stats:", error.message);
    return null;
  }
}

// ANALYSE OPENAI GPT-4 pour description + hashtags + contenu
async function analyzeContentWithOpenAI(description, hashtags, author, openaiKey) {
  if (!openaiKey) {
    console.warn("⚠️ OpenAI API key manquante - Analyse sémantique désactivée");
    return null;
  }

  try {
    console.log("🤖 Analyse sémantique OpenAI en cours...");
    
    const systemPrompt = `Tu es un expert en analyse de contenu TikTok et en stratégie de contenu viral. Analyse ce contenu TikTok et fournis une analyse JSON structurée.

ANALYSE REQUISE:
1. NICHE_DETECTEE: Quelle niche/catégorie principale? (fitness, beauté, éducation, humour, lifestyle, business, tech, cuisine, etc.)
2. TYPE_CONTENU: Quel format? (tutorial, storytime, dance, comedy, educational, review, unboxing, transformation, etc.) 
3. HOOK_ANALYSE: Analyse du hook/accroche (présent?, type?, efficacité?)
4. CTA_ANALYSE: Appel à l'action détecté? (abonnement, like, commentaire, partage, lien, etc.)
5. OPTIMISATION_HASHTAGS: Les hashtags sont-ils pertinents? Manque-t-il des hashtags importants?
6. POTENTIEL_VIRAL: Éléments qui peuvent rendre ce contenu viral
7. AUDIENCE_CIBLE: À qui s'adresse ce contenu? (tranche d'âge, centres d'intérêt)
8. AMELIORATIONS: 3-5 suggestions concrètes pour améliorer le contenu
9. SCORE_CONTENU: Note globale du contenu sur 100 (qualité, originalité, potentiel d'engagement)

Sois précis, actionnable et professionnel.`;

    const userPrompt = `Analyse ce contenu TikTok:

👤 AUTEUR: @${author || 'Inconnu'}
📝 DESCRIPTION: "${description || 'Pas de description'}"
🏷️ HASHTAGS: ${hashtags && hashtags.length > 0 ? hashtags.map(h => `#${h}`).join(' ') : 'Aucun hashtag'}

Fournis une analyse complète en JSON selon les critères demandés.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.3
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (content) {
        const analysis = JSON.parse(content);
        console.log("✅ Analyse OpenAI complétée");
        return analysis;
      }
    } else {
      console.warn(`⚠️ Erreur OpenAI: ${response.status}`);
    }
    
    return null;
  } catch (error) {
    console.error("❌ Erreur analyse OpenAI:", error.message);
    return null;
  }
}

function calculateAdvancedMetrics(stats) {
  if (!stats || stats.views === 0) {
    return {
      engagementRate: 0,
      likesRatio: 0,
      commentsRatio: 0,
      sharesRatio: 0,
      totalEngagements: 0,
      viralityIndex: 0
    };
  }

  const totalEngagements = stats.likes + stats.comments + stats.shares;
  
  return {
    engagementRate: (totalEngagements / stats.views) * 100,
    likesRatio: (stats.likes / stats.views) * 100,
    commentsRatio: (stats.comments / stats.views) * 100,
    sharesRatio: (stats.shares / stats.views) * 100,
    totalEngagements,
    viralityIndex: Math.min(100, ((stats.shares * 10) + (stats.comments * 4) + (stats.likes * 2)) / stats.views * 100)
  };
}

function calculatePredictiveScore(stats, metrics, openaiAnalysis) {
  let score = 50;
  
  // Performance quantitative (40 points)
  if (stats && metrics) {
    if (metrics.engagementRate > 15) score += 15;
    else if (metrics.engagementRate > 10) score += 12;
    else if (metrics.engagementRate > 5) score += 8;
    else if (metrics.engagementRate > 2) score += 4;
    
    if (metrics.likesRatio > 10) score += 10;
    else if (metrics.likesRatio > 5) score += 6;
    
    if (stats.views > 1000000) score += 15;
    else if (stats.views > 100000) score += 10;
    else if (stats.views > 10000) score += 5;
  }
  
  // Analyse OpenAI (40 points)
  if (openaiAnalysis) {
    const contentScore = openaiAnalysis.SCORE_CONTENU || 50;
    score += Math.round((contentScore - 50) * 0.4); // Convertit score 0-100 en points -20/+20
    
    if (openaiAnalysis.HOOK_ANALYSE?.includes('efficace') || openaiAnalysis.HOOK_ANALYSE?.includes('présent')) {
      score += 8;
    }
    
    if (openaiAnalysis.CTA_ANALYSE && !openaiAnalysis.CTA_ANALYSE.includes('aucun')) {
      score += 6;
    }
    
    if (openaiAnalysis.OPTIMISATION_HASHTAGS?.includes('pertinents') || openaiAnalysis.OPTIMISATION_HASHTAGS?.includes('optimaux')) {
      score += 6;
    }
  }
  
  let potentielViral = "faible";
  if (score >= 85) potentielViral = "élevé";
  else if (score >= 70) potentielViral = "moyen";
  
  return { score: Math.min(100, Math.max(0, score)), potentielViral };
}

function generateEnhancedRecommendations(stats, metrics, openaiAnalysis) {
  const recommendations = {
    points_forts: [],
    points_faibles: [],
    suggestions: []
  };
  
  // Points forts basés sur les stats
  if (stats && metrics) {
    if (metrics.engagementRate > 10) {
      recommendations.points_forts.push(`🔥 Excellent taux d'engagement (${metrics.engagementRate.toFixed(1)}%) - Audience très réactive`);
    }
    if (metrics.likesRatio > 8) {
      recommendations.points_forts.push("❤️ Ratio likes/vues élevé - Contenu très apprécié");
    }
    if (stats.views > 500000) {
      recommendations.points_forts.push(`🚀 Excellente portée avec ${formatNumber(stats.views)} vues`);
    }
    if (metrics.sharesRatio > 1) {
      recommendations.points_forts.push("📤 Bon taux de partage - Contenu viral");
    }
  }
  
  // Points forts basés sur l'analyse OpenAI
  if (openaiAnalysis) {
    if (openaiAnalysis.NICHE_DETECTEE && openaiAnalysis.NICHE_DETECTEE !== 'Non déterminée') {
      recommendations.points_forts.push(`🎯 Niche claire identifiée: ${openaiAnalysis.NICHE_DETECTEE}`);
    }
    if (openaiAnalysis.HOOK_ANALYSE?.includes('efficace')) {
      recommendations.points_forts.push("🎣 Hook efficace détecté - Bonne accroche");
    }
    if (openaiAnalysis.SCORE_CONTENU > 75) {
      recommendations.points_forts.push(`⭐ Contenu de qualité élevée (${openaiAnalysis.SCORE_CONTENU}/100)`);
    }
  }
  
  // Points faibles
  if (stats && metrics) {
    if (metrics.engagementRate < 3) {
      recommendations.points_faibles.push("📉 Taux d'engagement faible - Contenu peu engageant");
    }
    if (metrics.sharesRatio < 0.5) {
      recommendations.points_faibles.push("🔄 Faible taux de partage - Potentiel viral limité");
    }
  }
  
  if (openaiAnalysis) {
    if (openaiAnalysis.CTA_ANALYSE?.includes('aucun') || openaiAnalysis.CTA_ANALYSE?.includes('absent')) {
      recommendations.points_faibles.push("📢 Absence d'appel à l'action clair");
    }
    if (openaiAnalysis.OPTIMISATION_HASHTAGS?.includes('manque') || openaiAnalysis.OPTIMISATION_HASHTAGS?.includes('peu pertinents')) {
      recommendations.points_faibles.push("🏷️ Stratégie hashtags à améliorer");
    }
    if (openaiAnalysis.SCORE_CONTENU < 50) {
      recommendations.points_faibles.push(`⚠️ Qualité de contenu à améliorer (${openaiAnalysis.SCORE_CONTENU}/100)`);
    }
  }
  
  // Suggestions OpenAI (prioritaires)
  if (openaiAnalysis?.AMELIORATIONS) {
    if (Array.isArray(openaiAnalysis.AMELIORATIONS)) {
      recommendations.suggestions.push(...openaiAnalysis.AMELIORATIONS.map(a => `💡 ${a}`));
    } else if (typeof openaiAnalysis.AMELIORATIONS === 'string') {
      recommendations.suggestions.push(`💡 ${openaiAnalysis.AMELIORATIONS}`);
    }
  }
  
  // Suggestions basées sur les métriques
  if (stats && metrics && metrics.engagementRate < 5) {
    recommendations.suggestions.push("🎯 Créer un hook plus percutant dans les 3 premières secondes");
    recommendations.suggestions.push("❓ Poser des questions pour inciter aux commentaires");
  }
  
  // Suggestions par défaut
  if (!stats) {
    recommendations.suggestions.push("📊 Configurez ScrapingBee pour obtenir les statistiques détaillées");
  }
  
  recommendations.suggestions.push("📈 Utilisez cette analyse comme référence pour optimiser vos prochaines vidéos");
  
  return recommendations;
}

function formatNumber(num) {
  if (!num || num === 0) return '0';
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  else if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  else if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function extractUserInfo(req) {
  return {
    ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    country: req.headers['cf-ipcountry'] || 'unknown',
    timestamp: new Date().toISOString()
  };
}

export default async function handler(req, res) {
  const startTime = Date.now();
  
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
    
    const { url: tiktokUrl } = req.body;
    
    if (!tiktokUrl) {
      return res.status(400).json({ error: 'URL manquante' });
    }
    
    if (!isValidTikTokUrl(tiktokUrl)) {
      return res.status(400).json({ error: 'URL TikTok invalide' });
    }
    
    console.log(`🚀 Analyse COMPLÈTE avec OpenAI: ${tiktokUrl}`);
    
    const userInfo = extractUserInfo(req);
    console.log(`👤 Utilisateur: ${userInfo.ip} (${userInfo.country})`);

    let description = null;
    let thumbnail = null;
    let stats = null;
    let hasOembedData = false;
    let hasScrapingData = false;
    let openaiAnalysis = null;

    // ÉTAPE 1: oEmbed (5s timeout)
    try {
      console.log("📡 oEmbed...");
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const oembedResponse = await fetch(oembedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (oembedResponse.ok) {
        const oembedData = await oembedResponse.json();
        description = oembedData.title || "Description non disponible";
        thumbnail = oembedData.thumbnail_url;
        hasOembedData = true;
        console.log("✅ oEmbed réussi");
      } else {
        throw new Error(`Status ${oembedResponse.status}`);
      }
    } catch (error) {
      console.error("❌ Erreur oEmbed:", error.message);
      description = "Description non disponible";
    }

    // ÉTAPE 2: ScrapingBee (15s timeout)
    const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
    if (SCRAPINGBEE_API_KEY) {
      try {
        console.log("🕷️ ScrapingBee avec extraction améliorée...");
        const scrapingBeeUrl = new URL('https://app.scrapingbee.com/api/v1/');
        scrapingBeeUrl.searchParams.set('api_key', SCRAPINGBEE_API_KEY);
        scrapingBeeUrl.searchParams.set('url', tiktokUrl);
        scrapingBeeUrl.searchParams.set('render_js', 'true');
        scrapingBeeUrl.searchParams.set('wait', '4000');
        scrapingBeeUrl.searchParams.set('premium_proxy', 'true'); // Proxy premium pour contourner les blocages

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(scrapingBeeUrl.toString(), {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        console.log(`📊 ScrapingBee Response: ${response.status}`);

        if (response.ok) {
          const html = await response.text();
          console.log(`📄 HTML reçu: ${html.length} caractères`);
          
          // Debug: chercher des patterns de données
          const hasJsonData = html.includes('SIGI_STATE') || html.includes('__NEXT_DATA__') || html.includes('__INITIAL_STATE__');
          console.log(`🔍 Données JSON détectées: ${hasJsonData}`);
          
          if (hasJsonData) {
            const data = findJsonBlob(html);
            if (data) {
              stats = extractStats(data);
              hasScrapingData = !!stats;
              
              if (stats) {
                console.log(`✅ Stats extraites: ${stats.views} vues, ${stats.likes} likes, ${stats.comments} commentaires`);
                // Mise à jour description si meilleure
                if (stats.description && stats.description.length > description.length) {
                  description = stats.description;
                }
              } else {
                console.log("❌ Structure JSON trouvée mais stats non extraites");
              }
            } else {
              console.log("❌ JSON trouvé mais parsing échoué");
            }
          } else {
            console.log("❌ Aucune structure JSON TikTok détectée dans le HTML");
          }
        } else {
          const errorText = await response.text();
          console.log(`⚠️ ScrapingBee Error ${response.status}: ${errorText.substring(0, 200)}`);
        }
      } catch (error) {
        console.warn("⚠️ Échec ScrapingBee:", error.message);
      }
    } else {
      console.log("⚠️ ScrapingBee non configuré (SCRAPINGBEE_API_KEY manquante)");
    }

    // ÉTAPE 3: Analyse OpenAI (NOUVEAU!)
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (OPENAI_API_KEY && description && description !== "Description non disponible") {
      openaiAnalysis = await analyzeContentWithOpenAI(
        description, 
        stats?.hashtags || [], 
        stats?.author, 
        OPENAI_API_KEY
      );
    } else {
      console.log("⚠️ Analyse OpenAI non possible - Clé manquante ou pas de description");
    }

    // CALCULS FINAUX
    const metrics = stats ? calculateAdvancedMetrics(stats) : {
      engagementRate: 0,
      likesRatio: 0,
      commentsRatio: 0,
      sharesRatio: 0,
      totalEngagements: 0,
      viralityIndex: 0
    };
    
    const predictiveScore = calculatePredictiveScore(stats, metrics, openaiAnalysis);
    const recommendations = generateEnhancedRecommendations(stats, metrics, openaiAnalysis);

    // Logging
    const logId = logAnalysis({
      url: tiktokUrl,
      author: stats?.author,
      stats: stats,
      metrics: metrics,
      score: predictiveScore.score,
      potentiel_viral: predictiveScore.potentielViral,
      niche_detectee: openaiAnalysis?.NICHE_DETECTEE || 'Non déterminée',
      user_ip: userInfo.ip,
      user_agent: userInfo.userAgent
    });

    // RÉPONSE FINALE
    const finalResponse = {
      success: true,
      analysisId: logId,
      timestamp: new Date().toISOString(),
      debug: {
        duration: `${Date.now() - startTime}ms`,
        hasOembedData,
        hasScrapingData,
        hasStats: !!stats,
        hasOpenAIAnalysis: !!openaiAnalysis,
        frameworkVersion: "3.0-complete-ai"
      },
      video: {
        url: tiktokUrl,
        description,
        thumbnail,
        author: stats?.author || null,
        music: stats?.music || null,
        hashtags: stats?.hashtags || [],
        createTime: stats?.createTime || null,
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
        score: predictiveScore.score,
        potentiel_viral: predictiveScore.potentielViral,
        points_forts: recommendations.points_forts,
        points_faibles: recommendations.points_faibles,
        suggestions: recommendations.suggestions,
        openai: openaiAnalysis
      },
      metadata: {
        analysisTimestamp: new Date().toISOString(),
        frameworkVersion: "3.0-complete-ai",
        apiEndpoint: "/api/analyze-video",
        userInfo: {
          country: userInfo.country,
          timestamp: userInfo.timestamp
        },
        features: {
          oembed: hasOembedData,
          stats_extraction: hasScrapingData,
          openai_analysis: !!openaiAnalysis,
          predictive_scoring: true,
          enhanced_recommendations: true,
          logging: true
        }
      }
    };

    console.log(`✅ Analyse COMPLÈTE terminée - ID: ${logId}`);
    console.log(`🎯 Score: ${predictiveScore.score}/100 (${predictiveScore.potentielViral})`);
    console.log(`🤖 OpenAI: ${openaiAnalysis ? 'Activé' : 'Désactivé'}`);
    console.log(`📊 Stats: ${stats ? 'Extraites' : 'Non disponibles'}`);
    
    return res.status(200).json(finalResponse);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ Erreur critique:", error.message);
    
    return res.status(500).json({
      error: "Erreur interne du serveur",
      debug: {
        duration: `${duration}ms`,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      timestamp: new Date().toISOString()
    });
  }
}
