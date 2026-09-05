/**
 * Models Index
 * Export all models from a single entry point
 */

export { Track, TrackSource } from './Track.js';
export { Artist } from './Artist.js';
export { Album, AlbumType } from './Album.js';
export { Playlist } from './Playlist.js';

// Re-export defaults as named exports for convenience
export { default as TrackModel } from './Track.js';
export { default as ArtistModel } from './Artist.js';
export { default as AlbumModel } from './Album.js';
export { default as PlaylistModel } from './Playlist.js';
