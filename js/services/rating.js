// Rating Service
//
// The backend stores ratings against a generic item:
//   POST   /api/rate            { itemId, itemType, itemName, artistName, image, rating }
//   DELETE /api/rate/:itemId?itemType=track
//   GET    /api/me              -> { ratings: [{ itemId, itemType, rating, ... }] }
// Ratings are half-star capable: 0.5 to 5 in 0.5 steps.
import { post, del } from './api.js';
import { fetchMe } from './me.js';
import { store } from '../state/store.js';
import { showToast } from '../utils.js';
import { t } from './i18n.js';

/**
 * Get all user ratings
 * @returns {Promise<Array>}
 */
export async function getRatings() {
    try {
        const { ratings } = await fetchMe();
        store.setRatings(ratings);
        return ratings;
    } catch (error) {
        console.error('Failed to fetch ratings:', error.message);
        return [];
    }
}

/**
 * Rate a track or album.
 * @param {string} itemId - Track or album ID
 * @param {number} rating - 0.5 to 5, in 0.5 steps
 * @param {{itemType?: 'track'|'album', itemName?: string, artistName?: string, image?: string}} [meta]
 * @returns {Promise<boolean>}
 */
export async function rateTrack(itemId, rating, meta = {}) {
    const itemType = meta.itemType || 'track';

    if (typeof rating !== 'number' || !Number.isInteger(rating * 2) || rating < 0.5 || rating > 5) {
        showToast(`❌ ${  t('track.ratingRange')}`, 'error');
        return false;
    }

    try {
        await post('/rate', {
            itemId,
            itemType,
            itemName: meta.itemName,
            artistName: meta.artistName,
            image: meta.image,
            rating
        });

        const next = [...store.userRatings];
        const index = next.findIndex(r => r.itemId === itemId && r.itemType === itemType);
        if (index >= 0) {
            next[index] = { ...next[index], rating };
        } else {
            next.push({ itemId, itemType, rating, ...meta });
        }
        store.setRatings(next);

        showToast(`⭐ ${  t('track.ratingGiven', { n: rating })}`, 'success');
        return true;
    } catch (error) {
        showToast(`❌ ${  error.message || t('common.error')}`, 'error');
        return false;
    }
}

/**
 * Remove a rating.
 * @param {string} itemId - Track or album ID
 * @param {'track'|'album'} [itemType]
 * @returns {Promise<boolean>}
 */
export async function removeRating(itemId, itemType = 'track') {
    try {
        await del(`/rate/${encodeURIComponent(itemId)}?itemType=${itemType}`);
        store.setRatings(store.userRatings.filter(
            r => !(r.itemId === itemId && r.itemType === itemType)
        ));
        showToast(`🗑️ ${  t('track.ratingRemoved')}`);
        return true;
    } catch (error) {
        showToast(`❌ ${  error.message || t('common.error')}`, 'error');
        return false;
    }
}

/**
 * Get the user's rating for an item
 * @param {string} itemId - Track or album ID
 * @param {'track'|'album'} [itemType]
 * @returns {number|null}
 */
export function getTrackRating(itemId, itemType = 'track') {
    const entry = store.userRatings.find(r => r.itemId === itemId && r.itemType === itemType);
    return entry ? entry.rating : null;
}

/**
 * Get top rated tracks.
 * @param {number} limit - Number of tracks to return
 * @returns {Array}
 */
export function getTopRatedTracks(limit = 10) {
    return store.likedTracks
        .map(track => ({ ...track, rating: getTrackRating(track.trackId) || 0 }))
        .filter(track => track.rating > 0)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, limit);
}

/**
 * Average rating across every rated item.
 * @returns {string} one decimal, '0.0' when nothing is rated
 */
export function getAverageRating() {
    const rated = store.userRatings.filter(r => r.rating > 0);
    if (rated.length === 0) return '0.0';

    const sum = rated.reduce((acc, r) => acc + r.rating, 0);
    return (sum / rated.length).toFixed(1);
}
