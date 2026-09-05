/**
 * Navbar Component
 * Top navigation bar with logo, theme toggle, and auth section
 */
import { Component } from '../core/Component.js';
import { store } from '../state/store.js';
import { isAuthenticated, getCurrentUser, logout as authLogout } from '../services/auth.js';
import { t, applyTranslations } from '../services/i18n.js';
import { el, replace } from '../core/dom.js';
import { showToast } from '../utils.js';

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
            <div class="w-full max-w-6xl flex justify-between items-center gap-4 mb-8 relative z-50">
                <button type="button" data-lang-aria="nav.home" id="homeButton"
                    class="group flex items-center gap-3 cursor-pointer">
                    <span aria-hidden="true"
                        class="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-green-500 to-emerald-400 flex items-center justify-center shadow-glow-purple transition-transform group-hover:scale-105">
                        <i class="fa-solid fa-compact-disc text-white text-lg"></i>
                    </span>
                    <h1 class="text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight whitespace-nowrap">
                        Music <span class="spotify-green">Archive</span>
                    </h1>
                </button>

                <div class="flex items-center gap-2 sm:gap-3">
                    <!-- Theme Toggle Button -->
                    <button id="themeToggle" type="button"
                        class="w-10 h-10 rounded-full bg-gray-100 dark:bg-surface-elevated hover:bg-gray-200 dark:hover:bg-surface-hover border border-gray-200 dark:border-white/5 flex items-center justify-center text-text-light dark:text-white transition-colors"
                        data-lang-title="nav.toggleTheme" data-lang-aria="nav.toggleTheme">
                        <span id="themeIconMaterial" class="material-icons" aria-hidden="true">brightness_6</span>
                    </button>

                    <div id="authSection" class="relative"></div>
                </div>

                <div id="profileDropdown"
                    class="hidden absolute right-0 top-12 bg-white dark:bg-card-dark w-56 rounded-lg shadow-xl z-50 border border-gray-200 dark:border-white/5">
                    <button data-action="likes"
                        class="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/5 border-b border-gray-200 dark:border-white/5 flex justify-between items-center transition-colors">
                        <span data-lang="library.likedSongs"></span> 
                        <i class="fa-solid fa-heart text-accent-coral"></i>
                    </button>
                    <button data-action="follows"
                        class="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/5 border-b border-gray-200 dark:border-white/5 flex justify-between items-center transition-colors">
                        <span data-lang="library.following"></span> 
                        <i class="fa-solid fa-user text-accent-purple"></i>
                    </button>
                    <button data-action="playlists"
                        class="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/5 border-b border-gray-200 dark:border-white/5 flex justify-between items-center transition-colors">
                        <span data-lang="library.playlists"></span> 
                        <i class="fa-solid fa-music text-accent-teal"></i>
                    </button>
                    <button data-action="create-playlist"
                        class="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/5 border-b border-gray-200 dark:border-white/5 flex justify-between items-center transition-colors">
                        <span data-lang="library.createPlaylist"></span> 
                        <i class="fa-solid fa-plus"></i>
                    </button>
                    <button data-action="settings"
                        class="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/5 border-b border-gray-200 dark:border-white/5 flex justify-between items-center transition-colors">
                        <span data-lang="settings.title"></span> 
                        <i class="fa-solid fa-gear text-gray-400"></i>
                    </button>
                    <button data-action="logout"
                        class="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/5 text-red-400 transition-colors">
                        <span data-lang="common.logout"></span>
                    </button>
                </div>
            </div>
        `);

        this.updateAuthUI(isAuth, user);
        this.attachEventListeners();
        applyTranslations(this.container);
    }

    updateAuthUI(isAuth, user) {
        const authSection = this.querySelector('#authSection');
        if (!authSection) return;

        if (isAuth && user) {
            // `user` is a username the account holder chose; it is text, never markup.
            replace(authSection, el('button', {
                className: 'flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-gray-100 dark:bg-surface-elevated border border-gray-200 dark:border-white/5 hover:bg-gray-200 dark:hover:bg-surface-hover transition-colors',
                attrs: {
                    type: 'button',
                    id: 'profileButton',
                    'aria-haspopup': 'true',
                    'aria-label': `${user} — ${t('nav.accountMenu')}`
                }
            }, [
                el('span', {
                    className: 'bg-gradient-to-br from-green-500 to-emerald-400 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold',
                    attrs: { 'aria-hidden': 'true' },
                    text: user.slice(0, 1).toUpperCase()
                }),
                el('span', { className: 'hidden sm:inline text-sm font-semibold max-w-[10rem] truncate', text: user })
            ]));
        } else {
            replace(authSection, el('button', {
                className: 'btn-spotify text-white font-bold text-sm sm:text-base px-4 sm:px-6 py-2 rounded-full whitespace-nowrap',
                attrs: { type: 'button', id: 'loginButton' },
                text: t('auth.login')
            }));
        }

        // Re-attach event listeners
        this.attachAuthListeners();
    }

    attachEventListeners() {
        const homeButton = this.querySelector('#homeButton');
        if (homeButton) {
            this.addEventListener(homeButton, 'click', () => this.onShowDashboard());
        }

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
            this.addEventListener(loginButton, 'click', () => window.openAuthModal?.());
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
        } catch (error) {
            console.error('Logout error:', error);
            showToast('❌ ' + t('common.error'), 'error');
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
