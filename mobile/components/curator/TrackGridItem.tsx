/**
 * 🎵 Track Grid Item - Premium Design
 * 
 * Rich album art tile for the Curator's Workbench grid
 * Features:
 * - Album art with glassmorphism overlay
 * - Track name and artist with gradient background
 * - Like status indicator
 * - Preview availability indicator
 * - Press to play, long-press for options
 * - Smooth animations
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
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/theme';
import { CuratorTrack, useCuratorStore } from '../../stores/curatorStore';
import audioService from '../../services/audioService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 10;
const GRID_PADDING = 12;
const TILE_SIZE = (SCREEN_WIDTH - (GRID_PADDING * 2) - (GRID_GAP * 2)) / 3;

interface TrackGridItemProps {
    track: CuratorTrack;
    onPlayPreview?: (track: CuratorTrack) => void;
    isPlaying?: boolean;
    isLiked?: boolean;
    isLoading?: boolean;
}

/**
 * Simple check if preview URL exists and is valid
 * Also handles the "undefined" string case
 */
export function isValidPreviewUrl(url: string | null | undefined): boolean {
    // Quick check for common invalid values
    if (!url || url === 'undefined' || url === 'null' || url === '') return false;
    return audioService.hasPreviewUrl(url);
}

function TrackGridItem({
    track,
    onPlayPreview,
    isPlaying = false,
    isLiked = false,
    isLoading = false
}: TrackGridItemProps) {
    const { addToStaging, isInStaging, removeFromStaging } = useCuratorStore();
    const [imageLoaded, setImageLoaded] = useState(false);
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    const inStaging = isInStaging(track.id);
    const hasValidPreview = isValidPreviewUrl(track.previewUrl);

    // Animate in when image loads
    const handleImageLoad = useCallback(() => {
        setImageLoaded(true);
        Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [opacityAnim]);

    const handlePressIn = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 0.95,
            useNativeDriver: true,
            friction: 8,
        }).start();
    }, [scaleAnim]);

    const handlePressOut = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            friction: 8,
        }).start();
    }, [scaleAnim]);

    const handlePress = useCallback(() => {
        onPlayPreview?.(track);
    }, [track, onPlayPreview]);

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
                onLongPress={handleAddPress}
                delayLongPress={300}
                style={[
                    styles.tile,
                    inStaging && styles.tileInStaging,
                ]}
            >
                {/* Album Art */}
                <Animated.View style={[styles.imageContainer, { opacity: opacityAnim }]}>
                    {track.image ? (
                        <Image
                            source={{ uri: track.image }}
                            style={styles.image}
                            onLoad={handleImageLoad}
                        />
                    ) : (
                        <View style={[styles.image, styles.placeholder]}>
                            <Ionicons name="musical-note" size={28} color="#444" />
                        </View>
                    )}
                </Animated.View>

                {/* Loading placeholder */}
                {!imageLoaded && track.image && (
                    <View style={[styles.image, styles.placeholder, StyleSheet.absoluteFill]}>
                        <ActivityIndicator size="small" color="#444" />
                    </View>
                )}

                {/* Top Status Row - Glassmorphism Background */}
                <View style={styles.topRow}>
                    {/* Like Status */}
                    {isLiked && (
                        <BlurView intensity={40} tint="dark" style={styles.statusBadge}>
                            <Ionicons name="heart" size={10} color={Colors.accent} />
                        </BlurView>
                    )}

                    {/* Preview Status */}
                    {!hasValidPreview && (
                        <BlurView intensity={40} tint="dark" style={[styles.statusBadge, styles.noPreviewBadge]}>
                            <Ionicons name="volume-mute" size={10} color="rgba(255,255,255,0.6)" />
                        </BlurView>
                    )}

                    {/* In Staging Badge */}
                    {inStaging && (
                        <View style={styles.stagingBadge}>
                            <Ionicons name="checkmark" size={10} color="#fff" />
                        </View>
                    )}
                </View>

                {/* Play Button Overlay (centered, shown on press/playing) */}
                {(isPlaying || isLoading) && (
                    <View style={styles.playOverlay}>
                        <BlurView intensity={60} tint="dark" style={styles.playButtonBlur}>
                            {isLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Ionicons
                                    name={isPlaying ? 'pause' : 'play'}
                                    size={20}
                                    color="#fff"
                                />
                            )}
                        </BlurView>
                    </View>
                )}

                {/* Bottom Info - Gradient Background for Readability */}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.9)']}
                    style={styles.infoGradient}
                >
                    <Text style={styles.trackName} numberOfLines={1}>
                        {truncate(track.name, 16)}
                    </Text>
                    <Text style={styles.artistName} numberOfLines={1}>
                        {truncate(track.artist, 18)}
                    </Text>
                </LinearGradient>

                {/* Add Button - Bottom Right */}
                <TouchableOpacity
                    style={[styles.addButton, inStaging && styles.addButtonActive]}
                    onPress={handleAddPress}
                    activeOpacity={0.8}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons
                        name={inStaging ? 'checkmark' : 'add'}
                        size={14}
                        color={inStaging ? '#fff' : 'rgba(255,255,255,0.8)'}
                    />
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: TILE_SIZE,
        height: TILE_SIZE + 8,
    },
    tile: {
        flex: 1,
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: '#151515',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    tileInStaging: {
        borderColor: Colors.primary,
        borderWidth: 2,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 8,
    },
    imageContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        backgroundColor: '#1a1a1a',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Top Row - Status indicators
    topRow: {
        position: 'absolute',
        top: 6,
        left: 6,
        right: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statusBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    noPreviewBadge: {
        marginLeft: 'auto',
    },
    stagingBadge: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 'auto',
    },
    // Play Overlay
    playOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    playButtonBlur: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: Colors.primaryAlpha(0.7),
    },
    // Bottom Info
    infoGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingTop: 28,
        paddingBottom: 8,
        paddingHorizontal: 8,
    },
    trackName: {
        fontSize: 11,
        fontWeight: '600',
        color: '#fff',
        lineHeight: 14,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    artistName: {
        fontSize: 9,
        color: 'rgba(255,255,255,0.75)',
        marginTop: 1,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    // Add Button
    addButton: {
        position: 'absolute',
        bottom: 36,
        right: 6,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    addButtonActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
});

export default memo(TrackGridItem);
export { TILE_SIZE, GRID_GAP, GRID_PADDING };
