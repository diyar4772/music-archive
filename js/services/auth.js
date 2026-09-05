// Authentication Service
import { post } from './api.js';
import { store } from '../state/store.js';
import { STORAGE_KEYS } from '../config.js';
import { showToast } from '../utils.js';
import { t } from './i18n.js';

/**
 * Persist a successful auth response. `store.setToken` writes STORAGE_KEYS.TOKEN,
 * so only the refresh token and username need explicit writes.
 */
function persistSession(data) {
    store.setToken(data.token);
    store.setUser(data.username);
    if (data.refreshToken) {
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
    }
    localStorage.setItem(STORAGE_KEYS.USERNAME, data.username);
}

/**
 * Login user. Returns the failure reason so the caller can surface it in place —
 * the toast helper is a no-op when the page has no #toast element, which silently
 * swallowed every auth error.
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function login(username, password) {
    try {
        persistSession(await post('/login', { username, password }));
        showToast(`✅ ${t('auth.loginSuccess')}`, 'success');
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

/**
 * Register new user.
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function register(username, password) {
    try {
        persistSession(await post('/register', { username, password }));
        showToast(`✅ ${t('auth.registerSuccess')}`, 'success');
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

/**
 * Logout current user
 */
export async function logout() {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (refreshToken) {
        try {
            await post('/logout', { refreshToken });
        } catch (error) {
            console.warn('Server logout failed; clearing the local session.');
        }
    }
    store.setToken(null);
    store.setUser(null);
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USERNAME);

    // Clear user data
    store.setFollowedArtists([]);
    store.setAlbumFollows([]);
    store.setLikedTracks([]);
    store.setPlaylists([]);
    store.setRatings([]);

    showToast(`👋 ${t('auth.loggedOut')}`);
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
    return !!store.token;
}

/**
 * Get current username
 * @returns {string|null}
 */
export function getCurrentUser() {
    return store.user || localStorage.getItem(STORAGE_KEYS.USERNAME);
}

/**
 * Initialize auth state from localStorage
 */
export function initAuth() {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const username = localStorage.getItem(STORAGE_KEYS.USERNAME);

    if (token) {
        store.setToken(token);
        store.setUser(username);
    }
}
