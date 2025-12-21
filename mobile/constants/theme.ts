/**
 * 🎨 Universal Music Archiver - Design System
 * 
 * Brand Identity: "Electric Violet" Theme
 * Premium, unique look that stands apart from Spotify
 */

export const Colors = {
    // === Primary Brand Colors ===
    primary: '#8B5CF6',        // Electric Violet - Main brand color
    primaryDark: '#7C3AED',    // Violet-600 - Pressed/Active states
    primaryLight: '#A78BFA',   // Violet-400 - Hover/Lighter variant

    // === Secondary/Accent ===
    accent: '#F472B6',         // Pink-400 - Hearts, likes, special highlights
    accentDark: '#EC4899',     // Pink-500 - Active state

    // === Semantic Colors ===
    success: '#10B981',        // Emerald - Success states
    error: '#EF4444',          // Red - Errors, Pass button
    warning: '#F59E0B',        // Amber - Warnings
    info: '#3B82F6',           // Blue - Info, Explore button

    // === Background Palette ===
    background: '#0A0A0B',     // Deepest black
    surface: '#121214',        // Main background
    surfaceElevated: '#1E1E24', // Cards, elevated surfaces
    surfaceHover: '#2A2A32',   // Hover states

    // === Text Colors ===
    textPrimary: '#FFFFFF',
    textSecondary: '#A1A1AA',  // Zinc-400
    textMuted: '#71717A',      // Zinc-500
    textDisabled: '#52525B',   // Zinc-600

    // === Border Colors ===
    border: '#27272A',         // Zinc-800
    borderLight: '#3F3F46',    // Zinc-700

    // === Gradients ===
    gradients: {
        primary: ['#8B5CF6', '#7C3AED'] as [string, string],
        primaryToAccent: ['#8B5CF6', '#F472B6'] as [string, string],
        liked: ['#9333EA', '#7C3AED'] as [string, string],     // Purple card
        artists: ['#3B82F6', '#2563EB'] as [string, string],   // Blue card
        playlists: ['#10B981', '#059669'] as [string, string], // Green card
    },

    // === Opacity Variants ===
    primaryAlpha: (opacity: number) => `rgba(139, 92, 246, ${opacity})`,
    accentAlpha: (opacity: number) => `rgba(244, 114, 182, ${opacity})`,
    errorAlpha: (opacity: number) => `rgba(239, 68, 68, ${opacity})`,
};

// === Typography ===
export const Typography = {
    fontFamily: {
        regular: 'System',
        medium: 'System',
        bold: 'System',
    },
    sizes: {
        xs: 11,
        sm: 13,
        base: 15,
        lg: 17,
        xl: 20,
        '2xl': 24,
        '3xl': 28,
        '4xl': 34,
    },
};

// === Spacing ===
export const Spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
};

// === Border Radius ===
export const Radius = {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 20,
    full: 9999,
};

export default { Colors, Typography, Spacing, Radius };
