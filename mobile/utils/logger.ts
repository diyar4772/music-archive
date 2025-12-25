/**
 * Production-ready logging utility
 * - Only logs in development mode
 * - Supports different log levels
 * - Can be extended for remote logging in production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    message: string;
    data?: any;
    timestamp: number;
    location?: string;
}

class Logger {
    private isDevelopment: boolean;

    constructor() {
        this.isDevelopment = __DEV__ || process.env.NODE_ENV !== 'production';
    }

    private formatMessage(level: LogLevel, message: string, data?: any, location?: string): string {
        const prefix = `[${level.toUpperCase()}]`;
        const locationStr = location ? `[${location}]` : '';
        const dataStr = data ? ` ${JSON.stringify(data)}` : '';
        return `${prefix}${locationStr} ${message}${dataStr}`;
    }

    private log(level: LogLevel, message: string, data?: any, location?: string): void {
        if (!this.isDevelopment && level === 'debug') {
            return; // Skip debug logs in production
        }

        const formatted = this.formatMessage(level, message, data, location);
        
        switch (level) {
            case 'debug':
                console.log(formatted);
                break;
            case 'info':
                console.info(formatted);
                break;
            case 'warn':
                console.warn(formatted);
                break;
            case 'error':
                console.error(formatted);
                // In production, you could send errors to a logging service
                if (!this.isDevelopment) {
                    // TODO: Send to remote logging service (e.g., Sentry, LogRocket)
                }
                break;
        }
    }

    debug(message: string, data?: any, location?: string): void {
        this.log('debug', message, data, location);
    }

    info(message: string, data?: any, location?: string): void {
        this.log('info', message, data, location);
    }

    warn(message: string, data?: any, location?: string): void {
        this.log('warn', message, data, location);
    }

    error(message: string, error?: any, location?: string): void {
        const errorData = error instanceof Error 
            ? { message: error.message, stack: error.stack, ...error }
            : error;
        this.log('error', message, errorData, location);
    }
}

export const logger = new Logger();
export default logger;

