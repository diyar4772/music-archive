/**
 * 🎨 Curator Store - Zustand
 * 
 * Manages the "Curator's Workbench" state:
 * - Staging area (selected tracks for playlist)
 * - Browse source (liked tracks)
 * - Actions: add, remove, clear, finalize
 */

import { create } from 'zustand';

export interface CuratorTrack {
    id: string;
    name: string;
    artist: string;
    image: string | null;
    previewUrl: string | null;
}

interface CuratorStore {
    // State
    stagingTracks: CuratorTrack[];
    maxStagingSize: number;

    // Actions
    addToStaging: (track: CuratorTrack) => boolean;
    removeFromStaging: (trackId: string) => void;
    clearStaging: () => void;
    reorderStaging: (fromIndex: number, toIndex: number) => void;
    isInStaging: (trackId: string) => boolean;
}

export const useCuratorStore = create<CuratorStore>((set, get) => ({
    // Initial state
    stagingTracks: [],
    maxStagingSize: 20, // Max tracks in staging area

    // Add track to staging
    addToStaging: (track) => {
        const { stagingTracks, maxStagingSize } = get();

        // Check if already in staging
        if (stagingTracks.some(t => t.id === track.id)) {
            return false;
        }

        // Check max size
        if (stagingTracks.length >= maxStagingSize) {
            return false;
        }

        set({ stagingTracks: [...stagingTracks, track] });
        return true;
    },

    // Remove track from staging
    removeFromStaging: (trackId) => {
        set((state) => ({
            stagingTracks: state.stagingTracks.filter(t => t.id !== trackId)
        }));
    },

    // Clear all staging
    clearStaging: () => {
        set({ stagingTracks: [] });
    },

    // Reorder tracks in staging
    reorderStaging: (fromIndex, toIndex) => {
        set((state) => {
            const tracks = [...state.stagingTracks];
            const [removed] = tracks.splice(fromIndex, 1);
            tracks.splice(toIndex, 0, removed);
            return { stagingTracks: tracks };
        });
    },

    // Check if track is in staging
    isInStaging: (trackId) => {
        return get().stagingTracks.some(t => t.id === trackId);
    },
}));

export default useCuratorStore;

