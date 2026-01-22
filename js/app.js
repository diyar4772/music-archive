/**
 * Music Archive Web - Main Application Entry Point
 * Koleksiyoner Arşivi - Web Frontend
 * 
 * This is the modular version of the application.
 * All functionality is split into separate modules for better maintainability.
 */

import { store } from './state/store.js';
import { initAuth, isAuthenticated, getCurrentUser } from './services/auth.js';
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

/**
 * Initialize the application
 */
async function initApp() {
    console.log('🎵 Music Archive Web - Initializing...');

    // Initialize auth
    initAuth();

    // Initialize UI components
    initModals();
    initMiniPlayer();
    initSearch();

    // Update auth UI
    updateAuthUI();

    // Load user data if authenticated
    if (isAuthenticated()) {
        await fetchUserData();
    }

    // Initialize dashboard
    initDashboard();

    // Setup global event listeners
    setupEventListeners();

    // Apply saved settings
    applySettings();

    console.log('✅ Music Archive Web - Ready!');
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
 * Update authentication UI
 */
function updateAuthUI() {
    const authSection = document.getElementById('authSection');
    if (!authSection) return;

    const user = getCurrentUser();

    if (user) {
        authSection.innerHTML = `
            <button onclick="document.getElementById('profileDropdown').classList.toggle('hidden')" 
                    class="flex items-center gap-2 bg-gray-800 px-3 py-1 rounded-full">
                <div class="bg-purple-600 w-8 h-8 rounded-full flex items-center justify-center font-bold">
                    ${user[0].toUpperCase()}
                </div>
            </button>
        `;
    } else {
        authSection.innerHTML = `
            <button onclick="openAuthModal()" 
                    class="btn-spotify text-black font-bold px-6 py-2 rounded-full">
                Giriş Yap
            </button>
        `;
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

// ============ EXPORTS FOR GLOBAL ACCESS ============
// These are needed during the transition period while inline handlers exist

window.performSearch = performSearch;
window.setSearchType = setSearchType;
window.showDashboard = showDashboard;
window.showToast = showToast;
window.exportToCSV = exportToCSV;
window.exportStats = exportStats;
window.store = store;
window.API_URL = API_URL;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
