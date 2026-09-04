// Track Row Component
import { playTrack, isPlaying } from './MiniPlayer.js';
import { isTrackLiked, likeTrack, unlikeTrack } from '../services/library.js';
import { getTrackRating } from '../services/rating.js';
import { formatTime } from '../utils.js';

/**
 * Create a track row element
 * @param {Object} track - Track data
 * @param {Object} options - Display options
 * @returns {HTMLElement}
 */
export function createTrackRow(track, options = {}) {
    const {
        showIndex = false,
        index = 0,
        showArtist = true,
        showAlbum = true,
        showDuration = true,
        showRating = true,
        showLikeBtn = true,
        onPlay,
        onClick
    } = options;

    const isLiked = isTrackLiked(track.id);
    const rating = getTrackRating(track.id);
    const playing = isPlaying(track.id);

    const row = document.createElement('div');
    row.className = `track-row flex items-center gap-3 p-3 rounded-lg hover:bg-[#282828] transition group ${playing ? 'bg-[#282828] playing' : ''}`;
    row.dataset.trackId = track.id;

    if (onClick) {
        row.style.cursor = 'pointer';
        row.addEventListener('click', (e) => {
            if (!e.target.closest('button')) onClick(track);
        });
    }

    row.innerHTML = `
        ${showIndex ? `
            <div class="w-8 text-center text-gray-400 group-hover:hidden">${index}</div>
            <button class="w-8 hidden group-hover:block track-play-btn" data-track-id="${track.id}">
                <i class="fa-solid ${playing ? 'fa-pause' : 'fa-play'} text-white"></i>
            </button>
        ` : `
            <button class="w-10 h-10 flex items-center justify-center rounded-full bg-green-500 hover:bg-green-400 transition track-play-btn" data-track-id="${track.id}">
                <i class="fa-solid ${playing ? 'fa-pause' : 'fa-play'} text-black"></i>
            </button>
        `}
        
        <img src="${track.image || 'https://via.placeholder.com/40'}" 
             class="w-10 h-10 rounded object-cover" alt="${track.name}">
        
        <div class="flex-1 min-w-0">
            <div class="font-medium truncate ${playing ? 'text-green-500' : ''}">${track.name}</div>
            ${showArtist ? `<div class="text-xs text-gray-400 truncate">${track.artist}</div>` : ''}
        </div>
        
        ${showAlbum && track.album ? `
            <div class="hidden md:block text-sm text-gray-400 truncate max-w-[200px]">${track.album}</div>
        ` : ''}
        
        ${showRating && rating ? `
            <div class="flex items-center gap-1 text-amber-500">
                <i class="fa-solid fa-star text-xs"></i>
                <span class="text-sm">${rating}</span>
            </div>
        ` : ''}
        
        ${showDuration && track.duration ? `
            <div class="text-sm text-gray-400">${formatTime(track.duration)}</div>
        ` : ''}
        
        ${showLikeBtn ? `
            <button class="like-btn p-2 hover:bg-white/10 rounded-full transition ${isLiked ? 'text-green-500' : 'text-gray-400'}"
                    data-track-id="${track.id}">
                <i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i>
            </button>
        ` : ''}
        
        <button class="p-2 hover:bg-white/10 rounded-full transition text-gray-400 hover:text-white">
            <i class="fa-solid fa-ellipsis"></i>
        </button>
    `;

    // Attach event handlers
    const playBtn = row.querySelector('.track-play-btn');
    if (playBtn) {
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (onPlay) {
                onPlay(track);
            } else {
                playTrack(track);
            }
        });
    }

    const likeBtn = row.querySelector('.like-btn');
    if (likeBtn) {
        likeBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (isLiked) {
                await unlikeTrack(track.id);
            } else {
                await likeTrack(track);
            }
            // Re-render or update button
            likeBtn.classList.toggle('text-green-500');
            likeBtn.classList.toggle('text-gray-400');
            const icon = likeBtn.querySelector('i');
            icon.classList.toggle('fa-solid');
            icon.classList.toggle('fa-regular');
        });
    }

    return row;
}

/**
 * Render track list
 * @param {Array} tracks - Array of track objects
 * @param {string} containerId - Container element ID
 * @param {Object} options - Display options
 */
export function renderTrackList(tracks, containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    tracks.forEach((track, index) => {
        const row = createTrackRow(track, { ...options, index: index + 1 });
        container.appendChild(row);
    });
}

