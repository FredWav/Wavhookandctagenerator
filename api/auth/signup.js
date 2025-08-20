export const config = { runtime: "nodejs18.x" };

const { json, getBody, setSession, createUser } = require("../_auth-util");

export default async function handler(req){
  if(req.method!=="POST") return json({error:"Method not allowed"},405);
  const { email, password } = await getBody(req);
  if(!email || !password || password.length<8) return json({error:"Email ou mot de passe invalide"},400);
  const user = await createUser(email, password).catch(e=> ({error:e.message}));
  if(user.error) return json({error:user.error},400);
  const cookie = setSession(user);
  return new Response(JSON.stringify({ ok:true, user:{ email:user.email, plan:user.plan }}), {
    status:200,
    headers:{ "Content-Type":"application/json", "Set-Cookie": cookie }
  });
}
