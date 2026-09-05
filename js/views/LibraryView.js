/**
 * Library view.
 *
 * The three collections behind one route: archived tracks as a table with the
 * mood, rating and note columns from the design, followed artists as cards, and
 * playlists as a grid ending in the "new playlist" tile. The design also drew a
 * duration column; /api/me does not carry track length, so it is left out
 * rather than shipped permanently blank.
 *
 * Track, artist and playlist names are user- or Spotify-supplied, so rows are
 * built as DOM nodes and never interpolated into markup.
 */
import { Component } from '../core/Component.js';
import { store } from '../state/store.js';
import { getLikedTracks, getFollowedArtists, getPlaylists, unlikeTrack } from '../services/library.js';
import { getTrackRating } from '../services/rating.js';
import { el, cover, avatar, stars, kicker, replace, emptyState, errorState, loadingState } from '../core/dom.js';
import { t } from '../services/i18n.js';
import { isAuthenticated } from '../services/auth.js';

const TABS = [
    { id: 'likes', key: 'library.likedSongs' },
    { id: 'follows', key: 'library.following' },
    { id: 'playlists', key: 'library.playlists' }
];

export class LibraryView extends Component {
    constructor(container, props = {}) {
        super(container, props);
        this.router = props.router;
        this.viewType = TABS.some(tab => tab.id === props.queryParams?.type)
            ? props.queryParams.type
            : 'likes';
    }

    render() {
        const counts = {
            likes: store.likedTracks.length,
            follows: store.followedArtists.length,
            playlists: store.playlists.length
        };

        this.container.replaceChildren(el('main', { className: 'ma-main' }, [
            kicker(t('library.title')),
            el('h2', { className: 'ma-page-title', text: t('library.subtitle') }),

            el('div', { style: 'display:flex;gap:8px;margin-top:24px;flex-wrap:wrap' },
                TABS.map(tab => el('button', {
                    className: `ma-pill${tab.id === this.viewType ? ' is-active' : ''}`,
                    attrs: { type: 'button', 'aria-pressed': String(tab.id === this.viewType) },
                    on: { click: () => this.router?.navigate(`library?type=${tab.id}`) }
                }, [
                    t(tab.key),
                    el('span', {
                        className: 'ma-pill-count',
                        attrs: { 'data-count': tab.id },
                        text: String(counts[tab.id])
                    })
                ]))),

            el('div', { className: 'ma-rule', style: 'margin-top:20px' }),
            el('div', { attrs: { id: 'libraryContent' } })
        ]));

        void this.loadContent();
    }

    async loadContent() {
        const content = this.querySelector('#libraryContent');
        if (!content) return;

        if (!isAuthenticated()) {
            replace(content, emptyState('♥', t('library.emptyLikes'), t('library.emptyLikesBody'), el('button', {
                className: 'ma-btn ma-btn-primary',
                style: 'margin-top:24px',
                text: t('auth.login'),
                attrs: { type: 'button' },
                on: { click: () => window.openAuthModal?.() }
            })));
            return;
        }

        replace(content, loadingState(5));

        try {
            switch (this.viewType) {
                case 'follows':
                    await getFollowedArtists({ strict: true });
                    if (this.isMounted) this.renderFollowedArtists();
                    break;
                case 'playlists':
                    await getPlaylists({ strict: true });
                    if (this.isMounted) this.renderPlaylists();
                    break;
                default:
                    await getLikedTracks({ strict: true });
                    if (this.isMounted) this.renderLikedTracks();
            }
        } catch (error) {
            if (!this.isMounted) return;
            replace(content, errorState(t('library.loadFailed'), error.message));
            content.append(el('button', {
                className: 'ma-btn ma-btn-primary', text: t('common.retry'),
                attrs: { type: 'button' }, on: { click: () => this.loadContent() }
            }));
        }
    }

    renderLikedTracks() {
        const content = this.querySelector('#libraryContent');
        const tracks = store.likedTracks;

        if (tracks.length === 0) {
            replace(content, emptyState('♥', t('library.emptyLikes'), t('library.emptyLikesBody'), el('button', {
                className: 'ma-btn ma-btn-primary',
                style: 'margin-top:24px',
                text: t('library.startSearching'),
                attrs: { type: 'button' },
                on: { click: () => this.router?.navigate('search') }
            })));
            return;
        }

        const head = el('div', { className: 'ma-row-head' }, [
            el('div', { style: 'width:36px;flex:0 0 auto' }),
            el('div', { style: 'flex:1 1 auto', text: t('library.colTrack') }),
            el('div', { className: 'ma-col-mood', text: t('library.colMood') }),
            el('div', { className: 'ma-col-stars', text: t('library.colRating') }),
            el('div', { className: 'ma-col-actions' })
        ]);

        replace(content, el('div', {}, [head, ...tracks.map(track => this.trackRow(track))]));
    }

    /**
     * @param {Object} track - a stored like: trackId, trackName, artistName, image, mood, userNote
     * @returns {HTMLElement}
     */
    trackRow(track) {
        const open = () => window.openTrackDetail?.(
            track.trackId, track.trackName, track.artistName, track.image, track.previewUrl
        );

        return el('div', { className: 'ma-row', dataset: { trackId: track.trackId } }, [
            cover(track.image, track.trackName || '', 'ma-cover-sm', {
                tag: 'button',
                attrs: { type: 'button', 'aria-label': track.trackName || '', 'aria-hidden': null },
                on: { click: open }
            }),
            el('div', { className: 'ma-row-main', attrs: { role: 'button', tabindex: '0' }, on: {
                click: open,
                keydown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }
            } }, [
                el('div', { className: 'ma-row-title', text: track.trackName }),
                el('div', { className: 'ma-row-sub', text: track.artistName || '' })
            ]),
            el('div', { className: 'ma-col-mood' }, track.mood ? [el('span', { className: 'ma-tag', text: track.mood })] : []),
            el('div', { className: 'ma-col-stars' }, [stars(getTrackRating(track.trackId))]),
            el('div', { className: 'ma-col-actions' }, [
                track.userNote ? el('button', {
                    className: 'ma-iconbtn',
                    style: 'width:28px;height:28px;color:var(--violet-ink)',
                    text: '✎',
                    attrs: { type: 'button', title: t('library.hasNote'), 'aria-label': t('library.hasNote') },
                    on: { click: open }
                }) : null,
                el('button', {
                    className: 'ma-iconbtn is-on',
                    style: 'width:28px;height:28px',
                    text: '♥',
                    attrs: { type: 'button', title: t('track.unlike'), 'aria-label': t('track.unlike') },
                    // It says "remove from archive", so it removes from the
                    // archive. It used to open the drawer, which left the label
                    // promising something the control did not do.
                    on: { click: event => { event.stopPropagation(); void this.unarchive(track); } }
                })
            ])
        ]);
    }

    /**
     * Remove one track from the archive.
     * @param {{trackId: string}} track
     */
    async unarchive(track) {
        if (await unlikeTrack(track.trackId)) {
            // The store notifies, which repaints the rows and the tab counts.
            this.paintCounts();
        }
    }

    renderFollowedArtists() {
        const content = this.querySelector('#libraryContent');
        const artists = store.followedArtists;

        if (artists.length === 0) {
            replace(content, emptyState('◉', t('library.emptyFollows'), t('library.emptyFollowsBody')));
            return;
        }

        replace(content, el('div', { className: 'ma-grid ma-grid-5', style: 'padding-top:24px' },
            artists.map(artist => el('button', {
                className: 'ma-card',
                style: 'text-align:center',
                attrs: { type: 'button' },
                dataset: { artistId: artist.artistId },
                on: {
                    click: () => this.router?.navigate(
                        `search?q=${encodeURIComponent(artist.artistName)}&type=artist`
                    )
                }
            }, [
                avatar(artist.image, artist.artistName || '', 'ma-avatar-lg', { className: 'ma-mx-auto' }),
                el('div', { style: 'font-size:14px;font-weight:600;margin-top:14px', className: 'ma-truncate', text: artist.artistName })
            ]))));
    }

    renderPlaylists() {
        const content = this.querySelector('#libraryContent');
        const playlists = store.playlists;

        const tiles = playlists.map(playlist => el('button', {
            className: 'ma-card-flush',
            style: 'cursor:pointer;text-align:left;padding:0;color:inherit;font:inherit',
            attrs: { type: 'button' },
            dataset: { playlistId: playlist.id },
            on: { click: () => window.openPlaylistDetails?.(playlist.id) }
        }, [
            cover(playlist.coverImage, playlist.name || '', '', {
                className: 'ma-playlist-cover',
                attrs: { 'aria-hidden': 'true' }
            }),
            el('div', { style: 'padding:14px 16px 16px' }, [
                el('div', { className: 'ma-truncate', style: 'font-size:15px;font-weight:600', text: playlist.name }),
                el('div', {
                    style: 'font-size:12px;color:var(--ink3);margin-top:3px',
                    text: `${playlist.trackCount ?? playlist.PlaylistTracks?.length ?? 0} ${t('common.songs')}`
                })
            ])
        ]));

        tiles.push(el('button', {
            className: 'ma-newtile',
            attrs: { type: 'button' },
            on: { click: () => window.createPlaylist?.() }
        }, [
            el('span', { style: 'font-size:22px', text: '＋' }),
            el('span', { text: t('library.newPlaylist') })
        ]));

        if (playlists.length === 0) {
            replace(content, emptyState('≡', t('library.emptyPlaylists'), t('library.emptyPlaylistsBody'), el('button', {
                className: 'ma-btn ma-btn-primary',
                style: 'margin-top:24px',
                text: t('library.createPlaylist'),
                attrs: { type: 'button' },
                on: { click: () => window.createPlaylist?.() }
            })));
            return;
        }

        replace(content, el('div', { className: 'ma-grid ma-grid-4', style: 'padding-top:24px' }, tiles));
    }

    /**
     * Refresh the numbers on the tab pills in place. They are read once while
     * the screen is built, so without this a playlist created from the empty
     * state showed up as a tile while its pill still said 0.
     */
    paintCounts() {
        const counts = {
            likes: store.likedTracks.length,
            follows: store.followedArtists.length,
            playlists: store.playlists.length
        };
        for (const [id, value] of Object.entries(counts)) {
            const node = this.querySelector(`[data-count="${id}"]`);
            if (node) node.textContent = String(value);
        }
    }

    onMount() {
        // Every collection feeds the tab counts, so all three are watched; only
        // the visible one also repaints its body.
        this.unsubscribers = ['likedTracks', 'followedArtists', 'playlists'].map(key =>
            store.subscribe(key, () => {
                if (!this.isMounted) return;
                this.paintCounts();
                if (key === 'followedArtists' && this.viewType === 'follows') this.renderFollowedArtists();
                else if (key === 'playlists' && this.viewType === 'playlists') this.renderPlaylists();
                else if (key === 'likedTracks' && this.viewType === 'likes') this.renderLikedTracks();
            })
        );
    }

    onUnmount() {
        this.unsubscribers?.forEach(off => off());
    }
}
