// Library Service - Likes, Follows, Playlists
import { get, post, del } from './api.js';
import { store } from '../state/store.js';
import { showToast } from '../utils.js';

// ============ LIKES ============

/**
 * Get all liked tracks
 * @returns {Promise<Array>}
 */
export async function getLikedTracks() {
    try {
        const data = await get('/likes');
        store.setLikedTracks(data);
        return data;
    } catch (error) {
        console.error('Failed to fetch liked tracks:', error);
        return [];
    }
}

/**
 * Like a track
 * @param {Object} track - Track object
 * @returns {Promise<boolean>}
 */
export async function likeTrack(track) {
    try {
        await post('/likes', {
            trackId: track.id,
            trackName: track.name,
            artist: track.artist,
            artistId: track.artistId,
            album: track.album,
            albumId: track.albumId,
            image: track.image,
            previewUrl: track.preview_url,
            duration: track.duration
        });

        // Update local state
        const newLiked = [...store.likedTracks, track];
        store.setLikedTracks(newLiked);

        showToast('❤️ Şarkı beğenildi');
        return true;
    } catch (error) {
        showToast('❌ ' + error.message);
        return false;
    }
}

/**
 * Unlike a track
 * @param {string} trackId - Track ID
 * @returns {Promise<boolean>}
 */
export async function unlikeTrack(trackId) {
    try {
        await del(`/likes/${trackId}`);

        // Update local state
        const newLiked = store.likedTracks.filter(t => t.trackId !== trackId);
        store.setLikedTracks(newLiked);

        showToast('💔 Beğeni kaldırıldı');
        return true;
    } catch (error) {
        showToast('❌ ' + error.message);
        return false;
    }
}

/**
 * Check if track is liked
 * @param {string} trackId - Track ID
 * @returns {boolean}
 */
export function isTrackLiked(trackId) {
    return store.likedTracks.some(t => t.trackId === trackId);
}

// ============ FOLLOWS ============

/**
 * Get all followed artists
 * @returns {Promise<Array>}
 */
export async function getFollowedArtists() {
    try {
        const data = await get('/follows');
        store.setFollowedArtists(data);
        return data;
    } catch (error) {
        console.error('Failed to fetch followed artists:', error);
        return [];
    }
}

/**
 * Follow an artist
 * @param {Object} artist - Artist object
 * @returns {Promise<boolean>}
 */
export async function followArtist(artist) {
    try {
        await post('/follows', {
            artistId: artist.id,
            artistName: artist.name,
            image: artist.image
        });

        // Update local state
        const newFollowed = [...store.followedArtists, {
            artistId: artist.id,
            artistName: artist.name,
            image: artist.image
        }];
        store.setFollowedArtists(newFollowed);

        showToast('✅ Sanatçı takip ediliyor');
        return true;
    } catch (error) {
        showToast('❌ ' + error.message);
        return false;
    }
}

/**
 * Unfollow an artist
 * @param {string} artistId - Artist ID
 * @returns {Promise<boolean>}
 */
export async function unfollowArtist(artistId) {
    try {
        await del(`/follows/${artistId}`);

        // Update local state
        const newFollowed = store.followedArtists.filter(a => a.artistId !== artistId);
        store.setFollowedArtists(newFollowed);

        showToast('👋 Takip bırakıldı');
        return true;
    } catch (error) {
        showToast('❌ ' + error.message);
        return false;
    }
}

/**
 * Check if artist is followed
 * @param {string} artistId - Artist ID
 * @returns {boolean}
 */
export function isArtistFollowed(artistId) {
    return store.followedArtists.some(a => a.artistId === artistId);
}

// ============ PLAYLISTS ============

/**
 * Get all playlists
 * @returns {Promise<Array>}
 */
export async function getPlaylists() {
    try {
        const data = await get('/playlists');
        store.setPlaylists(data);
        return data;
    } catch (error) {
        console.error('Failed to fetch playlists:', error);
        return [];
    }
}

/**
 * Create new playlist
 * @param {string} name - Playlist name
 * @returns {Promise<Object|null>}
 */
export async function createPlaylist(name) {
    try {
        const data = await post('/playlists', { name });

        // Update local state
        const newPlaylists = [...store.playlists, data];
        store.setPlaylists(newPlaylists);

        showToast('✅ Playlist oluşturuldu');
        return data;
    } catch (error) {
        showToast('❌ ' + error.message);
        return null;
    }
}

/**
 * Delete a playlist
 * @param {number} playlistId - Playlist ID
 * @returns {Promise<boolean>}
 */
export async function deletePlaylist(playlistId) {
    try {
        await del(`/playlists/${playlistId}`);

        // Update local state
        const newPlaylists = store.playlists.filter(p => p.id !== playlistId);
        store.setPlaylists(newPlaylists);

        showToast('🗑️ Playlist silindi');
        return true;
    } catch (error) {
        showToast('❌ ' + error.message);
        return false;
    }
}

/**
 * Add track to playlist
 * @param {number} playlistId - Playlist ID
 * @param {Object} track - Track object
 * @returns {Promise<boolean>}
 */
export async function addToPlaylist(playlistId, track) {
    try {
        await post(`/playlists/${playlistId}/tracks`, {
            trackId: track.id,
            trackName: track.name,
            artist: track.artist,
            image: track.image,
            previewUrl: track.preview_url,
            duration: track.duration
        });

        showToast('✅ Şarkı playlist\'e eklendi');
        return true;
    } catch (error) {
        showToast('❌ ' + error.message);
        return false;
    }
}

/**
 * Remove track from playlist
 * @param {number} playlistId - Playlist ID
 * @param {string} trackId - Track ID
 * @returns {Promise<boolean>}
 */
export async function removeFromPlaylist(playlistId, trackId) {
    try {
        await del(`/playlists/${playlistId}/tracks/${trackId}`);
        showToast('🗑️ Şarkı playlist\'ten kaldırıldı');
        return true;
    } catch (error) {
        showToast('❌ ' + error.message);
        return false;
    }
}

