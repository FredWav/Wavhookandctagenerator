export const config = { runtime: "nodejs18.x" };

const { json, clearSession } = require("../_auth-util");

export default async function handler(req){
  if(req.method!=="POST") return json({error:"Method not allowed"},405);
  const cookie = clearSession();
  return new Response(JSON.stringify({ ok:true }), {
    status:200,
    headers:{ "Content-Type":"application/json", "Set-Cookie": cookie }
  });
}
