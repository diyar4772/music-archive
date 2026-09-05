// Library Service - Likes, Follows, Playlists
//
// Endpoints here mirror what server.js actually exposes:
//   GET  /api/me                       -> { follows, likes, albumFollows, ratings }
//   POST /api/like                     -> toggles, { status: 'liked' | 'unliked' }
//   POST /api/follow                   -> toggles, { status: 'followed' | 'unfollowed' }
//   GET/POST/DELETE /api/playlists...
import { get, post, del } from './api.js';
import { fetchMe } from './me.js';
import { store } from '../state/store.js';
import { showToast } from '../utils.js';
import { t } from './i18n.js';

// ============ LIKES ============

/**
 * Get all liked tracks
 * @returns {Promise<Array>}
 */
export async function getLikedTracks({ strict = false } = {}) {
    try {
        const { likes } = await fetchMe();
        store.setLikedTracks(likes);
        return likes;
    } catch (error) {
        if (strict) throw error;
        console.warn('Failed to fetch liked tracks:', error.message);
        return [];
    }
}

/**
 * Toggle a like. The endpoint is a toggle, so this is the single writer both
 * likeTrack() and unlikeTrack() go through; local state follows the server's
 * reported status rather than an assumption.
 * @param {Object} track - Track object (search result shape or stored shape)
 * @returns {Promise<'liked'|'unliked'|null>}
 */
async function toggleLike(track) {
    const trackId = track.trackId || track.id;
    const payload = {
        trackId,
        artistName: track.artistName || track.artist || 'Unknown Artist',
        artistId: track.artistId,
        trackName: track.trackName || track.name,
        image: track.image,
        previewUrl: track.previewUrl || track.preview_url || null
    };

    const { status } = await post('/like', payload);

    if (status === 'liked') {
        store.setLikedTracks([...store.likedTracks, {
            trackId,
            trackName: payload.trackName,
            artistName: track.artistName || track.artist || 'Unknown Artist',
            image: payload.image,
            previewUrl: payload.previewUrl
        }]);
    } else {
        store.setLikedTracks(store.likedTracks.filter(t => t.trackId !== trackId));
    }

    return status;
}

/**
 * Like a track. No-op when it is already liked, so a stale UI cannot toggle it off.
 * @param {Object} track - Track object
 * @returns {Promise<boolean>}
 */
export async function likeTrack(track) {
    const trackId = track.trackId || track.id;
    if (isTrackLiked(trackId)) return true;

    try {
        const status = await toggleLike(track);
        if (status === 'liked') showToast('❤️ Arşivine eklendi');
        return status === 'liked';
    } catch (error) {
        showToast(`❌ ${error.message || t('common.error')}`, 'error');
        return false;
    }
}

/**
 * Unlike a track. No-op when it is not liked.
 * @param {string} trackId - Track ID
 * @returns {Promise<boolean>}
 */
export async function unlikeTrack(trackId) {
    if (!isTrackLiked(trackId)) return true;

    try {
        const existing = store.likedTracks.find(t => t.trackId === trackId) || { trackId };
        const status = await toggleLike(existing);
        if (status === 'unliked') showToast('💔 Arşivinden çıkarıldı');
        return status === 'unliked';
    } catch (error) {
        showToast(`❌ ${error.message || t('common.error')}`, 'error');
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
export async function getFollowedArtists({ strict = false } = {}) {
    try {
        const { follows } = await fetchMe();
        store.setFollowedArtists(follows);
        return follows;
    } catch (error) {
        if (strict) throw error;
        console.warn('Failed to fetch followed artists:', error.message);
        return [];
    }
}

/**
 * Toggle an artist follow. See toggleLike() — same server semantics.
 * @param {Object} artist - Artist object
 * @returns {Promise<'followed'|'unfollowed'>}
 */
async function toggleFollow(artist) {
    const artistId = artist.artistId || artist.id;
    const payload = {
        artistId,
        artistName: artist.artistName || artist.name,
        image: artist.image
    };

    const { status } = await post('/follow', payload);

    if (status === 'followed') {
        store.setFollowedArtists([...store.followedArtists, payload]);
    } else {
        store.setFollowedArtists(store.followedArtists.filter(a => a.artistId !== artistId));
    }

    return status;
}

/**
 * Follow an artist
 * @param {Object} artist - Artist object
 * @returns {Promise<boolean>}
 */
export async function followArtist(artist) {
    const artistId = artist.artistId || artist.id;
    if (isArtistFollowed(artistId)) return true;

    try {
        const status = await toggleFollow(artist);
        if (status === 'followed') showToast('✅ Sanatçı takip ediliyor');
        return status === 'followed';
    } catch (error) {
        showToast(`❌ ${error.message || t('common.error')}`, 'error');
        return false;
    }
}

/**
 * Unfollow an artist
 * @param {string} artistId - Artist ID
 * @returns {Promise<boolean>}
 */
export async function unfollowArtist(artistId) {
    if (!isArtistFollowed(artistId)) return true;

    try {
        const existing = store.followedArtists.find(a => a.artistId === artistId) || { artistId };
        const status = await toggleFollow(existing);
        if (status === 'unfollowed') showToast('👋 Takip bırakıldı');
        return status === 'unfollowed';
    } catch (error) {
        showToast(`❌ ${error.message || t('common.error')}`, 'error');
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

// ============ ALBUMS ============

/**
 * Get albums the user saved
 * @returns {Promise<Array>}
 */
export async function getAlbumFollows() {
    try {
        const { albumFollows } = await fetchMe();
        store.setAlbumFollows(albumFollows);
        return albumFollows;
    } catch (error) {
        console.error('Failed to fetch saved albums:', error.message);
        return [];
    }
}

/**
 * Toggle an album save. Same server semantics as likes and follows.
 * @param {Object} album - { id|albumId, name|albumName, image, artist|artistName }
 * @returns {Promise<boolean>} true when the album ends up saved
 */
export async function toggleAlbumFollow(album) {
    const albumId = album.albumId || album.id;
    const payload = {
        albumId,
        albumName: album.albumName || album.name,
        image: album.image,
        artistName: album.artistName || album.artist
    };

    try {
        const { status } = await post('/follow-album', payload);

        if (status === 'followed') {
            store.setAlbumFollows([...store.albumFollows, payload]);
            showToast('💿 Albüm arşivine eklendi');
            return true;
        }

        store.setAlbumFollows(store.albumFollows.filter(a => a.albumId !== albumId));
        showToast('🗑️ Albüm arşivinden çıkarıldı');
        return false;
    } catch (error) {
        showToast(`❌ ${error.message || t('common.error')}`, 'error');
        return isAlbumFollowed(albumId);
    }
}

/**
 * Check if an album is saved
 * @param {string} albumId - Album ID
 * @returns {boolean}
 */
export function isAlbumFollowed(albumId) {
    return store.albumFollows.some(a => a.albumId === albumId);
}

// ============ PLAYLISTS ============

/**
 * Get all playlists
 * @returns {Promise<Array>}
 */
export async function getPlaylists({ strict = false } = {}) {
    try {
        const data = await get('/playlists');
        store.setPlaylists(data);
        return data;
    } catch (error) {
        if (strict) throw error;
        console.warn('Failed to fetch playlists:', error.message);
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

        // Keep the shape the dashboard expects for a fresh, empty playlist.
        store.setPlaylists([...store.playlists, { ...data, PlaylistTracks: [] }]);

        showToast('✅ Liste oluşturuldu');
        return data;
    } catch (error) {
        showToast(`❌ ${error.message || t('common.error')}`, 'error');
        return null;
    }
}

/**
 * Delete a playlist
 * @param {string} playlistId - Playlist ID
 * @returns {Promise<boolean>}
 */
export async function deletePlaylist(playlistId) {
    try {
        await del(`/playlists/${encodeURIComponent(playlistId)}`);

        store.setPlaylists(store.playlists.filter(p => String(p.id) !== String(playlistId)));

        showToast('🗑️ Liste silindi');
        return true;
    } catch (error) {
        showToast(`❌ ${error.message || t('common.error')}`, 'error');
        return false;
    }
}

/**
 * Add track to playlist
 * @param {string} playlistId - Playlist ID
 * @param {Object} track - Track object
 * @returns {Promise<boolean>}
 */
export async function addToPlaylist(playlistId, track) {
    try {
        await post(`/playlists/${encodeURIComponent(playlistId)}/add`, {
            trackId: track.trackId || track.id,
            trackName: track.trackName || track.name,
            image: track.image,
            previewUrl: track.previewUrl || track.preview_url || null
        });

        showToast('✅ Listeye eklendi');
        return true;
    } catch (error) {
        showToast(`❌ ${error.message || t('common.error')}`, 'error');
        return false;
    }
}

/**
 * Remove track from playlist
 * @param {string} playlistId - Playlist ID
 * @param {string} trackId - Track ID
 * @returns {Promise<boolean>}
 */
export async function removeFromPlaylist(playlistId, trackId) {
    try {
        await del(`/playlists/${encodeURIComponent(playlistId)}/tracks/${encodeURIComponent(trackId)}`);
        showToast('🗑️ Şarkı listeden kaldırıldı');
        return true;
    } catch (error) {
        showToast(`❌ ${error.message || t('common.error')}`, 'error');
        return false;
    }
}
