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

    renderAuthenticatedNav(container, user) {
        const currentPath = location.pathname;

        container.innerHTML = `
      ${currentPath !== '/' ?
                '<a class="px-4 py-3 rounded-xl font-semibold transition border border-white/15 text-text bg-transparent hover:bg-white/10" href="/">Accueil</a>' : ''}
      <a class="px-4 py-3 rounded-xl font-semibold transition border border-white/15 text-text bg-transparent hover:bg-white/10" href="/history">Historique</a>
      
      <!-- Dropdown Profile -->
      <div class="relative" id="profileDropdown">
        <button id="profileBtn" class="flex items-center gap-3 px-4 py-2 rounded-xl font-semibold transition border border-white/15 text-text bg-transparent hover:bg-white/10">
          <!-- Avatar -->
          <div class="w-6 h-6 rounded-full bg-gradient-to-br from-accent-2 to-accent flex items-center justify-center text-sm font-bold text-slate-900">
            ${this.getInitials(user.email)}
          </div>
          <!-- User Info -->
          <div class="hidden sm:flex flex-col items-start">
            <span class="text-sm font-medium">${user.email.split('@')[0]}</span>
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 bg-success rounded-full"></span>
              <span class="text-xs text-muted">${user.plan.toUpperCase()}</span>
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
              <div class="w-10 h-10 rounded-full bg-gradient-to-br from-accent-2 to-accent flex items-center justify-center text-lg font-bold text-slate-900">
                ${this.getInitials(user.email)}
              </div>
              <div>
                <div class="font-medium text-text">${user.email}</div>
                <div class="flex items-center gap-2 mt-1">
                  <span class="w-2 h-2 bg-success rounded-full"></span>
                  <span class="text-xs text-muted">Plan ${user.plan.toUpperCase()}</span>
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
            
            <a href="/settings" class="flex items-center gap-3 px-4 py-2 text-sm text-text hover:bg-white/5 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              Paramètres
            </a>

            ${user.plan !== 'pro' ? `
            <a href="/upgrade" class="flex items-center gap-3 px-4 py-2 text-sm text-accent-2 hover:bg-accent-2/10 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
              Passer à PRO
            </a>
            ` : ''}

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
    }

    renderGuestNav(container) {
        container.innerHTML = `
      <a class="px-4 py-3 rounded-xl font-semibold transition border border-white/15 text-text bg-transparent hover:bg-white/10" href="/login">Connexion</a>
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

    getInitials(email) {
        return email.charAt(0).toUpperCase();
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
