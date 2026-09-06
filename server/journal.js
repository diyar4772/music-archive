/**
 * Müzik Defteri — the append-only listening journal.
 *
 * `Like.userNote` holds one note that every save overwrites, so a track could
 * only ever carry the user's most recent sentence about it. The journal keeps
 * every entry instead: what you wrote in 2026 stays next to what you write in
 * 2028, each one stamped with the score you had given at that moment.
 *
 * Entries are deliberately independent of the archive row. Removing a track
 * from the archive does not erase what you wrote about it — that history is
 * the reason to come back.
 *
 * Error bodies follow the contract in `docs/specs/API-CONTRACTS.md` §1:
 * a machine-readable `code` the trilingual client translates, plus a human
 * `error` sentence as the fallback when it has no translation for that code.
 */
const mongoose = require('mongoose');

const MAX_BODY = 2000;
const MAX_PER_TRACK = 500;
const MAX_LIST = 100;
const DEFAULT_LIST = 20;

const entrySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    trackId: { type: String, required: true },
    // Denormalised so an entry can be listed on its own, even after the track
    // has left the archive and no Like row carries its name any more.
    trackName: { type: String, default: '' },
    artistName: { type: String, default: '' },
    image: { type: String, default: null },
    body: { type: String, required: true, maxlength: MAX_BODY },
    // The score as it stood when the entry was written; never back-filled, so
    // the rating column reads as a history rather than today's opinion.
    rating: { type: Number, default: null },
    editedAt: { type: Date, default: null }
}, { timestamps: true });

entrySchema.index({ userId: 1, trackId: 1, createdAt: -1 });
entrySchema.index({ userId: 1, createdAt: -1 });

const JournalEntry = mongoose.model('JournalEntry', entrySchema);

const fail = (status, code, message) => Object.assign(new Error(message), { status, code, message });

/**
 * @param {unknown} value
 * @param {{missing: [string, string], tooLong: [string, string]}} codes
 * @returns {string} the trimmed value
 */
function text(value, codes, max, { required = true } = {}) {
    if (value === undefined || value === null) {
        if (required) throw fail(400, ...codes.missing);
        return '';
    }
    if (typeof value !== 'string') throw fail(400, ...codes.missing);
    const trimmed = value.trim();
    if (required && !trimmed) throw fail(400, ...codes.missing);
    if (trimmed.length > max) throw fail(400, ...codes.tooLong);
    return trimmed;
}

const TRACK_CODES = {
    missing: ['journal_track_required', 'Not bir şarkıya bağlı olmalı.'],
    tooLong: ['journal_track_required', 'Şarkı kimliği çok uzun.']
};
const BODY_CODES = {
    missing: ['journal_body_required', 'Deftere yazmak için önce bir şeyler yaz.'],
    tooLong: ['journal_body_too_long', `Bir not en fazla ${MAX_BODY} karakter olabilir.`]
};
const META_CODES = {
    missing: ['journal_meta_invalid', 'Şarkı bilgisi geçersiz.'],
    tooLong: ['journal_meta_invalid', 'Şarkı bilgisi çok uzun.']
};

/**
 * A whole number inside the given bounds. Out-of-range paging is reported
 * rather than clamped: `limit=0` is a caller mistake, not a request for one.
 * @returns {number}
 */
function count(value, fallback, { min = 0, max }) {
    if (value === undefined || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        throw fail(400, 'journal_range_invalid', 'Geçersiz sayfa aralığı.');
    }
    return parsed;
}

/** The shape the client sees. Ids are strings in both storage modes. */
const publicEntry = entry => ({
    id: String(entry._id ?? entry.id),
    trackId: entry.trackId,
    trackName: entry.trackName || '',
    artistName: entry.artistName || '',
    image: entry.image || null,
    body: entry.body,
    rating: typeof entry.rating === 'number' ? entry.rating : null,
    createdAt: entry.createdAt,
    editedAt: entry.editedAt || null
});

const byNewest = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);

/**
 * Storage-mode-independent access to the entries, so every handler below is
 * written once instead of twice.
 */
function createStore({ isInMemory, memory, generateId, Rating, Like }) {
    const asObjectId = userId => (mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : null);

    return {
        /** @returns {Promise<number|null>} the user's current score for a track */
        async ratingFor(userId, trackId) {
            if (isInMemory()) {
                const found = memory.ratings.find(r =>
                    r.userId === userId && r.itemId === trackId && r.itemType === 'track');
                return found ? found.rating : null;
            }
            const found = await Rating.findOne({ userId, itemId: trackId, itemType: 'track' }).lean();
            return found ? found.rating : null;
        },

        /** @returns {Promise<Object|null>} the archive row, for name/artist/cover fallback */
        async archived(userId, trackId) {
            if (isInMemory()) {
                return memory.likes.find(l => l.userId === userId && l.trackId === trackId) || null;
            }
            return Like.findOne({ userId, trackId }).lean();
        },

        async countForTrack(userId, trackId) {
            if (isInMemory()) {
                return memory.journal.filter(e => e.userId === userId && e.trackId === trackId).length;
            }
            return JournalEntry.countDocuments({ userId, trackId });
        },

        async list(userId, { trackId, limit, offset }) {
            if (isInMemory()) {
                const all = memory.journal
                    .filter(e => e.userId === userId && (!trackId || e.trackId === trackId))
                    .sort(byNewest);
                return { entries: all.slice(offset, offset + limit), total: all.length };
            }
            const filter = { userId, ...(trackId ? { trackId } : {}) };
            const [entries, total] = await Promise.all([
                JournalEntry.find(filter).sort({ createdAt: -1, _id: -1 }).skip(offset).limit(limit).lean(),
                JournalEntry.countDocuments(filter)
            ]);
            return { entries, total };
        },

        async create(entry) {
            if (isInMemory()) {
                const stored = { _id: generateId(), ...entry, createdAt: new Date(), updatedAt: new Date() };
                memory.journal.push(stored);
                return stored;
            }
            return (await JournalEntry.create(entry)).toObject();
        },

        async update(userId, id, body) {
            if (isInMemory()) {
                const stored = memory.journal.find(e => e._id === id && e.userId === userId);
                if (!stored) return null;
                Object.assign(stored, { body, editedAt: new Date(), updatedAt: new Date() });
                return stored;
            }
            if (!mongoose.isValidObjectId(id)) return null;
            return JournalEntry.findOneAndUpdate(
                { _id: id, userId },
                { $set: { body, editedAt: new Date() } },
                { new: true, runValidators: true }
            ).lean();
        },

        async remove(userId, id) {
            if (isInMemory()) {
                const index = memory.journal.findIndex(e => e._id === id && e.userId === userId);
                if (index === -1) return false;
                memory.journal.splice(index, 1);
                return true;
            }
            if (!mongoose.isValidObjectId(id)) return false;
            const result = await JournalEntry.deleteOne({ _id: id, userId });
            return result.deletedCount === 1;
        },

        /**
         * How many entries each archived track carries, and when the last one
         * was written — one query for the whole archive instead of one per row.
         * @returns {Promise<Object<string, {noteCount: number, lastNoteAt: Date}>>}
         */
        async summary(userId) {
            if (isInMemory()) {
                const totals = {};
                for (const entry of memory.journal.filter(e => e.userId === userId)) {
                    const current = totals[entry.trackId] || { noteCount: 0, lastNoteAt: null };
                    current.noteCount += 1;
                    if (!current.lastNoteAt || new Date(entry.createdAt) > new Date(current.lastNoteAt)) {
                        current.lastNoteAt = entry.createdAt;
                    }
                    totals[entry.trackId] = current;
                }
                return totals;
            }
            const owner = asObjectId(userId);
            if (!owner) return {};
            const rows = await JournalEntry.aggregate([
                { $match: { userId: owner } },
                { $group: { _id: '$trackId', noteCount: { $sum: 1 }, lastNoteAt: { $max: '$createdAt' } } }
            ]);
            return Object.fromEntries(rows.map(row => [row._id, { noteCount: row.noteCount, lastNoteAt: row.lastNoteAt }]));
        }
    };
}

let store = null;

/**
 * Per-track note counts for the archive list. Never throws: a journal that
 * cannot be read must not take the archive down with it.
 * @param {string} userId
 * @returns {Promise<Object<string, {noteCount: number, lastNoteAt: Date}>>}
 */
async function journalSummary(userId) {
    if (!store) return {};
    try {
        return await store.summary(userId);
    } catch (error) {
        console.error('Journal summary error:', error.message);
        return {};
    }
}

/**
 * @param {import('express').Express} app
 * @param {Object} deps
 * @param {Function} deps.authenticateToken
 * @param {() => boolean} deps.isInMemory
 * @param {Object} deps.memory - the in-memory database (needs a `journal` array)
 * @param {() => string} deps.generateId
 * @param {import('mongoose').Model} deps.Rating
 * @param {import('mongoose').Model} deps.Like
 * @param {Function} [deps.writeLimiter]
 */
function registerJournalRoutes(app, deps) {
    const { authenticateToken, writeLimiter } = deps;
    store = createStore(deps);

    const write = writeLimiter ? [authenticateToken, writeLimiter] : [authenticateToken];
    const route = handler => async (req, res) => {
        // Personal writing: never cached by a proxy or the browser.
        res.set('Cache-Control', 'no-store');
        try {
            await handler(req, res);
        } catch (error) {
            if (error.status) return res.status(error.status).json({ error: error.message, code: error.code });
            console.error('Journal error:', error.message);
            res.status(500).json({ error: 'Defter şu an kullanılamıyor.', code: 'journal_unavailable' });
        }
    };

    // The whole journal, or one track's, newest first.
    app.get('/api/library/journal', authenticateToken, route(async (req, res) => {
        const trackId = req.query.trackId === undefined
            ? null
            : text(req.query.trackId, TRACK_CODES, 200);
        const limit = count(req.query.limit, DEFAULT_LIST, { min: 1, max: MAX_LIST });
        const offset = count(req.query.offset, 0, { max: 100000 });

        const { entries, total } = await store.list(req.user.id, { trackId, limit, offset });
        res.json({ entries: entries.map(publicEntry), total, limit, offset });
    }));

    // A new entry never replaces an older one — that is the whole feature.
    app.post('/api/library/journal', ...write, route(async (req, res) => {
        const trackId = text(req.body.trackId, TRACK_CODES, 200);
        const body = text(req.body.body, BODY_CODES, MAX_BODY);

        if (await store.countForTrack(req.user.id, trackId) >= MAX_PER_TRACK) {
            throw fail(409, 'journal_limit_exceeded', `Bir şarkı için en fazla ${MAX_PER_TRACK} not tutulur.`);
        }

        const archived = await store.archived(req.user.id, trackId);
        const entry = await store.create({
            userId: req.user.id,
            trackId,
            trackName: text(req.body.trackName, META_CODES, 300, { required: false }) || archived?.trackName || '',
            artistName: text(req.body.artistName, META_CODES, 300, { required: false }) || archived?.artistName || '',
            image: text(req.body.image, META_CODES, 1000, { required: false }) || archived?.image || null,
            body,
            rating: await store.ratingFor(req.user.id, trackId),
            editedAt: null
        });

        res.status(201).json({ entry: publicEntry(entry) });
    }));

    // Fixing a typo is allowed; the entry keeps its original date and score.
    app.patch('/api/library/journal/:id', ...write, route(async (req, res) => {
        const body = text(req.body.body, BODY_CODES, MAX_BODY);
        const updated = await store.update(req.user.id, req.params.id, body);
        if (!updated) throw fail(404, 'journal_entry_not_found', 'Not bulunamadı.');
        res.json({ entry: publicEntry(updated) });
    }));

    app.delete('/api/library/journal/:id', ...write, route(async (req, res) => {
        if (!await store.remove(req.user.id, req.params.id)) {
            throw fail(404, 'journal_entry_not_found', 'Not bulunamadı.');
        }
        res.json({ success: true });
    }));
}

module.exports = { registerJournalRoutes, journalSummary, JournalEntry, MAX_BODY, MAX_PER_TRACK };
