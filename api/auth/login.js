export const config = { runtime: "nodejs18.x" };

const { json, getBody, setSession, verifyUser } = require("../_auth-util");

export default async function handler(req){
  if(req.method!=="POST") return json({error:"Method not allowed"},405);
  const { email, password } = await getBody(req);
  if(!email || !password) return json({error:"Champs manquants"},400);
  try{
    const user = await verifyUser(email, password);
    const cookie = setSession(user);
    return new Response(JSON.stringify({ ok:true, user:{ email:user.email, plan:user.plan }}), {
      status:200,
      headers:{ "Content-Type":"application/json", "Set-Cookie": cookie }
    });
  }catch(e){
    return json({error: e.message || "Login failed"},401);
  }
}
