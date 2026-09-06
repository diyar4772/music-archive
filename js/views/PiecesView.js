import { loading, empty, error as errorState, signedOut } from '../components/States.js';
import { liveText as t } from '../services/i18n.js';
import { Component } from '../core/Component.js';
import { el } from '../core/dom.js';
import { store } from '../state/store.js';
import { currentOwner, listPieces, createPiece } from '../studio/recording-store.js';
import { button, field, input, select, notice, page } from '../studio/ui.js';

export class PiecesView extends Component {
    render() {
        this.owner = currentOwner();
        this.list = el('div', { className: 'studio-stack' });
        const title = this.titleInput = input('piece-field-title', 'title', t('pieces.fieldTitlePlaceholder'));
        title.required = true;
        const composer = input('piece-field-composer', 'composer', t('pieces.fieldComposerPlaceholder'));
        const notes = el('textarea', { className: 'ma-input', testid: 'piece-field-notes', attrs: { name: 'notes', maxlength: 2000, rows: 3 } });
        const catalog = select('piece-field-catalog', 'catalogTrackId', [['', t('pieces.fieldCatalogNone')], ...store.likedTracks.map(t => [t.trackId, `${t.trackName} · ${t.artistName}`])]);
        const result = el('div');
        const save = el('button', { className: 'ma-btn ma-btn-primary', text: t('pieces.add'), testid: 'piece-save', attrs: { type: 'submit' } });
        const form = el('form', { className: 'ma-card studio-capture', testid: 'piece-form', on: { submit: async event => {
            event.preventDefault();
            if (save.disabled) return;
            save.disabled = true;
            result.replaceChildren(notice(t('pieces.saving')));
            try {
                await createPiece({ title: title.value, composer: composer.value, notes: notes.value, catalogTrackId: catalog.value });
                if (!this.isMounted) return;
                title.value = composer.value = notes.value = '';
                result.replaceChildren(notice(t('pieces.saved')));
                await this.load();
            } catch (error) { result.replaceChildren(errorState({ error, retry: () => form.requestSubmit() })); }
            finally { save.disabled = false; }
        } } }, [
            el('div', { className: 'studio-fields' }, [field(t('pieces.fieldTitle'), title), field(t('pieces.fieldComposer'), composer), field(t('pieces.fieldCatalog'), catalog), field(t('pieces.fieldNotes'), notes)]), save, result
        ]);
        this.container.replaceChildren(page(t('pieces.title'), t('pieces.subtitle'), [
            this.owner ? form : signedOut({ body: t('pieces.signedOut'), next: 'pieces' }),
            this.owner ? button('pieces-refresh', t('recordings.refresh'), () => this.load()) : null,
            this.list,
            notice(t('pieces.pending'))
        ]));
    }

    onLanguageChange() {}

    onMount() { if (this.owner) void this.load(); }

    async load() {
        const version = this.version = (this.version || 0) + 1;
        if (!this.loaded) this.list.replaceChildren(loading({ rows: 4 }));
        this.list.querySelectorAll('[data-state=error]').forEach(node => node.remove());
        this.list.setAttribute('aria-busy', 'true');
        try {
            const pieces = await listPieces();
            if (!this.isMounted || version !== this.version || currentOwner() !== this.owner) return;
            this.loaded = true;
            this.list.replaceChildren(...(pieces.length ? pieces.map(p => el('article', { className: 'ma-card studio-record', testid: 'piece-row' }, [
                el('h2', { text: p.title }), el('p', { className: 'studio-muted', text: p.composer }), el('p', { text: p.notes }),
                button('piece-practice', t('pieces.practice'), () => this.props.router.navigate(`studio?pieceId=${p.id}`), true)
            ])) : [empty({ title: t('pieces.empty'), action: { label: t('pieces.add'), onClick: () => this.titleInput.focus() } })]));
        } catch (error) { if (this.isMounted && version === this.version) {
            if (!this.loaded) this.list.replaceChildren();
            this.list.append(errorState({ error, retry: () => this.load() }));
        } }
        finally { if (this.isMounted && version === this.version) this.list.setAttribute('aria-busy', 'false'); }
    }
}
