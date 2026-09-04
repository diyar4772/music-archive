const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.SKIP_DOTENV_CONFIG = 'true';
process.env.JWT_SECRET = 'test-only-jwt-secret';
process.env.ADMIN_USERNAME = 'test-admin';
process.env.ADMIN_PASSWORD = 'test-only-admin-password';
process.env.CORS_ORIGINS = 'https://allowed.example';

const axios = require('axios');
let spotifySearchCalls = 0;

axios.post = async (url) => {
    if (url === 'https://accounts.spotify.com/api/token') {
        return { data: { access_token: 'test-spotify-token', expires_in: 3600 } };
    }
    throw new Error(`Unexpected POST ${url}`);
};

axios.get = async (url) => {
    if (url.startsWith('https://api.spotify.com/v1/search')) {
        spotifySearchCalls += 1;
        return {
            data: {
                artists: {
                    items: [{ id: 'artist-1', name: 'Test Artist', images: [], genres: [], popularity: 50 }]
                }
            }
        };
    }
    throw new Error(`Unexpected GET ${url}`);
};

const { app, connectDatabase, _test } = require('../server');

let server;
let baseUrl;

test.before(async () => {
    await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
});

const request = async (path, options = {}) => {
    const response = await fetch(`${baseUrl}${path}`, options);
    const text = await response.text();
    let body;
    try {
        body = JSON.parse(text);
    } catch {
        body = text;
    }
    return { response, body };
};

const postJson = (path, body, headers = {}) => request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
});

const bearerHeaders = (token, clientIp) => ({
    authorization: `Bearer ${token}`,
    ...(clientIp && { 'x-forwarded-for': clientIp })
});

const adminHeaders = (username, password, clientIp) => ({
    authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
    ...(clientIp && { 'x-forwarded-for': clientIp })
});

test('health reports 503 before database readiness and 200 for controlled in-memory mode', async () => {
    const unavailable = await request('/api/health');
    assert.equal(unavailable.response.status, 503);
    assert.deepEqual(unavailable.body, { status: 'not_ready' });

    await connectDatabase();

    const ready = await request('/api/health');
    assert.equal(ready.response.status, 200);
    assert.deepEqual(ready.body, { status: 'ready' });
});

test('static serving exposes only required frontend assets', async () => {
    const index = await request('/');
    assert.equal(index.response.status, 200);
    assert.match(index.response.headers.get('content-type'), /text\/html/);

    const frontendModule = await request('/js/app.js');
    assert.equal(frontendModule.response.status, 200);
    assert.match(frontendModule.response.headers.get('content-type'), /javascript/);

    for (const sourcePath of [
        '/server.js',
        '/package.json',
        '/panel-4772.html',
        '/CLAUDE_BACKEND_AUDIT.md',
        '/docs/reports/CODEX_BACKEND_RUNTIME_SECURITY_FIXES_2026-09-04.md',
        '/.env',
        '/.git/config'
    ]) {
        const result = await request(sourcePath);
        assert.equal(result.response.status, 404, sourcePath);
    }
});

test('web and mobile clients retain refresh and server logout support', async () => {
    const index = await request('/');
    assert.match(index.body, /fetchWithRefresh/);
    assert.match(index.body, /userRefreshToken/);
    assert.match(index.body, /\/logout/);

    const webAuth = await request('/js/services/auth.js');
    assert.match(webAuth.body, /REFRESH_TOKEN/);
    assert.match(webAuth.body, /post\('\/logout'/);

    const mobileAuth = fs.readFileSync(
        path.resolve(__dirname, '../mobile/services/auth.ts'),
        'utf8'
    );
    assert.match(mobileAuth, /getRefreshToken/);
    assert.match(mobileAuth, /api\.post\('\/logout'/);
});

test('protected endpoints return 401 for missing, invalid, and expired access tokens', async () => {
    const missing = await request('/api/me');
    assert.equal(missing.response.status, 401);

    const invalid = await request('/api/me', {
        headers: { authorization: 'Bearer invalid-token' }
    });
    assert.equal(invalid.response.status, 401);

    const expiredToken = jwt.sign(
        { id: 'expired-user', username: 'expired' },
        process.env.JWT_SECRET,
        { expiresIn: -1 }
    );
    const expired = await request('/api/me', {
        headers: { authorization: `Bearer ${expiredToken}` }
    });
    assert.equal(expired.response.status, 401);
});

test('Mongo schemas persist notes and accept half-star ratings', () => {
    const likePaths = _test.models.Like.schema.paths;
    assert.ok(likePaths.userNote);
    assert.ok(likePaths.noteUpdatedAt);

    const rating = new _test.models.Rating({
        userId: '507f1f77bcf86cd799439011',
        itemId: 'track-half-star',
        itemType: 'track',
        rating: 0.5
    });
    assert.equal(rating.validateSync(), undefined);
});

test('register returns refresh credentials and a 30-minute access token', async () => {
    const register = await postJson('/api/register', {
        username: 'register_refresh_user',
        password: 'password123'
    }, { 'x-forwarded-for': '203.0.113.40' });

    assert.equal(register.response.status, 200);
    assert.equal(typeof register.body.refreshToken, 'string');
    const storedUser = _test.inMemoryDB.users.find(user => user.username === 'register_refresh_user');
    assert.notEqual(storedUser.refreshToken, register.body.refreshToken);
    assert.match(storedUser.refreshToken, /^[a-f0-9]{64}$/);
    const decoded = jwt.decode(register.body.token);
    assert.equal(decoded.exp - decoded.iat, 30 * 60);
});

test('register and login reject non-string credentials', async () => {
    const register = await postJson('/api/register', {
        username: { $ne: null },
        password: 'password123'
    });
    assert.equal(register.response.status, 400);

    const login = await postJson('/api/login', {
        username: { $ne: null },
        password: { $ne: null }
    });
    assert.equal(login.response.status, 400);
});

test('login issues a refresh token and refresh rotates it', async () => {
    const register = await postJson('/api/register', {
        username: 'runtime_test_user',
        password: 'password123'
    });
    assert.equal(register.response.status, 200);

    const login = await postJson('/api/login', {
        username: 'runtime_test_user',
        password: 'password123'
    });
    assert.equal(login.response.status, 200);
    assert.equal(typeof login.body.token, 'string');
    assert.equal(typeof login.body.refreshToken, 'string');

    const injected = await postJson('/api/auth/refresh', { refreshToken: { $ne: null } });
    assert.equal(injected.response.status, 400);

    const refreshed = await postJson('/api/auth/refresh', { refreshToken: login.body.refreshToken });
    assert.equal(refreshed.response.status, 200);
    assert.equal(typeof refreshed.body.token, 'string');
    assert.equal(typeof refreshed.body.refreshToken, 'string');
    assert.notEqual(refreshed.body.refreshToken, login.body.refreshToken);

    const reused = await postJson('/api/auth/refresh', { refreshToken: login.body.refreshToken });
    assert.equal(reused.response.status, 401);
});

test('logout invalidates the stored refresh token', async () => {
    const register = await postJson('/api/register', {
        username: 'logout_test_user',
        password: 'password123'
    }, { 'x-forwarded-for': '203.0.113.41' });
    assert.equal(register.response.status, 200);

    const logout = await postJson('/api/logout', {
        refreshToken: register.body.refreshToken
    }, { 'x-forwarded-for': '203.0.113.41' });
    assert.equal(logout.response.status, 200);
    assert.deepEqual(logout.body, { status: 'logged_out' });

    const refresh = await postJson('/api/auth/refresh', {
        refreshToken: register.body.refreshToken
    }, { 'x-forwarded-for': '203.0.113.41' });
    assert.equal(refresh.response.status, 401);
});

test('admin deletion cascades ratings and login history', async () => {
    const register = await postJson('/api/register', {
        username: 'cascade_test_user',
        password: 'password123'
    }, { 'x-forwarded-for': '203.0.113.42' });
    assert.equal(register.response.status, 200);

    const login = await postJson('/api/login', {
        username: 'cascade_test_user',
        password: 'password123'
    }, { 'x-forwarded-for': '203.0.113.42' });
    assert.equal(login.response.status, 200);
    const decoded = jwt.decode(login.body.token);

    const rating = await postJson('/api/rate', {
        itemId: 'cascade-track',
        itemType: 'track',
        itemName: 'Cascade Track',
        rating: 0.5
    }, bearerHeaders(login.body.token, '203.0.113.42'));
    assert.equal(rating.response.status, 200);
    assert.ok(_test.inMemoryDB.ratings.some(item => item.userId === decoded.id));
    assert.ok(_test.inMemoryDB.loginHistory.some(item => item.userId === decoded.id));

    const deleted = await request(`/api/admin/users/${decoded.id}`, {
        method: 'DELETE',
        headers: adminHeaders('test-admin', 'test-only-admin-password', '203.0.113.43')
    });
    assert.equal(deleted.response.status, 200);
    assert.equal(_test.inMemoryDB.ratings.some(item => item.userId === decoded.id), false);
    assert.equal(_test.inMemoryDB.loginHistory.some(item => item.userId === decoded.id), false);
});

test('admin authentication safely rejects mismatches and is rate limited', async () => {
    const valid = await request('/api/admin/stats', {
        headers: adminHeaders('test-admin', 'test-only-admin-password', '203.0.113.44')
    });
    assert.equal(valid.response.status, 200);

    const wrongUsername = await request('/api/admin/stats', {
        headers: adminHeaders('x', 'test-only-admin-password', '203.0.113.45')
    });
    assert.equal(wrongUsername.response.status, 403);

    const wrongPassword = await request('/api/admin/stats', {
        headers: adminHeaders('test-admin', 'x', '203.0.113.46')
    });
    assert.equal(wrongPassword.response.status, 403);

    let limited;
    for (let attempt = 0; attempt < 11; attempt += 1) {
        limited = await request('/api/admin/stats', {
            headers: adminHeaders('test-admin', 'wrong-password', '203.0.113.47')
        });
    }
    assert.equal(limited.response.status, 429);
    assert.deepEqual(limited.body, {
        error: 'Too many admin authentication attempts. Please try again later.'
    });
});

test('like helpers use atomic upsert while preserving toggle status', async () => {
    const calls = [];
    const insertedModel = {
        findOneAndUpdate: async (...args) => {
            calls.push(args);
            return { value: { _id: 'like-1' }, lastErrorObject: { updatedExisting: false } };
        },
        deleteOne: async () => assert.fail('new likes must not be deleted')
    };
    const liked = await _test.toggleLike(
        { userId: 'user-1', trackId: 'track-1' },
        { userId: 'user-1', trackId: 'track-1' },
        insertedModel
    );
    assert.equal(liked, 'liked');
    assert.equal(calls[0][2].upsert, true);
    assert.deepEqual(calls[0][1], {
        $setOnInsert: { userId: 'user-1', trackId: 'track-1' }
    });

    let deletedId;
    const existingModel = {
        findOneAndUpdate: async () => ({
            value: { _id: 'like-2' },
            lastErrorObject: { updatedExisting: true }
        }),
        deleteOne: async filter => { deletedId = filter._id; }
    };
    const unliked = await _test.toggleLike(
        { userId: 'user-1', trackId: 'track-1' },
        { userId: 'user-1', trackId: 'track-1' },
        existingModel
    );
    assert.equal(unliked, 'unliked');
    assert.equal(deletedId, 'like-2');
});

test('search caches successful Spotify results without undefined helpers', async () => {
    const first = await request('/api/search?artist=Test%20Artist');
    assert.equal(first.response.status, 200);
    assert.equal(first.body[0].name, 'Test Artist');

    const second = await request('/api/search?artist=test%20artist');
    assert.equal(second.response.status, 200);
    assert.deepEqual(second.body, first.body);
    assert.equal(spotifySearchCalls, 1);
});

test('unauthenticated search requests are limited by IPv4/IPv6-safe IP keys', async () => {
    for (const clientIp of ['203.0.113.10', '2001:db8::1']) {
        let limitedResponse;
        for (let attempt = 0; attempt < 21; attempt += 1) {
            limitedResponse = await request('/api/search?artist=Rate%20Limited', {
                headers: { 'x-forwarded-for': clientIp }
            });
        }

        assert.equal(limitedResponse.response.status, 429, clientIp);
        assert.deepEqual(limitedResponse.body, {
            error: 'Too many search requests. Please slow down.'
        });
    }
});

test('production CORS rejection returns JSON 403 without a stack trace', async () => {
    const blocked = await postJson('/api/login', {
        username: 'runtime_test_user',
        password: 'password123'
    }, { origin: 'https://evil.example' });

    assert.equal(blocked.response.status, 403);
    assert.deepEqual(blocked.body, { error: 'Origin not allowed' });
    assert.doesNotMatch(JSON.stringify(blocked.body), /server\.js|\bat\s/u);
});

test('unknown API routes return a controlled JSON 404', async () => {
    const missing = await request('/api/does-not-exist');
    assert.equal(missing.response.status, 404);
    assert.deepEqual(missing.body, { error: 'API endpoint not found' });
    assert.match(missing.response.headers.get('content-type'), /application\/json/);
});

test('production startup refuses to run without MONGO_URI', () => {
    const script = "require('./server').connectDatabase().then(() => process.exit(0)).catch((error) => { console.error(error.message); process.exit(23); })";
    const result = spawnSync(process.execPath, ['-e', script], {
        cwd: require('node:path').resolve(__dirname, '..'),
        encoding: 'utf8',
        env: {
            ...process.env,
            NODE_ENV: 'production',
            SKIP_DOTENV_CONFIG: 'true',
            JWT_SECRET: 'test-only-jwt-secret',
            ADMIN_USERNAME: 'test-admin',
            ADMIN_PASSWORD: 'test-only-admin-password',
            MONGO_URI: ''
        }
    });

    assert.equal(result.status, 23);
    assert.match(result.stderr, /MONGO_URI is required in production/);
});

test('production database connection failure is fatal instead of falling back', () => {
    const script = "require('./server').connectDatabase().then(() => process.exit(0)).catch(() => process.exit(24))";
    const result = spawnSync(process.execPath, ['-e', script], {
        cwd: require('node:path').resolve(__dirname, '..'),
        encoding: 'utf8',
        timeout: 10000,
        env: {
            ...process.env,
            NODE_ENV: 'production',
            SKIP_DOTENV_CONFIG: 'true',
            JWT_SECRET: 'test-only-jwt-secret',
            ADMIN_USERNAME: 'test-admin',
            ADMIN_PASSWORD: 'test-only-admin-password',
            MONGO_URI: 'mongodb://127.0.0.1:1/music_archive_test'
        }
    });

    assert.equal(result.status, 24);
    assert.match(result.stderr, /MongoDB Connection Error/);
    assert.doesNotMatch(result.stdout, /In-Memory Database/);
});
