const API_ORIGIN = ""; // même domaine

// Côté client, pour vérifier les cookies
console.log('Cookies actuels:', document.cookie);

// Votre fonction API avec plus de debugging
function api(path, { method="GET", body, headers={} } = {}) {
    console.log(`API call: ${method} ${path}`);
    console.log('Cookies being sent:', document.cookie);
    
    return fetch(`${API_ORIGIN}/api/${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        credentials: "include",
        body: body ? JSON.stringify(body) : undefined
    }).then(async r => {
        console.log('Response status:', r.status);
        console.log('Response headers:', [...r.headers.entries()]);
        
        const data = await r.json().catch(()=> ({}));
        if (!r.ok) throw Object.assign(new Error(data.error || r.statusText), { status: r.status, data });
        return data;
    });
}

async function requireAuth(redirectIfMissing=true){
  try{
    const me = await api("auth/me");
    return me;
  }catch(e){
    if(redirectIfMissing) location.href = "/login";
    throw e;
  }
}

function el(q, root=document){return root.querySelector(q)}
function els(q, root=document){return [...root.querySelectorAll(q)]}

function toast(msg, type="info"){
  let t = document.createElement("div");
  t.className = "toast";
  t.style.borderColor = type==="error" ? "rgba(255,59,59,.4)" : "rgba(255,255,255,.12)";
  t.innerHTML = msg;
  document.body.appendChild(t);
  setTimeout(()=> t.remove(), 3800);
}

function lockPremium(node){
  node.classList.add("lock");
  const badge = document.createElement("span");
  badge.className="badge";
  badge.innerHTML = "Premium";
  node.appendChild(badge);
}
