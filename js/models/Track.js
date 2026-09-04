/**
 * Track Model
 * A source-agnostic track representation for the Music Archive
 * 
 * This model normalizes track data from various sources (Spotify, Local, YouTube, etc.)
 * The internal ID is independent of any external service.
 * 
 * @example
 * // Creating from Spotify data
 * const track = Track.fromSpotify(spotifyTrackData);
 * 
 * // Creating from local file
 * const track = Track.fromLocal(fileMetadata);
 */

// Source types enum
export const TrackSource = {
    SPOTIFY: 'spotify',
    LOCAL: 'local',
    YOUTUBE: 'youtube',
    SOUNDCLOUD: 'soundcloud',
    APPLE_MUSIC: 'apple_music',
    MANUAL: 'manual'
};

/**
 * Generate a unique internal ID
 * Uses a combination of timestamp and random string
 */
function generateInternalId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `trk_${timestamp}_${random}`;
}

/**
 * Track class representing a normalized track across all sources
 */
export class Track {
    /**
     * @param {Object} data - Track data
     * @param {string} [data.id] - Internal ID (auto-generated if not provided)
     * @param {string} data.title - Track title
     * @param {string|string[]} data.artists - Artist name(s)
     * @param {string} [data.album] - Album name
     * @param {string} [data.albumId] - Internal album ID
     * @param {number} [data.duration] - Duration in milliseconds
     * @param {number} [data.trackNumber] - Track number in album
     * @param {number} [data.discNumber] - Disc number in album
     * @param {string} [data.coverArt] - Cover art URL
     * @param {TrackSource} data.source - Primary source of this track
     * @param {Object} [data.externalIds] - External service IDs
     * @param {Object} [data.metadata] - Additional metadata
     * @param {Object} [data.userData] - User-specific data (rating, notes, etc.)
     * @param {Date} [data.addedAt] - When track was added to library
     */
    constructor(data) {
        // Internal ID - NOT tied to any external service
        this.id = data.id || generateInternalId();

        // Core properties
        this.title = data.title || '';
        this.artists = Array.isArray(data.artists) ? data.artists : [data.artists].filter(Boolean);
        this.album = data.album || null;
        this.albumId = data.albumId || null;
        this.duration = data.duration || 0;
        this.trackNumber = data.trackNumber || null;
        this.discNumber = data.discNumber || 1;
        this.coverArt = data.coverArt || null;

        // Source information
        this.source = data.source || TrackSource.MANUAL;

        // External IDs - allows linking to multiple services
        // These are REFERENCES, not primary identifiers
        this.externalIds = {
            spotify: data.externalIds?.spotify || null,
            youtube: data.externalIds?.youtube || null,
            soundcloud: data.externalIds?.soundcloud || null,
            appleMusic: data.externalIds?.appleMusic || null,
            isrc: data.externalIds?.isrc || null, // International Standard Recording Code
            ...data.externalIds
        };

        // Source-specific metadata
        this.metadata = {
            previewUrl: data.metadata?.previewUrl || null,
            previewSource: data.metadata?.previewSource || null, // 'spotify' | 'itunes' | 'local' - where preview comes from
            explicit: data.metadata?.explicit || false,
            popularity: data.metadata?.popularity || null,
            releaseDate: data.metadata?.releaseDate || null,
            externalUrl: data.metadata?.externalUrl || null, // Direct link to source
            localPath: data.metadata?.localPath || null, // For local files
            genres: data.metadata?.genres || [],
            ...data.metadata
        };

        // User-specific data
        this.userData = {
            rating: data.userData?.rating || null, // 0-5, supports half stars
            note: data.userData?.note || null,
            playCount: data.userData?.playCount || 0,
            lastPlayed: data.userData?.lastPlayed || null,
            liked: data.userData?.liked || false,
            ...data.userData
        };

        // Timestamps
        this.addedAt = data.addedAt ? new Date(data.addedAt) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    }

    // ========== GETTERS ==========

    /**
     * Get formatted artist string
     */
    get artistString() {
        return this.artists.join(', ');
    }

    /**
     * Get formatted duration (mm:ss)
     */
    get formattedDuration() {
        if (!this.duration) return '--:--';
        const minutes = Math.floor(this.duration / 60000);
        const seconds = Math.floor((this.duration % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Get the primary external ID based on source
     */
    get primaryExternalId() {
        return this.externalIds[this.source] || null;
    }

    /**
     * Check if track has a playable preview
     */
    get hasPreview() {
        return !!(this.metadata.previewUrl || this.metadata.localPath);
    }

    /**
     * Get the URL for playback (preview or local)
     */
    get playbackUrl() {
        return this.metadata.previewUrl || this.metadata.localPath || null;
    }

    /**
     * Get Spotify ID if available (for API calls)
     */
    get spotifyId() {
        return this.externalIds.spotify;
    }

    /**
     * Check if this track is from a specific source
     */
    isFromSource(source) {
        return this.source === source;
    }

    /**
     * Get external URL for the track
     */
    getExternalUrl(service = null) {
        const targetService = service || this.source;

        switch (targetService) {
            case TrackSource.SPOTIFY:
                return this.externalIds.spotify
                    ? `https://open.spotify.com/track/${this.externalIds.spotify}`
                    : null;
            case TrackSource.YOUTUBE:
                return this.externalIds.youtube
                    ? `https://youtube.com/watch?v=${this.externalIds.youtube}`
                    : null;
            case TrackSource.APPLE_MUSIC:
                return this.externalIds.appleMusic
                    ? `https://music.apple.com/song/${this.externalIds.appleMusic}`
                    : null;
            default:
                return this.metadata.externalUrl;
        }
    }

    /**
     * Get YouTube search URL (for any track)
     */
    get youtubeSearchUrl() {
        const query = encodeURIComponent(`${this.artistString} ${this.title}`);
        return `https://www.youtube.com/results?search_query=${query}`;
    }

    // ========== MUTATORS ==========

    /**
     * Update user rating
     */
    setRating(rating) {
        this.userData.rating = Math.max(0, Math.min(5, rating));
        this.updatedAt = new Date();
        return this;
    }

    /**
     * Update user note
     */
    setNote(note) {
        this.userData.note = note;
        this.updatedAt = new Date();
        return this;
    }

    /**
     * Toggle liked status
     */
    toggleLike() {
        this.userData.liked = !this.userData.liked;
        this.updatedAt = new Date();
        return this;
    }

    /**
     * Record a play
     */
    recordPlay() {
        this.userData.playCount++;
        this.userData.lastPlayed = new Date();
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
            title: this.title,
            artists: this.artists,
            album: this.album,
            albumId: this.albumId,
            duration: this.duration,
            trackNumber: this.trackNumber,
            discNumber: this.discNumber,
            coverArt: this.coverArt,
            source: this.source,
            externalIds: this.externalIds,
            metadata: this.metadata,
            userData: this.userData,
            addedAt: this.addedAt.toISOString(),
            updatedAt: this.updatedAt.toISOString()
        };
    }

    /**
     * Create Track from plain object
     */
    static fromJSON(json) {
        return new Track(json);
    }

    /**
     * Create a copy of this track
     */
    clone() {
        return new Track(this.toJSON());
    }

    // ========== FACTORY METHODS ==========

    /**
     * Create Track from Spotify API response
     * @param {Object} spotifyTrack - Raw Spotify track object
     * @param {Object} [options] - Additional options
     */
    static fromSpotify(spotifyTrack, options = {}) {
        const artists = spotifyTrack.artists?.map(a => a.name) || [];
        const album = spotifyTrack.album;

        return new Track({
            id: options.preserveId ? `spotify:${spotifyTrack.id}` : undefined,
            title: spotifyTrack.name,
            artists: artists,
            album: album?.name || null,
            albumId: album?.id ? `spotify:${album.id}` : null,
            duration: spotifyTrack.duration_ms || 0,
            trackNumber: spotifyTrack.track_number || null,
            discNumber: spotifyTrack.disc_number || 1,
            coverArt: album?.images?.[0]?.url || null,
            source: TrackSource.SPOTIFY,
            externalIds: {
                spotify: spotifyTrack.id,
                isrc: spotifyTrack.external_ids?.isrc || null
            },
            metadata: {
                previewUrl: spotifyTrack.preview_url || null,
                explicit: spotifyTrack.explicit || false,
                popularity: spotifyTrack.popularity || null,
                releaseDate: album?.release_date || null,
                externalUrl: spotifyTrack.external_urls?.spotify || null
            },
            userData: options.userData || {},
            addedAt: options.addedAt || new Date()
        });
    }

    /**
     * Create Track from local file metadata
     * @param {Object} fileMetadata - File metadata object
     */
    static fromLocal(fileMetadata) {
        return new Track({
            title: fileMetadata.title || fileMetadata.filename || 'Unknown Track',
            artists: fileMetadata.artists || [fileMetadata.artist || 'Unknown Artist'],
            album: fileMetadata.album || null,
            duration: fileMetadata.duration || 0,
            trackNumber: fileMetadata.trackNumber || null,
            coverArt: fileMetadata.coverArt || null,
            source: TrackSource.LOCAL,
            externalIds: {},
            metadata: {
                localPath: fileMetadata.path,
                format: fileMetadata.format || null,
                bitrate: fileMetadata.bitrate || null,
                sampleRate: fileMetadata.sampleRate || null
            }
        });
    }

    /**
     * Create Track from legacy liked track format (backward compatibility)
     * This handles the old format stored in the database
     */
    static fromLegacy(legacyTrack) {
        return new Track({
            id: legacyTrack.id || undefined,
            title: legacyTrack.trackName || legacyTrack.name || '',
            artists: [legacyTrack.artist || legacyTrack.artists?.[0]?.name || ''],
            album: legacyTrack.album || legacyTrack.albumName || null,
            coverArt: legacyTrack.image || legacyTrack.albumImage || null,
            source: TrackSource.SPOTIFY, // Legacy data was Spotify-based
            externalIds: {
                spotify: legacyTrack.trackId || legacyTrack.spotifyId || null
            },
            metadata: {
                previewUrl: legacyTrack.previewUrl || legacyTrack.preview_url || null,
                externalUrl: legacyTrack.spotifyUrl || null
            },
            userData: {
                rating: legacyTrack.rating || null,
                note: legacyTrack.note || null,
                liked: true // Legacy liked tracks are... liked
            },
            addedAt: legacyTrack.createdAt || legacyTrack.addedAt || new Date()
        });
    }
}

export default Track;
