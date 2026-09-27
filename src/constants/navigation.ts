import { router, type Href } from 'expo-router';

import { routes } from './routes';

/**
 * Back that also works when a screen was opened directly (deep link, notification):
 * with no history it replaces the screen with a sensible parent instead.
 */
export function goBack(fallback: Href = routes.home) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
