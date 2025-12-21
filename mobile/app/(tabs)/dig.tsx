import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import SwipeCard from '../../components/SwipeCard';
import digService, { DigTrack } from '../../services/dig';

export default function DigScreen() {
    const [tracks, setTracks] = useState<DigTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const soundRef = useRef<Audio.Sound | null>(null);

    // Load initial queue
    useEffect(() => {
        loadQueue();
        return () => {
            // Cleanup audio on unmount
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
        };
    }, []);

    const loadQueue = async () => {
        setLoading(true);
        try {
            const response = await digService.getQueue(undefined, 15);
            setTracks(response.tracks);
            setCurrentIndex(0);
        } catch (error) {
            console.error('Failed to load queue:', error);
            Alert.alert('Hata', 'Şarkılar yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    const playPreview = async () => {
        const currentTrack = tracks[currentIndex];
        if (!currentTrack?.preview_url) return;

        try {
            if (soundRef.current) {
                const status = await soundRef.current.getStatusAsync();
                if (status.isLoaded && status.isPlaying) {
                    await soundRef.current.pauseAsync();
                    setIsPlaying(false);
                    return;
                }
            }

            // Stop previous sound
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
            }

            // Load and play new sound
            const { sound } = await Audio.Sound.createAsync(
                { uri: currentTrack.preview_url },
                { shouldPlay: true }
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
        }
    };

    const stopAudio = async () => {
        if (soundRef.current) {
            await soundRef.current.stopAsync();
            setIsPlaying(false);
        }
    };

    const handleSwipe = useCallback(async (direction: 'left' | 'right' | 'up') => {
        const currentTrack = tracks[currentIndex];
        if (!currentTrack) return;

        // Stop audio when swiping
        await stopAudio();

        // Determine action
        const action = direction === 'right' ? 'archive' : direction === 'left' ? 'pass' : 'explore';

        try {
            await digService.swipe(currentTrack, action);

            // Move to next card
            setCurrentIndex((prev) => prev + 1);

            // Load more tracks if running low
            if (currentIndex >= tracks.length - 3) {
                const response = await digService.getQueue(undefined, 10);
                setTracks((prev) => [...prev, ...response.tracks]);
            }
        } catch (error) {
            console.error('Swipe error:', error);
        }
    }, [currentIndex, tracks]);

    const handleButtonSwipe = (direction: 'left' | 'right' | 'up') => {
        handleSwipe(direction);
    };

    const currentTrack = tracks[currentIndex];
    const nextTrack = tracks[currentIndex + 1];

    if (loading) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#1DB954" />
                    <Text style={styles.loadingText}>Şarkılar yükleniyor...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!currentTrack) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.emptyContainer}>
                    <Ionicons name="refresh" size={64} color="#333" />
                    <Text style={styles.emptyText}>Tüm şarkıları gördün!</Text>
                    <TouchableOpacity style={styles.refreshButton} onPress={loadQueue}>
                        <Text style={styles.refreshButtonText}>Yenile</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Dig Mode</Text>
                    <Text style={styles.counter}>{currentIndex + 1} / {tracks.length}</Text>
                </View>

                {/* Card Stack */}
                <View style={styles.cardContainer}>
                    {nextTrack && (
                        <SwipeCard
                            track={nextTrack}
                            isFirst={false}
                            onSwipe={() => { }}
                            onPlay={() => { }}
                            isPlaying={false}
                        />
                    )}
                    <SwipeCard
                        track={currentTrack}
                        isFirst={true}
                        onSwipe={handleSwipe}
                        onPlay={playPreview}
                        isPlaying={isPlaying}
                    />
                </View>

                {/* Action Buttons */}
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.passButton]}
                        onPress={() => handleButtonSwipe('left')}
                    >
                        <Ionicons name="close" size={32} color="#EF4444" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, styles.exploreButton]}
                        onPress={() => handleButtonSwipe('up')}
                    >
                        <Ionicons name="eye" size={28} color="#3B82F6" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, styles.archiveButton]}
                        onPress={() => handleButtonSwipe('right')}
                    >
                        <Ionicons name="heart" size={32} color="#1DB954" />
                    </TouchableOpacity>
                </View>

                {/* Hint */}
                <Text style={styles.hint}>
                    ← Pass • ↑ Explore • → Archive
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#121212',
    },
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    counter: {
        fontSize: 14,
        color: '#888',
    },
    cardContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
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
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: '#888',
        marginTop: 16,
        fontSize: 18,
    },
    refreshButton: {
        marginTop: 24,
        backgroundColor: '#1DB954',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 30,
    },
    refreshButtonText: {
        color: '#fff',
        fontWeight: 'bold',
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
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
    },
    passButton: {
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    exploreButton: {
        width: 52,
        height: 52,
        borderRadius: 26,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
    },
    archiveButton: {
        borderColor: '#1DB954',
        backgroundColor: 'rgba(29, 185, 84, 0.1)',
    },
    hint: {
        textAlign: 'center',
        color: '#555',
        fontSize: 13,
        paddingBottom: 16,
    },
});
