/**
 * 📳 Haptic Service - Cross-Platform Haptic Feedback
 * 
 * Provides haptic feedback that works on:
 * - iOS: Native haptic engine
 * - Android: Vibration patterns
 * - Web: Silent (gracefully skipped)
 */

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import logger from '../utils/logger';

// Re-export types for convenience
export const ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = Haptics.NotificationFeedbackType;

/**
 * Check if haptics are available on this platform
 */
export const isHapticsAvailable = (): boolean => {
    return Platform.OS !== 'web';
};

/**
 * Light tap - selection feedback
 * Use for: button taps, list item selection
 */
export const selection = async (): Promise<void> => {
    if (Platform.OS === 'web') return;

    try {
        await Haptics.selectionAsync();
    } catch (error) {
        logger.debug('Haptics selection error', error, 'hapticService');
    }
};

/**
 * Impact feedback - physical interaction
 * Use for: drag start/end, button press, toggle switches
 */
export const impact = async (
    style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium
): Promise<void> => {
    if (Platform.OS === 'web') return;

    try {
        await Haptics.impactAsync(style);
    } catch (error) {
        logger.debug('Haptics impact error', error, 'hapticService');
    }
};

/**
 * Light impact
 */
export const lightImpact = async (): Promise<void> => {
    return impact(Haptics.ImpactFeedbackStyle.Light);
};

/**
 * Medium impact
 */
export const mediumImpact = async (): Promise<void> => {
    return impact(Haptics.ImpactFeedbackStyle.Medium);
};

/**
 * Heavy impact
 */
export const heavyImpact = async (): Promise<void> => {
    return impact(Haptics.ImpactFeedbackStyle.Heavy);
};

/**
 * Notification feedback - system events
 * Use for: success/error/warning states
 */
export const notification = async (
    type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success
): Promise<void> => {
    if (Platform.OS === 'web') return;

    try {
        await Haptics.notificationAsync(type);
    } catch (error) {
        logger.debug('Haptics notification error', error, 'hapticService');
    }
};

/**
 * Success notification
 */
export const success = async (): Promise<void> => {
    return notification(Haptics.NotificationFeedbackType.Success);
};

/**
 * Error notification
 */
export const error = async (): Promise<void> => {
    return notification(Haptics.NotificationFeedbackType.Error);
};

/**
 * Warning notification
 */
export const warning = async (): Promise<void> => {
    return notification(Haptics.NotificationFeedbackType.Warning);
};

// Default export as service object
export default {
    isHapticsAvailable,
    selection,
    impact,
    lightImpact,
    mediumImpact,
    heavyImpact,
    notification,
    success,
    error,
    warning,
    ImpactFeedbackStyle,
    NotificationFeedbackType,
};

