/**
 * 🎵 Draggable Track Component - Floating Ghost Design
 * 
 * Based on HTML reference design with:
 * - Floating ghost card during drag
 * - Scale 1.1 + rotation effect
 * - Shadow and glow effects
 * - Album art with info overlay
 * - Pulsing animation ring
 */

import React, { memo, useCallback } from 'react';
import {
    View,
    Text,
    Image,
    StyleSheet,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withRepeat,
    runOnJS,
    interpolate,
    Extrapolate,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Colors } from '../../constants/theme';
import { CuratorTrack } from '../../stores/curatorStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_PADDING = 16;
const TILE_SIZE = (SCREEN_WIDTH - (GRID_PADDING * 2) - (GRID_GAP * 2)) / 3;
const CARD_HEIGHT = TILE_SIZE + 44;

// Spring config for natural feel
const SPRING_CONFIG = {
    damping: 15,
    stiffness: 150,
    mass: 0.8,
};

interface DraggableTrackProps {
    track: CuratorTrack;
    isLiked?: boolean;
    onDragStart?: (track: CuratorTrack) => void;
    onDragEnd?: (track: CuratorTrack, position: { x: number; y: number }) => void;
    onDragMove?: (position: { x: number; y: number }) => void;
    onTap?: (track: CuratorTrack) => void;
    disabled?: boolean;
}

function DraggableTrack({
    track,
    isLiked = false,
    onDragStart,
    onDragEnd,
    onDragMove,
    onTap,
    disabled = false,
}: DraggableTrackProps) {
    // Shared values for animation
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const isDragging = useSharedValue(0); // 0 = not dragging, 1 = dragging
    const rotation = useSharedValue(0);
    const pulseScale = useSharedValue(1);
    const startX = useSharedValue(0);
    const startY = useSharedValue(0);

    // JS callbacks
    const triggerHapticStart = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onDragStart?.(track);
    }, [track, onDragStart]);

    const triggerHapticEnd = useCallback((x: number, y: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onDragEnd?.(track, { x, y });
    }, [track, onDragEnd]);

    const notifyMove = useCallback((x: number, y: number) => {
        onDragMove?.({ x, y });
    }, [onDragMove]);

    const handleTap = useCallback(() => {
        Haptics.selectionAsync();
        onTap?.(track);
    }, [track, onTap]);

    // Pan gesture using new Gesture API
    const panGesture = Gesture.Pan()
        .enabled(!disabled)
        .minDistance(10)
        .onStart(() => {
            'worklet';
            startX.value = translateX.value;
            startY.value = translateY.value;
            isDragging.value = withTiming(1, { duration: 150 });
            scale.value = withSpring(1.1, SPRING_CONFIG);
            rotation.value = withSpring(3, SPRING_CONFIG);
            // Start pulse animation
            pulseScale.value = withRepeat(
                withTiming(1.3, { duration: 800 }),
                -1,
                true
            );
            runOnJS(triggerHapticStart)();
        })
        .onUpdate((event) => {
            'worklet';
            translateX.value = startX.value + event.translationX;
            translateY.value = startY.value + event.translationY;
            runOnJS(notifyMove)(event.absoluteX, event.absoluteY);
        })
        .onEnd((event) => {
            'worklet';
            translateX.value = withSpring(0, SPRING_CONFIG);
            translateY.value = withSpring(0, SPRING_CONFIG);
            scale.value = withSpring(1, SPRING_CONFIG);
            rotation.value = withSpring(0, SPRING_CONFIG);
            isDragging.value = withTiming(0, { duration: 150 });
            pulseScale.value = 1;
            runOnJS(triggerHapticEnd)(event.absoluteX, event.absoluteY);
        })
        .onFinalize(() => {
            'worklet';
            translateX.value = withSpring(0, SPRING_CONFIG);
            translateY.value = withSpring(0, SPRING_CONFIG);
            scale.value = withSpring(1, SPRING_CONFIG);
            rotation.value = withSpring(0, SPRING_CONFIG);
            isDragging.value = withTiming(0, { duration: 150 });
            pulseScale.value = 1;
        });

    // Tap gesture
    const tapGesture = Gesture.Tap()
        .enabled(!disabled)
        .onStart(() => {
            'worklet';
            runOnJS(handleTap)();
        });

    // Compose gestures
    const composedGesture = Gesture.Exclusive(panGesture, tapGesture);

    // Animated styles
    const animatedContainerStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
            { rotate: `${rotation.value}deg` },
        ],
        zIndex: isDragging.value > 0.5 ? 1000 : 1,
    }));

    // Shadow style during drag
    const animatedShadowStyle = useAnimatedStyle(() => ({
        shadowOpacity: interpolate(isDragging.value, [0, 1], [0, 0.6], Extrapolate.CLAMP),
        elevation: interpolate(isDragging.value, [0, 1], [0, 20], Extrapolate.CLAMP),
    }));

    // Ghost overlay style
    const animatedGhostStyle = useAnimatedStyle(() => ({
        opacity: isDragging.value,
    }));

    // Pulse ring style
    const animatedPulseStyle = useAnimatedStyle(() => ({
        opacity: interpolate(isDragging.value, [0, 1], [0, 0.5], Extrapolate.CLAMP),
        transform: [{ scale: pulseScale.value }],
    }));

    // Truncate helper
    const truncate = (text: string, maxLen: number) =>
        text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;

    return (
        <GestureDetector gesture={composedGesture}>
            <Animated.View style={[styles.container, animatedContainerStyle, animatedShadowStyle]}>
                {/* Pulse Ring - Behind card during drag */}
                <Animated.View style={[styles.pulseRing, animatedPulseStyle]} />

                {/* Main Card */}
                <View style={styles.card}>
                    {/* Album Art */}
                    <View style={styles.imageContainer}>
                        {track.image ? (
                            <Image source={{ uri: track.image }} style={styles.image} />
                        ) : (
                            <View style={[styles.image, styles.placeholder]}>
                                <Ionicons name="musical-note" size={28} color="#444" />
                            </View>
                        )}

                        {/* Gradient Overlay for text */}
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.7)']}
                            style={styles.imageGradient}
                        />

                        {/* Heart Badge - Bottom Right of image */}
                        {isLiked && (
                            <View style={styles.heartBadge}>
                                <Ionicons name="heart" size={14} color={Colors.primary} />
                            </View>
                        )}
                    </View>
                </View>

                {/* Text Below Card */}
                <View style={styles.textContainer}>
                    <Text style={styles.trackName} numberOfLines={1}>
                        {truncate(track.name, 14)}
                    </Text>
                    <Text style={styles.artistName} numberOfLines={1}>
                        {truncate(track.artist, 16)}
                    </Text>
                </View>

                {/* Ghost Info - Shows during drag */}
                <Animated.View style={[styles.ghostInfo, animatedGhostStyle]}>
                    <View style={styles.ghostCard}>
                        <Text style={styles.ghostTrackName} numberOfLines={1}>
                            {track.name}
                        </Text>
                        <Text style={styles.ghostArtistName} numberOfLines={1}>
                            {track.artist}
                        </Text>
                    </View>
                </Animated.View>
            </Animated.View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    container: {
        width: TILE_SIZE,
        height: CARD_HEIGHT,
        paddingHorizontal: 6,
        paddingTop: 6,
        // Shadow for dragging
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 12 },
        shadowRadius: 20,
    },
    // Pulse animation ring
    pulseRing: {
        position: 'absolute',
        top: -10,
        left: -10,
        width: TILE_SIZE + 8,
        height: TILE_SIZE + 8,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(137, 90, 246, 0.1)',
    },
    card: {
        width: TILE_SIZE - 12,
        height: TILE_SIZE - 12,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#1f1b27',
        borderWidth: 1,
        borderColor: 'rgba(137, 90, 246, 0.3)',
    },
    imageContainer: {
        flex: 1,
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    imageGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    placeholder: {
        backgroundColor: '#1a1a1a',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heartBadge: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Text below card
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
    // Ghost info overlay
    ghostInfo: {
        position: 'absolute',
        bottom: -40,
        left: -20,
        right: -20,
        alignItems: 'center',
    },
    ghostCard: {
        backgroundColor: 'rgba(31, 27, 39, 0.95)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(137, 90, 246, 0.4)',
        minWidth: 120,
    },
    ghostTrackName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
    },
    ghostArtistName: {
        fontSize: 11,
        color: Colors.primary,
        marginTop: 2,
        textAlign: 'center',
    },
});

export default memo(DraggableTrack);
export { TILE_SIZE, GRID_GAP, GRID_PADDING, CARD_HEIGHT };
