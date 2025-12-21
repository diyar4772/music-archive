import React from 'react';
import { View, StyleSheet, Platform, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

interface UniversalBlurProps {
    children: React.ReactNode;
    intensity?: number;
    style?: ViewStyle;
}

/**
 * Platform-specific blur component
 * - iOS: Native BlurView (performant)
 * - Android: Semi-transparent dark background (no lag)
 * - Web: CSS backdrop-filter
 */
export default function UniversalBlur({
    children,
    intensity = 50,
    style,
}: UniversalBlurProps) {
    if (Platform.OS === 'ios') {
        return (
            <BlurView intensity={intensity} tint="dark" style={[styles.blur, style]}>
                {children}
            </BlurView>
        );
    }

    // Android & Web fallback
    return (
        <View style={[styles.fallback, style]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    blur: {
        overflow: 'hidden',
    },
    fallback: {
        backgroundColor: 'rgba(20, 20, 20, 0.92)',
    },
});
