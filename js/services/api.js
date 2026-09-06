import { t } from '../services/i18n.js';
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
        // Newer endpoints send a machine-readable `code` beside the human
        // sentence (API-CONTRACTS §1); older ones put the code in `error`.
        let code = null;
        try {
            const errorJson = JSON.parse(errorText);
            message = errorJson.error || message;
            code = errorJson.code || null;
        } catch {}
        const messages = {
            SEARCH_UNAVAILABLE: t('states.searchUnavailable'),
            SEARCH_UPSTREAM_AUTH_FAILED: t('search.unavailableTitle'),
            SEARCH_RATE_LIMITED: t('search.rateLimited'),
            SEARCH_TIMEOUT: t('search.timeout')
        };
        throw Object.assign(new Error(messages[message] || message), { status: response.status, code: code || message });
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
export async function post(endpoint, data, options = {}) {
    return fetchAPI(endpoint, {
        ...options,
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

export function put(endpoint, data) {
    return fetchAPI(endpoint, { method: 'PUT', body: JSON.stringify(data) });
}

/**
 * PATCH request helper — a partial update of an existing record.
 * @param {string} endpoint - API endpoint
 * @param {Object} data - the fields to change
 * @returns {Promise<any>} Response data
 */
export function patch(endpoint, data) {
    return fetchAPI(endpoint, { method: 'PATCH', body: JSON.stringify(data) });
}
