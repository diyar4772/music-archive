const test = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.SKIP_DOTENV_CONFIG = 'true';
process.env.JWT_SECRET = 'test-only-jwt-secret';
process.env.ADMIN_USERNAME = 'test-admin';
process.env.ADMIN_PASSWORD = 'test-only-admin-password';
process.env.MONGO_URI = '';
delete process.env.SPOTIFY_CLIENT_ID;
delete process.env.SPOTIFY_CLIENT_SECRET;
const axios = require('axios');
let failure;
let tokenFailure;
let calledLimit;
axios.post = async () => {
    if (tokenFailure) throw tokenFailure;
    return { data: { access_token: 'test-only-token', expires_in: 3600 } };
};
axios.get = async url => {
    if (failure) throw failure;
    calledLimit = new URL(url).searchParams.get('limit');
    return { data: { artists: { items: [{ id: 'test', name: 'Artist', images: [] }] } } };
};
const {app, connectDatabase} = require('../server');
let server;
let base;
test.before(async () => {
    await connectDatabase();
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => new Promise(resolve => server.close(resolve)));

test('missing Spotify configuration is visible in health and search/album return 503', async () => {
    const health = await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.spotify, 'missing');
    assert.equal(health.database, 'in-memory');
    for (const path of ['/api/search?artist=tarkan', '/api/album/test']) {
        const res = await fetch(base + path);
        assert.equal(res.status, 503);
        assert.deepEqual(await res.json(), { error: 'SEARCH_UNAVAILABLE', detail: 'Spotify credentials not configured' });
    }
});

test('Spotify token rejection is 502 and does not leak upstream credentials', async () => {
    process.env.SPOTIFY_CLIENT_ID = 'test-only-id';
    process.env.SPOTIFY_CLIENT_SECRET = 'test-only-secret';
    for (const status of [401, 403]) {
        tokenFailure = { response: { status }, message: 'private upstream details' };
        const res = await fetch(`${base}/api/search?artist=auth${status}`);
        assert.equal(res.status, 502);
        assert.deepEqual(await res.json(), { error: 'SEARCH_UPSTREAM_AUTH_FAILED' });
    }
    tokenFailure = null;
});

test('Spotify throttling preserves status and Retry-After; timeout is 504', async () => {
    failure = { response: { status: 429, headers: { 'retry-after': '17' } } };
    const limited = await fetch(`${base}/api/search?artist=limited`);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('retry-after'), '17');
    failure = { code: 'ECONNABORTED', isAxiosError: true };
    const timed = await fetch(`${base}/api/album/test`);
    assert.equal(timed.status, 504);
    assert.deepEqual(await timed.json(), { error: 'SEARCH_TIMEOUT' });
    failure = null;
});

test('search uses the development-mode limit and tolerates absent artist genres', async () => {
    const res = await fetch(`${base}/api/search?artist=valid`);
    assert.equal(res.status, 200);
    assert.equal(calledLimit, '10');
    assert.equal((await res.json())[0].genres, '');
    const invalid = await fetch(`${base}/api/search?artist=`);
    assert.equal(invalid.status, 400);
});
