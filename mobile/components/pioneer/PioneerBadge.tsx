/**
 * 🏆 Pioneer Badge Component
 * 
 * Displays user's Pioneer System progress and status.
 * Features:
 * - Progress bar (X/10 playlists)
 * - Tier badges with colors (Bronze/Silver/Gold)
 * - Confetti animation on milestone completion
 * - Premium status indicator
 */

import React, { memo, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import hapticService from '../../services/hapticService';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withSequence,
    withDelay,
    withRepeat,
    Easing,
    runOnJS,
    interpolate,
    interpolateColor,
} from 'react-native-reanimated';
import { Colors } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Tier configuration
const TIERS = {
    none: {
        name: 'Başlangıç',
        color: '#666',
        gradient: ['#333', '#444'] as [string, string],
        icon: 'star-outline' as const,
        min: 0,
    },
    bronze: {
        name: 'Bronze Pioneer',
        color: '#CD7F32',
        gradient: ['#8B4513', '#CD7F32'] as [string, string],
        icon: 'star' as const,
        min: 10,
    },
    silver: {
        name: 'Silver Pioneer',
        color: '#C0C0C0',
        gradient: ['#708090', '#C0C0C0'] as [string, string],
        icon: 'star' as const,
        min: 25,
    },
    gold: {
        name: 'Gold Pioneer',
        color: '#FFD700',
        gradient: ['#DAA520', '#FFD700'] as [string, string],
        icon: 'star' as const,
        min: 50,
    },
};

type TierType = keyof typeof TIERS;

interface PioneerBadgeProps {
    /** Current playlist count */
    playlistCount: number;
    /** User's current tier */
    tier?: TierType;
    /** Whether user has premium */
    isPremium?: boolean;
    /** Premium expiry date (if applicable) */
    premiumUntil?: Date | null;
    /** Compact mode for smaller displays */
    compact?: boolean;
    /** Show confetti animation */
    showConfetti?: boolean;
    /** Callback when confetti ends */
    onConfettiEnd?: () => void;
}

// Confetti particle component
const ConfettiParticle = memo(({ delay, color, startX }: { delay: number; color: string; startX: number }) => {
    const translateY = useSharedValue(-50);
    const translateX = useSharedValue(startX);
    const rotation = useSharedValue(0);
    const opacity = useSharedValue(1);
    const scale = useSharedValue(1);

    useEffect(() => {
        translateY.value = withDelay(
            delay,
            withTiming(SCREEN_WIDTH * 1.2, {
                duration: 2500 + Math.random() * 1000,
                easing: Easing.out(Easing.quad),
            })
        );
        translateX.value = withDelay(
            delay,
            withSequence(
                withTiming(startX + (Math.random() - 0.5) * 100, { duration: 800 }),
                withTiming(startX + (Math.random() - 0.5) * 150, { duration: 1200 }),
                withTiming(startX + (Math.random() - 0.5) * 200, { duration: 1500 })
            )
        );
        rotation.value = withDelay(
            delay,
            withRepeat(
                withTiming(360, { duration: 1000, easing: Easing.linear }),
                -1
            )
        );
        opacity.value = withDelay(
            delay + 1500,
            withTiming(0, { duration: 1000 })
        );
        scale.value = withDelay(
            delay,
            withSequence(
                withSpring(1.2),
                withTiming(0.6, { duration: 2000 })
            )
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { rotate: `${rotation.value}deg` },
            { scale: scale.value },
        ],
        opacity: opacity.value,
    }));

    return (
        <Animated.View style={[styles.confettiParticle, animatedStyle, { backgroundColor: color }]} />
    );
});

function PioneerBadge({
    playlistCount,
    tier = 'none',
    isPremium = false,
    premiumUntil,
    compact = false,
    showConfetti = false,
    onConfettiEnd,
}: PioneerBadgeProps) {
    const [confettiVisible, setConfettiVisible] = useState(false);
    const progressAnim = useSharedValue(0);
    const badgeScale = useSharedValue(1);
    const glowOpacity = useSharedValue(0);

    // Calculate progress to next tier
    const currentTierConfig = TIERS[tier];
    const nextTier = tier === 'gold' ? 'gold'
        : tier === 'silver' ? 'gold'
            : tier === 'bronze' ? 'silver'
                : 'bronze';
    const nextTierConfig = TIERS[nextTier];

    const targetCount = nextTierConfig.min;
    const previousTierMax = tier === 'none' ? 0 : currentTierConfig.min;
    const progressInTier = playlistCount - previousTierMax;
    const tierRange = targetCount - previousTierMax;
    const progressPercent = tier === 'gold' ? 100 : Math.min((progressInTier / tierRange) * 100, 100);

    // Animate progress bar on mount/change
    useEffect(() => {
        progressAnim.value = withSpring(progressPercent, {
            damping: 15,
            stiffness: 90,
        });
    }, [progressPercent]);

    // Handle confetti
    useEffect(() => {
        if (showConfetti) {
            setConfettiVisible(true);
            hapticService.success();

            // Badge celebration animation
            badgeScale.value = withSequence(
                withSpring(1.2),
                withSpring(1)
            );
            glowOpacity.value = withSequence(
                withTiming(1, { duration: 500 }),
                withTiming(0.3, { duration: 500 }),
                withRepeat(
                    withSequence(
                        withTiming(0.6, { duration: 800 }),
                        withTiming(0.3, { duration: 800 })
                    ),
                    3
                ),
                withTiming(0, { duration: 500 })
            );

            // Hide confetti after animation
            const timer = setTimeout(() => {
                setConfettiVisible(false);
                onConfettiEnd?.();
            }, 3500);

            return () => clearTimeout(timer);
        }
    }, [showConfetti]);

    // Animated styles
    const progressBarStyle = useAnimatedStyle(() => ({
        width: `${progressAnim.value}%`,
    }));

    const badgeStyle = useAnimatedStyle(() => ({
        transform: [{ scale: badgeScale.value }],
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
    }));

    // Generate confetti particles
    const confettiColors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#9B59B6', '#F39C12', Colors.primary, Colors.accent];
    const confettiParticles = confettiVisible ? Array.from({ length: 30 }).map((_, i) => ({
        id: i,
        delay: Math.random() * 400,
        color: confettiColors[i % confettiColors.length],
        startX: Math.random() * SCREEN_WIDTH,
    })) : [];

    if (compact) {
        return (
            <View style={styles.compactContainer}>
                <Animated.View style={[styles.compactBadge, badgeStyle]}>
                    <LinearGradient
                        colors={currentTierConfig.gradient}
                        style={styles.compactGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Ionicons
                            name={currentTierConfig.icon}
                            size={14}
                            color="#fff"
                        />
                    </LinearGradient>
                </Animated.View>
                <Text style={styles.compactText}>
                    {playlistCount}/{targetCount}
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Confetti overlay */}
            {confettiVisible && (
                <View style={styles.confettiContainer} pointerEvents="none">
                    {confettiParticles.map(p => (
                        <ConfettiParticle
                            key={p.id}
                            delay={p.delay}
                            color={p.color}
                            startX={p.startX}
                        />
                    ))}
                </View>
            )}

            {/* Glow effect */}
            <Animated.View style={[styles.glowLayer, glowStyle]}>
                <LinearGradient
                    colors={[currentTierConfig.color + '40', 'transparent']}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>

            {/* Badge card */}
            <BlurView intensity={20} tint="dark" style={styles.card}>
                {/* Badge icon */}
                <Animated.View style={[styles.badgeIconContainer, badgeStyle]}>
                    <LinearGradient
                        colors={currentTierConfig.gradient}
                        style={styles.badgeGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Ionicons
                            name={currentTierConfig.icon}
                            size={28}
                            color="#fff"
                        />
                    </LinearGradient>
                </Animated.View>

                {/* Badge info */}
                <View style={styles.infoContainer}>
                    <Text style={styles.tierName}>{currentTierConfig.name}</Text>

                    {/* Progress section */}
                    <View style={styles.progressSection}>
                        <View style={styles.progressLabelRow}>
                            <Text style={styles.progressLabel}>
                                {playlistCount} / {targetCount} Playlist
                            </Text>
                            <Text style={styles.progressPercent}>
                                {Math.round(progressPercent)}%
                            </Text>
                        </View>

                        <View style={styles.progressBarContainer}>
                            <Animated.View style={[styles.progressBarFill, progressBarStyle]}>
                                <LinearGradient
                                    colors={[currentTierConfig.color, Colors.primary]}
                                    style={StyleSheet.absoluteFill}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                />
                            </Animated.View>
                        </View>

                        {tier !== 'gold' && (
                            <Text style={styles.nextTierHint}>
                                {targetCount - playlistCount} liste daha → {nextTierConfig.name}
                            </Text>
                        )}
                    </View>

                    {/* Premium indicator */}
                    {isPremium && (
                        <View style={styles.premiumBadge}>
                            <Ionicons name="diamond" size={12} color={Colors.accent} />
                            <Text style={styles.premiumText}>Premium Aktif</Text>
                            {premiumUntil && (
                                <Text style={styles.premiumDate}>
                                    {new Date(premiumUntil).toLocaleDateString('tr-TR')}
                                </Text>
                            )}
                        </View>
                    )}
                </View>
            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginVertical: 12,
        borderRadius: 20,
        overflow: 'hidden',
    },
    glowLayer: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 20,
    },
    confettiContainer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
        overflow: 'visible',
    },
    confettiParticle: {
        position: 'absolute',
        width: 10,
        height: 10,
        borderRadius: 2,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        backgroundColor: 'rgba(30, 30, 36, 0.8)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    badgeIconContainer: {
        marginRight: 16,
    },
    badgeGradient: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    infoContainer: {
        flex: 1,
    },
    tierName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
    },
    progressSection: {
        gap: 6,
    },
    progressLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    progressLabel: {
        fontSize: 12,
        color: Colors.textMuted,
    },
    progressPercent: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.primary,
    },
    progressBarContainer: {
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    nextTierHint: {
        fontSize: 11,
        color: Colors.textMuted,
        fontStyle: 'italic',
    },
    premiumBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 10,
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: 'rgba(244, 114, 182, 0.15)',
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    premiumText: {
        fontSize: 11,
        fontWeight: '600',
        color: Colors.accent,
    },
    premiumDate: {
        fontSize: 10,
        color: Colors.textMuted,
        marginLeft: 4,
    },
    // Compact mode
    compactContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    compactBadge: {
        overflow: 'hidden',
        borderRadius: 12,
    },
    compactGradient: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    compactText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
});

export default memo(PioneerBadge);
export { TIERS };
export type { TierType };

