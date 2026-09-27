import 'i18next';

import { type resources } from './resources';

// Typed translation keys: t('nav:home') is checked at compile time.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: (typeof resources)['en'];
    returnNull: false;
  }
}
