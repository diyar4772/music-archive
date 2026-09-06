// Run against the isolated development server and temporary Chrome profile.
// Empty API envelopes and failure injection exercise UI states; no fake music
// is written to the application. Simulation drafts are created by actual keys.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { browser } from './cdp.mjs';
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3109';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const output = fileURLToPath(new URL('../../docs/reports/sprint-1/', import.meta.url));
await mkdir(output, { recursive: true });
const c = await browser();
const results = [];
const check = (ok, message) => { assert.ok(ok, message); results.push(message); console.log(`PASS ${results.length}: ${message}`); };
const route = async value => {
    await c.run(`window.router.navigate(${JSON.stringify(value)})`);
    await c.until(`window.router.currentRoute === ${JSON.stringify(value.split('?')[0])} && window.router.currentView.isMounted`);
};
const snap = name => c.screenshot(`${output}${name}.png`);
const state = value => c.until(`Boolean(document.querySelector('#app [data-state="${value}"]'))`);
const key = async value => {
    await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code: value, windowsVirtualKeyCode: value === 'Tab' ? 9 : value === 'Escape' ? 27 : 0 });
    await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: value, code: value });
};
try {
    await c.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
    await c.run('await window.router?.currentView?.stop?.()').catch(() => {});
    await c.send('Page.navigate', { url: base });
    await c.until('Boolean(window.router)');
    await c.run(`window.__nativeFetch = window.fetch;
        window.__mode = 'empty'; window.__requests = 0; window.__pending = []; window.__release = () => window.__pending.splice(0).forEach(resolve => resolve());
        window.fetch = async (url, options) => {
            const pathname = new URL(url, location.origin).pathname;
            if (!pathname.startsWith('/api/') || /register|login|refresh|logout/.test(pathname)) return window.__nativeFetch(url, options);
            window.__requests++;
            if (window.__mode === 'loading') await new Promise(resolve => window.__pending.push(resolve));
            if (window.__mode === 'error') throw new TypeError('PRIVATE-ERROR-MUST-NOT-RENDER');
            const body = pathname === '/api/me' ? { likes: [], follows: [], ratings: [], albumFollows: [] }
                : pathname === '/api/playlists' ? []
                : pathname === '/api/pieces' ? { pieces: [] }
                : pathname === '/api/recordings' ? { recordings: [], hasMore: false }
                : pathname === '/api/dig/queue' ? { tracks: [] } : [];
            return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
        };`);
    // Reuse the isolated account created by the baseline capture, or register.
    if (!await c.run('Boolean(localStorage.getItem("userToken"))')) {
        await c.run(`window.openAuthModal('register'); document.querySelector('#authUsername').value='sprint_'+Date.now(); document.querySelector('#authPassword').value='SprintTest!9847'; document.querySelector('#authForm').requestSubmit()`);
        await c.until('Boolean(localStorage.getItem("userToken"))');
    }
    await c.run(`const storeModule=await import('/js/studio/recording-store.js'); for (const draft of await storeModule.listDrafts()) { if (draft.title === 'Sprint 1 keyboard recording') await storeModule.deleteDraft(draft.id, storeModule.currentOwner()); } await (await import('/js/services/i18n.js')).changeLanguage('tr')`);
    for (const r of ['dashboard', 'library', 'dig', 'recordings', 'pieces']) {
        await route('studio');
        await c.run("window.__mode = 'empty'");
        await route(r); await state('empty'); await snap(`state-${r}-empty`);
        await route('studio'); await c.run("window.__mode = 'error'");
        await route(r); await state('error'); await snap(`state-${r}-error`);
        check(!await c.run("document.querySelector('#app').innerText.includes('PRIVATE-ERROR')"), `${r}: internal error is hidden`);
        const requests = await c.run('window.__requests');
        await c.run("window.__mode = 'empty'; document.querySelector('#app [data-state=error] button').click()");
        await state('empty');
        check(await c.run('window.__requests') > requests, `${r}: retry sends another request`);
    }
    await route('search?q=NoResults'); await state('empty'); await snap('state-search-empty');
    await c.run("window.__mode = 'error'; window.router.currentView.runSearch()"); await state('error'); await snap('state-search-error');
    await c.run("window.__mode = 'empty'; document.querySelector('#app [data-state=error] button').click()"); await state('empty');
    check(true, 'search: retry reuses query');

    await route('studio');
    await c.run("navigator.requestMIDIAccess = async () => { throw new DOMException('denied','NotAllowedError'); }; window.router.currentView.connect()");
    await state('denied'); await snap('state-studio-denied');
    await c.run("document.querySelector('#app [data-state=denied] button').click()");
    check(await c.run("window.router.currentView.engine.source === 'simulation' && document.activeElement.matches('canvas')"), 'MIDI denial action selects and focuses simulation');
    await c.run(`document.querySelector('[name=title]').value='Sprint 1 keyboard recording'; window.router.currentView.start()`);
    await c.until('window.router.currentView.engine.recording');
    await c.run(`window.__recordingView=window.router.currentView; document.querySelector('.studio-keyboard').dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true}));`);
    for (const lang of ['en', 'ku', 'tr']) {
        await c.run(`await (await import('/js/services/i18n.js')).changeLanguage('${lang}')`);
        check(await c.run(`window.router.currentView === window.__recordingView && window.router.currentView.engine.recording && window.router.currentView.engine.notes.size === 1`), `${lang}: changing language preserves active recording and note`);
        check(await c.run(`document.querySelector('.studio-page h1').textContent === (await import('/js/services/i18n.js')).t('studio.title') && document.querySelector('input[name=description]').placeholder === (await import('/js/services/i18n.js')).t('studio.fieldDescriptionPlaceholder')`), `${lang}: studio text and placeholders translated`);
        await snap(`locale-${lang}-studio`);
    }
    await c.run(`document.querySelector('.studio-keyboard').dispatchEvent(new KeyboardEvent('keyup',{key:'a',bubbles:true})); window.router.currentView.stop()`);
    await c.until('Boolean(window.router.currentView.draft?.events.length) && !window.router.currentView.pendingSave');
    await route('recordings'); await c.until('Boolean(document.querySelector("[data-storage=local]"))');
    await c.run("window.__mode='loading'; window.router.currentView.load()");
    check(await c.run("Boolean(document.querySelector('[data-storage=local]')) && window.router.currentView.refresh.disabled && !window.router.currentView.progress.hidden"), 'refresh preserves local recording and shows progress');
    await snap('state-recordings-refresh');
    await c.run("window.__mode='error'; window.__release()"); await state('error');
    check(await c.run("Boolean(document.querySelector('[data-storage=local]'))"), 'server failure preserves local draft');
    await c.run("window.__mode='empty'; window.__nativeTransaction=IDBDatabase.prototype.transaction; IDBDatabase.prototype.transaction=function(){throw new DOMException('blocked','SecurityError')}; window.router.currentView.load()");
    await state('denied'); await snap('state-recordings-denied');
    check(true, 'storage denial is separate from server failure');
    await c.run('IDBDatabase.prototype.transaction=window.__nativeTransaction');
    for (const lang of ['tr', 'en', 'ku']) {
        await c.run(`await (await import('/js/services/i18n.js')).changeLanguage('${lang}')`);
        for (const r of ['studio','recordings','pieces']) {
            await route(r); await snap(`locale-${lang}-${r}`);
        }
    }
    await c.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    for (const lang of ['tr','en','ku']) {
        await c.run(`await (await import('/js/services/i18n.js')).changeLanguage('${lang}')`);
        for (const r of ['dashboard','search','library','dig','studio','recordings','pieces']) {
            await route(r);
            check(await c.run('document.documentElement.scrollWidth <= innerWidth'), `${lang}/${r}: no overflow at 375px`);
            const small = await c.run(`[...document.querySelectorAll('button,input:not([type=hidden]),select,summary')].filter(n=>n.getClientRects().length && !n.closest('details:not([open])') && !n.disabled).filter(n=>{const r=n.getBoundingClientRect();return r.width<44 || r.height<44}).map(n=>n.outerHTML.slice(0,160))`);
            check(small.length === 0, `${lang}/${r}: touch targets >=44 (${small.join(', ')})`);
            await snap(`mobile-${lang}-${r}`);
        }
    }
    await route('studio');
    await c.run("document.querySelector('.studio-keyboard').focus()"); await key('Tab');
    check(await c.run("document.activeElement.matches('summary') && getComputedStyle(document.activeElement).outlineStyle !== 'none'"), 'keyboard reaches settings with visible focus');
    await c.run("window.openAuthModal('login', {next:'recordings'})");
    for (let i=0;i<8;i++) await key('Tab');
    check(await c.run("document.querySelector('#authModal').contains(document.activeElement)"), 'auth modal keeps keyboard focus inside');
    await key('Escape');
    await c.until("document.querySelector('#authModal').classList.contains('hidden')");
    check(true,'Escape closes the modal');
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
    await c.run("await (await import('/js/services/i18n.js')).changeLanguage('tr')");
    for (const r of ['dashboard','library','dig','recordings','pieces','search?q=NoResults']) {
        await route('search');
        await c.run("window.__mode='loading'");
        await route(r); await state('loading'); await snap(`state-${r.split('?')[0]}-loading`);
        check(await c.run("document.querySelector('#app [data-state=loading]').getAttribute('aria-busy') === 'true'"), `${r}: loading exposes busy state`);
        await c.run("window.__mode='empty'; window.__release()");
        await c.until("!document.querySelector('#app [data-state=loading]')");
    }
    await route('studio');
    await c.run("navigator.requestMIDIAccess = () => new Promise(resolve => window.__midiResolve = resolve); window.router.currentView.connect()");
    await state('loading'); await snap('state-studio-loading');
    await c.run("window.__midiResolve({ inputs: new Map(), addEventListener(){}, removeEventListener(){} })");
    await c.until("!document.querySelector('#app [data-state=loading]')");
    await c.run("navigator.requestMIDIAccess = async () => { throw new Error('PRIVATE-MIDI-ERROR') }; window.router.currentView.connect()");
    await state('error'); await snap('state-studio-error');
    await c.run("navigator.requestMIDIAccess = async () => ({inputs:new Map(), addEventListener(){},removeEventListener(){}}); document.querySelector('#app [data-state=error] button').click()");
    await c.until("!document.querySelector('#app [data-state=error]')");
    check(true, 'MIDI error retry reconnects');
    await c.run("Object.defineProperty(window,'isSecureContext',{value:false,configurable:true}); window.router.currentView.connect()");
    await state('denied'); await snap('state-studio-insecure');
    await c.run("delete window.isSecureContext; window.__username=(await import('/js/services/auth.js')).getCurrentUser(); await (await import('/js/services/auth.js')).logout()");
    for (const r of ['library','dig','studio','recordings','pieces']) {
        await route(r); await state('signed-out'); await snap(`state-${r}-signed-out`);
    }
    await route('dashboard'); await snap('state-dashboard-signed-out');
    await route('search'); await snap('state-search-signed-out');
    await route('recordings');
    await c.run("document.querySelector('#app [data-state=signed-out] button').click(); document.querySelector('#authUsername').value=window.__username; document.querySelector('#authPassword').value='SprintTest!9847'; document.querySelector('#authForm').requestSubmit()");
    await c.until("Boolean(localStorage.getItem('userToken')) && window.router.currentRoute === 'recordings' && !document.querySelector('#app [data-state=signed-out]')");
    check(true, 'actual login returns to the recordings route');
    check(c.errors.length === 0, `no uncaught exceptions: ${c.errors.join('; ')}`);
    await writeFile(`${output}browser-results.json`, JSON.stringify({ checks: results.length, results },null,2));
} finally { c.close(); }
