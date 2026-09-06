// K1.5 — test identities must stay language-independent.
//
// The browser suite used to find controls by their visible Turkish label. Once
// the studio screens became trilingual those selectors matched nothing, and
// `?.click()` fails silently, so the suite would have died of a timeout three
// steps away from the real cause. These checks keep that from coming back
// without needing a browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = path.join(ROOT, 'docs/specs/TESTIDS.md');
const CONTROL_TAGS = 'button|input|select|textarea';

/** Every source file that may render a control. */
function sourceFiles() {
    const js = fs.readdirSync(path.join(ROOT, 'js'), { recursive: true })
        .filter(file => file.endsWith('.js') && !file.includes('locales'))
        .map(file => path.join(ROOT, 'js', file));
    return [...js, path.join(ROOT, 'index.html')];
}

/** The options object that follows a helper call, matched by brace depth. */
function optionsBlock(source, from) {
    const start = source.indexOf('{', from);
    if (start === -1) return '';
    let depth = 0;
    for (let i = start; i < source.length; i += 1) {
        if (source[i] === '{') depth += 1;
        else if (source[i] === '}') { depth -= 1; if (!depth) return source.slice(start, i + 1); }
    }
    return source.slice(start);
}

const lineOf = (source, index) => source.slice(0, index).split('\n').length;

test('every rendered control carries a data-testid', () => {
    const missing = [];
    for (const file of sourceFiles()) {
        const source = fs.readFileSync(file, 'utf8');
        const name = path.relative(ROOT, file);
        for (const match of source.matchAll(new RegExp(`el\\('(${CONTROL_TAGS})'`, 'g'))) {
            if (/\btestid\b/.test(optionsBlock(source, match.index + match[0].length))) continue;
            missing.push(`${name}:${lineOf(source, match.index)} el('${match[1]}')`);
        }
        for (const match of source.matchAll(new RegExp(`<(${CONTROL_TAGS})\\b[^>]*>`, 'g'))) {
            if (match[0].includes('data-testid')) continue;
            missing.push(`${name}:${lineOf(source, match.index)} ${match[0].slice(0, 60)}`);
        }
    }
    assert.deepEqual(missing, [], `controls without a test identity:\n${missing.join('\n')}`);
});

test('studio control helpers are called with an explicit identity', () => {
    // button/input/select from js/studio/ui.js take the identity first, so a
    // forgotten id is a syntax-level mistake rather than a silent omission.
    const missing = [];
    for (const file of sourceFiles().filter(f => f.endsWith('.js') && !f.endsWith('ui.js'))) {
        const source = fs.readFileSync(file, 'utf8');
        if (!/from '.*ui\.js'/.test(source)) continue;
        for (const match of source.matchAll(/(?<![\w.])(button|input|select)\(\s*('|testid\b)?/g)) {
            if (match[2]) continue;
            missing.push(`${path.relative(ROOT, file)}:${lineOf(source, match.index)} ${match[1]}(…)`);
        }
    }
    assert.deepEqual(missing, [], `helper calls without an identity:\n${missing.join('\n')}`);
});

/** Identities written in the source, template ones kept as their static prefix. */
function usedIdentities() {
    const used = new Map();
    for (const file of sourceFiles()) {
        const source = fs.readFileSync(file, 'utf8');
        const record = (id, index) => used.set(id, used.get(id) || `${path.relative(ROOT, file)}:${lineOf(source, index)}`);
        for (const m of source.matchAll(/testid: (`[^`]*`|'[^']*')/g)) record(m[1].slice(1, -1), m.index);
        for (const m of source.matchAll(/data-testid="([^"]+)"/g)) record(m[1], m.index);
        for (const m of source.matchAll(/\b(?:button|input|select|act)\('([a-z0-9-]+)'/g)) record(m[1], m.index);
    }
    return used;
}

/** Identities the registry lists, split by whether they are claimed as live. */
function registryIdentities() {
    const lines = fs.readFileSync(REGISTRY, 'utf8').split('\n');
    const live = new Set(), planned = new Set();
    for (const line of lines) {
        if (!line.startsWith('|') || !line.includes('`')) continue;
        const ids = [...line.matchAll(/`([a-z0-9-]+(?:\$\{[^}]+\})?[a-z0-9-]*)`/g)].map(m => m[1]);
        const target = line.trimEnd().endsWith('✅ |') || / ✅ /.test(line) ? live : planned;
        for (const id of ids) if (!id.includes('${')) target.add(id);
    }
    return { live, planned };
}

test('the testid registry and the code agree', () => {
    const used = usedIdentities();
    const { live, planned } = registryIdentities();
    assert.ok(live.size > 80, `the registry should list the shipped controls, found ${live.size}`);

    // 1. Everything the registry claims is live must exist in the source.
    const staticIds = new Set([...used.keys()].filter(id => !id.includes('${')));
    const prefixes = [...used.keys()].filter(id => id.includes('${')).map(id => id.slice(0, id.indexOf('${')));
    const claimed = [...live].filter(id => !staticIds.has(id) && !prefixes.some(prefix => id.startsWith(prefix)));
    assert.deepEqual(claimed, [], `registry marks these ✅ but the code does not render them:\n${claimed.join('\n')}`);

    // 2. Nothing may ship undocumented; the registry is the contract Codex reads.
    const documented = new Set([...live, ...planned]);
    const undocumented = [...staticIds].filter(id => !documented.has(id)).map(id => `${id} (${used.get(id)})`);
    assert.deepEqual(undocumented, [], `identities missing from docs/specs/TESTIDS.md:\n${undocumented.join('\n')}`);

    // 3. A template identity is only meaningful if its expansions are written out.
    for (const id of [...used.keys()].filter(id => id.includes('${'))) {
        const prefix = id.slice(0, id.indexOf('${'));
        assert.ok([...documented].some(known => known.startsWith(prefix) && known !== prefix),
            `template identity ${id} has no expanded values in the registry`);
    }
});

test('the browser suite never looks a control up by its visible text', () => {
    const suite = fs.readFileSync(path.join(ROOT, 'test/browser/studio-smoke.mjs'), 'utf8');
    const textLookups = [
        /querySelectorAll\(["'`]button/,
        /\.textContent\s*===\s*["'`][^"'`]*["'`]\s*\)\s*(\?\.)?click/,
        /find\(\s*\w+\s*=>\s*\w+\.textContent/
    ];
    for (const pattern of textLookups) {
        assert.ok(!pattern.test(suite), `studio-smoke.mjs still selects controls by label: ${pattern}`);
    }
    // Reading a message through the locale file is fine — that is the point:
    // the expected text comes from the shipped translation, not from a literal.
    assert.match(suite, /locales\/\$\{language\}\.json/, 'expected strings should be read from the locale files');
});

// The helpers changed shape in K1.5 (the identity became the first argument),
// so this renders them for real instead of trusting the call sites by sight.
class NodeStub {
    constructor(tag = '') { this.tagName = tag; this.dataset = {}; this.attributes = {}; this.children = []; this.listeners = {}; this.style = {}; this.textContent = ''; }
    setAttribute(key, value) { this.attributes[key] = value; }
    getAttribute(key) { return this.attributes[key]; }
    append(...nodes) { this.children.push(...nodes); }
    addEventListener(type, callback) { this.listeners[type] = callback; }
}

test('studio helpers put the identity on the rendered control', async () => {
    const previous = Object.fromEntries(['Node', 'document', 'localStorage', 'fetch', 'window'].map(key => [key, global[key]]));
    try {
        global.Node = NodeStub;
        global.document = { createElement: tag => new NodeStub(tag), createTextNode: text => Object.assign(new NodeStub(), { textContent: text }), documentElement: {} };
        global.localStorage = { getItem: () => 'tr' };
        global.fetch = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(ROOT, url), 'utf8')) });
        global.window = {};
        const ui = await import('../js/studio/ui.js');
        const { i18nReady } = await import('../js/services/i18n.js');
        await i18nReady;

        let clicked = 0;
        const start = ui.button('studio-start', 'Kaydı başlat', () => { clicked += 1; });
        assert.equal(start.dataset.testid, 'studio-start');
        assert.equal(start.textContent, 'Kaydı başlat', 'the label must stay the label, not the identity');
        start.listeners.click();
        assert.equal(clicked, 1, 'the handler still lands after the argument shuffle');

        const title = ui.input('studio-field-title', 'title', 'placeholder');
        assert.equal(title.dataset.testid, 'studio-field-title');
        assert.equal(title.attributes.name, 'title');

        const source = ui.select('studio-source', 'source', [['midi', 'MIDI']]);
        assert.equal(source.dataset.testid, 'studio-source');
        assert.equal(source.attributes.name, 'source');
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete global[key]; else global[key] = value;
        }
    }
});
