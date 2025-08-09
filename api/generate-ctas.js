export const config = { runtime: "edge" };

function json(res, status = 200) {
  return new Response(JSON.stringify(res), { 
    status, 
    headers: { "Content-Type": "application/json" }
  });
}

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const body = await req.json().catch(() => ({}));
  const {
    niche = "général",
    tone = "enthousiaste",
    cta_goal = "s'abonner",
    benefit = "",
    count = 10
  } = body;

  const system = `Tu es un expert en marketing digital et en copywriting, spécialisé dans la création d'appels à l'action (CTA) percutants et irrésistibles pour les vidéos courtes (TikTok, Reels, Shorts).

Objectif: Générer des phrases courtes (5-15 mots) qui incitent clairement et efficacement le spectateur à réaliser une action précise à la fin d'une vidéo.

Instructions:
1.  Focalise-toi sur l'action demandée (l'objectif du CTA).
2.  Si un bénéfice est fourni, intègre-le de manière naturelle et convaincante.
3.  Adapte-toi scrupuleusement au ton demandé. Un CTA "urgent" doit utiliser le FOMO, un CTA "bienveillant" doit être une invitation douce.
4.  Varie les formulations : commence parfois par l'action, parfois par le bénéfice. Utilise des questions pour engager.
5.  La sortie doit être un objet JSON au format STRICT : {"ctas": ["appel à l'action 1", "appel à l'action 2", ...]}. Ne produis AUCUN autre texte.`;

  const user = `Contexte de la vidéo:
- Niche / Domaine: ${niche}
- Ton demandé pour le CTA: ${tone}

Demande:
- Objectif principal de l'appel à l'action: ${cta_goal}
- Bénéfice ou contexte à mentionner (si disponible): ${benefit || "Aucun"}

Génère une liste de ${count} appels à l'action variés.`;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      })
    });

    if (!r.ok) {
      const text = await r.text();
      return json({ error: "OpenAI error", details: text }, 500);
    }
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    const ctas = Array.isArray(parsed.ctas) ? parsed.ctas.filter(x => typeof x === "string").slice(0, count) : [];
    return json({ ctas });

  } catch (err) {
    return json({ error: "Server error", details: String(err) }, 500);
  }
}