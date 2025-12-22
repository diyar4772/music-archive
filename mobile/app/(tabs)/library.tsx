import React, { useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    Image,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Dimensions,
    Alert,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../stores/authStore';
import { Colors } from '../../constants/theme';
import api from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2; // 16px padding + 16px gap

// � Mock Playlists Data
const MOCK_PLAYLISTS = [
    { id: '1', name: 'Chill Vibes', color: '#6366F1', trackCount: 24 },
    { id: '2', name: 'Gym Power', color: '#EF4444', trackCount: 18 },
    { id: '3', name: 'Nostalgia', color: '#F59E0B', trackCount: 32 },
    { id: '4', name: 'Focus Flow', color: '#10B981', trackCount: 15 },
];

// 🎨 Dashboard Card Component
interface DashboardCardProps {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle: string;
    gradientColors: [string, string];
    onPress?: () => void;
    isDashed?: boolean;
}

const DashboardCard = ({ icon, title, subtitle, gradientColors, onPress, isDashed }: DashboardCardProps) => (
    <TouchableOpacity
        style={[styles.dashboardCard, isDashed && styles.dashedCard]}
        onPress={onPress}
        activeOpacity={0.8}
    >
        {!isDashed ? (
            <LinearGradient
                colors={gradientColors}
                style={styles.cardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.cardIconContainer}>
                    <Ionicons name={icon} size={28} color="#fff" />
                </View>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardSubtitle}>{subtitle}</Text>
            </LinearGradient>
        ) : (
            <View style={styles.dashedCardInner}>
                <View style={styles.cardIconContainerDashed}>
                    <Ionicons name={icon} size={32} color="#666" />
                </View>
                <Text style={styles.cardTitleDashed}>{title}</Text>
            </View>
        )}
    </TouchableOpacity>
);

// 🎵 Playlist Card Component
const PlaylistCard = ({ playlist }: { playlist: typeof MOCK_PLAYLISTS[0] }) => (
    <TouchableOpacity style={styles.playlistCard} activeOpacity={0.8}>
        <View style={[styles.playlistCover, { backgroundColor: playlist.color }]}>
            <Ionicons name="musical-notes" size={36} color="rgba(255,255,255,0.8)" />
        </View>
        <Text style={styles.playlistName} numberOfLines={1}>{playlist.name}</Text>
        <Text style={styles.playlistCount}>{playlist.trackCount} şarkı</Text>
    </TouchableOpacity>
);

// � Track Row Component
const TrackRow = ({ track }: { track: any }) => (
    <TouchableOpacity style={styles.trackRow} activeOpacity={0.7}>
        {track.image ? (
            <Image source={{ uri: track.image }} style={styles.trackImage} />
        ) : (
            <View style={[styles.trackImage, styles.placeholder]}>
                <Ionicons name="musical-note" size={20} color="#666" />
            </View>
        )}
        <View style={styles.trackInfo}>
            <Text style={styles.trackName} numberOfLines={1}>{track.trackName}</Text>
            <Text style={styles.trackArtist} numberOfLines={1}>
                {track.artistName || 'Unknown Artist'}
            </Text>
        </View>
        <TouchableOpacity style={styles.trackPlayBtn}>
            <Ionicons name="play" size={18} color={Colors.primary} />
        </TouchableOpacity>
    </TouchableOpacity>
);

export default function LibraryScreen() {
    const { userData, refreshUserData } = useAuthStore();
    const [searchVisible, setSearchVisible] = useState(false);
    const [sortOrder, setSortOrder] = useState<'recent' | 'name'>('recent');
    const [dashboardStats, setDashboardStats] = useState({
        likedTracksCount: 0,
        followedArtistsCount: 0,
        playlistsCount: 0,
        albumsCount: 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // 🎵 Audio Preview State
    const soundRef = useRef<Audio.Sound | null>(null);
    const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
    const [deletingTrackId, setDeletingTrackId] = useState<string | null>(null);

    // Fetch dashboard stats on mount
    const fetchStats = useCallback(async () => {
        try {
            const response = await api.get('/library/dashboard');
            setDashboardStats(response.data);
        } catch (error) {
            console.error('Failed to fetch dashboard stats:', error);
            // Fallback to userData counts
            setDashboardStats({
                likedTracksCount: userData?.likes?.length || 0,
                followedArtistsCount: userData?.follows?.length || 0,
                playlistsCount: MOCK_PLAYLISTS.length,
                albumsCount: userData?.albumFollows?.length || 0,
            });
        } finally {
            setIsLoading(false);
        }
    }, [userData]);

    React.useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    // Pull to refresh
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await refreshUserData();
            await fetchStats();
        } finally {
            setRefreshing(false);
        }
    }, [refreshUserData, fetchStats]);

    // 🎵 Play/Stop Preview
    const togglePlay = useCallback(async (track: any) => {
        try {
            if (playingTrackId === track.trackId) {
                if (soundRef.current) {
                    await soundRef.current.stopAsync();
                    await soundRef.current.unloadAsync();
                    soundRef.current = null;
                }
                setPlayingTrackId(null);
                return;
            }

            if (soundRef.current) {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
                soundRef.current = null;
            }

            if (!track.previewUrl) {
                Alert.alert('Önizleme Yok', 'Bu şarkı için önizleme mevcut değil');
                return;
            }

            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
            });

            const { sound } = await Audio.Sound.createAsync(
                { uri: track.previewUrl },
                { shouldPlay: true, volume: 1.0 }
            );

            soundRef.current = sound;
            setPlayingTrackId(track.trackId);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    setPlayingTrackId(null);
                }
            });
        } catch (error) {
            console.error('Play error:', error);
            setPlayingTrackId(null);
        }
    }, [playingTrackId]);

    // 🗑️ Delete Track
    const handleDeleteTrack = useCallback(async (track: any) => {
        if (deletingTrackId) return;

        Alert.alert(
            'Şarkıyı Sil',
            `"${track.trackName}" kütüphaneden silinecek. Emin misin?`,
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        setDeletingTrackId(track.trackId);
                        try {
                            await api.delete(`/library/track/${track.trackId}`);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            await refreshUserData();
                            await fetchStats();
                        } catch (error: any) {
                            console.error('Delete error:', error);
                            Alert.alert('Hata', error?.response?.data?.error || 'Şarkı silinirken bir hata oluştu');
                        } finally {
                            setDeletingTrackId(null);
                        }
                    }
                }
            ]
        );
    }, [deletingTrackId, refreshUserData, fetchStats]);

    const { likedTracksCount, followedArtistsCount, playlistsCount } = dashboardStats;

    // Get recent tracks with optional sorting
    const recentTracks = React.useMemo(() => {
        const tracks = userData?.likes?.slice(0, 10) || [];
        if (sortOrder === 'name') {
            return [...tracks].sort((a, b) =>
                (a.trackName || '').localeCompare(b.trackName || '')
            );
        }
        return tracks; // 'recent' = default order from API
    }, [userData?.likes, sortOrder]);

    // 🎵 Track Row with play/delete
    const renderTrackRow = (track: any) => {
        const isPlaying = playingTrackId === track.trackId;
        const isDeleting = deletingTrackId === track.trackId;

        return (
            <View key={track.trackId} style={styles.trackRow}>
                <TouchableOpacity
                    style={styles.trackMain}
                    onPress={() => togglePlay(track)}
                    activeOpacity={0.7}
                >
                    <View style={styles.trackImageContainer}>
                        {track.image ? (
                            <Image source={{ uri: track.image }} style={styles.trackImage} />
                        ) : (
                            <View style={[styles.trackImage, styles.placeholder]}>
                                <Ionicons name="musical-note" size={20} color="#666" />
                            </View>
                        )}
                        {track.previewUrl && (
                            <View style={[styles.playOverlay, isPlaying && styles.playOverlayActive]}>
                                <Ionicons
                                    name={isPlaying ? 'pause' : 'play'}
                                    size={16}
                                    color="#fff"
                                />
                            </View>
                        )}
                    </View>
                    <View style={styles.trackInfo}>
                        <Text style={styles.trackName} numberOfLines={1}>{track.trackName}</Text>
                        <Text style={styles.trackArtist} numberOfLines={1}>
                            {track.artistName || 'Unknown Artist'}
                        </Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.trackDeleteBtn, isDeleting && styles.btnLoading]}
                    onPress={() => handleDeleteTrack(track)}
                    disabled={isDeleting}
                >
                    <Ionicons
                        name={isDeleting ? 'sync' : 'trash-outline'}
                        size={18}
                        color="#ef4444"
                    />
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <ScrollView
                style={styles.container}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.primary}
                        colors={[Colors.primary]}
                    />
                }
            >
                {/* 🔍 Header with Search + Sort */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Kütüphanem</Text>
                        <Text style={styles.headerSubtitle}>Koleksiyonunu keşfet</Text>
                    </View>
                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            style={styles.headerBtn}
                            onPress={() => setSortOrder(sortOrder === 'recent' ? 'name' : 'recent')}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={sortOrder === 'recent' ? 'time-outline' : 'text-outline'}
                                size={20}
                                color={sortOrder === 'name' ? Colors.primary : '#888'}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.headerBtn}
                            onPress={() => setSearchVisible(!searchVisible)}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="search" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 🎛️ Command Center - 2x2 Grid */}
                <View style={styles.commandCenter}>
                    <View style={styles.cardRow}>
                        <DashboardCard
                            icon="heart"
                            title="Beğenilenler"
                            subtitle={`${likedTracksCount} Şarkı`}
                            gradientColors={['#9333EA', '#7C3AED']}
                        />
                        <DashboardCard
                            icon="people"
                            title="Sanatçılar"
                            subtitle={`${followedArtistsCount} Takip`}
                            gradientColors={['#3B82F6', '#2563EB']}
                        />
                    </View>
                    <View style={styles.cardRow}>
                        <DashboardCard
                            icon="list"
                            title="Listelerim"
                            subtitle={`${playlistsCount} Liste`}
                            gradientColors={['#10B981', '#059669']}
                        />
                        <DashboardCard
                            icon="add"
                            title="Yeni Liste"
                            subtitle=""
                            gradientColors={['#333', '#222']}
                            isDashed
                        />
                    </View>
                </View>

                {/* 🎵 Horizontal Playlists */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Oynatma Listelerim</Text>
                        <TouchableOpacity>
                            <Text style={styles.seeAllBtn}>Tümü</Text>
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={MOCK_PLAYLISTS}
                        renderItem={({ item }) => <PlaylistCard playlist={item} />}
                        keyExtractor={(item) => item.id}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.playlistList}
                    />
                </View>

                {/* 📋 Recent Tracks */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Son Eklenenler</Text>
                        <TouchableOpacity>
                            <Text style={styles.seeAllBtn}>Tümü</Text>
                        </TouchableOpacity>
                    </View>

                    {recentTracks.length > 0 ? (
                        <View style={styles.trackList}>
                            {recentTracks.map((track: any) => renderTrackRow(track))}
                        </View>
                    ) : (
                        <View style={styles.emptyTracks}>
                            <Ionicons name="musical-notes-outline" size={40} color="#333" />
                            <Text style={styles.emptyText}>Henüz şarkı eklenmedi</Text>
                            <Text style={styles.emptyHint}>Keşfet modundan beğenmeye başla!</Text>
                        </View>
                    )}
                </View>

                {/* 👤 Followed Artists Quick View */}
                {followedArtistsCount > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Takip Ettiklerin</Text>
                            <TouchableOpacity>
                                <Text style={styles.seeAllBtn}>Tümü</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={userData?.follows?.slice(0, 10) || []}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.artistChip} activeOpacity={0.7}>
                                    {item.image ? (
                                        <Image source={{ uri: item.image }} style={styles.artistChipImage} />
                                    ) : (
                                        <View style={[styles.artistChipImage, styles.placeholder]}>
                                            <Ionicons name="person" size={16} color="#666" />
                                        </View>
                                    )}
                                    <Text style={styles.artistChipName} numberOfLines={1}>
                                        {item.artistName}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            keyExtractor={(item) => item.artistId}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.artistChipList}
                        />
                    </View>
                )}

                {/* Bottom Spacing */}
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    // === Header ===
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 20,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#888',
        marginTop: 4,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#1e1e1e',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // === Command Center ===
    commandCenter: {
        paddingHorizontal: 16,
        marginBottom: 28,
    },
    cardRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    dashboardCard: {
        width: CARD_WIDTH,
        height: 110,
        borderRadius: 16,
        overflow: 'hidden',
    },
    cardGradient: {
        flex: 1,
        padding: 16,
        justifyContent: 'space-between',
    },
    cardIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    cardSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.75)',
        marginTop: -4,
    },
    // Dashed Card (New Playlist)
    dashedCard: {
        borderWidth: 2,
        borderColor: '#333',
        borderStyle: 'dashed',
        backgroundColor: 'transparent',
    },
    dashedCardInner: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    cardIconContainerDashed: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#1e1e1e',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitleDashed: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    // === Section ===
    section: {
        marginBottom: 28,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    seeAllBtn: {
        fontSize: 14,
        color: Colors.primary,
        fontWeight: '600',
    },
    // === Playlist Cards ===
    playlistList: {
        paddingHorizontal: 16,
        gap: 12,
    },
    playlistCard: {
        width: 120,
    },
    playlistCover: {
        width: 120,
        height: 120,
        borderRadius: 16, // Softer rounded corners
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    playlistName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    playlistCount: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    // === Track List ===
    trackList: {
        paddingHorizontal: 16,
        gap: 8,
    },
    trackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#151515',
        padding: 12,
        borderRadius: 12,
        // marginBottom removed - using gap in parent
    },
    trackImage: {
        width: 50,
        height: 50,
        borderRadius: 8,
    },
    trackInfo: {
        flex: 1,
        marginLeft: 14,
    },
    trackName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    trackArtist: {
        fontSize: 13,
        color: '#888',
        marginTop: 3,
    },
    trackPlayBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(29, 185, 84, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholder: {
        backgroundColor: '#1e1e1e',
        alignItems: 'center',
        justifyContent: 'center',
    },
    trackMain: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    trackImageContainer: {
        position: 'relative',
    },
    playOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0,
    },
    playOverlayActive: {
        opacity: 1,
        backgroundColor: 'rgba(29, 185, 84, 0.8)',
    },
    trackDeleteBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    btnLoading: {
        opacity: 0.5,
    },
    // === Empty State ===
    emptyTracks: {
        alignItems: 'center',
        paddingVertical: 32,
        paddingHorizontal: 16,
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        marginTop: 12,
        fontWeight: '600',
    },
    emptyHint: {
        fontSize: 13,
        color: '#444',
        marginTop: 4,
    },
    // === Artist Chips ===
    artistChipList: {
        paddingHorizontal: 16,
        gap: 10,
    },
    artistChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e1e1e',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 24,
        // marginRight removed - using gap in parent
    },
    artistChipImage: {
        width: 28,
        height: 28,
        borderRadius: 14,
    },
    artistChipName: {
        fontSize: 13,
        color: '#fff',
        marginLeft: 8,
        fontWeight: '500',
        maxWidth: 100,
    },
});
