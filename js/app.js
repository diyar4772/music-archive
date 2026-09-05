/**
 * Music Archive Web - Main Application Entry Point
 * Koleksiyoner Arşivi - Web Frontend
 * 
 * Modular SPA architecture with Router and Component-based views
 */

import { store } from './state/store.js';
import { mountShell } from './components/Shell.js';
import { initAuth, isAuthenticated, login, register, logout as authLogout } from './services/auth.js';
import { performSearch } from './services/search.js';
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
import { DigView } from './views/DigView.js';
import { Navbar } from './components/Navbar.js';
import { initToast } from './components/Toast.js';

// Global router instance
let router = null;
let navbar = null;

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
    // The search field belongs to the search screen; SearchView mounts it.

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
        'dig': DigView,
        '*': DashboardView // Default route
    });

    // Make router globally accessible
    window.router = router;

    // The header highlights the active section, so it repaints on every route.
    window.addEventListener('hashchange', () => navbar?.render());

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
        <main class="ma-main">
            <div class="ma-empty">
                <div class="ma-notice-mark" style="margin:0 auto">!</div>
                <div class="ma-empty-title"></div>
                <div class="ma-empty-body"></div>
                <button id="retryBootstrap" class="ma-btn ma-btn-primary" style="margin-top:24px"></button>
            </div>
        </main>`;
    appContainer.querySelector('.ma-empty-title').textContent = t('app.loadFailed');
    appContainer.querySelector('.ma-empty-body').textContent = t('app.loadFailedBody');
    appContainer.querySelector('#retryBootstrap').textContent = t('common.retry');
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
        showToast(`❌ ${t('library.dataFailed')}`, 'error');
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
        router?.handleRoute();
    });

    // Close the suggestion list on an outside click. The profile menu closes
    // itself from inside the Navbar component, which owns it.
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.ma-searchbar')) {
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

    // Two switches, one source of truth. `data-ma-theme` selects the token set in
    // styles.css; the `dark` class is what Tailwind's `dark:` utilities in the
    // older modal markup key off. theme-boot.js sets the same pair before first
    // paint so a light-mode reload does not flash dark.
    document.documentElement.dataset.maTheme = isDark ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', isDark);
    document.body.style.backgroundColor = '';
    document.body.style.color = '';

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = isDark ? '#0A0A0B' : '#FAFAFA';
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
        if (nameInput) nameInput.style.borderColor = 'var(--err)';
        setTimeout(() => { if (nameInput) nameInput.style.borderColor = ''; }, 2000);
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
