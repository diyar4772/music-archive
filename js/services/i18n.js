/**
 * Lightweight local translation service.
 * Locale files are served by the existing /js allowlist; no CDN runtime is required.
 */

const resources = {};
const supportedLanguages = ['tr', 'en', 'ku'];
const fallbackText = {
    'auth.login': 'Giriş Yap',
    'auth.register': 'Kayıt Ol',
    'common.loading': 'Yükleniyor...',
    'common.error': 'Bir hata oluştu',
    'common.retry': 'Tekrar Dene',
    'library.title': 'Kütüphanen',
    'library.likedSongs': 'Beğenilen Şarkılar',
    'library.following': 'Takip Edilenler',
    'library.playlists': 'Listelerim',
    'library.createPlaylist': 'Liste Oluştur',
    'search.placeholder': 'Sanatçı veya şarkı ara...'
};

let currentLanguage = supportedLanguages.includes(localStorage.getItem('lang'))
    ? localStorage.getItem('lang')
    : 'tr';

const lookup = (source, key) => key.split('.').reduce((value, part) => value?.[part], source);
const interpolate = (text, options) => String(text).replace(/{{(\w+)}}/g, (_, key) => options[key] ?? '');

async function loadTranslations() {
    const results = await Promise.allSettled(supportedLanguages.map(async language => {
        const response = await fetch(`/js/locales/${language}.json`);
        if (!response.ok) throw new Error(`Locale ${language} returned HTTP ${response.status}`);
        resources[language] = await response.json();
    }));

    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.warn(`Translation locale unavailable: ${supportedLanguages[index]}`, result.reason);
        }
    });
}

export const i18nReady = loadTranslations();

export function t(key, options = {}) {
    const translated = lookup(resources[currentLanguage], key)
        ?? lookup(resources.tr, key)
        ?? fallbackText[key];
    if (translated) return interpolate(translated, options);

    const readable = key.split('.').pop().replace(/([a-z])([A-Z])/g, '$1 $2');
    return readable.charAt(0).toUpperCase() + readable.slice(1);
}

export async function changeLanguage(language) {
    if (!supportedLanguages.includes(language)) return;
    await i18nReady;
    currentLanguage = language;
    localStorage.setItem('lang', language);
    document.dispatchEvent(new CustomEvent('languagechange', { detail: { language } }));
}

export function getCurrentLanguage() {
    return currentLanguage;
}

export default { t, changeLanguage, get language() { return currentLanguage; } };
