class AuthHeader {
  constructor() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  async init() {
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

  getAvatarHTML(user, size = 'small') {
    const sizeClasses = {
      small: 'w-8 h-8 text-sm',
      large: 'w-12 h-12 text-lg'
    };

    const sizeClass = sizeClasses[size] || sizeClasses.small;

    if (user.avatar_path) {
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
      <!-- Desktop Navigation -->
      <div class="hidden md:flex items-center gap-3">
        ${currentPath !== '/' ? 
          '<a class="px-4 py-3 rounded-xl font-semibold transition border border-white/15 text-text bg-transparent hover:bg-white/10" href="/">Accueil</a>' : ''}
        <a class="px-4 py-3 rounded-xl font-semibold transition border border-white/15 text-text bg-transparent hover:bg-white/10" href="/history">Historique</a>
        
        <!-- Desktop Profile Dropdown -->
        <div class="relative" id="profileDropdown">
          <button id="profileBtn" class="flex items-center gap-3 px-4 py-2 rounded-xl font-semibold transition border border-white/15 text-text bg-transparent hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-accent/50">
            <div class="flex-shrink-0">
              ${this.getAvatarHTML(user, 'small')}
            </div>
            <div class="flex flex-col items-start">
              <span class="text-sm font-medium">${this.capitalize(user.username)}</span>
            </div>
            <svg id="chevron" class="w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>

          <!-- Desktop Dropdown Menu -->
          <div id="profileMenu" class="absolute right-0 mt-2 w-64 bg-panel border border-white/10 rounded-xl shadow-neon backdrop-blur-lg z-50 opacity-0 invisible transform scale-95 transition-all duration-200 origin-top-right">
            <div class="px-4 py-3 border-b border-white/10">
              <div class="flex items-center gap-3">
                <div class="flex-shrink-0">
                  ${this.getAvatarHTML(user, 'large')}
                </div>
                <div class="flex-grow min-w-0">
                  <div class="font-medium text-text truncate">${this.capitalize(user.username)}</div>
                  <div class="text-xs text-muted truncate">${user.email}</div>
                </div>
              </div>
            </div>

            <div class="py-2">
              <a href="/profile" class="flex items-center gap-3 px-4 py-2 text-sm text-text hover:bg-white/5 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
                Mon Profil
              </a>
              <a href="/contact" class="flex items-center gap-3 px-4 py-2 text-sm text-text hover:bg-white/5 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                  <path d="M12 17h.01"/>
                </svg>
                Support
              </a>
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
      </div>

      <!-- Mobile Navigation -->
      <div class="md:hidden flex items-center gap-3">
        <!-- Mobile Profile Avatar -->
        <div class="flex-shrink-0">
          ${this.getAvatarHTML(user, 'small')}
        </div>

        <!-- Mobile Menu Button -->
        <button id="mobileMenuBtn" class="p-2 rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50">
          <svg id="hamburger" class="w-6 h-6 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
          <svg id="close" class="w-6 h-6 transition-transform duration-200 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Mobile Dropdown Menu -->
      <div id="mobileMenu" class="md:hidden absolute top-full left-0 right-0 mt-2 bg-panel border border-white/10 rounded-xl shadow-neon backdrop-blur-lg z-50 opacity-0 invisible transform -translate-y-2 transition-all duration-300">
        <!-- User Info Header -->
        <div class="px-4 py-3 border-b border-white/10">
          <div class="flex items-center gap-3">
            <div class="flex-shrink-0">
              ${this.getAvatarHTML(user, 'large')}
            </div>
            <div class="flex-grow min-w-0">
              <div class="font-medium text-text truncate">${this.capitalize(user.username)}</div>
              <div class="text-xs text-muted truncate">${user.email}</div>
            </div>
          </div>
        </div>

        <!-- Mobile Menu Items -->
        <div class="py-2">
          ${currentPath !== '/' ? 
            `<a href="/" class="flex items-center gap-3 px-4 py-3 text-sm text-text hover:bg-white/5 transition-colors border-b border-white/5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
              </svg>
              Accueil
            </a>` : ''}
          <a href="/history" class="flex items-center gap-3 px-4 py-3 text-sm text-text hover:bg-white/5 transition-colors border-b border-white/5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            Historique
          </a>
          <a href="/profile" class="flex items-center gap-3 px-4 py-3 text-sm text-text hover:bg-white/5 transition-colors border-b border-white/5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
            Mon Profil
          </a>
          <a href="/contact" class="flex items-center gap-3 px-4 py-3 text-sm text-text hover:bg-white/5 transition-colors border-b border-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <path d="M12 17h.01"/>
            </svg>
            Support
          </a>
          <button id="mobileLogoutBtn" class="flex items-center gap-3 px-4 py-3 text-sm text-danger hover:bg-danger/10 transition-colors w-full text-left">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
            </svg>
            Déconnexion
          </button>
        </div>
      </div>
    `;

    this.setupDropdownEvents();
    this.setupMobileEvents();
  }

  renderGuestNav(container) {
    container.innerHTML = `
      <!-- Desktop Guest Navigation -->
      <div class="hidden md:flex items-center gap-3">
        <a class="px-4 py-3 rounded-xl font-semibold transition border border-white/15 text-text bg-transparent hover:bg-white/10" href="/login">Connexion</a>
        <a href="/signup" class="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold bg-gradient-to-r from-accent to-accent-2 text-slate-900 shadow-neon transition-all duration-200 border border-accent-2/40 hover:scale-105 hover:shadow-lg hover:-translate-y-0.5 active:scale-97 focus:outline-none focus:ring-2 focus:ring-accent-2/60">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          S'inscrire
        </a>
      </div>

      <!-- Mobile Guest Navigation -->
      <div class="md:hidden flex items-center gap-3">
        <a class="px-3 py-2 text-sm rounded-lg font-semibold transition border border-white/15 text-text bg-transparent hover:bg-white/10" href="/login">Connexion</a>
        <a href="/signup" class="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg font-semibold bg-gradient-to-r from-accent to-accent-2 text-slate-900 transition-all duration-200 hover:scale-105">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          S'inscrire
        </a>
      </div>
    `;
  }

  setupDropdownEvents() {
    const profileBtn = document.getElementById('profileBtn');
    const profileMenu = document.getElementById('profileMenu');
    const chevron = document.getElementById('chevron');
    const logoutBtn = document.getElementById('dropdownLogoutBtn');

    if (!profileBtn || !profileMenu) return;

    let isOpen = false;

    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isOpen = !isOpen;
      this.toggleDropdown(profileMenu, chevron, isOpen);
    });

    document.addEventListener('click', (e) => {
      if (!profileBtn.contains(e.target) && !profileMenu.contains(e.target)) {
        isOpen = false;
        this.toggleDropdown(profileMenu, chevron, false);
      }
    });

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) {
        isOpen = false;
        this.toggleDropdown(profileMenu, chevron, false);
      }
    });
  }

  setupMobileEvents() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const hamburger = document.getElementById('hamburger');
    const closeIcon = document.getElementById('close');
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');

    if (!mobileMenuBtn || !mobileMenu) return;

    let isMobileOpen = false;

    mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isMobileOpen = !isMobileOpen;
      this.toggleMobileMenu(mobileMenu, hamburger, closeIcon, isMobileOpen);
    });

    document.addEventListener('click', (e) => {
      if (!mobileMenuBtn.contains(e.target) && !mobileMenu.contains(e.target)) {
        isMobileOpen = false;
        this.toggleMobileMenu(mobileMenu, hamburger, closeIcon, false);
      }
    });

    if (mobileLogoutBtn) {
      mobileLogoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // Close on navigation
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        isMobileOpen = false;
        this.toggleMobileMenu(mobileMenu, hamburger, closeIcon, false);
      });
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

  toggleMobileMenu(menu, hamburger, closeIcon, isOpen) {
    if (isOpen) {
      menu.classList.remove('opacity-0', 'invisible', '-translate-y-2');
      menu.classList.add('opacity-100', 'visible', 'translate-y-0');
      hamburger.classList.add('hidden');
      closeIcon.classList.remove('hidden');
    } else {
      menu.classList.add('opacity-0', 'invisible', '-translate-y-2');
      menu.classList.remove('opacity-100', 'visible', 'translate-y-0');
      hamburger.classList.remove('hidden');
      closeIcon.classList.add('hidden');
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

window.AuthHeader = AuthHeader;
