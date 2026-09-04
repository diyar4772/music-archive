/**
 * Spotify Adapter
 * Converts raw Spotify API responses into our generic Track/Artist/Album models.
 * 
 * This is the ONLY place where Spotify-specific data transformation should happen.
 * All UI components should consume the normalized models, never raw Spotify data.
 * 
 * DATA SOURCES:
 * =============
 * - Metadata (title, artist, album, cover art): Spotify API
 * - Preview Audio: iTunes API (fallback) - Spotify preview_url is often null
 * 
 * SPOTIFY API COMPLIANCE NOTES:
 * =============================
 * 1. Attribution: When displaying Spotify metadata/cover, must show Spotify branding
 * 2. Metadata: Must accompany with link to Spotify
 * 3. Cover Art: Can resize but not modify content
 * 4. No Caching: Audio content cannot be cached/downloaded (this applies to Spotify audio)
 * 
 * ITUNES PREVIEW NOTES:
 * =====================
 * - iTunes previews are from Apple, not Spotify - different license
 * - No specific attribution required for iTunes previews
 * - Adding Apple Music link is good practice but not required
 * 
 * @see https://developer.spotify.com/policy
 * @see https://affiliate.itunes.apple.com/resources/documentation/itunes-store-web-service-search-api/
 */

import { Track, TrackSource } from '../models/Track.js';
import { Artist } from '../models/Artist.js';
import { Album, AlbumType } from '../models/Album.js';
import { Playlist } from '../models/Playlist.js';

/**
 * SpotifyAdapter class
 * Provides static methods to transform Spotify API responses to our models
 */
export class SpotifyAdapter {

    // ==================== TRACK ADAPTERS ====================

    /**
     * Convert a single Spotify track to our Track model
     * @param {Object} spotifyTrack - Raw Spotify track object
     * @param {Object} [options] - Conversion options
     * @param {Object} [options.userData] - User data to attach
     * @param {boolean} [options.preserveSpotifyId] - Use spotify:id format for internal ID
     * @returns {Track}
     */
    static toTrack(spotifyTrack, options = {}) {
        if (!spotifyTrack) return null;

        const artists = spotifyTrack.artists?.map(a => a.name) || [];
        const album = spotifyTrack.album;

        return new Track({
            // Internal ID - can optionally preserve Spotify ID with prefix
            id: options.preserveSpotifyId ? `spotify:${spotifyTrack.id}` : undefined,

            // Core data
            title: spotifyTrack.name,
            artists: artists,
            album: album?.name || null,
            albumId: album?.id ? `spotify:${album.id}` : null,
            duration: spotifyTrack.duration_ms || 0,
            trackNumber: spotifyTrack.track_number || null,
            discNumber: spotifyTrack.disc_number || 1,

            // Cover art - prefer medium size for performance
            coverArt: this._getBestImage(album?.images, 'medium'),

            // Source identification
            source: TrackSource.SPOTIFY,

            // External references
            externalIds: {
                spotify: spotifyTrack.id,
                isrc: spotifyTrack.external_ids?.isrc || null
            },

            // Spotify-specific metadata
            metadata: {
                previewUrl: spotifyTrack.preview_url || null,
                explicit: spotifyTrack.explicit || false,
                popularity: spotifyTrack.popularity || null,
                releaseDate: album?.release_date || null,
                externalUrl: spotifyTrack.external_urls?.spotify || null,
                // For Spotify compliance - always include link
                attribution: {
                    source: 'Spotify',
                    url: spotifyTrack.external_urls?.spotify || null,
                    logo: 'spotify' // Indicates Spotify branding should be shown
                }
            },

            // User data (if provided)
            userData: options.userData || {},

            // Timestamps
            addedAt: options.addedAt || new Date()
        });
    }

    /**
     * Convert multiple Spotify tracks to Track models
     * @param {Array} spotifyTracks - Array of Spotify track objects
     * @param {Object} [options] - Conversion options
     * @returns {Track[]}
     */
    static toTracks(spotifyTracks, options = {}) {
        if (!Array.isArray(spotifyTracks)) return [];
        return spotifyTracks
            .filter(t => t) // Filter out null/undefined
            .map(track => this.toTrack(track, options));
    }

    /**
     * Convert Spotify search results to Track models
     * @param {Object} searchResponse - Spotify search API response
     * @returns {Track[]}
     */
    static searchResultsToTracks(searchResponse) {
        const items = searchResponse?.tracks?.items || [];
        return this.toTracks(items);
    }

    // ==================== ARTIST ADAPTERS ====================

    /**
     * Convert a Spotify artist to our Artist model
     * @param {Object} spotifyArtist - Raw Spotify artist object
     * @param {Object} [options] - Conversion options
     * @returns {Artist}
     */
    static toArtist(spotifyArtist, options = {}) {
        if (!spotifyArtist) return null;

        return new Artist({
            id: options.preserveSpotifyId ? `spotify:${spotifyArtist.id}` : undefined,
            name: spotifyArtist.name,
            image: this._getBestImage(spotifyArtist.images, 'large'),
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
     * Convert multiple Spotify artists to Artist models
     * @param {Array} spotifyArtists - Array of Spotify artist objects
     * @param {Object} [options] - Conversion options
     * @returns {Artist[]}
     */
    static toArtists(spotifyArtists, options = {}) {
        if (!Array.isArray(spotifyArtists)) return [];
        return spotifyArtists
            .filter(a => a)
            .map(artist => this.toArtist(artist, options));
    }

    /**
     * Convert Spotify artist search results
     * @param {Object} searchResponse - Spotify search API response
     * @returns {Artist[]}
     */
    static searchResultsToArtists(searchResponse) {
        const items = searchResponse?.artists?.items || [];
        return this.toArtists(items);
    }

    // ==================== ALBUM ADAPTERS ====================

    /**
     * Convert a Spotify album to our Album model
     * @param {Object} spotifyAlbum - Raw Spotify album object
     * @param {Object} [options] - Conversion options
     * @returns {Album}
     */
    static toAlbum(spotifyAlbum, options = {}) {
        if (!spotifyAlbum) return null;

        const artists = spotifyAlbum.artists?.map(a => a.name) || [];
        const artistIds = spotifyAlbum.artists?.map(a => `spotify:${a.id}`) || [];

        // Map Spotify album type to our enum
        const albumType = this._mapAlbumType(spotifyAlbum.album_type);

        // Convert tracks if included
        let tracks = [];
        if (spotifyAlbum.tracks?.items) {
            tracks = this.toTracks(spotifyAlbum.tracks.items.map(t => ({
                ...t,
                album: {
                    id: spotifyAlbum.id,
                    name: spotifyAlbum.name,
                    images: spotifyAlbum.images,
                    release_date: spotifyAlbum.release_date
                }
            })));
        }

        return new Album({
            id: options.preserveSpotifyId ? `spotify:${spotifyAlbum.id}` : undefined,
            name: spotifyAlbum.name,
            artists: artists,
            artistIds: artistIds,
            type: albumType,
            releaseDate: spotifyAlbum.release_date || null,
            totalTracks: spotifyAlbum.total_tracks || spotifyAlbum.tracks?.total || 0,
            coverArt: this._getBestImage(spotifyAlbum.images, 'medium'),
            coverArtLarge: this._getBestImage(spotifyAlbum.images, 'large'),
            source: TrackSource.SPOTIFY,
            externalIds: {
                spotify: spotifyAlbum.id,
                upc: spotifyAlbum.external_ids?.upc || null
            },
            tracks: tracks,
            tracksLoaded: tracks.length > 0,
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
     * Convert multiple Spotify albums to Album models
     * @param {Array} spotifyAlbums - Array of Spotify album objects
     * @param {Object} [options] - Conversion options
     * @returns {Album[]}
     */
    static toAlbums(spotifyAlbums, options = {}) {
        if (!Array.isArray(spotifyAlbums)) return [];
        return spotifyAlbums
            .filter(a => a)
            .map(album => this.toAlbum(album, options));
    }

    /**
     * Convert Spotify artist albums response
     * @param {Object} albumsResponse - Spotify artist albums API response
     * @returns {Album[]}
     */
    static artistAlbumsToAlbums(albumsResponse) {
        const items = albumsResponse?.items || albumsResponse || [];
        return this.toAlbums(items);
    }

    // ==================== PLAYLIST ADAPTERS ====================

    /**
     * Convert a Spotify playlist to our Playlist model
     * @param {Object} spotifyPlaylist - Raw Spotify playlist object
     * @param {Object} [options] - Conversion options
     * @returns {Playlist}
     */
    static toPlaylist(spotifyPlaylist, options = {}) {
        if (!spotifyPlaylist) return null;

        // Convert tracks if included
        let tracks = [];
        if (spotifyPlaylist.tracks?.items) {
            tracks = this.toTracks(
                spotifyPlaylist.tracks.items
                    .map(item => item.track)
                    .filter(t => t) // Some items might have null tracks
            );
        }

        return new Playlist({
            id: options.preserveSpotifyId ? `spotify:${spotifyPlaylist.id}` : undefined,
            name: spotifyPlaylist.name,
            description: spotifyPlaylist.description || '',
            coverImage: this._getBestImage(spotifyPlaylist.images, 'large'),
            isPublic: spotifyPlaylist.public ?? true,
            source: TrackSource.SPOTIFY,
            isUserCreated: false,
            externalIds: {
                spotify: spotifyPlaylist.id
            },
            tracks: tracks,
            owner: spotifyPlaylist.owner?.display_name || null,
            ownerId: spotifyPlaylist.owner?.id || null,
            metadata: {
                followers: spotifyPlaylist.followers?.total || null,
                externalUrl: spotifyPlaylist.external_urls?.spotify || null,
                totalTracks: spotifyPlaylist.tracks?.total || tracks.length
            }
        });
    }

    // ==================== LEGACY DATA ADAPTERS ====================

    /**
     * Convert legacy liked track format to Track model
     * This handles the old format stored in the database
     * @param {Object} legacyTrack - Legacy liked track object
     * @returns {Track}
     */
    static fromLegacyLikedTrack(legacyTrack) {
        return new Track({
            title: legacyTrack.trackName || legacyTrack.name || '',
            artists: [legacyTrack.artist || ''],
            album: legacyTrack.album || legacyTrack.albumName || null,
            coverArt: legacyTrack.image || legacyTrack.albumImage || null,
            source: TrackSource.SPOTIFY,
            externalIds: {
                spotify: legacyTrack.trackId || legacyTrack.spotifyId || null
            },
            metadata: {
                previewUrl: legacyTrack.previewUrl || legacyTrack.preview_url || null,
                externalUrl: legacyTrack.trackId
                    ? `https://open.spotify.com/track/${legacyTrack.trackId}`
                    : null
            },
            userData: {
                rating: legacyTrack.rating || null,
                note: legacyTrack.note || null,
                liked: true
            },
            addedAt: legacyTrack.createdAt || legacyTrack.addedAt || new Date()
        });
    }

    /**
     * Convert legacy followed artist format to Artist model
     * @param {Object} legacyArtist - Legacy followed artist object
     * @returns {Artist}
     */
    static fromLegacyFollowedArtist(legacyArtist) {
        return new Artist({
            name: legacyArtist.artistName || legacyArtist.name || '',
            image: legacyArtist.image || null,
            source: TrackSource.SPOTIFY,
            externalIds: {
                spotify: legacyArtist.artistId || legacyArtist.spotifyId || null
            },
            externalUrls: {
                spotify: legacyArtist.artistId
                    ? `https://open.spotify.com/artist/${legacyArtist.artistId}`
                    : null
            },
            userData: {
                followed: true,
                followedAt: legacyArtist.createdAt || new Date()
            },
            addedAt: legacyArtist.createdAt || new Date()
        });
    }

    /**
     * Convert legacy album follow format to Album model
     * @param {Object} legacyAlbum - Legacy album follow object
     * @returns {Album}
     */
    static fromLegacyFollowedAlbum(legacyAlbum) {
        return new Album({
            name: legacyAlbum.albumName || legacyAlbum.name || '',
            artists: [legacyAlbum.artistName || legacyAlbum.artist || ''],
            coverArt: legacyAlbum.image || null,
            source: TrackSource.SPOTIFY,
            externalIds: {
                spotify: legacyAlbum.albumId || null
            },
            userData: {
                saved: true,
                savedAt: legacyAlbum.createdAt || new Date()
            }
        });
    }

    // ==================== REVERSE ADAPTERS (Model to API format) ====================

    /**
     * Convert Track model back to format expected by existing API
     * Used for backward compatibility with existing server endpoints
     * @param {Track} track - Track model instance
     * @returns {Object} - API-compatible object
     */
    static trackToApiFormat(track) {
        return {
            trackId: track.externalIds.spotify || track.id,
            trackName: track.title,
            artist: track.artistString,
            album: track.album,
            image: track.coverArt,
            previewUrl: track.metadata.previewUrl,
            rating: track.userData.rating,
            note: track.userData.note
        };
    }

    /**
     * Convert Artist model back to format expected by existing API
     * @param {Artist} artist - Artist model instance
     * @returns {Object} - API-compatible object
     */
    static artistToApiFormat(artist) {
        return {
            artistId: artist.externalIds.spotify || artist.id,
            artistName: artist.name,
            image: artist.image
        };
    }

    // ==================== HELPER METHODS ====================

    /**
     * Get the best image URL from Spotify images array
     * @param {Array} images - Spotify images array
     * @param {string} size - 'small' | 'medium' | 'large'
     * @returns {string|null}
     */
    static _getBestImage(images, size = 'medium') {
        if (!images || !Array.isArray(images) || images.length === 0) {
            return null;
        }

        // Spotify images are usually sorted largest to smallest
        // [0] = ~640px, [1] = ~300px, [2] = ~64px
        switch (size) {
            case 'small':
                return images[images.length - 1]?.url || images[0]?.url;
            case 'medium':
                return images[1]?.url || images[0]?.url;
            case 'large':
            default:
                return images[0]?.url;
        }
    }

    /**
     * Map Spotify album type to our AlbumType enum
     * @param {string} spotifyType - Spotify album_type value
     * @returns {string}
     */
    static _mapAlbumType(spotifyType) {
        const mapping = {
            'album': AlbumType.ALBUM,
            'single': AlbumType.SINGLE,
            'compilation': AlbumType.COMPILATION,
            'appears_on': AlbumType.APPEARS_ON
        };
        return mapping[spotifyType] || AlbumType.ALBUM;
    }

    /**
     * Generate attribution HTML for Spotify compliance
     * REQUIRED: Must be displayed when showing Spotify content
     * @param {string} [size] - 'small' | 'medium' | 'large'
     * @returns {string} - HTML string
     */
    static getAttributionHTML(size = 'small') {
        const sizes = {
            small: 'h-4',
            medium: 'h-6',
            large: 'h-8'
        };

        return `
            <a href="https://spotify.com" target="_blank" rel="noopener noreferrer" 
               class="inline-flex items-center gap-1 text-[#1DB954] hover:opacity-80 transition-opacity"
               title="Powered by Spotify">
                <i class="fa-brands fa-spotify ${sizes[size] || sizes.small}"></i>
                <span class="text-xs opacity-70">via Spotify</span>
            </a>
        `;
    }

    /**
     * Generate link button HTML for a track
     * REQUIRED: Preview clips must link back to Spotify
     * @param {Track} track - Track model
     * @returns {string} - HTML string
     */
    static getSpotifyLinkHTML(track) {
        const url = track.getExternalUrl(TrackSource.SPOTIFY);
        if (!url) return '';

        return `
            <a href="${url}" target="_blank" rel="noopener noreferrer"
               class="flex items-center gap-2 px-3 py-1.5 bg-[#1DB954] hover:bg-[#1ed760] text-black rounded-full text-xs font-bold transition">
                <i class="fa-brands fa-spotify"></i>
                <span>Open in Spotify</span>
            </a>
        `;
    }
}

export default SpotifyAdapter;
