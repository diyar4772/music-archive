import { get } from './api.js';
// Search Service
import { SEARCH_TYPES, DEBOUNCE_DELAY } from '../config.js';
import { store } from '../state/store.js';
import { debounce, showToast } from '../utils.js';
import { el, avatar, cover, replace } from '../core/dom.js';
import { t } from './i18n.js';

/**
 * Perform search based on current search type
 * @param {string} overrideQuery - Optional query override
 * @returns {Promise<Object|Array>} Search results
 */
export async function performSearch(overrideQuery, searchType = store.searchType) {
    const query = overrideQuery || document.getElementById('searchInput')?.value;
    if (!query) return null;

    // Add to search history
    store.addToHistory(query);

    // Determine API type parameter
    let apiType = 'simple';
    if (searchType === SEARCH_TYPES.TRACK) {
        apiType = 'track';
    } else if (searchType === SEARCH_TYPES.ALBUM) {
        apiType = 'album';
    }

    try {
        return await get(`/search?artist=${encodeURIComponent(query)}&type=${apiType}`);
    } catch (error) {
        showToast(`❌ ${error.message || t('search.failed')}`, 'error');
        throw error;
    }
}

/**
 * Set search type and update UI
 * @param {string} type - Search type (artist, track, album)
 */
export function setSearchType(type) {
    store.setSearchType(type);

    // Paint the filter pills. SearchBar also re-renders from its store
    // subscription; this keeps the older `initSearch()` path in step.
    document.querySelectorAll('[data-type]').forEach(button => {
        const isActive = button.dataset.type === type;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

/**
 * Handle autocomplete input
 * @param {string} query - Search query
 */
export async function handleAutocomplete(query) {
    const list = document.getElementById('autocompleteList');
    if (!list) return;

    if (!query || query.length < 2) {
        list.classList.add('hidden');
        return;
    }

    list.replaceChildren();
    list.classList.remove('hidden');

    let hasResults = false;

    // 1. Local matches (from followed artists)
    const localMatches = store.followedArtists.filter(a =>
        a.artistName?.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 3);

    if (localMatches.length > 0) {
        list.appendChild(suggestionHeading(t('search.fromLibrary')));

        localMatches.forEach(artist => {
            const div = createAutocompleteItem({
                name: artist.artistName,
                image: artist.image,
                subtitle: t('search.following'),
                isLocal: true,
                onClick: () => selectAutocompleteItem(artist.artistName)
            });
            list.appendChild(div);
        });
        hasResults = true;
    }

    // 2. Search history matches
    const historyMatches = store.searchHistory.filter(h =>
        h.toLowerCase().includes(query.toLowerCase()) && h !== query
    ).slice(0, 3);

    if (historyMatches.length > 0) {
        list.appendChild(suggestionHeading(t('search.recent')));

        historyMatches.forEach(term => {
            list.appendChild(el('button', {
                className: 'autocomplete-item ma-display-flex ma-items-center ma-gap-12 ma-w-100 ma-p-10-12 ma-border-0 ma-background-transparent ma-color-ink ma-text-13 ma-align-left ma-cursor-pointer',
                attrs: { type: 'button' },
                on: { click: () => selectAutocompleteItem(term) }
            }, [
                el('i', { className: 'fa-solid fa-clock ma-color-ink3', }),
                el('span', { text: term })
            ]));
        });
        hasResults = true;
    }

    // 3. Remote matches (Spotify)
    try {
        const typeParam = store.searchType === 'track' ? 'track' :
            (store.searchType === 'album' ? 'album' : 'artist');
        const results = await get(`/search?artist=${encodeURIComponent(query)}&type=${typeParam}`);

        if (Array.isArray(results) && results.length > 0) {
            if (hasResults) list.appendChild(suggestionHeading(t('search.spotifyResults')));

            results.slice(0, 5).forEach(item => {
                // Skip if already shown locally
                if (store.searchType === 'artist' && localMatches.some(l => l.artistId === item.id)) return;

                const div = createAutocompleteItem({
                    name: item.name,
                    image: item.image,
                    subtitle: store.searchType === 'artist' ? (item.genres || t('search.artists')) : (item.artist || t('search.tracks')),
                    isRounded: store.searchType === 'artist',
                    onClick: () => selectAutocompleteItem(item.name)
                });
                list.appendChild(div);
            });
        }
    } catch (error) {
        replace(list, el('div', {
            className: 'ma-p-12 ma-text-13 ma-color-err-ink',
            text: error.message || t('search.suggestFailed')
        }));
    }
}

/**
 * @param {string} label
 * @returns {HTMLElement} a section heading inside the suggestion list
 */
function suggestionHeading(label) {
    return el('div', {
        className: 'ma-kicker ma-p-10-12-6',
        text: label
    });
}

/**
 * Create autocomplete item element
 */
function createAutocompleteItem({ name, image, subtitle, isLocal, isRounded = true, onClick }) {
    const art = isRounded ? avatar(image, name, 'ma-avatar-sm') : cover(image, name, 'ma-cover-sm');
    art.classList.add('ma-autocomplete-art');

    return el('button', {
        className: `autocomplete-item ma-autocomplete-option${isLocal ? ' is-local' : ''}`,
        attrs: { type: 'button' },
        on: { click: onClick }
    }, [
        art,
        el('span', { className: 'ma-min-w-0' }, [
            el('span', { className: 'ma-display-flex ma-items-center ma-gap-6 ma-text-13 ma-weight-600' }, [
                el('span', { className: 'ma-truncate', text: name }),
                isLocal ? el('i', { className: 'fa-solid fa-heart ma-color-pink-ink ma-text-10', }) : null
            ]),
            el('span', { className: 'ma-truncate ma-display-block ma-text-11 ma-color-ink3',  text: subtitle })
        ])
    ]);
}

/**
 * Select autocomplete item and trigger search
 */
function selectAutocompleteItem(value) {
    const input = document.getElementById('searchInput');
    const list = document.getElementById('autocompleteList');

    if (input) input.value = value;
    if (list) list.classList.add('hidden');

    // Trigger search - this will be handled by the main app
    if (window.performSearch) {
        window.performSearch(value);
    }
}

/**
 * Create debounced autocomplete handler
 */
export const debouncedAutocomplete = debounce(handleAutocomplete, DEBOUNCE_DELAY);

/**
 * Initialize search module
 */
export function initSearch() {
    const searchInput = document.getElementById('searchInput');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => debouncedAutocomplete(e.target.value));
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && window.performSearch) {
                window.performSearch();
            }
        });
    }

    // Set default search type
    setSearchType(store.searchType);
}

