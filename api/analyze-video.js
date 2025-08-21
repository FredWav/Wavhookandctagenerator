// api/analyze-video.js
const express = require('express');
const router = express.Router();

let analysisLogs = [];

// Tes fonctions utilitaires restent identiques
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

// ... toutes tes autres fonctions utilitaires ...

router.get('/', (req, res) => {
  if (req.query.selftest) {
    return res.json({
      status: "ok",
      message: "API analyze-video opérationnelle",
      timestamp: new Date().toISOString()
  });

module.exports = router;
});

router.post('/', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL manquante" });
    }

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

    function getQuery(req) {
      // Compatible Vercel Functions (pas Next): parse via URL
      const u = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
      const q = {};
      u.searchParams.forEach((v, k) => { q[k] = v; });
      return q;
    }

    function extractUserInfo(req) {
      const fwd = req.headers['x-forwarded-for'];
      const ip = fwd ? fwd.split(',')[0].trim()
        : (req.headers['x-real-ip'] || req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown');
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
      // __NEXT_DATA__
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
            if (!p) continue;
            if (p.stats) {
              const s = createStatsObjectFromItem(p);
              if (s) return s;
            } else if (typeof p === 'object') {
              for (const val of Object.values(p)) {
                const s = createStatsObjectFromItem(val);
                if (s) return s;
              }
            }
          }
        }
      } catch { }

      // SIGI_STATE
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
      } catch { }

      // Patterns fallback
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
            } catch { }
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
        const saves = getMax(/"collectCount":(\d+)/g);

        if (views > 0) {
          return {
            views, likes, comments, shares, saves,
            description: null, author: null, hashtags: [],
            music: null, duration: null, createTime: null, videoUrl: null, coverUrl: null
          };
        }
      } catch { }

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
      try {
        const prompt = `Tu es un auditeur SEO spécialisé TikTok. Analyse et réponds STRICTEMENT en JSON valide.

CONTENU:
- Auteur: @${author || 'Inconnu'}
- Description: "${description}"
- Hashtags: ${Array.isArray(hashtags) && hashtags.length ? hashtags.map(h => `#${h}`).join(' ') : 'Aucun'}

RENVOIE CE JSON UNIQUEMENT:
{
  "niche": "string",
  "seo_score": 0-100,
  "hashtag_alignment_score": 0-100,
  "primary_keywords": ["mot-clé 1"],
  "missing_keywords": ["mot-clé manquant 1"],
  "has_hook": true/false,
  "has_cta": true/false,
  "issues": ["problème 1"],
  "suggestions": ["action concrète 1"]
}`;
        const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o',
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 600
          })
        }, 20000);
        if (!res.ok) return null;
        const data = await res.json();
        return JSON.parse(data.choices?.[0]?.message?.content || '{}');
      } catch {
        return null;
      }
    }

  // ...existing code...

module.exports = router;
