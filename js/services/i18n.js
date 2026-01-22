/**
 * i18next configuration for web frontend
 * Replaces the manual translation system in index.html
 */

import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation resources
import en from '../locales/en.json';
import tr from '../locales/tr.json';
import ku from '../locales/ku.json';

i18n
    .use(LanguageDetector)
    .init({
        resources: {
            en: { translation: en },
            tr: { translation: tr },
            ku: { translation: ku },
        },
        fallbackLng: 'tr',
        interpolation: {
            escapeValue: false, // React escapes by default, but we're using vanilla JS
        },
        detection: {
            // Check localStorage first, then browser language
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: 'lang',
            caches: ['localStorage'],
        },
    });

// Export helper function for use in vanilla JS
export function t(key, options = {}) {
    return i18n.t(key, options);
}

// Export changeLanguage function
export function changeLanguage(lng) {
    return i18n.changeLanguage(lng);
}

// Export current language getter
export function getCurrentLanguage() {
    return i18n.language;
}

export default i18n;

