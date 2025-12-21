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
import SwipeCard from './SwipeCard';
import { DigTrack } from '../../services/dig';

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
    const soundRef = useRef<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const currentTrack = tracks[currentIndex];
    const nextTrack = tracks[currentIndex + 1];

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
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
            console.error('Audio error:', error);
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
            console.error('Toggle play error:', error);
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
                <Text style={styles.emptyTitle}>Keşif tamamlandı!</Text>
                <Text style={styles.emptyText}>Daha fazla şarkı keşfetmek için yenile</Text>
                <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} activeOpacity={0.8}>
                    <Ionicons name="refresh" size={20} color="#fff" />
                    <Text style={styles.refreshText}>Yenile</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Loading state
    if (isLoading && !currentTrack) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1DB954" />
                <Text style={styles.loadingText}>Şarkılar yükleniyor...</Text>
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
                    <Ionicons name="close" size={30} color="#EF4444" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.exploreButton]}
                    onPress={() => handleSwipe('up')}
                    activeOpacity={0.7}
                >
                    <Ionicons name="eye" size={24} color="#3B82F6" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.archiveButton]}
                    onPress={() => handleSwipe('right')}
                    activeOpacity={0.7}
                >
                    <Ionicons name="heart" size={30} color="#1DB954" />
                </TouchableOpacity>
            </View>

            {/* Hint */}
            <Text style={styles.hint}>← Pass • ↑ Explore • → Archive</Text>
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
        backgroundColor: '#1DB954',
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
        paddingVertical: 16,
        gap: 24,
    },
    actionButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
    },
    passButton: {
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
    },
    exploreButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
    },
    archiveButton: {
        borderColor: '#1DB954',
        backgroundColor: 'rgba(29, 185, 84, 0.12)',
    },
    hint: {
        textAlign: 'center',
        color: '#555',
        fontSize: 13,
        paddingBottom: 12,
    },
});
