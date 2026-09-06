const mongoose = require('mongoose');
const crypto = require('node:crypto');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_EVENTS = 60000;
const MAX_DURATION = 60 * 60 * 1000;
const bad = message => Object.assign(new Error(message), { status: 400 });

function string(value, name, max, required = false) {
    if (value === undefined && !required) return '';
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
        throw bad(`${name}: geçerli bir metin girin (en fazla ${max} karakter).`);
    }
    return value.trim();
}

function optionalId(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || !UUID.test(value)) throw bad('Geçersiz ilişki kimliği.');
    return value.toLowerCase();
}

// Whitelist the format shared by capture, recovery and Standard MIDI export.
// Neither file paths, ownership, storage state nor arbitrary MIDI/SysEx bytes
// can be supplied by the client.
function validateRecording(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw bad('Geçersiz kayıt.');
    if (typeof input.id !== 'string' || !UUID.test(input.id)) throw bad('Geçersiz kayıt kimliği.');
    if (!['midi', 'simulation'].includes(input.input)) throw bad('Geçersiz MIDI giriş kaynağı.');
    if (input.source !== 'midi' || input.instrument !== 'piano') throw bad('Bu sürüm yalnız piyano MIDI olaylarını destekler.');
    const durationMs = input.durationMs;
    if (!Number.isFinite(durationMs) || durationMs < 1 || durationMs > MAX_DURATION) throw bad('Kayıt süresi 1 ms–60 dk arasında olmalıdır.');
    if (!Array.isArray(input.events) || !input.events.length || input.events.length > MAX_EVENTS) throw bad('Kayıt 1–60000 MIDI olayı içermelidir.');
    let previous = 0;
    let hasNote = false;
    const events = input.events.map(event => {
        if (!event || !Number.isFinite(event.at) || event.at < previous || event.at > durationMs) throw bad('Geçersiz olay zamanlaması.');
        const d = event.data;
        if (!Array.isArray(d) || d.length !== 3 || !d.every(Number.isInteger)
            || d[0] < 0x80 || d[0] > 0xbf || d[1] < 0 || d[1] > 127 || d[2] < 0 || d[2] > 127) throw bad('Geçersiz MIDI olayı.');
        const kind = d[0] & 0xf0;
        if (![0x80, 0x90, 0xb0].includes(kind) || (kind === 0xb0 && ![64, 120, 121, 123].includes(d[1]))) throw bad('Desteklenmeyen MIDI olayı.');
        if (kind === 0x90 && d[2] > 0) hasNote = true;
        previous = event.at;
        return { at: event.at, data: [...d] };
    });
    if (!hasNote) throw bad('Kaydedilecek nota yok.');
    if (input.tags !== undefined && (!Array.isArray(input.tags) || input.tags.length > 12)) throw bad('En fazla 12 etiket eklenebilir.');
    return {
        clientId: input.id.toLowerCase(), title: string(input.title, 'Başlık', 120, true),
        description: string(input.description, 'Açıklama', 2000),
        tags: [...new Set((input.tags || []).map(tag => string(tag, 'Etiket', 40, true)))],
        source: 'midi', input: input.input, instrument: 'piano', durationMs, events,
        pieceId: optionalId(input.pieceId), takeGroupId: optionalId(input.takeGroupId)
    };
}

const recordingSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    clientId: { type: String, required: true }, title: String, description: String,
    tags: [String], source: String, input: String, instrument: String, durationMs: Number,
    events: [{ _id: false, at: Number, data: [Number] }],
    pieceId: String, takeGroupId: String, contentHash: String
}, { timestamps: true });
recordingSchema.index({ userId: 1, clientId: 1 }, { unique: true });
recordingSchema.index({ userId: 1, createdAt: -1, _id: -1 });

const pieceSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    clientId: { type: String, required: true }, title: String, composer: String,
    notes: String, catalogTrackId: String
}, { timestamps: true });
pieceSchema.index({ userId: 1, clientId: 1 }, { unique: true });
const Recording = mongoose.model('Recording', recordingSchema);
const Piece = mongoose.model('Piece', pieceSchema);

function publicItem(doc) {
    const { _id, __v, userId: _userId, contentHash: _hash, clientId, ...item } = doc;
    return { id: clientId, ...item };
}

function registerStudioRoutes(app, { authenticateToken, canPersist, User, Like }) {
    const guard = [authenticateToken, async (req, res, next) => {
        // Never acknowledge volatile in-memory data as a saved performance.
        res.set('Cache-Control', 'no-store');
        if (!canPersist()) return res.status(503).json({ error: 'Kalıcı veritabanı kullanılamıyor. Yerel kaydınızı koruyup tekrar deneyin.' });
        try {
            if (!mongoose.isValidObjectId(req.user.id) || !await User.exists({ _id: req.user.id })) return res.status(401).json({ error: 'Oturum bulunamadı.' });
            return next();
        } catch { return res.status(503).json({ error: 'Veritabanına ulaşılamıyor.' }); }
    }];
    const route = fn => async (req, res) => {
        try { await fn(req, res); }
        catch (error) { res.status(error.status || 503).json({ error: error.status === 400 ? error.message : 'Kayıt servisine ulaşılamıyor. Tekrar deneyin.' }); }
    };

    app.post('/api/recordings', ...guard, route(async (req, res) => {
        const record = validateRecording(req.body);
        if (record.pieceId && !await Piece.exists({ userId: req.user.id, clientId: record.pieceId })) {
            return res.status(404).json({ error: 'Çalışma bulunamadı.' });
        }
        const filter = { userId: req.user.id, clientId: record.clientId };
        const contentHash = crypto.createHash('sha256').update(JSON.stringify(record)).digest('hex');
        let stored;
        try {
            stored = await Recording.findOneAndUpdate(filter, { $setOnInsert: { ...record, ...filter, contentHash } },
                { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
        } catch (error) {
            if (error.code !== 11000) throw error;
            stored = await Recording.findOne(filter).lean();
        }
        if (!stored || stored.contentHash !== contentHash) return res.status(409).json({ error: 'Bu kimlik farklı bir kayda ait. Yerel kopyanızı indirin.' });
        const { events: _events, ...summary } = publicItem(stored);
        res.status(200).json({ recording: summary, stored: true });
    }));
    app.get('/api/recordings', ...guard, route(async (req, res) => {
        const offset = Number(req.query.offset || 0);
        if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw bad('Geçersiz sayfa.');
        const filter = { userId: req.user.id };
        if (req.query.pieceId) filter.pieceId = optionalId(req.query.pieceId);
        const docs = await Recording.find(filter).select('-events -contentHash').sort({ createdAt: -1, _id: -1 }).skip(offset).limit(51).lean();
        res.json({ recordings: docs.slice(0, 50).map(publicItem), hasMore: docs.length > 50 });
    }));
    app.get('/api/recordings/:id', ...guard, route(async (req, res) => {
        const id = optionalId(req.params.id);
        const doc = await Recording.findOne({ userId: req.user.id, clientId: id }).lean();
        if (!doc) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
        res.json({ recording: publicItem(doc), stored: true });
    }));
    app.get('/api/pieces', ...guard, route(async (req, res) => {
        const docs = await Piece.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(500).lean();
        res.json({ pieces: docs.map(publicItem) });
    }));
    app.post('/api/pieces', ...guard, route(async (req, res) => {
        const id = optionalId(req.body.id);
        if (!id) throw bad('Çalışma kimliği gerekli.');
        const catalogTrackId = string(req.body.catalogTrackId, 'Katalog kimliği', 120);
        if (catalogTrackId && !await Like.exists({ userId: req.user.id, trackId: catalogTrackId })) return res.status(404).json({ error: 'Arşiv eseri bulunamadı.' });
        const values = { title: string(req.body.title, 'Başlık', 120, true),
            composer: string(req.body.composer, 'Besteci', 120), notes: string(req.body.notes, 'Not', 2000), catalogTrackId };
        const doc = await Piece.findOneAndUpdate({ userId: req.user.id, clientId: id },
            { $setOnInsert: values }, { upsert: true, new: true }).lean();
        res.json({ piece: publicItem(doc) });
    }));
}

module.exports = { registerStudioRoutes, validateRecording, Recording, Piece, MAX_EVENTS, MAX_DURATION };
