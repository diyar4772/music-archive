import api, { setToken, setRefreshToken, setStoredUser, removeToken, getToken, getRefreshToken } from './api';
import { LoginResponse, UserData } from '../types';

export const authService = {
    // Login
    login: async (username: string, password: string): Promise<LoginResponse> => {
        const response = await api.post<LoginResponse>('/login', { username, password });
        await setToken(response.data.token);
        if (response.data.refreshToken) {
            await setRefreshToken(response.data.refreshToken);
        }
        await setStoredUser(response.data.username);
        return response.data;
    },

    // Register
    register: async (username: string, password: string): Promise<LoginResponse> => {
        const response = await api.post<LoginResponse>('/register', { username, password });
        await setToken(response.data.token);
        if (response.data.refreshToken) {
            await setRefreshToken(response.data.refreshToken);
        }
        await setStoredUser(response.data.username);
        return response.data;
    },

    // Logout
    logout: async (): Promise<void> => {
        const refreshToken = await getRefreshToken();
        try {
            if (refreshToken) {
                await api.post('/logout', { refreshToken });
            }
        } finally {
            await removeToken();
        }
    },

    // Get current user data
    getMe: async (): Promise<UserData> => {
        const response = await api.get<UserData>('/me');
        return response.data;
    },

    // Check if user is logged in
    isLoggedIn: async (): Promise<boolean> => {
        const token = await getToken();
        return !!token;
    },
};

export default authService;
