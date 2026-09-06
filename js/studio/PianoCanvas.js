import { noteName } from './MidiEngine.js';

const BLACK = new Set([1, 3, 6, 8, 10]);
const KEYBOARD = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72 };

export class PianoCanvas {
    constructor(keyboard, roll, engine) {
        this.keyboard = keyboard;
        this.roll = roll;
        this.engine = engine;
        this.pointers = new Map();
        this.keysDown = new Set();
        this.solfege = false;
        this.keys = [];
        let white = 0;
        for (let note = 21; note <= 108; note++) {
            const black = BLACK.has(note % 12);
            this.keys.push({ note, black, x: black ? white - 0.3 : white, width: black ? 0.6 : 1 });
            if (!black) white++;
        }
        this.listeners = [];
        this.listen(keyboard, 'pointerdown', event => {
            if (engine.source !== 'simulation') return;
            event.preventDefault();
            keyboard.focus({ preventScroll: true });
            keyboard.setPointerCapture(event.pointerId);
            const rect = keyboard.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width * 52;
            const y = (event.clientY - rect.top) / rect.height;
            const key = this.keys.filter(k => k.black).find(k => y < 0.64 && x >= k.x && x < k.x + k.width)
                || this.keys.find(k => !k.black && x >= k.x && x < k.x + 1);
            if (key) { this.pointers.set(event.pointerId, key.note); engine.receive([0x90, key.note, 96]); }
        });
        const release = event => {
            const note = this.pointers.get(event.pointerId);
            this.pointers.delete(event.pointerId);
            if (note !== undefined && ![...this.pointers.values()].includes(note)) engine.receive([0x80, note, 0]);
        };
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this.listen(keyboard, type, release);
        this.listen(keyboard, 'keydown', event => {
            const key = event.key.toLowerCase();
            if (engine.source !== 'simulation' || !KEYBOARD[key] || event.ctrlKey || event.metaKey || event.altKey) return;
            event.preventDefault();
            if (!this.keysDown.has(key)) { this.keysDown.add(key); engine.receive([0x90, KEYBOARD[key], 96]); }
        });
        this.listen(keyboard, 'keyup', event => {
            const key = event.key.toLowerCase();
            if (this.keysDown.delete(key)) engine.receive([0x80, KEYBOARD[key], 0]);
        });
        this.listen(keyboard, 'blur', () => this.release());
        this.listen(window, 'blur', () => this.release());
        this.frame = requestAnimationFrame(() => this.draw());
    }

    listen(target, type, fn) { target.addEventListener(type, fn); this.listeners.push(() => target.removeEventListener(type, fn)); }

    release() {
        for (const note of this.pointers.values()) this.engine.receive([0x80, note, 0]);
        for (const key of this.keysDown) this.engine.receive([0x80, KEYBOARD[key], 0]);
        this.keysDown.clear();
        this.pointers.clear();
    }

    context(canvas) {
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.min(devicePixelRatio || 1, 2);
        const width = Math.round(rect.width * ratio);
        const height = Math.round(rect.height * ratio);
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        const ctx = canvas.getContext('2d');
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        return { ctx, width: rect.width, height: rect.height };
    }

    draw() {
        const style = getComputedStyle(this.keyboard);
        const colors = Object.fromEntries(['key-white', 'key-black', 'violet', 'pink', 'surface', 'border', 'ink2'].map(k => [k, style.getPropertyValue(`--${k}`).trim()]));
        const now = this.engine.clock();
        const active = [...this.engine.notes.values()];
        const keyboard = this.context(this.keyboard);
        const roll = this.context(this.roll);
        keyboard.ctx.clearRect(0, 0, keyboard.width, keyboard.height);
        const drawKey = key => {
            const { ctx, width, height } = keyboard;
            const held = active.filter(n => n.note === key.note);
            const velocity = Math.max(0, ...held.map(n => n.velocity));
            const x = key.x * width / 52;
            const w = key.width * width / 52;
            const h = key.black ? height * 0.64 : height;
            ctx.fillStyle = key.black ? colors['key-black'] : colors['key-white'];
            ctx.fillRect(x, 0, w - 1, h);
            if (velocity) {
                ctx.globalAlpha = 0.35 + velocity / 127 * 0.65;
                ctx.fillStyle = colors.violet;
                ctx.fillRect(x, 0, w - 1, h);
                ctx.globalAlpha = 1;
            }
            if (!key.black && (key.note % 12 === 0 || key.note === 21)) {
                ctx.fillStyle = colors['key-black'];
                ctx.font = style.getPropertyValue('--piano-label-font').trim();
                ctx.textAlign = 'center';
                ctx.fillText(noteName(key.note, this.solfege), x + w / 2, h - 12, w - 2);
            }
        };
        this.keys.filter(k => !k.black).forEach(drawKey);
        this.keys.filter(k => k.black).forEach(drawKey);

        const { ctx, width, height } = roll;
        ctx.fillStyle = colors.surface;
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = colors.border;
        for (let second = 0; second <= 8; second++) {
            const y = height - second * height / 8;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }
        for (const key of this.keys) {
            if (key.note % 12 !== 0) continue;
            const x = (key.note - 21) / 88 * width;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
        for (const note of [...this.engine.history, ...active]) {
            if (note.note < 21 || note.note > 108) continue;
            const end = note.end ?? now;
            if (now - end > 8000) continue;
            const bottom = height - (now - end) / 8000 * height;
            const top = Math.max(0, height - (now - note.start) / 8000 * height);
            ctx.globalAlpha = 0.35 + note.velocity / 127 * 0.65;
            ctx.fillStyle = note.end ? colors.violet : colors.pink;
            ctx.fillRect((note.note - 21) / 88 * width, top, Math.max(2, width / 88 - 1), Math.max(3, bottom - top));
        }
        ctx.globalAlpha = 1;
        this.frame = requestAnimationFrame(() => this.draw());
    }

    dispose() { cancelAnimationFrame(this.frame); this.release(); this.listeners.forEach(remove => remove()); }
}
