// Global State Store
import { STORAGE_KEYS, SEARCH_HISTORY_LIMIT } from '../config.js';

/**
 * Central state management for the application
 * Simple reactive store pattern
 */
export const store = {
    // Auth State
    user: null,
    token: localStorage.getItem(STORAGE_KEYS.TOKEN),

    // User Data
    followedArtists: [],
    likedTracks: [],
    albumFollows: [],
    playlists: [],
    userRatings: [],

    // UI State
    searchType: 'artist',
    currentTheme: localStorage.getItem(STORAGE_KEYS.THEME) || 'dark',
    currentLang: localStorage.getItem(STORAGE_KEYS.LANG) || 'tr',

    // Search History
    searchHistory: JSON.parse(localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY) || '[]'),

    // Player State
    currentAudio: null,
    playingTrackId: null,
    currentTrackDetail: null,

    // Listeners for reactivity
    _listeners: {},

    // Methods
    setUser(user) {
        this.user = user;
        this._notify('user');
    },

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem(STORAGE_KEYS.TOKEN, token);
        } else {
            localStorage.removeItem(STORAGE_KEYS.TOKEN);
        }
        this._notify('token');
    },

    setSearchType(type) {
        this.searchType = type;
        this._notify('searchType');
    },

    addToHistory(query) {
        if (!query || !query.trim()) return;

        this.searchHistory = [
            query,
            ...this.searchHistory.filter(q => q !== query)
        ].slice(0, SEARCH_HISTORY_LIMIT);

        localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(this.searchHistory));
        this._notify('searchHistory');
    },

    clearHistory() {
        this.searchHistory = [];
        localStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY);
        this._notify('searchHistory');
    },

    setFollowedArtists(artists) {
        this.followedArtists = artists;
        this._notify('followedArtists');
    },

    setLikedTracks(tracks) {
        this.likedTracks = tracks;
        this._notify('likedTracks');
    },

    setPlaylists(playlists) {
        this.playlists = playlists;
        this._notify('playlists');
    },

    setRatings(ratings) {
        this.userRatings = ratings;
        this._notify('userRatings');
    },

    // Simple pub/sub for reactivity
    subscribe(key, callback) {
        if (!this._listeners[key]) {
            this._listeners[key] = [];
        }
        this._listeners[key].push(callback);

        // Return unsubscribe function
        return () => {
            this._listeners[key] = this._listeners[key].filter(cb => cb !== callback);
        };
    },

    _notify(key) {
        if (this._listeners[key]) {
            this._listeners[key].forEach(cb => cb(this[key]));
        }
    }
};

// Export for global access during transition
window.store = store;

