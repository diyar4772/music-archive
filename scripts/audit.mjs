#!/usr/bin/env node
/**
 * Sözleşme denetimi — docs/specs/ içindeki ölçülebilir kabul kriterlerini
 * tek komutta çalıştırır.
 *
 *   node scripts/audit.mjs            # tablo
 *   node scripts/audit.mjs --json     # makine okunur
 *   node scripts/audit.mjs --strict   # bir kontrol bile kırmızıysa çıkış kodu 1
 *
 * Bu betik kod yazmaz, dosya değiştirmez. Yalnız sayar ve karşılaştırır.
 * Sayılar `BASELINE` ile kıyaslanır; taban 6 Eylül 2026'da ölçüldü.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const STRICT = args.includes('--strict');

/* ── dosya toplama ────────────────────────────────────────────────── */

const SKIP_DIRS = new Set(['node_modules', '.git', 'mobile', 'Eski raporlar vb', 'design', 'docs', 'scripts']);

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        if (SKIP_DIRS.has(name)) continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, out);
        else out.push(full);
    }
    return out;
}

const ALL = walk(join(ROOT, 'js'));
const JS = ALL.filter(f => extname(f) === '.js' && !f.includes('/locales/'));
const CSS = ALL.filter(f => extname(f) === '.css');
const read = f => readFileSync(f, 'utf8');
const rel = f => relative(ROOT, f);

/* ── C1: token dönüşümü ───────────────────────────────────────────── */

// Ham renk değeri yalnız TOKEN TANIMI satırında durabilir (`--x: #hex`).
// Başka her yerde `var(--token)` beklenir. DESIGN-TOKENS.md §4'teki kalıcı
// istisnalar (canvas tuş renkleri, gradyan ve gölge tanımları) zaten birer
// token tanımı olduğu için bu kural onları doğal olarak kapsar.
function hardcodedColors() {
    const hits = [];
    for (const file of CSS) {
        read(file).split('\n').forEach((line, i) => {
            if (!/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(line)) return;
            if (/^\s*--[\w-]+\s*:/.test(line)) return;
            hits.push(`${rel(file)}:${i + 1}`);
        });
    }
    return hits;
}

function legacySpaceScale() {
    // studio.css'in eski rem tabanlı ölçeği. --space-4: 1rem hâlâ duruyorsa
    // dönüşüm yarım kalmıştır ve sessizce yanlış boşluk üretir.
    const hits = [];
    for (const file of CSS) {
        read(file).split('\n').forEach((line, i) => {
            if (/^\s*--space-(1|2|3|4|6|8)\s*:\s*[\d.]+rem/.test(line)) hits.push(`${rel(file)}:${i + 1}`);
        });
    }
    return hits;
}

const INLINE_STYLE = /style:\s*(['"`])((?:\\.|(?!\1).)*)\1/g;

function inlineStyles() {
    const all = [];
    for (const file of JS) {
        for (const m of read(file).matchAll(INLINE_STYLE)) all.push({ file: rel(file), value: m[2] });
    }
    return all;
}

/* ── C3: i18n ─────────────────────────────────────────────────────── */

function localeKeys(lang) {
    const data = JSON.parse(read(join(ROOT, 'js/locales', `${lang}.json`)));
    const keys = [];
    const walkObj = (obj, prefix) => {
        for (const [k, v] of Object.entries(obj)) {
            const path = prefix ? `${prefix}.${k}` : k;
            if (v && typeof v === 'object' && !Array.isArray(v)) walkObj(v, path);
            else keys.push(path);
        }
    };
    walkObj(data, '');
    return keys.sort();
}

function localeParity() {
    const [tr, en, ku] = ['tr', 'en', 'ku'].map(localeKeys);
    const missing = [
        ...tr.filter(k => !en.includes(k)).map(k => `en eksik: ${k}`),
        ...tr.filter(k => !ku.includes(k)).map(k => `ku eksik: ${k}`),
        ...en.filter(k => !tr.includes(k)).map(k => `tr eksik (en'de var): ${k}`),
        ...ku.filter(k => !tr.includes(k)).map(k => `tr eksik (ku'da var): ${k}`)
    ];
    return { missing, count: tr.length };
}

// Kodda gömülü Türkçe: yorum satırları ve import yolları hariç, Türkçe'ye
// özgü harf içeren dize sabitleri. Kaba bir ölçüm ama trendi doğru gösterir.
const TR_CHARS = /[çğışöüÇĞİŞÖÜ]/;

function embeddedTurkish() {
    const hits = [];
    for (const file of JS) {
        read(file).split('\n').forEach((line, i) => {
            const code = line.replace(/^\s*(\/\/|\*|\/\*).*/, '');
            if (!code) return;
            for (const m of code.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) {
                if (TR_CHARS.test(m[2])) { hits.push(`${rel(file)}:${i + 1}  ${m[2].slice(0, 60)}`); break; }
            }
        });
    }
    return hits;
}

/* ── K1.5: test kimlikleri ────────────────────────────────────────── */

// Görünen her kontrol dilden bağımsız bir `data-testid` taşır. Taşımazsa test
// onu ancak görünen metninden bulabilir ve metin dille birlikte değişir —
// seçici sessizce hiçbir şey seçmez, test anlaşılmaz bir zaman aşımına düşer.
// SPRINT2-VERIFICATION §0 ve TESTIDS.md.
const CONTROL_TAGS = 'button|input|select|textarea';

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

function untestableControls() {
    const hits = [];
    for (const file of [...JS, join(ROOT, 'index.html')]) {
        const source = read(file);
        // el('button', { … }) — seçenek nesnesinde `testid` beklenir.
        for (const m of source.matchAll(new RegExp(`el\\('(${CONTROL_TAGS})'`, 'g'))) {
            if (/\btestid\b/.test(optionsBlock(source, m.index + m[0].length))) continue;
            hits.push(`${rel(file)}:${source.slice(0, m.index).split('\n').length}  el('${m[1]}')`);
        }
        // Şablon dizesi veya index.html içindeki düz markup.
        for (const m of source.matchAll(new RegExp(`<(${CONTROL_TAGS})\\b[^>]*>`, 'g'))) {
            if (m[0].includes('data-testid')) continue;
            hits.push(`${rel(file)}:${source.slice(0, m.index).split('\n').length}  ${m[0].slice(0, 60)}`);
        }
    }
    return hits;
}

// Stüdyo yardımcıları (js/studio/ui.js) kimliği ilk argüman olarak ister;
// ilk argüman dize sabiti değilse kontrol kimliksiz kalmış demektir.
function untestableStudioControls() {
    const hits = [];
    for (const file of JS) {
        if (file.endsWith('/ui.js')) continue;
        const source = read(file);
        for (const m of source.matchAll(/(?<![\w.])(button|input|select)\(\s*('|testid\b)?/g)) {
            // Dize sabiti ya da `act(testid, …)` gibi kimliği devreden bir sarmalayıcı.
            if (m[2]) continue;
            if (!/from '.*studio\/ui\.js'|from '\.\/ui\.js'/.test(source)) continue;
            hits.push(`${rel(file)}:${source.slice(0, m.index).split('\n').length}  ${m[1]}(…)`);
        }
    }
    return hits;
}

/* ── Brif md.1 ve md.8: ölü kontrol, konsol gürültüsü ─────────────── */

function deadHandlers() {
    const hits = [];
    for (const file of JS) {
        read(file).split('\n').forEach((line, i) => {
            // on: { click: () => {} }  ·  onClick={() => {}}  · boş gövdeli işleyici
            if (/\b(click|change|input|submit)\s*:\s*\(\s*\)\s*=>\s*\{\s*\}/.test(line)) {
                hits.push(`${rel(file)}:${i + 1}`);
            }
        });
    }
    return hits;
}

function consoleNoise() {
    const hits = [];
    for (const file of JS) {
        read(file).split('\n').forEach((line, i) => {
            if (/^\s*(\/\/|\*)/.test(line)) return;
            if (/console\.(log|debug|info)\s*\(/.test(line)) hits.push(`${rel(file)}:${i + 1}`);
        });
    }
    return hits;
}

function todoMarkers() {
    const hits = [];
    for (const file of [...JS, ...CSS]) {
        read(file).split('\n').forEach((line, i) => {
            if (/\b(TODO|FIXME|HACK|XXX)\b/.test(line)) hits.push(`${rel(file)}:${i + 1}`);
        });
    }
    return hits;
}

/* ── çalıştır ─────────────────────────────────────────────────────── */

const inline = inlineStyles();
const parity = localeParity();

const CHECKS = [
    { id: 'C1.colors',   label: 'Token dışı renk (CSS)',          value: hardcodedColors().length,  target: 0,   detail: hardcodedColors(),  spec: 'DESIGN-TOKENS §5' },
    { id: 'C1.legacy',   label: 'Eski --space rem ölçeği',        value: legacySpaceScale().length, target: 0,   detail: legacySpaceScale(), spec: 'DESIGN-TOKENS §2' },
    { id: 'C1.inline',   label: 'Inline style özniteliği',        value: inline.length,             target: 12,  detail: [],                 spec: 'DESIGN-TOKENS §6' },
    { id: 'C1.px',       label: 'Inline style içinde px',         value: inline.filter(s => /\d+px/.test(s.value)).length, target: 0,
      detail: inline.filter(s => /\d+px/.test(s.value)).map(s => `${s.file}  ${s.value.slice(0, 50)}`), spec: 'DESIGN-TOKENS §6' },
    { id: 'C3.parity',   label: 'Eksik çeviri anahtarı',          value: parity.missing.length,     target: 0,   detail: parity.missing.slice(0, 40), spec: 'I18N-STUDIO §6' },
    { id: 'C3.embedded', label: 'Kodda gömülü Türkçe dize',       value: embeddedTurkish().length,  target: 0,   detail: embeddedTurkish().slice(0, 40), spec: 'I18N-STUDIO §0' },
    { id: 'K1.5.testid', label: 'Kimliksiz kontrol',              value: untestableControls().length + untestableStudioControls().length, target: 0,
      detail: [...untestableControls(), ...untestableStudioControls()], spec: 'SPRINT2-VERIFICATION §0' },
    { id: 'B1.dead',     label: 'Boş gövdeli olay işleyici',      value: deadHandlers().length,     target: 0,   detail: deadHandlers(),     spec: 'Brif md.1' },
    { id: 'B8.console',  label: 'console.log kalıntısı',          value: consoleNoise().length,     target: 0,   detail: consoleNoise(),     spec: 'Brif md.8' },
    { id: 'X.todo',      label: 'TODO/FIXME işareti',             value: todoMarkers().length,      target: 0,   detail: todoMarkers(),      spec: '—' }
];

// 6 Eylül 2026, Sprint 1 öncesi ölçüm. Codex ilerledikçe bu sayılar düşmeli.
const BASELINE = {
    'C1.colors': 13, 'C1.legacy': 6, 'C1.inline': 117, 'C1.px': 90,
    'C3.parity': 0, 'C3.embedded': 113, 'K1.5.testid': 85, 'B1.dead': 0, 'B8.console': 7, 'X.todo': 0
};

if (JSON_OUT) {
    console.log(JSON.stringify({ checks: CHECKS.map(({ detail: _d, ...c }) => c), localeKeyCount: parity.count }, null, 2));
} else {
    const pad = (s, n) => String(s).padEnd(n);
    console.log('\n  Sözleşme denetimi — docs/specs/ kabul kriterleri\n');
    console.log(`  ${pad('kontrol', 34)}${pad('şimdi', 8)}${pad('hedef', 8)}${pad('taban', 8)}durum`);
    console.log('  ' + '─'.repeat(72));
    for (const c of CHECKS) {
        const ok = c.value <= c.target;
        const base = BASELINE[c.id];
        const trend = base === null || base === undefined ? '—'
            : c.value < base ? `↓${base - c.value}` : c.value > base ? `↑${c.value - base}` : '=';
        console.log(`  ${pad(c.label, 34)}${pad(c.value, 8)}${pad(c.target, 8)}${pad(`${base ?? '—'} ${trend}`, 8)}${ok ? 'geçti' : 'KALDI'}`);
    }
    console.log('  ' + '─'.repeat(72));
    console.log(`  çeviri anahtarı: ${parity.count} × 3 dil\n`);

    for (const c of CHECKS) {
        if (c.value <= c.target || !c.detail.length) continue;
        console.log(`  ── ${c.id}  (${c.spec})`);
        for (const line of c.detail.slice(0, 25)) console.log(`     ${line}`);
        if (c.detail.length > 25) console.log(`     … ve ${c.detail.length - 25} tane daha`);
        console.log('');
    }
}

if (STRICT && CHECKS.some(c => c.value > c.target)) process.exit(1);
