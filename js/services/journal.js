/**
 * Müzik Defteri — the listening journal.
 *
 * A track's notes are a history, not a field: every save adds an entry instead
 * of replacing the previous one, and each entry carries the score the track had
 * at that moment. See server/journal.js for the storage side.
 *
 *   GET    /api/library/journal?trackId=&limit=&offset=  -> { entries, total }
 *   POST   /api/library/journal                          -> { entry }
 *   PATCH  /api/library/journal/:id                      -> { entry }
 *   DELETE /api/library/journal/:id                      -> { success }
 *
 * The server reports failures as a machine-readable `code` (API-CONTRACTS §1);
 * the wording lives here, because the interface is trilingual.
 */
import { get, post, patch, del } from './api.js';
import { store } from '../state/store.js';
import { t } from './i18n.js';

const ERROR_KEYS = {
    journal_body_required: 'journal.errorEmpty',
    journal_body_too_long: 'journal.errorTooLong',
    journal_track_required: 'journal.errorTrack',
    journal_meta_invalid: 'journal.errorTrack',
    journal_limit_exceeded: 'journal.errorLimit',
    journal_entry_not_found: 'journal.errorMissing',
    journal_range_invalid: 'journal.errorUnavailable',
    journal_unavailable: 'journal.errorUnavailable',
    rate_limited: 'journal.errorRateLimited'
};

/**
 * Re-throw with a translation key attached, so States.error() and the toasts
 * show a sentence in the reader's language instead of the server's code.
 * @param {Error & {code?: string}} error
 */
function translated(error) {
    const key = ERROR_KEYS[error?.code];
    if (key) {
        error.translationKey = key;
        error.message = t(key);
    }
    return error;
}

/**
 * Keep the archive rows' note badge in step with a write, without refetching
 * the whole archive. The store notifies, so the list and the dashboard repaint.
 * @param {string} trackId
 * @param {number} delta - entries added (+1) or removed (-1)
 */
function bumpArchiveCount(trackId, delta) {
    const tracks = store.likedTracks;
    const index = tracks.findIndex(track => track.trackId === trackId);
    if (index === -1) return;

    const track = tracks[index];
    const next = [...tracks];
    next[index] = {
        ...track,
        noteCount: Math.max(0, (track.noteCount || 0) + delta),
        ...(delta > 0 ? { lastNoteAt: new Date().toISOString() } : {})
    };
    store.setLikedTracks(next);
}

/**
 * Every entry written about one track, newest first.
 * @param {string} trackId
 * @returns {Promise<Array>}
 */
export async function listJournal(trackId) {
    try {
        const { entries } = await get(`/library/journal?trackId=${encodeURIComponent(trackId)}&limit=100`);
        return entries;
    } catch (error) {
        throw translated(error);
    }
}

/**
 * The most recent entries across the whole archive — the "you were here" row.
 * @param {number} [limit]
 * @returns {Promise<Array>}
 */
export async function listRecentJournal(limit = 5) {
    try {
        const { entries } = await get(`/library/journal?limit=${limit}`);
        return entries;
    } catch (error) {
        throw translated(error);
    }
}

/**
 * Add an entry. Never overwrites an earlier one.
 * @param {{id: string, name?: string, artist?: string, image?: string}} track
 * @param {string} body
 * @returns {Promise<Object>} the stored entry
 */
export async function addJournalEntry(track, body) {
    try {
        const { entry } = await post('/library/journal', {
            trackId: track.id,
            trackName: track.name,
            artistName: track.artist,
            image: track.image,
            body
        });
        bumpArchiveCount(track.id, +1);
        return entry;
    } catch (error) {
        throw translated(error);
    }
}

/**
 * Correct the text of one entry. Its date and its score stay as they were.
 * @param {string} id
 * @param {string} body
 * @returns {Promise<Object>}
 */
export async function updateJournalEntry(id, body) {
    try {
        const { entry } = await patch(`/library/journal/${encodeURIComponent(id)}`, { body });
        return entry;
    } catch (error) {
        throw translated(error);
    }
}

/**
 * @param {string} id
 * @param {string} trackId - the track the entry belonged to, for the badge count
 * @returns {Promise<boolean>}
 */
export async function deleteJournalEntry(id, trackId) {
    try {
        await del(`/library/journal/${encodeURIComponent(id)}`);
        bumpArchiveCount(trackId, -1);
        return true;
    } catch (error) {
        throw translated(error);
    }
}
