/**
 * TrackItem Component
 * Renders a single track using the normalized Track model
 * 
 * This component is SOURCE-AGNOSTIC - it works with any Track model
 * regardless of whether the data came from Spotify, local files, or other sources.
 * 
 * SPOTIFY COMPLIANCE:
 * - Shows Spotify attribution when track.source === 'spotify'
 * - Preview links back to Spotify
 */

import { TrackSource } from '../models/Track.js';
import { SpotifyAdapter } from '../adapters/SpotifyAdapter.js';

/**
 * Render a track item for lists
 * @param {Track} track - Normalized Track model
 * @param {Object} options - Render options
 * @returns {string} HTML string
 */
export function renderTrackItem(track, options = {}) {
    const {
        showImage = true,
        showArtist = true,
        showAlbum = false,
        showDuration = true,
        showRating = true,
        showActions = true,
        showPreview = true,
        showIndex = false,
        index = 0,
        isPlaying = false,
        isLiked = false,
        compact = false
    } = options;

    // Get the track's unique identifier for actions
    // Prefer Spotify ID for backward compatibility with existing API
    const actionId = track.externalIds?.spotify || track.id;

    // Build class string
    const rowClasses = [
        'track-item',
        'flex items-center gap-3 p-2 rounded-lg',
        'hover:bg-gray-100 dark:hover:bg-white/5',
        'transition-colors cursor-pointer group',
        isPlaying ? 'playing-row bg-green-50 dark:bg-green-500/10' : ''
    ].filter(Boolean).join(' ');

    // Rating badge HTML
    const ratingBadge = track.userData?.rating
        ? `<span class="rating-badge ml-2">
            <i class="fa-solid fa-star text-yellow-500"></i>
            <span>${track.userData.rating}</span>
           </span>`
        : '';

    // Source attribution (for Spotify compliance)
    const sourceAttribution = track.source === TrackSource.SPOTIFY
        ? `<i class="fa-brands fa-spotify text-[#1DB954] text-xs ml-1" title="via Spotify"></i>`
        : '';

    // Build HTML
    return `
        <div class="${rowClasses}" 
             data-track-id="${actionId}"
             data-track-internal-id="${track.id}"
             onclick="window.openTrackDetail && window.openTrackDetail(${JSON.stringify(trackToLegacyFormat(track)).replace(/"/g, '&quot;')})">
            
            ${showIndex ? `
                <div class="w-6 text-center text-sm text-gray-400 group-hover:hidden">
                    ${isPlaying
                ? '<i class="fa-solid fa-volume-high text-green-500"></i>'
                : index + 1}
                </div>
                <div class="w-6 text-center hidden group-hover:block">
                    <button class="text-gray-400 hover:text-white" onclick="event.stopPropagation(); window.playPreview && window.playPreview('${actionId}')">
                        <i class="fa-solid fa-play"></i>
                    </button>
                </div>
            ` : ''}
            
            ${showImage ? `
                <div class="relative flex-shrink-0">
                    <img src="${track.coverArt || 'https://via.placeholder.com/48/1a1a24/666?text=♪'}" 
                         alt="${escapeHtml(track.title)}"
                         class="w-12 h-12 rounded object-cover ${compact ? 'w-10 h-10' : ''}"
                         loading="lazy">
                    ${showPreview && track.hasPreview ? `
                        <button class="absolute inset-0 bg-black/50 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                onclick="event.stopPropagation(); window.playPreview && window.playPreview('${actionId}')">
                            <i class="fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-white"></i>
                        </button>
                    ` : ''}
                </div>
            ` : ''}
            
            <div class="flex-1 min-w-0">
                <div class="flex items-center">
                    <p class="font-medium truncate ${isPlaying ? 'text-green-500' : ''}">
                        ${escapeHtml(track.title)}
                    </p>
                    ${showRating ? ratingBadge : ''}
                    ${sourceAttribution}
                </div>
                ${showArtist ? `
                    <p class="text-sm text-text-secondary-light dark:text-gray-400 truncate">
                        ${escapeHtml(track.artistString)}
                        ${showAlbum && track.album ? ` • ${escapeHtml(track.album)}` : ''}
                    </p>
                ` : ''}
            </div>
            
            ${showDuration ? `
                <span class="text-sm text-text-secondary-light dark:text-gray-400 hidden sm:block">
                    ${track.formattedDuration}
                </span>
            ` : ''}
            
            ${showActions ? `
                <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="p-2 text-gray-400 hover:text-red-500 transition-colors"
                            onclick="event.stopPropagation(); window.toggleLike && window.toggleLike('${actionId}')"
                            title="${isLiked ? 'Beğeniyi kaldır' : 'Beğen'}">
                        <i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart ${isLiked ? 'text-red-500' : ''}"></i>
                    </button>
                    <button class="p-2 text-gray-400 hover:text-white transition-colors"
                            onclick="event.stopPropagation(); window.showAddToPlaylist && window.showAddToPlaylist('${actionId}')"
                            title="Listeye ekle">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render a list of tracks
 * @param {Track[]} tracks - Array of Track models
 * @param {Object} options - Render options
 * @returns {string} HTML string
 */
export function renderTrackList(tracks, options = {}) {
    const {
        emptyMessage = 'Şarkı bulunamadı',
        showIndices = false,
        playingTrackId = null,
        likedTrackIds = []
    } = options;

    if (!tracks || tracks.length === 0) {
        return `
            <div class="text-center py-8 text-gray-400">
                <i class="fa-solid fa-music text-2xl mb-2"></i>
                <p>${emptyMessage}</p>
            </div>
        `;
    }

    return tracks.map((track, index) => {
        const actionId = track.externalIds?.spotify || track.id;
        return renderTrackItem(track, {
            ...options,
            index,
            showIndex: showIndices,
            isPlaying: playingTrackId === actionId,
            isLiked: likedTrackIds.includes(actionId)
        });
    }).join('');
}

/**
 * Render a track card (for grid layouts)
 * @param {Track} track - Normalized Track model
 * @param {Object} options - Render options
 * @returns {string} HTML string
 */
export function renderTrackCard(track, options = {}) {
    const { isLiked = false, showRating = true } = options;
    const actionId = track.externalIds?.spotify || track.id;

    const ratingBadge = track.userData?.rating
        ? `<div class="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
            <i class="fa-solid fa-star text-yellow-500 text-xs"></i>
            <span class="text-xs font-bold">${track.userData.rating}</span>
           </div>`
        : '';

    return `
        <div class="track-card bg-white dark:bg-card-dark p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-all group border border-gray-100 dark:border-white/5"
             data-track-id="${actionId}"
             onclick="window.openTrackDetail && window.openTrackDetail(${JSON.stringify(trackToLegacyFormat(track)).replace(/"/g, '&quot;')})">
            
            <div class="relative aspect-square mb-3 overflow-hidden rounded-lg">
                <img src="${track.coverArt || 'https://via.placeholder.com/200/1a1a24/666?text=♪'}" 
                     alt="${escapeHtml(track.title)}"
                     class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                     loading="lazy">
                
                ${showRating ? ratingBadge : ''}
                
                ${track.hasPreview ? `
                    <button class="absolute bottom-2 right-2 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 shadow-lg"
                            onclick="event.stopPropagation(); window.playPreview && window.playPreview('${actionId}')">
                        <i class="fa-solid fa-play text-black"></i>
                    </button>
                ` : ''}
                
                ${track.source === TrackSource.SPOTIFY ? `
                    <div class="absolute top-2 left-2">
                        <i class="fa-brands fa-spotify text-[#1DB954] text-lg" title="via Spotify"></i>
                    </div>
                ` : ''}
            </div>
            
            <p class="font-bold truncate">${escapeHtml(track.title)}</p>
            <p class="text-sm text-text-secondary-light dark:text-gray-400 truncate">${escapeHtml(track.artistString)}</p>
        </div>
    `;
}

/**
 * Convert Track model to legacy format for backward compatibility
 * Used when calling existing global functions
 */
function trackToLegacyFormat(track) {
    return {
        id: track.externalIds?.spotify || track.id,
        name: track.title,
        artist: track.artistString,
        artists: track.artists.map(name => ({ name })),
        album: track.album ? { name: track.album, images: [{ url: track.coverArt }] } : null,
        image: track.coverArt,
        preview_url: track.metadata?.previewUrl,
        duration_ms: track.duration,
        // Legacy fields
        trackId: track.externalIds?.spotify,
        trackName: track.title,
        previewUrl: track.metadata?.previewUrl
    };
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export default {
    renderTrackItem,
    renderTrackList,
    renderTrackCard
};
