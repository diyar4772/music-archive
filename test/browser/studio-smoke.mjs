// Requires an isolated local MongoDB, the app and a fresh headless Chrome.
// No mocked music/catalog data; piano input is explicitly the UI simulation.
//
// Selectors address controls by `data-testid`, never by their visible label:
// the labels are translated, and a text-based selector silently matches
// nothing after a language change instead of failing where the control is.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { browser } from './cdp.mjs';

const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3109';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Use an isolated local test server.');

const dictionary = language => JSON.parse(readFileSync(new URL(`../../js/locales/${language}.json`, import.meta.url), 'utf8'));
const locales = { tr: dictionary('tr'), en: dictionary('en') };
/** The message a key resolves to, read from the shipped locale file. */
const say = (language, key) => {
    const value = key.split('.').reduce((node, part) => node?.[part], locales[language]);
    assert.equal(typeof value, 'string', `missing translation key: ${language}.${key}`);
    return value;
};
const tr = key => say('tr', key);
const en = key => say('en', key);

const c = await browser();
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); console.log(`PASS ${++checks}: ${message}`); };

const selector = (id, scope = '') => `${scope}[data-testid=${JSON.stringify(id)}]`;
const node = (id, scope = '') => `document.querySelector(${JSON.stringify(selector(id, scope))})`;
/** Click a control by identity. A missing control fails here, not as a timeout later. */
const click = async (id, scope = '') => {
    const found = await c.run(`(() => { const control = ${node(id, scope)}; if (!control) return false; control.click(); return true; })()`);
    assert.ok(found, `control not on the page: ${selector(id, scope)}`);
};
const route = async id => {
    await c.run(`window.router.navigate(${JSON.stringify(id)})`);
    await c.until(`window.router.currentRoute === ${JSON.stringify(id)} && window.router.currentView.isMounted`);
};
const credentials = { username: `studio_${Date.now()}`, password: 'LocalMusicTest!9847' };
const authenticate = async register => {
    await c.run(`window.openAuthModal(${JSON.stringify(register ? 'register' : 'login')});
        ${node('auth-username')}.value = ${JSON.stringify(credentials.username)};
        ${node('auth-password')}.value = ${JSON.stringify(credentials.password)};
        ${node('auth-form')}.requestSubmit();`);
    await c.until('Boolean(localStorage.getItem("userToken")) && window.router.currentRoute === "dashboard"');
};
const capture = async name => {
    await route('studio');
    await c.run(`const source = ${node('studio-source')}; source.value = 'simulation'; source.dispatchEvent(new Event('change'));
        ${node('studio-field-title')}.value = ${JSON.stringify(name)};`);
    await click('studio-start');
    await c.until('window.router.currentView.engine.recording');
    await c.run(`${node('studio-keyboard')}.focus();
        for (const key of ['a','d','g']) ${node('studio-keyboard')}.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));`);
    check(await c.run('window.router.currentView.engine.notes.size === 3'), 'UI keyboard captures a three-note chord');
    await new Promise(r => setTimeout(r, 1250));
    await c.run(`for (const key of ['a','d','g']) ${node('studio-keyboard')}.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));`);
    await click('studio-stop');
    await c.until(`Boolean(${node('studio-upload')})`);
};

try {
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false });
    await c.send('Page.navigate', { url: base });
    await c.until('Boolean(window.router)');
    await c.run('localStorage.clear()');
    await c.reload();
    await c.until('Boolean(window.router) && !localStorage.getItem("userToken")');
    check(await c.run('document.querySelectorAll("script[type=module][src*=app]").length === 1'), 'one application entry point');
    await authenticate(true);
    check(true, 'registration through the actual auth form');

    // K1.5: identity survives the language, the label does not.
    await route('studio');
    await click('nav-lang-en');
    await c.until(`${node('studio-start')}?.textContent === ${JSON.stringify(en('studio.start'))}`);
    check(await c.run(`Boolean(${node('studio-start')}) && Boolean(${node('studio-stop')}) && Boolean(${node('studio-connect')})`),
        'studio controls keep their test identity after switching to English');
    await click('nav-lang-tr');
    await c.until(`${node('studio-start')}?.textContent === ${JSON.stringify(tr('studio.start'))}`);

    await capture('Tarayıcı testi <b>nota</b>');
    check(await c.run(`${node('studio-result')}.innerText.includes(${JSON.stringify(tr('studio.draftLocal'))})`), 'local draft is not presented as a server save');
    await click('studio-upload');
    await c.until(`${node('studio-result')}?.innerText.includes(${JSON.stringify(tr('studio.uploaded'))})`);
    check(true, 'MIDI recording saved in local MongoDB');
    await route('recordings');
    await c.until('Boolean(document.querySelector("[data-storage=stored]"))');
    check(await c.run(`!document.querySelector('${selector('recording-row')} h2 b') && document.querySelector('${selector('recording-row')} h2').textContent.includes("<b>")`), 'recording title is rendered as text, not HTML');
    const savedId = await c.run(`${node('recording-row')}.dataset.recordingId`);
    await click('recording-play');
    await c.until(`Boolean(${node('player')})`);
    check(await c.run('window.router.currentView.player.synth.context.state === "running"'), 'MIDI replay starts a real Web Audio context');
    await c.reload();
    await c.until('Boolean(document.querySelector("[data-storage=stored]"))');
    check(await c.run(`Boolean(document.querySelector('[data-recording-id="${savedId}"]'))`), 'recording and session survive a page reload');
    await c.run(`await (await import('/js/services/auth.js')).logout(); window.router.navigate('dashboard');`);
    await authenticate(false);
    await route('recordings');
    await c.until('Boolean(document.querySelector("[data-storage=stored]"))');
    check(await c.run(`Boolean(document.querySelector('[data-recording-id="${savedId}"]'))`), 'recording survives logout and login');

    await capture('Çevrimdışı kurtarma');
    await c.send('Network.enable');
    await c.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await click('studio-upload');
    // The retry offer is the error state plus a re-enabled upload control; both
    // are structural, so neither depends on the wording of the message.
    await c.until(`Boolean(document.querySelector('${selector('studio-result')} [data-state=error]')) && ${node('studio-upload')}?.disabled === false`);
    check(await c.run(`${node('studio-upload')}.textContent === ${JSON.stringify(tr('recordings.reupload'))}`), 'a failed upload offers a retry, not a false success');
    check(await c.run(`(await (await import('/js/studio/recording-store.js')).listDrafts()).some(r => r.title === 'Çevrimdışı kurtarma' && r.state === 'failed')`), 'failed upload remains in IndexedDB');
    await c.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await c.reload();
    await c.until('Boolean(window.router)');
    await route('recordings');
    await c.until('Boolean(document.querySelector("[data-storage=local]"))');
    check(true, 'local recovery is offered after reload');
    await click('recording-reupload', '[data-storage=local] ');
    await c.until('document.querySelectorAll("[data-storage=stored]").length === 2');
    check(await c.run('!document.querySelector("[data-storage=local]")'), 'retry stores the draft once and clears the local copy');

    await route('pieces');
    await c.run(`${node('piece-field-title')}.value = 'Etüt'; ${node('piece-field-composer')}.value = 'Kişisel';
        ${node('piece-field-notes')}.value = 'Sol el çalışması'; ${node('piece-form')}.requestSubmit();`);
    await c.until(`Boolean(${node('piece-row')})`);
    await click('piece-practice');
    await c.until(`window.router.currentRoute === "studio" && Boolean(${node('studio-field-piece')}?.value)`);
    check(true, 'saved piece opens the studio with its relationship selected');
    // A request that resolves after leaving the view must not attach a device.
    await c.run(`window.__oldMidi = navigator.requestMIDIAccess; navigator.requestMIDIAccess = async () => { throw new DOMException('denied', 'NotAllowedError'); };`);
    await click('studio-connect');
    await c.until('Boolean(document.querySelector("[data-state=denied]"))');
    check(await c.run(`document.querySelector("[data-state=denied]").innerText.includes(${JSON.stringify(tr('states.midiDeniedTitle'))})`), 'denied MIDI permission has an actionable screen');
    await c.run('navigator.requestMIDIAccess = window.__oldMidi');
    for (const [width, height] of [[1440, 1200], [768, 1024], [375, 812]]) {
        await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 });
        check(await c.run('document.documentElement.scrollWidth <= innerWidth'), `studio has no page overflow at ${width}px`);
        await c.screenshot(`/tmp/music-archive-studio-${width}.png`);
    }
    await c.run(`window.__oldView = window.router.currentView; true;`);
    await route('recordings');
    check(await c.run('window.__oldView.engine.disposed && window.__oldView.engine.port === null && window.__oldView.synth.context === null'), 'leaving the studio releases MIDI and audio resources');
    check(c.errors.length === 0, `no uncaught browser exceptions (${c.errors.join(', ')})`);
    console.log(JSON.stringify({ checks, user: credentials.username, savedId, hardware: 'not tested' }));
} finally {
    await c.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }).catch(() => {});
    c.close();
}
