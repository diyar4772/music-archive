// API Service - Centralized fetch wrapper
import { API_URL } from '../config.js';
import { store } from '../state/store.js';
import { STORAGE_KEYS } from '../config.js';

let refreshRequest = null;

function clearSession() {
    store.setToken(null);
    store.setUser(null);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USERNAME);
    window.dispatchEvent(new CustomEvent('auth:session-expired'));
}

async function refreshAccessToken() {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) return false;

    if (!refreshRequest) {
        refreshRequest = fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        }).then(async response => {
            if (!response.ok) return false;
            const data = await response.json();
            if (typeof data.token !== 'string' || typeof data.refreshToken !== 'string') return false;
            store.setToken(data.token);
            localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
            return true;
        }).catch(() => false).finally(() => {
            refreshRequest = null;
        });
    }

    const refreshed = await refreshRequest;
    if (!refreshed) clearSession();
    return refreshed;
}

/**
 * Generic API fetch wrapper with auth headers
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {Object} options - Fetch options
 * @returns {Promise<any>} Parsed JSON response
 */
export async function fetchAPI(endpoint, options = {}) {
    const token = store.token || localStorage.getItem('userToken');

    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    const isAuthEndpoint = ['/login', '/register', '/auth/refresh', '/logout'].includes(endpoint);
    if (response.status === 401 && !options._retried && !isAuthEndpoint && await refreshAccessToken()) {
        return fetchAPI(endpoint, { ...options, _retried: true });
    }

    if (!response.ok) {
        const errorText = await response.text();
        let message = `Server Error (${response.status}): ${response.statusText}`;
        try {
            const errorJson = JSON.parse(errorText);
            message = errorJson.error || message;
        } catch {}
        throw new Error(message);
    }

    return response.json();
}

/**
 * GET request helper
 * @param {string} endpoint - API endpoint
 * @returns {Promise<any>} Response data
 */
export async function get(endpoint) {
    return fetchAPI(endpoint, { method: 'GET' });
}

/**
 * POST request helper
 * @param {string} endpoint - API endpoint
 * @param {Object} data - Request body
 * @returns {Promise<any>} Response data
 */
export async function post(endpoint, data) {
    return fetchAPI(endpoint, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

/**
 * DELETE request helper
 * @param {string} endpoint - API endpoint
 * @returns {Promise<any>} Response data
 */
export async function del(endpoint) {
    return fetchAPI(endpoint, { method: 'DELETE' });
}

