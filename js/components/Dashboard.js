// Dashboard panels: "recently added" and "top rated".
//
// Both lists render track and artist names that come from Spotify, so they are
// built as DOM nodes rather than interpolated markup.
import { store } from '../state/store.js';
import { getAverageRating, getTopRatedTracks } from '../services/rating.js';
import { formatDate } from '../utils.js';
import { el, img, replace, emptyState } from '../core/dom.js';
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
 * @param {string} icon
 * @param {string} iconColor
 * @param {string} title
 * @returns {HTMLElement}
 */
function sectionHeading(icon, iconColor, title) {
    return el('h3', { className: 'text-lg font-bold mb-4 flex items-center gap-2' }, [
        el('i', { className: `${icon} ${iconColor}` }),
        title
    ]);
}

/**
 * One clickable track line shared by both panels.
 * @param {{trackId: string, trackName: string, artistName?: string, image?: string, previewUrl?: string}} track
 * @param {(Node|string|null)[]} [leading]
 * @param {Node|null} [trailing]
 * @returns {HTMLElement}
 */
function trackLine(track, leading = [], trailing = null) {
    return el('button', {
        className: 'w-full flex items-center gap-3 p-2 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-white/5 transition-colors',
        attrs: { type: 'button' },
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
        ...leading,
        img(track.image, 'w-10 h-10 rounded object-cover shrink-0', track.trackName),
        el('span', { className: 'flex-1 min-w-0' }, [
            el('span', { className: 'block font-medium truncate', text: track.trackName }),
            el('span', {
                className: 'block text-xs text-text-secondary-light dark:text-gray-400 truncate',
                text: track.artistName || ''
            })
        ]),
        trailing
    ]);
}

/**
 * Render the five most recently liked tracks.
 */
export function renderRecentlyAdded() {
    const container = document.getElementById('recentlyAddedContainer');
    if (!container) return;

    const heading = sectionHeading('fa-solid fa-clock', 'text-green-500', t('library.recentlyAdded'));
    const recent = [...store.likedTracks]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 5);

    if (recent.length === 0) {
        replace(container, heading, emptyState('fa-solid fa-music', t('library.emptyRecent')));
        return;
    }

    replace(container, heading, el('div', { className: 'space-y-1' }, recent.map(track => trackLine(
        track,
        [],
        track.createdAt
            ? el('span', { className: 'text-xs text-gray-500 shrink-0', text: formatDate(track.createdAt) })
            : null
    ))));
}

/**
 * Render the five highest-rated tracks.
 */
export function renderTopRated() {
    const container = document.getElementById('topRatedContainer');
    if (!container) return;

    const heading = sectionHeading('fa-solid fa-trophy', 'text-amber-500', t('library.topRated'));
    const top = getTopRatedTracks(5);

    if (top.length === 0) {
        replace(container, heading, emptyState('fa-solid fa-star', t('library.emptyRated')));
        return;
    }

    replace(container, heading, el('div', { className: 'space-y-1' }, top.map((track, index) => trackLine(
        track,
        [el('span', {
            className: `w-6 text-center font-bold shrink-0 ${index < 3 ? 'text-amber-500' : 'text-gray-500'}`,
            text: String(index + 1)
        })],
        el('span', { className: 'flex items-center gap-1 text-amber-500 shrink-0' }, [
            el('i', { className: 'fa-solid fa-star text-sm' }),
            el('span', { className: 'font-bold', text: String(track.rating) })
        ])
    ))));
}
