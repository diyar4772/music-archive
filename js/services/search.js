import { get } from './api.js';
// Search Service
import { SEARCH_TYPES, DEBOUNCE_DELAY } from '../config.js';
import { store } from '../state/store.js';
import { debounce, showToast } from '../utils.js';
import { el, img, replace } from '../core/dom.js';
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

    // Update UI
    const buttons = {
        artist: document.getElementById('type-artist'),
        track: document.getElementById('type-track'),
        album: document.getElementById('type-album')
    };

    Object.entries(buttons).forEach(([key, btn]) => {
        if (btn) {
            btn.classList.toggle('text-green-500', key === type);
        }
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
        const header = document.createElement('div');
        header.className = 'px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider bg-[#303030]';
        header.textContent = t('search.fromLibrary');
        list.appendChild(header);

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
        const header = document.createElement('div');
        header.className = 'px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider bg-[#303030]';
        header.textContent = t('search.recent');
        list.appendChild(header);

        historyMatches.forEach(term => {
            list.appendChild(el('button', {
                className: 'autocomplete-item w-full flex items-center gap-3 p-3 text-left cursor-pointer transition',
                attrs: { type: 'button' },
                on: { click: () => selectAutocompleteItem(term) }
            }, [
                el('i', { className: 'fa-solid fa-clock text-gray-400' }),
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
            if (hasResults) {
                const header = document.createElement('div');
                header.className = 'px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider bg-[#303030]';
                header.textContent = t('search.spotifyResults');
                list.appendChild(header);
            }

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
            className: 'p-3 text-sm text-red-500',
            text: error.message || t('search.suggestFailed')
        }));
    }
}

/**
 * Create autocomplete item element
 */
function createAutocompleteItem({ name, image, subtitle, isLocal, isRounded = true, onClick }) {
    return el('button', {
        className: `autocomplete-item w-full flex items-center gap-3 p-3 text-left cursor-pointer transition ${isLocal ? 'border-l-4 border-green-500 bg-black/5 dark:bg-white/5' : ''}`,
        attrs: { type: 'button' },
        on: { click: onClick }
    }, [
        img(image, `w-10 h-10 shrink-0 ${isRounded ? 'rounded-full' : 'rounded'} object-cover`, name),
        el('span', { className: 'min-w-0' }, [
            el('span', { className: 'flex items-center gap-1 font-bold text-sm' }, [
                el('span', { className: 'truncate', text: name }),
                isLocal ? el('i', { className: 'fa-solid fa-heart text-green-500 text-xs' }) : null
            ]),
            el('span', { className: 'block text-xs text-gray-400 truncate', text: subtitle })
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

