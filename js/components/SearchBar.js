/**
 * Search bar.
 *
 * In the redesign the field belongs to the search screen rather than the page
 * chrome, so SearchView mounts this into its own header block. The element ids
 * `searchInput` and `autocompleteList` are kept because services/search.js
 * addresses them by id.
 */
import { Component } from '../core/Component.js';
import { store } from '../state/store.js';
import { setSearchType, handleAutocomplete } from '../services/search.js';
import { debounce } from '../utils.js';
import { el, kicker } from '../core/dom.js';
import { t } from '../services/i18n.js';

const TYPES = [
    { id: 'artist', key: 'search.artists' },
    { id: 'track', key: 'search.tracks' },
    { id: 'album', key: 'search.albums' }
];

export class SearchBar extends Component {
    constructor(container, props = {}) {
        super(container, props);
        this.router = props.router;
        this.onSearch = props.onSearch || (() => {});
        this.initialQuery = props.query || '';
    }

    render() {
        const currentType = store.searchType || 'artist';
        const debouncedAutocomplete = debounce(value => handleAutocomplete(value), 300);

        const input = el('input', {
            attrs: {
                type: 'text',
                id: 'searchInput',
                name: 'search',
                autocomplete: 'off',
                'data-form-type': 'other',
                'data-lpignore': 'true',
                'aria-label': t('search.aria'),
                placeholder: t('search.placeholder')
            },
            on: {
                input: event => {
                    this.paintClearButton(event.target.value);
                    debouncedAutocomplete(event.target.value);
                },
                keydown: event => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        this.handleSearch();
                    }
                }
            }
        });
        input.value = this.initialQuery;

        const clearButton = el('button', {
            className: 'ma-btn ma-btn-ghost',
            style: 'height:auto;padding:0;color:var(--ink3)',
            text: '✕',
            attrs: { type: 'button', id: 'searchClear', 'aria-label': t('common.close') },
            on: { click: () => this.clearQuery() }
        });
        clearButton.hidden = !this.initialQuery;

        this.container.replaceChildren(el('div', { className: 'ma-searchbar' }, [
            kicker(t('common.search')),
            el('div', { className: 'ma-searchbar-row' }, [
                el('div', { className: 'ma-searchfield' }, [
                    el('span', { style: 'color:var(--ink3);font-size:15px', attrs: { 'aria-hidden': 'true' }, text: '⌕' }),
                    input,
                    clearButton
                ]),
                el('div', {
                    className: 'ma-searchbar-types',
                    attrs: { role: 'group', 'aria-label': t('search.typeGroup') }
                }, TYPES.map(type => el('button', {
                    className: `ma-pill ma-pill-lg${type.id === currentType ? ' is-active' : ''}`,
                    text: t(type.key),
                    attrs: {
                        type: 'button',
                        id: `type-${type.id}`,
                        'data-type': type.id,
                        'aria-pressed': String(type.id === currentType)
                    },
                    on: { click: () => this.handleTypeChange(type.id) }
                })))
            ]),
            el('div', { attrs: { id: 'autocompleteList' }, className: 'autocomplete-list hidden' })
        ]));
    }

    /** @param {string} value */
    paintClearButton(value) {
        const clear = this.querySelector('#searchClear');
        if (clear) clear.hidden = !value;
    }

    clearQuery() {
        const input = this.querySelector('#searchInput');
        if (input) {
            input.value = '';
            input.focus();
        }
        this.paintClearButton('');
        this.querySelector('#autocompleteList')?.classList.add('hidden');
    }

    handleSearch() {
        const input = this.querySelector('#searchInput');
        const query = input?.value.trim();
        if (!query) return;

        this.querySelector('#autocompleteList')?.classList.add('hidden');
        this.onSearch(query);
    }

    /** @param {string} type */
    handleTypeChange(type) {
        // Read the field before setSearchType, because the store subscription
        // re-renders this component and rebuilds the input from initialQuery.
        const query = this.querySelector('#searchInput')?.value.trim() || '';
        this.initialQuery = query;
        setSearchType(type);
        // Switching the type re-runs the current query, which is what a filter
        // chip is for; without it the pill changed colour and nothing else.
        if (query) this.onSearch(query);
    }

    onMount() {
        this.unsubscribeSearchType = store.subscribe('searchType', () => this.render());
    }

    onUnmount() {
        this.unsubscribeSearchType?.();
    }
}
