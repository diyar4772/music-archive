// Requires an isolated local MongoDB, the app and a fresh headless Chrome.
// No mocked music/catalog data; piano input is explicitly the UI simulation.
import assert from 'node:assert/strict';
import { browser } from './cdp.mjs';

const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3109';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Use an isolated local test server.');
const c = await browser();
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); console.log(`PASS ${++checks}: ${message}`); };
const click = text => c.run(`[...document.querySelectorAll('button')].find(b => b.textContent === ${JSON.stringify(text)})?.click()`);
const route = async id => {
    await c.run(`window.router.navigate(${JSON.stringify(id)})`);
    await c.until(`window.router.currentRoute === ${JSON.stringify(id)} && window.router.currentView.isMounted`);
};
const credentials = { username: `studio_${Date.now()}`, password: 'LocalMusicTest!9847' };
const authenticate = async register => {
    await c.run(`window.openAuthModal(${JSON.stringify(register ? 'register' : 'login')});
        document.querySelector('#authUsername').value = ${JSON.stringify(credentials.username)};
        document.querySelector('#authPassword').value = ${JSON.stringify(credentials.password)};
        document.querySelector('#authForm').requestSubmit();`);
    await c.until('Boolean(localStorage.getItem("userToken")) && window.router.currentRoute === "dashboard"');
};
const capture = async name => {
    await route('studio');
    await c.run(`const source = document.querySelector('[name="source"]'); source.value = 'simulation'; source.dispatchEvent(new Event('change'));
        document.querySelector('[name="title"]').value = ${JSON.stringify(name)};`);
    await click('Kaydı başlat');
    await c.until('window.router.currentView.engine.recording');
    await c.run(`document.querySelector('.studio-keyboard').focus();
        for (const key of ['a','d','g']) document.querySelector('.studio-keyboard').dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));`);
    check(await c.run('window.router.currentView.engine.notes.size === 3'), 'UI keyboard captures a three-note chord');
    await new Promise(r => setTimeout(r, 1250));
    await c.run(`for (const key of ['a','d','g']) document.querySelector('.studio-keyboard').dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));`);
    await click('Kaydı durdur');
    await c.until('Boolean([...document.querySelectorAll("button")].find(b => b.textContent === "Arşive kaydet"))');
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
    await capture('Tarayıcı testi <b>nota</b>');
    check(await c.run('document.querySelector(".studio-result").innerText.includes("henüz sunucuya yüklenmedi")'), 'local draft is not presented as a server save');
    await click('Arşive kaydet');
    await c.until('document.querySelector(".studio-result")?.innerText.includes("Kaydedildi")');
    check(true, 'MIDI recording saved in local MongoDB');
    await route('recordings');
    await c.until('Boolean(document.querySelector("[data-storage=stored]"))');
    check(await c.run('!document.querySelector(".studio-record h2 b") && document.querySelector(".studio-record h2").textContent.includes("<b>")'), 'recording title is rendered as text, not HTML');
    const savedId = await c.run('document.querySelector(".studio-record").dataset.recordingId');
    await click('Dinle');
    await c.until('Boolean(document.querySelector(".studio-player"))');
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
    await click('Arşive kaydet');
    await c.until('Boolean([...document.querySelectorAll("button")].find(b => b.textContent === "Tekrar yükle" && !b.disabled))');
    check(await c.run(`(await (await import('/js/studio/recording-store.js')).listDrafts()).some(r => r.title === 'Çevrimdışı kurtarma' && r.state === 'failed')`), 'failed upload remains in IndexedDB');
    await c.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await c.reload();
    await c.until('Boolean(window.router)');
    await route('recordings');
    await c.until('Boolean(document.querySelector("[data-storage=local]"))');
    check(true, 'local recovery is offered after reload');
    await click('Tekrar yükle');
    await c.until('document.querySelectorAll("[data-storage=stored]").length === 2');
    check(await c.run('!document.querySelector("[data-storage=local]")'), 'retry stores the draft once and clears the local copy');

    await route('pieces');
    await c.run(`document.querySelector('[name=title]').value = 'Etüt'; document.querySelector('[name=composer]').value = 'Kişisel'; document.querySelector('[name=notes]').value = 'Sol el çalışması'; document.querySelector('.studio-capture').requestSubmit();`);
    await c.until('Boolean(document.querySelector(".studio-record"))');
    await click('Stüdyoda çalış');
    await c.until('window.router.currentRoute === "studio" && Boolean(document.querySelector("[name=piece]")?.value)');
    check(true, 'saved piece opens the studio with its relationship selected');
    // A request that resolves after leaving the view must not attach a device.
    await c.run(`window.__oldMidi = navigator.requestMIDIAccess; navigator.requestMIDIAccess = async () => { throw new DOMException('denied', 'NotAllowedError'); };`);
    await click('MIDI bağla');
    await c.until('document.body.innerText.includes("MIDI izni reddedildi")');
    check(true, 'denied MIDI permission has an actionable screen');
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
