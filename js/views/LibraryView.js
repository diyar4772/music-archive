import { empty, error as errorState, loading, signedOut } from '../components/States.js';
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
import { el, cover, avatar, stars, kicker, replace } from '../core/dom.js';
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

            el('div', { className: 'ma-display-flex ma-gap-8 ma-mt-24 ma-wrap-wrap' },
                TABS.map(tab => el('button', {
                    className: `ma-pill${tab.id === this.viewType ? ' is-active' : ''}`,
                    testid: `library-tab-${tab.id}`,
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

            el('div', { className: 'ma-rule ma-mt-20', }),
            el('div', { attrs: { id: 'libraryContent' } })
        ]));

        void this.loadContent();
    }

    async loadContent() {
        const content = this.querySelector('#libraryContent');
        if (!content) return;

        if (!isAuthenticated()) {
            replace(content, signedOut({ next: `library?type=${this.viewType}` }));
            return;
        }

        replace(content, loading({ rows: 8 }));

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
            replace(content, errorState({ error, title: t('library.loadFailed'), retry: () => this.loadContent() }));
        }
    }

    renderLikedTracks() {
        const content = this.querySelector('#libraryContent');
        const tracks = store.likedTracks;

        if (tracks.length === 0) {
            replace(content, empty({ icon: '♥', title: t('library.emptyLikes'), body: t('library.emptyLikesBody'), action: el('button', {
                className: 'ma-btn ma-btn-primary ma-mt-24',
                text: t('library.startSearching'),
                testid: 'library-start-searching',
                attrs: { type: 'button' },
                on: { click: () => this.router?.navigate('search') }
            }) }));
            return;
        }

        const head = el('div', { className: 'ma-row-head' }, [
            el('div', { className: 'ma-w-36 ma-flex-0-0-auto' }),
            el('div', { className: 'ma-flex-1-1-auto', text: t('library.colTrack') }),
            el('div', { className: 'ma-col-mood', text: t('library.colMood') }),
            el('div', { className: 'ma-col-stars', text: t('library.colRating') }),
            el('div', { className: 'ma-col-actions' })
        ]);

        replace(content, el('div', {}, [head, ...tracks.map(track => this.trackRow(track))]));
    }

    /**
     * @param {Object} track - a stored like: trackId, trackName, artistName, image, mood, noteCount
     * @returns {HTMLElement}
     */
    trackRow(track) {
        const open = () => window.openTrackDetail?.(
            track.trackId, track.trackName, track.artistName, track.image, track.previewUrl
        );
        const notes = track.noteCount || 0;

        return el('div', { className: 'ma-row', testid: 'library-track-row', dataset: { trackId: track.trackId } }, [
            cover(track.image, track.trackName || '', 'ma-cover-sm', {
                tag: 'button',
                testid: 'library-track-cover',
                attrs: { type: 'button', 'aria-label': track.trackName || '', 'aria-hidden': null },
                on: { click: open }
            }),
            el('div', { className: 'ma-row-main', testid: 'library-track-open', attrs: { role: 'button', tabindex: '0' }, on: {
                click: open,
                keydown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }
            } }, [
                el('div', { className: 'ma-row-title', text: track.trackName }),
                el('div', { className: 'ma-row-sub', text: track.artistName || '' })
            ]),
            el('div', { className: 'ma-col-mood' }, track.mood ? [el('span', { className: 'ma-tag', text: track.mood })] : []),
            el('div', { className: 'ma-col-stars' }, [stars(getTrackRating(track.trackId))]),
            el('div', { className: 'ma-col-actions' }, [
                // The badge counts journal entries, so a track you have come
                // back to three times reads differently from one you noted once.
                notes ? el('button', {
                    className: 'ma-iconbtn ma-w-28 ma-h-28 ma-color-violet-ink',
                    text: notes > 1 ? `✎${notes}` : '✎',
                    testid: 'library-track-note',
                    attrs: { type: 'button', title: t('journal.count', { n: notes }), 'aria-label': t('journal.count', { n: notes }) },
                    on: { click: open }
                }) : null,
                el('button', {
                    className: 'ma-iconbtn is-on ma-w-28 ma-h-28',
                    text: '♥',
                    testid: 'library-track-unlike',
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
            replace(content, empty({ icon: '◉', title: t('library.emptyFollows'), body: t('library.emptyFollowsBody'), action: { label: t('library.startSearching'), onClick: () => this.router.navigate('search') } }));
            return;
        }

        replace(content, el('div', { className: 'ma-grid ma-grid-5 ma-pt-24', },
            artists.map(artist => el('button', {
                className: 'ma-card ma-align-center',
                testid: 'library-artist',
                attrs: { type: 'button' },
                dataset: { artistId: artist.artistId },
                on: {
                    click: () => this.router?.navigate(
                        `search?q=${encodeURIComponent(artist.artistName)}&type=artist`
                    )
                }
            }, [
                avatar(artist.image, artist.artistName || '', 'ma-avatar-lg', { className: 'ma-mx-auto' }),
                el('div', {  className: 'ma-truncate ma-text-14 ma-weight-600 ma-mt-14', text: artist.artistName })
            ]))));
    }

    renderPlaylists() {
        const content = this.querySelector('#libraryContent');
        const playlists = store.playlists;

        const tiles = playlists.map(playlist => el('button', {
            className: 'ma-card-flush ma-cursor-pointer ma-align-left ma-p-0 ma-color-inherit ma-font-inherit',
            testid: 'library-playlist',
            attrs: { type: 'button' },
            dataset: { playlistId: playlist.id },
            on: { click: () => window.openPlaylistDetails?.(playlist.id) }
        }, [
            cover(playlist.coverImage, playlist.name || '', '', {
                className: 'ma-playlist-cover',
                attrs: { 'aria-hidden': 'true' }
            }),
            el('div', { className: 'ma-p-14-16-16' }, [
                el('div', { className: 'ma-truncate ma-text-15 ma-weight-600',  text: playlist.name }),
                el('div', {
                    className: 'ma-text-12 ma-color-ink3 ma-mt-3',
                    text: `${playlist.trackCount ?? playlist.PlaylistTracks?.length ?? 0} ${t('common.songs')}`
                })
            ])
        ]));

        tiles.push(el('button', {
            className: 'ma-newtile',
            testid: 'library-new-playlist',
            attrs: { type: 'button' },
            on: { click: () => window.createPlaylist?.() }
        }, [
            el('span', { className: 'ma-text-22', text: '＋' }),
            el('span', { text: t('library.newPlaylist') })
        ]));

        if (playlists.length === 0) {
            replace(content, empty({ icon: '≡', title: t('library.emptyPlaylists'), body: t('library.emptyPlaylistsBody'), action: el('button', {
                className: 'ma-btn ma-btn-primary ma-mt-24',
                text: t('library.createPlaylist'),
                testid: 'library-create-playlist',
                attrs: { type: 'button' },
                on: { click: () => window.createPlaylist?.() }
            }) }));
            return;
        }

        replace(content, el('div', { className: 'ma-grid ma-grid-4 ma-pt-24', }, tiles));
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
