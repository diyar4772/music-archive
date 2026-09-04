// Rating Service
import { get, post } from './api.js';
import { store } from '../state/store.js';
import { showToast } from '../utils.js';

/**
 * Get all user ratings
 * @returns {Promise<Array>}
 */
export async function getRatings() {
    try {
        const data = await get('/ratings');
        store.setRatings(data);
        return data;
    } catch (error) {
        console.error('Failed to fetch ratings:', error);
        return [];
    }
}

/**
 * Rate a track
 * @param {string} trackId - Track ID
 * @param {number} rating - Rating value (1-5)
 * @returns {Promise<boolean>}
 */
export async function rateTrack(trackId, rating) {
    try {
        await post('/ratings', { trackId, rating });

        // Update local state
        const existingIndex = store.userRatings.findIndex(r => r.trackId === trackId);
        const newRatings = [...store.userRatings];

        if (existingIndex >= 0) {
            newRatings[existingIndex] = { ...newRatings[existingIndex], rating };
        } else {
            newRatings.push({ trackId, rating });
        }

        store.setRatings(newRatings);
        showToast(`⭐ ${rating} yıldız verildi`);
        return true;
    } catch (error) {
        showToast('❌ ' + error.message);
        return false;
    }
}

/**
 * Get rating for a specific track
 * @param {string} trackId - Track ID
 * @returns {number|null}
 */
export function getTrackRating(trackId) {
    const rating = store.userRatings.find(r => r.trackId === trackId);
    return rating ? rating.rating : null;
}

/**
 * Get top rated tracks
 * @param {number} limit - Number of tracks to return
 * @returns {Array}
 */
export function getTopRatedTracks(limit = 10) {
    const likedWithRatings = store.likedTracks
        .map(track => {
            const rating = getTrackRating(track.trackId);
            return { ...track, rating: rating || 0 };
        })
        .filter(track => track.rating > 0)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, limit);

    return likedWithRatings;
}

/**
 * Get average rating across all rated tracks
 * @returns {number}
 */
export function getAverageRating() {
    const ratings = store.userRatings.filter(r => r.rating > 0);
    if (ratings.length === 0) return 0;

    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    return (sum / ratings.length).toFixed(1);
}

