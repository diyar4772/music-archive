// Müzik Defteri against a real MongoDB.
//
// test/journal.test.js covers the behaviour through the in-memory store. This
// file exists because the Mongo path is different code: ObjectId casting, the
// aggregate behind the archive's note counts, and the "not a valid id" branch
// that must answer 404 rather than throwing a CastError into a 500.
//
// Skipped unless a local, disposable MongoDB is offered:
//   STUDIO_TEST_MONGO=mongodb://127.0.0.1:27017 npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('journal persistence, ownership and note counts on MongoDB', {
    skip: !process.env.STUDIO_TEST_MONGO
}, async t => {
    const uri = new URL(process.env.STUDIO_TEST_MONGO);
    assert.ok(uri.protocol === 'mongodb:' && ['127.0.0.1', 'localhost'].includes(uri.hostname),
        'integration test only accepts a local MongoDB');
    uri.pathname = `/music_archive_journal_${crypto.randomUUID().replaceAll('-', '')}`;

    Object.assign(process.env, {
        NODE_ENV: 'test', SKIP_DOTENV_CONFIG: 'true', MONGO_URI: uri.toString(),
        JWT_SECRET: crypto.randomBytes(32).toString('hex'), ADMIN_USERNAME: 'test-admin',
        ADMIN_PASSWORD: crypto.randomBytes(32).toString('hex')
    });

    const { app, connectDatabase } = require('../server');
    const mongoose = require('mongoose');
    const { JournalEntry } = require('../server/journal');
    await connectDatabase();
    await JournalEntry.init();

    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}/api`;

    const call = async (path, { method = 'GET', token, body } = {}) => {
        const sendsBody = body !== undefined && !['GET', 'HEAD'].includes(method);
        const response = await fetch(base + path, {
            method,
            headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
            ...(sendsBody && { body: JSON.stringify(body) })
        });
        const raw = await response.text();
        try { return { status: response.status, body: JSON.parse(raw) }; }
        catch { return { status: response.status, body: raw }; }
    };

    try {
        const accounts = [];
        for (const username of ['journal-alice', 'journal-bob']) {
            const created = await call('/register', { method: 'POST', body: { username, password: 'TestMusic!1234' } });
            assert.equal(created.status, 200);
            accounts.push(created.body.token);
        }
        const [alice, bob] = accounts;
        const track = 'mongo-track-1';

        await call('/library/like', { method: 'POST', token: alice, body: { spotifyId: track, title: 'Kalıcı Şarkı', artist: 'Sanatçı' } });
        await call('/rate', { method: 'POST', token: alice, body: { itemId: track, itemType: 'track', rating: 3.5 } });

        await t.test('entries persist with the score they were written at', async () => {
            const first = await call('/library/journal', { method: 'POST', token: alice, body: { trackId: track, body: 'İlk not' } });
            assert.equal(first.status, 201);
            assert.equal(first.body.entry.rating, 3.5);
            assert.equal(first.body.entry.trackName, 'Kalıcı Şarkı', 'the archive row filled the name in');

            await call('/rate', { method: 'POST', token: alice, body: { itemId: track, itemType: 'track', rating: 5 } });
            const second = await call('/library/journal', { method: 'POST', token: alice, body: { trackId: track, body: 'İkinci not' } });
            assert.equal(second.body.entry.rating, 5);

            const list = await call(`/library/journal?trackId=${track}`, { token: alice });
            assert.equal(list.body.total, 2);
            assert.deepEqual(list.body.entries.map(e => e.rating), [5, 3.5]);
            assert.equal(await JournalEntry.countDocuments({ trackId: track }), 2, 'both rows are in the collection');
        });

        await t.test('the archive carries note counts from a single aggregate', async () => {
            const me = await call('/me', { token: alice });
            const row = me.body.likes.find(like => like.trackId === track);
            assert.equal(row.noteCount, 2);
            assert.ok(row.lastNoteAt);

            const other = await call('/me', { token: bob });
            assert.deepEqual(other.body.likes, [], 'and never leaks another account\'s counts');
        });

        await t.test('a malformed id is a 404, not a 500', async () => {
            for (const id of ['not-an-object-id', '123', '../etc/passwd']) {
                const patched = await call(`/library/journal/${encodeURIComponent(id)}`, { method: 'PATCH', token: alice, body: { body: 'x' } });
                assert.equal(patched.status, 404, id);
                assert.equal(patched.body.code, 'journal_entry_not_found');
                const removed = await call(`/library/journal/${encodeURIComponent(id)}`, { method: 'DELETE', token: alice });
                assert.equal(removed.status, 404, id);
            }
        });

        await t.test('another account cannot touch the entries, and deletion is final', async () => {
            const list = await call(`/library/journal?trackId=${track}`, { token: alice });
            const { id, createdAt, rating } = list.body.entries[0];

            assert.equal((await call(`/library/journal/${id}`, { method: 'PATCH', token: bob, body: { body: 'ele geçirildi' } })).status, 404);
            assert.equal((await call(`/library/journal/${id}`, { method: 'DELETE', token: bob })).status, 404);

            const edited = await call(`/library/journal/${id}`, { method: 'PATCH', token: alice, body: { body: 'düzeltildi' } });
            assert.equal(edited.status, 200);
            assert.equal(edited.body.entry.createdAt, createdAt);
            assert.equal(edited.body.entry.rating, rating);
            assert.ok(edited.body.entry.editedAt);

            assert.equal((await call(`/library/journal/${id}`, { method: 'DELETE', token: alice })).status, 200);
            assert.equal((await call(`/library/journal/${id}`, { method: 'DELETE', token: alice })).status, 404);
            assert.equal(await JournalEntry.countDocuments({ trackId: track }), 1);
        });

        await t.test('unarchiving the track keeps the journal', async () => {
            assert.equal((await call(`/library/track/${track}`, { method: 'DELETE', token: alice })).status, 200);
            const list = await call(`/library/journal?trackId=${track}`, { token: alice });
            assert.equal(list.body.total, 1);
            assert.equal(list.body.entries[0].trackName, 'Kalıcı Şarkı', 'the entry still knows what it is about');
        });
    } finally {
        // The database is left in place for inspection, like the studio suite.
        await new Promise(resolve => server.close(resolve));
        await mongoose.disconnect();
    }
});
