// Deliberately labelled synthetic preview in the UI, never instrument audio.
// Web Audio nodes render off the main thread. No microphone permission needed.
export class PreviewSynth {
    constructor() { this.voices = new Map(); }

    async enable() {
        this.context ||= new AudioContext({ latencyHint: 'interactive' });
        await this.context.resume();
    }

    sync(notes) {
        if (!this.context || this.context.state !== 'running') return;
        for (const [key, voice] of this.voices) {
            if (!notes.has(key) || notes.get(key).start !== voice.start) this.release(key);
        }
        for (const [key, note] of notes) {
            if (this.voices.has(key)) continue;
            const oscillator = this.context.createOscillator();
            const gain = this.context.createGain();
            oscillator.type = 'triangle';
            oscillator.frequency.value = 440 * 2 ** ((note.note - 69) / 12);
            gain.gain.setValueAtTime(0, this.context.currentTime);
            gain.gain.linearRampToValueAtTime(note.velocity / 127 * 0.06, this.context.currentTime + 0.01);
            oscillator.connect(gain).connect(this.context.destination);
            oscillator.start();
            this.voices.set(key, { oscillator, gain, start: note.start });
        }
    }

    release(key) {
        const voice = this.voices.get(key);
        if (!voice) return;
        this.voices.delete(key);
        const end = this.context.currentTime + 0.05;
        voice.gain.gain.cancelScheduledValues(this.context.currentTime);
        voice.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.01);
        voice.oscillator.stop(end);
        voice.oscillator.onended = () => { voice.oscillator.disconnect(); voice.gain.disconnect(); };
    }

    async dispose() {
        for (const key of this.voices.keys()) this.release(key);
        const context = this.context;
        this.context = null;
        if (context && context.state !== 'closed') await context.close();
    }
}
