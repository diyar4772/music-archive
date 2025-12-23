/**
 * 🎵 Draggable Track Component - 60fps Drag & Drop
 * 
 * Uses react-native-reanimated and gesture-handler for smooth animations.
 * Features:
 * - 60fps pan gesture animations on UI thread
 * - Ghost component shows song name + artist during drag
 * - Scale + shadow effects when dragging
 * - Haptic feedback on drag start/end
 * - Communicates position to parent for drop zone detection
 */

import React, { memo, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    Image,
    StyleSheet,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS,
    useAnimatedGestureHandler,
} from 'react-native-reanimated';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import { Colors } from '../../constants/theme';
import { CuratorTrack } from '../../stores/curatorStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 10;
const GRID_PADDING = 12;
const TILE_SIZE = (SCREEN_WIDTH - (GRID_PADDING * 2) - (GRID_GAP * 2)) / 3;

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

type AnimatedGHContext = {
    startX: number;
    startY: number;
};

function DraggableTrack({
    track,
    isLiked = false,
    onDragStart,
    onDragEnd,
    onDragMove,
    onTap,
    disabled = false,
}: DraggableTrackProps) {
    // Shared values for animation (runs on UI thread)
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const isDragging = useSharedValue(false);
    const shadowOpacity = useSharedValue(0);
    const zIndex = useSharedValue(1);

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

    // Gesture handler
    const gestureHandler = useAnimatedGestureHandler<
        PanGestureHandlerGestureEvent,
        AnimatedGHContext
    >({
        onStart: (_, ctx) => {
            ctx.startX = translateX.value;
            ctx.startY = translateY.value;
            isDragging.value = true;
            scale.value = withSpring(1.08, SPRING_CONFIG);
            shadowOpacity.value = withTiming(1, { duration: 150 });
            zIndex.value = 1000;
            runOnJS(triggerHapticStart)();
        },
        onActive: (event, ctx) => {
            translateX.value = ctx.startX + event.translationX;
            translateY.value = ctx.startY + event.translationY;

            // Notify parent of position for drop zone detection
            runOnJS(notifyMove)(
                event.absoluteX,
                event.absoluteY
            );
        },
        onEnd: (event) => {
            // Snap back to origin
            translateX.value = withSpring(0, SPRING_CONFIG);
            translateY.value = withSpring(0, SPRING_CONFIG);
            scale.value = withSpring(1, SPRING_CONFIG);
            shadowOpacity.value = withTiming(0, { duration: 150 });
            isDragging.value = false;
            zIndex.value = 1;

            runOnJS(triggerHapticEnd)(
                event.absoluteX,
                event.absoluteY
            );
        },
        onCancel: () => {
            translateX.value = withSpring(0, SPRING_CONFIG);
            translateY.value = withSpring(0, SPRING_CONFIG);
            scale.value = withSpring(1, SPRING_CONFIG);
            shadowOpacity.value = withTiming(0, { duration: 150 });
            isDragging.value = false;
            zIndex.value = 1;
        },
    });

    // Animated styles (run on UI thread)
    const animatedContainerStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
        zIndex: zIndex.value,
    }));

    const animatedShadowStyle = useAnimatedStyle(() => ({
        shadowOpacity: shadowOpacity.value * 0.6,
        elevation: isDragging.value ? 20 : 4,
    }));

    // Ghost info overlay - visible during drag
    const animatedGhostStyle = useAnimatedStyle(() => ({
        opacity: isDragging.value ? withTiming(1, { duration: 100 }) : withTiming(0, { duration: 100 }),
        transform: [{ scale: isDragging.value ? 1 : 0.9 }],
    }));

    // Truncate helper
    const truncate = (text: string, maxLen: number) =>
        text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;

    return (
        <PanGestureHandler
            onGestureEvent={gestureHandler}
            enabled={!disabled}
            minDist={10}
            activeOffsetX={[-10, 10]}
            activeOffsetY={[-10, 10]}
        >
            <Animated.View
                style={[
                    styles.container,
                    animatedContainerStyle,
                    animatedShadowStyle,
                ]}
            >
                {/* Main tile content */}
                <View style={styles.tile}>
                    {/* Album Art */}
                    {track.image ? (
                        <Image
                            source={{ uri: track.image }}
                            style={styles.image}
                        />
                    ) : (
                        <View style={[styles.image, styles.placeholder]}>
                            <Ionicons name="musical-note" size={28} color="#444" />
                        </View>
                    )}

                    {/* Like indicator */}
                    {isLiked && (
                        <View style={styles.topRow}>
                            <BlurView intensity={40} tint="dark" style={styles.statusBadge}>
                                <Ionicons name="heart" size={10} color={Colors.accent} />
                            </BlurView>
                        </View>
                    )}

                    {/* Bottom Info Gradient */}
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

                    {/* Drag Handle Indicator */}
                    <View style={styles.dragHandle}>
                        <Ionicons name="menu" size={14} color="rgba(255,255,255,0.5)" />
                    </View>
                </View>

                {/* Ghost Component - Shown during drag */}
                <Animated.View style={[styles.ghostOverlay, animatedGhostStyle]}>
                    <BlurView intensity={80} tint="dark" style={styles.ghostContent}>
                        <View style={styles.ghostInfo}>
                            <Ionicons name="musical-notes" size={16} color={Colors.primary} />
                            <View style={styles.ghostTextContainer}>
                                <Text style={styles.ghostTrackName} numberOfLines={1}>
                                    {track.name}
                                </Text>
                                <Text style={styles.ghostArtistName} numberOfLines={1}>
                                    {track.artist}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.dropHint}>
                            <Ionicons name="arrow-down" size={12} color={Colors.accent} />
                            <Text style={styles.dropHintText}>Staging'e bırak</Text>
                        </View>
                    </BlurView>
                </Animated.View>
            </Animated.View>
        </PanGestureHandler>
    );
}

const styles = StyleSheet.create({
    container: {
        width: TILE_SIZE,
        height: TILE_SIZE + 8,
        // Shadow for dragging effect
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 16,
    },
    tile: {
        flex: 1,
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: '#151515',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    image: {
        width: '100%',
        height: '100%',
        position: 'absolute',
    },
    placeholder: {
        backgroundColor: '#1a1a1a',
        alignItems: 'center',
        justifyContent: 'center',
    },
    topRow: {
        position: 'absolute',
        top: 6,
        left: 6,
        flexDirection: 'row',
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
    dragHandle: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 20,
        height: 20,
        borderRadius: 4,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Ghost overlay - shows track info when dragging
    ghostOverlay: {
        position: 'absolute',
        top: TILE_SIZE + 12,
        left: -TILE_SIZE / 2,
        right: -TILE_SIZE / 2,
        alignItems: 'center',
    },
    ghostContent: {
        borderRadius: 12,
        overflow: 'hidden',
        padding: 12,
        minWidth: TILE_SIZE * 1.8,
    },
    ghostInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    ghostTextContainer: {
        flex: 1,
    },
    ghostTrackName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#fff',
    },
    ghostArtistName: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2,
    },
    dropHint: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        gap: 4,
    },
    dropHintText: {
        fontSize: 10,
        color: Colors.accent,
        fontWeight: '500',
    },
});

export default memo(DraggableTrack);
export { TILE_SIZE, GRID_GAP, GRID_PADDING };

