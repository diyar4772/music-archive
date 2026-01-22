// User types
export interface User {
    id: string;
    username: string;
    isAdmin?: boolean;
}

// Auth types
export interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

// Artist types
export interface Artist {
    id: string;
    name: string;
    image: string | null;
    genres?: string;
    popularity?: number;
}

// Track types
export interface Track {
    id: string;
    name: string;
    artist: string;
    artistId?: string; // Added for like API
    image: string | null;
    preview_url: string | null;
    duration_ms?: number;
    popularity?: number;
}

// Album types
export interface Album {
    id: string;
    name: string;
    artist: string;
    image: string | null;
    year?: string;
    totalTracks?: number;
}

// User data types
export interface UserFollow {
    artistId: string;
    artistName: string;
    image: string | null;
}

export interface UserLike {
    trackId: string;
    trackName: string;
    artistName?: string;
    image: string | null;
    previewUrl: string | null;
}

// Rating types
export interface UserRating {
    itemId: string;
    itemType: 'track' | 'album';
    itemName: string;
    artistName: string;
    image: string | null;
    rating: number;
}

// Playlist types
export interface Playlist {
    id: string;
    name: string;
    coverImage?: string;
    trackCount: number;
    tracks?: PlaylistTrack[];
    createdAt?: string;
}

export interface PlaylistTrack {
    trackId: string;
    trackName: string;
    artistName?: string;
    image?: string;
    previewUrl?: string;
    addedAt?: string;
}

export interface UserAlbumFollow {
    albumId: string;
    albumName: string;
    image: string | null;
    artistName: string;
}

export interface UserData {
    follows: UserFollow[];
    likes: UserLike[];
    albumFollows: UserAlbumFollow[];
    ratings: UserRating[];
}

// API Response types
export interface LoginResponse {
    token: string;
    refreshToken?: string;
    username: string;
}

export interface ApiError {
    error: string;
}
