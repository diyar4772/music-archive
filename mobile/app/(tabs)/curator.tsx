/**
 * 🎨 Curator's Workbench - Enhanced
 * 
 * Playlist creation screen with:
 * - 3-column grid of liked tracks with rich data (name, artist, like status)
 * - Staging area for selected tracks
 * - Robust audio preview with URL validation
 * - Create playlist finalization
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    Alert,
    TextInput,
    Modal,
    Pressable,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../stores/authStore';
import { useCuratorStore, CuratorTrack } from '../../stores/curatorStore';
import { TrackGridItem, StagingArea, GRID_GAP, GRID_PADDING, isValidPreviewUrl } from '../../components/curator';
import { Colors } from '../../constants/theme';
import api from '../../services/api';

export default function CuratorScreen() {
    const { userData, refreshUserData } = useAuthStore();
    const { stagingTracks, clearStaging } = useCuratorStore();

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    // Audio State
    const soundRef = useRef<Audio.Sound | null>(null);
    const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
    const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);

    // Create Playlist Modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [playlistName, setPlaylistName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Convert liked tracks to CuratorTrack format
    const tracks: CuratorTrack[] = (userData?.likes || []).map(like => ({
        id: like.trackId,
        name: like.trackName,
        artist: like.artistName || 'Unknown Artist',
        image: like.image,
        previewUrl: like.previewUrl,
    }));

    // Filtered tracks based on search
    const filteredTracks = searchQuery.trim()
        ? tracks.filter(t =>
            t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.artist.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : tracks;

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync().catch(() => { });
            }
        };
    }, []);

    /**
     * Safely stop and cleanup the current sound
     */
    const cleanupSound = useCallback(async () => {
        if (soundRef.current) {
            try {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
            } catch (error) {
                // Ignore cleanup errors
                console.log('Sound cleanup warning:', error);
            }
            soundRef.current = null;
        }
        setPlayingTrackId(null);
        setLoadingTrackId(null);
    }, []);

    /**
     * Play preview with robust error handling
     * - Validates URL before playing
     * - Shows loading state
     * - Handles network/file errors gracefully
     */
    const handlePlayPreview = useCallback(async (track: CuratorTrack) => {
        try {
            // If same track, toggle pause/play
            if (playingTrackId === track.id) {
                await cleanupSound();
                return;
            }

            // Validate preview URL
            if (!isValidPreviewUrl(track.previewUrl)) {
                Alert.alert(
                    'Önizleme Hatası',
                    'Bu şarkı için geçerli bir önizleme URL\'si bulunamadı.\n\niTunes veya Spotify önizleme servisleri erişilemez olabilir.',
                    [{ text: 'Tamam' }]
                );
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                return;
            }

            // Set loading state
            setLoadingTrackId(track.id);

            // Stop current sound if playing
            await cleanupSound();

            // Configure audio mode for iOS
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
            });

            // Create and play sound with timeout handling
            const { sound } = await Audio.Sound.createAsync(
                { uri: track.previewUrl! },
                {
                    shouldPlay: true,
                    volume: 1.0,
                    progressUpdateIntervalMillis: 500,
                }
            );

            soundRef.current = sound;
            setPlayingTrackId(track.id);
            setLoadingTrackId(null);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            // Handle playback status updates
            sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
                if (status.isLoaded) {
                    if (status.didJustFinish) {
                        setPlayingTrackId(null);
                        soundRef.current = null;
                    }
                    // Handle error in loaded status
                    if ((status as any).error) {
                        console.error('Playback error:', (status as any).error);
                        cleanupSound();
                    }
                }
            });

        } catch (error: any) {
            console.error('Play error:', error);
            setLoadingTrackId(null);
            setPlayingTrackId(null);

            // Provide user-friendly error messages
            let errorMessage = 'Şarkı önizlemesi oynatılamadı.';

            if (error?.message?.includes('FileNotFoundException') ||
                error?.message?.includes('404') ||
                error?.message?.includes('ENOENT')) {
                errorMessage = 'Önizleme dosyası bulunamadı. iTunes servisi erişilemez olabilir.';
            } else if (error?.message?.includes('network') ||
                error?.message?.includes('Network')) {
                errorMessage = 'Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin.';
            } else if (error?.message?.includes('timeout')) {
                errorMessage = 'Bağlantı zaman aşımına uğradı. Lütfen tekrar deneyin.';
            }

            Alert.alert('Oynatma Hatası', errorMessage, [{ text: 'Tamam' }]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    }, [playingTrackId, cleanupSound]);

    // Finalize playlist
    const handleFinalize = useCallback((tracks: CuratorTrack[]) => {
        setShowCreateModal(true);
    }, []);

    // Create playlist
    const handleCreatePlaylist = useCallback(async () => {
        if (!playlistName.trim()) {
            Alert.alert('Hata', 'Lütfen liste adı girin');
            return;
        }

        setIsCreating(true);
        try {
            // Create playlist
            const createRes = await api.post('/playlists', { name: playlistName.trim() });
            const playlistId = createRes.data?.id || createRes.data?.playlist?.id;

            if (!playlistId) {
                throw new Error('Playlist ID alınamadı');
            }

            // Add tracks to playlist
            for (const track of stagingTracks) {
                await api.post(`/playlists/${playlistId}/add`, {
                    trackId: track.id,
                    trackName: track.name,
                    image: track.image,
                    previewUrl: track.previewUrl,
                    artistName: track.artist,
                });
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                'Başarılı! 🎉',
                `"${playlistName.trim()}" listesi ${stagingTracks.length} şarkı ile oluşturuldu!`,
                [
                    {
                        text: 'Tamam',
                        onPress: () => {
                            setShowCreateModal(false);
                            setPlaylistName('');
                            clearStaging();
                            refreshUserData();
                        }
                    }
                ]
            );
        } catch (error: any) {
            console.error('Create playlist error:', error);
            Alert.alert('Hata', error?.response?.data?.error || 'Playlist oluşturulamadı');
        } finally {
            setIsCreating(false);
        }
    }, [playlistName, stagingTracks, clearStaging, refreshUserData]);

    // Render grid item with rich data
    const renderItem = useCallback(({ item }: { item: CuratorTrack }) => (
        <TrackGridItem
            track={item}
            onPlayPreview={handlePlayPreview}
            isPlaying={playingTrackId === item.id}
            isLoading={loadingTrackId === item.id}
            isLiked={true} // All tracks in Curator are from likes
        />
    ), [handlePlayPreview, playingTrackId, loadingTrackId]);

    const keyExtractor = useCallback((item: CuratorTrack) => item.id, []);

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={() => router.back()}
                    activeOpacity={0.7}
                >
                    <Ionicons name="chevron-back" size={28} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>Curator's Workbench</Text>

                <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={() => setShowSearch(!showSearch)}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name={showSearch ? 'close' : 'search'}
                        size={24}
                        color="rgba(255,255,255,0.8)"
                    />
                </TouchableOpacity>
            </View>

            {/* Search Bar */}
            {showSearch && (
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={18} color="#666" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Şarkı veya sanatçı ara..."
                        placeholderTextColor="#666"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoFocus
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color="#666" />
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Grid */}
            <FlatList
                data={filteredTracks}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                numColumns={3}
                contentContainerStyle={styles.gridContent}
                columnWrapperStyle={styles.gridRow}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="musical-notes-outline" size={64} color="#333" />
                        <Text style={styles.emptyTitle}>
                            {searchQuery ? 'Sonuç bulunamadı' : 'Henüz beğeni yok'}
                        </Text>
                        <Text style={styles.emptySubtitle}>
                            {searchQuery
                                ? 'Farklı bir arama deneyin'
                                : 'Şarkıları beğenmeye başlayın!'
                            }
                        </Text>
                    </View>
                }
            />

            {/* Staging Area */}
            <View style={styles.stagingWrapper}>
                <StagingArea
                    onFinalize={handleFinalize}
                    onTrackPress={handlePlayPreview}
                />
            </View>

            {/* Create Playlist Modal */}
            <Modal
                visible={showCreateModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCreateModal(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => !isCreating && setShowCreateModal(false)}
                >
                    <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
                        <View style={styles.modalHeader}>
                            <LinearGradient
                                colors={[Colors.primary, Colors.primaryDark]}
                                style={styles.modalIcon}
                            >
                                <Ionicons name="musical-notes" size={32} color="#fff" />
                            </LinearGradient>
                            <Text style={styles.modalTitle}>Playlist Oluştur</Text>
                            <Text style={styles.modalSubtitle}>
                                {stagingTracks.length} şarkı eklenecek
                            </Text>
                        </View>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Playlist adı..."
                            placeholderTextColor="#666"
                            value={playlistName}
                            onChangeText={setPlaylistName}
                            autoFocus
                            maxLength={50}
                            editable={!isCreating}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalBtnPrimary]}
                                onPress={handleCreatePlaylist}
                                disabled={isCreating}
                                activeOpacity={0.8}
                            >
                                {isCreating ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark" size={20} color="#fff" />
                                        <Text style={styles.modalBtnPrimaryText}>Oluştur</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalBtnSecondary]}
                                onPress={() => setShowCreateModal(false)}
                                disabled={isCreating}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.modalBtnSecondaryText}>İptal</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#0A0A0A',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: -0.5,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        marginHorizontal: 16,
        marginBottom: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        gap: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#fff',
    },
    gridContent: {
        padding: GRID_PADDING,
        paddingBottom: 16,
    },
    gridRow: {
        gap: GRID_GAP,
        marginBottom: GRID_GAP,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 8,
    },
    stagingWrapper: {
        padding: 16,
        paddingTop: 8,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#1e1e1e',
        borderRadius: 24,
        padding: 24,
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    modalIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#888',
        marginTop: 4,
    },
    modalInput: {
        backgroundColor: '#0a0a0a',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 14,
        paddingHorizontal: 18,
        paddingVertical: 16,
        fontSize: 17,
        color: '#fff',
        marginBottom: 24,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    modalBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 14,
        gap: 8,
    },
    modalBtnPrimary: {
        backgroundColor: Colors.primary,
    },
    modalBtnPrimaryText: {
        fontSize: 17,
        fontWeight: 'bold',
        color: '#fff',
    },
    modalBtnSecondary: {
        backgroundColor: '#333',
    },
    modalBtnSecondaryText: {
        fontSize: 17,
        fontWeight: '600',
        color: '#fff',
    },
});

