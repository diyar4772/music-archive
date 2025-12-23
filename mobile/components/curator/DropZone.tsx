/**
 * 🎯 Drop Zone Component - Visual Feedback for Drag & Drop
 * 
 * A target area that provides visual and haptic feedback
 * when items are dragged over and dropped on it.
 * 
 * Features:
 * - Animated border pulse when active
 * - Scale and glow effects on hover
 * - Haptic feedback on successful drop
 * - Customizable styling
 */

import React, { memo, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    LayoutRectangle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    withSpring,
    Easing,
    cancelAnimation,
} from 'react-native-reanimated';
import { Colors } from '../../constants/theme';
import { CuratorTrack } from '../../stores/curatorStore';

interface DropZoneProps {
    /** Called when an item is dropped on this zone */
    onDrop: (track: CuratorTrack) => void;
    /** Current drag position from parent */
    dragPosition: { x: number; y: number } | null;
    /** Track currently being dragged */
    draggingTrack: CuratorTrack | null;
    /** Whether a drag is in progress */
    isDragging: boolean;
    /** Custom label text */
    label?: string;
    /** Icon name */
    icon?: keyof typeof Ionicons.glyphMap;
    /** Zone identifier for multi-zone layouts */
    zoneId?: string;
    /** Children to render inside the zone */
    children?: React.ReactNode;
}

function DropZone({
    onDrop,
    dragPosition,
    draggingTrack,
    isDragging,
    label = 'Buraya bırak',
    icon = 'add-circle',
    zoneId,
    children,
}: DropZoneProps) {
    const layoutRef = useRef<LayoutRectangle | null>(null);
    const viewRef = useRef<View>(null);
    const wasActive = useRef(false);

    // Animation values
    const isOver = useSharedValue(false);
    const pulseAnim = useSharedValue(1);
    const borderOpacity = useSharedValue(0.3);
    const scale = useSharedValue(1);
    const glowOpacity = useSharedValue(0);

    // Check if drag position is within this zone
    const checkIsOver = useCallback((x: number, y: number): boolean => {
        if (!layoutRef.current) return false;

        const { x: zoneX, y: zoneY, width, height } = layoutRef.current;

        return (
            x >= zoneX &&
            x <= zoneX + width &&
            y >= zoneY &&
            y <= zoneY + height
        );
    }, []);

    // Handle layout measurement
    const handleLayout = useCallback(() => {
        viewRef.current?.measureInWindow((x, y, width, height) => {
            layoutRef.current = { x, y, width, height };
        });
    }, []);

    // Watch for drag position changes
    useEffect(() => {
        if (!isDragging || !dragPosition) {
            // Drag ended - reset state
            isOver.value = false;
            cancelAnimation(pulseAnim);
            pulseAnim.value = withTiming(1, { duration: 200 });
            borderOpacity.value = withTiming(0.3, { duration: 200 });
            scale.value = withSpring(1);
            glowOpacity.value = withTiming(0, { duration: 200 });
            wasActive.current = false;
            return;
        }

        const nowOver = checkIsOver(dragPosition.x, dragPosition.y);

        if (nowOver && !wasActive.current) {
            // Just entered zone
            wasActive.current = true;
            isOver.value = true;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            // Start pulse animation
            pulseAnim.value = withRepeat(
                withSequence(
                    withTiming(1.03, { duration: 400, easing: Easing.inOut(Easing.ease) }),
                    withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                true
            );

            borderOpacity.value = withTiming(1, { duration: 200 });
            scale.value = withSpring(1.02);
            glowOpacity.value = withTiming(0.4, { duration: 200 });
        } else if (!nowOver && wasActive.current) {
            // Just left zone
            wasActive.current = false;
            isOver.value = false;

            cancelAnimation(pulseAnim);
            pulseAnim.value = withTiming(1, { duration: 200 });
            borderOpacity.value = withTiming(0.3, { duration: 200 });
            scale.value = withSpring(1);
            glowOpacity.value = withTiming(0, { duration: 200 });
        }
    }, [dragPosition, isDragging, checkIsOver]);

    // Handle drop when drag ends while over zone
    useEffect(() => {
        if (!isDragging && wasActive.current && draggingTrack) {
            // Item was dropped while over this zone
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onDrop(draggingTrack);
            wasActive.current = false;
        }
    }, [isDragging, draggingTrack, onDrop]);

    // Animated styles
    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const borderStyle = useAnimatedStyle(() => ({
        borderColor: isOver.value
            ? Colors.primary
            : `rgba(255, 255, 255, ${borderOpacity.value})`,
        borderWidth: isOver.value ? 2 : 1,
        transform: [{ scale: pulseAnim.value }],
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
    }));

    const contentOpacity = useAnimatedStyle(() => ({
        opacity: isDragging ? 1 : 0.6,
    }));

    return (
        <Animated.View
            style={[styles.container, containerStyle]}
        >
            {/* Glow effect layer */}
            <Animated.View style={[styles.glowLayer, glowStyle]} />

            {/* Main drop zone */}
            <View
                ref={viewRef}
                onLayout={handleLayout}
                style={styles.innerContainer}
            >
                <Animated.View style={[styles.dropArea, borderStyle]}>
                    {children ? (
                        children
                    ) : (
                        <Animated.View style={[styles.placeholderContent, contentOpacity]}>
                            <Ionicons
                                name={icon}
                                size={32}
                                color={isOver.value ? Colors.primary : Colors.textMuted}
                            />
                            <Text style={[
                                styles.label,
                                isOver.value && styles.labelActive
                            ]}>
                                {label}
                            </Text>
                            {isDragging && (
                                <View style={styles.hintContainer}>
                                    <Ionicons
                                        name="arrow-down"
                                        size={16}
                                        color={Colors.accent}
                                    />
                                </View>
                            )}
                        </Animated.View>
                    )}
                </Animated.View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    glowLayer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Colors.primary,
        borderRadius: 16,
        opacity: 0,
    },
    innerContainer: {
        flex: 1,
    },
    dropArea: {
        flex: 1,
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(255, 255, 255, 0.3)',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        overflow: 'hidden',
    },
    placeholderContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: '500',
        color: Colors.textMuted,
        textAlign: 'center',
    },
    labelActive: {
        color: Colors.primary,
    },
    hintContainer: {
        marginTop: 4,
    },
});

export default memo(DropZone);

