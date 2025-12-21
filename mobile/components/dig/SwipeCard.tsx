import React, { useRef, useCallback } from 'react';
import {
    View,
    Text,
    Image,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    Animated,
    PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { DigTrack } from '../../services/dig';
import { Colors } from '../../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.62;
const SWIPE_THRESHOLD = 120;
const ROTATION_LIMIT = 15;

interface SwipeCardProps {
    track: DigTrack;
    onSwipe: (direction: 'left' | 'right' | 'up') => void;
    onPlay: () => void;
    isPlaying: boolean;
    isFirst: boolean;
}

export default function SwipeCard({
    track,
    onSwipe,
    onPlay,
    isPlaying,
    isFirst,
}: SwipeCardProps) {
    const position = useRef(new Animated.ValueXY()).current;
    const hapticTriggered = useRef(false);

    const rotate = position.x.interpolate({
        inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        outputRange: [`-${ROTATION_LIMIT}deg`, '0deg', `${ROTATION_LIMIT}deg`],
        extrapolate: 'clamp',
    });

    const archiveOpacity = position.x.interpolate({
        inputRange: [0, SWIPE_THRESHOLD],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    const passOpacity = position.x.interpolate({
        inputRange: [-SWIPE_THRESHOLD, 0],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });

    const exploreOpacity = position.y.interpolate({
        inputRange: [-100, 0],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });

    const resetPosition = useCallback(() => {
        Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            friction: 5,
        }).start();
    }, [position]);

    const forceSwipe = useCallback((direction: 'left' | 'right' | 'up') => {
        const x = direction === 'right' ? SCREEN_WIDTH * 1.5 : direction === 'left' ? -SCREEN_WIDTH * 1.5 : 0;
        const y = direction === 'up' ? -SCREEN_HEIGHT : 0;

        Animated.timing(position, {
            toValue: { x, y },
            duration: 250,
            useNativeDriver: false,
        }).start(() => {
            onSwipe(direction);
            position.setValue({ x: 0, y: 0 });
        });
    }, [position, onSwipe]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => isFirst,
            onPanResponderGrant: () => {
                hapticTriggered.current = false;
            },
            onPanResponderMove: (_, gesture) => {
                position.setValue({ x: gesture.dx, y: gesture.dy });

                // Haptic feedback at threshold
                if (!hapticTriggered.current) {
                    if (Math.abs(gesture.dx) > SWIPE_THRESHOLD || gesture.dy < -100) {
                        hapticTriggered.current = true;
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                }
            },
            onPanResponderRelease: (_, gesture) => {
                if (gesture.dx > SWIPE_THRESHOLD) {
                    forceSwipe('right');
                } else if (gesture.dx < -SWIPE_THRESHOLD) {
                    forceSwipe('left');
                } else if (gesture.dy < -100) {
                    forceSwipe('up');
                } else {
                    resetPosition();
                }
            },
        })
    ).current;

    const cardStyle = {
        transform: [
            { translateX: position.x },
            { translateY: position.y },
            { rotate },
        ],
    };

    // Behind card (non-interactive)
    if (!isFirst) {
        return (
            <View style={[styles.card, styles.behindCard]}>
                <Image source={{ uri: track.image }} style={styles.image} resizeMode="cover" />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.gradient} />
            </View>
        );
    }

    return (
        <Animated.View {...panResponder.panHandlers} style={[styles.card, cardStyle]}>
            {/* Album Art */}
            <Image source={{ uri: track.image }} style={styles.image} resizeMode="cover" />

            {/* Gradient Overlay */}
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.gradient} />

            {/* ARCHIVE Stamp (Right) */}
            <Animated.View style={[styles.stamp, styles.archiveStamp, { opacity: archiveOpacity }]}>
                <View style={[styles.stampInner, styles.archiveBorder]}>
                    <Ionicons name="heart" size={32} color={Colors.accent} />
                    <Text style={[styles.stampText, styles.archiveText]}>ARCHIVE</Text>
                </View>
            </Animated.View>

            {/* PASS Stamp (Left) */}
            <Animated.View style={[styles.stamp, styles.passStamp, { opacity: passOpacity }]}>
                <View style={[styles.stampInner, styles.passBorder]}>
                    <Ionicons name="close" size={32} color="#EF4444" />
                    <Text style={[styles.stampText, styles.passText]}>PASS</Text>
                </View>
            </Animated.View>

            {/* EXPLORE Stamp (Up) */}
            <Animated.View style={[styles.stamp, styles.exploreStamp, { opacity: exploreOpacity }]}>
                <View style={[styles.stampInner, styles.exploreBorder]}>
                    <Ionicons name="eye" size={32} color="#3B82F6" />
                    <Text style={[styles.stampText, styles.exploreText]}>EXPLORE</Text>
                </View>
            </Animated.View>

            {/* Track Info */}
            <View style={styles.info}>
                <Text style={styles.trackName} numberOfLines={2}>{track.name}</Text>
                <Text style={styles.artistName}>{track.artist}</Text>
                <Text style={styles.albumName}>{track.album}</Text>
            </View>

            {/* Play Button */}
            {track.preview_url && (
                <TouchableOpacity style={styles.playButton} onPress={onPlay} activeOpacity={0.8}>
                    <View style={styles.playButtonInner}>
                        <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color="#fff" />
                    </View>
                </TouchableOpacity>
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        position: 'absolute',
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: 24,
        backgroundColor: '#1e1e1e',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 10,
    },
    behindCard: {
        top: 12,
        transform: [{ scale: 0.95 }],
        opacity: 0.6,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    gradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '55%',
    },
    stamp: {
        position: 'absolute',
        top: 50,
    },
    stampInner: {
        alignItems: 'center',
        padding: 12,
        borderWidth: 3,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    stampText: {
        fontWeight: 'bold',
        fontSize: 16,
        marginTop: 4,
    },
    archiveStamp: {
        left: 20,
    },
    archiveBorder: {
        borderColor: Colors.accent,
    },
    archiveText: {
        color: Colors.accent,
    },
    passStamp: {
        right: 20,
    },
    passBorder: {
        borderColor: '#EF4444',
    },
    passText: {
        color: '#EF4444',
    },
    exploreStamp: {
        alignSelf: 'center',
        left: CARD_WIDTH / 2 - 50,
    },
    exploreBorder: {
        borderColor: '#3B82F6',
    },
    exploreText: {
        color: '#3B82F6',
    },
    info: {
        position: 'absolute',
        bottom: 90,
        left: 20,
        right: 20,
    },
    trackName: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 6,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    artistName: {
        color: Colors.primary,
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
    },
    albumName: {
        color: '#888',
        fontSize: 14,
    },
    playButton: {
        position: 'absolute',
        bottom: 24,
        right: 20,
    },
    playButtonInner: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.primaryAlpha(0.95),
        alignItems: 'center',
        justifyContent: 'center',
    },
});
