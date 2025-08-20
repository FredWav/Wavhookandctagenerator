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

  const { intent="follow", platform="tiktok", tone="direct",
          constraints="", count=20, putaclic=false } = await getBody(req);

  const max = putaclic ? 50 : 50;
  const qty = Math.min(Math.max(1, count|0), max);

  const sys = [
    "Tu génères des CTAs courts et actionnables, adaptés par plateforme.",
    "Toujours en français. 1 ligne par CTA. Pas de hashtags, pas d’émojis excessifs.",
    "Réponse STRICTEMENT en JSON valide, sans texte hors JSON."
  ].join(" ");

  const platformHints = {
    tiktok: "accent sur l’action immédiate, langage parlé, 0-1s d’ancrage",
    reels: "call to action clair, doux, intégré au visuel clean",
    shorts: "CTA tranchant, concis, orienté curiosité/répétition"
  }[platform] || "CTA clair et concret";

  const putaclicBoost = putaclic
    ? "Augmente l’intensité, propose des formulations plus polarisantes mais non insultantes."
    : "Reste ferme mais respectueux.";

  const userPrompt = `
Objectif CTA: ${intent}
Plateforme: ${platform} (${platformHints})
Ton: ${tone}
Contexte: ${constraints || "N/A"}
${putaclicBoost}

Génère EXACTEMENT ${qty} CTAs, 5-12 mots, zero fluff, pas de 'abonne-toi si...', préfère 'Abonne-toi pour… [bénéfice concret]'.

Renvoie UNIQUEMENT ce JSON:
{ "ctas": ["..."] }
  `.trim();

  const r = await fetch(OPENAI_URL, {
    method:"POST",
    headers:{
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type":"application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: putaclic ? 0.85 : 0.65,
      messages: [
        { role:"system", content: sys },
        { role:"user", content: userPrompt }
      ],
      response_format: { type:"json_object" }
    })
  });

  if(!r.ok){
    const t = await r.text().catch(()=> "");
    return json({error:"OpenAI error", details:t}, 500);
  }
  const data = await r.json();
  let parsed;
  try{ parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}"); }
  catch{ parsed = { ctas:[] }; }

  return json({ ctas: Array.isArray(parsed.ctas) ? parsed.ctas : [] });
}
