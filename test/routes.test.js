const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const jwt = require('jsonwebtoken');
Object.assign(process.env, { NODE_ENV: 'test', SKIP_DOTENV_CONFIG: 'true', JWT_SECRET: 'test-only-jwt-secret', ADMIN_USERNAME: 'test-admin', ADMIN_PASSWORD: 'test-only-admin-password', MONGO_URI: '' });
const { app, connectDatabase } = require('../server');
let server, base;
const token = jwt.sign({ id: 'route-user', username: 'route-user' }, process.env.JWT_SECRET);
const call = async (path, method = 'GET', body) => {
    const response = await fetch(base + path, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body && { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
};
test.before(async () => {
    await connectDatabase();
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => new Promise(resolve => server.close(resolve)));
test('no duplicate method/path registrations, including renamed parameters and aliases', () => {
    const seen = new Set();
    for (const layer of app._router.stack) {
        if (!layer.route) continue;
        for (const path of [layer.route.path].flat()) {
            for (const method of Object.keys(layer.route.methods)) {
                const key = `${method} ${path.replace(/:[^/]+/g, ':param')}`;
                assert.ok(!seen.has(key), `Duplicate route: ${key}`);
                seen.add(key);
            }
        }
    }
});
test('library idempotent likes and legacy toggles share storage; deletion uses Spotify ID', async () => {
    const data = { spotifyId: 'track-one', title: 'One', artist: 'Artist' };
    assert.equal((await call('/api/library/like', 'POST', data)).body.action, 'added');
    assert.equal((await call('/api/library/like', 'POST', data)).body.action, 'exists');
    const tracks = await call('/api/library/tracks');
    assert.equal(tracks.status, 200);
    assert.equal(tracks.body.tracks.length, 1);
    assert.equal((await call('/api/library/track/track-one', 'DELETE')).status, 200);
    assert.equal((await call('/api/library/track/track-one', 'DELETE')).status, 404);
    assert.equal((await call('/api/like', 'POST', { trackId: 'track-one', trackName: 'One' })).body.status, 'liked');
    assert.equal((await call('/api/like', 'POST', { trackId: 'track-one' })).body.status, 'unliked');
});
test('follow aliases share one toggle and preserve response contracts', async () => {
    const data = { artistId: 'artist-one', artistName: 'Artist' };
    assert.equal((await call('/api/library/follow', 'POST', data)).body.action, 'followed');
    assert.equal((await call('/api/library/artists')).body.artists.length, 1);
    assert.equal((await call('/api/follow', 'POST', data)).body.status, 'unfollowed');
    assert.equal((await call('/api/library/artists')).body.artists.length, 0);
});
test('playlist aliases preserve envelopes and share validation and contents', async () => {
    for (const path of ['/api/playlists', '/api/library/playlists']) {
        assert.equal((await call(path, 'POST', { name: { $ne: null } })).status, 400);
    }
    const created = await call('/api/library/playlists', 'POST', { name: 'Collection' });
    assert.equal(created.status, 200);
    const id = created.body.playlist.id;
    const legacy = await call('/api/playlists');
    const canonical = await call('/api/library/playlists');
    assert.equal(legacy.body[0].id, id);
    assert.deepEqual(canonical.body.playlists, legacy.body);
    assert.equal((await call(`/api/playlists/${id}/add`, 'POST', { trackId: 'one', trackName: 'One' })).status, 200);
    assert.equal((await call('/api/library/playlists')).body.playlists[0].trackCount, 1);
});
test('invalid supplied tokens never fall back to mock auth in development', () => {
    const probe = spawnSync(process.execPath, ['-e', `
        const {app, connectDatabase} = require('./server');
        (async () => {
            await connectDatabase();
            const server=app.listen(0,'127.0.0.1',async()=>{
                const statuses=[];
                for(const path of ['/api/me','/api/library/check/one']) {
                    for(const authorization of ['Bearer invalid','Bearer','Basic invalid']) {
                        const res=await fetch('http://127.0.0.1:'+server.address().port+path,{headers:{authorization}});
                        statuses.push(res.status);
                    }
                }
                console.log(JSON.stringify(statuses));
                server.close();
            });
        })();
    `], { cwd: require('node:path').join(__dirname, '..'), env: { ...process.env, NODE_ENV: 'development', ENABLE_MOCK_AUTH: 'true' }, encoding: 'utf8', timeout: 10000 });
    assert.equal(probe.status, 0, probe.stderr);
    assert.match(probe.stdout, /\[401,401,401,401,401,401\]/);
});
