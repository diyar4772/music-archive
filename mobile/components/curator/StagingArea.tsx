/**
 * 🎭 Staging Area - Enhanced
 * 
 * Bottom panel for selected tracks before playlist creation
 * Features:
 * - Horizontal scrollable track list with names
 * - Target playlist selector
 * - Remove button with haptic feedback
 * - Empty placeholder slots
 * - Finalize playlist button
 * - Glassmorphism design
 */

import React, { memo, useCallback, useState } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    Modal,
    Pressable,
    FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/theme';
import { useCuratorStore, CuratorTrack } from '../../stores/curatorStore';

interface Playlist {
    id: string;
    name: string;
    color?: string;
    trackCount?: number;
}

interface StagingAreaProps {
    onFinalize: (tracks: CuratorTrack[]) => void;
    onTrackPress?: (track: CuratorTrack) => void;
    playlists?: Playlist[];
    selectedPlaylist?: Playlist | null;
    onPlaylistSelect?: (playlist: Playlist | null) => void;
}

const THUMB_SIZE = 64;
const PLACEHOLDER_COUNT = 5;

// Mock playlists for selection (replace with real data from props)
const DEFAULT_PLAYLISTS: Playlist[] = [
    { id: 'new', name: '+ Yeni Liste Oluştur', color: Colors.primary },
];

function StagingArea({
    onFinalize,
    onTrackPress,
    playlists = DEFAULT_PLAYLISTS,
    selectedPlaylist = null,
    onPlaylistSelect,
}: StagingAreaProps) {
    const { stagingTracks, removeFromStaging, clearStaging } = useCuratorStore();
    const [showPlaylistModal, setShowPlaylistModal] = useState(false);
    const [currentSelectedPlaylist, setCurrentSelectedPlaylist] = useState<Playlist | null>(selectedPlaylist);

    const handleRemove = useCallback((trackId: string) => {
        removeFromStaging(trackId);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, [removeFromStaging]);

    const handleFinalize = useCallback(() => {
        if (stagingTracks.length === 0) {
            Alert.alert('Boş Liste', 'Lütfen en az bir şarkı ekleyin');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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

    const handlePlaylistSelect = useCallback((playlist: Playlist) => {
        setCurrentSelectedPlaylist(playlist);
        onPlaylistSelect?.(playlist);
        setShowPlaylistModal(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [onPlaylistSelect]);

    const emptySlots = Math.max(0, PLACEHOLDER_COUNT - stagingTracks.length);

    // Truncate text
    const truncate = (text: string, max: number) =>
        text.length > max ? text.slice(0, max - 1) + '…' : text;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.title}>Staging Area</Text>
                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>{stagingTracks.length}</Text>
                    </View>
                </View>
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
                                    <Ionicons name="musical-note" size={18} color="#444" />
                                </View>
                            )}

                            {/* Remove Button */}
                            <TouchableOpacity
                                style={styles.removeBtn}
                                onPress={() => handleRemove(track.id)}
                                activeOpacity={0.8}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons name="close" size={12} color="#fff" />
                            </TouchableOpacity>

                            {/* Index Badge */}
                            <View style={styles.indexBadge}>
                                <Text style={styles.indexText}>{index + 1}</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Track Name Under Thumbnail */}
                        <Text style={styles.thumbTrackName} numberOfLines={1}>
                            {truncate(track.name, 10)}
                        </Text>
                    </View>
                ))}

                {/* Empty Placeholder Slots */}
                {Array.from({ length: emptySlots }).map((_, index) => (
                    <View key={`empty-${index}`} style={styles.thumbWrapper}>
                        <View style={styles.emptySlot}>
                            <Ionicons name="add" size={18} color="rgba(255,255,255,0.2)" />
                        </View>
                    </View>
                ))}

                {/* Target Playlist Selector - Always at end */}
                <TouchableOpacity
                    style={styles.playlistSelector}
                    onPress={() => setShowPlaylistModal(true)}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={currentSelectedPlaylist
                            ? [Colors.primary, Colors.primaryDark]
                            : ['#2a2a2a', '#1a1a1a']
                        }
                        style={styles.playlistSelectorGradient}
                    >
                        <Ionicons
                            name={currentSelectedPlaylist ? 'folder' : 'folder-outline'}
                            size={20}
                            color={currentSelectedPlaylist ? '#fff' : '#888'}
                        />
                        <Text style={[
                            styles.playlistSelectorText,
                            currentSelectedPlaylist && styles.playlistSelectorTextActive
                        ]}>
                            {currentSelectedPlaylist
                                ? truncate(currentSelectedPlaylist.name, 8)
                                : 'Hedef'
                            }
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
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
                        size={20}
                        color={stagingTracks.length > 0 ? '#fff' : '#666'}
                    />
                    <Text style={[
                        styles.finalizeText,
                        stagingTracks.length === 0 && styles.finalizeTextDisabled
                    ]}>
                        Playlist Oluştur
                    </Text>
                    {stagingTracks.length > 0 && (
                        <View style={styles.finalizeCount}>
                            <Text style={styles.finalizeCountText}>{stagingTracks.length}</Text>
                        </View>
                    )}
                </LinearGradient>
            </TouchableOpacity>

            {/* Playlist Selection Modal */}
            <Modal
                visible={showPlaylistModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowPlaylistModal(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowPlaylistModal(false)}
                >
                    <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Hedef Playlist Seç</Text>

                        <FlatList
                            data={playlists}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.playlistOption,
                                        currentSelectedPlaylist?.id === item.id && styles.playlistOptionSelected
                                    ]}
                                    onPress={() => handlePlaylistSelect(item)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.playlistOptionIcon, { backgroundColor: item.color || '#333' }]}>
                                        <Ionicons
                                            name={item.id === 'new' ? 'add' : 'musical-notes'}
                                            size={20}
                                            color="#fff"
                                        />
                                    </View>
                                    <View style={styles.playlistOptionInfo}>
                                        <Text style={styles.playlistOptionName}>{item.name}</Text>
                                        {item.trackCount !== undefined && (
                                            <Text style={styles.playlistOptionCount}>{item.trackCount} şarkı</Text>
                                        )}
                                    </View>
                                    {currentSelectedPlaylist?.id === item.id && (
                                        <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                                    )}
                                </TouchableOpacity>
                            )}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.playlistList}
                            showsVerticalScrollIndicator={false}
                        />
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#1a1028',
        borderRadius: 20,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.15)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.9)',
    },
    countBadge: {
        backgroundColor: Colors.primaryAlpha(0.3),
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    countText: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.primary,
    },
    clearBtn: {
        fontSize: 13,
        color: Colors.error,
        fontWeight: '500',
    },
    scrollView: {
        marginBottom: 14,
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
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: Colors.primaryAlpha(0.4),
    },
    thumbImage: {
        width: '100%',
        height: '100%',
    },
    thumbTrackName: {
        fontSize: 9,
        color: 'rgba(255,255,255,0.6)',
        marginTop: 4,
        textAlign: 'center',
        maxWidth: THUMB_SIZE,
    },
    placeholder: {
        backgroundColor: '#151515',
        alignItems: 'center',
        justifyContent: 'center',
    },
    removeBtn: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: Colors.error,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        borderWidth: 2,
        borderColor: '#1a1028',
    },
    indexBadge: {
        position: 'absolute',
        bottom: 4,
        left: 4,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: Colors.primaryAlpha(0.9),
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    indexText: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#fff',
    },
    emptySlot: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: 10,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Playlist Selector
    playlistSelector: {
        width: THUMB_SIZE,
        height: THUMB_SIZE + 18,
        marginLeft: 4,
    },
    playlistSelectorGradient: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    playlistSelectorText: {
        fontSize: 9,
        color: '#888',
        marginTop: 4,
        fontWeight: '600',
    },
    playlistSelectorTextActive: {
        color: '#fff',
    },
    // Finalize Button
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
        paddingVertical: 14,
        gap: 10,
    },
    finalizeText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    finalizeTextDisabled: {
        color: '#666',
    },
    finalizeCount: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    finalizeCountText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1e1e1e',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '60%',
        paddingBottom: 40,
    },
    modalHandle: {
        width: 36,
        height: 4,
        backgroundColor: '#444',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 16,
    },
    playlistList: {
        paddingHorizontal: 16,
        gap: 8,
    },
    playlistOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#252525',
        padding: 14,
        borderRadius: 12,
        gap: 12,
    },
    playlistOptionSelected: {
        backgroundColor: Colors.primaryAlpha(0.2),
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    playlistOptionIcon: {
        width: 44,
        height: 44,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playlistOptionInfo: {
        flex: 1,
    },
    playlistOptionName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    playlistOptionCount: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
});

export default memo(StagingArea);
