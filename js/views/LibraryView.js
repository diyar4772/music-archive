/**
 * Library View
 * Displays user's liked tracks, followed artists, and playlists
 */
import { Component } from '../core/Component.js';
import { store } from '../state/store.js';
import { getLikedTracks, getFollowedArtists, getPlaylists } from '../services/library.js';
import { t } from '../services/i18n.js';

export class LibraryView extends Component {
    constructor(container, props = {}) {
        super(container, props);
        this.router = props.router;
        this.viewType = props.queryParams?.type || 'likes'; // likes, follows, playlists
    }

    render() {
        this.setHTML(`
            <div class="w-full max-w-6xl animate-fade-in">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-2xl font-bold" data-lang="library.title">Kütüphanem</h2>
                    <div class="flex flex-wrap justify-end gap-2">
                        <button data-view="likes" 
                            class="px-4 py-2 rounded-full ${this.viewType === 'likes' ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-card-dark text-text-light dark:text-white'}">
                            <i class="fa-solid fa-heart mr-2"></i>Beğenilenler
                        </button>
                        <button data-view="follows"
                            class="px-4 py-2 rounded-full ${this.viewType === 'follows' ? 'bg-purple-500 text-white' : 'bg-gray-100 dark:bg-card-dark text-text-light dark:text-white'}">
                            <i class="fa-solid fa-user mr-2"></i>Takip Edilenler
                        </button>
                        <button data-view="playlists"
                            class="px-4 py-2 rounded-full ${this.viewType === 'playlists' ? 'bg-teal-500 text-white' : 'bg-gray-100 dark:bg-card-dark text-text-light dark:text-white'}">
                            <i class="fa-solid fa-list mr-2"></i>Listelerim
                        </button>
                    </div>
                </div>

                <div id="libraryContent">
                    <!-- Content will be loaded based on viewType -->
                </div>
            </div>
        `);

        this.attachEventListeners();
        this.loadContent();
    }

    attachEventListeners() {
        const viewButtons = this.querySelectorAll('[data-view]');
        viewButtons.forEach(btn => {
            const view = btn.getAttribute('data-view');
            this.addEventListener(btn, 'click', () => {
                if (this.router) {
                    this.router.navigate(`library?type=${view}`);
                }
            });
        });
    }

    async loadContent() {
        const content = this.querySelector('#libraryContent');
        if (!content) return;

        content.innerHTML = '<div class="text-center py-12 text-text-secondary-light dark:text-text-secondary-dark"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Yükleniyor...</div>';

        try {
            switch (this.viewType) {
                case 'likes':
                    await getLikedTracks();
                    this.renderLikedTracks();
                    break;
                case 'follows':
                    await getFollowedArtists();
                    this.renderFollowedArtists();
                    break;
                case 'playlists':
                    await getPlaylists();
                    this.renderPlaylists();
                    break;
            }
        } catch (error) {
            console.error('Failed to load library content:', error);
            content.innerHTML = '<div class="text-center py-12 text-red-500">Kütüphane yüklenemedi. Lütfen yeniden deneyin.</div>';
        }
    }

    renderLikedTracks() {
        const content = this.querySelector('#libraryContent');
        if (!content) return;

        const tracks = store.likedTracks;

        if (tracks.length === 0) {
            content.innerHTML = `
                <div class="text-center py-12">
                    <i class="fa-solid fa-heart text-4xl text-gray-400 mb-4"></i>
                    <p class="text-text-secondary-light dark:text-text-secondary-dark">Henüz beğenilen şarkı yok</p>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="space-y-2">
                ${tracks.map(track => `
                    <div class="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition cursor-pointer"
                         data-track-id="${track.trackId}">
                        <img src="${track.image || 'https://via.placeholder.com/60'}" 
                             class="w-16 h-16 rounded object-cover">
                        <div class="flex-1">
                            <div class="font-bold">${track.trackName}</div>
                            <div class="text-sm text-text-secondary-light dark:text-text-secondary-dark">${track.artistName || ''}</div>
                        </div>
                        <button class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full text-sm">
                            <i class="fa-solid fa-play"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;

        // Attach click handlers
        content.querySelectorAll('[data-track-id]').forEach(el => {
            this.addEventListener(el, 'click', () => {
                const trackId = el.getAttribute('data-track-id');
                const track = tracks.find(t => t.trackId === trackId);
                if (track && window.openTrackDetail) {
                    window.openTrackDetail(trackId, track.trackName, track.artistName, track.image, track.previewUrl);
                }
            });
        });
    }

    renderFollowedArtists() {
        const content = this.querySelector('#libraryContent');
        if (!content) return;

        const artists = store.followedArtists;

        if (artists.length === 0) {
            content.innerHTML = `
                <div class="text-center py-12">
                    <i class="fa-solid fa-user text-4xl text-gray-400 mb-4"></i>
                    <p class="text-text-secondary-light dark:text-text-secondary-dark">Henüz takip edilen sanatçı yok</p>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                ${artists.map(artist => `
                    <div class="bg-white dark:bg-card-dark p-4 rounded-xl cursor-pointer hover:scale-105 transition shadow-sm border border-gray-100 dark:border-white/5 text-center"
                         data-artist-id="${artist.artistId}">
                        <img src="${artist.image || 'https://via.placeholder.com/200'}" 
                             class="w-full aspect-square rounded-full object-cover mb-3">
                        <div class="font-bold truncate">${artist.artistName}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderPlaylists() {
        const content = this.querySelector('#libraryContent');
        if (!content) return;

        const playlists = store.playlists;

        if (playlists.length === 0) {
            content.innerHTML = `
                <div class="text-center py-12">
                    <i class="fa-solid fa-list text-4xl text-gray-400 mb-4"></i>
                    <p class="text-text-secondary-light dark:text-text-secondary-dark">Henüz liste yok</p>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                ${playlists.map(playlist => `
                    <div class="bg-white dark:bg-card-dark p-4 rounded-xl cursor-pointer hover:scale-105 transition shadow-sm border border-gray-100 dark:border-white/5"
                         data-playlist-id="${playlist.id}">
                        <img src="${playlist.coverImage || 'https://via.placeholder.com/200'}" 
                             class="w-full aspect-square rounded-lg object-cover mb-3">
                        <div class="font-bold truncate">${playlist.name}</div>
                        <div class="text-sm text-text-secondary-light dark:text-text-secondary-dark">${playlist.trackCount} şarkı</div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}
