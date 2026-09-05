/**
 * Central Store
 * Manages application state with reactive updates
 * 
 * This is the single source of truth for the application.
 * All state mutations should go through this store.
 */

import { Track } from '../models/Track.js';
import { Artist } from '../models/Artist.js';
import { Album } from '../models/Album.js';
import { Playlist } from '../models/Playlist.js';
import { SpotifyAdapter } from '../adapters/SpotifyAdapter.js';

/**
 * Store class - Singleton pattern for global state management
 */
class Store {
    constructor() {
        // Single instance check
        if (Store.instance) {
            return Store.instance;
        }
        Store.instance = this;

        // State
        this.state = {
            // User authentication
            user: {
                isAuthenticated: false,
                username: null,
                token: null
            },

            // Library data (normalized models)
            library: {
                likedTracks: [],      // Track[]
                followedArtists: [],   // Artist[]
                savedAlbums: [],       // Album[]
                playlists: [],         // Playlist[]
                ratings: new Map()     // Map<trackId, rating>
            },

            // Current playback
            player: {
                currentTrack: null,    // Track | null
                isPlaying: false,
                progress: 0,           // 0-100
                duration: 0,
                volume: 1
            },

            // Search state
            search: {
                query: '',
                type: 'artist',        // 'artist' | 'track' | 'album'
                results: [],           // Track[] | Artist[] | Album[]
                history: [],
                isLoading: false
            },

            // UI state
            ui: {
                theme: 'dark',
                language: 'tr',
                currentView: 'dashboard',
                isLoading: false,
                toast: null
            }
        };

        // Subscribers for reactive updates
        this.subscribers = new Map();
        this.subscriberId = 0;

        // Initialize from localStorage
        this._initFromStorage();
    }

    // ==================== INITIALIZATION ====================

    /**
     * Initialize state from localStorage
     */
    _initFromStorage() {
        try {
            // Auth
            const username = localStorage.getItem('userUsername');
            const token = localStorage.getItem('userToken');
            if (username && token) {
                this.state.user = {
                    isAuthenticated: true,
                    username,
                    token
                };
            }

            // UI preferences
            this.state.ui.theme = localStorage.getItem('theme') || 'dark';
            this.state.ui.language = localStorage.getItem('lang') || 'tr';

            // Search history
            const searchHistory = localStorage.getItem('searchHistory');
            if (searchHistory) {
                this.state.search.history = JSON.parse(searchHistory);
            }
        } catch (e) {
            console.error('Error initializing store from storage:', e);
        }
    }

    // ==================== STATE ACCESS ====================

    /**
     * Get current state (read-only copy)
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Get a specific slice of state
     */
    get(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.state);
    }

    // ==================== SUBSCRIPTIONS ====================

    /**
     * Subscribe to state changes
     * @param {string} path - Dot-notation path to watch (e.g., 'library.likedTracks')
     * @param {Function} callback - Function to call when state changes
     * @returns {Function} - Unsubscribe function
     */
    subscribe(path, callback) {
        const id = ++this.subscriberId;

        if (!this.subscribers.has(path)) {
            this.subscribers.set(path, new Map());
        }

        this.subscribers.get(path).set(id, callback);

        // Return unsubscribe function
        return () => {
            this.subscribers.get(path)?.delete(id);
        };
    }

    /**
     * Notify subscribers of state change
     */
    _notify(path, newValue) {
        // Notify exact path subscribers
        this.subscribers.get(path)?.forEach(callback => {
            try {
                callback(newValue);
            } catch (e) {
                console.error('Error in store subscriber:', e);
            }
        });

        // Notify parent path subscribers
        const parts = path.split('.');
        while (parts.length > 1) {
            parts.pop();
            const parentPath = parts.join('.');
            const parentValue = this.get(parentPath);
            this.subscribers.get(parentPath)?.forEach(callback => {
                try {
                    callback(parentValue);
                } catch (e) {
                    console.error('Error in store subscriber:', e);
                }
            });
        }
    }

    // ==================== USER ACTIONS ====================

    /**
     * Set user authentication state
     */
    setUser(username, token) {
        this.state.user = {
            isAuthenticated: true,
            username,
            token
        };
        localStorage.setItem('userUsername', username);
        localStorage.setItem('userToken', token);
        this._notify('user', this.state.user);
    }

    /**
     * Clear user authentication
     */
    logout() {
        this.state.user = {
            isAuthenticated: false,
            username: null,
            token: null
        };
        localStorage.removeItem('userUsername');
        localStorage.removeItem('userToken');
        this._notify('user', this.state.user);

        // Clear library data
        this.state.library = {
            likedTracks: [],
            followedArtists: [],
            savedAlbums: [],
            playlists: [],
            ratings: new Map()
        };
        this._notify('library', this.state.library);
    }

    // ==================== LIBRARY ACTIONS ====================

    /**
     * Load user library data from API response
     * Converts legacy data to normalized models
     */
    loadLibraryData(apiResponse) {
        // Convert liked tracks
        if (apiResponse.likes) {
            this.state.library.likedTracks = apiResponse.likes.map(t =>
                SpotifyAdapter.fromLegacyLikedTrack(t)
            );
        }

        // Convert followed artists
        if (apiResponse.follows) {
            this.state.library.followedArtists = apiResponse.follows.map(a =>
                SpotifyAdapter.fromLegacyFollowedArtist(a)
            );
        }

        // Convert saved albums
        if (apiResponse.albumFollows) {
            this.state.library.savedAlbums = apiResponse.albumFollows.map(a =>
                SpotifyAdapter.fromLegacyFollowedAlbum(a)
            );
        }

        // Load ratings into map
        if (apiResponse.ratings) {
            apiResponse.ratings.forEach(r => {
                this.state.library.ratings.set(r.trackId, r.rating);
            });

            // Apply ratings to liked tracks
            this.state.library.likedTracks.forEach(track => {
                const spotifyId = track.externalIds.spotify;
                if (spotifyId && this.state.library.ratings.has(spotifyId)) {
                    track.userData.rating = this.state.library.ratings.get(spotifyId);
                }
            });
        }

        this._notify('library', this.state.library);
        this._notify('library.likedTracks', this.state.library.likedTracks);
        this._notify('library.followedArtists', this.state.library.followedArtists);
    }

    /**
     * Load playlists from API response
     */
    loadPlaylists(playlistsData) {
        this.state.library.playlists = playlistsData.map(p =>
            Playlist.fromLegacy(p)
        );
        this._notify('library.playlists', this.state.library.playlists);
    }

    /**
     * Add a liked track
     */
    addLikedTrack(track) {
        // Ensure it's a Track instance
        const trackModel = track instanceof Track ? track : new Track(track);
        trackModel.userData.liked = true;

        // Check if already exists
        const existingIndex = this.state.library.likedTracks.findIndex(
            t => t.externalIds.spotify === trackModel.externalIds.spotify
        );

        if (existingIndex === -1) {
            this.state.library.likedTracks.unshift(trackModel);
            this._notify('library.likedTracks', this.state.library.likedTracks);
        }

        return trackModel;
    }

    /**
     * Remove a liked track
     */
    removeLikedTrack(trackId) {
        const index = this.state.library.likedTracks.findIndex(t =>
            t.id === trackId || t.externalIds.spotify === trackId
        );

        if (index !== -1) {
            this.state.library.likedTracks.splice(index, 1);
            this._notify('library.likedTracks', this.state.library.likedTracks);
            return true;
        }
        return false;
    }

    /**
     * Check if a track is liked
     */
    isTrackLiked(trackId) {
        return this.state.library.likedTracks.some(t =>
            t.id === trackId || t.externalIds.spotify === trackId
        );
    }

    /**
     * Add a followed artist
     */
    addFollowedArtist(artist) {
        const artistModel = artist instanceof Artist ? artist : new Artist(artist);
        artistModel.userData.followed = true;
        artistModel.userData.followedAt = new Date();

        const existingIndex = this.state.library.followedArtists.findIndex(
            a => a.externalIds.spotify === artistModel.externalIds.spotify
        );

        if (existingIndex === -1) {
            this.state.library.followedArtists.push(artistModel);
            this._notify('library.followedArtists', this.state.library.followedArtists);
        }

        return artistModel;
    }

    /**
     * Remove a followed artist
     */
    removeFollowedArtist(artistId) {
        const index = this.state.library.followedArtists.findIndex(a =>
            a.id === artistId || a.externalIds.spotify === artistId
        );

        if (index !== -1) {
            this.state.library.followedArtists.splice(index, 1);
            this._notify('library.followedArtists', this.state.library.followedArtists);
            return true;
        }
        return false;
    }

    /**
     * Check if an artist is followed
     */
    isArtistFollowed(artistId) {
        return this.state.library.followedArtists.some(a =>
            a.id === artistId || a.externalIds.spotify === artistId
        );
    }

    /**
     * Set track rating
     */
    setTrackRating(trackId, rating) {
        this.state.library.ratings.set(trackId, rating);

        // Update the track in likedTracks if it exists
        const track = this.state.library.likedTracks.find(t =>
            t.externalIds.spotify === trackId || t.id === trackId
        );
        if (track) {
            track.setRating(rating);
        }

        this._notify('library.ratings', this.state.library.ratings);
        return rating;
    }

    /**
     * Get track rating
     */
    getTrackRating(trackId) {
        return this.state.library.ratings.get(trackId) || null;
    }

    // ==================== PLAYLIST ACTIONS ====================

    /**
     * Add a new playlist
     */
    addPlaylist(playlist) {
        const playlistModel = playlist instanceof Playlist ? playlist : new Playlist(playlist);
        this.state.library.playlists.push(playlistModel);
        this._notify('library.playlists', this.state.library.playlists);
        return playlistModel;
    }

    /**
     * Remove a playlist
     */
    removePlaylist(playlistId) {
        const index = this.state.library.playlists.findIndex(p => p.id === playlistId);
        if (index !== -1) {
            this.state.library.playlists.splice(index, 1);
            this._notify('library.playlists', this.state.library.playlists);
            return true;
        }
        return false;
    }

    /**
     * Add track to playlist
     */
    addTrackToPlaylist(playlistId, track) {
        const playlist = this.state.library.playlists.find(p =>
            p.id === playlistId || p.id?.toString() === playlistId?.toString()
        );

        if (playlist) {
            const trackModel = track instanceof Track ? track : new Track(track);
            playlist.addTrack(trackModel);
            this._notify('library.playlists', this.state.library.playlists);
            return true;
        }
        return false;
    }

    // ==================== PLAYER ACTIONS ====================

    /**
     * Set current playing track
     */
    setCurrentTrack(track) {
        this.state.player.currentTrack = track instanceof Track ? track : new Track(track);
        this.state.player.progress = 0;
        this._notify('player', this.state.player);
        this._notify('player.currentTrack', this.state.player.currentTrack);
    }

    /**
     * Update playback state
     */
    setPlaybackState(isPlaying) {
        this.state.player.isPlaying = isPlaying;
        this._notify('player', this.state.player);
    }

    /**
     * Update playback progress
     */
    setProgress(progress, duration) {
        this.state.player.progress = progress;
        if (duration !== undefined) {
            this.state.player.duration = duration;
        }
        // Don't notify on progress to avoid performance issues
        // Use direct access for progress updates
    }

    /**
     * Clear current track
     */
    clearPlayer() {
        this.state.player = {
            currentTrack: null,
            isPlaying: false,
            progress: 0,
            duration: 0,
            volume: this.state.player.volume
        };
        this._notify('player', this.state.player);
    }

    // ==================== SEARCH ACTIONS ====================

    /**
     * Set search results
     */
    setSearchResults(results, type) {
        this.state.search.results = results;
        this.state.search.type = type;
        this.state.search.isLoading = false;
        this._notify('search', this.state.search);
    }

    /**
     * Add to search history
     */
    addToSearchHistory(query) {
        if (!query || !query.trim()) return;

        // Remove duplicates and add to front
        this.state.search.history = [
            query,
            ...this.state.search.history.filter(q =>
                q.toLowerCase() !== query.toLowerCase()
            )
        ].slice(0, 10);

        localStorage.setItem('searchHistory', JSON.stringify(this.state.search.history));
        this._notify('search.history', this.state.search.history);
    }

    /**
     * Clear search history
     */
    clearSearchHistory() {
        this.state.search.history = [];
        localStorage.removeItem('searchHistory');
        this._notify('search.history', this.state.search.history);
    }

    // ==================== UI ACTIONS ====================

    /**
     * Set UI theme
     */
    setTheme(theme) {
        this.state.ui.theme = theme;
        localStorage.setItem('theme', theme);
        this._notify('ui.theme', theme);
    }

    /**
     * Set UI language
     */
    setLanguage(language) {
        this.state.ui.language = language;
        localStorage.setItem('lang', language);
        this._notify('ui.language', language);
    }

    /**
     * Set current view
     */
    setCurrentView(view) {
        this.state.ui.currentView = view;
        this._notify('ui.currentView', view);
    }

    /**
     * Set loading state
     */
    setLoading(isLoading) {
        this.state.ui.isLoading = isLoading;
        this._notify('ui.isLoading', isLoading);
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = 3000) {
        this.state.ui.toast = { message, type, duration };
        this._notify('ui.toast', this.state.ui.toast);

        // Auto-clear toast
        setTimeout(() => {
            if (this.state.ui.toast?.message === message) {
                this.state.ui.toast = null;
                this._notify('ui.toast', null);
            }
        }, duration);
    }

    // ==================== COMPUTED GETTERS ====================

    /**
     * Get library statistics
     */
    getStats() {
        return {
            totalTracks: this.state.library.likedTracks.length,
            totalArtists: this.state.library.followedArtists.length,
            totalAlbums: this.state.library.savedAlbums.length,
            totalPlaylists: this.state.library.playlists.length,
            averageRating: this._calculateAverageRating()
        };
    }

    _calculateAverageRating() {
        const ratings = Array.from(this.state.library.ratings.values()).filter(r => r > 0);
        if (ratings.length === 0) return null;
        const sum = ratings.reduce((acc, r) => acc + r, 0);
        return (sum / ratings.length).toFixed(1);
    }

    /**
     * Get recently added tracks
     */
    getRecentlyAdded(limit = 5) {
        return [...this.state.library.likedTracks]
            .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
            .slice(0, limit);
    }

    /**
     * Get top rated tracks
     */
    getTopRated(limit = 5) {
        return [...this.state.library.likedTracks]
            .filter(t => t.userData.rating > 0)
            .sort((a, b) => b.userData.rating - a.userData.rating)
            .slice(0, limit);
    }

    /**
     * Search within library
     */
    searchLibrary(query) {
        const lowerQuery = query.toLowerCase();

        return {
            tracks: this.state.library.likedTracks.filter(t =>
                t.title.toLowerCase().includes(lowerQuery) ||
                t.artistString.toLowerCase().includes(lowerQuery)
            ),
            artists: this.state.library.followedArtists.filter(a =>
                a.name.toLowerCase().includes(lowerQuery)
            ),
            playlists: this.state.library.playlists.filter(p =>
                p.name.toLowerCase().includes(lowerQuery)
            )
        };
    }
}

// Export singleton instance
export const store = new Store();
export default store;
