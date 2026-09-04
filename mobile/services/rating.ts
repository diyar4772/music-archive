/**
 * ⭐ Rating Service - Mobile App API Client
 * 
 * Handles all Rating-related API calls:
 * - Rate tracks and albums (1-5 stars, 0.5 increments)
 * - Get user ratings
 * - Delete ratings
 */

import api from './api';

// Types
export interface RateItemParams {
    itemId: string;
    itemType: 'track' | 'album';
    rating: number; // 0.5 to 5 in 0.5 increments
    itemName: string;
    artistName: string;
    image?: string;
}

export interface RatingResponse {
    message: string;
    rating?: {
        itemId: string;
        itemType: 'track' | 'album';
        rating: number;
    };
}

export interface ItemRating {
    average: number;
    count: number;
    userRating?: number;
}

// ===== Rate an Item =====
export async function rateItem(params: RateItemParams): Promise<RatingResponse> {
    const response = await api.post('/rate', params);
    return response.data;
}

// ===== Get Ratings for an Item =====
export async function getItemRating(itemId: string): Promise<ItemRating> {
    const response = await api.get(`/ratings/${itemId}`);
    return response.data;
}

// ===== Delete User's Rating =====
export async function deleteRating(itemId: string): Promise<{ message: string }> {
    const response = await api.delete(`/rate/${itemId}`);
    return response.data;
}

// ===== Default Export =====
export default {
    rateItem,
    getItemRating,
    deleteRating,
};

