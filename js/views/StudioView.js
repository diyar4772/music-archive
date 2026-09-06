import { loading, error as errorState, denied, signedOut } from '../components/States.js';
import { liveText as t, getCurrentLanguage, setText } from '../services/i18n.js';
import { Component } from '../core/Component.js';
import { el } from '../core/dom.js';
import { MidiEngine, noteName, MAX_DURATION } from '../studio/MidiEngine.js';
import { PianoCanvas } from '../studio/PianoCanvas.js';
import { PreviewSynth } from '../studio/PreviewSynth.js';
import { RecordingPlayer } from '../studio/RecordingPlayer.js';
import { currentOwner, saveDraft, uploadRecording, listPieces } from '../studio/recording-store.js';
import { downloadMidi } from '../studio/midi-file.js';
import { button, field, input, select, time, notice, page } from '../studio/ui.js';

export class StudioView extends Component {
    constructor(container, props) {
        super(container, props);
        this.engine = new MidiEngine();
        this.synth = new PreviewSynth();
        this.owner = currentOwner();
    }

    render() {
        this.source = select('source', [['midi', t('studio.deviceLabel')], ['simulation', t('studio.sourceSimulation')]]);
        this.device = select('device', [['', t('studio.devicePlaceholder')]]);
        this.device.disabled = true;
        this.connectButton = button(t('studio.connect'), () => this.connect(), true);
        this.connection = el('div', {}, [notice(t('studio.connectHint'))]);
        this.mode = el('span', { className: 'ma-badge', text: t('studio.badgeWaiting') });
        this.currentNotes = el('div', { className: 'studio-notes', text: '—', attrs: { 'aria-live': 'polite', 'aria-atomic': 'true', 'aria-label': t('studio.notesLabel'), id: 'studio-current-notes' } });
        this.level = el('meter', { attrs: { min: 0, max: 127, value: 0, 'aria-label': t('studio.velocityLabel') } });
        this.pedal = el('span', { className: 'studio-muted', text: t('studio.sustainOff') });
        this.keyboard = el('canvas', { className: 'studio-keyboard', attrs: { tabindex: 0, role: 'group', 'aria-label': t('studio.keyboardLabel') } });
        this.roll = el('canvas', { className: 'studio-roll', attrs: { role: 'img', 'aria-label': t('studio.rollLabel'), 'aria-describedby': 'studio-current-notes' } });
        this.scroller = el('div', { className: 'studio-keyboard-scroll', attrs: { tabindex: 0, 'aria-label': t('studio.keyboardScrollLabel') } }, [this.keyboard]);
        this.title = input('title', t('studio.fieldTitlePlaceholder'));
        this.title.value = `${t('studio.captureLabel')} • ${new Date().toLocaleString(getCurrentLanguage())}`;
        this.description = input('description', t('studio.fieldDescriptionPlaceholder'), 2000);
        this.tags = input('tags', t('studio.fieldTagsPlaceholder'), 490);
        this.piece = select('piece', [['', t('studio.fieldPieceFree')]]);
        this.recordButton = button(t('studio.start'), () => this.start(), true);
        this.stopButton = button(t('studio.stop'), () => this.stop());
        this.stopButton.disabled = true;
        this.timer = el('span', { className: 'studio-time', text: '00:00', attrs: { 'aria-label': t('studio.durationLabel') } });
        this.result = el('div', { className: 'studio-result' });
        this.playerBox = el('div');
        this.player = new RecordingPlayer(this.playerBox);
        const naming = select('notation', [['letters', t('studio.notationLetters')], ['solfege', t('studio.notationSolfege')]]);
        naming.addEventListener('change', () => { this.piano.solfege = naming.value === 'solfege'; this.updateNotes(); });
        const sound = el('input', { attrs: { type: 'checkbox' } });
        sound.addEventListener('change', async () => {
            try {
                if (sound.checked) { await this.synth.enable(); if (!this.isMounted || !sound.checked) { await this.synth.dispose(); return; } this.synth.sync(this.engine.notes); }
                else await this.synth.dispose();
            } catch { sound.checked = false; this.message(t('studio.previewFailed'), true); }
        });
        this.container.replaceChildren(page(t('studio.title'), t('studio.subtitle'), [
            el('div', { className: 'studio-transport ma-card' }, [this.recordButton, this.stopButton, this.timer,
                button(t('recordings.title'), () => this.props.router.navigate('recordings'))]),
            this.owner ? null : signedOut({ next: 'studio' }), this.result, this.playerBox,
            el('div', { className: 'studio-toolbar ma-card' }, [field(t('studio.sourceLabel'), this.source), field(t('studio.deviceLabel'), this.device), this.connectButton]),
            this.connection,
            el('section', { className: 'studio-instrument ma-card', attrs: { 'aria-label': t('studio.keyboardLabel') } }, [
                el('div', { className: 'studio-toolbar' }, [this.mode, this.level, this.pedal,
                    button(t('studio.fullscreen'), () => this.fullscreen())]),
                this.currentNotes, this.roll, this.scroller,
                el('p', { className: 'studio-muted', text: t('studio.keyboardHint') })
            ]),
            el('details', { className: 'studio-settings ma-card' }, [el('summary', { text: t('studio.settings') }),
                el('div', { className: 'studio-toolbar' }, [field(t('studio.notation'), naming), field(t('studio.preview'), sound), button(t('studio.panic'), () => this.engine.panic())]),
                el('p', { className: 'studio-muted', text: t('studio.previewNote') })]),
            el('section', { className: 'ma-card studio-capture', attrs: { 'aria-label': t('studio.captureLabel') } }, [
                notice(t('studio.captureNotice')),
                el('div', { className: 'studio-fields' }, [field(t('studio.fieldTitle'), this.title), field(t('studio.fieldPiece'), this.piece), field(t('studio.fieldDescription'), this.description), field(t('tags.label'), this.tags)]),
            ]),
            notice(t('studio.limits'))
        ]));
        this.source.addEventListener('change', () => this.changeSource());
        this.device.addEventListener('change', () => this.engine.selectDevice(this.device.value));
    }

    onMount() {
        this.piano = new PianoCanvas(this.keyboard, this.roll, this.engine);
        this.scroller.scrollLeft = Math.max(0, this.keyboard.clientWidth * 0.44 - this.scroller.clientWidth / 2);
        this.engine.addEventListener('notes', () => { this.updateNotes(); this.synth.sync(this.engine.notes); });
        this.engine.addEventListener('connection', ({ detail }) => {
            this.device.replaceChildren(...detail.devices.map(port => el('option', { attrs: { value: port.id }, text: port.name || t('studio.deviceLabel') })));
            this.device.value = this.engine.deviceId;
            this.device.disabled = !detail.devices.length || this.engine.recording;
            setText(this.mode, detail.connected ? t('studio.badgeConnected') : t('studio.badgeSearching'));
            this.connection.replaceChildren(detail.error ? errorState({ retry: () => this.connect() }) : notice(detail.connected ? t('studio.connected') : t('studio.disconnected')));
            this.recordButton.disabled = !detail.connected || Boolean(this.draft) || this.engine.recording;
        });
        this.engine.addEventListener('limit', () => { void this.stop(); });
        this.addEventListener(window, 'beforeunload', event => {
            if (this.engine.recording || this.pendingSave) { event.preventDefault(); event.returnValue = ''; }
        });
        this.addEventListener(document, 'visibilitychange', () => {
            if (document.hidden) { this.piano.release(); void this.checkpoint(); }
        });
        this.interval = setInterval(() => {
            if (this.engine.recording) {
                setText(this.timer, time(this.engine.clock() - this.engine.startedAt));
                if (this.engine.clock() - this.engine.startedAt >= MAX_DURATION) void this.stop();
                else void this.checkpoint();
            }
        }, 1000);
        this.recordButton.disabled = true;
        if (this.owner) void this.loadPieces();
    }

    onLanguageChange() { this.updateNotes(); }

    async loadPieces() {
        try {
            const pieces = await listPieces();
            if (!this.isMounted) return;
            pieces.forEach(p => this.piece.append(el('option', { attrs: { value: p.id }, text: p.title })));
            if (pieces.some(p => p.id === this.props.queryParams.pieceId)) this.piece.value = this.props.queryParams.pieceId;
        } catch { if (this.isMounted) this.piece.setAttribute('title', t('studio.piecesFailed')); }
    }

    updateNotes() {
        const notes = [...this.engine.notes.values()];
        setText(this.currentNotes, [...new Set(notes.map(n => noteName(n.note, this.piano?.solfege)))].join(' · ') || '—');
        this.level.value = Math.max(0, ...notes.map(n => n.velocity));
        setText(this.pedal, this.engine.sustain.size ? t('studio.sustainOn') : t('studio.sustainOff'));
    }

    changeSource() {
        this.piano.release();
        this.engine.disconnect();
        this.engine.source = this.source.value;
        const simulation = this.source.value === 'simulation';
        this.connectButton.disabled = simulation;
        this.device.disabled = true;
        setText(this.mode, simulation ? t('studio.badgeSimulation') : t('studio.badgeWaiting'));
        this.connection.replaceChildren(notice(simulation ? t('studio.simulationOn') : t('studio.connectHint')));
        this.recordButton.disabled = !simulation || Boolean(this.draft);
    }

    async connect() {
        if (!window.isSecureContext) {
            this.connection.replaceChildren(denied({ body: t('states.insecureContext') }));
            return;
        }
        this.connectButton.disabled = true;
        this.connection.replaceChildren(loading({ rows: 1, label: t('studio.connecting') }));
        try { await this.engine.connect(); }
        catch (error) {
            if (!this.isMounted) return;
            const unsupported = error.code === 'MIDI_UNSUPPORTED';
            const permission = unsupported || ['NotAllowedError', 'SecurityError'].includes(error.name);
            this.connection.replaceChildren(permission ? denied({ title: t(unsupported ? 'studio.deviceLabel' : 'states.midiDeniedTitle'), body: t(unsupported ? 'studio.unsupported' : 'states.midiDeniedBody'),
                action: { label: t('states.midiDeniedAction'), onClick: () => {
                    this.source.value = 'simulation'; this.changeSource(); this.keyboard.focus();
                } }
            }) : errorState({ error, retry: () => this.connect() }));
            setText(this.mode, t('studio.badgeFailed'));
        } finally { if (this.isMounted) this.connectButton.disabled = this.source.value === 'simulation'; }
    }

    message(text, error = false) { this.result.replaceChildren(notice(text, error)); }

    async start() {
        if (!this.owner || currentOwner() !== this.owner) { this.result.replaceChildren(signedOut({ next: 'studio' })); return; }
        if (this.engine.recording || this.draft || this.starting) return;
        if (!this.title.value.trim()) { this.title.focus(); return; }
        if (this.source.value === 'midi' && !this.engine.port) { this.message(t('studio.needDevice'), true); return; }
        const tags = [...new Set(this.tags.value.split(',').map(s => s.trim()).filter(Boolean))];
        if (tags.length > 12 || tags.some(s => s.length > 40)) { this.message(t('studio.tagLimit'), true); return; }
        this.starting = true;
        this.recordButton.disabled = true;
        this.player.stop();
        this.draft = { id: crypto.randomUUID(), title: this.title.value.trim(), description: this.description.value.trim(), tags,
            input: this.source.value, source: 'midi', instrument: 'piano', pieceId: this.piece.value || null,
            takeGroupId: this.piece.value || null, durationMs: 1, events: [] };
        try {
            await saveDraft(this.draft, this.owner, 'recording');
            if (!this.isMounted) return;
            this.engine.startRecording();
            this.lock(true);
            this.message(t('studio.recording'));
        } catch {
            this.draft = null;
            this.recordButton.disabled = false;
            this.result.replaceChildren(denied({ body: t('states.storageDeniedRecording'), action: { label: t('states.retry'), onClick: () => this.start() } }));
        } finally { this.starting = false; }
    }

    lock(recording) {
        for (const node of [this.source, this.title, this.description, this.tags, this.piece]) node.disabled = recording;
        this.connectButton.disabled = recording || this.source.value === 'simulation';
        this.device.disabled = recording || !this.engine.port;
        this.stopButton.disabled = !recording;
        this.recordButton.disabled = recording || Boolean(this.draft);
    }

    async checkpoint() {
        if (!this.engine.recording || this.checkpointPending) return;
        this.checkpointPending = true;
        const snapshot = { ...this.draft, ...this.engine.snapshot() };
        try { await saveDraft(snapshot, this.owner, 'recording'); }
        catch { if (this.engine.recording) { await this.stop(); this.result.prepend(notice(t('studio.checkpointFailed'), true)); } }
        finally { this.checkpointPending = false; }
    }

    async stop() {
        const recording = this.engine.stopRecording();
        if (!recording) return;
        this.draft = { ...this.draft, ...recording };
        this.pendingSave = true;
        this.lock(false);
        setText(this.timer, time(this.draft.durationMs));
        let durable = true;
        try { await saveDraft(this.draft, this.owner); }
        catch { durable = false; }
        this.pendingSave = false;
        if (this.isMounted) this.showDraft(durable);
    }

    showDraft(durable) {
        const hasNotes = this.draft.events.some(e => (e.data[0] & 0xf0) === 0x90 && e.data[2]);
        const next = button(t('studio.newTake'), () => {
            this.player.stop();
            this.draft = null;
            this.message(t('studio.newTakeNote'));
            this.recordButton.disabled = this.source.value === 'midi' && !this.engine.port;
            setText(this.timer, '00:00');
        });
        next.disabled = hasNotes && !durable;
        this.message(hasNotes ? (durable ? t('studio.draftLocal') : t('studio.draftLost')) : t('studio.draftEmpty'), !durable);
        if (hasNotes) {
            const upload = button(t('studio.upload'), async () => {
                upload.disabled = true;
                next.disabled = true;
                setText(upload, t('studio.uploading'));
                const draft = this.draft;
                try {
                    await uploadRecording(draft, this.owner);
                    if (!this.isMounted) return;
                    this.draft = null;
                    this.message(t('studio.uploaded'));
                    this.result.append(button(t('studio.openRecordings'), () => this.props.router.navigate('recordings')));
                    this.recordButton.disabled = this.source.value === 'midi' && !this.engine.port;
                } catch (error) {
                    if (!this.isMounted) return;
                    this.result.prepend(errorState({ error, title: t('studio.uploadFailedSuffix'), retry: () => upload.click() }));
                    upload.disabled = false;
                    setText(upload, t('recordings.reupload'));
                    next.disabled = !durable;
                }
            }, true);
            this.result.append(el('div', { className: 'studio-toolbar' }, [upload,
                button(t('recordings.play'), () => this.player.play(this.draft).catch(() => this.result.prepend(notice(t('player.failed'), true)))),
                button(t('recordings.download'), () => downloadMidi(this.draft))]));
        }
        this.result.append(next);
    }

    async fullscreen() {
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else if (this.container.requestFullscreen) await this.container.requestFullscreen();
            else this.container.classList.toggle('studio-focus');
        } catch { this.message(t('studio.fullscreenFailed'), true); }
    }

    onUnmount() {
        clearInterval(this.interval);
        void this.stop();
        this.piano?.dispose();
        this.engine.dispose();
        void this.synth.dispose();
        this.player?.dispose();
        this.container.classList.remove('studio-focus');
        if (document.fullscreenElement === this.container) void document.exitFullscreen().catch(() => {});
    }
}
