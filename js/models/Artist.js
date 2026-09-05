/**
 * Artist Model
 * A source-agnostic artist representation for the Music Archive
 * 
 * This model normalizes artist data from various sources (Spotify, Local, YouTube, etc.)
 * The internal ID is independent of any external service.
 */

import { TrackSource } from './Track.js';

/**
 * Generate a unique internal ID for artists
 */
function generateArtistId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `art_${timestamp}_${random}`;
}

/**
 * Artist class representing a normalized artist across all sources
 */
export class Artist {
    /**
     * @param {Object} data - Artist data
     * @param {string} [data.id] - Internal ID (auto-generated if not provided)
     * @param {string} data.name - Artist name
     * @param {string} [data.image] - Artist image URL
     * @param {string[]} [data.genres] - Array of genres
     * @param {string} [data.bio] - Artist biography
     * @param {number} [data.followers] - Follower count (from source)
     * @param {number} [data.popularity] - Popularity score (0-100)
     * @param {TrackSource} data.source - Primary source of this artist
     * @param {Object} [data.externalIds] - External service IDs
     * @param {Object} [data.externalUrls] - External URLs for each service
     * @param {Object} [data.userData] - User-specific data
     * @param {Date} [data.addedAt] - When artist was followed
     */
    constructor(data) {
        // Internal ID - NOT tied to any external service
        this.id = data.id || generateArtistId();

        // Core properties
        this.name = data.name || '';
        this.image = data.image || null;
        this.genres = data.genres || [];
        this.bio = data.bio || null;
        this.followers = data.followers || null;
        this.popularity = data.popularity || null;

        // Source information
        this.source = data.source || TrackSource.MANUAL;

        // External IDs - allows linking to multiple services
        this.externalIds = {
            spotify: data.externalIds?.spotify || null,
            youtube: data.externalIds?.youtube || null,
            soundcloud: data.externalIds?.soundcloud || null,
            appleMusic: data.externalIds?.appleMusic || null,
            musicbrainz: data.externalIds?.musicbrainz || null,
            ...data.externalIds
        };

        // External URLs
        this.externalUrls = {
            spotify: data.externalUrls?.spotify || null,
            youtube: data.externalUrls?.youtube || null,
            wikipedia: data.externalUrls?.wikipedia || null,
            appleMusic: data.externalUrls?.appleMusic || null,
            official: data.externalUrls?.official || null,
            ...data.externalUrls
        };

        // User-specific data
        this.userData = {
            followed: data.userData?.followed || false,
            followedAt: data.userData?.followedAt || null,
            note: data.userData?.note || null,
            customTags: data.userData?.customTags || [],
            ...data.userData
        };

        // Discography tracking (for "completionist" feature)
        this.discography = {
            totalAlbums: data.discography?.totalAlbums || null,
            ownedAlbums: data.discography?.ownedAlbums || 0,
            totalTracks: data.discography?.totalTracks || null,
            ownedTracks: data.discography?.ownedTracks || 0,
            ...data.discography
        };

        // Timestamps
        this.addedAt = data.addedAt ? new Date(data.addedAt) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    }

    // ========== GETTERS ==========

    /**
     * Get the primary external ID based on source
     */
    get primaryExternalId() {
        return this.externalIds[this.source] || null;
    }

    /**
     * Get Spotify ID if available
     */
    get spotifyId() {
        return this.externalIds.spotify;
    }

    /**
     * Check if artist is followed by user
     */
    get isFollowed() {
        return this.userData.followed;
    }

    /**
     * Get formatted genres string
     */
    get genreString() {
        return this.genres.slice(0, 3).join(', ');
    }

    /**
     * Get discography completion percentage
     */
    get completionPercentage() {
        if (!this.discography.totalAlbums) return null;
        return Math.round((this.discography.ownedAlbums / this.discography.totalAlbums) * 100);
    }

    /**
     * Get track completion percentage
     */
    get trackCompletionPercentage() {
        if (!this.discography.totalTracks) return null;
        return Math.round((this.discography.ownedTracks / this.discography.totalTracks) * 100);
    }

    // ========== URL GENERATORS ==========

    /**
     * Get external URL for a specific service
     */
    getExternalUrl(service = null) {
        const targetService = service || this.source;

        // First check if we have a stored URL
        if (this.externalUrls[targetService]) {
            return this.externalUrls[targetService];
        }

        // Generate URL from ID
        switch (targetService) {
            case TrackSource.SPOTIFY:
            case 'spotify':
                return this.externalIds.spotify
                    ? `https://open.spotify.com/artist/${this.externalIds.spotify}`
                    : null;
            case TrackSource.YOUTUBE:
            case 'youtube':
                return this.externalIds.youtube
                    ? `https://youtube.com/channel/${this.externalIds.youtube}`
                    : this.youtubeSearchUrl;
            case TrackSource.APPLE_MUSIC:
            case 'appleMusic':
                return this.externalIds.appleMusic
                    ? `https://music.apple.com/artist/${this.externalIds.appleMusic}`
                    : `https://music.apple.com/search?term=${encodeURIComponent(this.name)}`;
            default:
                return null;
        }
    }

    /**
     * Get YouTube search URL for this artist
     */
    get youtubeSearchUrl() {
        return `https://www.youtube.com/results?search_query=${encodeURIComponent(this.name)}`;
    }

    /**
     * Get Wikipedia URL for this artist
     */
    get wikipediaUrl() {
        if (this.externalUrls.wikipedia) return this.externalUrls.wikipedia;
        const encodedName = encodeURIComponent(this.name.replace(/\s+/g, '_'));
        return `https://en.wikipedia.org/wiki/${encodedName}`;
    }

    // ========== MUTATORS ==========

    /**
     * Toggle followed status
     */
    toggleFollow() {
        this.userData.followed = !this.userData.followed;
        this.userData.followedAt = this.userData.followed ? new Date() : null;
        this.updatedAt = new Date();
        return this;
    }

    /**
     * Set artist as followed
     */
    follow() {
        if (!this.userData.followed) {
            this.userData.followed = true;
            this.userData.followedAt = new Date();
            this.updatedAt = new Date();
        }
        return this;
    }

    /**
     * Unfollow artist
     */
    unfollow() {
        this.userData.followed = false;
        this.userData.followedAt = null;
        this.updatedAt = new Date();
        return this;
    }

    /**
     * Update discography stats
     */
    updateDiscography(stats) {
        this.discography = { ...this.discography, ...stats };
        this.updatedAt = new Date();
        return this;
    }

    /**
     * Set user note
     */
    setNote(note) {
        this.userData.note = note;
        this.updatedAt = new Date();
        return this;
    }

    // ========== SERIALIZATION ==========

    /**
     * Convert to plain object for storage/API
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            image: this.image,
            genres: this.genres,
            bio: this.bio,
            followers: this.followers,
            popularity: this.popularity,
            source: this.source,
            externalIds: this.externalIds,
            externalUrls: this.externalUrls,
            userData: {
                ...this.userData,
                followedAt: this.userData.followedAt?.toISOString() || null
            },
            discography: this.discography,
            addedAt: this.addedAt.toISOString(),
            updatedAt: this.updatedAt.toISOString()
        };
    }

    /**
     * Create Artist from plain object
     */
    static fromJSON(json) {
        return new Artist(json);
    }

    /**
     * Create a copy of this artist
     */
    clone() {
        return new Artist(this.toJSON());
    }

    // ========== FACTORY METHODS ==========

    /**
     * Create Artist from Spotify API response
     * @param {Object} spotifyArtist - Raw Spotify artist object
     * @param {Object} [options] - Additional options
     */
    static fromSpotify(spotifyArtist, options = {}) {
        return new Artist({
            id: options.preserveId ? `spotify:${spotifyArtist.id}` : undefined,
            name: spotifyArtist.name,
            image: spotifyArtist.images?.[0]?.url || null,
            genres: spotifyArtist.genres || [],
            followers: spotifyArtist.followers?.total || null,
            popularity: spotifyArtist.popularity || null,
            source: TrackSource.SPOTIFY,
            externalIds: {
                spotify: spotifyArtist.id
            },
            externalUrls: {
                spotify: spotifyArtist.external_urls?.spotify || null
            },
            userData: options.userData || {},
            addedAt: options.addedAt || new Date()
        });
    }

    /**
     * Create Artist from legacy followed artist format (backward compatibility)
     */
    static fromLegacy(legacyArtist) {
        return new Artist({
            id: legacyArtist.id || undefined,
            name: legacyArtist.artistName || legacyArtist.name || '',
            image: legacyArtist.image || null,
            genres: legacyArtist.genres || [],
            source: TrackSource.SPOTIFY,
            externalIds: {
                spotify: legacyArtist.artistId || legacyArtist.spotifyId || null
            },
            externalUrls: {
                spotify: legacyArtist.spotifyUrl || null,
                wikipedia: legacyArtist.links?.wikipedia || null,
                youtube: legacyArtist.links?.youtube || null
            },
            userData: {
                followed: true
            },
            addedAt: legacyArtist.createdAt || legacyArtist.addedAt || new Date()
        });
    }

    /**
     * Create Artist from local/manual data
     */
    static fromManual(data) {
        return new Artist({
            name: data.name,
            image: data.image || null,
            genres: data.genres || [],
            bio: data.bio || null,
            source: TrackSource.MANUAL,
            externalIds: {},
            externalUrls: {
                wikipedia: data.wikipedia || null,
                youtube: data.youtube || null,
                official: data.website || null
            }
        });
    }
}

export default Artist;
