// Müzik Defteri — the append-only journal.
//
// The behaviour that matters here is the one the old single note could not
// give: writing again must ADD, never replace, and each entry must keep the
// score the track carried on the day it was written. These run against the
// real Express app over HTTP, so the routes, the guards and the limiter are
// all in the path.
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

Object.assign(process.env, {
    NODE_ENV: 'test', SKIP_DOTENV_CONFIG: 'true', JWT_SECRET: 'test-only-jwt-secret',
    ADMIN_USERNAME: 'test-admin', ADMIN_PASSWORD: 'test-only-admin-password', MONGO_URI: ''
});
const { app, connectDatabase } = require('../server');

let server, base;
const tokenFor = user => jwt.sign({ id: user, username: user }, process.env.JWT_SECRET);
const alice = tokenFor('journal-alice');
const bob = tokenFor('journal-bob');

/**
 * @param {string} path
 * @param {{method?: string, token?: string, body?: Object}} [options]
 */
async function call(path, { method = 'GET', token = alice, body } = {}) {
    const sendsBody = body !== undefined && !['GET', 'HEAD'].includes(method);
    const response = await fetch(base + path, {
        method,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        ...(sendsBody && { body: JSON.stringify(body) })
    });
    // authenticateToken answers 401 as plain text, so this cannot assume JSON.
    const text = await response.text();
    try {
        return { status: response.status, body: JSON.parse(text) };
    } catch {
        return { status: response.status, body: text };
    }
}

const write = (trackId, body, options = {}) =>
    call('/api/library/journal', { method: 'POST', body: { trackId, body, ...options.meta }, ...options });

test.before(async () => {
    await connectDatabase();
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => new Promise(resolve => server.close(resolve)));

test('the journal requires a session', async () => {
    for (const [path, method] of [
        ['/api/library/journal', 'GET'],
        ['/api/library/journal', 'POST'],
        ['/api/library/journal/abc', 'PATCH'],
        ['/api/library/journal/abc', 'DELETE']
    ]) {
        const result = await call(path, { method, token: null, body: { trackId: 't', body: 'x' } });
        assert.equal(result.status, 401, `${method} ${path}`);
    }
});

test('a second note is added, not written over the first', async () => {
    const track = 'track-history';
    const first = await write(track, 'Piyano girişini sevdim, geri kalanı pek geçmedi.');
    assert.equal(first.status, 201);

    const second = await write(track, 'Bu yaz sürekli dinledim. Artık başka bir anlamı var.');
    assert.equal(second.status, 201);
    assert.notEqual(first.body.entry.id, second.body.entry.id);

    const list = await call(`/api/library/journal?trackId=${track}`);
    assert.equal(list.status, 200);
    assert.equal(list.body.total, 2);
    assert.deepEqual(list.body.entries.map(e => e.id), [second.body.entry.id, first.body.entry.id],
        'newest first');
    assert.equal(list.body.entries[1].body, 'Piyano girişini sevdim, geri kalanı pek geçmedi.',
        'the older entry is untouched');
});

test('each entry keeps the score the track had when it was written', async () => {
    const track = 'track-rating-history';
    const rate = score => call('/api/rate', { method: 'POST', body: { itemId: track, itemType: 'track', rating: score } });

    const unrated = await write(track, 'Henüz puan vermeden yazdığım not.');
    assert.equal(unrated.body.entry.rating, null);

    await rate(3);
    const atThree = await write(track, 'Üç yıldızlık dönem.');
    assert.equal(atThree.body.entry.rating, 3);

    await rate(4.5);
    const atFour = await write(track, 'Artık dört buçuk.');
    assert.equal(atFour.body.entry.rating, 4.5);

    const list = await call(`/api/library/journal?trackId=${track}`);
    assert.deepEqual(list.body.entries.map(e => e.rating), [4.5, 3, null],
        'raising the score must not rewrite what earlier entries recorded');
});

test('empty, oversized and unattached entries are refused', async () => {
    const tooLong = 'x'.repeat(2001);
    const cases = [
        [{ trackId: 'track-x', body: '   ' }, 'journal_body_required'],
        [{ trackId: 'track-x' }, 'journal_body_required'],
        [{ trackId: 'track-x', body: 42 }, 'journal_body_required'],
        [{ trackId: 'track-x', body: tooLong }, 'journal_body_too_long'],
        [{ body: 'no track' }, 'journal_track_required'],
        [{ trackId: '  ', body: 'blank track' }, 'journal_track_required']
    ];
    for (const [payload, code] of cases) {
        const result = await call('/api/library/journal', { method: 'POST', body: payload });
        assert.equal(result.status, 400, JSON.stringify(payload));
        assert.equal(result.body.code, code, JSON.stringify(payload));
        assert.ok(result.body.error && result.body.error !== code, 'a human sentence travels beside the code');
    }

    // The boundary itself is allowed.
    const atLimit = await write('track-x', 'y'.repeat(2000));
    assert.equal(atLimit.status, 201);
    assert.equal(atLimit.body.entry.body.length, 2000);
});

test('a bad page request is rejected instead of being silently clamped', async () => {
    for (const query of ['limit=0', 'limit=101', 'limit=abc', 'limit=-1', 'offset=-5', 'limit=1.5']) {
        const result = await call(`/api/library/journal?${query}`);
        assert.equal(result.status, 400, query);
    }
    assert.equal((await call('/api/library/journal?limit=100&offset=0')).status, 200);
});

test('the list is per user, per track, and pages', async () => {
    for (let i = 1; i <= 3; i += 1) await write('track-paged', `Not ${i}`);

    const page = await call('/api/library/journal?trackId=track-paged&limit=2');
    assert.equal(page.body.entries.length, 2);
    assert.equal(page.body.total, 3);

    const next = await call('/api/library/journal?trackId=track-paged&limit=2&offset=2');
    assert.equal(next.body.entries.length, 1);
    assert.equal(next.body.entries[0].body, 'Not 1', 'the oldest entry is on the last page');

    const everything = await call('/api/library/journal?limit=100');
    assert.ok(everything.body.total > 3, 'without a trackId the whole journal comes back');
    assert.ok(everything.body.entries.every(entry => typeof entry.trackId === 'string'));

    const otherUser = await call('/api/library/journal?trackId=track-paged', { token: bob });
    assert.deepEqual(otherUser.body.entries, [], 'another account sees none of it');
});

test('an entry can be corrected without losing its date or its score', async () => {
    await call('/api/rate', { method: 'POST', body: { itemId: 'track-edit', itemType: 'track', rating: 2 } });
    const created = await write('track-edit', 'İlk hâli');
    const { id, createdAt, rating } = created.body.entry;

    const edited = await call(`/api/library/journal/${id}`, { method: 'PATCH', body: { body: 'Düzeltilmiş hâli' } });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.entry.body, 'Düzeltilmiş hâli');
    assert.equal(edited.body.entry.createdAt, createdAt, 'the entry keeps the day it was written');
    assert.equal(edited.body.entry.rating, rating, 'and the score it recorded');
    assert.ok(edited.body.entry.editedAt, 'but it is marked as edited');

    const empty = await call(`/api/library/journal/${id}`, { method: 'PATCH', body: { body: '' } });
    assert.equal(empty.status, 400);
    assert.equal(empty.body.code, 'journal_body_required');
});

test('one account cannot read, edit or delete another account\'s entries', async () => {
    const mine = await write('track-private', 'Yalnız bana ait');
    const id = mine.body.entry.id;

    const theirEdit = await call(`/api/library/journal/${id}`, { method: 'PATCH', token: bob, body: { body: 'ele geçirildi' } });
    assert.equal(theirEdit.status, 404, 'an entry that is not yours does not exist for you');

    const theirDelete = await call(`/api/library/journal/${id}`, { method: 'DELETE', token: bob });
    assert.equal(theirDelete.status, 404);

    const stillMine = await call('/api/library/journal?trackId=track-private');
    assert.equal(stillMine.body.entries[0].body, 'Yalnız bana ait');
});

test('deleting one entry leaves the rest of the journal alone', async () => {
    const first = await write('track-delete', 'Kalacak olan');
    const second = await write('track-delete', 'Silinecek olan');

    assert.equal((await call(`/api/library/journal/${second.body.entry.id}`, { method: 'DELETE' })).status, 200);
    assert.equal((await call(`/api/library/journal/${second.body.entry.id}`, { method: 'DELETE' })).status, 404,
        'deleting twice is a 404, not a crash');

    const list = await call('/api/library/journal?trackId=track-delete');
    assert.deepEqual(list.body.entries.map(e => e.id), [first.body.entry.id]);
});

test('the archive row carries its note count, and the journal outlives the row', async () => {
    const track = 'track-archived';
    await call('/api/library/like', { method: 'POST', body: { spotifyId: track, title: 'Arşivdeki', artist: 'Sanatçı' } });
    await write(track, 'Arşive aldığım gün.');
    await write(track, 'Bir yıl sonra.');

    const me = await call('/api/me');
    const row = me.body.likes.find(like => like.trackId === track);
    assert.ok(row, 'the track is archived');
    assert.equal(row.noteCount, 2);
    assert.ok(row.lastNoteAt, 'and the badge knows when the last entry was written');

    // Removing a track from the archive must not erase what you wrote about it.
    assert.equal((await call(`/api/library/track/${track}`, { method: 'DELETE' })).status, 200);
    const after = await call(`/api/library/journal?trackId=${track}`);
    assert.equal(after.body.total, 2, 'unarchiving keeps the history');
});

test('the entry inherits the archived track\'s name when the client sends none', async () => {
    const track = 'track-meta';
    await call('/api/library/like', { method: 'POST', body: { spotifyId: track, title: 'Adı Var', artist: 'Sanatçısı Var' } });

    const inherited = await write(track, 'Meta göndermeden yazıldı.');
    assert.equal(inherited.body.entry.trackName, 'Adı Var');
    assert.equal(inherited.body.entry.artistName, 'Sanatçısı Var');

    const explicit = await write(track, 'Meta ile yazıldı.', {
        meta: { trackName: 'Gönderilen Ad', artistName: 'Gönderilen Sanatçı' }
    });
    assert.equal(explicit.body.entry.trackName, 'Gönderilen Ad');
    assert.equal(explicit.body.entry.artistName, 'Gönderilen Sanatçı');
});
