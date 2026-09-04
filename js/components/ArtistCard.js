/**
 * ArtistCard Component
 * Renders an artist card for the grid display
 */

/**
 * Creates HTML for an artist card
 * @param {Object} artist - Artist data object (Spotify format + local overrides)
 * @returns {string} HTML string
 */
export function createArtistCard(artist) {
    // Spotify API verilerini işle
    const imageUrl = artist.images && artist.images.length > 0
        ? artist.images[0].url
        : (artist.image || null);

    const genre = artist.genres && artist.genres.length > 0
        ? artist.genres[0].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        : (artist.genre || 'Sanatçı');

    const albumCount = artist.albums?.length || 0; // Bu sonradan yüklenebilir veya gösterilmeyebilir

    return `
        <article class="artist-card animate-slide-up" data-artist-id="${artist.id}" data-spotify-id="${artist.spotifyId || artist.id}">
            <div class="artist-card__image-wrapper">
                ${imageUrl
            ? `<img 
                        src="${imageUrl}" 
                        alt="${artist.name}" 
                        class="artist-card__image"
                        loading="lazy"
                        onerror="this.parentElement.innerHTML='<div class=\\'artist-card__placeholder\\'>🎤</div>'"
                       />`
            : `<div class="artist-card__placeholder">🎤</div>`
        }
                <div class="artist-card__overlay">
                    <h3 class="artist-card__name">${artist.name}</h3>
                    <span class="artist-card__genre">${genre}</span>
                </div>
            </div>
        </article>
    `;
}

/**
 * Renders multiple artist cards to a container
 * @param {Array} artists - Array of artist objects
 * @param {HTMLElement} container - DOM element to render into
 */
export function renderArtistCards(artists, container) {
    if (!container) return;

    if (artists.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state__icon">🎵</div>
                <p class="empty-state__text">Henüz sanatçı eklenmemiş</p>
            </div>
        `;
        return;
    }

    container.innerHTML = artists.map(artist => createArtistCard(artist)).join('');
}
