import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui';
import { PioneerBadge, TierType } from '../../components/pioneer';
import { Colors } from '../../constants/theme';
import { pioneerService } from '../../services/pioneer';

export default function ProfileScreen() {
    const { user, userData, logout, refreshUserData } = useAuthStore();
    const [refreshing, setRefreshing] = useState(false);
    const [pioneerData, setPioneerData] = useState<{
        playlistCount: number;
        tier: TierType;
        isPremium: boolean;
        premiumUntil: Date | null;
    }>({
        playlistCount: 0,
        tier: 'none',
        isPremium: false,
        premiumUntil: null,
    });
    const [showConfetti, setShowConfetti] = useState(false);

    // Fetch pioneer status
    const fetchPioneerStatus = useCallback(async () => {
        try {
            const status = await pioneerService.getStatus();
            
            // Determine tier based on playlist count
            let tier: TierType = 'none';
            if (status.playlistCount >= 50) tier = 'gold';
            else if (status.playlistCount >= 25) tier = 'silver';
            else if (status.playlistCount >= 10) tier = 'bronze';

            setPioneerData({
                playlistCount: status.playlistCount || 0,
                tier,
                isPremium: status.isPioneer || false,
                premiumUntil: status.premiumUntil ? new Date(status.premiumUntil) : null,
            });
        } catch (error) {
            // Fallback to local playlist count if API fails
            console.log('Pioneer status fetch failed, using local data');
        }
    }, []);

    useEffect(() => {
        fetchPioneerStatus();
    }, [fetchPioneerStatus]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await Promise.all([
                refreshUserData(),
                fetchPioneerStatus(),
            ]);
        } finally {
            setRefreshing(false);
        }
    }, [refreshUserData, fetchPioneerStatus]);

    const handleLogout = () => {
        Alert.alert(
            'Çıkış Yap',
            'Hesabından çıkış yapmak istediğine emin misin?',
            [
                { text: 'İptal', style: 'cancel' },
                { text: 'Çıkış Yap', style: 'destructive', onPress: logout },
            ]
        );
    };

    const handleConfettiEnd = useCallback(() => {
        setShowConfetti(false);
    }, []);

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <ScrollView 
                style={styles.container} 
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={Colors.primary}
                        colors={[Colors.primary]}
                    />
                }
            >
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {user?.username?.charAt(0).toUpperCase() || 'U'}
                        </Text>
                    </View>
                    <Text style={styles.username}>{user?.username}</Text>
                    
                    {/* Pioneer inline badge */}
                    {pioneerData.tier !== 'none' && (
                        <View style={styles.tierBadge}>
                            <Ionicons 
                                name="star" 
                                size={12} 
                                color={
                                    pioneerData.tier === 'gold' ? '#FFD700' :
                                    pioneerData.tier === 'silver' ? '#C0C0C0' :
                                    '#CD7F32'
                                } 
                            />
                            <Text style={styles.tierBadgeText}>
                                {pioneerData.tier === 'gold' ? 'Gold' :
                                 pioneerData.tier === 'silver' ? 'Silver' : 'Bronze'} Pioneer
                            </Text>
                        </View>
                    )}
                </View>

                {/* Stats Card */}
                <Card style={styles.statsCard}>
                    <View style={styles.stats}>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{userData?.likes?.length || 0}</Text>
                            <Text style={styles.statLabel}>Beğeni</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{userData?.follows?.length || 0}</Text>
                            <Text style={styles.statLabel}>Takip</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{userData?.albumFollows?.length || 0}</Text>
                            <Text style={styles.statLabel}>Albüm</Text>
                        </View>
                    </View>
                </Card>

                {/* Pioneer Progress Section */}
                <View style={styles.sectionHeader}>
                    <Ionicons name="trophy" size={18} color={Colors.primary} />
                    <Text style={styles.sectionTitle}>Pioneer Sistemi</Text>
                </View>
                
                <PioneerBadge
                    playlistCount={pioneerData.playlistCount}
                    tier={pioneerData.tier}
                    isPremium={pioneerData.isPremium}
                    premiumUntil={pioneerData.premiumUntil}
                    showConfetti={showConfetti}
                    onConfettiEnd={handleConfettiEnd}
                />

                {/* Pioneer Info */}
                <View style={styles.pioneerInfoCard}>
                    <Text style={styles.pioneerInfoTitle}>🏆 Pioneer Nasıl Olunur?</Text>
                    <Text style={styles.pioneerInfoText}>
                        Playlist oluşturarak Pioneer seviyelerine ulaşabilirsin:
                    </Text>
                    <View style={styles.tierList}>
                        <View style={styles.tierListItem}>
                            <View style={[styles.tierDot, { backgroundColor: '#CD7F32' }]} />
                            <Text style={styles.tierListText}>10 Playlist → Bronze Pioneer</Text>
                        </View>
                        <View style={styles.tierListItem}>
                            <View style={[styles.tierDot, { backgroundColor: '#C0C0C0' }]} />
                            <Text style={styles.tierListText}>25 Playlist → Silver Pioneer</Text>
                        </View>
                        <View style={styles.tierListItem}>
                            <View style={[styles.tierDot, { backgroundColor: '#FFD700' }]} />
                            <Text style={styles.tierListText}>50 Playlist → Gold Pioneer + Premium</Text>
                        </View>
                    </View>
                </View>

                {/* Menu */}
                <View style={styles.menu}>
                    <TouchableOpacity style={styles.menuItem}>
                        <View style={styles.menuIcon}>
                            <Ionicons name="settings-outline" size={22} color="#888" />
                        </View>
                        <Text style={styles.menuText}>Ayarlar</Text>
                        <Ionicons name="chevron-forward" size={20} color="#555" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem}>
                        <View style={styles.menuIcon}>
                            <Ionicons name="information-circle-outline" size={22} color="#888" />
                        </View>
                        <Text style={styles.menuText}>Hakkında</Text>
                        <Ionicons name="chevron-forward" size={20} color="#555" />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout}>
                        <View style={[styles.menuIcon, styles.logoutIcon]}>
                            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
                        </View>
                        <Text style={styles.logoutText}>Çıkış Yap</Text>
                    </TouchableOpacity>
                </View>

                {/* Version */}
                <Text style={styles.version}>Music Archive v1.0.0</Text>
            </ScrollView>
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
    avatarContainer: {
        alignItems: 'center',
        paddingVertical: 28,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    avatarText: {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#fff',
    },
    username: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    tierBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        paddingVertical: 4,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
    },
    tierBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
    statsCard: {
        marginHorizontal: 16,
        padding: 0,
    },
    stats: {
        flexDirection: 'row',
        paddingVertical: 22,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 26,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    statLabel: {
        fontSize: 13,
        color: '#888',
        marginTop: 4,
    },
    divider: {
        width: 1,
        backgroundColor: '#333',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 16,
        marginTop: 28,
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    pioneerInfoCard: {
        marginHorizontal: 16,
        marginTop: 8,
        padding: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    pioneerInfoTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
    },
    pioneerInfoText: {
        fontSize: 12,
        color: Colors.textMuted,
        marginBottom: 12,
    },
    tierList: {
        gap: 8,
    },
    tierListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    tierDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    tierListText: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    menu: {
        marginTop: 28,
        marginHorizontal: 16,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e1e1e',
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
    },
    menuIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#282828',
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuText: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        marginLeft: 14,
    },
    logoutItem: {
        marginTop: 20,
    },
    logoutIcon: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
    },
    logoutText: {
        flex: 1,
        color: '#EF4444',
        fontSize: 16,
        marginLeft: 14,
    },
    version: {
        textAlign: 'center',
        color: '#444',
        fontSize: 12,
        marginTop: 32,
        marginBottom: 24,
    },
});
