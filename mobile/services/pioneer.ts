/**
 * 🏆 Pioneer Service
 * 
 * Handles API calls for the Pioneer reward system.
 * Features:
 * - Get user's Pioneer status and progress
 * - Claim rewards when milestones are reached
 * - Get leaderboard data
 */

import api from './api';
import logger from '../utils/logger';
import { handleApiError } from '../utils/errorHandler';

export interface PioneerStatus {
    playlistCount: number;
    isPioneer: boolean;
    pioneerTier: 'none' | 'bronze' | 'silver' | 'gold';
    premiumUntil: string | null;
    nextMilestone: number;
    progress: number;
}

export interface PioneerLeaderboardEntry {
    userId: string;
    username: string;
    playlistCount: number;
    tier: string;
    rank: number;
}

export const pioneerService = {
    /**
     * Get current user's Pioneer status
     */
    async getStatus(): Promise<PioneerStatus> {
        try {
            const response = await api.get('/api/pioneer/status');
            return response.data;
        } catch (error) {
            // Return default status if API fails
            handleApiError(error, 'pioneer.getStatus', false); // Don't show alert, use fallback
            return {
                playlistCount: 0,
                isPioneer: false,
                pioneerTier: 'none',
                premiumUntil: null,
                nextMilestone: 10,
                progress: 0,
            };
        }
    },

    /**
     * Claim reward when milestone is reached
     */
    async claimReward(tier: string): Promise<{ success: boolean; message: string }> {
        try {
            const response = await api.post('/api/pioneer/claim', { tier });
            return response.data;
        } catch (error) {
            handleApiError(error, 'pioneer.claimReward', false); // Don't show alert, let caller handle
            throw error;
        }
    },

    /**
     * Get leaderboard data
     */
    async getLeaderboard(limit: number = 10): Promise<PioneerLeaderboardEntry[]> {
        try {
            const response = await api.get(`/api/pioneer/leaderboard?limit=${limit}`);
            return response.data.leaderboard || [];
        } catch (error) {
            handleApiError(error, 'pioneer.getLeaderboard', false); // Don't show alert, return empty
            return [];
        }
    },

    /**
     * Increment playlist count and check for milestone
     * Called after creating a new playlist
     */
    async incrementPlaylistCount(): Promise<{ 
        newCount: number; 
        milestoneReached: boolean; 
        newTier?: string;
    }> {
        try {
            const response = await api.post('/api/pioneer/increment');
            return response.data;
        } catch (error) {
            handleApiError(error, 'pioneer.incrementPlaylistCount', false); // Don't show alert, let caller handle
            throw error;
        }
    },
};

export default pioneerService;

