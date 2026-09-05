/**
 * Dig view — the swipe-through discovery screen from the design canvas.
 *
 * The backend already served this: GET /api/dig/queue builds recommendations
 * from the artists you follow and the tracks you rated highest, and
 * POST /api/dig/swipe records "archive" or "pass". Nothing on the web client
 * reached either endpoint until now.
 */
import { Component } from '../core/Component.js';
import { store } from '../state/store.js';
import { get, post } from '../services/api.js';
import { getLikedTracks } from '../services/library.js';
import { playTrack } from '../components/MiniPlayer.js';
import { el, cover, kicker, replace, emptyState, errorState, loadingState } from '../core/dom.js';
import { showToast } from '../utils.js';
import { t } from '../services/i18n.js';
import { isAuthenticated } from '../services/auth.js';

const QUEUE_SIZE = 15;

export class DigView extends Component {
    constructor(container, props = {}) {
        super(container, props);
        this.router = props.router;
        this.queue = [];
        this.kept = 0;
        this.loading = false;
        this.failed = false;
        this.onKeydown = event => this.handleKey(event);
    }

    render() {
        this.container.replaceChildren(el('main', { className: 'ma-main' }, [
            el('div', {
                style: 'display:flex;align-items:flex-end;justify-content:space-between;gap:24px;flex-wrap:wrap'
            }, [
                el('div', {}, [
                    kicker(t('dig.kicker')),
                    el('h2', { className: 'ma-page-title', text: t('dig.title') })
                ]),
                el('div', {
                    style: 'font-size:13px;color:var(--ink2)',
                    attrs: { id: 'digSummary' },
                    text: t('dig.summary', { left: this.queue.length, kept: this.kept })
                })
            ]),
            el('div', { className: 'ma-rule', style: 'margin:20px 0 32px' }),
            el('div', { attrs: { id: 'digBody' } })
        ]));

        this.paint();
    }

    paint() {
        const body = this.querySelector('#digBody');
        if (!body) return;

        const summary = this.querySelector('#digSummary');
        if (summary) summary.textContent = t('dig.summary', { left: this.queue.length, kept: this.kept });

        if (!isAuthenticated()) {
            replace(body, emptyState('♥', t('dig.signedOut'), '', el('button', {
                className: 'ma-btn ma-btn-primary',
                style: 'margin-top:24px',
                text: t('auth.login'),
                attrs: { type: 'button' },
                on: { click: () => window.openAuthModal?.() }
            })));
            return;
        }

        if (this.loading) {
            replace(body, loadingState(4));
            return;
        }

        if (this.failed) {
            replace(body, errorState(t('dig.loadFailed'), ''), el('div', { style: 'text-align:center' }, [
                el('button', {
                    className: 'ma-btn ma-btn-secondary',
                    text: t('common.retry'),
                    attrs: { type: 'button' },
                    on: { click: () => void this.loadQueue() }
                })
            ]));
            return;
        }

        if (this.queue.length === 0) {
            replace(body, this.doneState());
            return;
        }

        replace(body, el('div', { className: 'ma-dig' }, [this.stage(), this.upNext()]));
    }

    /** @returns {HTMLElement} */
    stage() {
        const track = this.queue[0];

        return el('div', { className: 'ma-dig-stage' }, [
            el('div', { className: 'ma-dig-card', attrs: { id: 'digCard' } }, [
                cover(track.image, track.name || '', 'ma-cover-fill', { className: 'ma-dig-art' }),
                el('div', { style: 'padding:20px' }, [
                    el('div', { className: 'ma-dig-title', text: track.name }),
                    el('div', {
                        className: 'ma-dig-sub',
                        text: [track.artist, track.album].filter(Boolean).join(' · ')
                    }),
                    el('button', {
                        className: 'ma-btn ma-btn-secondary',
                        style: 'margin-top:18px;width:100%;justify-content:flex-start',
                        text: t('dig.preview'),
                        attrs: { type: 'button', disabled: !track.preview_url },
                        on: { click: () => this.preview() }
                    })
                ])
            ]),
            el('div', { className: 'ma-dig-actions' }, [
                el('button', {
                    className: 'ma-btn ma-btn-secondary',
                    style: 'justify-content:flex-start',
                    text: t('dig.skip'),
                    attrs: { type: 'button' },
                    on: { click: () => void this.swipe('pass') }
                }),
                el('button', {
                    className: 'ma-btn ma-btn-primary',
                    style: 'justify-content:flex-start',
                    text: t('dig.keep'),
                    attrs: { type: 'button' },
                    on: { click: () => void this.swipe('archive') }
                })
            ]),
            el('div', { style: 'font-size:11px;color:var(--ink3);margin-top:14px', text: t('dig.keys') })
        ]);
    }

    /** @returns {HTMLElement} */
    upNext() {
        return el('aside', { className: 'ma-card-flush' }, [
            el('div', {
                className: 'ma-kicker',
                style: 'padding:14px 18px;border-bottom:2px solid var(--rule)',
                text: t('dig.next')
            }),
            ...this.queue.slice(1, 5).map((track, index) => el('div', {
                className: 'ma-row ma-row-inset',
                style: `opacity:${1 - index * 0.16}`
            }, [
                cover(track.image, track.name || '', 'ma-cover-xs'),
                el('div', { style: 'min-width:0' }, [
                    el('div', { className: 'ma-row-title', style: 'font-size:13px', text: track.name }),
                    el('div', { className: 'ma-row-sub', style: 'font-size:11px', text: track.artist || '' })
                ])
            ])),
            el('div', {
                style: 'padding:14px 18px;font-size:11px;color:var(--ink3);line-height:1.5',
                text: t('dig.hint')
            })
        ]);
    }

    /** @returns {HTMLElement} */
    doneState() {
        return emptyState('♥', t('dig.doneTitle'), t('dig.doneBody', { kept: this.kept }), el('button', {
            className: 'ma-btn ma-btn-secondary',
            style: 'margin-top:24px',
            text: t('dig.reset'),
            attrs: { type: 'button' },
            on: { click: () => void this.loadQueue() }
        }));
    }

    /* ── behaviour ───────────────────────────────────────────────────── */

    preview() {
        const track = this.queue[0];
        if (!track) return;
        playTrack({
            id: track.id,
            name: track.name,
            artist: track.artist,
            image: track.image,
            preview_url: track.preview_url
        });
    }

    /**
     * Record a decision and advance the queue.
     * @param {'archive'|'pass'} action
     */
    async swipe(action) {
        const track = this.queue[0];
        if (!track || this.swiping) return;
        this.swiping = true;

        // Animate the card out before it is replaced, so the change reads as a
        // swipe rather than a flicker.
        this.querySelector('#digCard')?.classList.add(action === 'archive' ? 'is-keeping' : 'is-skipping');

        let recorded = true;
        try {
            await post('/dig/swipe', {
                trackId: track.id,
                trackName: track.name,
                artistId: track.artistId,
                artistName: track.artist,
                image: track.image,
                action
            });
            if (action === 'archive') {
                this.kept += 1;
                showToast(t('dig.archived'), 'success');
                // The archive grew server-side; pull it back so the rest of the
                // app (counts, library, "already liked") stays truthful.
                void getLikedTracks();
            }
        } catch (error) {
            recorded = false;
            showToast(error.message || t('common.error'), 'error');
        } finally {
            this.swiping = false;
        }

        // Only a recorded decision advances the queue. Dropping the card on a
        // failed request lost the track silently — the user pressed Archive,
        // saw an error, and the song was gone from the queue anyway.
        if (!recorded) {
            this.querySelector('#digCard')?.classList.remove('is-keeping', 'is-skipping');
            return;
        }

        this.queue = this.queue.slice(1);
        if (this.isMounted) this.paint();
    }

    /** @param {KeyboardEvent} event */
    handleKey(event) {
        if (!this.isMounted || this.queue.length === 0) return;
        // Never steal keys from a field the user is typing in.
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            void this.swipe('pass');
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            void this.swipe('archive');
        } else if (event.key === ' ') {
            event.preventDefault();
            this.preview();
        }
    }

    async loadQueue() {
        if (!isAuthenticated()) return;
        this.loading = true;
        this.failed = false;
        this.kept = 0;
        this.paint();

        try {
            const data = await get(`/dig/queue?limit=${QUEUE_SIZE}`);
            const liked = new Set(store.likedTracks.map(track => track.trackId));
            this.queue = (data.tracks || []).filter(track => !liked.has(track.id));
        } catch (error) {
            console.error('Dig queue failed:', error);
            this.failed = true;
        } finally {
            this.loading = false;
            if (this.isMounted) this.paint();
        }
    }

    onMount() {
        document.addEventListener('keydown', this.onKeydown);
        void this.loadQueue();
    }

    onUnmount() {
        document.removeEventListener('keydown', this.onKeydown);
    }
}
