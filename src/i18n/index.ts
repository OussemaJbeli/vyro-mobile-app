import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { languages, namespaces, resources, type Language } from './resources';

export type LanguagePreference = 'system' | Language;

/** Device language if supported, otherwise English. */
export function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return (languages as string[]).includes(code) ? (code as Language) : 'en';
}

export const resolveLanguage = (pref: LanguagePreference): Language =>
  pref === 'system' ? deviceLanguage() : pref;

/** App-owned i18next instance (not the global default), passed to I18nextProvider. */
const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage(),
  fallbackLng: 'en',
  ns: namespaces,
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Applies instantly, no restart (UI §36). Step 12 persists the preference. */
export function setLanguage(pref: LanguagePreference) {
  return i18n.changeLanguage(resolveLanguage(pref));
}

/** Current language for Intl formatting (dates, numbers). */
export const currentLanguage = (): Language => (i18n.language as Language) ?? 'en';

export { i18n };
export { languages, type Language } from './resources';
