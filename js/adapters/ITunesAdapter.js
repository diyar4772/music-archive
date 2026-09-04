/**
 * iTunes Adapter
 * Fetches preview URLs from iTunes Search API as fallback for Spotify
 * 
 * WHY ITUNES?
 * ===========
 * Spotify's preview_url is often null or unavailable in many regions.
 * iTunes Search API provides 30-second previews that are publicly accessible.
 * 
 * LEGAL NOTES:
 * ============
 * - iTunes previews are Apple's own licensed content
 * - No specific attribution required
 * - Good practice: Include Apple Music link when using iTunes preview
 * - These are NOT Spotify previews, so Spotify's preview rules don't apply
 * 
 * @see https://affiliate.itunes.apple.com/resources/documentation/itunes-store-web-service-search-api/
 */

/**
 * ITunesAdapter class
 * Provides methods to fetch and integrate iTunes data
 */
export class ITunesAdapter {

    static API_BASE = 'https://itunes.apple.com';

    /**
     * Search iTunes for a track and get preview URL
     * @param {string} trackName - Track title
     * @param {string} artistName - Artist name
     * @returns {Promise<Object|null>} iTunes track data or null
     */
    static async searchTrack(trackName, artistName) {
        try {
            const query = encodeURIComponent(`${trackName} ${artistName}`);
            const url = `${this.API_BASE}/search?term=${query}&media=music&entity=song&limit=5`;

            const response = await fetch(url);
            if (!response.ok) return null;

            const data = await response.json();

            if (!data.results || data.results.length === 0) {
                return null;
            }

            // Find best match
            const match = this._findBestMatch(data.results, trackName, artistName);
            return match;

        } catch (error) {
            console.error('iTunes search error:', error);
            return null;
        }
    }

    /**
     * Get preview URL for a track
     * @param {string} trackName - Track title
     * @param {string} artistName - Artist name
     * @returns {Promise<string|null>} Preview URL or null
     */
    static async getPreviewUrl(trackName, artistName) {
        const result = await this.searchTrack(trackName, artistName);
        return result?.previewUrl || null;
    }

    /**
     * Enhance a Track model with iTunes preview if missing
     * @param {Track} track - Track model
     * @returns {Promise<Track>} Enhanced track
     */
    static async enhanceTrackWithPreview(track) {
        // Skip if already has preview
        if (track.metadata.previewUrl) {
            return track;
        }

        const previewUrl = await this.getPreviewUrl(track.title, track.artistString);

        if (previewUrl) {
            track.metadata.previewUrl = previewUrl;
            track.metadata.previewSource = 'itunes';
        }

        return track;
    }

    /**
     * Convert iTunes search result to our format
     * @param {Object} itunesTrack - iTunes API result
     * @returns {Object} Normalized preview data
     */
    static toPreviewData(itunesTrack) {
        if (!itunesTrack) return null;

        return {
            previewUrl: itunesTrack.previewUrl || null,
            previewSource: 'itunes',
            itunesTrackId: itunesTrack.trackId,
            itunesUrl: itunesTrack.trackViewUrl,
            artworkUrl: itunesTrack.artworkUrl100?.replace('100x100', '300x300'),
            // Apple Music link (for attribution)
            appleMusicUrl: itunesTrack.trackViewUrl?.replace('itunes.apple.com', 'music.apple.com')
        };
    }

    /**
     * Find the best matching track from iTunes results
     * @private
     */
    static _findBestMatch(results, trackName, artistName) {
        const normalizedTrack = this._normalize(trackName);
        const normalizedArtist = this._normalize(artistName);

        // Score each result
        const scored = results.map(result => {
            let score = 0;

            const resultTrack = this._normalize(result.trackName || '');
            const resultArtist = this._normalize(result.artistName || '');

            // Exact matches
            if (resultTrack === normalizedTrack) score += 10;
            if (resultArtist === normalizedArtist) score += 10;

            // Partial matches
            if (resultTrack.includes(normalizedTrack) || normalizedTrack.includes(resultTrack)) score += 5;
            if (resultArtist.includes(normalizedArtist) || normalizedArtist.includes(resultArtist)) score += 5;

            // Has preview (important!)
            if (result.previewUrl) score += 3;

            return { result, score };
        });

        // Sort by score and return best match with preview
        scored.sort((a, b) => b.score - a.score);

        const bestWithPreview = scored.find(s => s.result.previewUrl);
        return bestWithPreview ? this.toPreviewData(bestWithPreview.result) : null;
    }

    /**
     * Normalize string for comparison
     * @private
     */
    static _normalize(str) {
        return str
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Generate Apple Music attribution HTML
     * Use this when displaying iTunes preview
     * @param {string} url - Apple Music URL
     * @returns {string} HTML string
     */
    static getAppleMusicLinkHTML(url) {
        if (!url) return '';

        return `
            <a href="${url}" target="_blank" rel="noopener noreferrer"
               class="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-pink-500 to-orange-400 hover:opacity-90 text-white rounded-full text-xs font-bold transition">
                <i class="fa-brands fa-apple"></i>
                <span>Apple Music</span>
            </a>
        `;
    }
}

export default ITunesAdapter;
