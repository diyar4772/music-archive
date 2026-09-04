/**
 * Global State Store
 * Enhanced with support for normalized Track/Artist/Album models
 * Maintains backward compatibility with legacy data format
 */
import { STORAGE_KEYS, SEARCH_HISTORY_LIMIT } from '../config.js';

// Import models for type conversion (lazy loaded to avoid circular deps)
let Track, Artist, Album, Playlist, SpotifyAdapter;

// Lazy load models to prevent circular dependencies
async function loadModels() {
    if (!Track) {
        const models = await import('../models/index.js');
        Track = models.Track;
        Artist = models.Artist;
        Album = models.Album;
        Playlist = models.Playlist;

        const adapters = await import('../adapters/index.js');
        SpotifyAdapter = adapters.SpotifyAdapter;
    }
}

/**
 * Central state management for the application
 * Simple reactive store pattern with model support
 */
export const store = {
    // Auth State
    user: null,
    token: localStorage.getItem(STORAGE_KEYS.TOKEN),

    // User Data (can hold both legacy and model formats)
    followedArtists: [],
    likedTracks: [],
    albumFollows: [],
    playlists: [],
    userRatings: [],

    // Normalized model cache (for new architecture)
    _models: {
        tracks: new Map(),      // id -> Track
        artists: new Map(),     // id -> Artist
        albums: new Map(),      // id -> Album
        playlists: new Map()    // id -> Playlist
    },

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

    // ==================== AUTH METHODS ====================

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

    // ==================== SEARCH METHODS ====================

    setSearchType(type) {
        this.searchType = type;
        this._notify('searchType');
    },

    addToHistory(query) {
        if (!query || !query.trim()) return;

        this.searchHistory = [
            query,
            ...this.searchHistory.filter(q => q.toLowerCase() !== query.toLowerCase())
        ].slice(0, SEARCH_HISTORY_LIMIT);

        localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(this.searchHistory));
        this._notify('searchHistory');
    },

    clearHistory() {
        this.searchHistory = [];
        localStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY);
        this._notify('searchHistory');
    },

    // ==================== LIBRARY METHODS (Legacy Compatible) ====================

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

    setAlbumFollows(albums) {
        this.albumFollows = albums;
        this._notify('albumFollows');
    },

    // ==================== MODEL-BASED METHODS (New Architecture) ====================

    /**
     * Get a track as a normalized Track model
     * @param {string} id - Track ID (can be internal or spotify:xxx format)
     * @returns {Track|null}
     */
    async getTrackModel(id) {
        await loadModels();

        // Check cache first
        if (this._models.tracks.has(id)) {
            return this._models.tracks.get(id);
        }

        // Try to find in legacy data
        const legacyTrack = this.likedTracks.find(t =>
            t.trackId === id || t.id === id || `spotify:${t.trackId}` === id
        );

        if (legacyTrack) {
            const track = SpotifyAdapter.fromLegacyLikedTrack(legacyTrack);
            this._models.tracks.set(id, track);
            return track;
        }

        return null;
    },

    /**
     * Get an artist as a normalized Artist model
     * @param {string} id - Artist ID
     * @returns {Artist|null}
     */
    async getArtistModel(id) {
        await loadModels();

        if (this._models.artists.has(id)) {
            return this._models.artists.get(id);
        }

        const legacyArtist = this.followedArtists.find(a =>
            a.artistId === id || a.id === id || `spotify:${a.artistId}` === id
        );

        if (legacyArtist) {
            const artist = SpotifyAdapter.fromLegacyFollowedArtist(legacyArtist);
            this._models.artists.set(id, artist);
            return artist;
        }

        return null;
    },

    /**
     * Cache a Track model
     */
    cacheTrack(track) {
        if (track && track.id) {
            this._models.tracks.set(track.id, track);
            if (track.externalIds?.spotify) {
                this._models.tracks.set(track.externalIds.spotify, track);
            }
        }
    },

    /**
     * Cache an Artist model
     */
    cacheArtist(artist) {
        if (artist && artist.id) {
            this._models.artists.set(artist.id, artist);
            if (artist.externalIds?.spotify) {
                this._models.artists.set(artist.externalIds.spotify, artist);
            }
        }
    },

    /**
     * Get all liked tracks as Track models
     */
    async getLikedTrackModels() {
        await loadModels();
        return this.likedTracks.map(t => SpotifyAdapter.fromLegacyLikedTrack(t));
    },

    /**
     * Get all followed artists as Artist models
     */
    async getFollowedArtistModels() {
        await loadModels();
        return this.followedArtists.map(a => SpotifyAdapter.fromLegacyFollowedArtist(a));
    },

    /**
     * Check if a track is liked (supports both ID formats)
     */
    isTrackLiked(trackId) {
        return this.likedTracks.some(t =>
            t.trackId === trackId ||
            t.id === trackId ||
            t.spotifyId === trackId
        );
    },

    /**
     * Check if an artist is followed (supports both ID formats)
     */
    isArtistFollowed(artistId) {
        return this.followedArtists.some(a =>
            a.artistId === artistId ||
            a.id === artistId ||
            a.spotifyId === artistId
        );
    },

    /**
     * Get track rating
     */
    getTrackRating(trackId) {
        const rating = this.userRatings.find(r => r.trackId === trackId);
        return rating ? rating.rating : null;
    },

    // ==================== COMPUTED GETTERS ====================

    /**
     * Get library statistics
     */
    getStats() {
        const ratings = this.userRatings.filter(r => r.rating > 0);
        const avgRating = ratings.length > 0
            ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
            : null;

        return {
            totalTracks: this.likedTracks.length,
            totalArtists: this.followedArtists.length,
            totalAlbums: this.albumFollows.length,
            totalPlaylists: this.playlists.length,
            totalRatings: ratings.length,
            averageRating: avgRating
        };
    },

    /**
     * Get recently added tracks (sorted by addedAt)
     */
    getRecentlyAdded(limit = 5) {
        return [...this.likedTracks]
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .slice(0, limit);
    },

    /**
     * Get top rated tracks
     */
    getTopRated(limit = 5) {
        const tracksWithRatings = this.likedTracks
            .map(track => {
                const rating = this.userRatings.find(r => r.trackId === track.trackId);
                return { ...track, rating: rating ? rating.rating : 0 };
            })
            .filter(track => track.rating > 0)
            .sort((a, b) => b.rating - a.rating)
            .slice(0, limit);

        return tracksWithRatings;
    },

    // ==================== PUB/SUB SYSTEM ====================

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
            this._listeners[key].forEach(cb => {
                try {
                    cb(this[key]);
                } catch (e) {
                    console.error(`Error in store listener for ${key}:`, e);
                }
            });
        }
    },

    /**
     * Clear all cached models
     */
    clearCache() {
        this._models.tracks.clear();
        this._models.artists.clear();
        this._models.albums.clear();
        this._models.playlists.clear();
    }
};

// Export for global access during transition
window.store = store;

