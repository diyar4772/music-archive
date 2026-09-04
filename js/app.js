/**
 * Music Archive Web - Main Application Entry Point
 * Koleksiyoner Arşivi - Web Frontend
 * 
 * Modular SPA architecture with Router and Component-based views
 */

import { store } from './state/store.js';
import { initAuth, isAuthenticated, getCurrentUser, logout as authLogout } from './services/auth.js';
import { initSearch, setSearchType, performSearch } from './services/search.js';
import { getLikedTracks, getFollowedArtists, getPlaylists } from './services/library.js';
import { getRatings } from './services/rating.js';
import { initMiniPlayer } from './components/MiniPlayer.js';
import { initModals } from './components/Modal.js';
import { initDashboard, showDashboard, renderStatCards, renderRecentlyAdded, renderTopRated } from './components/Dashboard.js';
import { exportToCSV, exportStats } from './components/Export.js';
import { debounce, showToast } from './utils.js';
import { API_URL } from './config.js';
import i18n, { t, changeLanguage } from './services/i18n.js';

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

    // Initialize UI components
    initModals();
    initMiniPlayer();
    // Note: Search is initialized by SearchBar component or fallback below

    // Wait for DOM to be fully ready
    const appContainer = document.getElementById('app');
    if (!appContainer) {
        console.error('App container not found! Make sure <div id="app"></div> exists in HTML');
        return;
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

    // Note: Auth UI is now handled by Navbar component
    // updateAuthUI() is no longer needed

    // Load user data if authenticated
    if (isAuthenticated()) {
        await fetchUserData();
    }

    // Initialize dashboard (for backward compatibility)
    initDashboard();

    // Setup global event listeners
    setupEventListeners();

    // Apply saved settings
    applySettings();

    console.log('✅ Music Archive Web - Ready!');
}

/**
 * Handle logout
 */
function handleLogout() {
    authLogout();
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
                        class="btn-spotify text-black font-bold px-6 py-2 rounded-full">
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
    const lang = localStorage.getItem('lang') || 'tr';

    applyTheme(theme);
    // Language could be applied here too
}

/**
 * Apply theme
 */
function applyTheme(theme) {
    const body = document.body;

    if (theme === 'light') {
        body.style.backgroundColor = '#f3f4f6';
        body.style.color = '#1f2937';
        body.classList.add('light-mode');
    } else {
        body.style.backgroundColor = '#121212';
        body.style.color = 'white';
        body.classList.remove('light-mode');
    }
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

window.openSettingsModal = () => {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
