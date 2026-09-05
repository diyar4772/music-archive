/**
 * Dashboard view.
 *
 * Two screens behind one route: the landing pitch when there is no session,
 * and the archive overview when there is. Both are built as DOM nodes — track,
 * artist and playlist names come from Spotify or from the account holder.
 */
import { Component } from '../core/Component.js';
import { store } from '../state/store.js';
import { getLikedTracks, getFollowedArtists, getAlbumFollows, getPlaylists } from '../services/library.js';
import { getRatings, getAverageRating } from '../services/rating.js';
import { renderRecentlyAdded, renderTopRated } from '../components/Dashboard.js';
import { exportToCSV, exportStats } from '../components/Export.js';
import { el, cover, avatar, kicker } from '../core/dom.js';
import { t } from '../services/i18n.js';
import { isAuthenticated, getCurrentUser } from '../services/auth.js';

const FEATURES = [
    { icon: '♥', color: 'var(--pink-ink)', title: 'landing.card1Title', body: 'landing.card1Body' },
    { icon: '★', color: 'var(--violet-ink)', title: 'landing.card2Title', body: 'landing.card2Body' },
    { icon: '✎', color: 'var(--cyan-ink)', title: 'landing.card3Title', body: 'landing.card3Body' }
];

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
        this.container.replaceChildren(isAuthenticated() ? this.overview() : this.landing());
        if (isAuthenticated()) {
            this.paintPanels();
            void this.loadData();
        }
    }

    /* ── landing ─────────────────────────────────────────────────────── */

    landing() {
        return el('main', { className: 'ma-main' }, [
            el('section', { className: 'ma-hero' }, [
                el('div', {}, [
                    el('div', { className: 'ma-badge', style: 'margin-bottom:28px' }, [
                        el('span', { className: 'ma-badge-dot', attrs: { 'aria-hidden': 'true' } }),
                        el('span', { text: t('landing.badge') })
                    ]),
                    el('h1', { className: 'ma-hero-title' }, [
                        t('landing.titleTop'),
                        el('br'),
                        el('span', { className: 'ma-gradient-text', text: t('landing.titleAccent') })
                    ]),
                    el('p', { className: 'ma-hero-lede', text: t('landing.subtitle') }),
                    el('div', { className: 'ma-hero-actions' }, [
                        el('button', {
                            className: 'ma-btn ma-btn-primary ma-btn-lg',
                            text: t('landing.ctaPrimary'),
                            attrs: { type: 'button' },
                            on: { click: () => window.openAuthModal?.('register') }
                        }),
                        el('button', {
                            className: 'ma-btn ma-btn-secondary ma-btn-lg',
                            text: t('landing.ctaSecondary'),
                            attrs: { type: 'button' },
                            on: { click: () => this.querySelector('.ma-features')?.scrollIntoView({ behavior: 'smooth' }) }
                        })
                    ])
                ]),
                this.sampleRecord()
            ]),

            el('div', { className: 'ma-rule' }),

            el('section', { className: 'ma-features' }, FEATURES.map(feature => el('div', { className: 'ma-feature' }, [
                el('div', { className: 'ma-feature-mark', style: `color:${feature.color}`, text: feature.icon }),
                el('div', { className: 'ma-feature-title', text: t(feature.title) }),
                el('div', { className: 'ma-feature-body', text: t(feature.body) })
            ])))
        ]);
    }

    /** @returns {HTMLElement} the "one record from the archive" sample card */
    sampleRecord() {
        return el('div', { className: 'ma-card' }, [
            kicker(t('landing.sampleKicker'), 'ma-sample-kicker'),
            el('div', { style: 'display:flex;gap:14px;align-items:flex-start;margin-top:16px' }, [
                cover(null, t('landing.sampleTitle'), 'ma-cover-lg'),
                el('div', { style: 'min-width:0' }, [
                    el('div', { style: 'font-size:15px;font-weight:600', text: t('landing.sampleTitle') }),
                    el('div', { style: 'font-size:13px;color:var(--ink2);margin-top:2px', text: t('landing.sampleMeta') }),
                    el('div', { className: 'ma-stars', style: 'font-size:15px;margin-top:8px', text: '★★★★★' })
                ])
            ]),
            el('div', {
                style: 'margin-top:16px;border-top:1px solid var(--border);padding-top:14px;font-size:13px;'
                    + 'line-height:1.6;color:var(--ink2);font-style:italic',
                text: t('landing.sampleNote')
            })
        ]);
    }

    /* ── overview ────────────────────────────────────────────────────── */

    overview() {
        const stats = this.getCollectionStats();

        return el('main', { className: 'ma-main' }, [
            el('div', {
                style: 'display:flex;align-items:flex-end;justify-content:space-between;gap:24px;'
                    + 'margin-bottom:28px;flex-wrap:wrap'
            }, [
                el('div', {}, [
                    kicker(t('dashboard.kicker')),
                    el('h2', { className: 'ma-page-title', text: this.greeting() })
                ]),
                el('div', {
                    style: 'font-size:13px;color:var(--ink2)',
                    attrs: { id: 'dashSummary' },
                    text: t('dashboard.summary', { tracks: stats.totalTracks, artists: stats.totalArtists })
                })
            ]),

            el('div', { className: 'ma-bento' }, [
                this.likedCard(stats),
                this.followsCard(stats),
                this.playlistsCard(stats),
                this.ratingCard(stats)
            ]),

            el('div', { className: 'ma-grid ma-grid-2', style: 'margin-top:16px' }, [
                this.panel('recentlyAddedContainer', t('library.recentlyAdded'), t('dashboard.recentWindow')),
                this.panel('topRatedContainer', t('library.topRated'), '5 ★')
            ]),

            el('div', { style: 'display:flex;justify-content:flex-end;gap:8px;margin-top:20px;flex-wrap:wrap' }, [
                el('button', {
                    className: 'ma-btn ma-btn-secondary ma-btn-sm',
                    text: t('export.csv'),
                    attrs: { type: 'button' },
                    on: { click: () => exportToCSV() }
                }),
                el('button', {
                    className: 'ma-btn ma-btn-secondary ma-btn-sm',
                    text: t('export.backup'),
                    attrs: { type: 'button' },
                    on: { click: () => exportStats() }
                })
            ])
        ]);
    }

    /**
     * @param {{totalTracks: number}} stats
     * @returns {HTMLElement}
     */
    likedCard(stats) {
        const strip = store.likedTracks.slice(0, 5)
            .map(track => cover(track.image, track.trackName || '', 'ma-cover-md'));

        return el('div', { className: 'ma-card ma-bento-hero' }, [
            el('div', { className: 'ma-stat-label' }, [
                el('span', { style: 'color:var(--pink-ink);font-size:14px', text: '♥' }),
                kicker(t('library.likedSongs'))
            ]),
            el('div', { className: 'ma-stat-big', attrs: { id: 'likedCount' }, text: String(stats.totalTracks) }),
            el('div', {
                style: 'font-size:14px;color:var(--ink2);margin-top:6px',
                text: t('dashboard.newThisMonth', { n: this.addedThisMonth() })
            }),
            el('div', { style: 'margin-top:auto;display:flex;gap:6px;padding-top:24px' }, strip),
            el('button', {
                className: 'ma-btn ma-btn-secondary ma-btn-sm',
                style: 'margin-top:20px;align-self:flex-start',
                text: t('dashboard.goLibrary'),
                attrs: { type: 'button' },
                on: { click: () => this.onOpenProfileModal('likes') }
            })
        ]);
    }

    /**
     * @param {{totalArtists: number}} stats
     * @returns {HTMLElement}
     */
    followsCard(stats) {
        const faces = store.followedArtists.slice(0, 4).map((artist, index) => {
            const node = avatar(artist.image, artist.artistName || '', 'ma-avatar-sm');
            node.style.marginLeft = index ? '-8px' : '0';
            node.style.border = '2px solid var(--card)';
            return node;
        });

        return el('button', {
            className: 'ma-card ma-bento-wide',
            attrs: { type: 'button' },
            on: { click: () => this.onOpenProfileModal('follows') }
        }, [
            el('div', {}, [
                el('div', { className: 'ma-stat-label' }, [
                    el('span', { style: 'color:var(--violet-ink);font-size:13px', text: '◉' }),
                    kicker(t('library.following'))
                ]),
                el('div', { className: 'ma-stat', attrs: { id: 'followingCount' }, text: String(stats.totalArtists) })
            ]),
            el('div', { style: 'display:flex' }, faces)
        ]);
    }

    /**
     * @param {{totalPlaylists: number}} stats
     * @returns {HTMLElement}
     */
    playlistsCard(stats) {
        const tracksInPlaylists = store.playlists.reduce(
            (sum, playlist) => sum + (playlist.trackCount ?? playlist.PlaylistTracks?.length ?? 0), 0
        );

        return el('button', {
            className: 'ma-card',
            attrs: { type: 'button' },
            on: { click: () => this.onOpenProfileModal('playlists') }
        }, [
            el('div', { className: 'ma-stat-label' }, [
                el('span', { style: 'color:var(--cyan-ink);font-size:13px', text: '≡' }),
                kicker(t('library.playlists'))
            ]),
            el('div', { className: 'ma-stat', attrs: { id: 'playlistCount' }, text: String(stats.totalPlaylists) }),
            el('div', {
                className: 'ma-kicker',
                style: 'margin-top:4px;letter-spacing:normal;text-transform:none;font-weight:400;font-size:12px',
                attrs: { id: 'playlistTrackTotal' },
                text: t('dashboard.tracksTotal', { n: tracksInPlaylists })
            })
        ]);
    }

    /**
     * @param {{avgRating: string}} stats
     * @returns {HTMLElement}
     */
    ratingCard(stats) {
        const rated = store.userRatings.filter(entry => entry.rating > 0).length;

        return el('div', { className: 'ma-card' }, [
            el('div', { className: 'ma-stat-label' }, [
                el('span', { style: 'color:var(--violet-ink);font-size:13px', text: '★' }),
                kicker(t('library.averageRating'))
            ]),
            el('div', { className: 'ma-stat', attrs: { id: 'statRating' }, text: stats.avgRating }),
            el('div', {
                style: 'margin-top:4px;font-size:12px;color:var(--ink3)',
                attrs: { id: 'ratedCount' },
                text: t('dashboard.ratedCount', { n: rated })
            })
        ]);
    }

    /**
     * A titled list panel; Dashboard.js fills the body by id.
     * @param {string} id
     * @param {string} title
     * @param {string} meta
     * @returns {HTMLElement}
     */
    panel(id, title, meta) {
        return el('div', { className: 'ma-card-flush' }, [
            el('div', { className: 'ma-card-head' }, [
                kicker(title),
                el('span', { style: 'font-size:11px;color:var(--ink3)', text: meta })
            ]),
            el('div', { attrs: { id } })
        ]);
    }

    /* ── data ────────────────────────────────────────────────────────── */

    /** @returns {string} a greeting matched to the local time of day */
    greeting() {
        const hour = new Date().getHours();
        const slot = hour < 12 ? 'morning' : (hour < 18 ? 'afternoon' : 'evening');
        return t(`dashboard.${slot}`, { name: getCurrentUser() || '' }).trim().replace(/,\s*$/, '');
    }

    /** @returns {number} how many tracks were archived in the current month */
    addedThisMonth() {
        const now = new Date();
        return store.likedTracks.filter(track => {
            if (!track.createdAt) return false;
            const added = new Date(track.createdAt);
            return added.getFullYear() === now.getFullYear() && added.getMonth() === now.getMonth();
        }).length;
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

    /** Repaint the counters in place, without rebuilding the whole screen. */
    updateStats() {
        if (!isAuthenticated()) return;
        const stats = this.getCollectionStats();
        const rated = store.userRatings.filter(entry => entry.rating > 0).length;
        const tracksInPlaylists = store.playlists.reduce(
            (sum, playlist) => sum + (playlist.trackCount ?? playlist.PlaylistTracks?.length ?? 0), 0
        );

        const set = (id, value) => {
            const node = this.querySelector(`#${id}`);
            if (node) node.textContent = value;
        };

        set('likedCount', String(stats.totalTracks));
        set('followingCount', String(stats.totalArtists));
        set('playlistCount', String(stats.totalPlaylists));
        set('statRating', stats.avgRating);
        set('ratedCount', t('dashboard.ratedCount', { n: rated }));
        set('playlistTrackTotal', t('dashboard.tracksTotal', { n: tracksInPlaylists }));
        set('dashSummary', t('dashboard.summary', { tracks: stats.totalTracks, artists: stats.totalArtists }));
    }

    paintPanels() {
        renderRecentlyAdded();
        renderTopRated();
    }

    async loadData() {
        if (!isAuthenticated()) return;
        try {
            await Promise.all([
                getLikedTracks(),
                getFollowedArtists(),
                getAlbumFollows(),
                getPlaylists(),
                getRatings()
            ]);
            if (!this.isMounted) return;
            this.updateStats();
            this.paintPanels();
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        }
    }

    onMount() {
        this.unsubscribeLikes = store.subscribe('likedTracks', () => {
            this.updateStats();
            renderRecentlyAdded();
        });
        this.unsubscribeArtists = store.subscribe('followedArtists', () => this.updateStats());
        this.unsubscribePlaylists = store.subscribe('playlists', () => this.updateStats());
        this.unsubscribeRatings = store.subscribe('userRatings', () => {
            this.updateStats();
            renderTopRated();
        });
    }

    onUnmount() {
        this.unsubscribeLikes?.();
        this.unsubscribeArtists?.();
        this.unsubscribePlaylists?.();
        this.unsubscribeRatings?.();
    }
}
