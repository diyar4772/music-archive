import { liveText as t, setText } from '../services/i18n.js';
import { el } from '../core/dom.js';
import { MidiEngine } from './MidiEngine.js';
import { PreviewSynth } from './PreviewSynth.js';
import { button, time } from './ui.js';

// One playback owner per mounted view; route changes always close its context.
export class RecordingPlayer {
    constructor(container) {
        this.container = container;
        this.engine = new MidiEngine();
        this.synth = new PreviewSynth();
        this.engine.addEventListener('notes', () => this.synth.sync(this.engine.notes));
    }

    async play(recording) {
        this.stop();
        const version = this.version;
        await this.synth.enable();
        if (version !== this.version) return;
        this.recording = recording;
        this.position = 0;
        this.index = 0;
        this.origin = performance.now();
        this.playing = true;
        this.label = el('span', { text: recording.title });
        this.counter = el('span', { className: 'studio-time' });
        this.seek = el('input', { attrs: { type: 'range', min: 0, max: recording.durationMs, step: 10, value: 0, 'aria-label': t('player.playbackLabel') },
            on: { input: () => this.seekTo(Number(this.seek.value)) } });
        const pause = button(t('player.pause'), () => {
            this.playing = !this.playing;
            setText(pause, this.playing ? t('player.pause') : t('player.resume'));
            if (this.playing) this.seekTo(this.position);
            else this.engine.panic();
        });
        this.container.replaceChildren(el('div', { className: 'studio-player' }, [
            this.label, this.counter, this.seek, pause, button(t('player.stop'), () => this.stop()),
            el('small', { className: 'studio-muted', text: t('player.synthetic') })
        ]));
        this.tick();
    }

    seekTo(position) {
        this.engine.panic();
        this.position = position;
        this.origin = performance.now() - position;
        this.index = 0;
        // Reconstruct sustain and held-note state, then update the synth once.
        this.engine.notes.clear();
        const oldContext = this.synth.context;
        this.synth.context = null;
        while (this.index < this.recording.events.length && this.recording.events[this.index].at <= position) {
            this.engine.receive(this.recording.events[this.index++].data);
        }
        this.synth.context = oldContext;
        if (this.playing) this.synth.sync(this.engine.notes);
    }

    tick() {
        if (!this.recording) return;
        if (this.playing) {
            this.position = Math.min(this.recording.durationMs, performance.now() - this.origin);
            while (this.index < this.recording.events.length && this.recording.events[this.index].at <= this.position) {
                this.engine.receive(this.recording.events[this.index++].data);
            }
            if (this.position >= this.recording.durationMs) { this.stop(); return; }
        }
        setText(this.counter, `${time(this.position)} / ${time(this.recording.durationMs)}`);
        this.seek.value = this.position;
        this.frame = requestAnimationFrame(() => this.tick());
    }

    stop() {
        this.version = (this.version || 0) + 1;
        cancelAnimationFrame(this.frame);
        this.playing = false;
        this.recording = null;
        this.engine.panic();
        this.engine.history = [];
        this.container.replaceChildren();
    }

    dispose() { this.stop(); this.engine.dispose(); void this.synth.dispose(); }
}
