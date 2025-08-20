export const config = { runtime: "edge" };

function corsHeaders() {
  const origin = process.env.CORS_ORIGIN || "*";
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}
function json(res, status = 200){ return new Response(JSON.stringify(res), { status, headers: corsHeaders() }); }

async function getBody(req){ try{ return await req.json(); }catch{ return {}; } }

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

export default async function handler(req){
  if(req.method==="OPTIONS") return json({ok:true});
  if(req.method!=="POST") return json({error:"Method not allowed"},405);

  const { platform="tiktok", niche="", theme="", brief="", tone="direct",
          antiBateau=true, putaclic=false, countText=20, countVisual=10 } = await getBody(req);

  // Gating côté serveur (Free limits)
  const maxText = putaclic ? 50 : 50;
  const maxVisual = putaclic ? 50 : 50;
  const safeText = Math.min(Math.max(0, countText|0), maxText);
  const safeVisual = Math.min(Math.max(0, countVisual|0), maxVisual);

  const sys = [
    "Tu es un générateur de hooks ultra-efficaces, calibrés par plateforme.",
    "Tu renvoies STRICTEMENT du JSON valide, rien d’autre.",
    "Interdiction d’ajouter une phrase hors JSON.",
    "Évite absolument les formulations banales ('Découvrez', 'Voici', 'Dans cette vidéo').",
    "Respecte la quantité demandée exactement."
  ].join(" ");

  const platformBias = {
    tiktok: "rythme très rapide, pattern interrupt immédiat (0-1s), promesse concrète, conflit léger ok",
    reels: "esthétique + rythme soutenu, clarté, bénéfice concret, style 'clean'",
    shorts: "promesse choc + curiosité, cut rapides, structure 'setup→contradiction→benefit'"
  }[platform] || "rythme rapide, bénéfice concret";

  const putaclicBoost = putaclic ? [
    "Amplifie le contraste (surprise, chiffre inattendu, contre-intuition).",
    "Autorise la polarisation contrôlée sans dérive irrespectueuse.",
    "Concis, percutant, aucun flou, aucun disclaimer."
  ].join(" ") : "Reste impactant mais responsable.";

  const antiFluff = antiBateau ? "Interdiction des platitudes, pas de 'regarde jusqu’à la fin', pas de 'astuces' génériques." : "";

  const visualSpec =
    "Les hooks visuels sont des objets avec: 'shot' (mise en scène), 'overlay' (texte écran), 'action' (mouvement/prop), adaptés à la plateforme, 3-10 mots par champ.";

  const userPrompt = `
Plateforme: ${platform}. Règles spécifiques: ${platformBias}.
Niche/audience: ${niche}.
Thème/sujet: ${theme}.
Contexte: ${brief || "N/A"}.
Ton: ${tone}.
${putaclicBoost}
${antiFluff}

Génère:
- EXACTEMENT ${safeText} hooks textuels (français), 7-14 mots, promesse claire, pas de ponctuation excessive, pas de hashtags.
- EXACTEMENT ${safeVisual} hooks visuels (objets {shot, overlay, action}).
${visualSpec}

Rends UNIQUEMENT ce JSON:
{
  "textHooks": ["..."],
  "visualHooks": [{"shot":"...", "overlay":"...", "action":"..."}]
}
  `.trim();

  const r = await fetch(OPENAI_URL, {
    method:"POST",
    headers:{
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: putaclic ? 0.9 : 0.7,
      messages: [
        { role:"system", content: sys },
        { role:"user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    })
  });

  if(!r.ok){
    const t = await r.text().catch(()=> "");
    return json({error:"OpenAI error", details:t}, 500);
  }
  const data = await r.json();
  let parsed;
  try{
    parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
  }catch{ parsed = { textHooks:[], visualHooks:[] }; }

  return json({
    textHooks: Array.isArray(parsed.textHooks) ? parsed.textHooks : [],
    visualHooks: Array.isArray(parsed.visualHooks) ? parsed.visualHooks : []
  });
}
