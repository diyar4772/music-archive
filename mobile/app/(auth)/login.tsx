import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
    StyleSheet,
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../stores/authStore';

export default function LoginScreen() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const login = useAuthStore((state) => state.login);

    const handleLogin = async () => {
        if (!username.trim() || !password.trim()) {
            Alert.alert('Hata', 'Kullanıcı adı ve şifre gerekli');
            return;
        }

        setLoading(true);
        try {
            await login(username.trim(), password);
        } catch (error: any) {
            const message = error.response?.data?.error || 'Giriş başarısız';
            Alert.alert('Hata', message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Gradient Background */}
            <LinearGradient
                colors={['#1a1a2e', '#16213e', '#0f3460']}
                style={StyleSheet.absoluteFill}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    {/* Logo & Title */}
                    <View style={styles.header}>
                        <View style={styles.logoContainer}>
                            <LinearGradient
                                colors={['#e94560', '#0f3460']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.logoGradient}
                            >
                                <Ionicons name="musical-notes" size={40} color="#fff" />
                            </LinearGradient>
                        </View>
                        <Text style={styles.title}>Music Archive</Text>
                        <Text style={styles.subtitle}>Müzik koleksiyonun</Text>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        {/* Username Input */}
                        <View style={styles.inputContainer}>
                            <Ionicons name="person-outline" size={20} color="#e94560" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Kullanıcı adı"
                                placeholderTextColor="#6b7280"
                                value={username}
                                onChangeText={setUsername}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        {/* Password Input */}
                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={20} color="#e94560" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Şifre"
                                placeholderTextColor="#6b7280"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                                <Ionicons
                                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                    size={20}
                                    color="#6b7280"
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Login Button */}
                        <TouchableOpacity
                            onPress={handleLogin}
                            disabled={loading}
                            style={styles.buttonWrapper}
                        >
                            <LinearGradient
                                colors={loading ? ['#6b7280', '#4b5563'] : ['#e94560', '#c73659']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.button}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.buttonText}>Giriş Yap</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    {/* Register Link */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Hesabın yok mu? </Text>
                        <Link href="/(auth)/register" asChild>
                            <TouchableOpacity>
                                <Text style={styles.linkText}>Kayıt Ol</Text>
                            </TouchableOpacity>
                        </Link>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    logoContainer: {
        marginBottom: 16,
    },
    logoGradient: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#e94560',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#9ca3af',
    },
    form: {
        width: '100%',
        maxWidth: 320,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        paddingHorizontal: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(233, 69, 96, 0.2)',
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        paddingVertical: 16,
        fontSize: 16,
        color: '#ffffff',
    },
    eyeIcon: {
        padding: 4,
    },
    buttonWrapper: {
        marginTop: 8,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#e94560',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    button: {
        paddingVertical: 16,
        alignItems: 'center',
        borderRadius: 16,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        marginTop: 32,
    },
    footerText: {
        color: '#9ca3af',
        fontSize: 14,
    },
    linkText: {
        color: '#e94560',
        fontSize: 14,
        fontWeight: '600',
    },
});
