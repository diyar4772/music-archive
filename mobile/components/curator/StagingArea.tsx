/**
 * 🎭 Staging Area - Floating Panel Design
 * 
 * Floating bottom panel for playlist creation
 * Matches the HTML reference design with:
 * - Rounded top corners (2rem)
 * - Shadow from top
 * - Icon header with item count
 * - Empty slot placeholder at start
 * - Track thumbnails with remove & track name
 * - Finalize button with gradient
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
import hapticService from '../../services/hapticService';
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

const THUMB_SIZE = 72;

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
        hapticService.mediumImpact();
    }, [removeFromStaging]);

    const handleFinalize = useCallback(() => {
        if (stagingTracks.length === 0) {
            Alert.alert('Boş Liste', 'Lütfen en az bir şarkı ekleyin');
            hapticService.error();
            return;
        }
        hapticService.success();
        onFinalize(stagingTracks);
    }, [stagingTracks, onFinalize]);

    const handleClear = useCallback(() => {
        if (stagingTracks.length === 0) return;
        Alert.alert(
            'Temizle',
            'Tüm şarkıları kaldırmak istiyor musunuz?',
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Temizle',
                    style: 'destructive',
                    onPress: () => {
                        clearStaging();
                        hapticService.warning();
                    }
                }
            ]
        );
    }, [stagingTracks, clearStaging]);

    const handlePlaylistSelect = useCallback((playlist: Playlist) => {
        setCurrentSelectedPlaylist(playlist);
        onPlaylistSelect?.(playlist);
        setShowPlaylistModal(false);
        hapticService.lightImpact();
    }, [onPlaylistSelect]);

    const truncate = (text: string, max: number) =>
        text.length > max ? text.slice(0, max - 1) + '…' : text;

    return (
        <View style={styles.wrapper}>
            {/* Top Gradient Fade */}
            <LinearGradient
                colors={['transparent', '#0A0A0A']}
                style={styles.fadeGradient}
                pointerEvents="none"
            />

            {/* Main Panel */}
            <View style={styles.container}>
                {/* Header Row */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="add" size={18} color={Colors.primary} />
                        </View>
                        <Text style={styles.title}>Staging Area</Text>
                    </View>
                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>{stagingTracks.length} Items</Text>
                    </View>
                </View>

                {/* Track Thumbnails */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    style={styles.scrollView}
                >
                    {/* Empty Slot Placeholder - Always first */}
                    <TouchableOpacity style={styles.emptySlot} activeOpacity={0.6}>
                        <View style={styles.emptySlotInner}>
                            <Ionicons name="add" size={22} color="rgba(137, 90, 246, 0.5)" />
                        </View>
                        <View style={styles.emptySlotText} />
                    </TouchableOpacity>

                    {/* Selected Tracks */}
                    {stagingTracks.map((track) => (
                        <View key={track.id} style={styles.trackSlot}>
                            <View style={styles.thumbContainer}>
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
                                </TouchableOpacity>

                                {/* Remove Button - Top Right Corner */}
                                <TouchableOpacity
                                    style={styles.removeBtn}
                                    onPress={() => handleRemove(track.id)}
                                    activeOpacity={0.8}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons name="close" size={11} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            {/* Track Name */}
                            <Text style={styles.thumbName} numberOfLines={1}>
                                {truncate(track.name, 10)}
                            </Text>
                        </View>
                    ))}
                </ScrollView>

                {/* Clear Button (if items exist) */}
                {stagingTracks.length > 0 && (
                    <TouchableOpacity
                        style={styles.clearBtn}
                        onPress={handleClear}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.clearBtnText}>Temizle</Text>
                    </TouchableOpacity>
                )}
            </View>

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
    wrapper: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    fadeGradient: {
        height: 48,
        width: '100%',
    },
    container: {
        backgroundColor: 'rgba(21, 16, 34, 0.95)',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 20,
    },
    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    iconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(137, 90, 246, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
    },
    countBadge: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    countText: {
        fontSize: 11,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.4)',
    },
    // Scroll Container
    scrollView: {
        marginBottom: 8,
    },
    scrollContent: {
        gap: 14,
        paddingVertical: 6,
    },
    // Empty Slot
    emptySlot: {
        width: THUMB_SIZE + 8,
        alignItems: 'center',
    },
    emptySlotInner: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: 14,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: 'rgba(137, 90, 246, 0.4)',
        backgroundColor: 'rgba(137, 90, 246, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptySlotText: {
        height: 10,
        width: 40,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 5,
        marginTop: 8,
    },
    // Track Slot
    trackSlot: {
        width: THUMB_SIZE + 8,
        alignItems: 'center',
    },
    thumbContainer: {
        position: 'relative',
    },
    thumb: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    thumbImage: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        backgroundColor: '#1a1a1a',
        alignItems: 'center',
        justifyContent: 'center',
    },
    removeBtn: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    thumbName: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
        marginTop: 8,
        textAlign: 'center',
        maxWidth: THUMB_SIZE,
    },
    // Clear Button
    clearBtn: {
        alignSelf: 'flex-end',
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    clearBtnText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        fontWeight: '500',
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
        backgroundColor: 'rgba(137, 90, 246, 0.2)',
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
