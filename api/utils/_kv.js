const BASE = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

if(!BASE || !TOKEN){
  console.warn("[KV] Variables manquantes. Configure KV_REST_API_URL / KV_REST_API_TOKEN.");
}

async function kvGet(key){
  const r = await fetch(`${BASE}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  if(!r.ok) return null;
  const data = await r.json().catch(()=>null);
  return data && data.result ? data.result : null;
}
async function kvSet(key, value){
  await fetch(`${BASE}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type":"application/json" },
    body: JSON.stringify({ value, nx: false })
  });
}
async function kvDel(key){
  await fetch(`${BASE}/del/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
}
module.exports = { kvGet, kvSet, kvDel };
