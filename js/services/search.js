// Search Service
import { API_URL, SEARCH_TYPES, DEBOUNCE_DELAY } from '../config.js';
import { store } from '../state/store.js';
import { debounce, showToast } from '../utils.js';

/**
 * Perform search based on current search type
 * @param {string} overrideQuery - Optional query override
 * @returns {Promise<Object|Array>} Search results
 */
export async function performSearch(overrideQuery) {
    const query = overrideQuery || document.getElementById('searchInput')?.value;
    if (!query) return null;

    // Add to search history
    store.addToHistory(query);

    // Determine API type parameter
    let apiType = 'simple';
    if (store.searchType === SEARCH_TYPES.TRACK) {
        apiType = 'track';
    } else if (store.searchType === SEARCH_TYPES.ALBUM) {
        apiType = 'album';
    }

    try {
        const res = await fetch(`${API_URL}/search?artist=${encodeURIComponent(query)}&type=${apiType}`);

        if (!res.ok) {
            const errorText = await res.text();
            try {
                const errorJson = JSON.parse(errorText);
                throw new Error(errorJson.error || `Server Error (${res.status})`);
            } catch (parseError) {
                if (parseError.message.includes('Server Error')) throw parseError;
                throw new Error(`Server Error (${res.status}): ${res.statusText}`);
            }
        }

        return await res.json();
    } catch (error) {
        console.error('Search error:', error);
        showToast('❌ Arama başarısız: ' + error.message);
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

    list.innerHTML = '';
    list.classList.remove('hidden');

    let hasResults = false;

    // 1. Local matches (from followed artists)
    const localMatches = store.followedArtists.filter(a =>
        a.artistName?.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 3);

    if (localMatches.length > 0) {
        const header = document.createElement('div');
        header.className = 'px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider bg-[#303030]';
        header.innerText = 'From Your Library';
        list.appendChild(header);

        localMatches.forEach(artist => {
            const div = createAutocompleteItem({
                name: artist.artistName,
                image: artist.image,
                subtitle: 'Following',
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
        header.innerText = 'Recent Searches';
        list.appendChild(header);

        historyMatches.forEach(term => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item flex items-center gap-3 p-3 cursor-pointer text-white transition';
            div.onclick = () => selectAutocompleteItem(term);
            div.innerHTML = `
                <i class="fa-solid fa-clock text-gray-400"></i>
                <span>${term}</span>
            `;
            list.appendChild(div);
        });
        hasResults = true;
    }

    // 3. Remote matches (Spotify)
    try {
        const typeParam = store.searchType === 'track' ? 'track' :
            (store.searchType === 'album' ? 'album' : 'artist');
        const res = await fetch(`${API_URL}/search?artist=${encodeURIComponent(query)}&type=${typeParam}`);
        const results = await res.json();

        if (Array.isArray(results) && results.length > 0) {
            if (hasResults) {
                const header = document.createElement('div');
                header.className = 'px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider bg-[#303030]';
                header.innerText = 'Spotify Results';
                list.appendChild(header);
            }

            results.slice(0, 5).forEach(item => {
                // Skip if already shown locally
                if (store.searchType === 'artist' && localMatches.some(l => l.artistId === item.id)) return;

                const div = createAutocompleteItem({
                    name: item.name,
                    image: item.image,
                    subtitle: store.searchType === 'artist' ? (item.genres || 'Artist') : (item.artist || 'Track'),
                    isRounded: store.searchType === 'artist',
                    onClick: () => selectAutocompleteItem(item.name)
                });
                list.appendChild(div);
            });
        }
    } catch (error) {
        console.error('Autocomplete fetch error:', error);
    }
}

/**
 * Create autocomplete item element
 */
function createAutocompleteItem({ name, image, subtitle, isLocal, isRounded = true, onClick }) {
    const div = document.createElement('div');
    div.className = `autocomplete-item flex items-center gap-3 p-3 cursor-pointer text-white transition ${isLocal ? 'border-l-4 border-green-500 bg-[#333]' : ''}`;
    div.onclick = onClick;

    div.innerHTML = `
        <img src="${image || 'https://via.placeholder.com/40'}" class="w-10 h-10 ${isRounded ? 'rounded-full' : 'rounded'} object-cover">
        <div>
            <div class="font-bold text-sm">${name} ${isLocal ? '<i class="fa-solid fa-heart text-green-500 ml-1 text-xs"></i>' : ''}</div>
            <div class="text-xs text-gray-400">${subtitle}</div>
        </div>
    `;

    return div;
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

