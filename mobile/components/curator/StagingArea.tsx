/**
 * 🎭 Staging Area
 * 
 * Bottom panel for selected tracks before playlist creation
 * - Horizontal scrollable track list
 * - Remove button on each track
 * - Empty placeholder slots
 * - Finalize playlist button
 */

import React, { memo, useCallback } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/theme';
import { useCuratorStore, CuratorTrack } from '../../stores/curatorStore';

interface StagingAreaProps {
    onFinalize: (tracks: CuratorTrack[]) => void;
    onTrackPress?: (track: CuratorTrack) => void;
}

const THUMB_SIZE = 72;
const PLACEHOLDER_COUNT = 5;

function StagingArea({ onFinalize, onTrackPress }: StagingAreaProps) {
    const { stagingTracks, removeFromStaging, clearStaging } = useCuratorStore();

    const handleRemove = useCallback((trackId: string) => {
        removeFromStaging(trackId);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [removeFromStaging]);

    const handleFinalize = useCallback(() => {
        if (stagingTracks.length === 0) {
            Alert.alert('Boş Liste', 'Lütfen en az bir şarkı ekleyin');
            return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onFinalize(stagingTracks);
    }, [stagingTracks, onFinalize]);

    const handleClear = useCallback(() => {
        if (stagingTracks.length === 0) return;

        Alert.alert(
            'Temizle',
            'Tüm şarkıları staging alanından kaldırmak istiyor musunuz?',
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Temizle',
                    style: 'destructive',
                    onPress: () => {
                        clearStaging();
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    }
                }
            ]
        );
    }, [stagingTracks, clearStaging]);

    const emptySlots = Math.max(0, PLACEHOLDER_COUNT - stagingTracks.length);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>
                    Staging Area{' '}
                    <Text style={styles.count}>({stagingTracks.length} şarkı)</Text>
                </Text>
                {stagingTracks.length > 0 && (
                    <TouchableOpacity onPress={handleClear} activeOpacity={0.7}>
                        <Text style={styles.clearBtn}>Temizle</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Track Thumbnails */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                style={styles.scrollView}
            >
                {/* Selected Tracks */}
                {stagingTracks.map((track, index) => (
                    <View key={track.id} style={styles.thumbWrapper}>
                        <TouchableOpacity
                            style={styles.thumb}
                            onPress={() => onTrackPress?.(track)}
                            activeOpacity={0.8}
                        >
                            {track.image ? (
                                <Image source={{ uri: track.image }} style={styles.thumbImage} />
                            ) : (
                                <View style={[styles.thumbImage, styles.placeholder]}>
                                    <Ionicons name="musical-note" size={20} color="#444" />
                                </View>
                            )}

                            {/* Remove Button */}
                            <TouchableOpacity
                                style={styles.removeBtn}
                                onPress={() => handleRemove(track.id)}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="close" size={14} color="#fff" />
                            </TouchableOpacity>

                            {/* Index Badge */}
                            <View style={styles.indexBadge}>
                                <Text style={styles.indexText}>{index + 1}</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Track Name Under Thumbnail */}
                        <Text style={styles.thumbTrackName} numberOfLines={1}>
                            {track.name.length > 10 ? track.name.slice(0, 9) + '…' : track.name}
                        </Text>
                    </View>
                ))}

                {/* Empty Placeholder Slots */}
                {Array.from({ length: emptySlots }).map((_, index) => (
                    <View key={`empty-${index}`} style={styles.emptySlot}>
                        <Ionicons name="add" size={20} color="rgba(255,255,255,0.2)" />
                    </View>
                ))}
            </ScrollView>

            {/* Finalize Button */}
            <TouchableOpacity
                style={[styles.finalizeBtn, stagingTracks.length === 0 && styles.finalizeBtnDisabled]}
                onPress={handleFinalize}
                activeOpacity={0.9}
                disabled={stagingTracks.length === 0}
            >
                <LinearGradient
                    colors={stagingTracks.length > 0
                        ? [Colors.primary, Colors.primaryDark]
                        : ['#333', '#222']
                    }
                    style={styles.finalizeGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <Ionicons
                        name="checkmark-done"
                        size={22}
                        color={stagingTracks.length > 0 ? '#fff' : '#666'}
                    />
                    <Text style={[
                        styles.finalizeText,
                        stagingTracks.length === 0 && styles.finalizeTextDisabled
                    ]}>
                        Playlist Oluştur
                    </Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#1a1028',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
    },
    count: {
        fontSize: 12,
        fontWeight: '400',
        color: 'rgba(255,255,255,0.4)',
    },
    clearBtn: {
        fontSize: 13,
        color: Colors.error,
        fontWeight: '500',
    },
    scrollView: {
        marginBottom: 16,
    },
    scrollContent: {
        gap: 10,
        paddingVertical: 4,
    },
    thumbWrapper: {
        alignItems: 'center',
        width: THUMB_SIZE,
    },
    thumb: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: Colors.primaryAlpha(0.5),
    },
    thumbTrackName: {
        fontSize: 9,
        color: 'rgba(255,255,255,0.6)',
        marginTop: 4,
        textAlign: 'center',
        maxWidth: THUMB_SIZE,
    },
    thumbImage: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        backgroundColor: '#151515',
        alignItems: 'center',
        justifyContent: 'center',
    },
    removeBtn: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    indexBadge: {
        position: 'absolute',
        bottom: 4,
        left: 4,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: Colors.primaryAlpha(0.9),
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    indexText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#fff',
    },
    emptySlot: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: 12,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    finalizeBtn: {
        borderRadius: 14,
        overflow: 'hidden',
    },
    finalizeBtnDisabled: {
        opacity: 0.6,
    },
    finalizeGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 10,
    },
    finalizeText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#fff',
    },
    finalizeTextDisabled: {
        color: '#666',
    },
});

export default memo(StagingArea);

