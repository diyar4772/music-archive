/**
 * 🎵 Audio Service - Robust Preview Playback
 * 
 * Handles audio preview playback with:
 * - Flexible URL validation (accepts most HTTPS audio URLs)
 * - Android/iOS specific handling
 * - Debug logging for troubleshooting
 * - Proper error handling
 */

import { Audio, AVPlaybackStatus } from 'expo-av';
import { Platform } from 'react-native';
import hapticService from './hapticService';
import logger from '../utils/logger';

// Types
export interface AudioState {
    isPlaying: boolean;
    isLoading: boolean;
    currentTrackId: string | null;
    error: string | null;
}

export interface PlayOptions {
    trackId: string;
    previewUrl: string | null | undefined;
    onStatusChange?: (state: AudioState) => void;
    onError?: (error: string) => void;
    onFinish?: () => void;
}

// Audio instance singleton
let currentSound: Audio.Sound | null = null;
let currentTrackId: string | null = null;
let isInitialized = false;

/**
 * Initialize audio mode for the platform
 */
async function initializeAudio(): Promise<void> {
    if (isInitialized) return;

    try {
        await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
        });
        isInitialized = true;
        logger.debug('Audio mode initialized', undefined, 'audioService');
    } catch (error) {
        logger.error('Audio init error', error, 'audioService');
    }
}

/**
 * Validate preview URL - FLEXIBLE validation
 * Accepts any valid HTTPS URL that looks like an audio file
 */
export function validatePreviewUrl(url: string | null | undefined): {
    isValid: boolean;
    sanitizedUrl: string | null;
    source: 'itunes' | 'spotify' | 'other' | null;
    debugInfo: string;
} {
    // Check for null/undefined/empty
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
        return {
            isValid: false,
            sanitizedUrl: null,
            source: null,
            debugInfo: 'URL is null, undefined or empty'
        };
    }

    // Trim whitespace
    const trimmedUrl = url.trim();

    // Must be a valid URL (http or https)
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        return {
            isValid: false,
            sanitizedUrl: null,
            source: null,
            debugInfo: `URL does not start with http(s): ${trimmedUrl.substring(0, 50)}`
        };
    }

    // Determine source for logging
    let source: 'itunes' | 'spotify' | 'other' = 'other';

    if (trimmedUrl.includes('itunes.apple.com') ||
        trimmedUrl.includes('apple.com') ||
        trimmedUrl.includes('mzstatic.com')) {
        source = 'itunes';
    } else if (trimmedUrl.includes('scdn.co') ||
        trimmedUrl.includes('spotify.com') ||
        trimmedUrl.includes('spotifycdn.com')) {
        source = 'spotify';
    }

    // FLEXIBLE: Accept any URL that looks like it could be audio
    // Don't be too strict - let expo-av handle actual validation

    // URL looks valid enough to try
    return {
        isValid: true,
        sanitizedUrl: trimmedUrl,
        source,
        debugInfo: `Valid URL (${source}): ${trimmedUrl.substring(0, 60)}...`
    };
}

/**
 * Simple URL check - verify it's not empty, not "undefined" string, and is a valid URL
 */
export function hasPreviewUrl(url: string | null | undefined): boolean {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();

    // Check for common invalid values
    if (trimmed.length === 0) return false;
    if (trimmed === 'undefined' || trimmed === 'null' || trimmed === 'none') return false;

    // Must be a valid URL
    return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

/**
 * Stop and cleanup current audio
 */
export async function stopAudio(): Promise<void> {
    if (currentSound) {
        try {
            const status = await currentSound.getStatusAsync();
            if (status.isLoaded) {
                await currentSound.stopAsync();
            }
            await currentSound.unloadAsync();
        } catch (error) {
            logger.warn('Audio cleanup warning', error, 'audioService');
        }
        currentSound = null;
        currentTrackId = null;
    }
}

/**
 * Play audio preview with robust error handling
 */
export async function playPreview(options: PlayOptions): Promise<boolean> {
    const { trackId, previewUrl, onStatusChange, onError, onFinish } = options;

    // Debug logging
    logger.debug('Play preview', { trackId, previewUrl, platform: Platform.OS }, 'audioService');

    // Comprehensive URL validation
    if (!previewUrl || typeof previewUrl !== 'string') {
        const errorMsg = 'Bu şarkı için önizleme mevcut değil.';
        logger.debug('No preview URL (null/undefined)', { trackId }, 'audioService');
        onError?.(errorMsg);
        return false;
    }

    const trimmedUrl = previewUrl.trim();

    // Check for common invalid string values
    if (trimmedUrl.length === 0 ||
        trimmedUrl === 'undefined' ||
        trimmedUrl === 'null' ||
        trimmedUrl === 'none') {
        const errorMsg = 'Bu şarkı için önizleme mevcut değil.';
        logger.debug('Invalid preview URL value', { trackId, url: trimmedUrl }, 'audioService');
        onError?.(errorMsg);
        return false;
    }

    // Check if URL is valid
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        const errorMsg = 'Geçersiz URL formatı.';
        logger.debug('Invalid URL format', { trackId, url: trimmedUrl }, 'audioService');
        onError?.(errorMsg);
        return false;
    }

    logger.debug('URL validated, proceeding with playback', { trackId }, 'audioService');

    // If same track, toggle off
    if (currentTrackId === trackId && currentSound) {
        logger.debug('Same track, toggling off', { trackId }, 'audioService');
        await stopAudio();
        onStatusChange?.({ isPlaying: false, isLoading: false, currentTrackId: null, error: null });
        return true;
    }

    // Stop current audio first
    await stopAudio();

    // Initialize audio mode
    await initializeAudio();

    // Update loading state
    onStatusChange?.({ isPlaying: false, isLoading: true, currentTrackId: trackId, error: null });

    try {
        logger.debug('Creating sound from URL', { trackId, url: trimmedUrl }, 'audioService');

        // Create sound - simpler approach without Android-specific overrides
        const { sound, status } = await Audio.Sound.createAsync(
            { uri: trimmedUrl },
            {
                shouldPlay: true,
                volume: 1.0,
                progressUpdateIntervalMillis: 500,
            },
            (playbackStatus: AVPlaybackStatus) => {
                if (playbackStatus.isLoaded) {
                    if (playbackStatus.didJustFinish) {
                        logger.debug('Playback finished', { trackId }, 'audioService');
                        currentTrackId = null;
                        currentSound = null;
                        onStatusChange?.({ isPlaying: false, isLoading: false, currentTrackId: null, error: null });
                        onFinish?.();
                    }

                    // Check for errors in playback
                    if ((playbackStatus as any).error) {
                        logger.error('Playback error', (playbackStatus as any).error, 'audioService');
                        stopAudio();
                        onError?.(`Oynatma hatası: ${(playbackStatus as any).error}`);
                    }
                }
            }
        );

        logger.debug('Sound created successfully', { trackId, isLoaded: status.isLoaded }, 'audioService');

        if (!status.isLoaded) {
            throw new Error('Sound failed to load');
        }

        currentSound = sound;
        currentTrackId = trackId;

        // Haptic feedback (web-safe)
        hapticService.mediumImpact();

        onStatusChange?.({ isPlaying: true, isLoading: false, currentTrackId: trackId, error: null });
        logger.debug('Playback started', { trackId }, 'audioService');

        return true;

    } catch (error: any) {
        logger.error('Playback error', error, 'audioService');

        // Cleanup
        await stopAudio();

        // User-friendly error message
        let userMessage = 'Şarkı önizlemesi oynatılamadı.';

        if (error?.message?.includes('FileNotFoundException') ||
            error?.message?.includes('404') ||
            error?.message?.includes('Not Found')) {
            userMessage = 'Önizleme dosyası bulunamadı.';
        } else if (error?.message?.includes('network') ||
            error?.message?.includes('Network') ||
            error?.message?.includes('timeout') ||
            error?.message?.includes('Unable to resolve')) {
            userMessage = 'Ağ bağlantısı hatası.';
        } else if (error?.message?.includes('format') ||
            error?.message?.includes('decoder') ||
            error?.message?.includes('codec')) {
            userMessage = 'Ses formatı desteklenmiyor.';
        }

        onStatusChange?.({ isPlaying: false, isLoading: false, currentTrackId: null, error: userMessage });
        onError?.(userMessage);

        return false;
    }
}

/**
 * Get current playback state
 */
export function getCurrentState(): { trackId: string | null; isPlaying: boolean } {
    return {
        trackId: currentTrackId,
        isPlaying: currentSound !== null && currentTrackId !== null,
    };
}

/**
 * Toggle playback for a track
 */
export async function togglePlayback(options: PlayOptions): Promise<boolean> {
    // If same track is playing, stop it
    if (currentTrackId === options.trackId && currentSound) {
        await stopAudio();
        options.onStatusChange?.({ isPlaying: false, isLoading: false, currentTrackId: null, error: null });
        return true;
    }

    // Otherwise start playing
    return playPreview(options);
}

// Export as default service object
export default {
    validatePreviewUrl,
    hasPreviewUrl,
    playPreview,
    stopAudio,
    togglePlayback,
    getCurrentState,
};
