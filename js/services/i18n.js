/**
 * Lightweight local translation service.
 * Locale files are served by the existing /js allowlist; no CDN runtime is required.
 */

const resources = {};
const supportedLanguages = ['tr', 'en', 'ku'];

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

/**
 * Translate a key, falling back to Turkish and finally to a readable form of
 * the key itself so a missing string never renders as blank.
 * @param {string} key - dotted path, e.g. 'library.title'
 * @param {Object} [options] - values for {{placeholders}}
 * @returns {string}
 */
export function t(key, options = {}) {
    const translated = lookup(resources[currentLanguage], key) ?? lookup(resources.tr, key);
    if (translated) return interpolate(translated, options);

    const readable = key.split('.').pop().replace(/([a-z])([A-Z])/g, '$1 $2');
    return readable.charAt(0).toUpperCase() + readable.slice(1);
}

/**
 * Apply the active language to every element carrying data-lang.
 * @param {ParentNode} [root]
 */
export function applyTranslations(root = document) {
    root.querySelectorAll('[data-lang]').forEach(node => {
        node.textContent = t(node.dataset.lang, JSON.parse(node.dataset.langOptions || '{}'));
    });
    root.querySelectorAll('[data-lang-placeholder]').forEach(node => {
        node.placeholder = t(node.dataset.langPlaceholder);
    });
    root.querySelectorAll('[data-lang-aria]').forEach(node => {
        node.setAttribute('aria-label', t(node.dataset.langAria));
    });
    root.querySelectorAll('[data-lang-title]').forEach(node => {
        node.title = t(node.dataset.langTitle);
    });
}

export async function changeLanguage(language) {
    if (!supportedLanguages.includes(language) || language === currentLanguage) return;
    await i18nReady;
    currentLanguage = language;
    localStorage.setItem('lang', language);
    document.documentElement.lang = language;
    document.dispatchEvent(new CustomEvent('languagechange', { detail: { language } }));
}

export { supportedLanguages };

export function getCurrentLanguage() {
    return currentLanguage;
}

// Reflect the stored language on <html> before anything renders.
document.documentElement.lang = currentLanguage;

export default { t, changeLanguage, applyTranslations, get language() { return currentLanguage; } };

// Explicit translation descriptors let DOM helpers bind text without rebuilding
// stateful views (MIDI devices, recording buffers, drafts and audio players).
export function liveText(key, options = {}) {
    return { translationKey: key, options, toString: () => t(key, options) };
}

export function setText(node, value) {
    if (value?.translationKey) {
        node.dataset.lang = value.translationKey;
        node.dataset.langOptions = JSON.stringify(value.options || {});
    } else {
        delete node.dataset.lang;
        delete node.dataset.langOptions;
    }
    node.textContent = String(value ?? '');
}
