// Mini Player Component
import { store } from '../state/store.js';
import { formatTime, showToast } from '../utils.js';

let currentAudio = null;
let playingTrackId = null;

/**
 * Play a track preview
 * @param {Object} track - Track object with preview_url
 */
export function playTrack(track) {
    const { id, name, artist, image, preview_url } = track;

    if (!preview_url) {
        showToast('❌ Önizleme mevcut değil');
        return;
    }

    // Stop current audio if playing
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    // If clicking same track, toggle off
    if (playingTrackId === id) {
        playingTrackId = null;
        updatePlayingUI(null);
        hideMiniPlayer();
        return;
    }

    // Play new track
    currentAudio = new Audio(preview_url);
    playingTrackId = id;

    // Update UI
    updateMiniPlayer({ name, artist, image });
    updatePlayingUI(id);
    showMiniPlayer();

    currentAudio.play().catch(err => {
        console.error('Playback error:', err);
        showToast('❌ Oynatma başarısız');
    });

    // Handle track end
    currentAudio.onended = () => {
        playingTrackId = null;
        updatePlayingUI(null);
        hideMiniPlayer();
    };

    // Update progress
    currentAudio.ontimeupdate = () => {
        const progress = (currentAudio.currentTime / currentAudio.duration) * 100;
        const progressBar = document.getElementById('miniPlayerProgress');
        const timeDisplay = document.getElementById('miniPlayerTime');

        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        if (timeDisplay) {
            const current = formatTime(currentAudio.currentTime * 1000);
            const total = formatTime(currentAudio.duration * 1000);
            timeDisplay.innerText = `${current} / ${total}`;
        }
    };
}

/**
 * Toggle play/pause
 */
export function togglePlayPause() {
    if (!currentAudio) return;

    if (currentAudio.paused) {
        currentAudio.play();
        updatePlayPauseButton(true);
    } else {
        currentAudio.pause();
        updatePlayPauseButton(false);
    }
}

/**
 * Stop playback and close mini player
 */
export function stopPlayback() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    playingTrackId = null;
    updatePlayingUI(null);
    hideMiniPlayer();
}

/**
 * Update mini player display
 */
function updateMiniPlayer({ name, artist, image }) {
    const nameEl = document.getElementById('miniPlayerTrack');
    const artistEl = document.getElementById('miniPlayerArtist');
    const imageEl = document.getElementById('miniPlayerImage');

    if (nameEl) nameEl.innerText = name;
    if (artistEl) artistEl.innerText = artist;
    if (imageEl) imageEl.src = image || 'https://via.placeholder.com/60';
}

/**
 * Show mini player
 */
function showMiniPlayer() {
    const player = document.getElementById('miniPlayer');
    if (player) {
        player.classList.remove('translate-y-full');
    }
}

/**
 * Hide mini player
 */
function hideMiniPlayer() {
    const player = document.getElementById('miniPlayer');
    if (player) {
        player.classList.add('translate-y-full');
    }
}

/**
 * Update play/pause button icon
 */
function updatePlayPauseButton(isPlaying) {
    const btn = document.getElementById('miniPlayerPlayBtn');
    if (btn) {
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = isPlaying ? 'fa-solid fa-pause text-xl' : 'fa-solid fa-play text-xl';
        }
    }
}

/**
 * Update playing UI (highlight current track in lists)
 */
function updatePlayingUI(trackId) {
    // Remove playing class from all tracks
    document.querySelectorAll('[data-track-id]').forEach(el => {
        el.classList.remove('playing');
    });

    // Add playing class to current track
    if (trackId) {
        document.querySelectorAll(`[data-track-id="${trackId}"]`).forEach(el => {
            el.classList.add('playing');
        });
    }

    // Update play buttons
    document.querySelectorAll('.track-play-btn').forEach(btn => {
        const icon = btn.querySelector('i');
        if (icon) {
            if (btn.dataset.trackId === trackId) {
                icon.className = 'fa-solid fa-pause';
            } else {
                icon.className = 'fa-solid fa-play';
            }
        }
    });
}

/**
 * Get currently playing track ID
 */
export function getPlayingTrackId() {
    return playingTrackId;
}

/**
 * Check if a track is currently playing
 */
export function isPlaying(trackId) {
    return playingTrackId === trackId;
}

/**
 * Initialize mini player
 */
export function initMiniPlayer() {
    // Play/pause button
    const playBtn = document.getElementById('miniPlayerPlayBtn');
    if (playBtn) {
        playBtn.addEventListener('click', togglePlayPause);
    }

    // Close button
    const closeBtn = document.getElementById('miniPlayerCloseBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', stopPlayback);
    }

    // Expose to global for inline handlers (during transition)
    window.playTrack = playTrack;
    window.toggleMiniPlayer = togglePlayPause;
    window.closeMiniPlayer = stopPlayback;
}

