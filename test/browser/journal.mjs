// Müzik Defteri — real browser acceptance, plus a sweep over every control.
//
// Two jobs in one run, against a disposable local server and an isolated
// Chrome profile:
//
//   1. The journal flow driven the way a person drives it: type, save, edit,
//      cancel, delete, reload, sign out. Controls are found by `data-testid`,
//      never by their visible label, because the interface is trilingual.
//   2. A sweep that clicks every rendered control on every screen and fails on
//      an uncaught exception or a dead router — the "does this button actually
//      do something" pass that unit tests cannot give.
//
// Requires: a server started against an EMPTY archive (never your own), and
// Chrome with --remote-debugging-port=9227 on a throwaway profile.
//
//   JOURNAL_TEST_URL=http://127.0.0.1:3110 node test/browser/journal.mjs
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { browser } from './cdp.mjs';

const base = process.env.JOURNAL_TEST_URL || process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3110';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'only a local test server is supported');

const output = fileURLToPath(new URL('../../docs/reports/journal/', import.meta.url));
await mkdir(output, { recursive: true });

// Expected messages are read from the shipped translation, never written as
// literals here — a wording change must not turn into a silent test failure.
const messages = JSON.parse(await readFile(new URL('../../js/locales/tr.json', import.meta.url), 'utf8'));

const c = await browser();
const results = [];
const check = (ok, message) => {
    assert.ok(ok, message);
    results.push(message);
    console.log(`PASS ${results.length}: ${message}`);
};

const json = value => JSON.stringify(value);
const snap = name => c.screenshot(`${output}${name}.png`);

const route = async value => {
    await c.run(`window.router.navigate(${json(value)})`);
    await c.until(`window.router.currentRoute === ${json(value.split('?')[0])} && window.router.currentView.isMounted`);
};

/** Click a control by its test identity, failing loudly when it is not there. */
const click = async testid => {
    const found = await c.run(`(() => {
        const node = document.querySelector('[data-testid=${json(testid)}]');
        if (!node) return false;
        node.click();
        return true;
    })()`);
    assert.ok(found, `control not found: ${testid}`);
};

/** Type into a field the way a person does: value plus the input event. */
const type = async (testid, value) => {
    await c.run(`(() => {
        const node = document.querySelector('[data-testid=${json(testid)}]');
        node.value = ${json(value)};
        node.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
    })()`);
};

const visible = testid => c.run(`(() => {
    const node = document.querySelector('[data-testid=${json(testid)}]');
    return Boolean(node) && !node.classList.contains('hidden') && node.getClientRects().length > 0;
})()`);

const entries = () => c.run(`[...document.querySelectorAll('[data-testid="track-journal-entry"]')]
    .map(node => node.querySelector('.ma-journal-body')?.textContent || '')`);

const entryMeta = index => c.run(`(() => {
    const node = [...document.querySelectorAll('[data-testid="track-journal-entry"]')][${index}];
    if (!node) return null;
    return {
        date: node.querySelector('.ma-journal-date')?.textContent || '',
        score: node.querySelector('.ma-journal-score')?.textContent || '',
        flag: node.querySelector('.ma-journal-flag')?.textContent || ''
    };
})()`);

/** Wait for the drawer's journal list to settle on rendered entries. */
const journalReady = () => c.until(`Boolean(document.querySelector('#trackJournalList [data-testid="track-journal-entry"], #trackJournalList [data-state]'))`);

const openTrack = async () => {
    await c.run(`window.openTrackDetail('journal-track-1', 'Defter Şarkısı', 'Test Sanatçısı')`);
    await c.until(`!document.getElementById('trackDetailModal').classList.contains('hidden')`);
    await journalReady();
};

const closeDrawer = async () => {
    await click('track-detail-close');
    await c.until(`document.getElementById('trackDetailModal').classList.contains('hidden')`);
};

const failures = [];

try {
    await c.send('Page.navigate', { url: base });
    await c.until('Boolean(window.router)');

    // ── a disposable account, created through the real form ──────────────
    const username = `journal_${Date.now()}`;
    if (await c.run('Boolean(localStorage.getItem("userToken"))')) {
        await c.run('localStorage.clear()');
        await c.reload();
    }
    await c.run(`window.openAuthModal('register')`);
    await type('auth-username', username);
    await type('auth-password', 'JournalTest!9847');
    await click('auth-submit');
    await c.until('Boolean(localStorage.getItem("userToken"))');
    check(true, `registered a disposable account (${username})`);

    // Seed one archived track through the API: the catalog needs Spotify
    // credentials this run does not have, and the journal does not care where
    // the track came from.
    await c.run(`(async () => {
        const token = localStorage.getItem('userToken');
        await fetch('/api/library/like', { method: 'POST',
            headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
            body: JSON.stringify({ spotifyId: 'journal-track-1', trackId: 'journal-track-1', title: 'Defter Şarkısı', trackName: 'Defter Şarkısı', artist: 'Test Sanatçısı', artistName: 'Test Sanatçısı' }) });
        await (await import('/js/services/library.js')).getLikedTracks();
    })()`);

    // ── the journal itself ───────────────────────────────────────────────
    await route('library');
    await c.until(`Boolean(document.querySelector('[data-testid="library-track-row"]'))`);
    check(!await visible('library-track-note'), 'a track with no entries shows no journal badge');

    await click('library-track-open');
    await c.until(`!document.getElementById('trackDetailModal').classList.contains('hidden')`);
    await journalReady();
    check(await c.run(`Boolean(document.querySelector('#trackJournalList [data-state="empty"]'))`),
        'an empty journal says so instead of showing a blank panel');
    check(!await visible('track-note-save'), 'the save button stays hidden while the composer is empty');

    await type('track-note', '   ');
    check(!await visible('track-note-save'), 'whitespace alone does not offer a save');

    await type('track-note', '2026: Piyano girişini sevdim, geri kalanı pek geçmedi.');
    check(await visible('track-note-save'), 'typing offers the save button');
    await click('track-note-save');
    await c.until(`document.querySelectorAll('[data-testid="track-journal-entry"]').length === 1`);
    check(await c.run(`document.querySelector('[data-testid="track-note"]').value === ''`),
        'saving clears the composer');
    check(!await visible('track-note-save'), 'and hides the save button again');
    await snap('journal-first-entry');

    await type('track-note', '2027: Bu yaz sürekli dinledim. Artık başka bir anlamı var.');
    await click('track-note-save');
    await c.until(`document.querySelectorAll('[data-testid="track-journal-entry"]').length === 2`);
    const both = await entries();
    check(both[0].startsWith('2027') && both[1].startsWith('2026'),
        'the second entry is added above the first, not over it');

    // A score given now must not appear on entries written before it.
    await click('rating-star-4');
    await c.until(`Boolean(document.querySelector('[data-testid="rating-clear"]'))`);
    await type('track-note', '2028: Bugün girişini çalmayı başardım.');
    await click('track-note-save');
    await c.until(`document.querySelectorAll('[data-testid="track-journal-entry"]').length === 3`);
    const newest = await entryMeta(0);
    const oldest = await entryMeta(2);
    check(newest.score.includes('4'), 'the new entry records the score the track has today');
    check(oldest.score === '', 'the entries written before the rating stay unscored');
    check(Boolean(newest.date), 'every entry shows the day it was written');
    await snap('journal-three-entries');

    // Editing: cancel changes nothing, save changes only the text.
    await click('track-journal-edit');
    await c.until(`Boolean(document.querySelector('[data-testid="track-journal-body"]'))`);
    await type('track-journal-body', 'vazgeçilecek metin');
    await click('track-journal-cancel');
    await c.until(`!document.querySelector('[data-testid="track-journal-body"]')`);
    check((await entries())[0].startsWith('2028'), 'cancelling an edit leaves the entry alone');

    await click('track-journal-edit');
    await c.until(`Boolean(document.querySelector('[data-testid="track-journal-body"]'))`);
    await type('track-journal-body', '2028: Bugün girişini çalmayı başardım. (düzeltildi)');
    await click('track-journal-save');
    await c.until(`!document.querySelector('[data-testid="track-journal-body"]')`);
    const edited = await entryMeta(0);
    check((await entries())[0].endsWith('(düzeltildi)'), 'saving an edit rewrites the text');
    check(edited.date === newest.date && edited.score === newest.score,
        'an edit keeps the entry\'s original date and score');
    check(Boolean(edited.flag), 'and marks the entry as edited');

    // Deleting asks first, and only removes the one entry.
    await click('track-journal-delete');
    await c.until(`!document.getElementById('confirmModal').classList.contains('hidden')`);
    await click('confirm-cancel');
    await c.until(`document.getElementById('confirmModal').classList.contains('hidden')`);
    check((await entries()).length === 3, 'declining the confirmation keeps the entry');

    await click('track-journal-delete');
    await c.until(`!document.getElementById('confirmModal').classList.contains('hidden')`);
    await click('confirm-yes');
    await c.until(`document.querySelectorAll('[data-testid="track-journal-entry"]').length === 2`);
    const remaining = await entries();
    check(remaining[0].startsWith('2027') && remaining[1].startsWith('2026'),
        'deleting one entry leaves the rest of the journal in place');

    // A refused write must say why, in the reader's language, and must not
    // throw away what they typed.
    await type('track-note', 'z'.repeat(2001));
    await click('track-note-save');
    // Wait for THIS message: an earlier toast may still be on screen, and
    // "some toast exists" would pass on the previous one.
    await c.until(`[...document.querySelectorAll('#toastContainer .ma-toast')]
        .some(node => node.innerText.includes(${json(messages.journal.errorTooLong)}))`);
    check(true, 'an oversized entry is refused with the translated reason');
    check((await entries()).length === 2, 'and nothing is written');
    check(await c.run(`document.querySelector('[data-testid="track-note"]').value.length === 2001`),
        'the text the reader typed survives the refusal');
    await type('track-note', '');

    // ── it survives a reload, and it shows up in the archive ─────────────
    await closeDrawer();
    await c.reload();
    await c.until('Boolean(window.router)');
    await route('library');
    await c.until(`Boolean(document.querySelector('[data-testid="library-track-row"]'))`);
    check(await visible('library-track-note'), 'the archive row shows a journal badge');
    check(await c.run(`document.querySelector('[data-testid="library-track-note"]').textContent.includes('2')`),
        'and the badge counts the entries');

    await openTrack();
    check((await entries()).length === 2, 'the entries are still there after a reload');
    await closeDrawer();

    await route('dashboard');
    await c.until(`Boolean(document.querySelector('[data-testid="dashboard-journal-entry"]'))`);
    check(await c.run(`document.querySelector('[data-testid="dashboard-journal-entry"]').innerText.includes('2027')`),
        'the dashboard panel shows the latest entry');
    await snap('journal-dashboard-panel');

    // ── signed out ───────────────────────────────────────────────────────
    await c.run(`document.querySelector('[data-testid="nav-account"]')?.click()`);
    await click('nav-menu-logout');
    await c.until('!localStorage.getItem("userToken")');
    await c.run(`window.openTrackDetail('journal-track-1', 'Defter Şarkısı', 'Test Sanatçısı')`);
    await c.until(`Boolean(document.querySelector('#trackJournalList [data-state="signed-out"]'))`);
    check(true, 'a signed-out reader is told to sign in instead of seeing an empty journal');
    await c.run(`document.querySelector('[data-testid="track-detail-close"]')?.click()`);

    // ── the sweep: every control on every screen ─────────────────────────
    await c.run(`window.openAuthModal('login')`);
    await type('auth-username', username);
    await type('auth-password', 'JournalTest!9847');
    await click('auth-submit');
    await c.until('Boolean(localStorage.getItem("userToken"))');

    // Logout would end the sweep three screens early; everything else,
    // including the destructive controls, is fair game on a disposable
    // account against a disposable server.
    const skip = new Set(['nav-menu-logout']);
    let clicked = 0;
    const inert = [];

    // "It did not throw" is a low bar: a control that silently does nothing
    // looks identical to a working one in a screenshot. Count DOM mutations
    // and requests around each click so a dead button is visible as a zero.
    await c.run(`(() => {
        window.__mutations = 0;
        window.__fetches = 0;
        new MutationObserver(records => { window.__mutations += records.length; })
            .observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
        const nativeFetch = window.fetch;
        window.fetch = (...args) => { window.__fetches += 1; return nativeFetch(...args); };
        return true;
    })()`);

    for (const screen of ['dashboard', 'search', 'library', 'library?type=follows', 'library?type=playlists', 'dig', 'studio', 'recordings', 'pieces']) {
        await route(screen);
        // On screen means inside the viewport: the mini player parks itself
        // below the fold with a transform and still reports client rects.
        const ids = await c.run(`[...new Set([...document.querySelectorAll('[data-testid]')]
            .filter(node => ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(node.tagName))
            .filter(node => {
                const box = node.getBoundingClientRect();
                return box.width > 0 && box.height > 0
                    && box.bottom > 0 && box.top < innerHeight
                    && box.right > 0 && box.left < innerWidth;
            })
            .map(node => node.dataset.testid))]`);

        for (const id of ids) {
            if (skip.has(id)) continue;
            const before = c.errors.length;
            const selector = json(`[data-testid="${id}"]`);
            // Read the counters before the click: a control that repaints
            // synchronously would otherwise look like it did nothing.
            const activity = await c.run('({ mutations: window.__mutations, fetches: window.__fetches })');
            const acted = await c.run(`(() => {
                const node = document.querySelector(${selector});
                if (!node || !node.getClientRects().length || node.disabled) return 'gone';
                if (node.tagName !== 'BUTTON') return 'skipped';
                node.click();
                return 'clicked';
            })()`);
            if (acted === 'clicked') clicked += 1;
            await new Promise(resolve => setTimeout(resolve, 220));
            const after = await c.run('({ mutations: window.__mutations, fetches: window.__fetches })');
            if (acted === 'clicked' && after.mutations === activity.mutations && after.fetches === activity.fetches) {
                inert.push(`${screen} · ${id}`);
            }

            // Escape closes whatever the click opened, so the next control on
            // the screen is reachable.
            await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
            await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
            await new Promise(resolve => setTimeout(resolve, 80));

            const alive = await c.run('Boolean(window.router && document.getElementById("app"))');
            if (!alive) failures.push(`${screen} · ${id}: the app stopped responding after the click`);
            for (const error of c.errors.slice(before)) failures.push(`${screen} · ${id}: ${error.split('\\n')[0]}`);
            if (!alive) await c.reload();
            if (await c.run(`window.router.currentRoute !== ${json(screen.split('?')[0])}`)) await route(screen);
        }
        await snap(`sweep-${screen.replace(/[?=]/g, '-')}`);
    }
    check(clicked > 40, `clicked ${clicked} controls across nine screens`);
    check(failures.length === 0, `no control threw or froze the app${failures.length ? `:\n  ${failures.join('\n  ')}` : ''}`);
    if (inert.length) console.log(`\nControls that changed nothing when clicked (triage by hand):\n  ${inert.join('\n  ')}`);
    else console.log('\nEvery clicked control changed the page or called the API.');

    console.log(`\n${results.length} checks passed.`);
} catch (error) {
    console.error(`\nFAILED: ${error.message}`);
    if (failures.length) console.error(`sweep findings:\n  ${failures.join('\n  ')}`);
    await snap('failure').catch(() => {});
    process.exitCode = 1;
} finally {
    c.close();
}
