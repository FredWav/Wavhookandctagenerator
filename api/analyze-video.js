// /api/analyze-video.js
// Objectif: recevoir {url}, extraire stats via oEmbed + scraping HTML public, auditer SEO/hashtags avec OpenAI, renvoyer un JSON complet.
// Pas d'API TikTok officielle utilisée.

let analysisLogs = [];

// --------- Utils ----------
function isValidTikTokUrl(url) {
  const patterns = [
    /tiktok\.com\/@[\w.-]+\/video\/\d+/i,
    /vm\.tiktok\.com\/[\w]+/i,
    /tiktok\.com\/t\/[\w]+/i
  ];
  return patterns.some((p) => p.test(url));
}

function formatNumber(num) {
  if (!num || num === 0) return '0';
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return String(num);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

function extractUserInfo(req) {
  const fwd = req.headers['x-forwarded-for'];
  const ip = fwd ? fwd.split(',')[0].trim()
    : req.headers['x-real-ip']
    : req.socket?.remoteAddress
    || req.connection?.remoteAddress
    || 'unknown';
  return { ip, ua: req.headers['user-agent'] || 'unknown' };
}

function createStatsObjectFromItem(item) {
  if (!item || !item.stats) return null;
  const stats = {
    views: parseInt(item.stats.playCount) || 0,
    likes: parseInt(item.stats.diggCount) || 0,
    comments: parseInt(item.stats.commentCount) || 0,
    shares: parseInt(item.stats.shareCount) || 0,
    saves: parseInt(item.stats.collectCount || item.stats.favouriteCount || 0) || 0,
    description: item.desc || item.description || null,
    author: item.author?.uniqueId || item.nickname || null,
    hashtags: (item.textExtra || item.challenges || [])
      .map(tag => tag.hashtagName || tag.title || tag.hashtag)
      .filter(Boolean),
    music: item.music?.title || item.musicInfo?.title || null,
    duration: item.video?.duration || null,
    createTime: item.createTime ? new Date(item.createTime * 1000).toISOString() : null,
    videoUrl: item.video?.playAddr || item.video?.downloadAddr || null,
    coverUrl: item.video?.originCover || item.video?.dynamicCover || null
  };
  if (stats.views > 0 || stats.likes > 0) return stats;
  return null;
}

function findStatsInObject(obj, depth = 0) {
  if (depth > 10) return null;
  if (obj && typeof obj === 'object') {
    if (obj.stats && (obj.stats.playCount || obj.stats.viewCount)) {
      return createStatsObjectFromItem(obj);
    }
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'itemStruct' || k === 'videoData' || k === 'itemInfo') {
        const s = createStatsObjectFromItem(v);
        if (s) return s;
      }
      if (typeof v === 'object' && v !== null) {
        const s = findStatsInObject(v, depth + 1);
        if (s) return s;
      }
    }
  }
  return null;
}

function extractStatsFromHtml(html) {
  // 1) __NEXT_DATA__
  try {
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (m?.[1]) {
      const next = JSON.parse(m[1]);
      const paths = [
        next?.props?.pageProps?.itemInfo?.itemStruct,
        next?.props?.pageProps?.videoData,
        next?.props?.pageProps?.itemDetail,
        next?.props?.pageProps?.serverCode?.ItemModule
      ].filter(Boolean);
      for (const p of paths) {
        if (p && typeof p === 'object') {
          if (p.stats) {
            const s = createStatsObjectFromItem(p);
            if (s) return s;
          } else {
            // ItemModule est un map id->item
            for (const val of Object.values(p)) {
              const s = createStatsObjectFromItem(val);
              if (s) return s;
            }
          }
        }
      }
    }
  } catch {}

  // 2) SIGI_STATE
  try {
    const chunk = html.split('<script id="SIGI_STATE" type="application/json">')[1];
    if (chunk) {
      const jsonStr = chunk.split('</script>')[0];
      if (jsonStr) {
        const data = JSON.parse(jsonStr);
        if (data.ItemModule) {
          const first = data.ItemModule[Object.keys(data.ItemModule)[0]];
          const s = createStatsObjectFromItem(first);
          if (s) return s;
        }
        const s2 = data['__DEFAULT_SCOPE__']?.['webapp.video-detail']?.itemInfo?.itemStruct;
        if (s2) {
          const s = createStatsObjectFromItem(s2);
          if (s) return s;
        }
      }
    }
  } catch {}

  // 3) Patterns brutaux (fallback)
  try {
    const patterns = [
      /<script[^>]*>window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/,
      /<script[^>]*>window\.__UNIVERSAL_DATA_FOR_REHYDRATION__\s*=\s*({[\s\S]*?});\s*<\/script>/,
      /"itemInfo"\s*:\s*{[\s\S]*?"itemStruct"\s*:\s*{[\s\S]*?}\s*}/,
      /"videoData"\s*:\s*{[\s\S]*?"stats"\s*:\s*{[\s\S]*?}\s*}/
    ];
    for (const rx of patterns) {
      const mm = html.match(rx);
      if (mm?.[0]) {
        const txt = mm[0];
        try {
          const objStart = txt.indexOf('{');
          const objEnd = txt.lastIndexOf('}');
          const json = JSON.parse(txt.slice(objStart, objEnd + 1));
          const s = findStatsInObject(json);
          if (s) return s;
        } catch {}
      }
    }

    const getMax = (reg) => {
      const all = [...html.matchAll(reg)].map(m => parseInt(m[1]));
      return all.length ? Math.max(...all) : 0;
    };
    const views = getMax(/"playCount":(\d+)/g);
    const likes = getMax(/"diggCount":(\d+)/g);
    const comments = getMax(/"commentCount":(\d+)/g);
    const shares = getMax(/"shareCount":(\d+)/g);
    const saves  = getMax(/"collectCount":(\d+)/g);

    if (views > 0) {
      return {
        views, likes, comments, shares, saves,
        description: null, author: null, hashtags: [],
        music: null, duration: null, createTime: null, videoUrl: null, coverUrl: null
      };
    }
  } catch {}

  return null;
}

function calculateMetrics(stats) {
  if (!stats || !stats.views) {
    return { engagementRate: 0, totalEngagements: 0, viralityIndex: 0, likesRatio: 0, commentsRatio: 0, sharesRatio: 0, savesRatio: 0 };
  }
  const totalEngagements = (stats.likes || 0) + (stats.comments || 0) + (stats.shares || 0) + (stats.saves || 0);
  const engagementRate = (totalEngagements / stats.views) * 100;
  return {
    engagementRate,
    totalEngagements,
    viralityIndex: Math.min(100, ((stats.shares * 10) + (stats.comments * 4) + (stats.likes * 2) + (stats.saves * 3)) / stats.views * 100),
    likesRatio: (stats.likes / stats.views) * 100,
    commentsRatio: (stats.comments / stats.views) * 100,
    sharesRatio: (stats.shares / stats.views) * 100,
    savesRatio: (stats.saves / stats.views) * 100
  };
}

function calculateScore(stats, metrics, ai) {
  let score = 50;
  if (metrics.engagementRate > 15) score += 15;
  else if (metrics.engagementRate > 10) score += 12;
  else if (metrics.engagementRate > 5) score += 8;
  else if (metrics.engagementRate > 2) score += 4;

  if (stats?.views > 1_000_000) score += 15;
  else if (stats?.views > 100_000) score += 10;
  else if (stats?.views > 10_000) score += 5;
  else if (stats?.views > 1_000) score += 2;

  if (metrics.sharesRatio > 1) score += 8;
  else if (metrics.sharesRatio > 0.5) score += 5;

  if (ai) {
    if (typeof ai.seo_score === 'number') score += Math.round((ai.seo_score - 50) * 0.2);
    if (ai.has_hook) score += 8;
    if (ai.has_cta) score += 6;
  }
  score = Math.max(0, Math.min(100, score));
  const potentiel = score >= 85 ? 'élevé' : score >= 70 ? 'bon' : score <= 40 ? 'faible' : 'moyen';
  return { score, potentiel };
}

async function analyzeSEOWithOpenAI({ description, hashtags, author }, openaiKey) {
  if (!openaiKey || !description) return null;
  const prompt = `Tu es un auditeur SEO spécialisé TikTok. Analyse et réponds STRICTEMENT en JSON valide.

CONTENU:
- Auteur: @${author || 'Inconnu'}
- Description: "${description}"
- Hashtags: ${Array.isArray(hashtags) && hashtags.length ? hashtags.map(h=>`#${h}`).join(' ') : 'Aucun'}

RENVOIE CE JSON UNIQUEMENT:
{
  "niche": "string",
  "seo_score": 0-100,
  "hashtag_alignment_score": 0-100,
  "primary_keywords": ["mot-clé 1", "mot-clé 2"],
  "missing_keywords": ["mot-clé manquant 1"],
  "has_hook": true/false,
  "has_cta": true/false,
  "issues": ["problème 1", "problème 2"],
  "suggestions": ["action concrète 1", "action concrète 2"]
}`;

  const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 800
    })
  }, 20000);

  if (!res.ok) return null;
  const data = await res.json();
  try {
    return JSON.parse(data.choices?.[0]?.message?.content || '{}');
  } catch { return null; }
}

// --------- Handler ----------
export default async function handler(req, res) {
  const allowedOrigin = '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    // petite route de stats/debug
    const stats = {
      total: analysisLogs.length,
      last: analysisLogs.at(-1) || null
    };
    res.setHeader('Cache-Control', 'public, max-age=120');
    return res.status(200).json({ success: true, stats });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  // parse body
  let body = req.body;
  if (!body && req.headers['content-type']?.includes('application/json')) {
    try {
      const raw = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', c => (data += c));
        req.on('end', () => resolve(data));
        req.on('error', reject);
      });
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return res.status(400).json({ error: 'JSON invalide' });
    }
  }

  const start = Date.now();
  try {
    const { url } = body || {};
    if (!url || !isValidTikTokUrl(url)) {
      return res.status(400).json({ error: 'URL TikTok invalide ou manquante' });
    }

    const user = extractUserInfo(req);
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
    const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY || '';

    // Étape 1: oEmbed
    let description = null;
    let thumbnail = null;
    try {
      const oembed = await fetchWithTimeout(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }, 8000);
      if (oembed.ok) {
        const js = await oembed.json();
        description = js.title || null;
        thumbnail = js.thumbnail_url || null;
      }
    } catch {}

    // Étape 2: Scraping HTML (via ScrapingBee si clé, sinon fetch direct - souvent bloqué)
    let stats = null;
    try {
      let htmlResp;
      if (SCRAPINGBEE_API_KEY) {
        const u = new URL('https://app.scrapingbee.com/api/v1/');
        u.searchParams.set('api_key', SCRAPINGBEE_API_KEY);
        u.searchParams.set('url', url);
        u.searchParams.set('render_js', 'true');
        u.searchParams.set('wait', '6000');
        u.searchParams.set('premium_proxy', 'true');
        u.searchParams.set('stealth_proxy', 'true');
        u.searchParams.set('country_code', 'fr');
        htmlResp = await fetchWithTimeout(u.toString(), {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        }, 25000);
      } else {
        htmlResp = await fetchWithTimeout(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        }, 15000);
      }
      if (htmlResp?.ok) {
        const html = await htmlResp.text();
        stats = extractStatsFromHtml(html);
      }
    } catch {}

    if (stats && description && (!stats.description || stats.description.length < description.length)) {
      stats.description = description;
    } else if (!stats && description) {
      stats = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, description, author: null, hashtags: [], music: null, duration: null, createTime: null, videoUrl: null, coverUrl: null };
    }

    // Étape 3: Audit SEO/hashtags via OpenAI
    let ai = null;
    try {
      ai = await analyzeSEOWithOpenAI({
        description: stats?.description || description || '',
        hashtags: stats?.hashtags || [],
        author: stats?.author || null
      }, OPENAI_API_KEY);
    } catch {}

    // Calculs
    const metrics = calculateMetrics(stats);
    const score = calculateScore(stats, metrics, ai);

    // Log local (en mémoire)
    const logEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      timestamp: new Date().toISOString(),
      url,
      author: stats?.author || null,
      stats,
      score: score.score,
      ip: user.ip,
      ms: Date.now() - start
    };
    analysisLogs.push(logEntry);
    if (analysisLogs.length > 1000) analysisLogs = analysisLogs.slice(-1000);

    // Réponse finale
    return res.status(200).json({
      success: true,
      analysisId: logEntry.id,
      timestamp: logEntry.timestamp,
      video: {
        url,
        description: stats?.description || description || null,
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
          views: formatNumber(stats.views || 0),
          likes: formatNumber(stats.likes || 0),
          comments: formatNumber(stats.comments || 0),
          shares: formatNumber(stats.shares || 0),
          saves: formatNumber(stats.saves || 0)
        }
      } : null,
      metrics,
      analysis: {
        score: score.score,
        potentiel_viral: score.potentiel,
        openai: ai || null
      },
      meta: {
        framework: 'no-tiktok-api:v1',
        tookMs: logEntry.ms,
        hasOpenAI: !!OPENAI_API_KEY
      }
    });
  } catch (e) {
    console.error('Handler error', e);
    return res.status(500).json({ error: 'Erreur interne' });
  }
}
