// Utility Functions

/**
 * Debounce function - delays execution until after wait ms have elapsed
 * @param {Function} fn - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
export function debounce(fn, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), wait);
    };
}

/**
 * Format milliseconds to mm:ss format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted time string
 */
export function formatTime(ms) {
    if (!ms) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format date to localized string
 * @param {string|Date} date - Date to format
 * @param {string} lang - Language code ('tr' or 'en')
 * @returns {string} Formatted date string
 */
export function formatDate(date, lang = 'tr') {
    const d = new Date(date);
    return d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Show toast notification
 * @param {string} msg - Message to display
 * @param {number} duration - Duration in ms
 */
export function showToast(msg, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.innerText = msg;
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'opacity-0');
    }, duration);
}

/**
 * Get placeholder image URL
 * @param {number} size - Image size
 * @returns {string} Placeholder URL
 */
export function getPlaceholderImage(size = 300) {
    return `https://via.placeholder.com/${size}`;
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 50) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

