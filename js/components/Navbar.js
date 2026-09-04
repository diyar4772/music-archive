/**
 * Navbar Component
 * Top navigation bar with logo, theme toggle, and auth section
 */
import { Component } from '../core/Component.js';
import { store } from '../state/store.js';
import { isAuthenticated, getCurrentUser, logout as authLogout } from '../services/auth.js';
import { t } from '../services/i18n.js';

export class Navbar extends Component {
    constructor(container, props = {}) {
        super(container, props);
        this.onLogout = props.onLogout || (() => {});
        this.onShowDashboard = props.onShowDashboard || (() => {});
        this.onToggleTheme = props.onToggleTheme || (() => {});
        this.onOpenProfileModal = props.onOpenProfileModal || (() => {});
        this.onCreatePlaylist = props.onCreatePlaylist || (() => {});
        this.onOpenSettings = props.onOpenSettings || (() => {});
    }

    render() {
        const user = getCurrentUser();
        const isAuth = isAuthenticated();

        this.setHTML(`
            <div class="w-full max-w-6xl flex justify-between items-center mb-6 relative z-50">
                <h1 class="text-3xl font-bold cursor-pointer" onclick="window.router?.navigate('dashboard')">
                    Music <span class="spotify-green">Library</span>
                </h1>

                <div class="flex items-center gap-3">
                    <!-- Theme Toggle Button -->
                    <button id="themeToggle" 
                        class="w-10 h-10 rounded-full bg-gray-200 dark:bg-[#2A2A2A] hover:bg-gray-300 dark:hover:bg-[#3E3E3E] flex items-center justify-center text-text-light dark:text-white transition-colors"
                        title="Toggle Theme">
                        <span id="themeIconMaterial" class="material-icons">brightness_6</span>
                    </button>

                    <div id="authSection" class="relative"></div>
                </div>

                <div id="profileDropdown"
                    class="hidden absolute right-0 top-12 bg-white dark:bg-card-dark w-56 rounded-lg shadow-xl z-50 border border-gray-200 dark:border-white/5">
                    <button data-action="likes"
                        class="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/5 border-b border-gray-200 dark:border-white/5 flex justify-between items-center transition-colors">
                        <span data-lang="library.likedSongs">Beğenilen Şarkılar</span> 
                        <i class="fa-solid fa-heart text-accent-coral"></i>
                    </button>
                    <button data-action="follows"
                        class="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/5 border-b border-gray-200 dark:border-white/5 flex justify-between items-center transition-colors">
                        <span data-lang="library.following">Takip Edilenler</span> 
                        <i class="fa-solid fa-user text-accent-purple"></i>
                    </button>
                    <button data-action="playlists"
                        class="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/5 border-b border-gray-200 dark:border-white/5 flex justify-between items-center transition-colors">
                        <span data-lang="library.playlists">Listelerim</span> 
                        <i class="fa-solid fa-music text-accent-teal"></i>
                    </button>
                    <button data-action="create-playlist"
                        class="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/5 border-b border-gray-200 dark:border-white/5 flex justify-between items-center transition-colors">
                        <span data-lang="library.createPlaylist">Liste Oluştur</span> 
                        <i class="fa-solid fa-plus"></i>
                    </button>
                    <button data-action="settings"
                        class="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/5 border-b border-gray-200 dark:border-white/5 flex justify-between items-center transition-colors">
                        <span data-lang="settings.title">Ayarlar</span> 
                        <i class="fa-solid fa-gear text-gray-400"></i>
                    </button>
                    <button data-action="logout"
                        class="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/5 text-red-400 transition-colors">
                        <span data-lang="common.logout">Çıkış Yap</span>
                    </button>
                </div>
            </div>
        `);

        this.updateAuthUI(isAuth, user);
        this.attachEventListeners();
    }

    updateAuthUI(isAuth, user) {
        const authSection = this.querySelector('#authSection');
        if (!authSection) return;

        if (isAuth && user) {
            authSection.innerHTML = `
                <button id="profileButton" 
                    class="flex items-center gap-2 bg-gray-800 px-3 py-1 rounded-full">
                    <div class="bg-purple-600 w-8 h-8 rounded-full flex items-center justify-center font-bold">
                        ${user[0].toUpperCase()}
                    </div>
                </button>
            `;
        } else {
            // Use fallback text if i18n not ready
            const loginText = typeof t === 'function' ? t('auth.login') : 'Giriş Yap';
            authSection.innerHTML = `
                <button id="loginButton" 
                    class="btn-spotify text-black font-bold px-6 py-2 rounded-full">
                    ${loginText}
                </button>
            `;
        }

        // Re-attach event listeners
        this.attachAuthListeners();
    }

    attachEventListeners() {
        // Theme toggle
        const themeToggle = this.querySelector('#themeToggle');
        if (themeToggle) {
            this.addEventListener(themeToggle, 'click', () => {
                this.onToggleTheme();
            });
        }

        // Profile dropdown buttons
        const dropdownButtons = this.querySelectorAll('#profileDropdown button[data-action]');
        dropdownButtons.forEach(btn => {
            const action = btn.getAttribute('data-action');
            this.addEventListener(btn, 'click', (e) => {
                e.stopPropagation();
                this.handleDropdownAction(action);
            });
        });

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            if (!this.container?.contains(e.target)) {
                const dropdown = this.querySelector('#profileDropdown');
                if (dropdown) {
                    dropdown.classList.add('hidden');
                }
            }
        });
    }

    attachAuthListeners() {
        const profileButton = this.querySelector('#profileButton');
        const loginButton = this.querySelector('#loginButton');

        if (profileButton) {
            this.addEventListener(profileButton, 'click', (e) => {
                e.stopPropagation();
                const dropdown = this.querySelector('#profileDropdown');
                if (dropdown) {
                    dropdown.classList.toggle('hidden');
                }
            });
        }

        if (loginButton) {
            this.addEventListener(loginButton, 'click', () => {
                // Open auth modal - this should be handled by parent
                if (window.openAuthModal) {
                    window.openAuthModal();
                }
            });
        }
    }

    handleDropdownAction(action) {
        const dropdown = this.querySelector('#profileDropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
        }

        switch (action) {
            case 'likes':
            case 'follows':
            case 'playlists':
                this.onOpenProfileModal(action);
                break;
            case 'create-playlist':
                this.onCreatePlaylist();
                break;
            case 'settings':
                this.onOpenSettings();
                break;
            case 'logout':
                this.handleLogout();
                break;
        }
    }

    async handleLogout() {
        try {
            await authLogout();
            this.onLogout();
            this.updateAuthUI(false, null);
            if (window.showToast) {
                window.showToast('✅ Çıkış yapıldı');
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    onMount() {
        // Subscribe to auth state changes
        this.unsubscribeUser = store.subscribe('user', (user) => {
            this.updateAuthUI(!!user, user);
        });

        // Initial render
        const isAuth = isAuthenticated();
        const user = getCurrentUser();
        this.updateAuthUI(isAuth, user);
    }

    onUnmount() {
        if (this.unsubscribeUser) {
            this.unsubscribeUser();
        }
    }
}
