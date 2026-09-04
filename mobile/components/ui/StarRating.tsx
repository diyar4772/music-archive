/**
 * ⭐ StarRating Component
 * 
 * Interactive star rating component supporting 0.5 increments
 * - 1 to 5 stars
 * - Half-star support via tap position
 * - Haptic feedback
 * - Read-only mode
 */

import React, { useCallback } from 'react';
import {
    View,
    TouchableOpacity,
    StyleSheet,
    Text,
    GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import hapticService from '../../services/hapticService';

interface StarRatingProps {
    rating: number;
    onRate?: (rating: number) => void;
    size?: number;
    readonly?: boolean;
    showLabel?: boolean;
    color?: string;
    emptyColor?: string;
}

export default function StarRating({
    rating,
    onRate,
    size = 28,
    readonly = false,
    showLabel = false,
    color = '#FFD700',
    emptyColor = '#404040',
}: StarRatingProps) {
    const handleStarPress = useCallback(
        (starIndex: number, event: GestureResponderEvent) => {
            if (readonly || !onRate) return;

            // Get tap position relative to star
            const { locationX } = event.nativeEvent;
            const isHalf = locationX < size / 2;
            const newRating = isHalf ? starIndex - 0.5 : starIndex;

            // Haptic feedback (web-safe)
            hapticService.lightImpact();

            onRate(newRating);
        },
        [readonly, onRate, size]
    );

    const renderStar = (index: number) => {
        const filled = rating >= index;
        const halfFilled = !filled && rating >= index - 0.5;

        let iconName: keyof typeof Ionicons.glyphMap = 'star-outline';
        let iconColor = emptyColor;

        if (filled) {
            iconName = 'star';
            iconColor = color;
        } else if (halfFilled) {
            iconName = 'star-half';
            iconColor = color;
        }

        return (
            <TouchableOpacity
                key={index}
                onPress={(e) => handleStarPress(index, e)}
                disabled={readonly}
                activeOpacity={readonly ? 1 : 0.7}
                style={styles.starContainer}
            >
                <Ionicons name={iconName} size={size} color={iconColor} />
            </TouchableOpacity>
        );
    };

    const getRatingLabel = () => {
        if (rating === 0) return 'Puanlanmadı';
        if (rating <= 1) return 'Kötü';
        if (rating <= 2) return 'Eh işte';
        if (rating <= 3) return 'İyi';
        if (rating <= 4) return 'Çok İyi';
        return 'Mükemmel';
    };

    return (
        <View style={styles.container}>
            <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(renderStar)}
            </View>
            {showLabel && (
                <Text style={[styles.label, { color: rating > 0 ? color : '#666' }]}>
                    {rating > 0 ? `${rating} - ${getRatingLabel()}` : getRatingLabel()}
                </Text>
            )}
        </View>
    );
}

// Compact inline version for lists
export function StarRatingInline({
    rating,
    size = 12,
    color = '#FFD700',
}: {
    rating: number;
    size?: number;
    color?: string;
}) {
    if (rating <= 0) return null;

    return (
        <View style={styles.inlineContainer}>
            <Ionicons name="star" size={size} color={color} />
            <Text style={[styles.inlineText, { color }]}>{rating.toFixed(1)}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
    },
    starsRow: {
        flexDirection: 'row',
        gap: 4,
    },
    starContainer: {
        padding: 2,
    },
    label: {
        fontSize: 13,
        marginTop: 8,
        fontWeight: '500',
    },
    inlineContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 215, 0, 0.15)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        gap: 3,
    },
    inlineText: {
        fontSize: 11,
        fontWeight: '600',
    },
});

