import React from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';

export default function LibraryScreen() {
    const { userData } = useAuthStore();

    const renderLikedTrack = ({ item }: { item: any }) => (
        <TouchableOpacity style={styles.trackItem}>
            {item.image ? (
                <Image source={{ uri: item.image }} style={styles.trackImage} />
            ) : (
                <View style={[styles.trackImage, styles.placeholder]}>
                    <Ionicons name="musical-note" size={20} color="#666" />
                </View>
            )}
            <View style={styles.trackInfo}>
                <Text style={styles.trackName} numberOfLines={1}>{item.trackName}</Text>
                <Text style={styles.trackArtist} numberOfLines={1}>{item.artistName || 'Unknown Artist'}</Text>
            </View>
            <Ionicons name="heart" size={20} color="#1DB954" />
        </TouchableOpacity>
    );

    const renderFollowedArtist = ({ item }: { item: any }) => (
        <TouchableOpacity style={styles.artistItem}>
            {item.image ? (
                <Image source={{ uri: item.image }} style={styles.artistImage} />
            ) : (
                <View style={[styles.artistImage, styles.placeholder]}>
                    <Ionicons name="person" size={24} color="rgba(102, 102, 102, 1)" />
                </View>
            )}
            <Text style={styles.artistName} numberOfLines={1}>{item.artistName}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.container}>
                {/* Followed Artists - Horizontal */}
                {userData?.follows && userData.follows.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Takip Ettiklerim</Text>
                        <FlatList
                            data={userData.follows}
                            renderItem={renderFollowedArtist}
                            keyExtractor={(item) => item.artistId}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.artistList}
                        />
                    </View>
                )}

                {/* Liked Songs - Vertical */}
                <View style={styles.likesSection}>
                    <Text style={styles.sectionTitle}>Beğendiklerim</Text>
                    {userData?.likes && userData.likes.length > 0 ? (
                        <FlatList
                            data={userData.likes}
                            renderItem={renderLikedTrack}
                            keyExtractor={(item) => item.trackId}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.trackList}
                        />
                    ) : (
                        <View style={styles.empty}>
                            <Ionicons name="heart-outline" size={48} color="#282828" />
                            <Text style={styles.emptyText}>Henüz beğenilen şarkı yok</Text>
                            <Text style={styles.emptyHint}>Ana sayfadan şarkı ara ve beğen!</Text>
                        </View>
                    )}
                </View>
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
    section: {
        paddingTop: 8,
        marginBottom: 20,
    },
    likesSection: {
        flex: 1,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        paddingHorizontal: 16,
        marginBottom: 14,
    },
    artistList: {
        paddingHorizontal: 16,
    },
    artistItem: {
        alignItems: 'center',
        marginRight: 18,
        width: 80,
    },
    artistImage: {
        width: 68,
        height: 68,
        borderRadius: 34,
    },
    artistName: {
        color: '#fff',
        fontSize: 12,
        marginTop: 8,
        textAlign: 'center',
    },
    trackList: {
        paddingBottom: 32,
    },
    trackItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e1e1e',
        padding: 14,
        borderRadius: 12,
        marginBottom: 12, // Increased spacing
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
    // Typography hierarchy: Song bold/white, Artist regular/gray
    trackName: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    trackArtist: {
        color: '#888',
        fontSize: 13,
        fontWeight: '400',
        marginTop: 3,
    },
    placeholder: {
        backgroundColor: '#282828',
        alignItems: 'center',
        justifyContent: 'center',
    },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 48,
    },
    emptyText: {
        color: '#555',
        fontSize: 16,
        marginTop: 16,
    },
    emptyHint: {
        color: '#444',
        fontSize: 13,
        marginTop: 6,
    },
});
