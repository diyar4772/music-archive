/**
 * AlbumModal Component
 * Displays album details with track list and Spotify embed player
 */

/**
 * Creates HTML content for the album detail modal
 * @param {Object} album - Album data object
 * @param {string} artistName - Artist name for display
 * @param {string} artistSpotifyId - Artist's Spotify ID for embed (Optional)
 * @returns {string} HTML string
 */
export function createAlbumModalContent(album, artistName, artistSpotifyId) {
    const tracksHtml = generateTracksHtml(album.tracks);

    // Artist embed using Spotify ID
    const embedSrc = `https://open.spotify.com/embed/artist/${artistSpotifyId}`;

    return `
        <div class="album-modal">
            <div class="album-modal__header">
                ${album.cover
            ? `<img src="${album.cover}" alt="${album.title}" class="album-modal__cover" onerror="this.outerHTML='<div class=\\'album-modal__cover-placeholder\\'>💿</div>'">`
            : `<div class="album-modal__cover-placeholder">💿</div>`
        }
                <div class="album-modal__info">
                    <p class="album-modal__artist">${artistName}</p>
                    <h2 class="album-modal__title">${album.title}</h2>
                    <p class="album-modal__year">${album.year} • ${album.tracks?.length || 0} Şarkı</p>
                    
                    <div class="album-modal__actions">
                        <a href="https://open.spotify.com/artist/${artistSpotifyId}" 
                           target="_blank" 
                           rel="noopener" 
                           class="btn btn--spotify">
                            🎧 Spotify'da Dinle
                        </a>
                    </div>
                </div>
            </div>
            
            <!-- Spotify Embed Player - Uses Search Embed -->
            <div class="album-modal__player" id="spotifyPlayerContainer">
                <iframe 
                    src="${embedSrc}"
                    width="100%" 
                    height="352" 
                    frameBorder="0" 
                    allowfullscreen="" 
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    class="spotify-embed"
                ></iframe>
            </div>
            
            <!-- Track List -->
            <div class="album-modal__tracks">
                <h3 class="album-modal__section-title">Şarkılar</h3>
                <div class="tracks-list">
                    ${tracksHtml}
                </div>
            </div>
        </div>
    `;
}

/**
 * Generates HTML for track list
 * @param {Array} tracks - Array of track objects
 * @returns {string} HTML string
 */
function generateTracksHtml(tracks) {
    if (!tracks || tracks.length === 0) {
        return '<p class="tracks-empty">Şarkı bilgisi bulunamadı</p>';
    }

    return tracks.map((track, index) => `
        <div class="track-item" data-track-title="${track.title}" data-track-index="${index}">
            <div class="track-item__number">${index + 1}</div>
            <button class="track-item__play" title="Çal">
                <span class="play-icon">▶</span>
            </button>
            <div class="track-item__info">
                <span class="track-item__title">${track.title}</span>
            </div>
            <div class="track-item__duration">${track.duration || '-'}</div>
        </div>
    `).join('');
}

/**
 * Loads Spotify embed player for a specific track using search
 * @param {string} trackTitle - Track title
 * @param {string} artistName - Artist name
 */
export function loadSpotifySearchPlayer(trackTitle, artistName) {
    const container = document.getElementById('spotifyPlayerContainer');
    if (!container) return;

    const searchQuery = encodeURIComponent(`${artistName} ${trackTitle}`);

    // Create Spotify embed iframe with search
    container.innerHTML = `
        <iframe 
            src="https://open.spotify.com/embed/search/${searchQuery}"
            width="100%" 
            height="152" 
            frameBorder="0" 
            allowfullscreen="" 
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            class="spotify-embed"
        ></iframe>
    `;

    // Add active class for styling
    container.classList.add('active');
}

/**
 * Album Modal Controller Class
 */
export class AlbumModalController {
    constructor(options) {
        this.overlay = null;
        this.currentAlbum = null;
        this.currentArtist = null;
        this.onClose = options.onClose || (() => { });

        this.createModalElement();
        this.init();
    }

    createModalElement() {
        // Check if already exists
        if (document.getElementById('albumModalOverlay')) {
            this.overlay = document.getElementById('albumModalOverlay');
            return;
        }

        // Create modal structure
        const modalHtml = `
            <div class="modal-overlay" id="albumModalOverlay">
                <div class="modal modal--album">
                    <button class="modal__close" id="albumModalClose">&times;</button>
                    <div class="modal__content" id="albumModalContent">
                        <!-- Album content will be injected here -->
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.overlay = document.getElementById('albumModalOverlay');
    }

    init() {
        // Close button
        const closeBtn = document.getElementById('albumModalClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Click outside to close
        if (this.overlay) {
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) {
                    this.close();
                }
            });
        }

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });
    }

    open(album, artistName, artistSpotifyId) {
        this.currentAlbum = album;
        this.currentArtist = artistName;

        const content = document.getElementById('albumModalContent');
        if (content) {
            content.innerHTML = createAlbumModalContent(album, artistName, artistSpotifyId);
        }

        // Setup track click handlers
        this.setupTrackHandlers();

        if (this.overlay) {
            this.overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    close() {
        if (this.overlay) {
            this.overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
        this.onClose();
    }

    isOpen() {
        return this.overlay?.classList.contains('active') || false;
    }

    setupTrackHandlers() {
        const trackItems = document.querySelectorAll('.track-item');

        trackItems.forEach(item => {
            const playBtn = item.querySelector('.track-item__play');
            const trackTitle = item.dataset.trackTitle;

            if (playBtn && trackTitle) {
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();

                    // Remove active from all tracks
                    trackItems.forEach(t => t.classList.remove('playing'));

                    // Add active to current
                    item.classList.add('playing');

                    // Load player with search
                    loadSpotifySearchPlayer(trackTitle, this.currentArtist);
                });
            }

            // Also make the whole row clickable
            item.addEventListener('click', () => {
                if (trackTitle) {
                    trackItems.forEach(t => t.classList.remove('playing'));
                    item.classList.add('playing');
                    loadSpotifySearchPlayer(trackTitle, this.currentArtist);
                }
            });
        });
    }
}
