import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Auth event system for cross-module communication
type AuthEventCallback = () => void;
let onUnauthorizedCallback: AuthEventCallback | null = null;

export const setOnUnauthorized = (callback: AuthEventCallback) => {
    onUnauthorizedCallback = callback;
};

// API Base URL Configuration
// Development: Automatically uses Expo's hostUri for dynamic IP
// Production: Uses configured PROD_API_URL or Render.com URL

const getBaseURL = () => {
    const extra = Constants.expoConfig?.extra;

    if (__DEV__) {
        // 🎯 Dynamic IP from Expo Metro bundler
        // hostUri format: "192.168.1.148:8081" (IP:MetroPort)
        const hostUri = Constants.expoConfig?.hostUri;

        if (hostUri) {
            // Extract IP from hostUri and use backend port (3000)
            const hostIp = hostUri.split(':')[0];
            const dynamicUrl = `http://${hostIp}:3000/api`;
            console.log('📱 API Base URL (dynamic):', dynamicUrl);
            return dynamicUrl;
        }

        // Fallback to configured or default
        const devUrl = extra?.DEV_API_URL || 'http://localhost:3000/api';
        console.log('📱 API Base URL (fallback):', devUrl);
        return devUrl;
    }

    // Production - Use configured URL or Render.com
    const prodUrl = extra?.PROD_API_URL || 'https://your-app.onrender.com/api';
    return prodUrl;
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
        console.error('Error saving token:', error);
    }
};

export const removeToken = async (): Promise<void> => {
    try {
        if (Platform.OS === 'web') {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
        } else {
            await SecureStore.deleteItemAsync(TOKEN_KEY);
            await SecureStore.deleteItemAsync(USER_KEY);
        }
    } catch (error) {
        console.error('Error removing token:', error);
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
        console.error('Error saving user:', error);
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

// Response interceptor - Handle errors and auth failures
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        if (error.response?.status === 401) {
            // Token expired or invalid - clean up and notify
            console.log('🔒 API: Unauthorized - clearing token and triggering logout');
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
