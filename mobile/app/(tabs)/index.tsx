import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';
import { Artist, Track } from '../../types';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'artist' | 'track'>('artist');
  const [artistResults, setArtistResults] = useState<Artist[]>([]);
  const [trackResults, setTrackResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

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
    } finally {
      setLoading(false);
    }
  };

  const renderArtist = ({ item }: { item: Artist }) => (
    <TouchableOpacity style={styles.resultItem}>
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
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  const renderTrack = ({ item }: { item: Track }) => (
    <TouchableOpacity style={styles.resultItem}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.trackImage} />
      ) : (
        <View style={[styles.trackImage, styles.placeholderImage]}>
          <Ionicons name="musical-note" size={24} color="#666" />
        </View>
      )}
      <View style={styles.resultInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.trackArtist}>{item.artist}</Text>
      </View>
      {item.preview_url && (
        <Ionicons name="play-circle" size={28} color="#1DB954" />
      )}
    </TouchableOpacity>
  );

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

          {/* Toggle Buttons - Active: Solid Green, Inactive: Ghost */}
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
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#1DB954" />
          </View>
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
  // Active: Solid green background
  tabActive: {
    backgroundColor: '#1DB954',
  },
  // Inactive: Ghost style (transparent + border)
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
  artistImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  trackImage: {
    width: 52,
    height: 52,
    borderRadius: 8,
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
  // Track typography hierarchy
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
});
