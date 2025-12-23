import { create } from 'zustand';
import { User, UserData, UserLike, UserFollow } from '../types';
import authService from '../services/auth';
import { getToken, getStoredUser, removeToken, setOnUnauthorized } from '../services/api';

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
    refreshUserData: () => Promise<void>;
    
    // Optimistic UI Updates
    addLikeOptimistic: (like: UserLike) => void;
    removeLikeOptimistic: (trackId: string) => void;
    addFollowOptimistic: (follow: UserFollow) => void;
    removeFollowOptimistic: (artistId: string) => void;
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

    // Refresh user data (for realtime UI updates after like/follow)
    refreshUserData: async () => {
        try {
            const userData = await authService.getMe();
            set({ userData });
        } catch (error) {
            console.error('Error refreshing user data:', error);
        }
    },

    // ===== Optimistic UI Updates =====
    // These update local state immediately for instant UI feedback
    
    addLikeOptimistic: (like: UserLike) => {
        const { userData } = get();
        if (!userData) return;
        
        // Check if already exists
        if (userData.likes?.some(l => l.trackId === like.trackId)) return;
        
        set({
            userData: {
                ...userData,
                likes: [...(userData.likes || []), like],
            },
        });
    },

    removeLikeOptimistic: (trackId: string) => {
        const { userData } = get();
        if (!userData) return;
        
        set({
            userData: {
                ...userData,
                likes: (userData.likes || []).filter(l => l.trackId !== trackId),
            },
        });
    },

    addFollowOptimistic: (follow: UserFollow) => {
        const { userData } = get();
        if (!userData) return;
        
        // Check if already exists
        if (userData.follows?.some(f => f.artistId === follow.artistId)) return;
        
        set({
            userData: {
                ...userData,
                follows: [...(userData.follows || []), follow],
            },
        });
    },

    removeFollowOptimistic: (artistId: string) => {
        const { userData } = get();
        if (!userData) return;
        
        set({
            userData: {
                ...userData,
                follows: (userData.follows || []).filter(f => f.artistId !== artistId),
            },
        });
    },
}));

// 🔒 Register global unauthorized handler
// This ensures any 401 response triggers a proper logout
setOnUnauthorized(() => {
    const store = useAuthStore.getState();
    if (store.isAuthenticated) {
        console.log('🔒 Auth: Unauthorized detected, forcing logout');
        store.logout();
    }
});

export default useAuthStore;
