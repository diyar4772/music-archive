/**
 * Search View
 * Displays search results for artists, tracks, and albums.
 *
 * Result names come straight from Spotify, so every row is built as DOM nodes;
 * nothing upstream is ever concatenated into markup.
 */
import { Component } from '../core/Component.js';
import { store } from '../state/store.js';
import { performSearch } from '../services/search.js';
import { followArtist, unfollowArtist, isArtistFollowed } from '../services/library.js';
import { el, img, replace, emptyState, loadingState, PLACEHOLDER_IMAGE } from '../core/dom.js';
import { t } from '../services/i18n.js';

export class SearchView extends Component {
    constructor(container, props = {}) {
        super(container, props);
        this.router = props.router;
        this.query = props.queryParams?.q || '';
        this.searchType = props.queryParams?.type || store.searchType || 'artist';
        this.results = [];
        this.currentArtist = null;
    }

    render() {
        this.setHTML(`
            <div class="w-full max-w-6xl animate-fade-in">
                <button data-action="back"
                    class="mb-6 text-text-secondary-light dark:text-gray-400 hover:text-text-light dark:hover:text-white flex items-center gap-2 transition-colors">
                    <i class="fa-solid fa-arrow-left"></i> <span data-lang="search.backToDashboard">${t('search.backToDashboard')}</span>
                </button>

                <!-- Artist Content -->
                <div id="artistContent" class="hidden">
                    <div class="flex flex-col md:flex-row items-center gap-8 mb-12 bg-white dark:bg-gradient-to-r dark:from-gray-900 dark:to-gray-800 p-8 rounded-2xl shadow-lg dark:shadow-xl border border-gray-100 dark:border-white/5">
                        <img id="artistImage" src="/js/placeholder.svg" alt="" class="w-56 h-56 rounded-full object-cover shadow-2xl">
                        <div class="text-center md:text-left flex-1">
                            <h2 id="artistName" class="text-5xl font-extrabold mb-4"></h2>
                            <button id="followBtn" data-action="toggle-follow"
                                class="border border-gray-300 dark:border-gray-500 hover:border-text-light dark:hover:border-white px-6 py-2 rounded-full font-bold uppercase text-xs tracking-widest transition-colors" type="button"></button>
                        </div>
                    </div>
                    <h3 class="text-2xl font-bold mb-6" data-lang="search.albums">${t('search.albums')}</h3>
                    <div id="albumsGrid" class="grid grid-cols-2 md:grid-cols-5 gap-6"></div>
                </div>

                <!-- Track Results Content -->
                <div id="trackResults" class="hidden space-y-2"></div>

                <!-- Album Results Content -->
                <div id="albumResults" class="hidden grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4"></div>
            </div>
        `);

        this.attachEventListeners();

        if (this.query) {
            this.performSearch();
        }
    }

    attachEventListeners() {
        const backBtn = this.querySelector('[data-action="back"]');
        if (backBtn) {
            this.addEventListener(backBtn, 'click', () => {
                if (this.router) {
                    this.router.navigate('dashboard');
                }
            });
        }

        const followBtn = this.querySelector('[data-action="toggle-follow"]');
        if (followBtn) {
            this.addEventListener(followBtn, 'click', () => {
                this.toggleFollow();
            });
        }
    }

    async performSearch() {
        if (!this.query) return;

        const target = this.querySelector('#trackResults');
        if (target) {
            target.classList.remove('hidden');
            replace(target, loadingState(t('search.searching')));
        }
        try {
            this.results = await performSearch(this.query, this.searchType);
            if (!this.isMounted) return;
            this.displayResults();
        } catch (error) {
            if (!this.isMounted) return;
            if (target) {
                replace(target, emptyState(
                    'fa-solid fa-triangle-exclamation',
                    error.message || t('search.failed'),
                    'text-red-500'
                ));
            }
        }
    }

    displayResults() {
        if (!this.results || this.results.length === 0) {
            const target = this.querySelector('#trackResults');
            if (target) {
                target.classList.remove('hidden');
                replace(target, emptyState('fa-solid fa-magnifying-glass', t('search.noResults', { query: this.query })));
            }
            return;
        }

        this.querySelector('#trackResults')?.classList.add('hidden');
        if (this.searchType === 'artist' && this.results.id) {
            this.displayArtistResults();
        } else if (this.searchType === 'track') {
            this.displayTrackResults();
        } else if (this.searchType === 'album') {
            this.displayAlbumResults();
        }
    }

    displayArtistResults() {
        const artist = this.results;
        this.currentArtist = artist;

        this.querySelector('#artistContent')?.classList.remove('hidden');

        const artistImage = this.querySelector('#artistImage');
        if (artistImage) artistImage.src = artist.image || PLACEHOLDER_IMAGE;

        const artistName = this.querySelector('#artistName');
        if (artistName) artistName.textContent = artist.name;

        this.paintFollowButton();

        const albumsGrid = this.querySelector('#albumsGrid');
        if (!albumsGrid) return;

        const albums = artist.albums || [];
        if (albums.length === 0) {
            replace(albumsGrid, emptyState('fa-solid fa-compact-disc', t('search.noAlbums')));
            return;
        }

        replace(albumsGrid, ...albums.map(album => el('button', {
            className: 'p-3 rounded-xl bg-white dark:bg-card-dark text-left hover:scale-105 transition shadow-sm border border-gray-100 dark:border-white/5',
            attrs: { type: 'button' },
            on: { click: () => window.openAlbumDetail?.(album.id) }
        }, [
            img(album.image, 'w-full aspect-square rounded-lg object-cover mb-2', album.name),
            el('span', { className: 'block font-semibold truncate', text: album.name }),
            album.year && el('span', { className: 'block text-xs text-text-secondary-light dark:text-gray-400', text: album.year })
        ])));
    }

    paintFollowButton() {
        const followBtn = this.querySelector('#followBtn');
        if (!followBtn || !this.currentArtist) return;
        const followed = isArtistFollowed(this.currentArtist.id);
        followBtn.textContent = followed ? t('search.unfollow') : t('search.follow');
        followBtn.classList.toggle('bg-green-500', followed);
        followBtn.classList.toggle('text-white', followed);
        followBtn.classList.toggle('border-green-500', followed);
    }

    displayTrackResults() {
        const trackResults = this.querySelector('#trackResults');
        if (!trackResults) return;

        trackResults.classList.remove('hidden');
        trackResults.className = 'space-y-2';
        replace(trackResults, ...this.results.map(track => el('button', {
            className: 'w-full flex items-center gap-4 p-3 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-white/5 transition-colors',
            attrs: { type: 'button' },
            dataset: { trackId: track.id },
            on: {
                click: () => window.openTrackDetail?.(track.id, track.name, track.artist, track.image, track.preview_url)
            }
        }, [
            img(track.image, 'w-16 h-16 rounded object-cover shrink-0', track.name),
            el('span', { className: 'flex-1 min-w-0' }, [
                el('span', { className: 'block font-bold truncate', text: track.name }),
                el('span', {
                    className: 'block text-sm text-text-secondary-light dark:text-text-secondary-dark truncate',
                    text: track.artist
                })
            ]),
            el('span', {
                className: 'shrink-0 w-10 h-10 flex items-center justify-center bg-green-500 text-white rounded-full',
                html: '<i class="fa-solid fa-play"></i>'
            })
        ])));
    }

    displayAlbumResults() {
        const albumResults = this.querySelector('#albumResults');
        if (!albumResults) return;

        albumResults.classList.remove('hidden');
        replace(albumResults, ...this.results.map(album => el('button', {
            className: 'bg-white dark:bg-card-dark p-4 rounded-xl text-left hover:scale-105 transition shadow-sm border border-gray-100 dark:border-white/5',
            attrs: { type: 'button' },
            dataset: { albumId: album.id },
            on: { click: () => window.openAlbumDetail?.(album.id) }
        }, [
            img(album.image, 'w-full aspect-square rounded-lg object-cover mb-3', album.name),
            el('span', { className: 'block font-bold truncate', text: album.name }),
            el('span', {
                className: 'block text-sm text-text-secondary-light dark:text-text-secondary-dark truncate',
                text: [album.artist, album.year].filter(Boolean).join(' · ')
            })
        ])));
    }

    async toggleFollow() {
        if (!this.currentArtist) return;
        if (!store.token) return window.openAuthModal?.();

        const followed = isArtistFollowed(this.currentArtist.id);
        const ok = followed
            ? await unfollowArtist(this.currentArtist.id)
            : await followArtist(this.currentArtist);
        if (ok) this.paintFollowButton();
    }
}
