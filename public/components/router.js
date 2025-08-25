const routes = {
    '/contact': '/pages/contact.html',
    '/ctas': '/pages/ctas.html',
    '/history': '/pages/history.html',
    '/hooks': '/pages/hooks.html',
    '/': '/pages/index.html',
    '/login': '/pages/login.html',
    '/profile': '/pages/profile.html',
    '/signup': '/pages/signup.html',
    '/verify-email': '/pages/verify-email.html',
};

async function loadComponent(selector, componentPath) {
    try {
        const response = await fetch(componentPath);
        const html = await response.text();
        const element = document.querySelector(selector);
        if (element) element.innerHTML = html;
    } catch (error) {
        console.error(`Erreur de chargement de ${componentPath}:`, error);
    }
}

async function loadPage(path) {
    const url = routes[path] || '/pages/404.html';
    await loadComponent("#main-content", url);

    // Réinitialiser les scripts après chargement
    initPageScripts(path);

    document.title = {
        '/': 'Accueil – Wav Social Scan',
        '/profile': 'Profil – Wav Social Scan',
        '/contact': 'Contact – Wav Social Scan',
        '/hooks': 'Générateur de Hooks – Wav Social Scan',
        '/ctas': 'Générateur de CTAs – Wav Social Scan',
    }[path] || 'Wav Social Scan';
}

function initPageScripts(path) {
    switch (path) {
        case '/contact':
            initContactForm();
            break;
        case '/hooks':
            initHooksGenerator();
            break;
        case '/ctas':
            initCTAGenerator();
            break;
        case '/profile':
            initProfilePage();
            break;
        case '/login':
            initLoginPage();
            break;
    }
}

function initContactForm() {
    let currentUser;

    const form = document.getElementById("contactForm");
    const submitBtn = document.getElementById("submitBtn");
    const formMessage = document.getElementById("formMessage");
    const messageText = document.getElementById("messageText");

    // Vérifier si l'utilisateur est connecté et pré-remplir les champs
    (async () => {
        try {
            currentUser = await api("auth/me");

            if (currentUser && currentUser.user) {
                const nameField = document.getElementById("name");
                const emailField = document.getElementById("email");

                if (nameField && currentUser.user.username) {
                    const capitalizeFirstLetter = (str) => str.charAt(0).toUpperCase() + str.slice(1);
                    nameField.value = capitalizeFirstLetter(currentUser.user.username);
                }
                if (emailField && currentUser.user.email) {
                    emailField.value = currentUser.user.email;
                }
            }
        } catch (error) {
            // L'utilisateur peut quand même utiliser le formulaire
        }
    })();

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Envoi en cours...
            `;

            formMessage.classList.add("hidden");

            const formData = {
                name: form.name.value.trim(),
                email: form.email.value.trim(),
                subject: form.subject.value,
                message: form.message.value.trim(),
                userId: currentUser && currentUser.user ? currentUser.user.id : null,
            };

            try {
                const response = await fetch("/api/contact", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData),
                });

                const data = await response.json();

                if (response.ok) {
                    formMessage.className =
                        "block p-4 rounded-xl bg-success/20 border border-success/30";
                    messageText.className = "text-sm font-medium text-success";
                    messageText.textContent =
                        "Message envoyé avec succès ! Nous vous répondrons rapidement.";
                    // Ne reset que message et sujet
                    form.message.value = "";
                    document.getElementById("subject").selectedIndex = 0;
                } else {
                    formMessage.className =
                        "block p-4 rounded-xl bg-danger/20 border border-danger/30";
                    messageText.className = "text-sm font-medium text-danger";
                    messageText.textContent =
                        data.error || "Erreur lors de l'envoi du message.";
                }
                formMessage.classList.remove("hidden");
            } catch (error) {
                formMessage.className =
                    "block p-4 rounded-xl bg-danger/20 border border-danger/30";
                messageText.className = "text-sm font-medium text-danger";
                messageText.textContent =
                    "Erreur de connexion. Veuillez réessayer plus tard.";
                formMessage.classList.remove("hidden");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }
}

function initHooksGenerator() {
    // Vos fonctions pour la page hooks
}

function initCTAGenerator() {
    let currentUser;

    // Authentification et logique principale
    (async () => {
        try {
            // Vérifier l'authentification
            currentUser = await requireAuth(true);

            // Gérer la génération
            document.getElementById("run").addEventListener("click", async () => {
                const runBtn = document.getElementById("run");
                const originalText = runBtn.textContent;

                runBtn.disabled = true;
                runBtn.innerHTML = `
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Génération...
                `;

                const body = {
                    intent: document.getElementById("intent").value,
                    platform: document.getElementById("platform").value,
                    tone: document.getElementById("tone").value,
                    constraints: document.getElementById("constraints").value.trim(),
                    count: parseInt(document.getElementById("count").value || "20", 10),
                    putaclic:
                        document.getElementById("putaclic").checked &&
                        currentUser.plan === "pro",
                };

                try {
                    const data = await api("generate-ctas", { method: "POST", body });
                    const out = document.getElementById("out");
                    out.innerHTML = "";

                    if (data.ctas && data.ctas.length > 0) {
                        data.ctas.forEach((cta, i) => {
                            const li = document.createElement("li");
                            li.className =
                                "bg-panel-2 border border-white/10 p-4 rounded-xl hover:bg-white/5 transition-colors group";
                            li.innerHTML = `
                              <div class="flex items-start justify-between">
                                <span class="flex-1">${i + 1}. ${cta}</span>
                                <button class="copy-btn opacity-0 group-hover:opacity-100 ml-3 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-all"
                                  data-cta="${cta.replace(/'/g, "\\'")}"
                                >
                                  Copier
                                </button>
                              </div>
                            `;
                            out.appendChild(li);
                        });
                        toast(`${data.ctas.length} CTAs générés avec succès!`, "success");
                    } else {
                        out.innerHTML =
                            '<li class="bg-panel-2 border border-white/10 p-4 rounded-xl text-center text-muted">Aucun CTA généré</li>';
                        toast("Aucun CTA généré", "warning");
                    }
                } catch (error) {
                    toast(error.message || "Erreur lors de la génération", "error");
                } finally {
                    runBtn.disabled = false;
                    runBtn.textContent = originalText;
                }
            });

            // Copier tout
            document.getElementById("copyAll").addEventListener("click", () => {
                const items = Array.from(
                    document.querySelectorAll("#out li")
                ).map((li) => li.textContent.replace(/Copier$/, "").trim());
                if (items.length === 0) {
                    toast("Aucun contenu à copier", "warning");
                    return;
                }
                navigator.clipboard
                    .writeText(items.join("\n"))
                    .then(() => toast("Tous les CTAs copiés!", "success"))
                    .catch(() => toast("Erreur lors de la copie", "error"));
            });

            // Gestion du copier individuel sur les nouveaux boutons générés
            document.getElementById("out").addEventListener("click", (e) => {
                if (e.target.classList.contains("copy-btn")) {
                    copyToClipboard(e.target.getAttribute("data-cta"), e.target);
                }
            });

        } catch (error) {
            location.href = "/login";
        }
    })();

    // Fonction copie individuelle
    function copyToClipboard(text, button) {
        navigator.clipboard
            .writeText(text)
            .then(() => {
                const originalText = button.textContent;
                button.textContent = "Copié!";
                button.classList.add("bg-success", "text-white");
                setTimeout(() => {
                    button.textContent = originalText;
                    button.classList.remove("bg-success", "text-white");
                }, 1500);
            })
            .catch(() => {
                toast("Erreur lors de la copie", "error");
            });
    }
}

function initProfilePage() {
    // Vos fonctions pour la page profile
}

function initLoginPage() {
    const form = document.getElementById("form");

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = e.target.email.value.trim();
            const password = e.target.password.value;

            try {
                await api("auth/login", {
                    method: "POST",
                    body: { email, password },
                });

                // Pour la SPA, utilise le router au lieu de location.href
                window.router.navigate("/");
                // OU si tu veux forcer un rechargement complet :
                // location.href = "/";

            } catch (err) {
                toast(err.message || "Erreur de connexion", "error");
            }
        });
    }
}

function showMessage(text, type) {
    // Fonction pour afficher des messages toast/notification
    console.log(`${type}: ${text}`);
}

// Initial load
document.addEventListener('DOMContentLoaded', async () => {
    await loadComponent('#header', '/components/header.html');
    await loadComponent('#footer', '/components/footer.html');
    if (window.AuthHeader) new AuthHeader();

    // Charger la page courante
    await loadPage(window.location.pathname);

    // Intercepter les liens internes
    document.body.addEventListener('click', async e => {
        const link = e.target.closest('a[href]');
        if (link && link.getAttribute('href').startsWith('/') && !link.hasAttribute('target')) {
            e.preventDefault();
            const path = link.getAttribute('href');
            window.history.pushState({}, '', path);
            await loadPage(path);
        }
    });

    // Navigation via historique
    window.addEventListener('popstate', () => loadPage(window.location.pathname));
});
