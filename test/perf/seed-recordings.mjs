#!/usr/bin/env node
/**
 * P3 tohumlama — docs/specs/PERF-HARNESS.md §3
 *
 * 500 gerçekçi kayıt üretir: her biri 2.000–5.000 MIDI olayı, başlık, etiket ve
 * eser bağı ile. Boş kayıtlarla ölçüm yapmak anlamsız sonuç verir.
 *
 *   node test/perf/seed-recordings.mjs --dry-run
 *       Mongo'ya dokunmaz. Üretilen yükü server/studio.js'in GERÇEK
 *       doğrulayıcısından geçirir. Bağımlılık: yok.
 *
 *   STUDIO_TEST_MONGO=mongodb://127.0.0.1:27017 node test/perf/seed-recordings.mjs
 *       Rastgele adlı yeni bir veritabanına yazar, giriş bilgilerini basar.
 *
 * GÜVENLİK: yalnız 127.0.0.1/localhost kabul edilir ve her çalıştırma kendi
 * veritabanını açar. Kişisel arşivin bulunduğu veritabanına asla yazmaz.
 */
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const COUNT = Number(args.find(a => a.startsWith('--count='))?.split('=')[1] || 500);
const PIECES = 12;

/* ── deterministik rastgelelik ────────────────────────────────────── */
// Sabit tohum: iki çalıştırma aynı veriyi üretir, ölçümler karşılaştırılabilir.
function mulberry32(seed) {
    return () => {
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rnd = mulberry32(20260906);
const pick = list => list[Math.floor(rnd() * list.length)];
const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

/* ── gerçekçi MIDI üretimi ────────────────────────────────────────── */

const SCALE = [0, 2, 4, 5, 7, 9, 11];          // majör
const TAGS = ['etüt', 'yavaş', 'sağ el', 'sol el', 'ezber', 'metronomlu', 'ısınma', 'konser'];
const COMPOSERS = ['Chopin', 'Bach', 'Debussy', 'Satie', 'Schumann', 'Grieg'];

/**
 * Bir performansı olay dizisine çevirir. Örtüşen notalar, akorlar, sustain ve
 * insan zamanlaması içerir — gerçek kayıt profiline yakın olsun diye.
 */
function makeEvents(targetEvents) {
    const events = [];
    const bpm = between(60, 132);
    const beat = 60000 / bpm;
    let at = 0;
    let sustainDown = false;

    while (events.length < targetEvents - 8) {
        // Zaman zaman pedal
        if (rnd() < 0.04) {
            events.push({ at, data: [0xB0, 64, sustainDown ? 0 : 100] });
            sustainDown = !sustainDown;
        }
        const chordSize = rnd() < 0.22 ? between(2, 4) : 1;
        const root = 36 + between(0, 3) * 12 + pick(SCALE);
        const notes = [];
        for (let i = 0; i < chordSize; i++) {
            const note = Math.min(108, root + i * (3 + Math.floor(rnd() * 2)));
            if (notes.includes(note)) continue;
            notes.push(note);
            events.push({ at, data: [0x90, note, between(48, 118)] });
        }
        // Tuşun basılı kalma süresi ile bir sonraki notaya kadar geçen süre
        // AYRI şeylerdir. Legato çalışta nota, sonraki nota başladıktan sonra
        // bırakılır — bu yüzden hold > step olabilir ve polifoni doğal oluşur.
        const hold = Math.max(60, Math.round(beat * pick([0.5, 1, 1, 1.5, 2]) + (rnd() - 0.5) * 40));
        const step = Math.max(45, Math.round(beat * pick([0.25, 0.25, 0.5, 0.5, 0.5, 1]) + (rnd() - 0.5) * 30));
        for (const note of notes) events.push({ at: at + hold, data: [0x80, note, 0] });
        at += step;
    }
    if (sustainDown) events.push({ at, data: [0xB0, 64, 0] });

    // at değerleri artan olmalı: off olayları araya girdiği için yeniden sırala.
    events.sort((a, b) => a.at - b.at);
    const durationMs = Math.max(1, events[events.length - 1].at + 500);
    return { events, durationMs, bpm };
}

function makeRecording(index, pieceIds) {
    const { events, durationMs, bpm } = makeEvents(between(2000, 5000));
    const piece = rnd() < 0.7 ? pick(pieceIds) : null;
    const tags = [...new Set([pick(TAGS), ...(rnd() < 0.4 ? [pick(TAGS)] : [])])];
    return {
        id: crypto.randomUUID(),
        title: `${piece ? 'Çalışma' : 'Serbest'} ${index + 1} • ${bpm} BPM`,
        description: rnd() < 0.5 ? `Ölçüm tohumu, ${events.length} olay.` : '',
        tags,
        input: rnd() < 0.8 ? 'midi' : 'simulation',
        source: 'midi',
        instrument: 'piano',
        durationMs,
        events,
        pieceId: piece,
        takeGroupId: piece
    };
}

/* ── dry-run: gerçek doğrulayıcıyla kendini sına ──────────────────── */

if (DRY) {
    const { validateRecording } = require('../../server/studio.js');
    const pieceIds = Array.from({ length: PIECES }, () => crypto.randomUUID());
    let events = 0;
    let duration = 0;
    const sample = Math.min(COUNT, 40);
    for (let i = 0; i < sample; i++) {
        const record = makeRecording(i, pieceIds);
        validateRecording(record);                       // hata fırlatırsa betik burada patlar
        events += record.events.length;
        duration += record.durationMs;
    }
    console.log(`dry-run: ${sample} kayıt üretildi ve server/studio.js doğrulayıcısından geçti`);
    console.log(`  ortalama olay sayısı : ${Math.round(events / sample)}`);
    console.log(`  ortalama süre        : ${(duration / sample / 1000).toFixed(1)} sn`);
    console.log(`  ${COUNT} kayıt için tahmini toplam olay: ${(Math.round(events / sample) * COUNT).toLocaleString('tr-TR')}`);
    process.exit(0);
}

/* ── gerçek tohumlama ─────────────────────────────────────────────── */

if (!process.env.STUDIO_TEST_MONGO) {
    console.error('STUDIO_TEST_MONGO gerekli. Örnek:\n  STUDIO_TEST_MONGO=mongodb://127.0.0.1:27017 node test/perf/seed-recordings.mjs');
    console.error('Yalnız yüklemeyi denemek için: node test/perf/seed-recordings.mjs --dry-run');
    process.exit(1);
}

const uri = new URL(process.env.STUDIO_TEST_MONGO);
if (uri.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost'].includes(uri.hostname)) {
    console.error('Bu betik yalnız yerel ve tek kullanımlık bir MongoDB kabul eder.');
    process.exit(1);
}
uri.pathname = `/music_archive_perf_${crypto.randomUUID().replaceAll('-', '')}`;

const password = 'PerfSeed!2026xyz';
const username = `perf_${Date.now()}`;

Object.assign(process.env, {
    NODE_ENV: 'test', SKIP_DOTENV_CONFIG: 'true', MONGO_URI: uri.toString(),
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    ADMIN_USERNAME: 'perf-admin', ADMIN_PASSWORD: crypto.randomBytes(32).toString('hex')
});

const { app, connectDatabase } = require('../../server.js');
const mongoose = require('mongoose');
const { Recording, Piece } = require('../../server/studio.js');

await connectDatabase();
await Promise.all([Recording.init(), Piece.init()]);
const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}/api`;

const registration = await fetch(`${base}/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
});
if (!registration.ok) { console.error('Hesap açılamadı:', await registration.text()); process.exit(1); }
const { token } = await registration.json();
const userId = new mongoose.Types.ObjectId(JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).id);

const pieceDocs = Array.from({ length: PIECES }, (_, i) => ({
    userId, clientId: crypto.randomUUID(),
    title: `${pick(COMPOSERS)} — Egzersiz ${i + 1}`, composer: pick(COMPOSERS),
    notes: 'Ölçüm tohumu.', catalogTrackId: null
}));
await Piece.insertMany(pieceDocs);
const pieceIds = pieceDocs.map(p => p.clientId);

const started = Date.now();
let written = 0;
for (let batch = 0; batch < COUNT; batch += 25) {
    const docs = [];
    for (let i = batch; i < Math.min(batch + 25, COUNT); i++) {
        const { id, ...rest } = makeRecording(i, pieceIds);
        docs.push({ ...rest, userId, clientId: id,
            contentHash: crypto.createHash('sha256').update(id).digest('hex'),
            createdAt: new Date(Date.now() - (COUNT - i) * 3600_000) });
    }
    await Recording.insertMany(docs);
    written += docs.length;
    process.stdout.write(`\r  yazılan: ${written}/${COUNT}`);
}

const totalEvents = await Recording.aggregate([
    { $match: { userId } }, { $group: { _id: null, n: { $sum: { $size: '$events' } } } }
]);

console.log(`\n
  Tohumlama bitti — ${((Date.now() - started) / 1000).toFixed(1)} sn
  ────────────────────────────────────────────────
  veritabanı : ${uri.pathname.slice(1)}
  kayıt      : ${written}
  eser       : ${PIECES}
  MIDI olayı : ${(totalEvents[0]?.n || 0).toLocaleString('tr-TR')}
  kullanıcı  : ${username} / ${password}

  Uygulamayı bu veritabanına bağlayıp giriş yapın:
    MONGO_URI=${uri.toString()} <diğer test sırlarıyla> npm start
  Sonra P3 ölçümü: docs/specs/PERF-HARNESS.md §3
`);

await new Promise(resolve => server.close(resolve));
await mongoose.disconnect();
