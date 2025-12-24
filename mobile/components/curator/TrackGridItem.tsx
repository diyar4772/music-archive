/**
 * 🎵 Track Grid Item - New Curator Design
 * 
 * Album art tile with:
 * - Image with heart icon overlay (top-right)
 * - Track name and artist BELOW the card
 * - Ghost placeholder state for dragging
 * - Smooth press animations
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
import hapticService from '../../services/hapticService';
import { Colors } from '../../constants/theme';
import { CuratorTrack, useCuratorStore } from '../../stores/curatorStore';
import audioService from '../../services/audioService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_PADDING = 16;
const TILE_SIZE = (SCREEN_WIDTH - (GRID_PADDING * 2) - (GRID_GAP * 2)) / 3;
const CARD_HEIGHT = TILE_SIZE + 44; // Image + text below

interface TrackGridItemProps {
    track: CuratorTrack;
    onPlayPreview?: (track: CuratorTrack) => void;
    isPlaying?: boolean;
    isLiked?: boolean;
    isLoading?: boolean;
    isGhost?: boolean; // For drag placeholder
}

/**
 * Check if preview URL is valid
 */
export function isValidPreviewUrl(url: string | null | undefined): boolean {
    if (!url || url === 'undefined' || url === 'null' || url === '') return false;
    return audioService.hasPreviewUrl(url);
}

function TrackGridItem({
    track,
    onPlayPreview,
    isPlaying = false,
    isLiked = false,
    isLoading = false,
    isGhost = false,
}: TrackGridItemProps) {
    const { addToStaging, isInStaging, removeFromStaging } = useCuratorStore();
    const [imageLoaded, setImageLoaded] = useState(false);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const inStaging = isInStaging(track.id);
    const hasValidPreview = isValidPreviewUrl(track.previewUrl);

    // Truncate text
    const truncate = (text: string, maxLen: number) =>
        text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;

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
        if (hasValidPreview) {
            onPlayPreview?.(track);
        }
    }, [track, onPlayPreview, hasValidPreview]);

    const handleAddPress = useCallback(() => {
        if (inStaging) {
            removeFromStaging(track.id);
            hapticService.warning();
        } else {
            const added = addToStaging(track);
            if (added) {
                hapticService.success();
            } else {
                hapticService.error();
            }
        }
    }, [inStaging, track, addToStaging, removeFromStaging]);

    // Ghost Placeholder - Shown when item is being dragged
    if (isGhost) {
        return (
            <View style={styles.container}>
                <View style={styles.ghostCard}>
                    <View style={styles.ghostImage} />
                </View>
                <View style={styles.textContainer}>
                    <View style={styles.ghostText} />
                    <View style={[styles.ghostText, styles.ghostTextSmall]} />
                </View>
            </View>
        );
    }

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
                    styles.card,
                    inStaging && styles.cardInStaging,
                ]}
            >
                {/* Album Art */}
                <View style={styles.imageWrapper}>
                    {track.image ? (
                        <Image
                            source={{ uri: track.image }}
                            style={styles.image}
                            onLoad={() => setImageLoaded(true)}
                        />
                    ) : (
                        <View style={[styles.image, styles.placeholder]}>
                            <Ionicons name="musical-note" size={28} color="#444" />
                        </View>
                    )}

                    {/* Loading Placeholder */}
                    {!imageLoaded && track.image && (
                        <View style={[styles.image, styles.placeholder, StyleSheet.absoluteFill]}>
                            <ActivityIndicator size="small" color="#444" />
                        </View>
                    )}

                    {/* Heart Icon - Top Right */}
                    {isLiked && (
                        <View style={styles.heartBadge}>
                            <Ionicons name="heart" size={14} color={Colors.primary} />
                        </View>
                    )}

                    {/* In Staging Checkmark - Top Left */}
                    {inStaging && (
                        <View style={styles.stagingBadge}>
                            <Ionicons name="checkmark" size={12} color="#fff" />
                        </View>
                    )}

                    {/* Play Overlay */}
                    {(isPlaying || isLoading) && (
                        <View style={styles.playOverlay}>
                            <View style={styles.playButton}>
                                {isLoading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Ionicons name="pause" size={22} color="#fff" />
                                )}
                            </View>
                        </View>
                    )}

                    {/* Add Button - Bottom Right */}
                    <TouchableOpacity
                        style={[styles.addButton, inStaging && styles.addButtonActive]}
                        onPress={handleAddPress}
                        activeOpacity={0.8}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons
                            name={inStaging ? 'checkmark' : 'add'}
                            size={16}
                            color="#fff"
                        />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>

            {/* Text Below Card */}
            <View style={styles.textContainer}>
                <Text style={styles.trackName} numberOfLines={1}>
                    {truncate(track.name, 14)}
                </Text>
                <Text style={styles.artistName} numberOfLines={1}>
                    {truncate(track.artist, 16)}
                </Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: TILE_SIZE,
        height: CARD_HEIGHT,
        paddingHorizontal: 6,
        paddingTop: 6,
    },
    card: {
        width: TILE_SIZE - 12,
        height: TILE_SIZE - 12,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: '#151022',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    cardInStaging: {
        borderColor: 'rgba(137, 90, 246, 0.5)',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
    imageWrapper: {
        flex: 1,
        position: 'relative',
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
    // Heart Badge - Top Right
    heartBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 10,
        padding: 4,
    },
    // Staging Badge - Top Left
    stagingBadge: {
        position: 'absolute',
        top: 6,
        left: 6,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Play Overlay
    playOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    playButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(137, 90, 246, 0.9)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Add Button - Bottom Right
    addButton: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    addButtonActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    // Text Container - Below Image
    textContainer: {
        paddingHorizontal: 2,
        paddingTop: 8,
    },
    trackName: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
        lineHeight: 15,
    },
    artistName: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
        lineHeight: 13,
    },
    // Ghost State
    ghostCard: {
        width: TILE_SIZE - 12,
        height: TILE_SIZE - 12,
        borderRadius: 10,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(21,16,34,0.5)',
    },
    ghostImage: {
        flex: 1,
        borderRadius: 8,
    },
    ghostText: {
        height: 12,
        width: 50,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 4,
        marginTop: 8,
    },
    ghostTextSmall: {
        height: 10,
        width: 35,
        marginTop: 4,
    },
});

export default memo(TrackGridItem);
export { TILE_SIZE, GRID_GAP, GRID_PADDING, CARD_HEIGHT };
