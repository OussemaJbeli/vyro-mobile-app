import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { downloadOnWeb } from '@/services/webDownload';

import { toAppError } from '@/utils/errors';
import { logger } from '@/utils/logger';

/**
 * Writes a diagnostics JSON (redacted logs + error code, no personal values) and opens
 * the share sheet (step 07 blocking error, step 12 About).
 */
export async function exportDiagnostics(extra: { error?: unknown } = {}) {
  const payload = {
    app: 'VYRO',
    at: new Date().toISOString(),
    error: extra.error ? { code: toAppError(extra.error).code } : null,
    logs: logger.entries(),
  };
  const name = `vyro-diagnostics-${Date.now()}.json`;
  if (Platform.OS === 'web') {
    downloadOnWeb(name, JSON.stringify(payload, null, 2), 'application/json');
    return;
  }
  const file = new File(Paths.cache, name);
  file.write(JSON.stringify(payload, null, 2));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
  }
}
