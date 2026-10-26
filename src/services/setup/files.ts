import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { downloadOnWeb } from '@/services/webDownload';

/** Hands the setup JSON to the share sheet (phone) or a download (web preview). */
export async function shareSetupFile(json: string, day: string): Promise<void> {
  const name = `vyro-setup-${day}.json`;
  if (Platform.OS === 'web') {
    downloadOnWeb(name, json, 'application/json');
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.write(json);
  try {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
  } finally {
    if (file.exists) file.delete();
  }
}

/** Reads a picked JSON file as text. */
export async function readSetupFile(uri: string): Promise<string> {
  return Platform.OS === 'web' ? (await fetch(uri)).text() : new File(uri).text();
}
