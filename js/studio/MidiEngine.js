// Framework-independent MIDI input and note state. DOM/canvas and persistence
// subscribe to events; no rendering or API requests live in this module.
export const MAX_EVENTS = 60000;
export const MAX_DURATION = 3600000;
const supported = d => d?.length === 3 && [0x80, 0x90, 0xb0].includes(d[0] & 0xf0)
    && ((d[0] & 0xf0) !== 0xb0 || [64, 120, 121, 123].includes(d[1]));

export function noteName(note, solfege = false) {
    const names = solfege ? ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si']
        : ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
    return `${names[note % 12]}${Math.floor(note / 12) - 1}`;
}

export class MidiEngine extends EventTarget {
    constructor({ clock = () => performance.now() } = {}) {
        super();
        this.clock = clock;
        this.notes = new Map();
        this.sustain = new Set();
        this.history = [];
        this.source = 'midi';
        this.deviceId = '';
        this.port = null;
        this.access = null;
        this.generation = 0;
        this.disposed = false;
        this.handleMessage = event => this.receive(event.data, event.timeStamp);
        this.handlePorts = () => this.refreshPorts();
    }

    emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

    receive(bytes, timestamp = this.clock()) {
        if (this.disposed || !supported(bytes)) return;
        const data = Array.from(bytes);
        if (!data.every(Number.isInteger) || data[0] < 128 || data[0] > 191 || data.slice(1).some(x => x < 0 || x > 127)) return;
        const [status, note, velocity] = data;
        const channel = status & 15;
        const key = `${channel}:${note}`;
        const kind = status & 0xf0;
        const at = Math.min(this.clock(), timestamp);
        if (kind === 0x90 && velocity > 0) {
            this.finish(key, at);
            this.notes.set(key, { key, note, channel, velocity, start: at, held: true });
        } else if (kind === 0x80 || (kind === 0x90 && velocity === 0)) {
            const active = this.notes.get(key);
            if (active) {
                active.held = false;
                if (!this.sustain.has(channel)) this.finish(key, at);
            }
        } else if (note === 64) {
            if (velocity >= 64) this.sustain.add(channel);
            else {
                this.sustain.delete(channel);
                for (const [id, active] of this.notes) if (active.channel === channel && !active.held) this.finish(id, at);
            }
        } else if (note === 121) {
            this.sustain.delete(channel);
            for (const [id, active] of this.notes) if (active.channel === channel && !active.held) this.finish(id, at);
        } else {
            // All Sound Off cuts immediately. All Notes Off respects sustain.
            for (const [id, active] of this.notes) {
                if (active.channel !== channel) continue;
                active.held = false;
                if (note === 120 || !this.sustain.has(channel)) this.finish(id, at);
            }
        }
        if (this.recording) {
            const elapsed = Math.max(0, at - this.startedAt);
            if (this.events.length >= MAX_EVENTS - 32 || elapsed >= MAX_DURATION) this.emit('limit');
            else this.events.push({ at: Math.max(this.events.at(-1)?.at || 0, elapsed), data });
        }
        this.emit('notes', this.notes);
    }

    finish(key, at) {
        const note = this.notes.get(key);
        if (!note) return;
        this.history.push({ ...note, end: Math.max(note.start, at) });
        this.notes.delete(key);
        // The visible roll is a rolling window, not the recording buffer.
        if (this.history.length > 2000) this.history.splice(0, this.history.length - 2000);
    }

    panic() {
        for (let channel = 0; channel < 16; channel++) this.receive([0xb0 | channel, 120, 0]);
        this.sustain.clear();
    }

    startRecording() {
        if (this.recording) return;
        this.startedAt = this.clock();
        this.events = [];
        // Notes/pedal already down when Record is pressed must replay correctly.
        for (const channel of this.sustain) this.events.push({ at: 0, data: [0xb0 | channel, 64, 127] });
        for (const n of this.notes.values()) {
            this.events.push({ at: 0, data: [0x90 | n.channel, n.note, n.velocity] });
            if (!n.held) this.events.push({ at: 0, data: [0x80 | n.channel, n.note, 0] });
        }
        this.recording = true;
    }

    snapshot() {
        return { durationMs: Math.min(MAX_DURATION, Math.max(1, this.clock() - this.startedAt)), events: this.events.map(e => ({ at: e.at, data: [...e.data] })) };
    }

    stopRecording() {
        if (!this.recording) return null;
        const recording = this.snapshot();
        this.recording = false;
        // Explicit release at the end, including held pedal, in the exported file.
        for (let channel = 0; channel < 16; channel++) recording.events.push({ at: recording.durationMs, data: [0xb0 | channel, 120, 0] });
        return recording;
    }

    async connect() {
        this.disposed = false;
        if (!globalThis.isSecureContext) throw new Error('MIDI_INSECURE_CONTEXT');
        if (!navigator.requestMIDIAccess) throw Object.assign(new Error('MIDI_UNSUPPORTED'), { code: 'MIDI_UNSUPPORTED' });
        this.disconnect();
        const generation = this.generation;
        const access = await navigator.requestMIDIAccess({ sysex: false });
        if (this.disposed || generation !== this.generation) return;
        this.access = access;
        this.source = 'midi';
        access.addEventListener('statechange', this.handlePorts);
        this.refreshPorts();
    }

    refreshPorts() {
        if (!this.access || this.disposed) return;
        const devices = [...this.access.inputs.values()].filter(p => p.state === 'connected');
        if (!this.deviceId && devices.length) this.deviceId = devices[0].id;
        const selected = devices.find(p => p.id === this.deviceId);
        if (selected !== this.port) {
            this.releasePort();
            this.panic();
            if (selected) {
                this.port = selected;
                selected.addEventListener('midimessage', this.handleMessage);
                selected.open().catch(() => {
                    if (this.port !== selected) return;
                    this.releasePort();
                    this.emit('connection', { devices, connected: false, error: 'MIDI_OPEN_FAILED' });
                });
            }
        }
        this.emit('connection', { devices, connected: Boolean(this.port) });
    }

    selectDevice(id) {
        this.deviceId = id;
        this.refreshPorts();
    }

    releasePort() {
        if (!this.port) return;
        const port = this.port;
        this.port = null;
        port.removeEventListener('midimessage', this.handleMessage);
        void port.close().catch(() => {});
    }

    disconnect() {
        this.generation++;
        this.access?.removeEventListener('statechange', this.handlePorts);
        this.access = null;
        this.releasePort();
        this.panic();
    }

    dispose() {
        this.disconnect();
        this.disposed = true;
        this.history = [];
    }
}
