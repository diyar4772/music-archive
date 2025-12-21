import React, { useRef, useCallback } from 'react';
import {
    View,
    Text,
    Image,
    StyleSheet,
    Dimensions,
    Animated,
    PanResponder,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DigTrack } from '../../services/dig';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;
const SWIPE_OUT_DURATION = 250;

interface SwipeCardProps {
    track: DigTrack;
    isFirst: boolean;
    onSwipe: (direction: 'left' | 'right' | 'up') => void;
    onPlay: () => void;
    isPlaying: boolean;
}

export default function SwipeCard({
    track,
    isFirst,
    onSwipe,
    onPlay,
    isPlaying,
}: SwipeCardProps) {
    const position = useRef(new Animated.ValueXY()).current;

    const rotate = position.x.interpolate({
        inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        outputRange: ['-10deg', '0deg', '10deg'],
        extrapolate: 'clamp',
    });

    const likeOpacity = position.x.interpolate({
        inputRange: [0, SCREEN_WIDTH / 4],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    const passOpacity = position.x.interpolate({
        inputRange: [-SCREEN_WIDTH / 4, 0],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });

    const exploreOpacity = position.y.interpolate({
        inputRange: [-SCREEN_HEIGHT / 6, 0],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });

    const resetPosition = useCallback(() => {
        Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
        }).start();
    }, [position]);

    const forceSwipe = useCallback((direction: 'left' | 'right' | 'up') => {
        const x = direction === 'right' ? SCREEN_WIDTH : direction === 'left' ? -SCREEN_WIDTH : 0;
        const y = direction === 'up' ? -SCREEN_HEIGHT : 0;

        Animated.timing(position, {
            toValue: { x, y },
            duration: SWIPE_OUT_DURATION,
            useNativeDriver: false,
        }).start(() => {
            onSwipe(direction);
            position.setValue({ x: 0, y: 0 });
        });
    }, [position, onSwipe]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderMove: (_, gesture) => {
                position.setValue({ x: gesture.dx, y: gesture.dy });
            },
            onPanResponderRelease: (_, gesture) => {
                if (gesture.dx > SWIPE_THRESHOLD) {
                    forceSwipe('right');
                } else if (gesture.dx < -SWIPE_THRESHOLD) {
                    forceSwipe('left');
                } else if (gesture.dy < -SWIPE_THRESHOLD) {
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

    if (!isFirst) {
        return (
            <View style={[styles.card, styles.cardBehind]}>
                <Image source={{ uri: track.image }} style={styles.image} />
            </View>
        );
    }

    return (
        <Animated.View
            {...panResponder.panHandlers}
            style={[styles.card, cardStyle]}
        >
            {/* Album Art */}
            <Image source={{ uri: track.image }} style={styles.image} />

            {/* Gradient Overlay */}
            <View style={styles.gradient} />

            {/* Swipe Indicators */}
            <Animated.View style={[styles.indicator, styles.likeIndicator, { opacity: likeOpacity }]}>
                <Ionicons name="heart" size={60} color="#1DB954" />
                <Text style={styles.indicatorText}>ARCHIVE</Text>
            </Animated.View>

            <Animated.View style={[styles.indicator, styles.passIndicator, { opacity: passOpacity }]}>
                <Ionicons name="close" size={60} color="#EF4444" />
                <Text style={styles.indicatorText}>PASS</Text>
            </Animated.View>

            <Animated.View style={[styles.indicator, styles.exploreIndicator, { opacity: exploreOpacity }]}>
                <Ionicons name="eye" size={60} color="#3B82F6" />
                <Text style={styles.indicatorText}>EXPLORE</Text>
            </Animated.View>

            {/* Track Info */}
            <View style={styles.info}>
                <Text style={styles.trackName} numberOfLines={2}>{track.name}</Text>
                <Text style={styles.artistName}>{track.artist}</Text>
                <Text style={styles.albumName}>{track.album}</Text>

                {/* Play Button */}
                {track.preview_url && (
                    <TouchableOpacity style={styles.playButton} onPress={onPlay}>
                        <Ionicons
                            name={isPlaying ? 'pause-circle' : 'play-circle'}
                            size={56}
                            color="#fff"
                        />
                    </TouchableOpacity>
                )}
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        position: 'absolute',
        width: SCREEN_WIDTH - 32,
        height: SCREEN_HEIGHT * 0.65,
        borderRadius: 20,
        backgroundColor: '#1e1e1e',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    cardBehind: {
        top: 8,
        transform: [{ scale: 0.95 }],
        opacity: 0.7,
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
        height: '50%',
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    indicator: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 3,
    },
    likeIndicator: {
        top: 50,
        right: 30,
        borderColor: '#1DB954',
        backgroundColor: 'rgba(29, 185, 84, 0.2)',
    },
    passIndicator: {
        top: 50,
        left: 30,
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
    },
    exploreIndicator: {
        top: 50,
        alignSelf: 'center',
        left: SCREEN_WIDTH / 2 - 80,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
    },
    indicatorText: {
        color: '#fff',
        fontWeight: 'bold',
        marginTop: 4,
        fontSize: 16,
    },
    info: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
    },
    trackName: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    artistName: {
        color: '#1DB954',
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
        right: 20,
        bottom: 20,
    },
});
