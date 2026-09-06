const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

// Small DOM boundary for the actual component exports, not a second renderer.
class NodeStub {
    constructor(tag = '') { this.tagName = tag; this.dataset = {}; this.attributes = {}; this.children = []; this.listeners = {}; this.style = {}; this.textContent = ''; }
    setAttribute(key, value) { this.attributes[key] = value; }
    getAttribute(key) { return this.attributes[key]; }
    append(node) { this.children.push(node); }
    addEventListener(type, callback) { this.listeners[type] = callback; }
}

test('shared states expose semantics, safe messages and working actions', async () => {
    const previous = Object.fromEntries(['Node', 'document', 'localStorage', 'fetch', 'window'].map(k => [k, global[k]]));
    try {
        global.Node = NodeStub;
        global.document = { createElement: tag => new NodeStub(tag), createTextNode: text => Object.assign(new NodeStub(), { textContent: text }), documentElement: {} };
        global.localStorage = { getItem: () => 'en' };
        global.fetch = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(`${__dirname}/..${url}`, 'utf8')) });
        let auth;
        global.window = { openAuthModal: (...args) => { auth = args; } };
        const states = await import('../js/components/States.js');
        const { i18nReady, liveText, setText } = await import('../js/services/i18n.js');
        await i18nReady;
        const busy = states.loading();
        assert.equal(busy.getAttribute('aria-busy'), 'true');
        assert.equal(busy.getAttribute('aria-live'), 'polite');
        assert.throws(() => states.error({ error: new Error('private detail') }), /retry/);
        let calls = 0;
        const failed = states.error({ error: new Error('private detail'), retry: () => calls++ });
        assert.equal(failed.getAttribute('role'), 'alert');
        failed.children.at(-1).listeners.click();
        assert.equal(calls, 1);
        assert.ok(!JSON.stringify(failed).includes('private detail'));
        assert.equal(states.denied({ body: 'permission' }).getAttribute('role'), 'alert');
        const signedOut = states.signedOut({ next: 'recordings' });
        signedOut.children.at(-1).listeners.click();
        assert.deepEqual(auth, ['login', { next: 'recordings' }]);
        const empty = states.empty({ title: 'empty', action: { label: 'add', onClick: () => calls++ } });
        empty.children.at(-1).listeners.click();
        assert.equal(calls, 2);
        const label = new NodeStub();
        setText(label, liveText('studio.start'));
        assert.equal(label.dataset.lang, 'studio.start');
        assert.equal(label.textContent, 'Start recording');
        setText(label, '00:01');
        assert.equal(label.dataset.lang, undefined, 'dynamic counters lose obsolete language binding');
    } finally {
        for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete global[key]; else global[key] = value; }
    }
});
