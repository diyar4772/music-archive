/**
 * Toast Notification Component
 * Displays temporary notification messages
 */
import { Component } from '../core/Component.js';

export class Toast extends Component {
    constructor(container, props = {}) {
        super(container || document.body, props);
        this.toasts = [];
        this.defaultDuration = props.duration || 3000;
    }

    /**
     * Show a toast message
     */
    show(message, type = 'info', duration = this.defaultDuration) {
        const toast = {
            id: Date.now(),
            message,
            type,
            duration
        };

        this.toasts.push(toast);
        this.render();

        // Auto-remove after duration
        setTimeout(() => {
            this.remove(toast.id);
        }, duration);

        return toast.id;
    }

    /**
     * Remove a toast by ID
     */
    remove(toastId) {
        this.toasts = this.toasts.filter(t => t.id !== toastId);
        this.render();
    }

    /**
     * Clear all toasts
     */
    clear() {
        this.toasts = [];
        this.render();
    }

    render() {
        if (!this.container) {
            // Create container if it doesn't exist
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-2';
            document.body.appendChild(this.container);
        }

        this.clear();

        this.toasts.forEach(toast => {
            const toastElement = this.createElement('div', {
                className: `toast toast-${toast.type} bg-white dark:bg-card-dark text-text-light dark:text-white px-4 py-3 rounded-lg shadow-lg border border-gray-200 dark:border-white/5 flex items-center gap-3 min-w-[300px] max-w-md animate-fade-in`,
                'data-toast-id': toast.id
            }, [
                this.createElement('span', {}, toast.message),
                this.createElement('button', {
                    className: 'ml-auto text-gray-400 hover:text-text-light dark:hover:text-white',
                    onclick: () => this.remove(toast.id)
                }, [
                    this.createElement('i', { className: 'fa-solid fa-times' })
                ])
            ]);

            this.appendChild(toastElement);
        });
    }

    // Convenience methods
    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }
}

// Global toast instance
let globalToast = null;

/**
 * Initialize global toast
 */
export function initToast(container) {
    globalToast = new Toast(container);
    return globalToast;
}

/**
 * Show toast globally
 */
export function showToast(message, type = 'info', duration = 3000) {
    if (!globalToast) {
        globalToast = initToast();
    }
    return globalToast.show(message, type, duration);
}

// Export for global access
window.showToast = showToast;
