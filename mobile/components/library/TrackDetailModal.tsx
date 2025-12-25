/**
 * 🎵 Track Detail Modal
 * 
 * Full-featured track detail view with:
 * - Star rating
 * - Streaming links (Spotify, YouTube, Apple Music)
 * - Like/Unlike button
 * - Add to playlist button
 * - 30s preview playback
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Pressable,
    Linking,
    Alert,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import hapticService from '../../services/hapticService';
import { LinearGradient } from 'expo-linear-gradient';
import StarRating from '../ui/StarRating';
import { Colors } from '../../constants/theme';
import { handleApiError } from '../../utils/errorHandler';
import logger from '../../utils/logger';
import ratingService from '../../services/rating';
import { useAuthStore } from '../../stores/authStore';

interface TrackDetailModalProps {
    visible: boolean;
    onClose: () => void;
    track: {
        trackId: string;
        trackName: string;
        artistName?: string;
        image?: string | null;
        previewUrl?: string | null;
    } | null;
    onAddToPlaylist?: (track: any) => void;
}

export default function TrackDetailModal({
    visible,
    onClose,
    track,
    onAddToPlaylist,
}: TrackDetailModalProps) {
    const { userData, refreshUserData } = useAuthStore();
    const [rating, setRating] = useState(0);
    const [isRating, setIsRating] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const soundRef = useRef<Audio.Sound | null>(null);
    const slideAnim = useRef(new Animated.Value(300)).current;

    // Check if track is liked
    const isLiked = userData?.likes?.some(l => l.trackId === track?.trackId) || false;

    // Get user's rating for this track
    useEffect(() => {
        if (track && userData?.ratings) {
            const userRating = userData.ratings.find(r => r.itemId === track.trackId);
            setRating(userRating?.rating || 0);
        }
    }, [track, userData?.ratings]);

    // Animate modal
    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                friction: 8,
            }).start();
        } else {
            slideAnim.setValue(300);
        }
    }, [visible]);

    // Cleanup audio on close
    useEffect(() => {
        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
        };
    }, []);

    // Handle rating
    const handleRate = useCallback(async (newRating: number) => {
        if (!track || isRating) return;

        setIsRating(true);
        const previousRating = rating;
        setRating(newRating);

        try {
            await ratingService.rateItem({
                itemId: track.trackId,
                itemType: 'track',
                rating: newRating,
                itemName: track.trackName,
                artistName: track.artistName || 'Unknown Artist',
                image: track.image || undefined,
            });
            hapticService.success();
            await refreshUserData();
        } catch (error: any) {
            handleApiError(error, 'handleRating');
            setRating(previousRating);
        } finally {
            setIsRating(false);
        }
    }, [track, rating, isRating, refreshUserData]);

    // Play preview
    const handlePlayPreview = useCallback(async () => {
        if (!track?.previewUrl) {
            Alert.alert('Önizleme Yok', 'Bu şarkı için önizleme mevcut değil');
            return;
        }

        try {
            if (soundRef.current) {
                if (isPlaying) {
                    await soundRef.current.pauseAsync();
                    setIsPlaying(false);
                    return;
                }
                await soundRef.current.playAsync();
                setIsPlaying(true);
                return;
            }

            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
            });

            const { sound } = await Audio.Sound.createAsync(
                { uri: track.previewUrl },
                { shouldPlay: true, volume: 1.0 }
            );

            soundRef.current = sound;
            setIsPlaying(true);
            hapticService.lightImpact();

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    setIsPlaying(false);
                }
            });
        } catch (error) {
            console.error('Play error:', error);
            Alert.alert('Hata', 'Önizleme oynatılamadı');
        }
    }, [track, isPlaying]);

    // Open streaming links
    const openSpotify = () => {
        if (track) {
            Linking.openURL(`https://open.spotify.com/track/${track.trackId}`);
        }
    };

    const openYouTube = () => {
        if (track) {
            const query = encodeURIComponent(`${track.trackName} ${track.artistName || ''}`);
            Linking.openURL(`https://www.youtube.com/results?search_query=${query}`);
        }
    };

    const openAppleMusic = () => {
        if (track) {
            const query = encodeURIComponent(`${track.trackName} ${track.artistName || ''}`);
            Linking.openURL(`https://music.apple.com/search?term=${query}`);
        }
    };

    // Cleanup on close
    const handleClose = useCallback(async () => {
        if (soundRef.current) {
            await soundRef.current.stopAsync();
            await soundRef.current.unloadAsync();
            soundRef.current = null;
        }
        setIsPlaying(false);
        onClose();
    }, [onClose]);

    if (!track) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleClose}
        >
            <Pressable style={styles.overlay} onPress={handleClose}>
                <Animated.View
                    style={[
                        styles.container,
                        { transform: [{ translateY: slideAnim }] }
                    ]}
                >
                    <Pressable onPress={(e) => e.stopPropagation()}>
                        {/* Handle Bar */}
                        <View style={styles.handleBar} />

                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.headerTitle}>Şarkı Detayları</Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={handleClose}
                            >
                                <Ionicons name="close" size={24} color="#888" />
                            </TouchableOpacity>
                        </View>

                        {/* Track Info */}
                        <View style={styles.trackInfo}>
                            {track.image ? (
                                <Image source={{ uri: track.image }} style={styles.trackImage} />
                            ) : (
                                <View style={[styles.trackImage, styles.placeholder]}>
                                    <Ionicons name="musical-note" size={32} color="#666" />
                                </View>
                            )}
                            <View style={styles.trackDetails}>
                                <Text style={styles.trackName} numberOfLines={2}>
                                    {track.trackName}
                                </Text>
                                <Text style={styles.artistName} numberOfLines={1}>
                                    {track.artistName || 'Unknown Artist'}
                                </Text>
                            </View>
                        </View>

                        {/* Star Rating */}
                        <View style={styles.ratingSection}>
                            <Text style={styles.sectionLabel}>Puanla</Text>
                            <StarRating
                                rating={rating}
                                onRate={handleRate}
                                size={36}
                                showLabel
                            />
                        </View>

                        {/* Preview Button */}
                        <TouchableOpacity
                            style={styles.previewButton}
                            onPress={handlePlayPreview}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={[Colors.primary, '#059669']}
                                style={styles.previewGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Ionicons
                                    name={isPlaying ? 'pause' : 'play'}
                                    size={24}
                                    color="#fff"
                                />
                                <Text style={styles.previewText}>
                                    {isPlaying ? 'Duraklat' : '30sn Önizle'}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Streaming Links */}
                        <Text style={styles.sectionLabel}>Dinle</Text>
                        <View style={styles.streamingLinks}>
                            <TouchableOpacity
                                style={[styles.streamingButton, styles.spotifyButton]}
                                onPress={openSpotify}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="logo-spotify" size={24} color="#1DB954" />
                                <Text style={styles.streamingText}>Spotify</Text>
                                <Ionicons name="open-outline" size={16} color="#666" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.streamingButton, styles.youtubeButton]}
                                onPress={openYouTube}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="logo-youtube" size={24} color="#FF0000" />
                                <Text style={styles.streamingText}>YouTube</Text>
                                <Ionicons name="open-outline" size={16} color="#666" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.streamingButton, styles.appleButton]}
                                onPress={openAppleMusic}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="logo-apple" size={24} color="#fff" />
                                <Text style={styles.streamingText}>Apple Music</Text>
                                <Ionicons name="open-outline" size={16} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.actionButtons}>
                            <TouchableOpacity
                                style={[styles.actionButton, isLiked && styles.actionButtonActive]}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={isLiked ? 'heart' : 'heart-outline'}
                                    size={22}
                                    color={isLiked ? Colors.accent : '#fff'}
                                />
                                <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>
                                    {isLiked ? 'Beğenildi' : 'Beğen'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => onAddToPlaylist?.(track)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="add" size={22} color="#fff" />
                                <Text style={styles.actionText}>Listeye Ekle</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Animated.View>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#1a1a1a',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    handleBar: {
        width: 40,
        height: 4,
        backgroundColor: '#444',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    closeButton: {
        padding: 4,
    },
    trackInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        gap: 16,
    },
    trackImage: {
        width: 80,
        height: 80,
        borderRadius: 12,
    },
    placeholder: {
        backgroundColor: '#2a2a2a',
        alignItems: 'center',
        justifyContent: 'center',
    },
    trackDetails: {
        flex: 1,
    },
    trackName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    artistName: {
        fontSize: 16,
        color: '#888',
        marginTop: 4,
    },
    ratingSection: {
        alignItems: 'center',
        paddingVertical: 16,
        marginHorizontal: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 13,
        color: '#888',
        marginBottom: 12,
        marginLeft: 20,
    },
    previewButton: {
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 16,
        overflow: 'hidden',
    },
    previewGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 10,
    },
    previewText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
    streamingLinks: {
        paddingHorizontal: 20,
        gap: 10,
        marginBottom: 20,
    },
    streamingButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        gap: 12,
    },
    spotifyButton: {
        backgroundColor: 'rgba(29, 185, 84, 0.15)',
    },
    youtubeButton: {
        backgroundColor: 'rgba(255, 0, 0, 0.15)',
    },
    appleButton: {
        backgroundColor: 'rgba(250, 45, 72, 0.15)',
    },
    streamingText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    actionButtons: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingBottom: 32,
        gap: 12,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    actionButtonActive: {
        backgroundColor: Colors.accentAlpha(0.2),
    },
    actionText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    actionTextActive: {
        color: Colors.accent,
    },
});

