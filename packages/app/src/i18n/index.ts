import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Platform } from 'react-native';
import { getLocales } from 'expo-localization';
import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import it from './locales/it.json';

export const SUPPORTED_LANGUAGES = ['de', 'fr', 'it', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = 'app_language';

// SecureStore isn't available on web — fall back to localStorage there.
const store =
  Platform.OS === 'web'
    ? {
        getItemAsync: async (k: string) =>
          typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null,
        setItemAsync: async (k: string, v: string) => {
          if (typeof localStorage !== 'undefined') localStorage.setItem(k, v);
        },
      }
    : require('expo-secure-store');

function deviceLanguage(): AppLanguage {
  try {
    const code = getLocales()?.[0]?.languageCode?.toLowerCase();
    if (code && (SUPPORTED_LANGUAGES as readonly string[]).includes(code)) {
      return code as AppLanguage;
    }
  } catch {
    // ignore — fall through to default
  }
  return 'de'; // Swiss market default when the device locale isn't one we support
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
    fr: { translation: fr },
    it: { translation: it },
  },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Apply a previously saved preference (async) once it resolves.
store
  .getItemAsync(STORAGE_KEY)
  .then((saved: string | null) => {
    if (saved && (SUPPORTED_LANGUAGES as readonly string[]).includes(saved)) {
      i18n.changeLanguage(saved);
    }
  })
  .catch(() => {});

/** Change the app language and persist the choice across restarts. */
export async function setAppLanguage(lang: AppLanguage) {
  await i18n.changeLanguage(lang);
  try {
    await store.setItemAsync(STORAGE_KEY, lang);
  } catch {
    // non-fatal — language still applied for this session
  }
}

export default i18n;
