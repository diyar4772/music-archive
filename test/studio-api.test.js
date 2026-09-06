const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('studio MongoDB persistence, ownership, idempotent retries and relationships', {
    skip: !process.env.STUDIO_TEST_MONGO
}, async t => {
    const uri = new URL(process.env.STUDIO_TEST_MONGO);
    assert.ok(uri.protocol === 'mongodb:' && ['127.0.0.1', 'localhost'].includes(uri.hostname), 'integration test only accepts a local MongoDB');
    uri.pathname = `/music_archive_test_${crypto.randomUUID().replaceAll('-', '')}`;
    Object.assign(process.env, {
        NODE_ENV: 'test', SKIP_DOTENV_CONFIG: 'true', MONGO_URI: uri.toString(),
        JWT_SECRET: crypto.randomBytes(32).toString('hex'), ADMIN_USERNAME: 'test-admin',
        ADMIN_PASSWORD: crypto.randomBytes(32).toString('hex')
    });
    const { app, connectDatabase } = require('../server');
    const mongoose = require('mongoose');
    const { Recording, Piece } = require('../server/studio');
    await connectDatabase();
    await Promise.all([Recording.init(), Piece.init()]);
    let server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    let base = `http://127.0.0.1:${server.address().port}/api`;
    const users = [];
    const request = async (path, token, data) => {
        const response = await fetch(`${base}${path}`, { method: data ? 'POST' : 'GET',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            ...(data ? { body: JSON.stringify(data) } : {}) });
        const text = await response.text();
        let body;
        try { body = JSON.parse(text); } catch { body = text; }
        return { status: response.status, body };
    };
    const credentials = ['alice', 'bob'].map(username => ({ username, password: 'TestMusic!1234' }));
    try {
        for (const values of credentials) {
            const result = await request('/register', null, values);
            assert.equal(result.status, 200);
            users.push(result.body);
        }
        const a = users[0].token;
        const b = users[1].token;
        await t.test('anonymous access is denied', async () => {
            for (const path of ['/recordings', '/pieces']) assert.equal((await request(path)).status, 401);
        });
        const pieceId = crypto.randomUUID();
        const piece = await request('/pieces', a, { id: pieceId, title: 'Etüt', notes: 'Yavaş çalış' });
        assert.equal(piece.status, 200);
        await t.test('ten consecutive capture payloads persist and repeated uploads do not duplicate', async () => {
            for (let i = 0; i < 10; i++) {
                const payload = { id: crypto.randomUUID(), title: `Deneme ${i}`, description: 'Canlı API testi', tags: ['etüt'],
                    source: 'midi', input: 'simulation', instrument: 'piano', pieceId, takeGroupId: pieceId,
                    durationMs: 1200, events: [{ at: 0, data: [144, 60, 100] }, { at: 1200, data: [128, 60, 0] }] };
                const [one, retry] = await Promise.all([request('/recordings', a, payload), request('/recordings', a, payload)]);
                assert.equal(one.status, 200);
                assert.equal(retry.status, 200);
                assert.equal(one.body.stored, true);
                const read = await request(`/recordings/${payload.id}`, a);
                assert.deepEqual(read.body.recording.events, payload.events);
                assert.equal((await request(`/recordings/${payload.id}`, b)).status, 404);
                assert.equal((await request('/recordings', a, { ...payload, title: 'changed' })).status, 409);
                assert.equal((await request('/recordings', b, { ...payload, id: crypto.randomUUID() })).status, 404);
            }
            const list = await request('/recordings', a);
            assert.equal(list.body.recordings.length, 10);
            assert.equal(list.body.recordings[0].events, undefined, 'list response does not carry large event arrays');
            assert.equal((await request('/recordings', b)).body.recordings.length, 0);
            assert.equal((await request('/pieces', b)).body.pieces.length, 0);
        });
        await t.test('closing HTTP and MongoDB connections retains the saved recordings', async () => {
            await new Promise(resolve => server.close(resolve));
            await mongoose.disconnect();
            await connectDatabase();
            server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
            base = `http://127.0.0.1:${server.address().port}/api`;
            const login = await request('/login', null, credentials[0]);
            assert.equal(login.status, 200);
            assert.equal((await request('/recordings', login.body.token)).body.recordings.length, 10);
        });
        await t.test('missing persistent storage rejects saves instead of acknowledging volatile data', async () => {
            await mongoose.disconnect();
            assert.equal((await request('/recordings', a, { id: crypto.randomUUID() })).status, 503);
        });
    } finally {
        await new Promise(resolve => server.close(resolve));
        // The randomly named local test database is retained for inspection.
        await mongoose.disconnect();
    }
});
