/**
 * Modal Component
 * Handles modal display and interactions
 */

/**
 * Creates HTML content for the artist detail modal
 * @param {Object} artist - Artist data object
 * @returns {string} HTML string
 */
export function createArtistModalContent(artist) {
    const hasImage = artist.image && artist.image !== null;

    // Generate links HTML
    const linksHtml = generateLinksHtml(artist.links);

    // Generate albums HTML
    const albumsHtml = generateAlbumsHtml(artist.albums);

    return `
        <div class="modal__artist-header">
            ${hasImage
            ? `<img src="${artist.image}" alt="${artist.name}" class="modal__artist-image" onerror="this.outerHTML='<div class=\\'modal__artist-image-placeholder\\'>🎤</div>'">`
            : `<div class="modal__artist-image-placeholder">🎤</div>`
        }
            <div class="modal__artist-info">
                <h2 class="modal__artist-name">${artist.name}</h2>
                <p class="modal__artist-genre">${artist.genre || 'Müzik'}</p>
                <p class="modal__artist-bio">${artist.bio || 'Biyografi bilgisi mevcut değil.'}</p>
                ${linksHtml}
            </div>
        </div>
        
        ${albumsHtml}
    `;
}

/**
 * Generates HTML for external links
 * @param {Object} links - Links object
 * @returns {string} HTML string
 */
function generateLinksHtml(links) {
    if (!links) return '';

    const linkItems = [];

    if (links.wikipedia) {
        linkItems.push(`
            <a href="${links.wikipedia}" target="_blank" rel="noopener" class="modal__link modal__link--wikipedia">
                📖 Wikipedia
            </a>
        `);
    }

    if (links.spotify) {
        linkItems.push(`
            <a href="${links.spotify}" target="_blank" rel="noopener" class="modal__link modal__link--spotify">
                🎧 Spotify
            </a>
        `);
    }

    if (links.youtube) {
        linkItems.push(`
            <a href="${links.youtube}" target="_blank" rel="noopener" class="modal__link modal__link--youtube">
                ▶️ YouTube
            </a>
        `);
    }

    if (links.appleMusic) {
        linkItems.push(`
            <a href="${links.appleMusic}" target="_blank" rel="noopener" class="modal__link modal__link--apple">
                🍎 Apple Music
            </a>
        `);
    }

    if (linkItems.length === 0) return '';

    return `<div class="modal__links">${linkItems.join('')}</div>`;
}

/**
 * Generates HTML for albums grid
 * @param {Array} albums - Array of album objects
 * @returns {string} HTML string
 */
function generateAlbumsHtml(albums) {
    if (!albums || albums.length === 0) {
        return '';
    }

    const albumCards = albums.map(album => `
        <div class="album-card" data-album-id="${album.id}" title="Detaylar için tıkla">
            ${album.image
            ? `<img src="${album.image}" alt="${album.title}" class="album-card__image" onerror="this.outerHTML='<div class=\\'album-card__placeholder\\'>💿</div>'">`
            : `<div class="album-card__placeholder">💿</div>`
        }
            <div class="album-card__info">
                <p class="album-card__title" title="${album.title}">${album.title}</p>
                <p class="album-card__year">${album.year || '-'}</p>
            </div>
        </div>
    `).join('');

    return `
        <div class="modal__section">
            <h3 class="modal__section-title">💿 Albümler (${albums.length}) - <span style="font-size: 0.8em; color: var(--color-text-muted);">Detay için tıkla</span></h3>
            <div class="albums-grid" id="albumsGrid">
                ${albumCards}
            </div>
        </div>
    `;
}

/**
 * Modal Controller Class
 */
export class ModalController {
    constructor(overlayId, modalId, closeButtonId, contentId) {
        this.overlay = document.getElementById(overlayId);
        this.modal = document.getElementById(modalId);
        this.closeButton = document.getElementById(closeButtonId);
        this.content = document.getElementById(contentId);

        this.init();
    }

    init() {
        // Close on button click
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.close());
        }

        // Close on overlay click (outside modal)
        if (this.overlay) {
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) {
                    this.close();
                }
            });
        }

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });
    }

    open(content = '') {
        if (this.content && content) {
            this.content.innerHTML = content;
        }
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
    }

    isOpen() {
        return this.overlay?.classList.contains('active') || false;
    }
}
