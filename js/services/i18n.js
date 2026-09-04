/**
 * i18next configuration for web frontend
 * Replaces the manual translation system in index.html
 * 
 * Note: Using CDN via importmap for i18next
 */

let i18n;
let LanguageDetector;

// Dynamic import for i18next (works with importmap)
async function loadI18n() {
    try {
        const i18nextModule = await import('i18next');
        const detectorModule = await import('i18next-browser-languagedetector');
        i18n = i18nextModule.default || i18nextModule;
        LanguageDetector = detectorModule.default || detectorModule;
        return true;
    } catch (error) {
        console.error('Failed to load i18next:', error);
        // Create a simple fallback
        i18n = {
            isInitialized: false,
            t: (key) => key,
            language: 'tr',
            changeLanguage: () => Promise.resolve(),
            on: () => {}
        };
        return false;
    }
}

// Import translation resources (using fetch for JSON in ES modules)
let en, tr, ku;

// Load translations asynchronously
async function loadTranslations() {
    try {
        // First load i18next
        const i18nLoaded = await loadI18n();
        if (!i18nLoaded) {
            console.warn('i18next not available, using fallback');
            return;
        }

        // Then load translation files
        const [enRes, trRes, kuRes] = await Promise.all([
            fetch('./js/locales/en.json').then(r => r.json()),
            fetch('./js/locales/tr.json').then(r => r.json()),
            fetch('./js/locales/ku.json').then(r => r.json())
        ]);
        en = enRes;
        tr = trRes;
        ku = kuRes;
        initI18n();
    } catch (error) {
        console.error('Failed to load translations:', error);
        // Fallback to empty translations
        en = tr = ku = {};
        if (i18n && i18n.init) {
            initI18n();
        }
    }
}

function initI18n() {
    if (!i18n || !i18n.use || !i18n.init) {
        console.warn('i18next not available, using fallback translation system');
        return;
    }

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
}

// Start loading translations
loadTranslations();

// Export helper function for use in vanilla JS
export function t(key, options = {}) {
    // Wait for i18n to be initialized
    if (!i18n || !i18n.isInitialized) {
        // Return key as fallback
        return key;
    }
    try {
        return i18n.t(key, options);
    } catch (error) {
        console.warn('Translation error for key:', key, error);
        return key;
    }
}

// Export changeLanguage function
export function changeLanguage(lng) {
    if (!i18n || !i18n.changeLanguage) {
        console.warn('i18next not available');
        return Promise.resolve();
    }
    return i18n.changeLanguage(lng);
}

// Export current language getter
export function getCurrentLanguage() {
    if (!i18n) return 'tr';
    return i18n.language || 'tr';
}

// Export i18n instance (may be undefined until loaded)
export default i18n;
