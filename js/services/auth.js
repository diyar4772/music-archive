// Authentication Service
import { post } from './api.js';
import { store } from '../state/store.js';
import { STORAGE_KEYS } from '../config.js';
import { showToast } from '../utils.js';

/**
 * Login user
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<boolean>} Success status
 */
export async function login(username, password) {
    try {
        const data = await post('/login', { username, password });

        store.setToken(data.token);
        store.setUser(data.username);
        if (data.refreshToken) {
            localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
        }
        localStorage.setItem(STORAGE_KEYS.USERNAME, data.username);

        showToast('✅ Giriş başarılı!');
        return true;
    } catch (error) {
        showToast('❌ ' + error.message);
        return false;
    }
}

/**
 * Register new user
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<boolean>} Success status
 */
export async function register(username, password) {
    try {
        const data = await post('/register', { username, password });

        store.setToken(data.token);
        store.setUser(data.username);
        if (data.refreshToken) {
            localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
        }
        localStorage.setItem(STORAGE_KEYS.USERNAME, data.username);

        showToast('✅ Kayıt başarılı!');
        return true;
    } catch (error) {
        showToast('❌ ' + error.message);
        return false;
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
    store.setLikedTracks([]);
    store.setPlaylists([]);
    store.setRatings([]);

    showToast('👋 Çıkış yapıldı');
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

