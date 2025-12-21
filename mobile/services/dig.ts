import api from './api';

export interface DigTrack {
    id: string;
    name: string;
    artist: string;
    artistId: string;
    album: string;
    albumId: string;
    image: string;
    preview_url: string | null;
    duration_ms: number;
    popularity: number;
    external_url: string;
}

export interface DigQueueResponse {
    tracks: DigTrack[];
    total: number;
}

export interface SwipeResponse {
    success: boolean;
    action: string;
    trackId: string;
    message: string;
}

export const digService = {
    // Get random tracks for Dig Mode
    getQueue: async (genre?: string, limit: number = 10): Promise<DigQueueResponse> => {
        const params: any = { limit };
        if (genre) params.genre = genre;

        const response = await api.get<DigQueueResponse>('/dig/queue', { params });
        return response.data;
    },

    // Handle swipe action
    swipe: async (
        track: DigTrack,
        action: 'pass' | 'archive' | 'explore',
        mood?: string
    ): Promise<SwipeResponse> => {
        const response = await api.post<SwipeResponse>('/dig/swipe', {
            trackId: track.id,
            trackName: track.name,
            artistId: track.artistId,
            artistName: track.artist,
            albumId: track.albumId,
            image: track.image,
            action,
            mood,
        });
        return response.data;
    },

    // Get available genres
    getGenres: async (): Promise<string[]> => {
        const response = await api.get<{ genres: string[] }>('/dig/genres');
        return response.data.genres;
    },
};

export default digService;
