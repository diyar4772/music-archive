class SpotifyService {
    async fetchFromProxy(endpoint) {
        // Remove leading slash if present to avoid double slashes
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

        try {
            const response = await fetch(`/api/proxy/${cleanEndpoint}`);
            if (!response.ok) {
                throw new Error(`Proxy Error: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Spotify Proxy Error:', error);
            throw error;
        }
    }

    async getArtist(artistId) {
        return await this.fetchFromProxy(`artists/${artistId}`);
    }

    async getArtistAlbums(artistId) {
        // Sadece albüm ve single'ları al, derlemeleri filtrele
        const data = await this.fetchFromProxy(`artists/${artistId}/albums?include_groups=album,single&limit=50&market=TR`);
        return data.items;
    }

    async getAlbum(albumId) {
        return await this.fetchFromProxy(`albums/${albumId}`);
    }

    async getAlbumTracks(albumId) {
        const data = await this.fetchFromProxy(`albums/${albumId}/tracks?limit=50&market=TR`);
        return data.items;
    }

    async searchArtist(query) {
        const data = await this.fetchFromProxy(`search?q=${encodeURIComponent(query)}&type=artist&limit=1`);
        return data.artists.items[0];
    }
}

export const spotifyService = new SpotifyService();
