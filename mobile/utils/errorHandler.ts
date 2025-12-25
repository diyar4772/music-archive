/**
 * Centralized error handling utilities
 * Provides consistent error handling patterns across the app
 */

import { AxiosError } from 'axios';
import { Alert } from 'react-native';
import logger from './logger';

export interface ApiError {
    message: string;
    statusCode?: number;
    code?: string;
}

/**
 * Extract user-friendly error message from API error
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        // Check if it's an Axios error
        if ('isAxiosError' in error && (error as AxiosError).response) {
            const axiosError = error as AxiosError;
            const status = axiosError.response?.status;
            const errorData = axiosError.response?.data;

            // Try to get error message from response
            if (errorData && typeof errorData === 'object') {
                if ('error' in errorData && typeof errorData.error === 'string') {
                    return errorData.error;
                }
                if ('message' in errorData && typeof errorData.message === 'string') {
                    return errorData.message;
                }
            }

            // Map status codes to user-friendly messages
            switch (status) {
                case 400:
                    return 'Geçersiz istek. Lütfen tekrar deneyin.';
                case 401:
                    return 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.';
                case 403:
                    return 'Bu işlem için yetkiniz yok.';
                case 404:
                    return 'İstenen kaynak bulunamadı.';
                case 429:
                    return 'Çok fazla istek gönderildi. Lütfen bir süre bekleyin.';
                case 500:
                    return 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
                case 503:
                    return 'Servis şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.';
                default:
                    return 'Bir hata oluştu. Lütfen tekrar deneyin.';
            }
        }

        // Network errors
        if (error.message.includes('Network') || error.message.includes('network')) {
            return 'Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin.';
        }

        if (error.message.includes('timeout')) {
            return 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.';
        }

        // Return the error message if it's user-friendly
        return error.message;
    }

    // Fallback for unknown error types
    if (typeof error === 'string') {
        return error;
    }

    return 'Beklenmeyen bir hata oluştu.';
}

/**
 * Handle API error with logging and optional user alert
 */
export function handleApiError(
    error: unknown,
    context: string,
    showAlert: boolean = true,
    customMessage?: string
): void {
    const message = customMessage || getErrorMessage(error);
    
    // Log error with context
    logger.error(`API Error in ${context}`, error, context);

    // Show alert if requested
    if (showAlert) {
        Alert.alert('Hata', message);
    }
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
    if (error instanceof Error) {
        return error.message.includes('Network') || 
               error.message.includes('network') ||
               error.message.includes('timeout') ||
               error.message.includes('ECONNREFUSED');
    }
    return false;
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
    if ('isAxiosError' in error && (error as AxiosError).response) {
        return (error as AxiosError).response?.status === 401;
    }
    return false;
}

