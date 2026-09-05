import { mountShell } from './components/Shell.js';
import { initDetails } from './components/Details.js';
/**
 * Music Archive Web - Main Application Entry Point
 * Koleksiyoner Arşivi - Web Frontend
 * 
 * Modular SPA architecture with Router and Component-based views
 */

import { store } from './state/store.js';
import { initAuth, isAuthenticated, getCurrentUser, login, register, logout as authLogout } from './services/auth.js';
import { initSearch, setSearchType, performSearch } from './services/search.js';
// Aliased so the bare `createPlaylist` identifier keeps resolving to the global
// modal opener defined below — importing it unaliased would silently change what
// Navbar's onCreatePlaylist callback points at.
import { getLikedTracks, getFollowedArtists, getPlaylists, createPlaylist as createPlaylistRequest } from './services/library.js';
import { getRatings } from './services/rating.js';
import { initMiniPlayer } from './components/MiniPlayer.js';
import { initModals } from './components/Modal.js';
import { initDashboard, showDashboard, renderStatCards, renderRecentlyAdded, renderTopRated } from './components/Dashboard.js';
import { exportToCSV, exportStats } from './components/Export.js';
import { debounce, showToast } from './utils.js';
import { API_URL } from './config.js';
import i18n, { t, changeLanguage, i18nReady } from './services/i18n.js';

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

    mountShell();
    initDetails();

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
            onOpenProfileModal: type => window.openProfileModal(type),
            onCreatePlaylist: () => window.createPlaylist(),
            onOpenSettings: () => window.openSettingsModal()
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

    // Note: Auth UI is now handled by Navbar component
    // updateAuthUI() is no longer needed


    // Initialize dashboard (for backward compatibility)
    initDashboard();

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
            <h2 class="text-2xl font-bold mb-2">Music Archive yüklenemedi</h2>
            <p class="text-text-secondary-light dark:text-text-secondary-dark mb-5">Geçici bir sorun oluştu. Lütfen yeniden deneyin.</p>
            <button id="retryBootstrap" class="btn-spotify text-white font-bold px-6 py-3 rounded-full">Yeniden Dene</button>
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
        renderStatCards();
        renderRecentlyAdded();
        renderTopRated();

    } catch (error) {
        console.error('Failed to fetch user data:', error);
        showToast('❌ Veriler yüklenemedi');
    }
}

/**
 * Update authentication UI (DEPRECATED - Now handled by Navbar component)
 * Kept for backward compatibility with inline handlers
 */
function updateAuthUI() {
    // This function is deprecated - Navbar component handles auth UI
    // Only update if Navbar is not initialized
    if (!navbar) {
        const authSection = document.getElementById('authSection');
        if (!authSection) return;

        const user = getCurrentUser();

        if (user) {
            authSection.innerHTML = `
                <button onclick="document.getElementById('profileDropdown')?.classList.toggle('hidden')" 
                        class="flex items-center gap-2 bg-gray-800 px-3 py-1 rounded-full">
                    <div class="bg-purple-600 w-8 h-8 rounded-full flex items-center justify-center font-bold">
                        ${user[0].toUpperCase()}
                    </div>
                </button>
            `;
        } else {
            authSection.innerHTML = `
                <button onclick="window.openAuthModal?.()" 
                        class="btn-spotify text-white font-bold px-6 py-2 rounded-full">
                    Giriş Yap
                </button>
            `;
        }
    }
}

/**
 * Setup global event listeners
 */
function setupEventListeners() {
    window.addEventListener('auth:session-expired', () => {
        navbar?.render();
        router?.navigate('dashboard');
        showToast('Oturum süresi doldu. Lütfen yeniden giriş yapın.');
    });

    document.addEventListener('languagechange', () => {
        document.documentElement.lang = i18n.language;
        document.querySelectorAll('[data-lang]').forEach(el => { el.textContent = t(el.dataset.lang); });
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

// ============ GLOBAL FUNCTIONS FOR BACKWARD COMPATIBILITY ============
// These are needed during the transition period while inline handlers exist

window.performSearch = (query) => {
    if (query) {
        if (router) {
            router.navigate(`search?q=${encodeURIComponent(query)}&type=${store.searchType}`);
        } else {
            performSearch(query);
        }
    } else {
        performSearch();
    }
};

window.setSearchType = setSearchType;
window.showDashboard = () => {
    if (router) {
        router.navigate('dashboard');
    } else {
        showDashboard();
    }
};
window.showToast = showToast;
window.exportToCSV = exportToCSV;
window.exportStats = exportStats;
window.store = store;
window.API_URL = API_URL;

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
    if (title) title.textContent = isLogin ? 'Giriş Yap' : 'Kayıt Ol';
    if (switcher) switcher.textContent = isLogin ? 'Hesabın yok mu? Kayıt ol' : 'Hesabın var mı? Giriş yap';
    if (submit) submit.textContent = isLogin ? 'Giriş Yap' : 'Kayıt Ol';
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
        setAuthError('Kullanıcı adı ve parola gerekli.');
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
            setAuthError(result.error || 'İşlem başarısız. Lütfen tekrar deneyin.');
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

// Theme toggle (needs to be defined)
window.toggleTheme = toggleTheme;
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

// Modal functions (placeholders - should be implemented)
window.openProfileModal = (type) => {
    if (router) {
        router.navigate(`library?type=${type}`);
    }
};

window.createPlaylist = () => {
    // This should open create playlist modal
    const modal = document.getElementById('createPlaylistModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
};

// The create-playlist modal still lives in index.html and its confirm button is
// wired to the legacy handler. Route it through the modular library service so it
// uses the current access token and the single refresh authority in api.js.
window.confirmCreatePlaylist = async () => {
    const nameInput = document.getElementById('newPlaylistName');
    const name = nameInput?.value.trim() || '';
    if (!name) {
        nameInput?.classList.add('ring-2', 'ring-red-500');
        setTimeout(() => nameInput?.classList.remove('ring-2', 'ring-red-500'), 2000);
        return;
    }

    const created = await createPlaylistRequest(name);
    if (!created) return;

    if (nameInput) nameInput.value = '';
    document.getElementById('createPlaylistModal')?.classList.add('hidden');
    router?.navigate('dashboard');
};

window.changeLanguage = changeLanguage;
window.closeSettingsModal = () => window.closeModal('settingsModal');
window.closeCreatePlaylistModal = () => window.closeModal('createPlaylistModal');
window.openSettingsModal = () => {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        document.getElementById('languageSelect').value = i18n.language;
        modal.classList.remove('hidden');
    }
};

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
