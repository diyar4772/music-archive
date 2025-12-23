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
    Modal,
    TextInput,
    Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useAuthStore } from '../../stores/authStore';
import { Colors } from '../../constants/theme';
import api from '../../services/api';
import { TrackDetailModal } from '../../components/library';
import { StarRatingInline } from '../../components/ui';
import { UserLike } from '../../types';

// Types
type ViewType = 'dashboard' | 'likes' | 'follows' | 'playlists';

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

    // 📱 View & Modal State
    const [activeView, setActiveView] = useState<ViewType>('dashboard');
    const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [creatingPlaylist, setCreatingPlaylist] = useState(false);

    // 🎵 Track Detail Modal State
    const [selectedTrack, setSelectedTrack] = useState<UserLike | null>(null);
    const [showTrackDetail, setShowTrackDetail] = useState(false);

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

    // 📝 Create Playlist
    const handleCreatePlaylist = useCallback(async () => {
        if (!newPlaylistName.trim()) {
            Alert.alert('Hata', 'Lütfen liste adı girin');
            return;
        }

        setCreatingPlaylist(true);
        try {
            await api.post('/playlists', { name: newPlaylistName.trim() });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setNewPlaylistName('');
            setShowCreatePlaylistModal(false);
            await fetchStats();
            Alert.alert('Başarılı', `"${newPlaylistName.trim()}" listesi oluşturuldu!`);
        } catch (error: any) {
            console.error('Create playlist error:', error);
            Alert.alert('Hata', error?.response?.data?.error || 'Liste oluşturulamadı');
        } finally {
            setCreatingPlaylist(false);
        }
    }, [newPlaylistName, fetchStats]);

    // 🔙 Go back to dashboard
    const goBackToDashboard = useCallback(() => {
        setActiveView('dashboard');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

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

    // Open track detail modal
    const openTrackDetail = useCallback((track: UserLike) => {
        setSelectedTrack(track);
        setShowTrackDetail(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    // Get user rating for a track
    const getTrackRating = useCallback((trackId: string) => {
        return userData?.ratings?.find(r => r.itemId === trackId)?.rating || 0;
    }, [userData?.ratings]);

    // 🎵 Track Row with play/delete
    const renderTrackRow = (track: any) => {
        const isPlaying = playingTrackId === track.trackId;
        const isDeleting = deletingTrackId === track.trackId;
        const trackRating = getTrackRating(track.trackId);

        return (
            <View key={track.trackId} style={styles.trackRow}>
                <TouchableOpacity
                    style={styles.trackMain}
                    onPress={() => openTrackDetail(track)}
                    onLongPress={() => togglePlay(track)}
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
                        <View style={styles.trackNameRow}>
                            <Text style={styles.trackName} numberOfLines={1}>{track.trackName}</Text>
                            {trackRating > 0 && <StarRatingInline rating={trackRating} />}
                        </View>
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

    // 🔙 Back Header Component
    const BackHeader = ({ title }: { title: string }) => (
        <View style={styles.backHeader}>
            <TouchableOpacity
                style={styles.backButton}
                onPress={goBackToDashboard}
                activeOpacity={0.7}
            >
                <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.backHeaderTitle}>{title}</Text>
            <View style={{ width: 40 }} />
        </View>
    );

    // 📋 Likes View
    const renderLikesView = () => (
        <View style={styles.fullView}>
            <BackHeader title={`Beğenilenler (${userData?.likes?.length || 0})`} />
            <FlatList
                data={userData?.likes || []}
                renderItem={({ item }) => renderTrackRow(item)}
                keyExtractor={(item) => item.trackId}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="heart-outline" size={64} color="#333" />
                        <Text style={styles.emptyTitle}>Henüz beğeni yok</Text>
                        <Text style={styles.emptySubtitle}>Şarkıları beğenmeye başla!</Text>
                    </View>
                }
            />
        </View>
    );

    // 👥 Follows View
    const renderFollowsView = () => (
        <View style={styles.fullView}>
            <BackHeader title={`Takip Edilenler (${userData?.follows?.length || 0})`} />
            <FlatList
                data={userData?.follows || []}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.artistRow} activeOpacity={0.7}>
                        {item.image ? (
                            <Image source={{ uri: item.image }} style={styles.artistRowImage} />
                        ) : (
                            <View style={[styles.artistRowImage, styles.placeholder]}>
                                <Ionicons name="person" size={24} color="#666" />
                            </View>
                        )}
                        <Text style={styles.artistRowName}>{item.artistName}</Text>
                        <Ionicons name="chevron-forward" size={20} color="#666" />
                    </TouchableOpacity>
                )}
                keyExtractor={(item) => item.artistId}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="people-outline" size={64} color="#333" />
                        <Text style={styles.emptyTitle}>Henüz takip yok</Text>
                        <Text style={styles.emptySubtitle}>Sanatçıları takip etmeye başla!</Text>
                    </View>
                }
            />
        </View>
    );

    // 🎵 Playlists View
    const renderPlaylistsView = () => (
        <View style={styles.fullView}>
            <BackHeader title={`Listelerim (${playlistsCount})`} />
            <FlatList
                data={MOCK_PLAYLISTS}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.playlistRow} activeOpacity={0.7}>
                        <View style={[styles.playlistRowCover, { backgroundColor: item.color }]}>
                            <Ionicons name="musical-notes" size={24} color="rgba(255,255,255,0.8)" />
                        </View>
                        <View style={styles.playlistRowInfo}>
                            <Text style={styles.playlistRowName}>{item.name}</Text>
                            <Text style={styles.playlistRowCount}>{item.trackCount} şarkı</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#666" />
                    </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="list-outline" size={64} color="#333" />
                        <Text style={styles.emptyTitle}>Henüz liste yok</Text>
                        <Text style={styles.emptySubtitle}>Yeni bir liste oluştur!</Text>
                    </View>
                }
                ListFooterComponent={
                    <TouchableOpacity
                        style={styles.createPlaylistButton}
                        onPress={() => setShowCreatePlaylistModal(true)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="add-circle" size={24} color={Colors.primary} />
                        <Text style={styles.createPlaylistText}>Yeni Liste Oluştur</Text>
                    </TouchableOpacity>
                }
            />
        </View>
    );

    // 🎨 Create Playlist Modal
    const renderCreatePlaylistModal = () => (
        <Modal
            visible={showCreatePlaylistModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowCreatePlaylistModal(false)}
        >
            <Pressable
                style={styles.modalOverlay}
                onPress={() => setShowCreatePlaylistModal(false)}
            >
                <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.modalHeader}>
                        <View style={styles.modalIconContainer}>
                            <Ionicons name="musical-notes" size={32} color="#fff" />
                        </View>
                        <Text style={styles.modalTitle}>Yeni Liste Oluştur</Text>
                        <Text style={styles.modalSubtitle}>Şarkılarını organize et</Text>
                    </View>

                    <TextInput
                        style={styles.modalInput}
                        placeholder="Liste adı..."
                        placeholderTextColor="#666"
                        value={newPlaylistName}
                        onChangeText={setNewPlaylistName}
                        autoFocus
                        maxLength={50}
                        onSubmitEditing={handleCreatePlaylist}
                    />

                    <View style={styles.modalActions}>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.modalButtonPrimary]}
                            onPress={handleCreatePlaylist}
                            disabled={creatingPlaylist}
                            activeOpacity={0.8}
                        >
                            {creatingPlaylist ? (
                                <Ionicons name="sync" size={20} color="#000" />
                            ) : (
                                <>
                                    <Ionicons name="add" size={20} color="#000" />
                                    <Text style={styles.modalButtonPrimaryText}>Oluştur</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.modalButtonSecondary]}
                            onPress={() => setShowCreatePlaylistModal(false)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.modalButtonSecondaryText}>İptal</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );

    // Track Detail Modal Component
    const renderTrackDetailModal = () => (
        <TrackDetailModal
            visible={showTrackDetail}
            onClose={() => {
                setShowTrackDetail(false);
                setSelectedTrack(null);
            }}
            track={selectedTrack}
            onAddToPlaylist={(track) => {
                setShowTrackDetail(false);
                // TODO: Open add to playlist modal
                Alert.alert('Listeye Ekle', `"${track.trackName}" listeye eklenecek`);
            }}
        />
    );

    // Render based on active view
    if (activeView === 'likes') {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                {renderLikesView()}
                {renderCreatePlaylistModal()}
                {renderTrackDetailModal()}
            </SafeAreaView>
        );
    }

    if (activeView === 'follows') {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                {renderFollowsView()}
                {renderCreatePlaylistModal()}
                {renderTrackDetailModal()}
            </SafeAreaView>
        );
    }

    if (activeView === 'playlists') {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                {renderPlaylistsView()}
                {renderCreatePlaylistModal()}
                {renderTrackDetailModal()}
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {renderCreatePlaylistModal()}
            {renderTrackDetailModal()}
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
                            onPress={() => {
                                setActiveView('likes');
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            }}
                        />
                        <DashboardCard
                            icon="people"
                            title="Sanatçılar"
                            subtitle={`${followedArtistsCount} Takip`}
                            gradientColors={['#3B82F6', '#2563EB']}
                            onPress={() => {
                                setActiveView('follows');
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            }}
                        />
                    </View>
                    <View style={styles.cardRow}>
                        <DashboardCard
                            icon="list"
                            title="Listelerim"
                            subtitle={`${playlistsCount} Liste`}
                            gradientColors={['#10B981', '#059669']}
                            onPress={() => {
                                setActiveView('playlists');
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            }}
                        />
                        <DashboardCard
                            icon="add"
                            title="Yeni Liste"
                            subtitle=""
                            gradientColors={['#333', '#222']}
                            isDashed
                            onPress={() => {
                                setShowCreatePlaylistModal(true);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            }}
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
    trackNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    trackName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
        flexShrink: 1,
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
    // === Full View Styles ===
    fullView: {
        flex: 1,
    },
    backHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1e1e1e',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#1e1e1e',
        alignItems: 'center',
        justifyContent: 'center',
    },
    backHeaderTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    listContent: {
        padding: 16,
        gap: 8,
    },
    // === Artist Row ===
    artistRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#151515',
        padding: 14,
        borderRadius: 12,
    },
    artistRowImage: {
        width: 56,
        height: 56,
        borderRadius: 28,
    },
    artistRowName: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginLeft: 14,
    },
    // === Playlist Row ===
    playlistRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#151515',
        padding: 14,
        borderRadius: 12,
    },
    playlistRowCover: {
        width: 56,
        height: 56,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playlistRowInfo: {
        flex: 1,
        marginLeft: 14,
    },
    playlistRowName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    playlistRowCount: {
        fontSize: 13,
        color: '#888',
        marginTop: 2,
    },
    // === Empty State ===
    emptyState: {
        alignItems: 'center',
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
    // === Create Playlist Button ===
    createPlaylistButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1e1e1e',
        padding: 16,
        borderRadius: 12,
        marginTop: 8,
        gap: 8,
    },
    createPlaylistText: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.primary,
    },
    // === Modal Styles ===
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#1e1e1e',
        borderRadius: 20,
        padding: 24,
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    modalIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 22,
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
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#fff',
        marginBottom: 20,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 28,
        gap: 8,
    },
    modalButtonPrimary: {
        backgroundColor: Colors.primary,
    },
    modalButtonPrimaryText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000',
    },
    modalButtonSecondary: {
        backgroundColor: '#333',
    },
    modalButtonSecondaryText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});
