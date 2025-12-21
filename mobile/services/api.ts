import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// API Base URL - Değiştirin!
// Development: Bilgisayarınızın IP adresi (aynı WiFi ağında olmalı)
// Production: Render.com URL'niz
const DEV_IP = '192.168.1.148'; // Bilgisayarınızın IP adresi

const getBaseURL = () => {
    if (__DEV__) {
        // Development mode - Gerçek IP kullan (telefon erişimi için)
        return `http://${DEV_IP}:3000/api`;
    }
    // Production - Render.com URL'nizi buraya yazın
    return 'https://your-app.onrender.com/api';
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

// Response interceptor - Handle errors
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            await removeToken();
            // You might want to redirect to login here
        }
        return Promise.reject(error);
    }
);

export default api;
