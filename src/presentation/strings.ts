import { en } from './i18n/en';
import { tr, type Strings } from './i18n/tr';

export type Language = 'tr' | 'en';
export type LanguageSetting = Language | 'auto';

const TABLES: Readonly<Record<Language, Strings>> = { tr, en };

/**
 * The active string table. Modules import this binding and always see the
 * current language (ES module live binding), so switching needs no plumbing.
 */
export let T: Strings = tr;
export let language: Language = 'tr';

/** `auto` follows the device: Turkish devices get Turkish, everyone else English. */
export const resolveLanguage = (setting: LanguageSetting, deviceLanguages: readonly string[]): Language =>
  setting !== 'auto' ? setting : deviceLanguages.some((l) => l.toLowerCase().startsWith('tr')) ? 'tr' : 'en';

export const setLanguage = (next: Language): void => {
  language = next;
  T = TABLES[next];
  // Lets CSS uppercase Turkish letters correctly (i → İ).
  document.documentElement.lang = next;
};
