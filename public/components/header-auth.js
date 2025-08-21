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

        container.innerHTML = `
      ${currentPath !== '/' ?
                '<a class="px-4 py-3 rounded-xl font-semibold transition border border-white/15 text-text bg-transparent hover:bg-white/10" href="/">Accueil</a>' : ''}
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
              <span class="w-2 h-2 bg-success rounded-full"></span>
              ${user.plan === 'pro' ?
                '<span class="text-xs text-muted">PRO</span>' :
                '<span class="text-xs text-muted">FREE</span>'
            }
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
      <a class="px-4 py-3 rounded-xl font-semibold transition bg-gradient-to-r from-accent to-accent-2 text-slate-900 hover:scale-105 active:scale-95" href="/signup">S'inscrire</a>
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
