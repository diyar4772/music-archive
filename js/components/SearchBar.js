/**
 * Search Bar Component
 * Handles search input, autocomplete, and search type filters
 */
import { Component } from '../core/Component.js';
import { store } from '../state/store.js';
import { setSearchType, performSearch, handleAutocomplete } from '../services/search.js';
import { debounce } from '../utils.js';

export class SearchBar extends Component {
    constructor(container, props = {}) {
        super(container, props);
        this.router = props.router;
        this.onSearch = props.onSearch || (() => {});
    }

    render() {
        const currentType = store.searchType || 'artist';

        this.setHTML(`
            <div class="w-full max-w-2xl mb-10 relative z-40">
                <div class="flex gap-2 relative">
                    <div class="relative flex-1">
                        <i aria-hidden="true"
                           class="fa-solid fa-magnifying-glass absolute left-5 top-1/2 -translate-y-1/2 text-text-secondary-light dark:text-text-secondary-dark pointer-events-none"></i>
                        <input type="text"
                               id="searchInput"
                               name="search"
                               aria-label="Sanatçı, şarkı veya albüm ara"
                               placeholder="Sanatçı, şarkı veya albüm ara…"
                               class="w-full pl-12 pr-5 py-3.5 rounded-full bg-white dark:bg-card-dark border border-gray-200 dark:border-white/10 focus:border-green-500 focus:ring-2 focus:ring-green-500/40 text-text-light dark:text-white outline-none shadow-card dark:shadow-card-dark transition"
                               autocomplete="off"
                               data-form-type="other"
                               data-lpignore="true">
                    </div>
                    <button id="searchButton" type="button" aria-label="Ara"
                            class="btn-spotify text-white font-bold px-6 py-3.5 rounded-full shrink-0">
                        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                    </button>
                </div>
                <div id="autocompleteList" class="autocomplete-list hidden"></div>

                <!-- Filter Chips -->
                <div class="flex gap-2 mt-4 justify-center flex-wrap" role="group" aria-label="Arama türü">
                    <button data-type="artist" type="button"
                            id="type-artist"
                            class="px-4 py-1.5 bg-white dark:bg-card-dark border border-gray-200 dark:border-white/10 rounded-full text-sm font-semibold hover:border-green-500/50 transition ${currentType === 'artist' ? 'text-green-500 border-green-500/60' : ''}">
                        Sanatçılar
                    </button>
                    <button data-type="track" type="button"
                            id="type-track"
                            class="px-4 py-1.5 bg-white dark:bg-card-dark border border-gray-200 dark:border-white/10 rounded-full text-sm font-semibold hover:border-green-500/50 transition ${currentType === 'track' ? 'text-green-500 border-green-500/60' : ''}">
                        Şarkılar
                    </button>
                    <button data-type="album" type="button"
                            id="type-album"
                            class="px-4 py-1.5 bg-white dark:bg-card-dark border border-gray-200 dark:border-white/10 rounded-full text-sm font-semibold hover:border-green-500/50 transition ${currentType === 'album' ? 'text-green-500 border-green-500/60' : ''}">
                        Albümler
                    </button>
                </div>
            </div>
        `);

        this.attachEventListeners();
        this.updateSearchTypeUI(currentType);
    }

    attachEventListeners() {
        const searchInput = this.querySelector('#searchInput');
        const searchButton = this.querySelector('#searchButton');
        const typeButtons = this.querySelectorAll('[data-type]');

        // Search input events
        if (searchInput) {
            // Debounced autocomplete
            const debouncedAutocomplete = debounce((value) => {
                handleAutocomplete(value);
            }, 300);

            this.addEventListener(searchInput, 'input', (e) => {
                debouncedAutocomplete(e.target.value);
            });

            this.addEventListener(searchInput, 'keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSearch();
                }
            });
        }

        // Search button
        if (searchButton) {
            this.addEventListener(searchButton, 'click', () => {
                this.handleSearch();
            });
        }

        // Search type buttons
        typeButtons.forEach(btn => {
            const type = btn.getAttribute('data-type');
            this.addEventListener(btn, 'click', () => {
                this.handleTypeChange(type);
            });
        });

        // Close autocomplete on outside click
        document.addEventListener('click', (e) => {
            if (!this.container?.contains(e.target)) {
                const autocompleteList = this.querySelector('#autocompleteList');
                if (autocompleteList) {
                    autocompleteList.classList.add('hidden');
                }
            }
        });
    }

    handleSearch() {
        const searchInput = this.querySelector('#searchInput');
        if (!searchInput) return;

        const query = searchInput.value.trim();
        if (!query) return;

        // Navigate to search view if router is available
        if (this.router) {
            this.router.navigate(`search?q=${encodeURIComponent(query)}&type=${store.searchType}`);
        } else {
            // Fallback to direct search
            performSearch(query);
        }

        // Hide autocomplete
        const autocompleteList = this.querySelector('#autocompleteList');
        if (autocompleteList) {
            autocompleteList.classList.add('hidden');
        }
    }

    handleTypeChange(type) {
        setSearchType(type);
        this.updateSearchTypeUI(type);
    }

    updateSearchTypeUI(activeType) {
        const typeButtons = this.querySelectorAll('[data-type]');
        typeButtons.forEach(btn => {
            const type = btn.getAttribute('data-type');
            if (type === activeType) {
                btn.classList.add('text-green-500');
            } else {
                btn.classList.remove('text-green-500');
            }
        });
    }

    onMount() {
        // Subscribe to search type changes
        this.unsubscribeSearchType = store.subscribe('searchType', (type) => {
            this.updateSearchTypeUI(type);
        });
    }

    onUnmount() {
        if (this.unsubscribeSearchType) {
            this.unsubscribeSearchType();
        }
    }
}
