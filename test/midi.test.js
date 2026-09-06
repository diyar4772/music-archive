const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const { validateRecording } = require('../server/studio');
const moduleFrom = async file => import(`data:text/javascript;base64,${Buffer.from(await fs.readFile(`${__dirname}/../js/studio/${file}`, 'utf8')).toString('base64')}`);

test('MIDI keeps ten-note polyphony, velocity-zero releases and channels independent', async () => {
    const { MidiEngine } = await moduleFrom('MidiEngine.js');
    const engine = new MidiEngine();
    for (let n = 60; n < 70; n++) engine.receive([0x90, n, n]);
    assert.equal(engine.notes.size, 10);
    engine.receive([0x91, 60, 100]);
    engine.receive([0x90, 60, 0]);
    assert.equal(engine.notes.size, 10);
    assert.equal(engine.notes.get('1:60').velocity, 100);
    engine.panic();
    assert.equal(engine.notes.size, 0);
});

test('sustain retains released keys, retriggers replace old notes and pedal-up releases only its channel', async () => {
    const { MidiEngine } = await moduleFrom('MidiEngine.js');
    const engine = new MidiEngine();
    for (const status of [0xb0, 0xb1]) engine.receive([status, 64, 127]);
    engine.receive([0x90, 60, 90]);
    engine.receive([0x91, 64, 80]);
    engine.receive([0x80, 60, 0]);
    engine.receive([0x81, 64, 0]);
    assert.equal(engine.notes.size, 2);
    engine.receive([0x90, 60, 100]);
    assert.equal(engine.notes.get('0:60').velocity, 100);
    engine.receive([0xb0, 64, 0]);
    assert.equal(engine.notes.size, 2);
    engine.receive([0x80, 60, 0]);
    engine.receive([0xb1, 64, 0]);
    assert.equal(engine.notes.size, 0);
});

test('capture snapshots already-held notes and produces monotonic events with final release', async () => {
    const { MidiEngine } = await moduleFrom('MidiEngine.js');
    let now = 10;
    const engine = new MidiEngine({ clock: () => now });
    engine.receive([0x90, 60, 100]);
    engine.startRecording();
    now = 510;
    engine.receive([0x80, 60, 0], 500);
    const record = engine.stopRecording();
    assert.equal(record.durationMs, 500);
    assert.deepEqual(record.events[0], { at: 0, data: [0x90, 60, 100] });
    assert.equal(record.events[1].at, 490);
    assert.equal(record.events.at(-1).at, 500);
    assert.equal(record.events.filter(e => e.data[1] === 120).length, 16);
    assert.equal(engine.stopRecording(), null);
});

test('device removal releases notes, reconnect uses selected device, dispose removes listeners', async () => {
    const { MidiEngine } = await moduleFrom('MidiEngine.js');
    const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const oldSecure = globalThis.isSecureContext;
    const access = new EventTarget();
    const port = Object.assign(new EventTarget(), { id: 'piano', name: 'Test input', state: 'connected', opens: 0, closes: 0,
        async open() { this.opens++; }, async close() { this.closes++; } });
    access.inputs = new Map([['piano', port]]);
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { requestMIDIAccess: async () => access } });
    globalThis.isSecureContext = true;
    try {
        const engine = new MidiEngine();
        await engine.connect();
        engine.receive([0x90, 60, 90]);
        port.state = 'disconnected';
        access.dispatchEvent(new Event('statechange'));
        assert.equal(engine.notes.size, 0);
        assert.equal(engine.port, null);
        port.state = 'connected';
        access.dispatchEvent(new Event('statechange'));
        assert.equal(engine.port, port);
        assert.equal(port.opens, 2);
        engine.dispose();
        const message = new Event('midimessage');
        message.data = [0x90, 60, 127];
        port.dispatchEvent(message);
        access.dispatchEvent(new Event('statechange'));
        assert.equal(engine.notes.size, 0);
        assert.equal(engine.port, null);
        assert.equal(port.closes, 2);
    } finally {
        Object.defineProperty(globalThis, 'navigator', oldNavigator);
        globalThis.isSecureContext = oldSecure;
    }
});

test('late MIDI permission result does not reopen a disposed view', async () => {
    const { MidiEngine } = await moduleFrom('MidiEngine.js');
    const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const oldSecure = globalThis.isSecureContext;
    let resolve;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { requestMIDIAccess: () => new Promise(r => { resolve = r; }) } });
    globalThis.isSecureContext = true;
    try {
        const engine = new MidiEngine();
        const connecting = engine.connect();
        engine.dispose();
        resolve({ inputs: new Map() });
        await connecting;
        assert.equal(engine.access, null);
    } finally {
        Object.defineProperty(globalThis, 'navigator', oldNavigator);
        globalThis.isSecureContext = oldSecure;
    }
});

test('MIDI history stays bounded while the recording is independent', async () => {
    const { MidiEngine } = await moduleFrom('MidiEngine.js');
    const engine = new MidiEngine();
    engine.startRecording();
    for (let i = 0; i < 2200; i++) { engine.receive([0x90, 60, 80]); engine.receive([0x80, 60, 0]); }
    assert.equal(engine.history.length, 2000);
    assert.equal(engine.events.length, 4400);
});

test('MIDI export has a valid format-0 header, chunk length, tempo and tick timing', async () => {
    const { encodeMidi } = await moduleFrom('midi-file.js');
    const bytes = encodeMidi({ durationMs: 1000, events: [{ at: 0, data: [0x90, 60, 100] }, { at: 500, data: [0x80, 60, 0] }] });
    assert.equal(Buffer.from(bytes.subarray(0, 4)).toString(), 'MThd');
    assert.equal(new DataView(bytes.buffer).getUint16(12), 480);
    assert.equal(Buffer.from(bytes.subarray(14, 18)).toString(), 'MTrk');
    assert.equal(new DataView(bytes.buffer).getUint32(18), bytes.length - 22);
    assert.deepEqual(Array.from(bytes.subarray(22, 29)), [0, 255, 81, 3, 7, 161, 32]);
    // 500ms is 480 ticks, encoded as VLQ 0x83 0x60.
    assert.deepEqual(Array.from(bytes.subarray(33, 38)), [0x83, 0x60, 0x80, 60, 0]);
    assert.deepEqual(Array.from(bytes.slice(-4)), [0, 255, 47, 0]);
});

const valid = () => ({ id: crypto.randomUUID(), title: 'Etüt', source: 'midi', instrument: 'piano', input: 'simulation',
    durationMs: 1000, events: [{ at: 0, data: [0x90, 60, 100] }, { at: 1000, data: [0x80, 60, 0] }] });

test('recording validation strips client ownership and rejects invalid events, time, source and metadata', () => {
    const result = validateRecording({ ...valid(), userId: 'someone-else', stored: true });
    assert.equal(result.userId, undefined);
    assert.equal(result.stored, undefined);
    for (const change of [
        { id: '../escape' }, { title: { $ne: null } }, { durationMs: Infinity }, { durationMs: -1 },
        { source: 'audio' }, { input: 'fake' }, { tags: ['a'.repeat(41)] }, { pieceId: {} },
        { events: [] }, { events: [{ at: 0, data: [0xf0, 60, 100] }] },
        { events: [{ at: 0, data: [0xb0, 1, 100] }] },
        { events: [{ at: 1, data: [0x90, 60, 100] }, { at: 0, data: [0x80, 60, 0] }] },
        { events: [{ at: 2000, data: [0x90, 60, 100] }] }
    ]) assert.throws(() => validateRecording({ ...valid(), ...change }), { status: 400 });
});
