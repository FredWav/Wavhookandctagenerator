export const config = { runtime: "nodejs" };

const { json, requireUser, getBody } = require("../_auth-util");
const { kvGet, kvSet } = require("../_kv");

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let user;
  try {
    user = await requireUser(req);
  } catch {
    return json({ error: "Unauthorized" }, 401);
  }

  const { type, input, output } = await getBody(req);
  const key = `hist:${user.id}`;
  const arr = (await kvGet(key)) || [];
  const item = { ts: Date.now(), type, input, output };

  // quotas : 30 (free) / 500 (pro)
  const limit = user.plan === "pro" ? 500 : 30;
  arr.unshift(item);
  await kvSet(key, arr.slice(0, limit));

  return json({ ok: true });
}
