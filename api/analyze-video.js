// analyze-video.js - Version DEBUG avec logs détaillés
export const config = { runtime: "edge" };

// Fonction de logging avec timestamp
function debugLog(step, message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🔍 ${step}: ${message}`);
  if (data) {
    console.log(`[${timestamp}] 📊 Data:`, JSON.stringify(data, null, 2));
  }
}

// Fonction de réponse JSON simplifiée
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

// Validation URL TikTok simplifiée
function isValidTikTokUrl(url) {
  const patterns = [
    /tiktok\.com\/@[\w.-]+\/video\/\d+/,
    /vm\.tiktok\.com\/[\w]+/,
    /tiktok\.com\/t\/[\w]+/
  ];
  return patterns.some(pattern => pattern.test(url));
}

// Fonction pour parser les données JSON TikTok (simplifiée)
function extractBasicStats(html) {
  try {
    debugLog("PARSING", "Tentative d'extraction des stats depuis le HTML");
    
    // Chercher les données SIGI_STATE
    let scriptContent = html.split('<script id="SIGI_STATE" type="application/json">')[1]?.split('</script>')[0];
    if (scriptContent) {
      debugLog("PARSING", "Données SIGI_STATE trouvées");
      const data = JSON.parse(scriptContent);
      
      // Extraction simple des stats
      if (data.ItemModule) {
        const videoId = Object.keys(data.ItemModule)[0];
        const item = data.ItemModule[videoId];
        
        if (item?.stats) {
          const stats = {
            views: parseInt(item.stats.playCount) || 0,
            likes: parseInt(item.stats.diggCount) || 0,
            comments: parseInt(item.stats.commentCount) || 0,
            shares: parseInt(item.stats.shareCount) || 0,
            author: item.author?.uniqueId || null,
            description: item.desc || null
          };
          
          debugLog("PARSING", "Stats extraites avec succès", stats);
          return stats;
        }
      }
    }
    
    debugLog("PARSING", "Aucune donnée valide trouvée dans le HTML");
    return null;
  } catch (error) {
    debugLog("PARSING", `Erreur lors du parsing: ${error.message}`);
    return null;
  }
}

// Fonction pour calculer les métriques de base
function calculateMetrics(stats) {
  if (!stats || stats.views === 0) {
    return {
      engagementRate: 0,
      totalEngagements: 0,
      viralityScore: 0
    };
  }
  
  const totalEngagements = stats.likes + stats.comments + stats.shares;
  const engagementRate = (totalEngagements / stats.views) * 100;
  const viralityScore = Math.min(100, ((stats.shares * 10) + (stats.comments * 4) + (stats.likes * 2)) / stats.views * 100);
  
  return {
    engagementRate: Math.round(engagementRate * 100) / 100,
    totalEngagements,
    viralityScore: Math.round(viralityScore)
  };
}

// Handler principal avec debug complet
export default async function handler(req) {
  const startTime = Date.now();
  debugLog("START", "=== DÉBUT ANALYSE TIKTOK ===");
  
  try {
    // Gestion OPTIONS pour CORS
    if (req.method === 'OPTIONS') {
      debugLog("CORS", "Requête OPTIONS reçue");
      return jsonResponse({ ok: true });
    }
    
    // Validation méthode
    if (req.method !== 'POST') {
      debugLog("ERROR", `Méthode non autorisée: ${req.method}`);
      return jsonResponse({ error: 'Méthode non autorisée' }, 405);
    }
    
    // Parsing du body
    debugLog("BODY", "Parsing du body de la requête");
    let body;
    try {
      body = await req.json();
      debugLog("BODY", "Body parsé avec succès", body);
    } catch (error) {
      debugLog("ERROR", `Erreur parsing body: ${error.message}`);
      return jsonResponse({ error: 'Body JSON invalide' }, 400);
    }
    
    // Validation URL
    const { url: tiktokUrl } = body;
    if (!tiktokUrl) {
      debugLog("ERROR", "URL manquante");
      return jsonResponse({ error: 'URL manquante' }, 400);
    }
    
    if (!isValidTikTokUrl(tiktokUrl)) {
      debugLog("ERROR", `URL TikTok invalide: ${tiktokUrl}`);
      return jsonResponse({ error: 'URL TikTok invalide' }, 400);
    }
    
    debugLog("VALIDATION", `URL validée: ${tiktokUrl}`);
    
    // Variables pour stocker les résultats
    let description = null;
    let thumbnail = null;
    let stats = null;
    let hasOembedData = false;
    let hasScrapingData = false;
    
    // ÉTAPE 1: oEmbed (avec timeout)
    debugLog("OEMBED", "Démarrage oEmbed");
    try {
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`;
      debugLog("OEMBED", `URL oEmbed: ${oembedUrl}`);
      
      const oembedResponse = await fetch(oembedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(10000) // 10s timeout
      });
      
      debugLog("OEMBED", `Statut réponse: ${oembedResponse.status}`);
      
      if (oembedResponse.ok) {
        const oembedData = await oembedResponse.json();
        description = oembedData.title || "Description non disponible";
        thumbnail = oembedData.thumbnail_url;
        hasOembedData = true;
        
        debugLog("OEMBED", "oEmbed réussi", {
          hasTitle: !!oembedData.title,
          hasThumbnail: !!oembedData.thumbnail_url
        });
      } else {
        throw new Error(`Status ${oembedResponse.status}`);
      }
    } catch (error) {
      debugLog("OEMBED", `Échec oEmbed: ${error.message}`);
      // On continue sans oEmbed
      description = "Description non disponible";
    }
    
    // ÉTAPE 2: ScrapingBee (optionnel)
    const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
    if (SCRAPINGBEE_API_KEY) {
      debugLog("SCRAPING", "Démarrage ScrapingBee");
      try {
        const scrapingUrl = new URL('https://app.scrapingbee.com/api/v1/');
        scrapingUrl.searchParams.set('api_key', SCRAPINGBEE_API_KEY);
        scrapingUrl.searchParams.set('url', tiktokUrl);
        scrapingUrl.searchParams.set('render_js', 'true');
        scrapingUrl.searchParams.set('wait', '3000');
        
        debugLog("SCRAPING", `URL ScrapingBee: ${scrapingUrl.toString()}`);
        
        const scrapingResponse = await fetch(scrapingUrl.toString(), {
          signal: AbortSignal.timeout(20000) // 20s timeout
        });
        
        debugLog("SCRAPING", `Statut ScrapingBee: ${scrapingResponse.status}`);
        
        if (scrapingResponse.ok) {
          const html = await scrapingResponse.text();
          debugLog("SCRAPING", `HTML reçu: ${html.length} caractères`);
          
          stats = extractBasicStats(html);
          hasScrapingData = !!stats;
          
          if (stats) {
            debugLog("SCRAPING", "Stats extraites avec succès", stats);
          } else {
            debugLog("SCRAPING", "Aucune stat extraite du HTML");
          }
        } else {
          throw new Error(`Status ${scrapingResponse.status}`);
        }
      } catch (error) {
        debugLog("SCRAPING", `Échec ScrapingBee: ${error.message}`);
        // On continue sans stats
      }
    } else {
      debugLog("SCRAPING", "Clé ScrapingBee non configurée - étape ignorée");
    }
    
    // CALCUL DES MÉTRIQUES
    debugLog("METRICS", "Calcul des métriques");
    const metrics = calculateMetrics(stats);
    debugLog("METRICS", "Métriques calculées", metrics);
    
    // GÉNÉRATION DU SCORE
    let score = 50;
    let potentiel = "moyen";
    
    if (stats) {
      if (metrics.engagementRate > 15) score += 20;
      else if (metrics.engagementRate > 10) score += 15;
      else if (metrics.engagementRate > 5) score += 10;
      
      if (stats.views > 1000000) score += 15;
      else if (stats.views > 100000) score += 10;
      else if (stats.views > 10000) score += 5;
      
      if (score >= 80) potentiel = "élevé";
      else if (score <= 40) potentiel = "faible";
    }
    
    debugLog("SCORE", `Score calculé: ${score}/100 - Potentiel: ${potentiel}`);
    
    // CONSTRUCTION DE LA RÉPONSE
    const analysisId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const response = {
      success: true,
      analysisId,
      debug: {
        duration: `${duration}ms`,
        hasOembedData,
        hasScrapingData,
        hasStats: !!stats,
        timestamp: new Date().toISOString()
      },
      video: {
        url: tiktokUrl,
        description,
        thumbnail,
        author: stats?.author || null
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
        score,
        potentiel_viral: potentiel,
        points_forts: [],
        points_faibles: [],
        suggestions: []
      }
    };
    
    // Ajout de recommandations de base
    if (stats) {
      if (metrics.engagementRate > 10) {
        response.analysis.points_forts.push(`Excellent taux d'engagement (${metrics.engagementRate}%)`);
      }
      if (metrics.engagementRate < 3) {
        response.analysis.points_faibles.push("Taux d'engagement faible");
        response.analysis.suggestions.push("Améliorer le hook des premières secondes");
      }
      if (stats.views > 100000) {
        response.analysis.points_forts.push(`Bonne visibilité (${response.stats.formatted.views} vues)`);
      }
    } else {
      response.analysis.points_faibles.push("Statistiques détaillées non disponibles");
      response.analysis.suggestions.push("Configurer ScrapingBee pour une analyse complète");
    }
    
    debugLog("SUCCESS", `Analyse terminée en ${duration}ms`, {
      score,
      potentiel,
      hasStats: !!stats
    });
    
    return jsonResponse(response);
    
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    debugLog("ERROR", `Erreur critique après ${duration}ms: ${error.message}`);
    console.error("Stack trace:", error.stack);
    
    return jsonResponse({
      error: "Erreur interne du serveur",
      debug: {
        duration: `${duration}ms`,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      timestamp: new Date().toISOString()
    }, 500);
  }
}

// Fonction utilitaire pour formater les nombres
function formatNumber(num) {
  if (!num || num === 0) return '0';
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  else if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  else if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}
