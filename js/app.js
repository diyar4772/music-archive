/**
 * Music Archive Web - Main Application Entry Point
 * Koleksiyoner Arşivi - Web Frontend
 * 
 * Modular SPA architecture with Router and Component-based views
 */

import { store } from './state/store.js';
import { mountShell } from './components/Shell.js';
import { initAuth, isAuthenticated, login, register, logout as authLogout } from './services/auth.js';
import { initSearch, performSearch } from './services/search.js';
// Aliased so the bare `createPlaylist` identifier keeps resolving to the global
// modal opener defined below — importing it unaliased would silently change what
// Navbar's onCreatePlaylist callback points at.
import { getLikedTracks, getFollowedArtists, getPlaylists, createPlaylist as createPlaylistRequest } from './services/library.js';
import { getRatings } from './services/rating.js';
import { initMiniPlayer } from './components/MiniPlayer.js';
import { initModals, openModal, closeModal } from './components/Modal.js';
import { renderRecentlyAdded, renderTopRated } from './components/Dashboard.js';
import { showToast } from './utils.js';
import i18n, { t, changeLanguage, i18nReady, applyTranslations } from './services/i18n.js';

// Router and Views
import { Router } from './core/Router.js';
import { DashboardView } from './views/DashboardView.js';
import { SearchView } from './views/SearchView.js';
import { LibraryView } from './views/LibraryView.js';
import { Navbar } from './components/Navbar.js';
import { SearchBar } from './components/SearchBar.js';
import { initToast } from './components/Toast.js';

// Global router instance
let router = null;
let navbar = null;
let searchBar = null;

/**
 * Initialize the application
 */
async function initApp() {
    console.log('🎵 Music Archive Web - Initializing...');

    // Initialize toast system
    initToast();

    // Initialize auth
    initAuth();

    mountShell({
        onToggleTheme: toggleTheme,
        onChangeLanguage: changeLanguage,
        onConfirmCreatePlaylist: confirmCreatePlaylist
    });

    // Initialize UI components
    initModals();
    initAuthModal();
    initMiniPlayer();
    // Note: Search is initialized by SearchBar component or fallback below

    // Wait for DOM to be fully ready
    const appContainer = document.getElementById('app');
    if (!appContainer) {
        console.error('App container not found! Make sure <div id="app"></div> exists in HTML');
        return;
    }

    // Load user data if authenticated
    if (isAuthenticated()) {
        await fetchUserData();
    }

    // Initialize Router first (needed by other components)
    router = new Router({
        'dashboard': DashboardView,
        'search': SearchView,
        'library': LibraryView,
        '*': DashboardView // Default route
    });

    // Make router globally accessible
    window.router = router;

    // Initialize Navbar
    const navbarContainer = document.getElementById('navbar');
    if (navbarContainer) {
        console.log('[App] Initializing Navbar...');
        navbar = new Navbar(navbarContainer, {
            onLogout: handleLogout,
            onShowDashboard: () => router?.navigate('dashboard'),
            onToggleTheme: toggleTheme,
            onOpenProfileModal: openProfileModal,
            onCreatePlaylist: createPlaylist,
            onOpenSettings: openSettingsModal
        });
        navbar.mount();
        console.log('[App] Navbar initialized');
    } else {
        console.warn('[App] Navbar container not found');
    }

    // Initialize SearchBar
    const searchBarContainer = document.getElementById('searchBar');
    if (searchBarContainer) {
        console.log('[App] Initializing SearchBar...');
        searchBar = new SearchBar(searchBarContainer, {
            router: router,
            onSearch: (query) => {
                if (router) {
                    router.navigate(`search?q=${encodeURIComponent(query)}&type=${store.searchType}`);
                }
            }
        });
        searchBar.mount();
        console.log('[App] SearchBar initialized');
    } else {
        console.warn('[App] SearchBar container not found, using fallback');
        // Fallback: SearchBar might be in HTML, initialize search service
        initSearch();
    }

    // Setup global event listeners
    setupEventListeners();

    // Apply saved settings
    applySettings();

    console.log('✅ Music Archive Web - Ready!');
}

function renderStartupError() {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;
    appContainer.innerHTML = `
        <section class="w-full max-w-2xl mx-auto bg-white dark:bg-card-dark rounded-2xl p-8 text-center shadow-sm">
            <i class="fa-solid fa-triangle-exclamation text-3xl text-amber-500 mb-4"></i>
            <h2 class="text-2xl font-bold mb-2">${t('app.loadFailed')}</h2>
            <p class="text-text-secondary-light dark:text-text-secondary-dark mb-5">${t('app.loadFailedBody')}</p>
            <button id="retryBootstrap" class="btn-spotify text-white font-bold px-6 py-3 rounded-full">${t('common.retry')}</button>
        </section>`;
    document.getElementById('retryBootstrap')?.addEventListener('click', () => window.location.reload());
}

/**
 * Handle logout
 */
async function handleLogout() {
    await authLogout();
    if (router) {
        router.navigate('dashboard');
    }
    // Auth UI is updated by Navbar component automatically
    if (navbar) {
        navbar.render();
    }
}

/**
 * Fetch all user data from API
 */
async function fetchUserData() {
    try {
        // Fetch all data in parallel
        await Promise.all([
            getLikedTracks(),
            getFollowedArtists(),
            getPlaylists(),
            getRatings()
        ]);

        // Refresh UI
        renderRecentlyAdded();
        renderTopRated();

    } catch (error) {
        console.error('Failed to fetch user data:', error);
        showToast('❌ ' + t('library.dataFailed'), 'error');
    }
}

/**
 * Setup global event listeners
 */
function setupEventListeners() {
    window.addEventListener('auth:session-expired', () => {
        navbar?.render();
        router?.navigate('dashboard');
        showToast(t('auth.sessionExpired'), 'warning');
    });

    // A language switch has to repaint everything, not just the handful of
    // elements carrying data-lang: most view text is produced in JavaScript.
    document.addEventListener('languagechange', () => {
        applyTranslations(document);
        navbar?.render();
        searchBar?.render();
        router?.handleRoute();
    });

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#authSection')) {
            document.getElementById('profileDropdown')?.classList.add('hidden');
        }
        if (!e.target.closest('.w-full.max-w-xl')) {
            document.getElementById('autocompleteList')?.classList.add('hidden');
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+K or Cmd+K for search focus
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('searchInput')?.focus();
        }

        // Escape to close modals
        if (e.key === 'Escape') {
            const visibleModals = document.querySelectorAll('.modal.visible');
            visibleModals.forEach(modal => {
                modal.classList.remove('visible');
                setTimeout(() => modal.classList.add('hidden'), 300);
            });
        }
    });
}

/**
 * Apply saved settings (theme, language)
 */
function applySettings() {
    const theme = localStorage.getItem('theme') || 'dark';

    // Seed the store too, otherwise the first toggle after a reload computes the next
    // theme from an undefined value and re-applies the one already showing.
    store.currentTheme = theme;
    applyTheme(theme);
    // Language could be applied here too
}

/**
 * Apply theme
 */
function applyTheme(theme) {
    const isDark = theme !== 'light';

    // Tailwind runs in darkMode:"class", so the `dark` class on <html> is what every
    // `dark:` utility keys off. The previous implementation only wrote inline colours
    // on <body> and left that class alone, which left light mode with dark cards on a
    // light page. Clear those inline overrides so the utilities decide.
    document.documentElement.classList.toggle('dark', isDark);
    document.body.style.backgroundColor = '';
    document.body.style.color = '';
    document.body.classList.toggle('light-mode', !isDark);

    const icon = document.getElementById('themeIconMaterial');
    if (icon) icon.textContent = isDark ? 'dark_mode' : 'light_mode';
}

// ============ CROSS-MODULE ENTRY POINTS ============
// Views reach these by name rather than importing app.js, which would be a
// cycle. Nothing here is an inline HTML handler any more.

window.performSearch = (query) => {
    if (!query) return performSearch();
    return router
        ? router.navigate(`search?q=${encodeURIComponent(query)}&type=${store.searchType}`)
        : performSearch(query);
};

window.showToast = showToast;
window.openProfileModal = openProfileModal;
window.createPlaylist = createPlaylist;

// --- Auth modal ---------------------------------------------------------
// The modal is owned here only. Mode lives in an explicit variable rather than
// being read back from the heading text, and submission goes through the form's
// single submit listener so Enter works like the button.
let authMode = 'login';
let authSubmitting = false;

const setAuthError = (message) => {
    const box = document.getElementById('authError');
    if (!box) return;
    if (message) {
        box.textContent = message;
        box.classList.remove('hidden');
    } else {
        box.textContent = '';
        box.classList.add('hidden');
    }
};

const updateAuthModal = () => {
    const isLogin = authMode === 'login';
    const title = document.getElementById('authTitle');
    const switcher = document.getElementById('authSwitch');
    const submit = document.getElementById('authSubmit');
    const password = document.getElementById('authPassword');
    if (title) title.textContent = isLogin ? t('auth.login') : t('auth.register');
    if (switcher) switcher.textContent = isLogin ? t('auth.needAccount') : t('auth.haveAccount');
    if (submit) submit.textContent = isLogin ? t('auth.login') : t('auth.register');
    if (password) password.autocomplete = isLogin ? 'current-password' : 'new-password';
};

window.openAuthModal = (mode = 'login') => {
    authMode = mode === 'register' ? 'register' : 'login';
    setAuthError(null);
    updateAuthModal();
    const modal = document.getElementById('authModal');
    modal?.classList.remove('hidden');
    requestAnimationFrame(() => modal?.classList.add('visible'));
    document.getElementById('authUsername')?.focus();
};

window.closeAuthModal = () => {
    const modal = document.getElementById('authModal');
    modal?.classList.remove('visible');
    setTimeout(() => modal?.classList.add('hidden'), 300);
};

async function submitAuth(event) {
    event.preventDefault();
    if (authSubmitting) return; // guards double click and Enter-while-pending

    const usernameInput = document.getElementById('authUsername');
    const passwordInput = document.getElementById('authPassword');
    const submitButton = document.getElementById('authSubmit');
    const username = usernameInput?.value.trim() || '';
    const password = passwordInput?.value || '';

    setAuthError(null);
    if (!username || !password) {
        // Fail locally: no point spending a request or a rate-limit slot.
        setAuthError(t('auth.missingFields'));
        (username ? passwordInput : usernameInput)?.focus();
        return;
    }

    authSubmitting = true;
    if (submitButton) submitButton.disabled = true;
    try {
        const result = authMode === 'login'
            ? await login(username, password)
            : await register(username, password);

        if (!result.ok) {
            setAuthError(result.error || t('auth.failed'));
            return; // modal stays open
        }

        if (passwordInput) passwordInput.value = '';
        setAuthError(null);
        window.closeAuthModal();
        navbar?.render();
        await fetchUserData();
        router?.navigate('dashboard');
    } finally {
        authSubmitting = false;
        if (submitButton) submitButton.disabled = false;
    }
}

function initAuthModal() {
    document.getElementById('authForm')?.addEventListener('submit', submitAuth);
    document.getElementById('authSwitch')?.addEventListener('click', () => {
        authMode = authMode === 'login' ? 'register' : 'login';
        setAuthError(null);
        updateAuthModal();
    });
    document.getElementById('authClose')?.addEventListener('click', () => window.closeAuthModal());
    updateAuthModal();
}

function toggleTheme() {
    const currentTheme = store.currentTheme || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    store.currentTheme = newTheme;
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
    
    // Update navbar if it exists
    if (navbar) {
        navbar.render();
    }
}

/**
 * Open the library view filtered to one collection.
 * @param {'likes'|'follows'|'playlists'} type
 */
function openProfileModal(type) {
    router?.navigate(`library?type=${type}`);
}

/** Open the create-playlist modal with the name field focused and empty. */
function createPlaylist() {
    const nameInput = document.getElementById('newPlaylistName');
    if (nameInput) nameInput.value = '';
    openModal('createPlaylistModal');
    requestAnimationFrame(() => nameInput?.focus());
}

/**
 * Create the playlist named in the modal. Goes through the library service so
 * it uses the current access token and the single refresh authority in api.js.
 */
async function confirmCreatePlaylist() {
    const nameInput = document.getElementById('newPlaylistName');
    const name = nameInput?.value.trim() || '';
    if (!name) {
        nameInput?.classList.add('ring-2', 'ring-red-500');
        setTimeout(() => nameInput?.classList.remove('ring-2', 'ring-red-500'), 2000);
        nameInput?.focus();
        return;
    }

    const created = await createPlaylistRequest(name);
    if (!created) return;

    if (nameInput) nameInput.value = '';
    closeModal('createPlaylistModal');
    router?.navigate('library?type=playlists');
}

/** Open settings with the language select showing the active language. */
function openSettingsModal() {
    const select = document.getElementById('languageSelect');
    if (select) select.value = i18n.language;
    openModal('settingsModal');
}

async function bootstrap() {
    try {
        await i18nReady;
        await initApp();
    } catch (error) {
        console.error('Music Archive bootstrap failed:', error);
        renderStartupError();
    }
}

// The modular application is the only automatic bootstrap owner.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
    bootstrap();
}
