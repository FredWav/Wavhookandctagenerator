const crypto = require("crypto");

function b64url(input){
  return Buffer.from(input).toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
}
function sign(payload, secret, expiresInSec=60*60*24*15){
  const header = { alg:"HS256", typ:"JWT" };
  const now = Math.floor(Date.now()/1000);
  const full = { ...payload, iat: now, exp: now + expiresInSec };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(full));
  const data = `${h}.${p}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  return `${data}.${sig}`;
}
function verify(token, secret){
  const [h,p,s] = token.split(".");
  if(!h||!p||!s) throw new Error("Invalid token");
  const data = `${h}.${p}`;
  const expSig = crypto.createHmac("sha256", secret).update(data).digest("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  if(expSig!==s) throw new Error("Bad signature");
  const payload = JSON.parse(Buffer.from(p,"base64").toString());
  if(payload.exp && payload.exp < Math.floor(Date.now()/1000)) throw new Error("Expired");
  return payload;
}
module.exports = { sign, verify };
