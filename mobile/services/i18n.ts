import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from '../locales/en.json';
import tr from '../locales/tr.json';

i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            tr: { translation: tr },
        },
        lng: Localization.getLocales()[0]?.languageCode || 'tr',
        fallbackLng: 'tr',
        interpolation: {
            escapeValue: false, // React already escapes values
        },
        compatibilityJSON: 'v3', // For React Native compatibility
    });

export default i18n;

