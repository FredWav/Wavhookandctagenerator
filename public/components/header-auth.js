class AuthHeader {
  constructor() {
    // Attendre que le DOM soit prêt
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  async init() {
    // Attendre un peu que le header soit chargé
    await new Promise(resolve => setTimeout(resolve, 100));
    await this.updateNavigation();
  }

  async updateNavigation() {
    const headerNav = document.getElementById('header-nav');
    if (!headerNav) {
      console.error('Element #header-nav non trouvé');
      return;
    }

    try {
      const me = await api("auth/me");
      this.renderAuthenticatedNav(headerNav, me.user);
    } catch (error) {
      this.renderGuestNav(headerNav);
    }
  }

  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  // Configuration des plans
  getPlanConfig(plan) {
    const configs = {
      free: {
        name: 'FREE',
        color: 'text-muted',
        bgColor: 'bg-muted'
      },
      plus: {
        name: 'PLUS',
        color: 'text-warning',
        bgColor: 'bg-warning '
      },
      pro: {
        name: 'PRO',
        color: 'text-success',
        bgColor: 'bg-success'
      }
    };
    return configs[plan] || configs.free;
  }

  // Nouvelle fonction pour générer l'HTML de l'avatar
  getAvatarHTML(user, size = 'small') {
    const sizeClasses = {
      small: 'w-8 h-8 text-sm',
      large: 'w-12 h-12 text-lg'
    };

    const sizeClass = sizeClasses[size] || sizeClasses.small;

    if (user.avatar_path) {
      // Afficher l'image avatar
      return `
                <img 
                    src="${user.avatar_path}" 
                    alt="Avatar ${user.username}" 
                    class="${sizeClass} rounded-full object-cover border-2 border-white/10"
                    onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                />
                <div class="${sizeClass} rounded-full bg-gradient-to-br from-accent-2 to-accent flex items-center justify-center font-bold text-slate-900 border-2 border-white/10" style="display: none;">
                    ${this.getInitials(user.username)}
                </div>
            `;
    } else {
      // Afficher les initiales
      return `
                <div class="${sizeClass} rounded-full flex items-center justify-center font-bold text-white border-2 border-white/10 overflow-hidden" style="aspect-ratio: 1;">
                    <span class="w-full h-full flex items-center justify-center rounded-full bg-gradient-to-br from-accent-2 to-accent text-slate-900 text-center" style="font-size:inherit;">
                        ${this.getInitials(user.username)}
                    </span>
                </div>
            `;
    }
  }

  renderAuthenticatedNav(container, user) {
    const currentPath = location.pathname;
    const userPlan = user.plan || 'free';
    const planConfig = this.getPlanConfig(userPlan);

    container.innerHTML = `
      ${currentPath !== '/' ?
        '<a class="px-4 py-3 rounded-xl font-semibold transition border border-white/15 text-text bg-transparent hover:bg-white/10" href="/">Accueil</a>' : ''}
        <a class="px-4 py-3 rounded-xl font-semibold transition border border-white/15 text-text bg-transparent hover:bg-white/10" href="/upgrade">Prix</a>
      <a class="px-4 py-3 rounded-xl font-semibold transition border border-white/15 text-text bg-transparent hover:bg-white/10" href="/history">Historique</a>
      
      <!-- Dropdown Profile -->
      <div class="relative" id="profileDropdown">
        <button id="profileBtn" class="flex items-center gap-3 px-4 py-2 rounded-xl font-semibold transition border border-white/15 text-text bg-transparent hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-accent/50">
          <!-- Avatar (petit) -->
          <div class="flex-shrink-0">
            ${this.getAvatarHTML(user, 'small')}
          </div>
          <!-- User Info -->
          <div class="hidden sm:flex flex-col items-start">
            <span class="text-sm font-medium">${this.capitalize(user.username)}</span>
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 ${planConfig.bgColor} rounded-full"></span>
              <span class="text-xs ${planConfig.color}">${planConfig.name}</span>
            </div>
          </div>
          <!-- Chevron -->
          <svg id="chevron" class="w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </button>

        <!-- Dropdown Menu -->
        <div id="profileMenu" class="absolute right-0 mt-2 w-64 bg-panel border border-white/10 rounded-xl shadow-neon backdrop-blur-lg z-50 opacity-0 invisible transform scale-95 transition-all duration-200 origin-top-right">
          <!-- User Info Header -->
          <div class="px-4 py-3 border-b border-white/10">
            <div class="flex items-center gap-3">
              <!-- Avatar (grand) -->
              <div class="flex-shrink-0">
                ${this.getAvatarHTML(user, 'large')}
              </div>
              <div class="flex-grow min-w-0">
                <div class="font-medium text-text truncate">${this.capitalize(user.username)}</div>
                <div class="text-xs text-muted truncate">${user.email}</div>
                <div class="flex items-center gap-2 mt-1">
                </div>
              </div>
            </div>
          </div>

          <!-- Menu Items -->
          <div class="py-2">
            <a href="/profile" class="flex items-center gap-3 px-4 py-2 text-sm text-text hover:bg-white/5 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
              </svg>
              Mon Profil
            </a>

            <!-- Options d'upgrade conditionnelles -->
            ${this.getUpgradeOptions(userPlan)}

            <div class="border-t border-white/10 my-2"></div>
            
            <button id="dropdownLogoutBtn" class="flex items-center gap-3 px-4 py-2 text-sm text-danger hover:bg-danger/10 transition-colors w-full text-left">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
              </svg>
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    `;

    // Attacher les événements du dropdown
    this.setupDropdownEvents();
    this.setupManageSubscriptionHeaderBtn();
  }

  getUpgradeOptions(userPlan) {
    // Bouton visible seulement pour les plans payants
    let manageBtn = '';
    if (userPlan === 'plus' || userPlan === 'pro') {
      manageBtn = `
      <button 
        id="headerManageSubscriptionBtn"
        class="flex items-center gap-3 px-4 py-2 text-sm text-text hover:bg-white/5 transition-colors w-full"
        type="button"
      >
<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wallet-icon lucide-wallet"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>
        Gérer mon abonnement
      </button>
    `;
    }

    // Options d’upgrade éventuelles
    switch (userPlan) {
      case 'free':
        return `
        <a href="/upgrade" class="flex items-center gap-3 px-4 py-2 text-sm text-warning hover:bg-warning/10 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
          Passer à PLUS
        </a>
        <a href="/upgrade" class="flex items-center gap-3 px-4 py-2 text-sm text-accent-2 hover:bg-accent-2/10 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles-icon lucide-sparkles"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/></svg>
          Passer à PRO
        </a>
      `;
      case 'plus':
        return `
        <a href="/upgrade" class="flex items-center gap-3 px-4 py-2 text-sm text-accent-2 hover:bg-accent-2/10 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles-icon lucide-sparkles"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/></svg>
          Upgrader vers PRO
        </a>
        ${manageBtn}
      `;
      case 'pro':
        return manageBtn;
      default:
        return '';
    }
  }

  renderGuestNav(container) {
    container.innerHTML = `
      <a class="px-4 py-3 rounded-xl font-semibold transition border border-white/15 text-text bg-transparent hover:bg-white/10" href="/login">Connexion</a>
      <a
  href="/signup"
  class="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold bg-gradient-to-r from-accent to-accent-2 text-slate-900 shadow-neon transition-all duration-200 border border-accent-2/40
    hover:scale-105 hover:shadow-lg hover:-translate-y-0.5 active:scale-97
    focus:outline-none focus:ring-2 focus:ring-accent-2/60"
  style="will-change: transform;"
>
  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round"
      d="M12 4v16m8-8H4"/>
  </svg>
  S'inscrire
</a>

    `;
  }

  setupDropdownEvents() {
    const profileBtn = document.getElementById('profileBtn');
    const profileMenu = document.getElementById('profileMenu');
    const chevron = document.getElementById('chevron');
    const logoutBtn = document.getElementById('dropdownLogoutBtn');

    if (!profileBtn || !profileMenu) return;

    let isOpen = false;

    // Toggle dropdown
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isOpen = !isOpen;
      this.toggleDropdown(profileMenu, chevron, isOpen);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!profileBtn.contains(e.target) && !profileMenu.contains(e.target)) {
        isOpen = false;
        this.toggleDropdown(profileMenu, chevron, false);
      }
    });

    // Logout event
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // Close on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) {
        isOpen = false;
        this.toggleDropdown(profileMenu, chevron, false);
      }
    });
  }

  toggleDropdown(menu, chevron, isOpen) {
    if (isOpen) {
      menu.classList.remove('opacity-0', 'invisible', 'scale-95');
      menu.classList.add('opacity-100', 'visible', 'scale-100');
      chevron.style.transform = 'rotate(180deg)';
    } else {
      menu.classList.add('opacity-0', 'invisible', 'scale-95');
      menu.classList.remove('opacity-100', 'visible', 'scale-100');
      chevron.style.transform = 'rotate(0deg)';
    }
  }

  getInitials(username) {
    return username ? username.charAt(0).toUpperCase() : '?';
  }

  setupManageSubscriptionHeaderBtn() {
    setTimeout(() => {
      const btn = document.getElementById('headerManageSubscriptionBtn');
      if (btn) {
        btn.onclick = async () => {
          btn.disabled = true;
          const original = btn.innerHTML;
          btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-ccw-icon lucide-refresh-ccw"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg> Redirection...';
          try {
            const response = await api("stripe/create-portal-session", {
              method: "POST"
            });
            window.open(response.portal_url, '_blank');
          } catch (err) {
            toast("Erreur lors de l'accès au portail", "error");
          } finally {
            btn.disabled = false;
            btn.innerHTML = original;
          }
        };
      }
    }, 50);
  }


  async handleLogout() {
    try {
      await api("auth/me/logout", { method: "POST" });
      location.href = "/login";
    } catch (error) {
      toast(error.message, "error");
    }
  }
}

// Exposer la classe globalement
window.AuthHeader = AuthHeader;
