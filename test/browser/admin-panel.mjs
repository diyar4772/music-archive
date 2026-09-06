import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { browser } from './cdp.mjs';

dotenv.config();

const base = process.env.ADMIN_TEST_URL || 'http://127.0.0.1:3112';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'only a local test server is supported');
assert.ok(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && process.env.JWT_SECRET, 'admin test secrets are required');

const output = fileURLToPath(new URL('../../docs/reports/admin-panel-auth/', import.meta.url));
await mkdir(output, { recursive: true });
const c = await browser();
const checks = [];
const check = (condition, message) => {
    assert.ok(condition, message);
    checks.push(message);
    console.log(`PASS ${checks.length}: ${message}`);
};
const json = (value) => JSON.stringify(value);
const screenshot = (name) => c.screenshot(`${output}${name}.png`);
const click = (action, suffix = '') => c.run(`(() => {
    const control = document.querySelector('[data-action=${json(action)}]${suffix}');
    if (!control) return false;
    control.click();
    return true;
})()`);
const trustedClick = async (action) => {
    const point = await c.run(`(() => {
        const control = document.querySelector('[data-action=${json(action)}]');
        control.scrollIntoView({ block: 'center' });
        const rectangle = control.getBoundingClientRect();
        return { x: rectangle.left + rectangle.width / 2, y: rectangle.top + rectangle.height / 2 };
    })()`);
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
};
const navigate = async (path) => {
    await c.send('Page.navigate', { url: `${base}${path}` });
};
const adminCookie = async () => (await c.send('Network.getAllCookies')).cookies.find((cookie) => cookie.name === 'ma_admin');

try {
    await c.send('Network.enable');
    await c.send('Network.clearBrowserCookies');
    await navigate('/admin');
    await c.until(`location.pathname === '/admin/login' && Boolean(document.getElementById('adminLoginForm'))`);
    check(await c.run(`location.pathname === '/admin/login'`), 'anonymous /admin navigation redirects to the login page');
    await screenshot('01-login');

    const disposableUsername = `admin_panel_${Date.now()}`;
    const seeded = await c.run(`(async () => {
        const response = await fetch('/api/register', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ username: ${json(disposableUsername)}, password: 'BrowserTest!9847' })
        });
        return response.ok;
    })()`);
    check(seeded, 'a disposable in-memory user is available for panel controls');

    await c.run(`(() => {
        const form = document.getElementById('adminLoginForm');
        form.elements.username.value = 'wrong-admin';
        form.elements.password.value = 'definitely-wrong';
        form.requestSubmit();
    })()`);
    await c.until(`!document.getElementById('loginError').classList.contains('hidden')`);
    check(!(await adminCookie()), 'wrong password shows an error without writing a cookie');
    await screenshot('02-wrong-password');

    await c.run(`(() => {
        const form = document.getElementById('adminLoginForm');
        form.elements.username.value = ${json(process.env.ADMIN_USERNAME)};
        form.elements.password.value = ${json(process.env.ADMIN_PASSWORD)};
        form.requestSubmit();
    })()`);
    await c.until(`location.pathname === '/admin' && Boolean(document.querySelector('[data-action="refresh"]'))`);
    await c.until(`Boolean(document.querySelector('[data-action="view-user"]'))`);
    await c.run(`window.__adminAlerts = []; window.alert = message => window.__adminAlerts.push(String(message))`);
    check(true, 'correct credentials open the protected panel');

    const cookie = await adminCookie();
    check(cookie?.httpOnly === true, 'ma_admin is HttpOnly');
    check(cookie?.sameSite === 'Strict', 'ma_admin is SameSite=Strict');
    check(cookie?.path === '/', 'ma_admin is scoped to the site root');
    check(cookie.expires * 1000 - Date.now() <= 30 * 60 * 1000, 'ma_admin expires within 30 minutes');
    check(!(await c.run(`document.cookie.includes('ma_admin=')`)), 'document.cookie cannot read ma_admin');
    check(await c.run(`sessionStorage.length === 0`), 'the panel stores no admin credential in sessionStorage');
    await screenshot('03-panel-session');

    check(await click('refresh'), 'refresh control is clickable');
    for (const field of ['username', 'createdAt', 'lastLogin', 'loginCount', 'likesCount', 'followsCount', 'playlistsCount']) {
        check(await click('sort-users', `[data-field=${json(field)}]`), `sort control works for ${field}`);
        await c.until(`document.querySelector('.sort-icon[data-field=${json(field)}]').classList.contains('text-green-400')`);
    }

    await c.run(`(() => {
        const input = document.querySelector('[data-action="search-users"]');
        input.value = ${json(disposableUsername)};
        input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await c.until(`document.querySelectorAll('[data-action="view-user"]').length === 1`);
    check(true, 'user search filters the table');

    check(await click('view-user'), 'user row opens its detail panel');
    await c.until(`!document.getElementById('userDetailModal').classList.contains('hidden')`);
    await screenshot('04-user-detail');
    check(await click('close-user-detail'), 'user detail close control works');
    await c.until(`document.getElementById('userDetailModal').classList.contains('hidden')`);

    check(await click('switch-tab', '[data-tab="test"]'), 'test tab opens');
    await c.until(`!document.getElementById('contentTest').classList.contains('hidden')`);
    check(await click('test-api'), 'API test control runs');
    await c.until(`document.getElementById('apiTestResult').textContent.length > 20`);
    check(await click('test-spotify'), 'Spotify test control runs');
    check(await click('test-search'), 'search test control runs');
    await c.until(`document.getElementById('searchTestResult').textContent.length > 10`);
    check(await click('run-tests'), 'combined test control runs');
    await c.until(`document.getElementById('allTestsResult').textContent.includes('Sonuç:')`);

    await c.run(`(() => {
        const open = window.open.bind(window);
        window.__adminOpenHomeCalls = 0;
        window.open = (...args) => {
            window.__adminOpenHomeCalls += 1;
            return open(...args);
        };
    })()`);
    await trustedClick('open-home');
    check(true, 'open-home control accepts a real browser click');
    check(await c.run(`window.__adminOpenHomeCalls === 1`), 'open-home invokes one new-tab navigation');

    check(await click('switch-tab', '[data-tab="preview"]'), 'preview tab opens');
    await c.until(`!document.getElementById('contentPreview').classList.contains('hidden')`);
    check(await click('search-preview'), 'preview search control runs');
    await c.until(`document.getElementById('previewSearchResult').textContent !== 'Aranıyor...'`);
    const hasPreview = await c.run(`Boolean(document.querySelector('[data-action="play-preview"]'))`);
    if (hasPreview) {
        check(await click('play-preview'), 'a real Spotify preview opens the mini player');
        await c.until(`document.getElementById('adminMiniPlayer').classList.contains('active')`);
        const iconBeforeToggle = await c.run(`document.getElementById('playerIcon').className`);
        check(await click('toggle-player'), 'mini-player toggle control is clickable');
        const iconAfterToggle = await c.run(`document.getElementById('playerIcon').className`);
        check(iconAfterToggle !== iconBeforeToggle, 'mini-player toggle changes playback state');
        check(await click('close-player'), 'mini-player close control works');
        await c.until(`!document.getElementById('adminMiniPlayer').classList.contains('active')`);
    } else {
        console.log('SKIP: Spotify returned no playable preview; mini-player controls were not claimed as verified.');
    }
    await screenshot('05-panel-controls');

    check(await click('switch-tab', '[data-tab="users"]'), 'users tab reopens');
    await c.until(`!document.getElementById('contentUsers').classList.contains('hidden')`);
    await c.run(`setTimeout(() => document.querySelector('[data-action="delete-user"]').click(), 0); true`);
    await new Promise((resolve) => setTimeout(resolve, 150));
    await c.send('Page.handleJavaScriptDialog', { accept: false });
    check(await c.run(`Boolean(document.querySelector('[data-action="delete-user"]'))`), 'cancelling deletion keeps the user');

    await c.run(`setTimeout(() => document.querySelector('[data-action="delete-user"]').click(), 0); true`);
    await new Promise((resolve) => setTimeout(resolve, 150));
    await c.send('Page.handleJavaScriptDialog', { accept: true });
    await c.until(`!document.querySelector('[data-action="delete-user"]')`);
    check(true, 'confirming deletion removes the disposable user');

    const cspLogs = c.logs.filter((entry) => /Content Security Policy|Refused to execute inline|Refused to apply inline/i.test(entry.text || ''));
    check(cspLogs.length === 0, 'browser log contains no CSP violation');
    check(c.errors.length === 0, 'browser recorded no uncaught exception');

    check(await click('logout'), 'logout control is clickable');
    await c.until(`location.pathname === '/admin/login'`);
    check(!(await adminCookie()), 'logout clears ma_admin and returns to login');

    const expiredToken = jwt.sign({ isAdmin: true, typ: 'admin' }, process.env.JWT_SECRET, { expiresIn: -1 });
    await c.send('Network.setCookie', {
        name: 'ma_admin', value: expiredToken, url: base, path: '/', httpOnly: true, sameSite: 'Strict'
    });
    await navigate('/admin');
    await c.until(`location.pathname === '/admin/login'`);
    check(true, 'an expired admin token cannot open the panel');

    console.log(`ADMIN BROWSER PASS: ${checks.length} checks, ${hasPreview ? 'preview controls verified' : 'preview controls skipped'}`);
} finally {
    c.close();
}
