// Dashboard panels: "recently added" and "top rated".
//
// Both lists render track and artist names that come from Spotify, so they are
// built as DOM nodes rather than interpolated markup.
import { store } from '../state/store.js';
import { getAverageRating, getTopRatedTracks, getTrackRating } from '../services/rating.js';
import { listRecentJournal } from '../services/journal.js';
import { formatDate } from '../utils.js';
import { el, cover, stars, replace } from '../core/dom.js';
import { t } from '../services/i18n.js';

/**
 * Get collection statistics
 * @returns {{totalTracks: number, totalArtists: number, totalAlbums: number, totalPlaylists: number, avgRating: string}}
 */
export function getCollectionStats() {
    return {
        totalTracks: store.likedTracks.length,
        totalArtists: store.followedArtists.length,
        totalAlbums: store.albumFollows.length,
        totalPlaylists: store.playlists.length,
        avgRating: getAverageRating() || '–'
    };
}

/**
 * One clickable line shared by both panels.
 * @param {{trackId: string, trackName: string, artistName?: string, image?: string, previewUrl?: string}} track
 * @param {Node|string} trailing - the right-hand cell: a timestamp or a rating
 * @returns {HTMLElement}
 */
function trackLine(track, trailing) {
    return el('button', {
        className: 'ma-row ma-row-inset',
        testid: 'dashboard-track',
        attrs: { type: 'button' },
        dataset: { trackId: track.trackId },
        on: {
            click: () => window.openTrackDetail?.(
                track.trackId,
                track.trackName,
                track.artistName,
                track.image,
                track.previewUrl
            )
        }
    }, [
        cover(track.image, track.trackName || '', 'ma-cover-sm'),
        el('span', { className: 'ma-row-main' }, [
            el('span', { className: 'ma-row-title', text: track.trackName }),
            el('span', { className: 'ma-row-sub', text: track.artistName || '' })
        ]),
        trailing
    ]);
}

/**
 * The panel's own empty line — smaller than the page-level empty block, since
 * it sits inside a card that already carries a heading.
 * @param {string} message
 * @returns {HTMLElement}
 */
function panelEmpty(message) {
    return el('div', {
        className: 'ma-p-32-20 ma-align-center ma-text-13 ma-color-ink3',
        text: message
    });
}

/**
 * Render the five most recently liked tracks.
 */
export function renderRecentlyAdded() {
    const container = document.getElementById('recentlyAddedContainer');
    if (!container) return;

    const recent = [...store.likedTracks]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 5);

    if (recent.length === 0) {
        replace(container, panelEmpty(t('library.emptyRecent')));
        return;
    }

    replace(container, ...recent.map(track => trackLine(
        track,
        el('span', {
            className: 'ma-text-11 ma-color-ink3 ma-flex-0-0-auto',
            text: track.createdAt ? formatDate(track.createdAt) : ''
        })
    )));
}

/**
 * Render the five most recent journal entries — the archive's "you were here"
 * line. It is the reason to come back, so it gets its own panel rather than
 * being buried one drawer deep.
 */
export async function renderRecentJournal() {
    const container = document.getElementById('journalContainer');
    if (!container) return;

    try {
        const entries = await listRecentJournal(5);
        if (!document.getElementById('journalContainer')) return;
        if (entries.length === 0) {
            replace(container, panelEmpty(t('journal.recentEmpty')));
            return;
        }

        replace(container, ...entries.map(entry => el('button', {
            className: 'ma-row ma-row-inset',
            testid: 'dashboard-journal-entry',
            attrs: { type: 'button' },
            dataset: { entryId: entry.id },
            on: {
                click: () => window.openTrackDetail?.(
                    entry.trackId, entry.trackName, entry.artistName, entry.image
                )
            }
        }, [
            cover(entry.image, entry.trackName || '', 'ma-cover-sm'),
            el('span', { className: 'ma-row-main' }, [
                el('span', { className: 'ma-row-title', text: entry.trackName || t('journal.title') }),
                el('span', { className: 'ma-row-sub ma-truncate', text: entry.body })
            ]),
            el('span', {
                className: 'ma-text-11 ma-color-ink3 ma-flex-0-0-auto',
                text: formatDate(entry.createdAt)
            })
        ])));
    } catch {
        // The panel is secondary; a failed journal read must not replace the
        // dashboard with an error screen.
        replace(container, panelEmpty(t('journal.loadFailed')));
    }
}

/**
 * Render the five highest-rated tracks.
 */
export function renderTopRated() {
    const container = document.getElementById('topRatedContainer');
    if (!container) return;

    const top = getTopRatedTracks(5);

    if (top.length === 0) {
        replace(container, panelEmpty(t('library.emptyRated')));
        return;
    }

    replace(container, ...top.map(track => {
        const line = trackLine(track, stars(getTrackRating(track.trackId)));
        line.lastElementChild.classList.add('ma-flex-0-0-auto');
        return line;
    }));
}
