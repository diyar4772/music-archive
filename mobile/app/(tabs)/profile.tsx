import React from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui';
import { Colors } from '../../constants/theme';

export default function ProfileScreen() {
    const { user, userData, logout } = useAuthStore();

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

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {user?.username?.charAt(0).toUpperCase() || 'U'}
                        </Text>
                    </View>
                    <Text style={styles.username}>{user?.username}</Text>
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
