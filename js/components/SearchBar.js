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
            <div class="w-full max-w-xl mb-8 relative z-40">
                <div class="flex gap-3 relative">
                    <input type="text" 
                           id="searchInput" 
                           name="search" 
                           placeholder="Search for artists or tracks..."
                           class="flex-1 px-5 py-3 rounded-full bg-white dark:bg-card-dark border border-gray-200 dark:border-white/5 focus:ring-2 focus:ring-[#1DB954] text-text-light dark:text-white outline-none shadow-sm transition-colors"
                           autocomplete="off" 
                           data-form-type="other" 
                           data-lpignore="true">
                    <button id="searchButton" 
                            class="btn-spotify text-black font-bold px-6 py-3 rounded-full">
                        <i class="fa-solid fa-magnifying-glass"></i>
                    </button>
                </div>
                <div id="autocompleteList" class="autocomplete-list hidden"></div>

                <!-- Filter Chips -->
                <div class="flex gap-2 mt-4 justify-center flex-wrap">
                    <button data-type="artist" 
                            id="type-artist"
                            class="px-3 py-1 bg-white dark:bg-card-dark border border-gray-200 dark:border-white/5 rounded-full text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 ring-1 ring-transparent focus:ring-green-500 transition-colors ${currentType === 'artist' ? 'text-green-500' : ''}">
                        Musicians
                    </button>
                    <button data-type="track" 
                            id="type-track"
                            class="px-3 py-1 bg-white dark:bg-card-dark border border-gray-200 dark:border-white/5 rounded-full text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 ring-1 ring-transparent focus:ring-green-500 transition-colors ${currentType === 'track' ? 'text-green-500' : ''}">
                        Songs
                    </button>
                    <button data-type="album" 
                            id="type-album"
                            class="px-3 py-1 bg-white dark:bg-card-dark border border-gray-200 dark:border-white/5 rounded-full text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 ring-1 ring-transparent focus:ring-green-500 transition-colors ${currentType === 'album' ? 'text-green-500' : ''}">
                        Albums
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
