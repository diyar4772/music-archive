import React from 'react';
import { View, StyleSheet, Platform, ViewStyle } from 'react-native';

interface CardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    elevated?: boolean;
}

/**
 * Reusable Card component with platform-specific shadows
 * - iOS: shadowColor, shadowOffset, shadowOpacity, shadowRadius
 * - Android: elevation
 * - Web: boxShadow
 */
export default function Card({ children, style, elevated = true }: CardProps) {
    return (
        <View style={[styles.card, elevated && styles.shadow, style]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#1e1e1e',
        borderRadius: 12,
        padding: 16,
    },
    shadow: Platform.select({
        ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 6,
        },
        android: {
            elevation: 4,
        },
        default: {
            // Web fallback
        },
    }) as ViewStyle,
});
