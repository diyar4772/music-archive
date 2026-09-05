/**
 * Dashboard View
 * Main library overview with stats, recently added, and top rated
 */
import { Component } from '../core/Component.js';
import { store } from '../state/store.js';
import { getLikedTracks, getFollowedArtists, getAlbumFollows, getPlaylists } from '../services/library.js';
import { getRatings, getAverageRating } from '../services/rating.js';
import { renderRecentlyAdded, renderTopRated } from '../components/Dashboard.js';
import { exportToCSV, exportStats } from '../components/Export.js';
import { t } from '../services/i18n.js';
import { isAuthenticated } from '../services/auth.js';

export class DashboardView extends Component {
    constructor(container, props = {}) {
        super(container, props);
        this.router = props.router;
        // The Router only ever passes { router, queryParams }, so these fall back to
        // the app-level entry points; without the fallback every bento card and the
        // "new playlist" tile silently did nothing.
        this.onOpenProfileModal = props.onOpenProfileModal || (type => window.openProfileModal?.(type));
        this.onCreatePlaylist = props.onCreatePlaylist || (() => window.createPlaylist?.());
    }

    render() {
        if (!isAuthenticated()) {
            this.setHTML(`
                <section class="w-full max-w-5xl mx-auto px-4 animate-fade-in">
                    <div class="text-center pt-6 pb-14 sm:pt-10 sm:pb-20">
                        <span class="inline-flex items-center gap-2 px-3.5 py-1.5 mb-7 rounded-full text-xs sm:text-sm font-semibold
                                     bg-green-500/10 text-green-400 border border-green-500/25">
                            <i class="fa-solid fa-record-vinyl" aria-hidden="true"></i>
                            ${t('landing.badge')}
                        </span>

                        <h2 class="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.08] mb-5">
                            ${t('landing.titleTop')}<br class="hidden sm:block">
                            <span class="spotify-green">${t('landing.titleAccent')}</span>
                        </h2>

                        <p class="text-base sm:text-lg text-text-secondary-light dark:text-text-secondary-dark max-w-xl mx-auto mb-9">
                            ${t('landing.subtitle')}
                        </p>

                        <div class="flex flex-col sm:flex-row justify-center gap-3">
                            <button data-action="register" class="btn-spotify text-white font-bold px-8 py-3.5 rounded-full">
                                ${t('landing.ctaPrimary')}
                            </button>
                            <button data-action="login"
                                class="font-bold px-8 py-3.5 rounded-full border border-gray-300 dark:border-white/15
                                       hover:border-green-500 hover:text-green-400 transition-colors">
                                ${t('auth.login')}
                            </button>
                        </div>
                    </div>

                    <div class="grid gap-4 sm:grid-cols-3 text-left">
                        ${[
                    {
                        icon: 'fa-heart', accent: 'coral', title: t('landing.card1Title'),
                        body: t('landing.card1Body')
                    },
                    {
                        icon: 'fa-star', accent: 'orange', title: t('landing.card2Title'),
                        body: t('landing.card2Body')
                    },
                    {
                        icon: 'fa-pen-nib', accent: 'teal', title: t('landing.card3Title'),
                        body: t('landing.card3Body')
                    }
                ].map(card => `
                            <article class="relative overflow-hidden p-6 rounded-2xl bg-white dark:bg-card-dark
                                            border border-gray-100 dark:border-white/5 shadow-card dark:shadow-card-dark">
                                <div class="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl bg-accent-${card.accent}/10"></div>
                                <div class="w-11 h-11 rounded-xl bg-accent-${card.accent}/15 flex items-center justify-center mb-4">
                                    <i class="fa-solid ${card.icon} text-accent-${card.accent}" aria-hidden="true"></i>
                                </div>
                                <h3 class="font-bold text-lg mb-1.5">${card.title}</h3>
                                <p class="text-sm leading-relaxed text-text-secondary-light dark:text-text-secondary-dark">${card.body}</p>
                            </article>
                        `).join('')}
                    </div>
                </section>
            `);
            this.attachEventListeners();
            return;
        }

        const stats = this.getCollectionStats();

        this.setHTML(`
            <div class="w-full max-w-6xl mx-auto animate-fade-in">
                <h2 class="text-2xl sm:text-3xl font-bold mb-6" data-lang="library.title">${t('library.title')}</h2>

                <!-- Bento Grid Layout -->
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <!-- Liked Songs Card - Hero 2x2 -->
                    <div data-action="likes"
                        class="col-span-1 sm:col-span-2 row-span-2 bg-white dark:bg-card-dark p-6 rounded-2xl cursor-pointer hover:scale-[1.02] transition-all shadow-sm dark:shadow-glow-coral border border-gray-100 dark:border-accent-coral/20 flex flex-col justify-between group relative overflow-hidden">
                        <div class="absolute top-0 right-0 w-32 h-32 bg-accent-coral/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                        <div>
                            <div class="w-14 h-14 bg-accent-coral/20 rounded-2xl flex items-center justify-center mb-4">
                                <i class="fa-solid fa-heart text-2xl text-accent-coral"></i>
                            </div>
                            <h3 class="text-2xl font-bold text-accent-coral text-glow-coral" data-lang="library.likedSongs">${t('library.likedSongs')}</h3>
                            <p class="text-text-secondary-light dark:text-text-secondary-dark mt-1">${t('library.likedSubtitle')}</p>
                        </div>
                        <div class="mt-4">
                            <p class="text-4xl font-bold" id="likedCount">${stats.totalTracks}</p>
                            <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">${t('common.songs')}</p>
                        </div>
                    </div>

                    <!-- Following Card - 2x1 -->
                    <div data-action="follows"
                        class="col-span-1 sm:col-span-2 bg-white dark:bg-card-dark p-5 rounded-2xl cursor-pointer hover:scale-[1.02] transition-all shadow-sm dark:shadow-glow-purple border border-gray-100 dark:border-accent-purple/20 flex items-center gap-4 group relative overflow-hidden">
                        <div class="absolute top-0 right-0 w-24 h-24 bg-accent-purple/10 rounded-full blur-2xl -mr-6 -mt-6"></div>
                        <div class="w-12 h-12 bg-accent-purple/20 rounded-xl flex items-center justify-center flex-shrink-0">
                            <i class="fa-solid fa-user-group text-xl text-accent-purple"></i>
                        </div>
                        <div class="flex-1">
                            <h3 class="text-lg font-bold text-accent-purple" data-lang="library.following">${t('library.following')}</h3>
                            <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark" id="followingCount">${stats.totalArtists} ${t('common.artistsWord')}</p>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-400 group-hover:text-accent-purple transition-colors"></i>
                    </div>

                    <!-- My Playlists Card - 1x1 -->
                    <div data-action="playlists"
                        class="bg-white dark:bg-card-dark p-5 rounded-2xl cursor-pointer hover:scale-[1.02] transition-all shadow-sm dark:shadow-glow-teal border border-gray-100 dark:border-accent-teal/20 flex flex-col justify-between group relative overflow-hidden">
                        <div class="absolute top-0 right-0 w-16 h-16 bg-accent-teal/10 rounded-full blur-xl -mr-4 -mt-4"></div>
                        <div class="w-10 h-10 bg-accent-teal/20 rounded-xl flex items-center justify-center">
                            <i class="fa-solid fa-list text-lg text-accent-teal"></i>
                        </div>
                        <div class="mt-3">
                            <h3 class="font-bold text-accent-teal" data-lang="library.playlists">${t('library.playlists')}</h3>
                            <p class="text-2xl font-bold mt-1" id="playlistCount">${stats.totalPlaylists}</p>
                        </div>
                    </div>

                    <!-- Average Rating Card - 1x1 -->
                    <div class="bg-white dark:bg-card-dark p-5 rounded-2xl shadow-sm dark:shadow-glow-orange border border-gray-100 dark:border-accent-orange/20 flex flex-col justify-between relative overflow-hidden">
                        <div class="absolute top-0 right-0 w-16 h-16 bg-accent-orange/10 rounded-full blur-xl -mr-4 -mt-4"></div>
                        <div class="w-10 h-10 bg-accent-orange/20 rounded-xl flex items-center justify-center">
                            <i class="fa-solid fa-star text-lg text-accent-orange"></i>
                        </div>
                        <div class="mt-3">
                            <h3 class="font-bold text-accent-orange" data-lang="library.averageRating">${t('library.averageRating')}</h3>
                            <p class="text-2xl font-bold mt-1" id="statRating">${stats.avgRating}</p>
                        </div>
                    </div>
                </div>

                <!-- Quick Stats Row -->
                <!-- Create Playlist Button -->
                <div data-action="create-playlist"
                    class="mb-8 bg-white dark:bg-card-dark hover:bg-gray-50 dark:hover:bg-white/5 p-4 rounded-xl cursor-pointer transition-all shadow-sm border-2 border-dashed border-gray-200 dark:border-white/10 flex items-center gap-4 group">
                    <div class="w-12 h-12 bg-gray-100 dark:bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-green-100 dark:group-hover:bg-green-500/20 transition-colors">
                        <i class="fa-solid fa-plus text-xl text-gray-400 group-hover:text-green-500 transition-colors"></i>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-text-secondary-light dark:text-text-secondary-dark group-hover:text-text-light dark:group-hover:text-white transition-colors" data-lang="library.createPlaylist">${t('library.createPlaylist')}</h3>
                        <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">${t('library.organize')}</p>
                    </div>
                </div>

                <!-- Recently Added & Top Rated Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <!-- Recently Added -->
                    <div class="bg-white dark:bg-card-dark rounded-xl p-5 shadow-sm border border-gray-100 dark:border-white/5">
                        <div id="recentlyAddedContainer">
                            <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                                <i class="fa-solid fa-clock text-green-500"></i>
                                ${t('library.recentlyAdded')}
                            </h3>
                            <div class="text-text-secondary-light dark:text-text-secondary-dark text-center py-8">
                                <i class="fa-solid fa-music text-2xl mb-2"></i>
                                <p>${t('library.emptyRecent')}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Top Rated -->
                    <div class="bg-white dark:bg-card-dark rounded-xl p-5 shadow-sm border border-gray-100 dark:border-white/5">
                        <div id="topRatedContainer">
                            <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                                <i class="fa-solid fa-trophy text-amber-500"></i>
                                ${t('library.topRated')}
                            </h3>
                            <div class="text-text-secondary-light dark:text-text-secondary-dark text-center py-8">
                                <i class="fa-solid fa-star text-2xl mb-2"></i>
                                <p>${t('library.emptyRated')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Export Section -->
                <div id="exportContainer" class="mb-8 flex justify-end">
                    <div class="flex gap-2">
                        <button data-action="export-csv"
                            class="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-card-dark hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/5 rounded-lg transition-colors text-sm">
                            <i class="fa-solid fa-file-csv text-green-500"></i>
                            ${t('export.csv')}
                        </button>
                        <button data-action="export-stats"
                            class="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-card-dark hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/5 rounded-lg transition-colors text-sm">
                            <i class="fa-solid fa-download text-blue-500"></i>
                            ${t('export.backup')}
                        </button>
                    </div>
                </div>
            </div>
        `);

        this.attachEventListeners();
        this.updateStats();
        this.loadData();
    }

    attachEventListeners() {
        // Bento grid cards
        const bentoCards = this.querySelectorAll('[data-action]');
        bentoCards.forEach(card => {
            const action = card.getAttribute('data-action');
            this.addEventListener(card, 'click', () => {
                if (action === 'login' || action === 'register') {
                    window.openAuthModal?.(action);
                } else if (action === 'likes' || action === 'follows' || action === 'playlists') {
                    this.onOpenProfileModal(action);
                } else if (action === 'create-playlist') {
                    this.onCreatePlaylist();
                }
            });
        });

        // Export buttons
        const exportCsv = this.querySelector('[data-action="export-csv"]');
        const exportStatsBtn = this.querySelector('[data-action="export-stats"]');
        
        if (exportCsv) {
            this.addEventListener(exportCsv, 'click', () => exportToCSV());
        }

        if (exportStatsBtn) {
            this.addEventListener(exportStatsBtn, 'click', () => exportStats());
        }
    }

    getCollectionStats() {
        return {
            totalTracks: store.likedTracks.length,
            totalArtists: store.followedArtists.length,
            totalAlbums: store.albumFollows.length,
            totalPlaylists: store.playlists.length,
            avgRating: getAverageRating() || '–'
        };
    }

    updateStats() {
        const stats = this.getCollectionStats();
        
        const likedCount = this.querySelector('#likedCount');
        const followingCount = this.querySelector('#followingCount');
        const playlistCount = this.querySelector('#playlistCount');
        const statRating = this.querySelector('#statRating');
        const statTracks = this.querySelector('#statTracks');
        const statArtists = this.querySelector('#statArtists');
        const statPlaylists = this.querySelector('#statPlaylists');

        if (likedCount) likedCount.textContent = stats.totalTracks;
        if (followingCount) followingCount.textContent = `${stats.totalArtists} ${t('common.artistsWord')}`;
        if (playlistCount) playlistCount.textContent = stats.totalPlaylists;
        if (statRating) statRating.textContent = stats.avgRating;
        if (statTracks) statTracks.textContent = stats.totalTracks;
        if (statArtists) statArtists.textContent = stats.totalArtists;
        if (statPlaylists) statPlaylists.textContent = stats.totalPlaylists;
    }

    async loadData() {
        if (!isAuthenticated()) return;
        const recent = this.querySelector('#recentlyAddedContainer');
        const topRated = this.querySelector('#topRatedContainer');
        const loading = `<div class="text-center py-8 text-text-secondary-light dark:text-text-secondary-dark"><i class="fa-solid fa-spinner fa-spin mr-2"></i>${t('common.loading')}</div>`;
        if (recent) recent.innerHTML = loading;
        if (topRated) topRated.innerHTML = loading;
        try {
            await Promise.all([
                getLikedTracks(),
                getFollowedArtists(),
                getAlbumFollows(),
                getPlaylists(),
                getRatings()
            ]);

            this.updateStats();
            renderRecentlyAdded();
            renderTopRated();
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            const errorState = `<div class="text-center py-8 text-red-500">${t('library.dataFailed')}</div>`;
            if (recent) recent.innerHTML = errorState;
            if (topRated) topRated.innerHTML = errorState;
        }
    }

    onMount() {
        // Subscribe to store changes
        this.unsubscribeLikes = store.subscribe('likedTracks', () => {
            this.updateStats();
            renderRecentlyAdded();
        });

        this.unsubscribeArtists = store.subscribe('followedArtists', () => {
            this.updateStats();
        });

        this.unsubscribePlaylists = store.subscribe('playlists', () => {
            this.updateStats();
        });

        this.unsubscribeRatings = store.subscribe('userRatings', () => {
            this.updateStats();
            renderTopRated();
        });

        // Load data if not already loaded
        if (!isAuthenticated()) return;
        if (store.likedTracks.length === 0) {
            this.loadData();
        } else {
            this.updateStats();
            renderRecentlyAdded();
            renderTopRated();
        }
    }

    onUnmount() {
        if (this.unsubscribeLikes) this.unsubscribeLikes();
        if (this.unsubscribeArtists) this.unsubscribeArtists();
        if (this.unsubscribePlaylists) this.unsubscribePlaylists();
        if (this.unsubscribeRatings) this.unsubscribeRatings();
    }
}
