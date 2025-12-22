import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';
import { Artist, Track } from '../../types';
import { Colors } from '../../constants/theme';

// 🦴 Skeleton Loader Component
const SkeletonItem = ({ isArtist = false }: { isArtist?: boolean }) => {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <View style={styles.resultItem}>
      <Animated.View
        style={[
          isArtist ? styles.skeletonArtistImage : styles.skeletonTrackImage,
          { opacity },
        ]}
      />
      <View style={styles.resultInfo}>
        <Animated.View style={[styles.skeletonTitle, { opacity }]} />
        <Animated.View style={[styles.skeletonSubtitle, { opacity }]} />
      </View>
    </View>
  );
};

// 📦 Skeleton List
const SkeletonList = ({ isArtist = false }: { isArtist?: boolean }) => (
  <View style={styles.list}>
    {[1, 2, 3, 4, 5].map((i) => (
      <SkeletonItem key={i} isArtist={isArtist} />
    ))}
  </View>
);

export default function HomeScreen() {
  const { user, userData, refreshUserData } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'artist' | 'track'>('artist');
  const [artistResults, setArtistResults] = useState<Artist[]>([]);
  const [trackResults, setTrackResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  // Audio state
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);

  // Get user's liked track IDs for UI
  const likedTrackIds = userData?.likes?.map((l: any) => l.trackId) || [];
  const followedArtistIds = userData?.follows?.map((f: any) => f.artistId) || [];

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await api.get('/search', {
        params: {
          artist: searchQuery,
          type: searchType,
        },
      });
      if (searchType === 'artist') {
        setArtistResults(response.data);
        setTrackResults([]);
      } else {
        setTrackResults(response.data);
        setArtistResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Hata', 'Arama yapılırken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // 🎵 Play/Stop Preview
  const togglePlay = useCallback(async (track: Track) => {
    try {
      // If same track is playing, stop it
      if (playingTrackId === track.id) {
        if (soundRef.current) {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        setPlayingTrackId(null);
        return;
      }

      // Stop current track if any
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      if (!track.preview_url) {
        Alert.alert('Önizleme Yok', 'Bu şarkı için önizleme mevcut değil');
        return;
      }

      // Play new track
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: track.preview_url },
        { shouldPlay: true, volume: 1.0 }
      );

      soundRef.current = sound;
      setPlayingTrackId(track.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Auto-stop after preview ends
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

  // ❤️ Like Track
  const [likingTrackId, setLikingTrackId] = useState<string | null>(null);

  const handleLikeTrack = async (track: Track) => {
    if (likingTrackId === track.id) return; // Prevent double-tap

    setLikingTrackId(track.id);
    try {
      const isLiked = likedTrackIds.includes(track.id);

      if (isLiked) {
        // Unlike - Remove from library
        await api.delete(`/library/track/${track.id}`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        // Like - Add to library using new endpoint
        await api.post('/library/like', {
          spotifyId: track.id,
          title: track.name,
          artist: track.artist,
          artistId: track.artistId,
          albumArt: track.image,
          previewUrl: track.preview_url,
          source: 'search',
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Refresh user data
      await refreshUserData();
    } catch (error: any) {
      console.error('Like error:', error?.response?.data || error.message);
      Alert.alert('Hata', error?.response?.data?.error || 'Şarkı eklenirken bir hata oluştu');
    } finally {
      setLikingTrackId(null);
    }
  };

  // 👤 Follow Artist
  const [followingArtistId, setFollowingArtistId] = useState<string | null>(null);

  const handleFollowArtist = async (artist: Artist) => {
    if (followingArtistId === artist.id) return; // Prevent double-tap

    setFollowingArtistId(artist.id);
    try {
      // Toggle follow using new library endpoint
      const response = await api.post('/library/follow', {
        artistId: artist.id,
        artistName: artist.name,
        image: artist.image,
      });

      // Haptic based on action
      if (response.data?.action === 'followed') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Refresh user data
      await refreshUserData();
    } catch (error: any) {
      console.error('Follow error:', error?.response?.data || error.message);
      Alert.alert('Hata', error?.response?.data?.error || 'Sanatçı takip edilirken bir hata oluştu');
    } finally {
      setFollowingArtistId(null);
    }
  };

  // 🎨 Render Artist Card
  const renderArtist = ({ item }: { item: Artist }) => {
    const isFollowed = followedArtistIds.includes(item.id);
    const isLoading = followingArtistId === item.id;

    return (
      <View style={styles.resultItem}>
        <TouchableOpacity style={styles.resultMain}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.artistImage} />
          ) : (
            <View style={[styles.artistImage, styles.placeholderImage]}>
              <Ionicons name="person" size={24} color="#666" />
            </View>
          )}
          <View style={styles.resultInfo}>
            <Text style={styles.resultName}>{item.name}</Text>
            {item.genres && <Text style={styles.resultSub}>{item.genres}</Text>}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, isFollowed && styles.actionBtnActive, isLoading && styles.actionBtnLoading]}
          onPress={() => handleFollowArtist(item)}
          disabled={isLoading}
        >
          {isLoading ? (
            <Ionicons name="sync" size={18} color={Colors.primary} />
          ) : (
            <Ionicons
              name={isFollowed ? 'checkmark' : 'add'}
              size={20}
              color={isFollowed ? Colors.primary : '#888'}
            />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // 🎵 Render Track Card
  const renderTrack = ({ item }: { item: Track }) => {
    const isLiked = likedTrackIds.includes(item.id);
    const isPlaying = playingTrackId === item.id;

    return (
      <View style={styles.resultItem}>
        <TouchableOpacity
          style={styles.resultMain}
          onPress={() => togglePlay(item)}
        >
          <View style={styles.trackImageContainer}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.trackImage} />
            ) : (
              <View style={[styles.trackImage, styles.placeholderImage]}>
                <Ionicons name="musical-note" size={24} color="#666" />
              </View>
            )}
            {/* Play overlay */}
            {item.preview_url && (
              <View style={[styles.playOverlay, isPlaying && styles.playOverlayActive]}>
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={20}
                  color="#fff"
                />
              </View>
            )}
          </View>

          <View style={styles.resultInfo}>
            <Text style={styles.trackTitle} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.trackArtist}>{item.artist}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.likeBtn, isLiked && styles.likeBtnActive, likingTrackId === item.id && styles.likeBtnLoading]}
          onPress={() => handleLikeTrack(item)}
          disabled={likingTrackId === item.id}
        >
          {likingTrackId === item.id ? (
            <Ionicons name="sync" size={20} color={Colors.accent} />
          ) : (
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={22}
              color={isLiked ? Colors.accent : '#666'}
            />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Merhaba, {user?.username || 'Müziksever'} 👋</Text>
          <Text style={styles.subtitle}>Bugün ne dinlemek istersin?</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#888" />
            <TextInput
              style={styles.searchInput}
              placeholder="Sanatçı veya şarkı ara..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>

          {/* Toggle Buttons */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[
                styles.tab,
                searchType === 'artist' ? styles.tabActive : styles.tabInactive,
              ]}
              onPress={() => setSearchType('artist')}
            >
              <Text style={[
                styles.tabText,
                searchType === 'artist' ? styles.tabTextActive : styles.tabTextInactive,
              ]}>
                Sanatçılar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                searchType === 'track' ? styles.tabActive : styles.tabInactive,
              ]}
              onPress={() => setSearchType('track')}
            >
              <Text style={[
                styles.tabText,
                searchType === 'track' ? styles.tabTextActive : styles.tabTextInactive,
              ]}>
                Şarkılar
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Results */}
        {loading ? (
          <SkeletonList isArtist={searchType === 'artist'} />
        ) : searchType === 'artist' && artistResults.length > 0 ? (
          <FlatList
            data={artistResults}
            renderItem={renderArtist}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        ) : searchType === 'track' && trackResults.length > 0 ? (
          <FlatList
            data={trackResults}
            renderItem={renderTrack}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.centered}>
            <Ionicons name="musical-notes" size={64} color="#282828" />
            <Text style={styles.emptyText}>Aramak için yukarıdaki çubuğu kullan</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212',
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  searchSection: {
    paddingHorizontal: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 16,
    color: '#fff',
  },
  tabs: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#333',
  },
  tabText: {
    fontWeight: '600',
    fontSize: 14,
  },
  tabTextActive: {
    color: '#fff',
  },
  tabTextInactive: {
    color: '#888',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#555',
    marginTop: 16,
    textAlign: 'center',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  resultMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  artistImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  trackImageContainer: {
    position: 'relative',
  },
  trackImage: {
    width: 52,
    height: 52,
    borderRadius: 8,
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
    backgroundColor: Colors.primaryAlpha(0.8),
  },
  placeholderImage: {
    backgroundColor: '#282828',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    flex: 1,
    marginLeft: 14,
  },
  resultName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultSub: {
    color: '#888',
    fontSize: 13,
    marginTop: 3,
  },
  trackTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  trackArtist: {
    color: '#888',
    fontSize: 13,
    fontWeight: '400',
    marginTop: 3,
  },
  // Action Buttons
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#282828',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    borderWidth: 1.5,
    borderColor: '#444',
  },
  actionBtnActive: {
    backgroundColor: Colors.primaryAlpha(0.25),
    borderColor: Colors.primary,
  },
  actionBtnLoading: {
    opacity: 0.7,
  },
  likeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#282828',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    borderWidth: 1.5,
    borderColor: '#444',
  },
  likeBtnActive: {
    backgroundColor: Colors.accentAlpha(0.25),
    borderColor: Colors.accent,
  },
  likeBtnLoading: {
    opacity: 0.7,
  },
  // Skeleton
  skeletonArtistImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#333',
  },
  skeletonTrackImage: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  skeletonTitle: {
    height: 16,
    width: '70%',
    backgroundColor: '#333',
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonSubtitle: {
    height: 12,
    width: '45%',
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
  },
});
