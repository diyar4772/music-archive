import { loading, empty, error as errorState, denied, signedOut } from '../components/States.js';
import { liveText as t, getCurrentLanguage } from '../services/i18n.js';
import { Component } from '../core/Component.js';
import { el } from '../core/dom.js';
import { currentOwner, listDrafts, listRecordings, getRecording, uploadRecording } from '../studio/recording-store.js';
import { RecordingPlayer } from '../studio/RecordingPlayer.js';
import { downloadMidi } from '../studio/midi-file.js';
import { button, time, notice, page } from '../studio/ui.js';

export class RecordingsView extends Component {
    render() {
        this.owner = currentOwner();
        this.content = el('div', { className: 'studio-stack' });
        this.playerBox = el('div');
        this.refresh = button(t('recordings.refresh'), () => this.load());
        this.progress = el('div', { className: 'ma-refresh-progress', attrs: { hidden: true, role: 'status', 'aria-label': t('recordings.refreshing') } });
        this.player = new RecordingPlayer(this.playerBox);
        this.container.replaceChildren(page(t('recordings.title'), t('recordings.subtitle'), [
            el('div', { className: 'studio-toolbar' }, [button(t('recordings.openStudio'), () => this.props.router.navigate('studio'), true), this.refresh]),
            this.playerBox, this.progress, this.content
        ]));
    }

    onLanguageChange() {
        this.content.querySelectorAll('[data-created-at]').forEach(node => {
            node.textContent = new Date(node.dataset.createdAt).toLocaleString(getCurrentLanguage());
        });
    }

    onMount() { void this.load(); }

    async load(offset = 0) {
        if (!this.owner || currentOwner() !== this.owner) {
            this.content.replaceChildren(signedOut({ next: 'recordings' }));
            return;
        }
        if (this.loading) return;
        this.loading = true;
        this.refresh.disabled = true;
        this.progress.hidden = !this.loaded;
        this.content.setAttribute('aria-busy', 'true');
        const version = this.version = (this.version || 0) + 1;
        if (!this.loaded) this.content.replaceChildren(loading({ rows: 5 }));
        const [local, remote] = await Promise.allSettled([listDrafts(this.owner), listRecordings(offset)]);
        if (!this.isMounted || version !== this.version || currentOwner() !== this.owner) return;
        this.loading = false;
        this.refresh.disabled = false;
        this.progress.hidden = true;
        this.content.setAttribute('aria-busy', 'false');
        // A failed refresh must not erase the previously readable source.
        if (!offset) {
            if (remote.status === 'fulfilled') this.remoteRecords = remote.value.recordings;
            if (local.status === 'fulfilled') this.localDrafts = local.value;
        } else if (remote.status === 'fulfilled') { this.remoteRecords = [...(this.remoteRecords || []), ...remote.value.recordings]; }
        this.loaded = true;
        this.content.replaceChildren();
        if (local.status === 'rejected') {this.content.append(denied({ body: t('states.storageDenied'),
            action: { label: t('states.retry'), onClick: () => this.load() } }));}
        if (remote.status === 'rejected') this.content.append(errorState({ error: remote.reason, title: t('recordings.remoteFailed'), retry: () => this.load(offset) }));
        this.ids = new Set();
        const records = this.remoteRecords || [];
        const drafts = (this.localDrafts || []).filter(r => r.events.some(e => (e.data[0] & 0xf0) === 0x90 && e.data[2]));
        for (const record of records) {
            if (!this.ids.has(record.id)) { this.content.append(this.row(record, false)); this.ids.add(record.id); }
        }
        for (const draft of drafts) {
            if (!this.ids.has(draft.id)) { this.content.prepend(this.row(draft, true)); this.ids.add(draft.id); }
        }
        if (!this.ids.size && local.status === 'fulfilled' && remote.status === 'fulfilled') {
            this.content.append(empty({ title: t('recordings.empty'), action: { label: t('recordings.openStudio'), onClick: () => this.props.router.navigate('studio') } }));
        }
        if (remote.status === 'fulfilled' && remote.value.hasMore) {
            this.content.append(button(t('recordings.loadMore'), () => this.load(records.length)));
        }
    }

    row(record, local) {
        const state = local ? (record.state === 'recording' ? t('recordings.stateInterrupted') : t('recordings.stateLocal')) : t('recordings.stateStored');
        const message = el('div');
        const load = () => local ? Promise.resolve(record) : getRecording(record.id);
        const act = (label, fn) => {
            const control = button(label, async () => {
                control.disabled = true;
                try {
                    const data = await load();
                    if (!this.isMounted || currentOwner() !== this.owner) return;
                    await fn(data);
                } catch (error) { message.replaceChildren(errorState({ error, retry: () => control.click() })); }
                finally { control.disabled = false; }
            });
            return control;
        };
        const actions = [act(t('recordings.play'), data => this.player.play(data)), act(t('recordings.download'), data => downloadMidi(data))];
        if (local) {actions.push(act(t('recordings.reupload'), async data => {
            message.replaceChildren(notice(t('studio.uploading')));
            await uploadRecording(data, this.owner);
            await this.load();
        }));}
        if (record.pieceId) actions.push(button(t('recordings.practicePiece'), () => this.props.router.navigate(`studio?pieceId=${record.pieceId}`)));
        return el('article', { className: 'ma-card studio-record', dataset: { recordingId: record.id, storage: local ? 'local' : 'stored' } }, [
            el('div', { className: 'studio-heading' }, [el('h2', { text: record.title }), el('span', { className: 'ma-badge', text: record.input === 'simulation' ? t('recordings.badgeSimulation') : t('recordings.badgeMidi') })]),
            el('p', { className: 'studio-muted' }, [time(record.durationMs), ' • ',
                el('time', { dataset: { createdAt: record.createdAt || record.updatedAt }, text: new Date(record.createdAt || record.updatedAt).toLocaleString(getCurrentLanguage()) }),
                ' • ', el('span', { text: state })]),
            record.description ? el('p', { text: record.description }) : null,
            record.tags?.length ? el('p', { className: 'studio-muted', text: record.tags.join(' · ') }) : null,
            el('div', { className: 'studio-toolbar' }, actions), message
        ]);
    }

    onUnmount() { this.version++; this.player.dispose(); }
}
