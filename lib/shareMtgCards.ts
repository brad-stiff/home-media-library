import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

import { mtgCardsToCsv } from './mtgCardCsv';
import { getAllMtgCards } from './mtgCards';

const FILENAME = 'mtg-cards.csv';

function downloadCsv(contents: string): void {
  if (typeof document === 'undefined') {
    throw new Error('Sharing is not available on this device.');
  }
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = FILENAME;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Writes the collection CSV and opens the share sheet.
 * On iOS, true means the user completed a share. Dismiss returns false.
 * On Android the sheet cannot report dismiss, so this returns false.
 * On web the file downloads and this returns true.
 */
export async function shareMtgCardsCsv(): Promise<boolean> {
  const csv = mtgCardsToCsv(await getAllMtgCards());

  if (Platform.OS === 'web') {
    downloadCsv(csv);
    return true;
  }

  const file = new File(Paths.cache, FILENAME);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);

  if (Platform.OS === 'ios') {
    const result = await Share.share({
      url: file.uri,
      title: 'MTG cards',
    });
    return result.action === Share.sharedAction;
  }

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Save card list',
    UTI: 'public.comma-separated-values-text',
  });
  return false;
}
