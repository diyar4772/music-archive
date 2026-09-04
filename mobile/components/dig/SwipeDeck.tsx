import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import SwipeCard from './SwipeCard';
import { DigTrack } from '../../services/dig';
import { Colors } from '../../constants/theme';
import logger from '../../utils/logger';

interface SwipeDeckProps {
    tracks: DigTrack[];
    currentIndex: number;
    onSwipe: (direction: 'left' | 'right' | 'up') => void;
    onRefresh: () => void;
    isLoading: boolean;
}

export default function SwipeDeck({
    tracks,
    currentIndex,
    onSwipe,
    onRefresh,
    isLoading,
}: SwipeDeckProps) {
    const { t } = useTranslation();
    const soundRef = useRef<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const currentTrack = tracks[currentIndex];
    const nextTrack = tracks[currentIndex + 1];

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            const cleanup = async () => {
                try {
                    if (soundRef.current) {
                        const status = await soundRef.current.getStatusAsync();
                        if (status.isLoaded) {
                            await soundRef.current.stopAsync();
                        }
                        await soundRef.current.unloadAsync();
                        soundRef.current = null;
                    }
                } catch (error) {
                    logger.warn('Audio cleanup error on unmount', error, 'SwipeDeck');
                }
            };
            cleanup();
        };
    }, []);

    // Auto-play when card changes
    useEffect(() => {
        const playNewTrack = async () => {
            if (currentTrack?.preview_url) {
                await playPreview();
            }
        };
        playNewTrack();

        return () => {
            stopAudio();
        };
    }, [currentIndex]);

    const playPreview = useCallback(async () => {
        if (!currentTrack?.preview_url) return;

        try {
            // Stop previous sound
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
                soundRef.current = null;
            }

            // Configure audio mode
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
            });

            // Load and play new sound
            const { sound } = await Audio.Sound.createAsync(
                { uri: currentTrack.preview_url },
                { shouldPlay: true, volume: 1.0 }
            );

            soundRef.current = sound;
            setIsPlaying(true);

            // Handle playback finish
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    setIsPlaying(false);
                }
            });
        } catch (error) {
            logger.error('Audio error', error, 'SwipeDeck');
            setIsPlaying(false);
        }
    }, [currentTrack]);

    const togglePlay = useCallback(async () => {
        if (!soundRef.current) {
            await playPreview();
            return;
        }

        try {
            const status = await soundRef.current.getStatusAsync();
            if (status.isLoaded) {
                if (status.isPlaying) {
                    await soundRef.current.pauseAsync();
                    setIsPlaying(false);
                } else {
                    await soundRef.current.playAsync();
                    setIsPlaying(true);
                }
            }
        } catch (error) {
            logger.error('Toggle play error', error, 'SwipeDeck');
        }
    }, [playPreview]);

    const stopAudio = useCallback(async () => {
        if (soundRef.current) {
            try {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
                soundRef.current = null;
                setIsPlaying(false);
            } catch (error) {
                // Ignore errors during cleanup
            }
        }
    }, []);

    const handleSwipe = useCallback(async (direction: 'left' | 'right' | 'up') => {
        await stopAudio();
        onSwipe(direction);
    }, [stopAudio, onSwipe]);

    // Empty state
    if (!currentTrack && !isLoading) {
        return (
            <View style={styles.emptyContainer}>
                <View style={styles.emptyIcon}>
                    <Ionicons name="musical-notes" size={60} color="#444" />
                </View>
                <Text style={styles.emptyTitle}>{t('dig.discoveryComplete')}</Text>
                <Text style={styles.emptyText}>{t('dig.refreshPrompt')}</Text>
                <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} activeOpacity={0.8}>
                    <Ionicons name="refresh" size={20} color="#fff" />
                    <Text style={styles.refreshText}>{t('dig.refresh')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Loading state
    if (isLoading && !currentTrack) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>{t('dig.loadingTracks')}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.deckContainer}>
                {/* Next Card (Behind) */}
                {nextTrack && (
                    <SwipeCard
                        track={nextTrack}
                        isFirst={false}
                        onSwipe={() => { }}
                        onPlay={() => { }}
                        isPlaying={false}
                    />
                )}

                {/* Current Card (Top) */}
                {currentTrack && (
                    <SwipeCard
                        track={currentTrack}
                        isFirst={true}
                        onSwipe={handleSwipe}
                        onPlay={togglePlay}
                        isPlaying={isPlaying}
                    />
                )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.passButton]}
                    onPress={() => handleSwipe('left')}
                    activeOpacity={0.7}
                >
                    <Ionicons name="close" size={36} color="#EF4444" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.exploreButton]}
                    onPress={() => handleSwipe('up')}
                    activeOpacity={0.7}
                >
                    <Ionicons name="eye" size={28} color="#3B82F6" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.archiveButton]}
                    onPress={() => handleSwipe('right')}
                    activeOpacity={0.7}
                >
                    <Ionicons name="heart" size={36} color={Colors.accent} />
                </TouchableOpacity>
            </View>

            {/* Hint */}
            <Text style={styles.hint}>{t('dig.hint')}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    deckContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    emptyIcon: {
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: '#1e1e1e',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 15,
        color: '#888',
        textAlign: 'center',
        marginBottom: 28,
    },
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 28,
        gap: 8,
    },
    refreshText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#888',
        marginTop: 16,
        fontSize: 16,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
        paddingTop: 28,
        gap: 32,
    },
    actionButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2.5,
    },
    passButton: {
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
    },
    exploreButton: {
        width: 58,
        height: 58,
        borderRadius: 29,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
    },
    archiveButton: {
        borderColor: Colors.accent,
        backgroundColor: Colors.accentAlpha(0.15),
    },
    hint: {
        textAlign: 'center',
        color: '#555',
        fontSize: 13,
        paddingBottom: 16,
    },
});
