import { create } from 'zustand';
import { User, UserData } from '../types';
import authService from '../services/auth';
import { getToken, getStoredUser, removeToken } from '../services/api';

interface AuthStore {
    // State
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    userData: UserData | null;

    // Actions
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    fetchUserData: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
    // Initial state
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
    userData: null,

    // Login action
    login: async (username: string, password: string) => {
        set({ isLoading: true });
        try {
            const response = await authService.login(username, password);
            set({
                user: { id: '', username: response.username },
                token: response.token,
                isAuthenticated: true,
                isLoading: false,
            });
            // Fetch user data after login
            await get().fetchUserData();
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    // Register action
    register: async (username: string, password: string) => {
        set({ isLoading: true });
        try {
            const response = await authService.register(username, password);
            set({
                user: { id: '', username: response.username },
                token: response.token,
                isAuthenticated: true,
                isLoading: false,
            });
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    // Logout action
    logout: async () => {
        await authService.logout();
        set({
            user: null,
            token: null,
            isAuthenticated: false,
            userData: null,
        });
    },

    // Check if user is authenticated (on app start)
    checkAuth: async () => {
        set({ isLoading: true });
        try {
            const token = await getToken();
            const username = await getStoredUser();

            if (token && username) {
                set({
                    user: { id: '', username },
                    token,
                    isAuthenticated: true,
                    isLoading: false,
                });
                // Fetch user data
                await get().fetchUserData();
            } else {
                set({ isLoading: false, isAuthenticated: false });
            }
        } catch (error) {
            // Token invalid or expired
            await removeToken();
            set({
                user: null,
                token: null,
                isAuthenticated: false,
                isLoading: false,
            });
        }
    },

    // Fetch user data (follows, likes, etc.)
    fetchUserData: async () => {
        try {
            const userData = await authService.getMe();
            set({ userData });
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    },
}));

export default useAuthStore;
