const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const flatten = (object, prefix = '') => Object.fromEntries(Object.entries(object).flatMap(([key, value]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === 'object' ? Object.entries(flatten(value, name)) : [[name, value]];
}));
const locales = Object.fromEntries(['tr', 'en', 'ku'].map(lang => [lang, flatten(require(`../js/locales/${lang}.json`))]));

test('all three locales have identical nonempty keys and interpolation parameters', () => {
    const keys = Object.keys(locales.tr).sort();
    for (const [lang, entries] of Object.entries(locales)) {
        assert.deepEqual(Object.keys(entries).sort(), keys, lang);
        for (const key of keys) {
            assert.ok(typeof entries[key] === 'string' && entries[key].trim(), `${lang}:${key}`);
            const placeholders = text => [...text.matchAll(/{{(\w+)}}/g)].map(m => m[1]).sort();
            assert.deepEqual(placeholders(entries[key]), placeholders(locales.tr[key]), `${lang}:${key}`);
        }
    }
});

test('studio translation references resolve in every locale', () => {
    const files = ['views/StudioView.js', 'views/PiecesView.js', 'views/RecordingsView.js', 'studio/ui.js', 'studio/RecordingPlayer.js', 'components/States.js'];
    for (const file of files) {
        const source = fs.readFileSync(path.join(__dirname, '../js', file), 'utf8');
        for (const [, key] of source.matchAll(/\bt\('([^']+)'/g)) {
            for (const [lang, entries] of Object.entries(locales)) assert.ok(entries[key], `${file}: ${lang}:${key}`);
        }
    }
});
