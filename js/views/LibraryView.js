/**
 * Library View
 * Displays the user's liked tracks, followed artists and playlists.
 *
 * Track, artist and playlist names are user- or Spotify-supplied, so rows are
 * built as DOM nodes and never interpolated into markup.
 */
import { Component } from '../core/Component.js';
import { store } from '../state/store.js';
import { getLikedTracks, getFollowedArtists, getPlaylists } from '../services/library.js';
import { el, img, replace, emptyState, loadingState } from '../core/dom.js';
import { t } from '../services/i18n.js';

const TABS = [
    { id: 'likes', key: 'library.likedSongs', icon: 'fa-heart', active: 'bg-green-500 text-white' },
    { id: 'follows', key: 'library.following', icon: 'fa-user', active: 'bg-purple-500 text-white' },
    { id: 'playlists', key: 'library.playlists', icon: 'fa-list', active: 'bg-teal-500 text-white' }
];

const IDLE_TAB = 'bg-gray-100 dark:bg-card-dark text-text-light dark:text-white';
const GRID = 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4';
const CARD = 'bg-white dark:bg-card-dark p-4 rounded-xl text-left hover:scale-105 transition shadow-sm border border-gray-100 dark:border-white/5';

export class LibraryView extends Component {
    constructor(container, props = {}) {
        super(container, props);
        this.router = props.router;
        this.viewType = TABS.some(tab => tab.id === props.queryParams?.type)
            ? props.queryParams.type
            : 'likes';
    }

    render() {
        const root = el('div', { className: 'w-full max-w-6xl mx-auto animate-fade-in' }, [
            el('div', { className: 'flex flex-wrap items-center justify-between gap-3 mb-6' }, [
                el('h2', { className: 'text-2xl font-bold', text: t('library.title'), attrs: { 'data-lang': 'library.title' } }),
                el('div', { className: 'flex flex-wrap gap-2' }, TABS.map(tab => el('button', {
                    className: `px-4 py-2 rounded-full text-sm font-semibold transition-colors ${this.viewType === tab.id ? tab.active : IDLE_TAB}`,
                    attrs: { type: 'button', 'aria-pressed': String(this.viewType === tab.id) },
                    on: { click: () => this.router?.navigate(`library?type=${tab.id}`) }
                }, [
                    el('i', { className: `fa-solid ${tab.icon} mr-2` }),
                    t(tab.key)
                ])))
            ]),
            el('div', { attrs: { id: 'libraryContent' } })
        ]);

        replace(this.container, root);
        this.loadContent();
    }

    async loadContent() {
        const content = this.querySelector('#libraryContent');
        if (!content) return;

        replace(content, loadingState(t('common.loading')));

        try {
            switch (this.viewType) {
                case 'follows':
                    await getFollowedArtists();
                    if (this.isMounted) this.renderFollowedArtists();
                    break;
                case 'playlists':
                    await getPlaylists();
                    if (this.isMounted) this.renderPlaylists();
                    break;
                default:
                    await getLikedTracks();
                    if (this.isMounted) this.renderLikedTracks();
            }
        } catch (error) {
            console.error('Failed to load library content:', error);
            replace(content, emptyState('fa-solid fa-triangle-exclamation', t('library.loadFailed'), 'text-red-500'));
        }
    }

    renderLikedTracks() {
        const content = this.querySelector('#libraryContent');
        const tracks = store.likedTracks;

        if (tracks.length === 0) {
            replace(content, emptyState('fa-solid fa-heart', t('library.emptyLikes')));
            return;
        }

        replace(content, el('div', { className: 'space-y-2' }, tracks.map(track => el('button', {
            className: 'w-full flex items-center gap-4 p-3 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-white/5 transition-colors',
            attrs: { type: 'button' },
            dataset: { trackId: track.trackId },
            on: {
                click: () => window.openTrackDetail?.(
                    track.trackId, track.trackName, track.artistName, track.image, track.previewUrl
                )
            }
        }, [
            img(track.image, 'w-16 h-16 rounded object-cover shrink-0', track.trackName),
            el('span', { className: 'flex-1 min-w-0' }, [
                el('span', { className: 'block font-bold truncate', text: track.trackName }),
                el('span', {
                    className: 'block text-sm text-text-secondary-light dark:text-text-secondary-dark truncate',
                    text: track.artistName || ''
                }),
                track.userNote && el('span', {
                    className: 'block text-xs text-text-secondary-light dark:text-gray-500 truncate mt-0.5',
                    text: `📝 ${track.userNote}`
                })
            ]),
            el('span', {
                className: 'shrink-0 w-10 h-10 flex items-center justify-center bg-green-500 text-white rounded-full',
                html: '<i class="fa-solid fa-play"></i>'
            })
        ]))));
    }

    renderFollowedArtists() {
        const content = this.querySelector('#libraryContent');
        const artists = store.followedArtists;

        if (artists.length === 0) {
            replace(content, emptyState('fa-solid fa-user', t('library.emptyFollows')));
            return;
        }

        replace(content, el('div', { className: GRID }, artists.map(artist => el('button', {
            className: `${CARD} text-center`,
            attrs: { type: 'button' },
            dataset: { artistId: artist.artistId },
            on: {
                click: () => this.router?.navigate(
                    `search?q=${encodeURIComponent(artist.artistName)}&type=artist`
                )
            }
        }, [
            img(artist.image, 'w-full aspect-square rounded-full object-cover mb-3', artist.artistName),
            el('span', { className: 'block font-bold truncate', text: artist.artistName })
        ]))));
    }

    renderPlaylists() {
        const content = this.querySelector('#libraryContent');
        const playlists = store.playlists;

        if (playlists.length === 0) {
            replace(content, emptyState('fa-solid fa-list', t('library.emptyPlaylists')));
            return;
        }

        replace(content, el('div', { className: GRID }, playlists.map(playlist => el('button', {
            className: CARD,
            attrs: { type: 'button' },
            dataset: { playlistId: playlist.id },
            on: { click: () => window.openPlaylistDetails?.(playlist.id) }
        }, [
            img(playlist.coverImage, 'w-full aspect-square rounded-lg object-cover mb-3', playlist.name),
            el('span', { className: 'block font-bold truncate', text: playlist.name }),
            el('span', {
                className: 'block text-sm text-text-secondary-light dark:text-text-secondary-dark',
                text: `${playlist.trackCount ?? playlist.PlaylistTracks?.length ?? 0} ${t('common.songs')}`
            })
        ]))));
    }
}
