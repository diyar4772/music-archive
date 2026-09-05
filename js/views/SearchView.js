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
import { followArtist, unfollowArtist, isArtistFollowed, isAlbumFollowed, likeTrack } from '../services/library.js';
import { getTrackRating } from '../services/rating.js';
import { el, cover, avatar, stars, kicker, replace, emptyState, errorState, loadingState } from '../core/dom.js';
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
            el('div', { className: 'ma-rule', style: 'margin-top:24px' }),
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
        replace(this.results_, emptyState('⌕', t('search.startTitle'), t('search.startBody')));
    }

    async runSearch() {
        replace(this.results_, loadingState(5));

        try {
            this.results = await performSearch(this.query, this.searchType);
            if (!this.isMounted) return;
            this.displayResults();
        } catch (error) {
            if (!this.isMounted) return;
            if (UPSTREAM_CODES.has(error.code)) this.showUpstreamNotice();
            else replace(this.results_, errorState(t('search.failed'), error.message || ''));
        }
    }

    /** The designed 503 card: search is out, the archive still works. */
    showUpstreamNotice() {
        replace(this.results_, el('div', { className: 'ma-card-flush', style: 'margin-top:28px' }, [
            el('div', { className: 'ma-notice' }, [
                el('div', { className: 'ma-notice-mark', text: '!' }),
                el('div', {}, [
                    el('div', { style: 'font-size:17px;font-weight:600', text: t('search.unavailableTitle') }),
                    el('div', {
                        style: 'font-size:13px;color:var(--ink2);margin-top:6px;line-height:1.6',
                        text: t('search.unavailableBody')
                    }),
                    el('div', { style: 'display:flex;gap:10px;margin-top:16px;flex-wrap:wrap' }, [
                        el('button', {
                            className: 'ma-btn ma-btn-secondary ma-btn-sm',
                            text: t('common.retry'),
                            attrs: { type: 'button' },
                            on: { click: () => void this.runSearch() }
                        }),
                        el('button', {
                            className: 'ma-btn ma-btn-ghost ma-btn-sm',
                            text: t('search.backToLibrary'),
                            attrs: { type: 'button' },
                            on: { click: () => this.router?.navigate('library') }
                        })
                    ])
                ])
            ])
        ]));
    }

    displayResults() {
        const empty = !this.results || (Array.isArray(this.results) && this.results.length === 0);
        if (empty) {
            replace(this.results_, emptyState('⌕', t('search.emptyTitle', { query: this.query }), t('search.emptyBody')));
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
            el('section', { className: 'ma-artist-hero', style: 'margin-top:0' }, [
                el('div', { className: 'ma-artist-hero-inner', style: 'padding-left:0;padding-right:0' }, [
                    avatar(artist.image, artist.name || '', 'ma-avatar-xl'),
                    el('div', { style: 'flex:1 1 auto;min-width:0' }, [
                        kicker(t('artist.kicker')),
                        el('h2', { className: 'ma-artist-name', text: artist.name }),
                        el('div', {
                            style: 'font-size:14px;color:var(--ink2);margin-top:10px',
                            text: t('artist.meta', { total: albums.length, tracks: archived })
                        }),
                        el('div', { style: 'display:flex;gap:10px;margin-top:24px;flex-wrap:wrap' }, [
                            el('button', {
                                className: 'ma-btn',
                                attrs: { type: 'button', id: 'followBtn' },
                                on: { click: () => void this.toggleFollow() }
                            })
                        ])
                    ]),
                    this.coverageCard(albums, archived, pct)
                ])
            ]),

            el('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin:32px 0 18px;gap:12px' }, [
                kicker(t('artist.discography')),
                el('span', { style: 'font-size:11px;color:var(--ink3)', text: t('common.results', { n: albums.length }) })
            ]),

            albums.length === 0
                ? emptyState('≡', t('search.noAlbums'), '')
                : el('div', { className: 'ma-grid ma-grid-4', style: 'gap:20px' },
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
            el('div', { style: 'display:flex;align-items:baseline;gap:8px;margin-top:14px;flex-wrap:wrap' }, [
                el('span', { style: 'font-size:34px;font-weight:700;letter-spacing:-0.03em', text: `${pct}%` }),
                el('span', {
                    style: 'font-size:13px;color:var(--ink2)',
                    text: t('artist.coverageBody', { total: albums.length, archived })
                })
            ]),
            el('div', { className: 'ma-meter', style: 'margin-top:16px' }, [
                el('div', { className: 'ma-meter-fill', style: `width:${pct}%` })
            ]),
            el('div', { className: 'ma-ticks', style: 'margin-top:14px' },
                albums.slice(0, 24).map(album => el('div', {
                    className: `ma-tick${isAlbumFollowed(album.id) ? ' is-on' : ''}`
                }))),
            el('div', { style: 'font-size:11px;color:var(--ink3);margin-top:10px', text: t('artist.tickHint') })
        ]);
    }

    /**
     * @param {{id: string, name: string, image?: string, year?: string}} album
     * @param {boolean} inArchive
     * @returns {HTMLElement}
     */
    albumTile(album, inArchive) {
        const art = cover(album.image, album.name || '', 'ma-cover-fill');
        if (!inArchive) art.style.opacity = '.72';

        return el('button', {
            className: 'ma-tile',
            attrs: { type: 'button' },
            dataset: { albumId: album.id },
            on: { click: () => window.openAlbumDetail?.(album.id) }
        }, [
            el('div', { style: 'position:relative' }, [
                art,
                inArchive ? el('span', { className: 'ma-album-flag', text: t('artist.inArchive') }) : null
            ]),
            el('div', { className: 'ma-truncate', style: 'font-size:15px;font-weight:500;margin-top:12px', text: album.name }),
            el('div', {
                style: 'font-size:12px;color:var(--ink3);margin-top:2px',
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
                className: 'ma-card',
                style: 'text-align:center',
                attrs: { type: 'button' },
                on: { click: () => this.router?.navigate(`search?q=${encodeURIComponent(artist.name)}&type=artist`) }
            }, [
                avatar(artist.image, artist.name || '', 'ma-avatar-md', { className: 'ma-mx-auto' }),
                el('div', { className: 'ma-truncate', style: 'font-size:14px;font-weight:500;margin-top:14px', text: artist.name }),
                el('div', { className: 'ma-truncate', style: 'font-size:11px;color:var(--ink3);margin-top:2px', text: artist.genres || '' })
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

        return el('div', { className: 'ma-row', dataset: { trackId: track.id } }, [
            cover(track.image, track.name || '', 'ma-cover-sm', {
                tag: 'button',
                attrs: { type: 'button', 'aria-label': track.name || '', 'aria-hidden': null },
                on: { click: open }
            }),
            el('div', { className: 'ma-row-main', attrs: { role: 'button', tabindex: '0' }, on: {
                click: open,
                keydown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }
            } }, [
                el('div', { className: 'ma-row-title', text: track.name }),
                el('div', { className: 'ma-row-sub', text: track.artist || '' })
            ]),
            el('div', { className: 'ma-col-stars' }, [stars(getTrackRating(track.id))]),
            el('div', { className: 'ma-col-actions' }, [
                el('button', {
                    className: 'ma-iconbtn',
                    text: '♥',
                    attrs: { type: 'button', title: t('search.archive'), 'aria-label': t('search.archive') },
                    on: { click: event => void this.archive(track, event.currentTarget) }
                }),
                el('button', {
                    className: 'ma-iconbtn',
                    text: '⋯',
                    attrs: { type: 'button', 'aria-label': t('track.details') },
                    on: { click: open }
                })
            ])
        ]);
    }

    /**
     * @param {Object} track
     * @param {HTMLElement} button
     */
    async archive(track, button) {
        if (!store.token) return window.openAuthModal?.();
        const ok = await likeTrack(track);
        if (ok) button.classList.add('is-on');
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
        return el('section', { style: 'padding:28px 0 0' }, [
            el('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px' }, [
                kicker(title),
                el('span', { style: 'font-size:11px;color:var(--ink3)', text: t('search.resultCount', { n: count }) })
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
