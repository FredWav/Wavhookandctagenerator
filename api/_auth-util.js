const crypto = require("crypto");
const { kvGet, kvSet } = require("./_kv");
const { sign, verify } = require("./_jwt");

const COOKIE_NAME = "wav_auth";
const JWT_SECRET = process.env.JWT_SECRET || "change-me-please-super-secret";

function json(res, status=200, headers={}) {
  const h = { "Content-Type":"application/json", ...headers };
  return new Response(JSON.stringify(res), { status, headers:h });
}
function getBody(req){ return new Promise(resolve=> req.json().then(resolve).catch(()=>resolve({}))); }

function sameSite(){ return "Lax"; }
function cookie(opts){
  const { name, value, days=15, httpOnly=true, path="/", secure=true } = opts;
  const exp = new Date(Date.now()+days*864e5).toUTCString();
  return `${name}=${value}; Expires=${exp}; Path=${path}; ${secure?"Secure;":""} ${httpOnly?"HttpOnly;":""} SameSite=${sameSite()}`;
}

async function hashPassword(password, salt=crypto.randomBytes(16)){
  return new Promise((resolve,reject)=>{
    crypto.pbkdf2(password, salt, 120000, 32, "sha256", (err, derived)=>{
      if(err) return reject(err);
      resolve({ hash: derived.toString("hex"), salt: salt.toString("hex") });
    });
  });
}

async function createUser(email, password){
  const key = `user:${email.toLowerCase()}`;
  const exists = await kvGet(key);
  if(exists) throw new Error("Email déjà utilisé");
  const {hash,salt} = await hashPassword(password);
  const user = { id: key, email, hash, salt, plan:"free", createdAt: Date.now() };
  await kvSet(key, user);
  return user;
}
async function verifyUser(email, password){
  const key = `user:${email.toLowerCase()}`;
  const user = await kvGet(key);
  if(!user) throw new Error("Utilisateur introuvable");
  const {hash} = await hashPassword(password, Buffer.from(user.salt,"hex"));
  if(hash !== user.hash) throw new Error("Mot de passe invalide");
  return user;
}

function setSession(user){
  const token = sign({ sub:user.id, email:user.email, plan:user.plan }, JWT_SECRET);
  const c = cookie({ name: COOKIE_NAME, value: token });
  return c;
}
function clearSession(){
  return `${COOKIE_NAME}=; Expires=${new Date(0).toUTCString()}; Path=/; HttpOnly; SameSite=${sameSite()}; Secure`;
}
function getTokenFromCookie(req){
  const raw = req.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\s*)wav_auth=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
async function requireUser(req){
  const token = getTokenFromCookie(req);
  if(!token) throw new Error("Not authenticated");
  const payload = verify(token, JWT_SECRET);
  const user = await kvGet(payload.sub);
  if(!user) throw new Error("User missing");
  return user;
}

module.exports = { json, getBody, COOKIE_NAME, setSession, clearSession, requireUser, createUser, verifyUser };
