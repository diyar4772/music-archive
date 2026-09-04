import { create } from 'zustand';
import digService, { DigTrack } from '../services/dig';
import logger from '../utils/logger';
import { handleApiError } from '../utils/errorHandler';

interface DigState {
    queue: DigTrack[];
    currentIndex: number;
    isLoading: boolean;
    error: string | null;

    // Actions
    loadQueue: () => Promise<void>;
    swipe: (direction: 'left' | 'right' | 'up') => Promise<void>;
    nextCard: () => void;
    reset: () => void;
}

export const useDigStore = create<DigState>((set, get) => ({
    queue: [],
    currentIndex: 0,
    isLoading: false,
    error: null,

    loadQueue: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await digService.getQueue(undefined, 15);
            set({
                queue: response.tracks,
                currentIndex: 0,
                isLoading: false
            });
        } catch (error: any) {
            handleApiError(error, 'digStore.loadQueue', false); // Don't show alert, set error state
            set({
                error: error.message || 'Failed to load tracks',
                isLoading: false
            });
        }
    },

    swipe: async (direction: 'left' | 'right' | 'up') => {
        const { queue, currentIndex } = get();
        const currentTrack = queue[currentIndex];

        if (!currentTrack) return;

        const action = direction === 'right' ? 'archive' : direction === 'left' ? 'pass' : 'explore';

        try {
            await digService.swipe(currentTrack, action);
        } catch (error) {
            handleApiError(error, 'digStore.swipe', false); // Don't show alert, continue to next card
        }

        // Move to next card
        get().nextCard();
    },

    nextCard: () => {
        const { currentIndex, queue } = get();

        // Load more tracks if running low
        if (currentIndex >= queue.length - 3) {
            get().loadQueue().then(() => {
                // Append new tracks to existing queue
            });
        }

        set({ currentIndex: currentIndex + 1 });
    },

    reset: () => {
        set({ queue: [], currentIndex: 0, error: null });
    },
}));

export default useDigStore;
