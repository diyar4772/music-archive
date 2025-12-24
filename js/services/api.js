// API Service - Centralized fetch wrapper
import { API_URL } from '../config.js';
import { store } from '../state/store.js';

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

    if (!response.ok) {
        const errorText = await response.text();
        try {
            const errorJson = JSON.parse(errorText);
            throw new Error(errorJson.error || `API Error: ${response.status}`);
        } catch (parseError) {
            if (parseError.message.includes('API Error')) throw parseError;
            throw new Error(`Server Error (${response.status}): ${response.statusText}`);
        }
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

