export const config = { runtime: "nodejs" };

const { json, requireUser } = require("../_auth-util");
const { kvGet } = require("../_kv");

export default async function handler(req) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return json({ error: "Unauthorized" }, 401);
  }

  const key = `hist:${user.id}`;
  const items = (await kvGet(key)) || [];
  return json({ items });
}
