/**
 * Playlist Model
 * A source-agnostic playlist representation for the Music Archive
 */

import { TrackSource } from './Track.js';

function generatePlaylistId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `pl_${timestamp}_${random}`;
}

/**
 * Playlist class for user-created or imported playlists
 */
export class Playlist {
    /**
     * @param {Object} data - Playlist data
     */
    constructor(data) {
        this.id = data.id || generatePlaylistId();

        // Core properties
        this.name = data.name || 'Untitled Playlist';
        this.description = data.description || '';
        this.coverImage = data.coverImage || null;
        this.isPublic = data.isPublic ?? true;

        // Source (where it was imported from, if any)
        this.source = data.source || TrackSource.MANUAL;
        this.isUserCreated = data.isUserCreated ?? true;

        // External IDs (for imported playlists)
        this.externalIds = {
            spotify: data.externalIds?.spotify || null,
            youtube: data.externalIds?.youtube || null,
            appleMusic: data.externalIds?.appleMusic || null,
            ...data.externalIds
        };

        // Tracks
        this.tracks = data.tracks || [];

        // Owner info
        this.owner = data.owner || null;
        this.ownerId = data.ownerId || null;

        // Metadata
        this.metadata = {
            totalDuration: data.metadata?.totalDuration || 0,
            followers: data.metadata?.followers || null,
            externalUrl: data.metadata?.externalUrl || null,
            ...data.metadata
        };

        // Timestamps
        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    }

    // ========== GETTERS ==========

    get trackCount() {
        return this.tracks.length;
    }

    get spotifyId() {
        return this.externalIds.spotify;
    }

    get totalDuration() {
        if (this.metadata.totalDuration) return this.metadata.totalDuration;
        return this.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
    }

    get formattedDuration() {
        const total = this.totalDuration;
        const hours = Math.floor(total / 3600000);
        const minutes = Math.floor((total % 3600000) / 60000);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes} min`;
    }

    /**
     * Get cover image - generates mosaic from tracks if no custom cover
     */
    getCoverImages(count = 4) {
        if (this.coverImage) return [this.coverImage];

        const uniqueImages = [];
        for (const track of this.tracks) {
            const img = track.coverArt || track.image;
            if (img && !uniqueImages.includes(img)) {
                uniqueImages.push(img);
                if (uniqueImages.length >= count) break;
            }
        }
        return uniqueImages;
    }

    getExternalUrl(service = null) {
        const targetService = service || this.source;

        switch (targetService) {
            case TrackSource.SPOTIFY:
            case 'spotify':
                return this.externalIds.spotify
                    ? `https://open.spotify.com/playlist/${this.externalIds.spotify}`
                    : null;
            default:
                return this.metadata.externalUrl;
        }
    }

    // ========== MUTATORS ==========

    addTrack(track, position = -1) {
        if (position < 0 || position >= this.tracks.length) {
            this.tracks.push(track);
        } else {
            this.tracks.splice(position, 0, track);
        }
        this.updatedAt = new Date();
        return this;
    }

    removeTrack(trackId) {
        const index = this.tracks.findIndex(t => t.id === trackId);
        if (index !== -1) {
            this.tracks.splice(index, 1);
            this.updatedAt = new Date();
        }
        return this;
    }

    moveTrack(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.tracks.length) return this;
        if (toIndex < 0 || toIndex >= this.tracks.length) return this;

        const [track] = this.tracks.splice(fromIndex, 1);
        this.tracks.splice(toIndex, 0, track);
        this.updatedAt = new Date();
        return this;
    }

    setName(name) {
        this.name = name;
        this.updatedAt = new Date();
        return this;
    }

    setCoverImage(url) {
        this.coverImage = url;
        this.updatedAt = new Date();
        return this;
    }

    // ========== SERIALIZATION ==========

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            coverImage: this.coverImage,
            isPublic: this.isPublic,
            source: this.source,
            isUserCreated: this.isUserCreated,
            externalIds: this.externalIds,
            tracks: this.tracks.map(t => t.toJSON ? t.toJSON() : t),
            owner: this.owner,
            ownerId: this.ownerId,
            metadata: this.metadata,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString()
        };
    }

    static fromJSON(json) {
        return new Playlist(json);
    }

    // ========== FACTORY METHODS ==========

    /**
     * Create Playlist from Spotify API response
     */
    static fromSpotify(spotifyPlaylist, options = {}) {
        const tracks = spotifyPlaylist.tracks?.items?.map(item => {
            // Handle the nested structure of Spotify playlist tracks
            return item.track || item;
        }) || [];

        return new Playlist({
            id: options.preserveId ? `spotify:${spotifyPlaylist.id}` : undefined,
            name: spotifyPlaylist.name,
            description: spotifyPlaylist.description || '',
            coverImage: spotifyPlaylist.images?.[0]?.url || null,
            isPublic: spotifyPlaylist.public ?? true,
            source: TrackSource.SPOTIFY,
            isUserCreated: false,
            externalIds: {
                spotify: spotifyPlaylist.id
            },
            tracks,
            owner: spotifyPlaylist.owner?.display_name || null,
            ownerId: spotifyPlaylist.owner?.id || null,
            metadata: {
                followers: spotifyPlaylist.followers?.total || null,
                externalUrl: spotifyPlaylist.external_urls?.spotify || null
            }
        });
    }

    /**
     * Create Playlist from legacy format
     */
    static fromLegacy(legacyPlaylist) {
        const tracks = (legacyPlaylist.PlaylistTracks || legacyPlaylist.tracks || []).map(t => ({
            id: t.trackId || t.id,
            title: t.trackName || t.name,
            artists: [t.artist],
            album: t.album,
            coverArt: t.image,
            externalIds: { spotify: t.trackId || t.spotifyId },
            metadata: { previewUrl: t.previewUrl }
        }));

        return new Playlist({
            id: legacyPlaylist.id?.toString() || undefined,
            name: legacyPlaylist.name,
            description: legacyPlaylist.description || '',
            coverImage: legacyPlaylist.coverImage || null,
            source: TrackSource.MANUAL,
            isUserCreated: true,
            tracks,
            createdAt: legacyPlaylist.createdAt,
            updatedAt: legacyPlaylist.updatedAt
        });
    }
}

export default Playlist;
