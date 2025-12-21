import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SwipeDeck from '../../components/dig/SwipeDeck';
import { useDigStore } from '../../stores/digStore';

export default function DigScreen() {
    const { queue, currentIndex, isLoading, loadQueue, swipe } = useDigStore();

    useEffect(() => {
        loadQueue();
    }, []);

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Dig Mode</Text>
                    {queue.length > 0 && (
                        <Text style={styles.counter}>
                            {currentIndex + 1} / {queue.length}
                        </Text>
                    )}
                </View>

                {/* Swipe Deck */}
                <SwipeDeck
                    tracks={queue}
                    currentIndex={currentIndex}
                    onSwipe={swipe}
                    onRefresh={loadQueue}
                    isLoading={isLoading}
                />
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    counter: {
        fontSize: 14,
        color: '#888',
        backgroundColor: '#1e1e1e',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
});
