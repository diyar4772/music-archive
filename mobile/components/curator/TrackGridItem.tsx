/**
 * 🎵 Track Grid Item - Enhanced
 * 
 * Rich album art tile for the Curator's Workbench grid
 * Features:
 * - Album art with gradient overlay for text readability
 * - Track name and artist display
 * - Like status indicator (heart icon)
 * - Preview availability indicator
 * - Tap to play preview with URL validation
 * - Add button to add to staging
 * - Visual feedback when in staging
 */

import React, { memo, useCallback, useRef, useState } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Dimensions,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/theme';
import { CuratorTrack, useCuratorStore } from '../../stores/curatorStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_PADDING = 16;
const TILE_SIZE = (SCREEN_WIDTH - (GRID_PADDING * 2) - (GRID_GAP * 2)) / 3;

interface TrackGridItemProps {
    track: CuratorTrack;
    onPlayPreview?: (track: CuratorTrack) => void;
    isPlaying?: boolean;
    isLiked?: boolean;
    isLoading?: boolean;
}

/**
 * Validates if a preview URL is valid and playable
 * iTunes/Spotify preview URLs should be HTTPS and end with audio formats
 */
function isValidPreviewUrl(url: string | null | undefined): boolean {
    if (!url || typeof url !== 'string') return false;

    // Must be a valid URL starting with https
    if (!url.startsWith('https://')) return false;

    // Check for known valid sources
    const validSources = [
        'itunes.apple.com',
        'audio-ssl.itunes.apple.com',
        'p.scdn.co', // Spotify CDN
    ];

    try {
        const urlObj = new URL(url);
        return validSources.some(source => urlObj.hostname.includes(source));
    } catch {
        return false;
    }
}

function TrackGridItem({
    track,
    onPlayPreview,
    isPlaying,
    isLiked = false,
    isLoading = false
}: TrackGridItemProps) {
    const { addToStaging, isInStaging, removeFromStaging } = useCuratorStore();
    const [showOverlay, setShowOverlay] = useState(false);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const inStaging = isInStaging(track.id);
    const hasValidPreview = isValidPreviewUrl(track.previewUrl);

    const handlePressIn = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 0.95,
            useNativeDriver: true,
            friction: 8,
        }).start();
        setShowOverlay(true);
    }, [scaleAnim]);

    const handlePressOut = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            friction: 8,
        }).start();
        setShowOverlay(false);
    }, [scaleAnim]);

    const handlePress = useCallback(() => {
        if (!hasValidPreview) {
            Alert.alert(
                'Önizleme Yok',
                'Bu şarkı için çalınabilir önizleme bulunamadı.',
                [{ text: 'Tamam' }]
            );
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        onPlayPreview?.(track);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [track, onPlayPreview, hasValidPreview]);

    const handleAddPress = useCallback(() => {
        if (inStaging) {
            removeFromStaging(track.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
            const added = addToStaging(track);
            if (added) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        }
    }, [inStaging, track, addToStaging, removeFromStaging]);

    // Truncate text for display
    const truncate = (text: string, maxLen: number) =>
        text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;

    return (
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
            <TouchableOpacity
                activeOpacity={1}
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={[
                    styles.tile,
                    inStaging && styles.tileInStaging,
                ]}
            >
                {/* Album Art */}
                {track.image ? (
                    <Image source={{ uri: track.image }} style={styles.image} />
                ) : (
                    <View style={[styles.image, styles.placeholder]}>
                        <Ionicons name="musical-note" size={32} color="#444" />
                    </View>
                )}

                {/* Bottom Gradient for Text Readability */}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.85)']}
                    style={styles.bottomGradient}
                >
                    {/* Track Info */}
                    <Text style={styles.trackName} numberOfLines={1}>
                        {truncate(track.name, 18)}
                    </Text>
                    <Text style={styles.artistName} numberOfLines={1}>
                        {truncate(track.artist, 20)}
                    </Text>
                </LinearGradient>

                {/* Overlay with Play Button (on press/playing) */}
                {(showOverlay || isPlaying || isLoading) && (
                    <View style={styles.overlay}>
                        {isLoading ? (
                            <View style={styles.playButton}>
                                <ActivityIndicator size="small" color="#fff" />
                            </View>
                        ) : (
                            <View style={[
                                styles.playButton,
                                isPlaying && styles.playButtonActive,
                                !hasValidPreview && styles.playButtonDisabled
                            ]}>
                                <Ionicons
                                    name={isPlaying ? 'pause' : (hasValidPreview ? 'play' : 'volume-mute')}
                                    size={22}
                                    color="#fff"
                                />
                            </View>
                        )}
                    </View>
                )}

                {/* Top Row: Like Status & Preview Indicator */}
                <View style={styles.topRow}>
                    {/* Like Status */}
                    {isLiked && (
                        <View style={styles.likeIndicator}>
                            <Ionicons name="heart" size={12} color={Colors.accent} />
                        </View>
                    )}

                    {/* Preview Available Indicator */}
                    {!hasValidPreview && (
                        <View style={styles.noPreviewBadge}>
                            <Ionicons name="volume-mute-outline" size={10} color="rgba(255,255,255,0.6)" />
                        </View>
                    )}
                </View>

                {/* Add/Remove Button */}
                <TouchableOpacity
                    style={[styles.addButton, inStaging && styles.addButtonActive]}
                    onPress={handleAddPress}
                    activeOpacity={0.8}
                >
                    <Ionicons
                        name={inStaging ? 'checkmark' : 'add'}
                        size={16}
                        color={inStaging ? '#fff' : 'rgba(255,255,255,0.8)'}
                    />
                </TouchableOpacity>

                {/* In Staging Indicator */}
                {inStaging && (
                    <View style={styles.stagingBadge}>
                        <Ionicons name="layers" size={10} color="#fff" />
                        <Text style={styles.stagingText}>Seçildi</Text>
                    </View>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: TILE_SIZE,
        height: TILE_SIZE + 20, // Extra height for text
    },
    tile: {
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    tileInStaging: {
        borderColor: Colors.primary,
        borderWidth: 2,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
    },
    image: {
        width: '100%',
        height: '100%',
        position: 'absolute',
    },
    placeholder: {
        backgroundColor: '#151515',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingTop: 30,
        paddingBottom: 8,
        paddingHorizontal: 8,
    },
    trackName: {
        fontSize: 11,
        fontWeight: '600',
        color: '#fff',
        lineHeight: 14,
    },
    artistName: {
        fontSize: 9,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    playButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primaryAlpha(0.9),
        alignItems: 'center',
        justifyContent: 'center',
    },
    playButtonActive: {
        backgroundColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
        elevation: 8,
    },
    playButtonDisabled: {
        backgroundColor: 'rgba(100,100,100,0.8)',
    },
    topRow: {
        position: 'absolute',
        top: 6,
        left: 6,
        right: 6,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    likeIndicator: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    noPreviewBadge: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 'auto',
    },
    addButton: {
        position: 'absolute',
        bottom: 38, // Above the text area
        right: 6,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    addButtonActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    stagingBadge: {
        position: 'absolute',
        top: 6,
        left: 6,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 8,
        gap: 3,
    },
    stagingText: {
        fontSize: 8,
        fontWeight: '700',
        color: '#fff',
    },
});

export default memo(TrackGridItem);
export { TILE_SIZE, GRID_GAP, GRID_PADDING, isValidPreviewUrl };

