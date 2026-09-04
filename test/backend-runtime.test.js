const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

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

const { app, connectDatabase } = require('../server');

let server;
let baseUrl;

test.before(async () => {
    await connectDatabase();
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

test('search caches successful Spotify results without undefined helpers', async () => {
    const first = await request('/api/search?artist=Test%20Artist');
    assert.equal(first.response.status, 200);
    assert.equal(first.body[0].name, 'Test Artist');

    const second = await request('/api/search?artist=test%20artist');
    assert.equal(second.response.status, 200);
    assert.deepEqual(second.body, first.body);
    assert.equal(spotifySearchCalls, 1);
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
