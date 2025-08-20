export const config = { runtime: "nodejs18.x" };

const { json, requireUser } = require("../_auth-util");

export default async function handler(req){
  try{
    const user = await requireUser(req);
    return json({ email:user.email, plan:user.plan, id:user.id });
  }catch(e){
    return json({ error:"Unauthorized" }, 401);
  }
}
