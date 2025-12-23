/**
 * 📚 Library Service - Mobile App API Client
 * 
 * Handles all Library-related API calls:
 * - Dashboard stats
 * - Tracks (CRUD, filtering, sorting)
 * - Artists (following/unfollowing)
 * - Playlists (CRUD)
 */

import api from './api';

// Types
export interface DashboardStats {
    likedTracksCount: number;
    followedArtistsCount: number;
    playlistsCount: number;
    albumsCount: number;
    totalItems: number;
}

export interface LibraryTrack {
    trackId: string;
    trackName: string;
    artistId?: string;
    artistName: string;
    image?: string;
    previewUrl?: string;
    mood?: string;
    source?: string;
    addedAt: string;
}

export interface LibraryArtist {
    artistId: string;
    artistName: string;
    image?: string;
    followedAt: string;
}

export interface Playlist {
    id: string;
    name: string;
    coverImage?: string;
    trackCount: number;
    createdAt: string;
}

export interface TracksResponse {
    tracks: LibraryTrack[];
    total: number;
    offset: number;
    limit: number;
}

export interface ArtistsResponse {
    artists: LibraryArtist[];
    total: number;
}

export interface PlaylistsResponse {
    playlists: Playlist[];
}

// ===== Dashboard =====

export async function getDashboardStats(): Promise<DashboardStats> {
    const response = await api.get('/library/dashboard');
    return response.data;
}

// ===== Tracks =====

export interface GetTracksParams {
    search?: string;
    sort?: 'date' | 'name' | 'artist';
    mood?: string;
    limit?: number;
    offset?: number;
}

export async function getTracks(params: GetTracksParams = {}): Promise<TracksResponse> {
    const response = await api.get('/library/tracks', { params });
    return response.data;
}

export async function deleteTrack(trackId: string): Promise<{ message: string }> {
    const response = await api.delete(`/library/track/${trackId}`);
    return response.data;
}

// ===== Artists =====

export interface GetArtistsParams {
    search?: string;
    limit?: number;
    offset?: number;
}

export async function getArtists(params: GetArtistsParams = {}): Promise<ArtistsResponse> {
    const response = await api.get('/library/artists', { params });
    return response.data;
}

export async function unfollowArtist(artistId: string): Promise<{ message: string }> {
    const response = await api.delete(`/library/artist/${artistId}`);
    return response.data;
}

// ===== Playlists =====

export async function getPlaylists(): Promise<PlaylistsResponse> {
    const response = await api.get('/library/playlists');
    return response.data;
}

export async function createPlaylist(name: string, coverImage?: string): Promise<{ playlist: Playlist; message: string }> {
    const response = await api.post('/library/playlists', { name, coverImage });
    return response.data;
}

export async function deletePlaylist(playlistId: string): Promise<{ message: string }> {
    const response = await api.delete(`/playlists/${playlistId}`);
    return response.data;
}

export interface PlaylistTrackParams {
    trackId: string;
    trackName: string;
    image?: string;
    previewUrl?: string;
    artistName?: string;
}

export async function addTrackToPlaylist(playlistId: string, track: PlaylistTrackParams): Promise<{ message: string }> {
    const response = await api.post(`/playlists/${playlistId}/add`, track);
    return response.data;
}

export async function removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<{ message: string }> {
    const response = await api.delete(`/playlists/${playlistId}/tracks/${encodeURIComponent(trackId)}`);
    return response.data;
}

export async function updatePlaylistCover(playlistId: string, coverImage: string): Promise<{ message: string }> {
    const response = await api.put(`/playlists/${playlistId}/cover`, { coverImage });
    return response.data;
}

export interface PlaylistDetails extends Playlist {
    PlaylistTracks?: Array<{
        trackId: string;
        trackName: string;
        artistName?: string;
        image?: string;
        previewUrl?: string;
        createdAt?: string;
    }>;
}

// ===== Enhanced Search =====

export interface EnhancedTrack {
    id: string;
    name: string;
    artist: string;
    artistId?: string;
    album: string;
    albumId: string;
    image?: string;
    preview_url?: string;
    duration_ms: number;
    popularity: number;
    external_url?: string;
    isArchived: boolean; // ⭐ Whether user has this track in library
}

export interface EnhancedSearchResponse {
    tracks: EnhancedTrack[];
    total: number;
}

export async function enhancedSearch(
    query: string,
    type: 'track' | 'artist' | 'album' = 'track',
    limit: number = 20
): Promise<EnhancedSearchResponse> {
    const response = await api.get('/search/enhanced', {
        params: { q: query, type, limit }
    });
    return response.data;
}

export default {
    getDashboardStats,
    getTracks,
    deleteTrack,
    getArtists,
    unfollowArtist,
    getPlaylists,
    createPlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    updatePlaylistCover,
    enhancedSearch,
};
