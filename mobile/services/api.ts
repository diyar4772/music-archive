import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import logger from '../utils/logger';

// Auth event system for cross-module communication
type AuthEventCallback = () => void;
let onUnauthorizedCallback: AuthEventCallback | null = null;

export const setOnUnauthorized = (callback: AuthEventCallback) => {
    onUnauthorizedCallback = callback;
};

// API Base URL Configuration
// Development: Automatically uses Expo's hostUri for dynamic IP
// Production: Uses PROD_API_URL from app.json — there is no default. A hardcoded
// fallback host would keep receiving auth tokens after that host changes hands.

const getProdURL = () => {
    const prodUrl = Constants.expoConfig?.extra?.PROD_API_URL;
    if (!prodUrl) {
        throw new Error(
            'PROD_API_URL is not set in app.json (expo.extra). Point it at your own backend before building for production.'
        );
    }
    return prodUrl;
};

const getBaseURL = () => {
    const extra = Constants.expoConfig?.extra;

    // 🌐 Web Platform - Always use localhost in dev, production URL otherwise
    if (Platform.OS === 'web') {
        if (__DEV__) {
            logger.debug('Web API Base URL (dev): http://localhost:3000/api', undefined, 'api');
            return 'http://localhost:3000/api';
        }
        const prodUrl = getProdURL();
        logger.debug('Web API Base URL (prod)', { url: prodUrl }, 'api');
        return prodUrl;
    }

    // 📱 Mobile Platform
    if (__DEV__) {
        // 🎯 Dynamic IP from Expo Metro bundler
        // hostUri format: "192.168.1.10:8081" (IP:MetroPort)
        const hostUri = Constants.expoConfig?.hostUri;

        if (hostUri) {
            // Extract IP from hostUri and use backend port (3000)
            const hostIp = hostUri.split(':')[0];
            const dynamicUrl = `http://${hostIp}:3000/api`;
            logger.debug('API Base URL (dynamic)', { url: dynamicUrl }, 'api');
            return dynamicUrl;
        }

        // Fallback to configured or default
        const devUrl = extra?.DEV_API_URL || 'http://localhost:3000/api';
        logger.debug('API Base URL (fallback)', { url: devUrl }, 'api');
        return devUrl;
    }

    // Production - Use configured URL
    return getProdURL();
};

const api = axios.create({
    baseURL: getBaseURL(),
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Token storage keys
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'auth_user';

// Token helpers
export const getToken = async (): Promise<string | null> => {
    try {
        if (Platform.OS === 'web') {
            return localStorage.getItem(TOKEN_KEY);
        }
        return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
        return null;
    }
};

export const setToken = async (token: string): Promise<void> => {
    try {
        if (Platform.OS === 'web') {
            localStorage.setItem(TOKEN_KEY, token);
        } else {
            await SecureStore.setItemAsync(TOKEN_KEY, token);
        }
    } catch (error) {
        logger.error('Error saving token', error, 'api');
    }
};

export const removeToken = async (): Promise<void> => {
    try {
        if (Platform.OS === 'web') {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(REFRESH_TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
        } else {
            await SecureStore.deleteItemAsync(TOKEN_KEY);
            await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
            await SecureStore.deleteItemAsync(USER_KEY);
        }
    } catch (error) {
        logger.error('Error removing token', error, 'api');
    }
};

export const getRefreshToken = async (): Promise<string | null> => {
    try {
        if (Platform.OS === 'web') {
            return localStorage.getItem(REFRESH_TOKEN_KEY);
        }
        return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch {
        return null;
    }
};

export const setRefreshToken = async (refreshToken: string): Promise<void> => {
    try {
        if (Platform.OS === 'web') {
            localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        } else {
            await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
        }
    } catch (error) {
        logger.error('Error saving refresh token', error, 'api');
    }
};

export const getStoredUser = async (): Promise<string | null> => {
    try {
        if (Platform.OS === 'web') {
            return localStorage.getItem(USER_KEY);
        }
        return await SecureStore.getItemAsync(USER_KEY);
    } catch {
        return null;
    }
};

export const setStoredUser = async (username: string): Promise<void> => {
    try {
        if (Platform.OS === 'web') {
            localStorage.setItem(USER_KEY, username);
        } else {
            await SecureStore.setItemAsync(USER_KEY, username);
        }
    } catch (error) {
        logger.error('Error saving user', error, 'api');
    }
};

// Request interceptor - Add auth token
api.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
        const token = await getToken();
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Helper function to refresh auth token
const refreshAuthToken = async (refreshToken: string): Promise<{ token: string; refreshToken?: string } | null> => {
    try {
        const response = await axios.post(`${getBaseURL()}/auth/refresh`, { refreshToken });
        return response.data.token ? response.data : null;
    } catch (error) {
        logger.error('Failed to refresh token', error, 'api');
        return null;
    }
};

// Response interceptor - Handle errors and auth failures
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            // Try to refresh token
            const refreshToken = await getRefreshToken();
            if (refreshToken) {
                logger.debug('Attempting to refresh token', undefined, 'api');
                const refreshedAuth = await refreshAuthToken(refreshToken);

                if (refreshedAuth) {
                    // Save new token
                    await setToken(refreshedAuth.token);
                    if (refreshedAuth.refreshToken) {
                        await setRefreshToken(refreshedAuth.refreshToken);
                    }

                    // Update authorization header
                    if (originalRequest.headers) {
                        originalRequest.headers.Authorization = `Bearer ${refreshedAuth.token}`;
                    }
                    
                    // Retry original request
                    logger.debug('Token refreshed, retrying request', undefined, 'api');
                    return api.request(originalRequest);
                }
            }

            // Refresh failed or no refresh token - clean up and notify
            logger.warn('Unauthorized - clearing token and triggering logout', undefined, 'api');
            await removeToken();

            // Trigger logout callback if registered
            if (onUnauthorizedCallback) {
                onUnauthorizedCallback();
            }
        }
        return Promise.reject(error);
    }
);

export default api;
