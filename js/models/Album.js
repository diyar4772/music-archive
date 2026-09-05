/**
 * Album Model
 * A source-agnostic album representation for the Music Archive
 */

import { TrackSource } from './Track.js';

/**
 * Generate a unique internal ID for albums
 */
function generateAlbumId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `alb_${timestamp}_${random}`;
}

/**
 * Album types enum
 */
export const AlbumType = {
    ALBUM: 'album',
    SINGLE: 'single',
    EP: 'ep',
    COMPILATION: 'compilation',
    APPEARS_ON: 'appears_on'
};

/**
 * Album class representing a normalized album across all sources
 */
export class Album {
    /**
     * @param {Object} data - Album data
     */
    constructor(data) {
        // Internal ID - NOT tied to any external service
        this.id = data.id || generateAlbumId();

        // Core properties
        this.name = data.name || '';
        this.artists = Array.isArray(data.artists) ? data.artists : [data.artists].filter(Boolean);
        this.artistIds = data.artistIds || [];
        this.type = data.type || AlbumType.ALBUM;
        this.releaseDate = data.releaseDate || null;
        this.releaseYear = data.releaseYear || (data.releaseDate ? new Date(data.releaseDate).getFullYear() : null);
        this.totalTracks = data.totalTracks || 0;
        this.coverArt = data.coverArt || null;
        this.coverArtLarge = data.coverArtLarge || data.coverArt || null;

        // Source information
        this.source = data.source || TrackSource.MANUAL;

        // External IDs
        this.externalIds = {
            spotify: data.externalIds?.spotify || null,
            youtube: data.externalIds?.youtube || null,
            appleMusic: data.externalIds?.appleMusic || null,
            upc: data.externalIds?.upc || null, // Universal Product Code
            ...data.externalIds
        };

        // Tracks (can be lazy-loaded)
        this.tracks = data.tracks || [];
        this.tracksLoaded = data.tracksLoaded || false;

        // Metadata
        this.metadata = {
            label: data.metadata?.label || null,
            copyrights: data.metadata?.copyrights || [],
            genres: data.metadata?.genres || [],
            popularity: data.metadata?.popularity || null,
            externalUrl: data.metadata?.externalUrl || null,
            ...data.metadata
        };

        // User data
        this.userData = {
            saved: data.userData?.saved || false,
            savedAt: data.userData?.savedAt || null,
            rating: data.userData?.rating || null,
            note: data.userData?.note || null,
            ...data.userData
        };

        // Timestamps
        this.addedAt = data.addedAt ? new Date(data.addedAt) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    }

    // ========== GETTERS ==========

    get artistString() {
        return this.artists.join(', ');
    }

    get spotifyId() {
        return this.externalIds.spotify;
    }

    get isSaved() {
        return this.userData.saved;
    }

    get formattedReleaseDate() {
        if (!this.releaseDate) return '';
        try {
            return new Date(this.releaseDate).toLocaleDateString();
        } catch {
            return this.releaseDate;
        }
    }

    /**
     * Get external URL for a specific service
     */
    getExternalUrl(service = null) {
        const targetService = service || this.source;

        switch (targetService) {
            case TrackSource.SPOTIFY:
            case 'spotify':
                return this.externalIds.spotify
                    ? `https://open.spotify.com/album/${this.externalIds.spotify}`
                    : null;
            case TrackSource.APPLE_MUSIC:
            case 'appleMusic':
                return this.externalIds.appleMusic
                    ? `https://music.apple.com/album/${this.externalIds.appleMusic}`
                    : null;
            default:
                return this.metadata.externalUrl;
        }
    }

    // ========== MUTATORS ==========

    toggleSave() {
        this.userData.saved = !this.userData.saved;
        this.userData.savedAt = this.userData.saved ? new Date() : null;
        this.updatedAt = new Date();
        return this;
    }

    setTracks(tracks) {
        this.tracks = tracks;
        this.tracksLoaded = true;
        this.updatedAt = new Date();
        return this;
    }

    // ========== SERIALIZATION ==========

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            artists: this.artists,
            artistIds: this.artistIds,
            type: this.type,
            releaseDate: this.releaseDate,
            releaseYear: this.releaseYear,
            totalTracks: this.totalTracks,
            coverArt: this.coverArt,
            coverArtLarge: this.coverArtLarge,
            source: this.source,
            externalIds: this.externalIds,
            tracks: this.tracks.map(t => t.toJSON ? t.toJSON() : t),
            tracksLoaded: this.tracksLoaded,
            metadata: this.metadata,
            userData: this.userData,
            addedAt: this.addedAt.toISOString(),
            updatedAt: this.updatedAt.toISOString()
        };
    }

    static fromJSON(json) {
        return new Album(json);
    }

    // ========== FACTORY METHODS ==========

    /**
     * Create Album from Spotify API response
     */
    static fromSpotify(spotifyAlbum, options = {}) {
        const artists = spotifyAlbum.artists?.map(a => a.name) || [];
        const artistIds = spotifyAlbum.artists?.map(a => a.id) || [];

        return new Album({
            id: options.preserveId ? `spotify:${spotifyAlbum.id}` : undefined,
            name: spotifyAlbum.name,
            artists: artists,
            artistIds: artistIds.map(id => `spotify:${id}`),
            type: spotifyAlbum.album_type || AlbumType.ALBUM,
            releaseDate: spotifyAlbum.release_date || null,
            totalTracks: spotifyAlbum.total_tracks || 0,
            coverArt: spotifyAlbum.images?.[1]?.url || spotifyAlbum.images?.[0]?.url || null,
            coverArtLarge: spotifyAlbum.images?.[0]?.url || null,
            source: TrackSource.SPOTIFY,
            externalIds: {
                spotify: spotifyAlbum.id,
                upc: spotifyAlbum.external_ids?.upc || null
            },
            metadata: {
                label: spotifyAlbum.label || null,
                copyrights: spotifyAlbum.copyrights || [],
                genres: spotifyAlbum.genres || [],
                popularity: spotifyAlbum.popularity || null,
                externalUrl: spotifyAlbum.external_urls?.spotify || null
            },
            userData: options.userData || {}
        });
    }

    /**
     * Create Album from legacy format
     */
    static fromLegacy(legacyAlbum) {
        return new Album({
            name: legacyAlbum.albumName || legacyAlbum.name || '',
            artists: [legacyAlbum.artistName || legacyAlbum.artist || ''],
            releaseDate: legacyAlbum.releaseDate || null,
            releaseYear: legacyAlbum.year || null,
            coverArt: legacyAlbum.image || legacyAlbum.coverArt || null,
            source: TrackSource.SPOTIFY,
            externalIds: {
                spotify: legacyAlbum.albumId || legacyAlbum.id || null
            },
            userData: {
                saved: true
            }
        });
    }
}

export default Album;
