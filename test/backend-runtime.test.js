const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.SPOTIFY_CLIENT_ID = 'test-only-client-id';
process.env.SPOTIFY_CLIENT_SECRET = 'test-only-client-secret';
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

const adminBearerHeaders = (clientIp) => ({
    authorization: `Bearer ${jwt.sign({ isAdmin: true, typ: 'admin' }, process.env.JWT_SECRET, { expiresIn: '30m' })}`,
    ...(clientIp && { 'x-forwarded-for': clientIp })
});

const cookieValue = (response) => response.headers.get('set-cookie')?.split(';', 1)[0];

test('health reports 503 before database readiness and 200 for controlled in-memory mode', async () => {
    const unavailable = await request('/api/health');
    assert.equal(unavailable.response.status, 503);
    assert.deepEqual(unavailable.body, { status: 'not_ready', database: 'mongodb', spotify: 'configured' });

    await connectDatabase();

    const ready = await request('/api/health');
    assert.equal(ready.response.status, 200);
    assert.deepEqual(ready.body, { status: 'ready', database: 'in-memory', spotify: 'configured' });
});

test('static serving exposes only required frontend assets', async () => {
    const index = await request('/');
    assert.equal(index.response.status, 200);
    assert.match(index.response.headers.get('content-type'), /text\/html/);

    const frontendModule = await request('/js/app.js');
    assert.equal(frontendModule.response.status, 200);
    assert.match(frontendModule.response.headers.get('content-type'), /javascript/);

    for (const asset of ['/admin-assets/login.js', '/admin-assets/panel.js']) {
        const result = await request(asset);
        assert.equal(result.response.status, 200, asset);
        assert.match(result.response.headers.get('content-type'), /javascript/);
        assert.doesNotMatch(result.body, /ADMIN_(?:USERNAME|PASSWORD)|adminAuth|sessionStorage/);
    }

    for (const sourcePath of [
        '/server.js',
        '/package.json',
        '/panel-4772.html',
        '/CLAUDE_BACKEND_AUDIT.md',
        '/docs/reports/CODEX_BACKEND_RUNTIME_SECURITY_FIXES_2026-09-04.md',
        '/.env',
        '/.git/config',
        '/database.sqlite'
    ]) {
        const result = await request(sourcePath);
        assert.equal(result.response.status, 404, sourcePath);
    }
});

test('static frontend assets are not gated by the API CORS allowlist', async () => {
    // `<script type="module">` is always fetched in CORS mode, so the browser sends
    // an Origin header even same-origin. While CORS was mounted globally this made
    // /js/app.js return 403 whenever CORS_ORIGINS did not list the deployed origin,
    // and the whole web app failed to boot. Static assets must ignore the allowlist.
    const deployedOrigin = 'https://music-archive-v-2.onrender.com';
    assert.ok(
        !process.env.CORS_ORIGINS.split(',').includes(deployedOrigin),
        'test needs an origin that is absent from CORS_ORIGINS'
    );

    for (const assetPath of ['/', '/index.html', '/js/app.js', '/js/services/api.js']) {
        const asset = await request(assetPath, { headers: { origin: deployedOrigin } });
        assert.equal(asset.response.status, 200, assetPath);
    }

    // Source disclosure must stay closed even when an Origin header is present.
    for (const sourcePath of ['/server.js', '/package.json', '/.env', '/database.sqlite']) {
        const blocked = await request(sourcePath, { headers: { origin: deployedOrigin } });
        assert.equal(blocked.response.status, 404, sourcePath);
    }
});

test('modular API reads live auth state without a legacy token or global fetch override', async () => {
    const index = await request('/');
    // The stale `let token = localStorage.getItem(...)` snapshot must be gone: a
    // login performed after this script parsed used to leave legacy handlers
    // sending `Bearer null`.
    assert.doesNotMatch(index.body, /let\s+token\s*=\s*localStorage\.getItem/);
    assert.doesNotMatch(index.body, /<script(?:\s[^>]*)?>\s*[^<\s]/);
    assert.ok(index.body.split('\n').length < 200);
    const api = await request('/js/services/api.js');
    assert.match(api.body, /const token = store.token \|\| localStorage.getItem/);
    assert.match(api.body, /refreshRequest/);
    // The single refresh authority stays in js/services/api.js — no global override.
    assert.doesNotMatch(index.body, /window\.fetch\s*=/);

    const appModule = await request('/js/app.js');
    // Create-playlist is a module function now, not a window global: the modal is
    // wired by Shell.js through a handler callback.
    assert.match(appModule.body, /async function confirmCreatePlaylist\(\)/);
    assert.match(appModule.body, /createPlaylistRequest\(name\)/);
    assert.match(appModule.body, /onConfirmCreatePlaylist: confirmCreatePlaylist/);
});

test('frontend services only call endpoints the server exposes', async () => {
    // /likes, /follows and /ratings never existed; the library and rating services
    // asked for them anyway, so every read 404'd and the library looked empty.
    const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    const declaredRoutes = new Set(
        [...serverSource.matchAll(/^app\.(?:get|post|put|delete)\('(\/api\/[^']+)'/gm)].map(m => m[1])
    );

    for (const file of ['library.js', 'rating.js', 'auth.js', 'me.js']) {
        const source = await request(`/js/services/${file}`);
        assert.equal(source.response.status, 200, file);

        const calls = [...source.body.matchAll(/\b(?:get|post|put|del)\(\s*[`'"](\/[^`'"$]*)/g)]
            .map(m => m[1].replace(/\/$/, ''));

        for (const call of calls) {
            const full = `/api${call}`;
            const matched = [...declaredRoutes].some(route => {
                const pattern = new RegExp(`^${route.replace(/:[^/]+/g, '[^/]+')  }$`);
                return pattern.test(full);
            });
            assert.ok(matched, `${file} calls ${full}, which server.js does not declare`);
        }
    }
});

test('the phantom /likes, /follows and /ratings reads are gone', async () => {
    for (const file of ['library.js', 'rating.js']) {
        const source = await request(`/js/services/${file}`);
        assert.doesNotMatch(source.body, /get\('\/(likes|follows|ratings)'\)/, file);
    }
    // They are served by the one aggregate endpoint instead, de-duplicated so the
    // parallel loaders cost a single round trip.
    const me = await request('/js/services/me.js');
    assert.equal(me.response.status, 200);
    assert.match(me.body, /get\('\/me'\)/);
    assert.match(me.body, /inFlight/);
});

test('auth modal is a real form owned by the modular app', async () => {
    const index = await request('/');
    // A real form makes Enter submit and puts the password field inside a form.
    assert.match(index.body, /<form id="authForm"/);
    assert.match(index.body, /id="authSubmit"[^>]*|type="submit"/);
    assert.match(index.body, /id="authError"/);
    assert.match(index.body, /id="authSwitch"/);
    assert.match(index.body, /id="authClose"/);
    // No inline onclick may drive the modal any more.
    assert.doesNotMatch(index.body, /onclick="handleAuth\(\)"/);
    assert.doesNotMatch(index.body, /onclick="toggleAuthMode\(\)"/);
    assert.doesNotMatch(index.body, /onclick="closeAuthModal\(\)"/);

    const appModule = await request('/js/app.js');
    // Single submit listener, explicit mode state, local empty-field validation,
    // in-modal error rendering and a double-submit guard.
    assert.match(appModule.body, /getElementById\('authForm'\)\?\.addEventListener\('submit', submitAuth\)/);
    assert.match(appModule.body, /let authMode = 'login'/);
    assert.match(appModule.body, /authSubmitting/);
    assert.match(appModule.body, /setAuthError\(t\('auth\.missingFields'\)\)/);
    // Mode must never be inferred from the heading text again.
    assert.doesNotMatch(appModule.body, /authTitle'\)\.(innerText|textContent)\s*===/);

    const authService = await request('/js/services/auth.js');
    assert.match(authService.body, /return \{ ok: false, error: error\.message \}/);
});

test('API keeps its CORS allowlist and answers preflight for allowed origins', async () => {
    const allowed = await request('/api/health', { headers: { origin: 'https://allowed.example' } });
    assert.equal(allowed.response.status, 200);
    assert.equal(allowed.response.headers.get('access-control-allow-origin'), 'https://allowed.example');

    const preflight = await request('/api/login', {
        method: 'OPTIONS',
        headers: {
            origin: 'https://allowed.example',
            'access-control-request-method': 'POST',
            'access-control-request-headers': 'content-type'
        }
    });
    assert.ok(preflight.response.status === 200 || preflight.response.status === 204);
    assert.equal(preflight.response.headers.get('access-control-allow-origin'), 'https://allowed.example');

    const rejected = await request('/api/health', { headers: { origin: 'https://evil.example' } });
    assert.equal(rejected.response.status, 403);
    assert.deepEqual(rejected.body, { error: 'Origin not allowed' });
});

test('web and mobile clients retain refresh and server logout support', async () => {
    const index = await request('/');
    assert.match(index.body, /<script type="module" src="js\/app\.js"><\/script>/);
    assert.doesNotMatch(index.body, /addEventListener\('DOMContentLoaded', \(\) => \{\s*updateAuthUI/);

    const webAuth = await request('/js/services/auth.js');
    assert.match(webAuth.body, /REFRESH_TOKEN/);
    assert.match(webAuth.body, /post\('\/logout'/);

    const webApi = await request('/js/services/api.js');
    assert.match(webApi.body, /refreshRequest/);
    assert.match(webApi.body, /_retried/);
    assert.match(webApi.body, /auth:session-expired/);

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
    const userPaths = _test.models.User.schema.paths;
    assert.ok(userPaths.refreshTokenExpiresAt);

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

    const invalidStep = new _test.models.Rating({
        userId: '507f1f77bcf86cd799439011',
        itemId: 'track-invalid-step',
        itemType: 'track',
        rating: 0.6
    });
    assert.match(invalidStep.validateSync().errors.rating.message, /0\.5 increments/);
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
    assert.ok(storedUser.refreshTokenExpiresAt > new Date());
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

test('expired refresh tokens are rejected and cleared without disclosure', async () => {
    const register = await postJson('/api/register', {
        username: 'expired_refresh_user',
        password: 'password123'
    }, { 'x-forwarded-for': '203.0.113.48' });
    assert.equal(register.response.status, 200);

    const storedUser = _test.inMemoryDB.users.find(user => user.username === 'expired_refresh_user');
    storedUser.refreshTokenExpiresAt = new Date(Date.now() - 1000);

    const capturedLogs = [];
    const originalError = console.error;
    console.error = (...args) => capturedLogs.push(args.join(' '));
    try {
        const expired = await postJson('/api/auth/refresh', {
            refreshToken: register.body.refreshToken
        }, { 'x-forwarded-for': '203.0.113.48' });
        assert.equal(expired.response.status, 401);
        assert.deepEqual(expired.body, { error: 'Invalid refresh token' });
        assert.doesNotMatch(JSON.stringify(expired.body), new RegExp(register.body.refreshToken));
    } finally {
        console.error = originalError;
    }

    assert.equal(storedUser.refreshToken, null);
    assert.equal(storedUser.refreshTokenExpiresAt, null);
    assert.equal(capturedLogs.some(line => line.includes(register.body.refreshToken)), false);
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

test('rating endpoint accepts half-stars and rejects invalid types and steps', async () => {
    const register = await postJson('/api/register', {
        username: 'rating_validation_user',
        password: 'password123'
    }, { 'x-forwarded-for': '203.0.113.49' });
    assert.equal(register.response.status, 200);

    const valid = await postJson('/api/rate', {
        itemId: 'half-star-track', itemType: 'track', rating: 0.5
    }, bearerHeaders(register.body.token, '203.0.113.49'));
    assert.equal(valid.response.status, 200);
    assert.equal(valid.body.rating, 0.5);

    const invalidStep = await postJson('/api/rate', {
        itemId: 'invalid-step-track', itemType: 'track', rating: 0.6
    }, bearerHeaders(register.body.token, '203.0.113.49'));
    assert.equal(invalidStep.response.status, 400);

    const invalidType = await postJson('/api/rate', {
        itemId: 'string-rating-track', itemType: 'track', rating: '0.5'
    }, bearerHeaders(register.body.token, '203.0.113.49'));
    assert.equal(invalidType.response.status, 400);

    const injectedId = await postJson('/api/rate', {
        itemId: { $ne: null }, itemType: 'track', rating: 0.5
    }, bearerHeaders(register.body.token, '203.0.113.49'));
    assert.equal(injectedId.response.status, 400);
});

test('library notes persist and return their update timestamp', async () => {
    const register = await postJson('/api/register', {
        username: 'note_persistence_user',
        password: 'password123'
    }, { 'x-forwarded-for': '203.0.113.50' });
    assert.equal(register.response.status, 200);
    const headers = bearerHeaders(register.body.token, '203.0.113.50');

    const injectedLike = await postJson('/api/library/like', {
        spotifyId: { $ne: null }, title: 'Invalid Track'
    }, headers);
    assert.equal(injectedLike.response.status, 400);

    const liked = await postJson('/api/library/like', {
        spotifyId: 'note-track', title: 'Note Track', artist: 'Test Artist'
    }, headers);
    assert.equal(liked.response.status, 200);

    const note = await postJson('/api/library/note', {
        spotifyId: 'note-track', note: 'A lasting memory'
    }, headers);
    assert.equal(note.response.status, 200);
    assert.equal(note.body.note, 'A lasting memory');
    assert.equal(typeof note.body.noteUpdatedAt, 'string');

    const tracks = await request('/api/library/tracks', { headers });
    assert.equal(tracks.response.status, 200);
    const saved = tracks.body.tracks.find(track => track.trackId === 'note-track');
    assert.equal(saved.userNote, 'A lasting memory');
    assert.equal(new Date(saved.noteUpdatedAt).toISOString(), note.body.noteUpdatedAt);

    const invalid = await postJson('/api/library/note', {
        spotifyId: 'note-track', note: { $ne: null }
    }, headers);
    assert.equal(invalid.response.status, 400);

    const injectedId = await postJson('/api/library/note', {
        spotifyId: { $ne: null }, note: 'Invalid identifier'
    }, headers);
    assert.equal(injectedId.response.status, 400);
});

test('admin deletion cascades all user-owned records', async () => {
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

    const playlistId = 'cascade-playlist';
    _test.inMemoryDB.likes.push({ _id: 'cascade-like', userId: decoded.id, trackId: 'cascade-like-track' });
    _test.inMemoryDB.follows.push({ _id: 'cascade-follow', userId: decoded.id, artistId: 'cascade-artist' });
    _test.inMemoryDB.albumFollows.push({ _id: 'cascade-album', userId: decoded.id, albumId: 'cascade-album' });
    _test.inMemoryDB.playlists.push({ _id: playlistId, userId: decoded.id, name: 'Cascade' });
    _test.inMemoryDB.playlistTracks.push({ _id: 'cascade-playlist-track', playlistId, trackId: 'cascade-track' });

    const deleted = await request(`/api/admin/users/${decoded.id}`, {
        method: 'DELETE',
        headers: adminBearerHeaders('203.0.113.43')
    });
    assert.equal(deleted.response.status, 200);
    assert.equal(_test.inMemoryDB.ratings.some(item => item.userId === decoded.id), false);
    assert.equal(_test.inMemoryDB.loginHistory.some(item => item.userId === decoded.id), false);
    assert.equal(_test.inMemoryDB.likes.some(item => item.userId === decoded.id), false);
    assert.equal(_test.inMemoryDB.follows.some(item => item.userId === decoded.id), false);
    assert.equal(_test.inMemoryDB.albumFollows.some(item => item.userId === decoded.id), false);
    assert.equal(_test.inMemoryDB.playlists.some(item => item.userId === decoded.id), false);
    assert.equal(_test.inMemoryDB.playlistTracks.some(item => item.playlistId === playlistId), false);
});

test('admin login issues a constrained HttpOnly session and logout revokes the browser cookie', async () => {
    const malformed = await postJson('/api/admin/login', {
        username: { $ne: null }, password: ['not', 'a', 'string']
    }, { 'x-forwarded-for': '203.0.113.44' });
    assert.equal(malformed.response.status, 400);
    assert.equal(malformed.response.headers.get('set-cookie'), null);

    const rejected = await postJson('/api/admin/login', {
        username: 'test-admin', password: 'wrong-password'
    }, { 'x-forwarded-for': '203.0.113.45' });
    assert.equal(rejected.response.status, 403);
    assert.equal(rejected.response.headers.get('set-cookie'), null);

    const login = await postJson('/api/admin/login', {
        username: 'test-admin', password: 'test-only-admin-password'
    }, { 'x-forwarded-for': '203.0.113.46' });
    assert.equal(login.response.status, 200);
    assert.deepEqual(login.body, { status: 'authenticated' });

    const setCookie = login.response.headers.get('set-cookie');
    assert.match(setCookie, /^ma_admin=/);
    assert.match(setCookie, /; HttpOnly/);
    assert.match(setCookie, /; SameSite=Strict/);
    assert.match(setCookie, /; Path=\//);
    assert.match(setCookie, /; Max-Age=1800/);
    assert.doesNotMatch(setCookie, /; Secure/);
    assert.match(_test.serializeAdminCookie('token', 1800, true), /; Secure$/);

    const token = decodeURIComponent(cookieValue(login.response).slice('ma_admin='.length));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    assert.equal(decoded.isAdmin, true);
    assert.equal(decoded.typ, 'admin');
    assert.equal(decoded.exp - decoded.iat, 30 * 60);

    const valid = await request('/api/admin/stats', {
        headers: { cookie: cookieValue(login.response) }
    });
    assert.equal(valid.response.status, 200);

    const logout = await request('/api/admin/logout', {
        method: 'POST', headers: { cookie: cookieValue(login.response) }
    });
    assert.equal(logout.response.status, 200);
    assert.match(logout.response.headers.get('set-cookie'), /^ma_admin=;/);
    assert.match(logout.response.headers.get('set-cookie'), /Max-Age=0/);
});

test('admin page redirects anonymous browsers and serves the panel only with a valid session', async () => {
    for (const route of ['/admin', '/admin.html']) {
        const anonymous = await request(route, { redirect: 'manual' });
        assert.equal(anonymous.response.status, 302);
        assert.equal(anonymous.response.headers.get('location'), '/admin/login');
    }

    const loginPage = await request('/admin/login', { redirect: 'manual' });
    assert.equal(loginPage.response.status, 200);
    assert.match(loginPage.response.headers.get('content-type'), /text\/html/);
    assert.match(loginPage.body, /adminLoginForm/);
    assert.doesNotMatch(loginPage.body, /Kullanıcı Detayları|api\/admin\/users/);

    const login = await postJson('/api/admin/login', {
        username: 'test-admin', password: 'test-only-admin-password'
    }, { 'x-forwarded-for': '203.0.113.49' });
    const cookie = cookieValue(login.response);

    const panel = await request('/admin', {
        redirect: 'manual', headers: { cookie }
    });
    assert.equal(panel.response.status, 200);
    assert.match(panel.body, /Music Library Yönetim Sistemi/);

    const loggedInLoginPage = await request('/admin/login', {
        redirect: 'manual', headers: { cookie }
    });
    assert.equal(loggedInLoginPage.response.status, 302);
    assert.equal(loggedInLoginPage.response.headers.get('location'), '/admin');
});

test('admin authentication rejects Basic, ordinary, mistyped and expired tokens and limits login attempts', async () => {
    const basic = Buffer.from('test-admin:test-only-admin-password').toString('base64');
    assert.equal((await request('/api/admin/stats', {
        headers: { authorization: `Basic ${basic}` }
    })).response.status, 403);

    for (const token of [
        jwt.sign({ id: 'ordinary-user' }, process.env.JWT_SECRET, { expiresIn: '30m' }),
        jwt.sign({ isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '30m' }),
        jwt.sign({ isAdmin: true, typ: 'admin' }, process.env.JWT_SECRET, { expiresIn: -1 })
    ]) {
        assert.equal((await request('/api/admin/stats', {
            headers: { cookie: `ma_admin=${encodeURIComponent(token)}` }
        })).response.status, 403);
    }

    assert.equal((await request('/api/admin/stats', {
        headers: adminBearerHeaders('203.0.113.47')
    })).response.status, 200);

    let limited;
    for (let attempt = 0; attempt < 11; attempt += 1) {
        limited = await postJson('/api/admin/login', {
            username: 'test-admin', password: 'wrong-password'
        }, { 'x-forwarded-for': '203.0.113.48' });
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

test('parallel idempotent like upserts produce one logical record', async () => {
    const records = new Map();
    const atomicModel = {
        findOneAndUpdate: async (filter, update) => {
            await Promise.resolve();
            const key = `${filter.userId}:${filter.trackId}`;
            const updatedExisting = records.has(key);
            if (!updatedExisting) records.set(key, { _id: 'only-like', ...update.$setOnInsert });
            return { value: records.get(key), lastErrorObject: { updatedExisting } };
        }
    };

    const results = await Promise.all(Array.from({ length: 20 }, () => _test.upsertLike(
        { userId: 'parallel-user', trackId: 'parallel-track' },
        { userId: 'parallel-user', trackId: 'parallel-track', trackName: 'Parallel Track' },
        atomicModel
    )));

    assert.equal(records.size, 1);
    assert.equal(results.filter(result => !result.lastErrorObject.updatedExisting).length, 1);
    assert.equal(results.filter(result => result.lastErrorObject.updatedExisting).length, 19);
});

test('like upsert handles a duplicate-key race as an existing record', async () => {
    const existingLike = { _id: 'race-winner', userId: 'race-user', trackId: 'race-track' };
    const racingModel = {
        findOneAndUpdate: async () => {
            const error = new Error('duplicate key');
            error.code = 11000;
            throw error;
        },
        findOne: async filter => {
            assert.deepEqual(filter, { userId: 'race-user', trackId: 'race-track' });
            return existingLike;
        }
    };

    const result = await _test.upsertLike(
        { userId: 'race-user', trackId: 'race-track' },
        existingLike,
        racingModel
    );
    assert.equal(result.value, existingLike);
    assert.equal(result.lastErrorObject.updatedExisting, true);
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

test('CSP is enforced and needs no unsafe-inline for scripts', async () => {
    const page = await request('/');
    const csp = page.response.headers.get('content-security-policy');
    assert.ok(csp, 'no Content-Security-Policy header');

    const directives = Object.fromEntries(
        csp.split(';').map(part => part.trim()).filter(Boolean).map(part => {
            const [name, ...values] = part.split(/\s+/);
            return [name, values];
        })
    );

    // The whole point of removing the inline handlers: script-src must not need
    // 'unsafe-inline', which would make the policy decorative.
    assert.ok(!directives['script-src'].includes("'unsafe-inline'"));
    assert.ok(!directives['script-src'].includes("'unsafe-eval'"));
    assert.deepEqual(directives['default-src'], ["'self'"]);
    assert.deepEqual(directives['object-src'], ["'none'"]);
    assert.deepEqual(directives['frame-ancestors'], ["'none'"]);
    assert.deepEqual(directives['base-uri'], ["'self'"]);
    assert.deepEqual(directives['form-action'], ["'self'"]);
    assert.deepEqual(directives['connect-src'], ["'self'"]);
});

test('no shipped markup carries inline event handlers', async () => {
    // An inline on* attribute anywhere would force script-src 'unsafe-inline'
    // back into the policy above, so this guards the CSP as much as the markup.
    const sources = ['/', '/js/components/Shell.js', '/js/components/Navbar.js',
        '/js/views/DashboardView.js', '/js/views/SearchView.js', '/js/components/Dashboard.js'];

    for (const source of sources) {
        const { body } = await request(source);
        assert.doesNotMatch(
            body,
            /\son(?:click|change|input|submit|load|error|keypress|keydown|mouseover)\s*=\s*["']/i,
            `${source} still contains an inline event attribute`
        );
    }

    for (const file of ['panel-4772.html', 'admin/login.html']) {
        const markup = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
        assert.doesNotMatch(markup, /\son(?:click|change|input|submit|load|error|keypress|keydown|mouseover)\s*=\s*["']/i, file);
        assert.doesNotMatch(markup, /<script(?![^>]*\bsrc=)[^>]*>/i, `${file} still contains an inline script`);
    }
});

test('NODE_ENV that is neither development nor test is treated as production', async () => {
    // NODE_ENV is unset on most hosts. Before this, an unset value disabled the
    // production guards and a missing MONGO_URI silently fell back to the
    // volatile in-memory database.
    const script = "require('./server').connectDatabase().then(() => process.exit(0)).catch(() => process.exit(24))";
    const env = {
        ...process.env,
        SKIP_DOTENV_CONFIG: 'true',
        JWT_SECRET: 'test-only-jwt-secret',
        ADMIN_USERNAME: 'test-admin',
        ADMIN_PASSWORD: 'test-only-admin-password'
    };
    delete env.MONGO_URI;
    delete env.NODE_ENV;

    const result = spawnSync(process.execPath, ['-e', script], {
        cwd: require('node:path').resolve(__dirname, '..'),
        encoding: 'utf8',
        timeout: 10000,
        env
    });

    assert.equal(result.status, 24, 'unset NODE_ENV must fail fast without MONGO_URI');
    assert.doesNotMatch(result.stdout, /In-Memory Database/);
});
