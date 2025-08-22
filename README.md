# Wav Social Scan (Hooks + CTAs)

- **Auth obligatoire** (email+mdp), **JWT cookie** HttpOnly.
- **Freemium/Premium** : limites et Putaclic+ réservé à Premium (future bascule de plan via KV).
- **Hooks** : textuels + visuels (idées de plans/overlays/actions).
- **CTAs** : anti-bateau, adaptés TikTok/Reels/Shorts.
- **UI** : style sombre néon (Toknament-like), responsive.

## Déploiement (Vercel)
1. Importer le repo GitHub.
2. Variables d’env. :
   - `OPENAI_API_KEY`
   - `JWT_SECRET` (32+ chars)
   - `KV_REST_API_URL`, `KV_REST_API_TOKEN` (Upstash/Vercel KV REST)
   - `CORS_ORIGIN` (optionnel)
3. Pas de build. Pages statiques + `/api/*`.

## Routes
- Pages : `/login`, `/signup`, `/`, `/hooks`, `/ctas`, `/history`.
- API Auth (Node): `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- API Generators (Edge): `/api/generate-hooks`, `/api/generate-ctas`

## Premium (à venir)
- Upgrade `user.plan` -> `"pro"` dans KV (`user:<email>`), déblocage Putaclic+ et quotas supérieurs.
