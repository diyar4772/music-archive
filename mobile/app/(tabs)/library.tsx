import React, { useState, useRef, useCallback, useEffect } from 'react';
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
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import hapticService from '../../services/hapticService';
import { BlurView } from 'expo-blur';
import { useAuthStore } from '../../stores/authStore';
import { Colors } from '../../constants/theme';
import api from '../../services/api';
import { TrackDetailModal } from '../../components/library';
import { StarRatingInline } from '../../components/ui';
import { UserLike } from '../../types';
import { handleApiError } from '../../utils/errorHandler';
import logger from '../../utils/logger';

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
    style?: any;
    titleStyle?: any;
}

const DashboardCard = ({ icon, title, subtitle, gradientColors, onPress, isDashed, style, titleStyle }: DashboardCardProps) => (
    <TouchableOpacity
        style={[styles.dashboardCard, isDashed && styles.dashedCard, style]}
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
                <View style={[styles.cardIconContainer, isDashed && styles.dashedIconContainer]}>
                    <Ionicons name={icon} size={24} color={isDashed ? '#666' : '#fff'} />
                </View>
                <View>
                    <Text style={[styles.cardTitle, titleStyle]} numberOfLines={1}>{title}</Text>
                    {subtitle ? <Text style={styles.cardSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
                </View>
            </LinearGradient>
        ) : (
            <View style={styles.dashedCardInner}>
                <View style={styles.cardIconContainerDashed}>
                    <Ionicons name={icon} size={28} color="#666" />
                </View>
                <Text style={styles.cardTitleDashed}>{title}</Text>
                {subtitle ? <Text style={styles.cardSubtitleDashed}>{subtitle}</Text> : null}
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

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            const cleanup = async () => {
                try {
                    if (soundRef.current) {
                        const status = await soundRef.current.getStatusAsync();
                        if (status.isLoaded) {
                            await soundRef.current.stopAsync();
                        }
                        await soundRef.current.unloadAsync();
                        soundRef.current = null;
                    }
                } catch (error) {
                    logger.warn('Audio cleanup error on unmount', error, 'LibraryScreen');
                }
            };
            cleanup();
        };
    }, []);

    // Fetch dashboard stats on mount
    const fetchStats = useCallback(async () => {
        try {
            const response = await api.get('/library/dashboard');
            setDashboardStats(response.data);
        } catch (error) {
            handleApiError(error, 'fetchStats', false); // Don't show alert, use fallback
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
            hapticService.lightImpact();

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    setPlayingTrackId(null);
                }
            });
        } catch (error) {
            logger.error('Play error', error, 'LibraryScreen');
            setPlayingTrackId(null);
            Alert.alert('Hata', 'Şarkı oynatılırken bir hata oluştu');
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
                            hapticService.success();
                            await refreshUserData();
                            await fetchStats();
                        } catch (error: any) {
                            handleApiError(error, 'handleDeleteTrack');
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
            hapticService.success();
            setNewPlaylistName('');
            setShowCreatePlaylistModal(false);
            await fetchStats();
            Alert.alert('Başarılı', `"${newPlaylistName.trim()}" listesi oluşturuldu!`);
        } catch (error: any) {
            handleApiError(error, 'handleCreatePlaylist');
        } finally {
            setCreatingPlaylist(false);
        }
    }, [newPlaylistName, fetchStats]);

    // 🔙 Go back to dashboard
    const goBackToDashboard = useCallback(() => {
        setActiveView('dashboard');
        hapticService.lightImpact();
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
        hapticService.lightImpact();
    }, []);

    // Get user rating for a track
    const getTrackRating = useCallback((trackId: string) => {
        return userData?.ratings?.find(r => r.itemId === trackId)?.rating || 0;
    }, [userData?.ratings]);

    // Calculate Average Rating
    const averageRating = React.useMemo(() => {
        const ratings = userData?.ratings || [];
        if (ratings.length === 0) return 0;
        const sum = ratings.reduce((acc: number, r: any) => acc + r.rating, 0);
        return (sum / ratings.length).toFixed(1);
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

    // 🎵 User Playlists State
    const [userPlaylists, setUserPlaylists] = useState<typeof MOCK_PLAYLISTS>([]);
    const [loadingPlaylists, setLoadingPlaylists] = useState(true);

    // Fetch user-created playlists (filter out system/auto-generated)
    const fetchUserPlaylists = useCallback(async () => {
        setLoadingPlaylists(true);
        try {
            const response = await api.get('/playlists');
            const allPlaylists = response.data?.playlists || response.data || [];

            // Filter ONLY user-created playlists
            // Exclude: system playlists, auto-generated mixes, Discover Weekly etc.
            const filtered = allPlaylists.filter((p: any) => {
                // Skip if marked as system or auto-generated
                if (p.isSystem || p.isAutoGenerated) return false;
                // Skip if name suggests auto-generation
                const autoNames = ['Daily Mix', 'Discover Weekly', 'Release Radar', 'On Repeat', 'Repeat Rewind'];
                if (autoNames.some(name => p.name?.includes(name))) return false;
                return true;
            });

            setUserPlaylists(filtered.map((p: any) => ({
                id: p._id || p.id,
                name: p.name,
                color: p.color || '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
                trackCount: p.trackCount || p.tracks?.length || 0,
            })));
        } catch (error) {
            handleApiError(error, 'fetchUserPlaylists', false); // Don't show alert, use fallback
            // Fallback to empty if API fails
            setUserPlaylists([]);
        } finally {
            setLoadingPlaylists(false);
        }
    }, []);

    // Fetch playlists on mount
    React.useEffect(() => {
        fetchUserPlaylists();
    }, [fetchUserPlaylists]);

    // 🎵 Playlists View - Only User Created
    const renderPlaylistsView = () => (
        <View style={styles.fullView}>
            <BackHeader title={`Listelerim (${userPlaylists.length})`} />
            <FlatList
                data={userPlaylists}
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
                refreshing={loadingPlaylists}
                onRefresh={fetchUserPlaylists}
                ListEmptyComponent={
                    loadingPlaylists ? (
                        <View style={styles.emptyState}>
                            <ActivityIndicator size="large" color={Colors.primary} />
                            <Text style={styles.emptySubtitle}>Listeler yükleniyor...</Text>
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons name="list-outline" size={64} color="#333" />
                            <Text style={styles.emptyTitle}>Henüz liste yok</Text>
                            <Text style={styles.emptySubtitle}>Yeni bir liste oluştur!</Text>
                        </View>
                    )
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

                {/* 🎛️ Command Center - Dynamic Grid */}
                <View style={styles.commandCenter}>
                    {/* Top Section: Big Left Card + Right Column */}
                    <View style={styles.gridTopRow}>
                        {/* LEFT: Big 'Liked' Card */}
                        <DashboardCard
                            icon="heart"
                            title="Beğenilenler"
                            subtitle={`${likedTracksCount} Şarkı`}
                            gradientColors={['#9333EA', '#7C3AED']}
                            style={styles.bigCard}
                            titleStyle={{ fontSize: 20, marginTop: 4 }}
                            onPress={() => {
                                setActiveView('likes');
                                hapticService.mediumImpact();
                            }}
                        />

                        {/* RIGHT: Column */}
                        <View style={styles.gridRightCol}>
                            {/* Top Right: Followed */}
                            <DashboardCard
                                icon="people"
                                title="Takip Edilenler"
                                subtitle={`${followedArtistsCount} Sanatçı`}
                                gradientColors={['#3B82F6', '#2563EB']}
                                style={styles.smallCard}
                                onPress={() => {
                                    setActiveView('follows');
                                    hapticService.mediumImpact();
                                }}
                            />

                            {/* Bottom Right: Lists + Avg Score */}
                            <View style={styles.gridRightBottomRow}>
                                <DashboardCard
                                    icon="list"
                                    title="Listelerim"
                                    subtitle={`${playlistsCount}`}
                                    gradientColors={['#10B981', '#059669']}
                                    style={styles.miniCard}
                                    titleStyle={{ fontSize: 13 }}
                                    onPress={() => {
                                        setActiveView('playlists');
                                        hapticService.mediumImpact();
                                    }}
                                />
                                <DashboardCard
                                    icon="star"
                                    title="Ort. Puan"
                                    subtitle={String(averageRating)}
                                    gradientColors={['#F59E0B', '#D97706']}
                                    style={styles.miniCard}
                                    titleStyle={{ fontSize: 13 }}
                                    onPress={() => {
                                        // Optional: Navigate to ratings view
                                        hapticService.lightImpact();
                                    }}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Bottom: Create New Playlist (Wide) */}
                    <TouchableOpacity
                        style={styles.createPlaylistCard}
                        onPress={() => {
                            setShowCreatePlaylistModal(true);
                            hapticService.mediumImpact();
                        }}
                        activeOpacity={0.8}
                    >
                        <View style={styles.createIconContainer}>
                            <Ionicons name="add" size={24} color="#fff" />
                        </View>
                        <View style={styles.createTextContainer}>
                            <Text style={styles.createTitle}>Yeni Liste Oluştur</Text>
                            <Text style={styles.createSubtitle}>Şarkılarını organize et</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#666" />
                    </TouchableOpacity>
                </View>

                {/* 🎵 Horizontal Playlists - User Created Only */}
                {userPlaylists.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Oynatma Listelerim</Text>
                            <TouchableOpacity onPress={() => setActiveView('playlists')}>
                                <Text style={styles.seeAllBtn}>Tümü</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={userPlaylists.slice(0, 5)}
                            renderItem={({ item }) => <PlaylistCard playlist={item} />}
                            keyExtractor={(item) => item.id}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.playlistList}
                        />
                    </View>
                )}

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
        borderRadius: 16,
        overflow: 'hidden',
    },
    gridTopRow: {
        flexDirection: 'row',
        height: 190,
        gap: 12,
        marginBottom: 12,
    },
    bigCard: {
        flex: 1.3,
        height: '100%',
    },
    gridRightCol: {
        flex: 1,
        gap: 12,
    },
    smallCard: {
        flex: 1,
    },
    gridRightBottomRow: {
        flex: 1,
        flexDirection: 'row',
        gap: 12,
    },
    miniCard: {
        flex: 1,
    },
    cardGradient: {
        flex: 1,
        padding: 14,
        justifyContent: 'space-between',
    },
    cardIconContainer: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 2,
    },
    cardSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
    },
    // Dashed Card
    dashedCard: {
        borderWidth: 1.5,
        borderColor: '#333',
        borderStyle: 'dashed',
        backgroundColor: 'transparent',
    },
    dashedCardInner: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    dashedIconContainer: {
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    cardIconContainerDashed: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#1e1e1e',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitleDashed: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        textAlign: 'center',
    },
    cardSubtitleDashed: {
        fontSize: 11,
        color: '#444',
        marginTop: 2,
    },
    // Create Playlist Custom Card
    createPlaylistCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#161616',
        borderWidth: 1,
        borderColor: '#222',
        borderRadius: 16,
        padding: 16,
        height: 72,
    },
    createIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#252525',
        alignItems: 'center',
        justifyContent: 'center',
    },
    createTextContainer: {
        flex: 1,
        marginLeft: 14,
    },
    createTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
    },
    createSubtitle: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
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
