import { empty, error as errorState, loading } from '../components/States.js';
/**
 * Search view.
 *
 * Owns the search field (SearchBar mounts into this screen now) and paints the
 * three result shapes the API returns: a single artist with its discography for
 * `artist`, and flat lists for `track` and `album`.
 *
 * Result names come straight from Spotify, so every row is built as DOM nodes;
 * nothing upstream is ever concatenated into markup.
 */
import { Component } from '../core/Component.js';
import { store } from '../state/store.js';
import { performSearch } from '../services/search.js';
import {
    followArtist, unfollowArtist, isArtistFollowed, isAlbumFollowed,
    likeTrack, unlikeTrack, isTrackLiked
} from '../services/library.js';
import { getTrackRating } from '../services/rating.js';
import { el, cover, avatar, stars, kicker, replace } from '../core/dom.js';
import { SearchBar } from '../components/SearchBar.js';
import { t } from '../services/i18n.js';

/** Error codes that mean "the archive is fine, only Spotify is out of reach". */
const UPSTREAM_CODES = new Set([
    'SEARCH_UNAVAILABLE',
    'SEARCH_UPSTREAM_AUTH_FAILED',
    'SEARCH_UPSTREAM_FAILED',
    'SEARCH_RATE_LIMITED',
    'SEARCH_TIMEOUT'
]);

export class SearchView extends Component {
    constructor(container, props = {}) {
        super(container, props);
        this.router = props.router;
        this.query = props.queryParams?.q || '';
        this.searchType = props.queryParams?.type || store.searchType || 'artist';
        this.results = null;
        this.currentArtist = null;
        this.searchBar = null;
    }

    render() {
        const head = el('div', { attrs: { id: 'searchBarHost' } });

        this.container.replaceChildren(el('main', { className: 'ma-main' }, [
            head,
            el('div', { className: 'ma-rule ma-mt-24', }),
            el('div', { attrs: { id: 'searchResults' } })
        ]));

        this.searchBar?.unmount();
        this.searchBar = new SearchBar(head, {
            router: this.router,
            query: this.query,
            onSearch: query => this.router?.navigate(
                `search?q=${encodeURIComponent(query)}&type=${store.searchType}`
            )
        });
        this.searchBar.mount();

        if (this.query) void this.runSearch();
        else this.showStartState();
    }

    /** @returns {Element|null} */
    get results_() {
        return this.querySelector('#searchResults');
    }

    showStartState() {
        replace(this.results_, empty({ icon: '⌕', title: t('search.startTitle'), body: t('search.startBody'), action: { label: t('search.startTitle'), onClick: () => this.querySelector('#searchInput')?.focus() } }));
    }

    async runSearch() {
        replace(this.results_, loading({ rows: 6 }));

        try {
            this.results = await performSearch(this.query, this.searchType);
            if (!this.isMounted) return;
            this.displayResults();
        } catch (error) {
            if (!this.isMounted) return;
            if (UPSTREAM_CODES.has(error.code)) this.showUpstreamNotice();
            else replace(this.results_, errorState({ error, title: t('search.failed'), retry: () => this.runSearch() }));
        }
    }

    /** The designed 503 card: search is out, the archive still works. */
    showUpstreamNotice() {
        replace(this.results_, el('div', { className: 'ma-card-flush ma-mt-28', }, [
            el('div', { className: 'ma-notice' }, [
                el('div', { className: 'ma-notice-mark', text: '!' }),
                el('div', {}, [
                    el('div', { className: 'ma-text-17 ma-weight-600', text: t('search.unavailableTitle') }),
                    el('div', {
                        className: 'ma-text-13 ma-color-ink2 ma-mt-6 ma-line-height-1-6',
                        text: t('states.searchUnavailable')
                    }),
                    el('div', { className: 'ma-display-flex ma-gap-10 ma-mt-16 ma-wrap-wrap' }, [
                        el('button', {
                            className: 'ma-btn ma-btn-secondary ma-btn-sm',
                            text: t('common.retry'),
                            testid: 'search-retry',
                            attrs: { type: 'button' },
                            on: { click: () => void this.runSearch() }
                        }),
                        el('button', {
                            className: 'ma-btn ma-btn-ghost ma-btn-sm',
                            text: t('search.backToLibrary'),
                            testid: 'search-back-to-library',
                            attrs: { type: 'button' },
                            on: { click: () => this.router?.navigate('library') }
                        })
                    ])
                ])
            ])
        ]));
    }

    displayResults() {
        const isEmpty = !this.results || (Array.isArray(this.results) && this.results.length === 0);
        if (isEmpty) {
            replace(this.results_, empty({ icon: '⌕', title: t('search.emptyTitle', { query: this.query }), body: t('search.emptyBody'), action: { label: t('search.startTitle'), onClick: () => this.querySelector('#searchInput')?.focus() } }));
            return;
        }

        if (this.searchType === 'artist' && this.results.id) this.displayArtist();
        else if (this.searchType === 'track') this.displayTracks();
        else if (this.searchType === 'album') this.displayAlbums();
        else this.displayArtistList();
    }

    /* ── artist page ─────────────────────────────────────────────────── */

    displayArtist() {
        const artist = this.results;
        this.currentArtist = artist;
        const albums = artist.albums || [];
        const archived = albums.filter(album => isAlbumFollowed(album.id)).length;
        const pct = albums.length ? Math.round((archived / albums.length) * 100) : 0;

        replace(this.results_, el('div', {}, [
            el('section', { className: 'ma-artist-hero ma-mt-0', }, [
                el('div', { className: 'ma-artist-hero-inner ma-pl-0 ma-pr-0', }, [
                    avatar(artist.image, artist.name || '', 'ma-avatar-xl'),
                    el('div', { className: 'ma-flex-1-1-auto ma-min-w-0' }, [
                        kicker(t('artist.kicker')),
                        el('h2', { className: 'ma-artist-name', text: artist.name }),
                        el('div', {
                            className: 'ma-text-14 ma-color-ink2 ma-mt-10',
                            text: t('artist.meta', { total: albums.length, tracks: archived })
                        }),
                        el('div', { className: 'ma-display-flex ma-gap-10 ma-mt-24 ma-wrap-wrap' }, [
                            el('button', {
                                className: 'ma-btn',
                                testid: 'artist-follow',
                                attrs: { type: 'button', id: 'followBtn' },
                                on: { click: () => void this.toggleFollow() }
                            })
                        ])
                    ]),
                    this.coverageCard(albums, archived, pct)
                ])
            ]),

            el('div', { className: 'ma-display-flex ma-items-center ma-justify-space-between ma-m-32-0-18 ma-gap-12' }, [
                kicker(t('artist.discography')),
                el('span', { className: 'ma-text-11 ma-color-ink3', text: t('common.results', { n: albums.length }) })
            ]),

            albums.length === 0
                ? empty({ icon: '≡', title: t('search.noAlbums'), body: '' })
                : el('div', { className: 'ma-grid ma-grid-4 ma-gap-20', },
                    albums.map(album => this.albumTile(album, isAlbumFollowed(album.id))))
        ]));

        this.paintFollowButton();
    }

    /**
     * @param {Array} albums
     * @param {number} archived
     * @param {number} pct
     * @returns {HTMLElement}
     */
    coverageCard(albums, archived, pct) {
        return el('div', { className: 'ma-card ma-coverage' }, [
            kicker(t('artist.coverage')),
            el('div', { className: 'ma-display-flex ma-items-baseline ma-gap-8 ma-mt-14 ma-wrap-wrap' }, [
                el('span', { className: 'ma-text-34 ma-weight-700 ma-letter-spacing-0-03em', text: `${pct}%` }),
                el('span', {
                    className: 'ma-text-13 ma-color-ink2',
                    text: t('artist.coverageBody', { total: albums.length, archived })
                })
            ]),
            el('div', { className: 'ma-meter ma-mt-16', }, [
                el('div', { className: 'ma-meter-fill', style: `--fill:${pct}%` })
            ]),
            el('div', { className: 'ma-ticks ma-mt-14', },
                albums.slice(0, 24).map(album => el('div', {
                    className: `ma-tick${isAlbumFollowed(album.id) ? ' is-on' : ''}`
                }))),
            el('div', { className: 'ma-text-11 ma-color-ink3 ma-mt-10', text: t('artist.tickHint') })
        ]);
    }

    /**
     * @param {{id: string, name: string, image?: string, year?: string}} album
     * @param {boolean} inArchive
     * @returns {HTMLElement}
     */
    albumTile(album, inArchive) {
        const art = cover(album.image, album.name || '', 'ma-cover-fill');
        if (!inArchive) art.classList.add('ma-art-unarchived');

        return el('button', {
            className: 'ma-tile',
            testid: 'search-album',
            attrs: { type: 'button' },
            dataset: { albumId: album.id },
            on: { click: () => window.openAlbumDetail?.(album.id) }
        }, [
            el('div', { className: 'ma-position-relative' }, [
                art,
                inArchive ? el('span', { className: 'ma-album-flag', text: t('artist.inArchive') }) : null
            ]),
            el('div', { className: 'ma-truncate ma-text-15 ma-weight-500 ma-mt-12',  text: album.name }),
            el('div', {
                className: 'ma-text-12 ma-color-ink3 ma-mt-2',
                text: [album.artist, album.year].filter(Boolean).join(' · ')
            })
        ]);
    }

    paintFollowButton() {
        const button = this.querySelector('#followBtn');
        if (!button || !this.currentArtist) return;
        const followed = isArtistFollowed(this.currentArtist.id);
        button.textContent = followed ? t('search.unfollow') : t('search.follow');
        button.className = `ma-btn ${followed ? 'ma-btn-secondary' : 'ma-btn-primary'}`;
    }

    async toggleFollow() {
        if (!this.currentArtist) return;
        if (!store.token) return window.openAuthModal?.();

        const followed = isArtistFollowed(this.currentArtist.id);
        const ok = followed
            ? await unfollowArtist(this.currentArtist.id)
            : await followArtist({
                id: this.currentArtist.id,
                name: this.currentArtist.name,
                image: this.currentArtist.image
            });
        if (ok) this.paintFollowButton();
    }

    /* ── list results ────────────────────────────────────────────────── */

    /** The `artist` type can also come back as a plain list from autocomplete. */
    displayArtistList() {
        replace(this.results_, this.section(t('search.artists'), this.results.length,
            el('div', { className: 'ma-grid ma-grid-6' }, this.results.map(artist => el('button', {
                className: 'ma-card ma-align-center',
                testid: 'search-artist',
                attrs: { type: 'button' },
                on: { click: () => this.router?.navigate(`search?q=${encodeURIComponent(artist.name)}&type=artist`) }
            }, [
                avatar(artist.image, artist.name || '', 'ma-avatar-md', { className: 'ma-mx-auto' }),
                el('div', { className: 'ma-truncate ma-text-14 ma-weight-500 ma-mt-14',  text: artist.name }),
                el('div', { className: 'ma-truncate ma-text-11 ma-color-ink3 ma-mt-2',  text: artist.genres || '' })
            ])))));
    }

    displayTracks() {
        replace(this.results_, this.section(t('search.tracks'), this.results.length,
            el('div', { className: 'ma-rows' }, this.results.map(track => this.trackRow(track)))));
    }

    /**
     * @param {{id: string, name: string, artist: string, image?: string, preview_url?: string}} track
     * @returns {HTMLElement}
     */
    trackRow(track) {
        const open = () => window.openTrackDetail?.(track.id, track.name, track.artist, track.image, track.preview_url);

        return el('div', { className: 'ma-row', testid: 'search-track-row', dataset: { trackId: track.id } }, [
            cover(track.image, track.name || '', 'ma-cover-sm', {
                tag: 'button',
                testid: 'search-track-cover',
                attrs: { type: 'button', 'aria-label': track.name || '', 'aria-hidden': null },
                on: { click: open }
            }),
            el('div', { className: 'ma-row-main', testid: 'search-track-open', attrs: { role: 'button', tabindex: '0' }, on: {
                click: open,
                keydown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }
            } }, [
                el('div', { className: 'ma-row-title', text: track.name }),
                el('div', { className: 'ma-row-sub', text: track.artist || '' })
            ]),
            el('div', { className: 'ma-col-stars' }, [stars(getTrackRating(track.id))]),
            el('div', { className: 'ma-col-actions' }, [
                el('button', {
                    // Reflect what is already in the archive: searching for a
                    // track you saved last week used to show an empty heart.
                    className: `ma-iconbtn${isTrackLiked(track.id) ? ' is-on' : ''}`,
                    text: '♥',
                    testid: 'search-track-archive',
                    attrs: {
                        type: 'button',
                        title: isTrackLiked(track.id) ? t('track.unlike') : t('search.archive'),
                        'aria-label': isTrackLiked(track.id) ? t('track.unlike') : t('search.archive')
                    },
                    on: { click: event => void this.toggleArchive(track, event.currentTarget) }
                }),
                el('button', {
                    className: 'ma-iconbtn',
                    text: '⋯',
                    testid: 'search-track-details',
                    attrs: { type: 'button', 'aria-label': t('track.details') },
                    on: { click: open }
                })
            ])
        ]);
    }

    /**
     * Add the track to the archive, or take it back out.
     * @param {Object} track
     * @param {HTMLElement} button
     */
    async toggleArchive(track, button) {
        if (!store.token) return window.openAuthModal?.();

        const wasLiked = isTrackLiked(track.id);
        const ok = wasLiked ? await unlikeTrack(track.id) : await likeTrack(track);
        if (!ok) return;

        const liked = isTrackLiked(track.id);
        const label = liked ? t('track.unlike') : t('search.archive');
        button.classList.toggle('is-on', liked);
        button.title = label;
        button.setAttribute('aria-label', label);
    }

    displayAlbums() {
        replace(this.results_, this.section(t('search.albums'), this.results.length,
            el('div', { className: 'ma-grid ma-grid-5' },
                this.results.map(album => this.albumTile(album, isAlbumFollowed(album.id))))));
    }

    /**
     * @param {string} title
     * @param {number} count
     * @param {Node} body
     * @returns {HTMLElement}
     */
    section(title, count, body) {
        return el('section', { className: 'ma-p-28-0-0' }, [
            el('div', { className: 'ma-display-flex ma-items-center ma-justify-space-between ma-mb-16 ma-gap-12' }, [
                kicker(title),
                el('span', { className: 'ma-text-11 ma-color-ink3', text: t('search.resultCount', { n: count }) })
            ]),
            body
        ]);
    }

    onMount() {
        // A follow or an archive made elsewhere should repaint this screen's
        // buttons rather than leave them showing the previous state.
        this.unsubscribeFollows = store.subscribe('followedArtists', () => this.paintFollowButton());
    }

    onUnmount() {
        this.unsubscribeFollows?.();
        this.searchBar?.unmount();
    }
}
