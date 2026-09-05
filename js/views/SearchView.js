import { followArtist, unfollowArtist } from '../services/library.js';
/**
 * Search View
 * Displays search results for artists, tracks, and albums
 */
import { Component } from '../core/Component.js';
import { store } from '../state/store.js';
import { performSearch } from '../services/search.js';
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
                    <i class="fa-solid fa-arrow-left"></i> Back to Dashboard
                </button>

                <!-- Artist Content -->
                <div id="artistContent" class="hidden">
                    <div class="flex flex-col md:flex-row items-center gap-8 mb-12 bg-white dark:bg-gradient-to-r dark:from-gray-900 dark:to-gray-800 p-8 rounded-2xl shadow-lg dark:shadow-xl border border-gray-100 dark:border-white/5">
                        <img id="artistImage" src="" class="w-56 h-56 rounded-full object-cover shadow-2xl">
                        <div class="text-center md:text-left flex-1">
                            <h2 id="artistName" class="text-5xl font-extrabold mb-4"></h2>
                            <button id="followBtn" data-action="toggle-follow"
                                class="border border-gray-300 dark:border-gray-500 hover:border-text-light dark:hover:border-white px-6 py-2 rounded-full font-bold uppercase text-xs tracking-widest transition-colors">Follow</button>
                        </div>
                    </div>
                    <h3 class="text-2xl font-bold mb-6">Albums</h3>
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
            target.innerHTML = '<div class="text-center py-12 text-text-secondary-light dark:text-text-secondary-dark"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Aranıyor...</div>';
        }
        try {
            this.results = await performSearch(this.query, this.searchType);
            if (!this.isMounted) return;
            this.displayResults();
        } catch (error) {
            if (target) {
                target.textContent = error.message || 'Arama tamamlanamadı. Lütfen yeniden deneyin.';
                target.classList.add('text-center', 'py-12', 'text-red-500');
            }
            if (window.showToast) {
                window.showToast('❌ Arama başarısız', 'error');
            }
        }
    }

    displayResults() {
        if (!this.results || this.results.length === 0) {
            this.setHTML(`
                <div class="w-full max-w-6xl animate-fade-in text-center py-12">
                    <i class="fa-solid fa-search text-4xl text-gray-400 mb-4"></i>
                    <p class="text-text-secondary-light dark:text-text-secondary-dark">Sonuç bulunamadı</p>
                </div>
            `);
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

        const artistContent = this.querySelector('#artistContent');
        const artistImage = this.querySelector('#artistImage');
        const artistName = this.querySelector('#artistName');
        const followBtn = this.querySelector('#followBtn');
        const albumsGrid = this.querySelector('#albumsGrid');

        if (artistContent) artistContent.classList.remove('hidden');
        if (artistImage) artistImage.src = artist.image || '/js/placeholder.svg';
        if (artistName) artistName.textContent = artist.name;
        if (followBtn) {
            const isFollowed = store.followedArtists.some(a => a.artistId === artist.id);
            followBtn.textContent = isFollowed ? 'Unfollow' : 'Follow';
        }
        if (albumsGrid) {
            albumsGrid.replaceChildren();
            for (const album of artist.albums || []) {
                const card = document.createElement('button');
                card.className = 'p-3 rounded-xl bg-white dark:bg-card-dark text-left';
                const img = document.createElement('img');
                img.src = album.image || '/js/placeholder.svg';
                img.className = 'w-full aspect-square rounded-lg mb-2';
                const title = document.createElement('span');
                title.textContent = album.name;
                card.append(img, title);
                card.addEventListener('click', () => window.openAlbumDetail(album.id));
                albumsGrid.append(card);
            }
        }
    }

    displayTrackResults() {
        const trackResults = this.querySelector('#trackResults');
        if (!trackResults) return;

        trackResults.classList.remove('hidden');
        trackResults.innerHTML = this.results.map(track => `
            <div class="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition cursor-pointer"
                 data-track-id="${track.id}">
                <img src="${track.image || '/js/placeholder.svg'}"
                     class="w-16 h-16 rounded object-cover">
                <div class="flex-1">
                    <div class="font-bold">${track.name}</div>
                    <div class="text-sm text-text-secondary-light dark:text-text-secondary-dark">${track.artist}</div>
                </div>
                <button class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full text-sm">
                    <i class="fa-solid fa-play"></i>
                </button>
            </div>
        `).join('');

        // Attach track click handlers
        trackResults.querySelectorAll('[data-track-id]').forEach(el => {
            this.addEventListener(el, 'click', () => {
                const trackId = el.getAttribute('data-track-id');
                const track = this.results.find(t => t.id === trackId);
                if (track && window.openTrackDetail) {
                    window.openTrackDetail(trackId, track.name, track.artist, track.image, track.preview_url);
                }
            });
        });
    }

    displayAlbumResults() {
        const albumResults = this.querySelector('#albumResults');
        if (!albumResults) return;

        albumResults.classList.remove('hidden');
        albumResults.innerHTML = this.results.map(album => `
            <div class="bg-white dark:bg-card-dark p-4 rounded-xl cursor-pointer hover:scale-105 transition shadow-sm border border-gray-100 dark:border-white/5"
                 data-album-id="${album.id}">
                <img src="${album.image || '/js/placeholder.svg'}"
                     class="w-full aspect-square rounded-lg object-cover mb-3">
                <div class="font-bold truncate">${album.name}</div>
                <div class="text-sm text-text-secondary-light dark:text-text-secondary-dark truncate">${album.artist}</div>
            </div>
        `).join('');

        // Attach album click handlers
        albumResults.querySelectorAll('[data-album-id]').forEach(el => {
            this.addEventListener(el, 'click', () => {
                const albumId = el.getAttribute('data-album-id');
                if (window.openAlbumDetail) {
                    window.openAlbumDetail(albumId);
                }
            });
        });
    }

    async toggleFollow() {
        if (!this.currentArtist) return;

        if (!store.token) return window.openAuthModal();
        const isFollowed = store.followedArtists.some(a => a.artistId === this.currentArtist.id);
        const ok = isFollowed ? await unfollowArtist(this.currentArtist.id) : await followArtist(this.currentArtist);
        if (ok) this.querySelector('#followBtn').textContent = isFollowed ? 'Follow' : 'Unfollow';
    }
}
