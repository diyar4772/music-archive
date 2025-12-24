import React from 'react';
import { View, StyleSheet, Platform, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

interface UniversalBlurProps {
    children: React.ReactNode;
    intensity?: number;
    style?: ViewStyle;
    tint?: 'light' | 'dark' | 'default';
}

/**
 * Platform-specific blur component
 * - iOS: Native BlurView (performant)
 * - Android: Semi-transparent dark background (no lag)
 * - Web: CSS backdrop-filter with fallback
 */
export default function UniversalBlur({
    children,
    intensity = 50,
    style,
    tint = 'dark',
}: UniversalBlurProps) {
    // iOS - Use native BlurView
    if (Platform.OS === 'ios') {
        return (
            <BlurView intensity={intensity} tint={tint} style={[styles.blur, style]}>
                {children}
            </BlurView>
        );
    }

    // Web - Use CSS backdrop-filter
    if (Platform.OS === 'web') {
        const webStyle: any = {
            backdropFilter: `blur(${Math.round(intensity / 5)}px)`,
            WebkitBackdropFilter: `blur(${Math.round(intensity / 5)}px)`,
            backgroundColor: tint === 'dark' 
                ? 'rgba(10, 10, 10, 0.85)' 
                : 'rgba(255, 255, 255, 0.85)',
        };
        
        return (
            <View style={[styles.blur, style, webStyle]}>
                {children}
            </View>
        );
    }

    // Android fallback - solid background
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
        backgroundColor: 'rgba(20, 20, 20, 0.95)',
    },
});
