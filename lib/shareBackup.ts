import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

import { buildLibraryBackup } from './libraryBackup';

/**
 * Writes the backup and opens the share sheet.
 * On iOS, true means the user completed a share. Dismiss returns false.
 * On Android the sheet cannot report dismiss, so this returns false and the
 * caller asks before dissolving.
 */
export async function shareLibraryBackup(): Promise<boolean> {
  const backup = await buildLibraryBackup();
  const file = new File(Paths.cache, 'library-backup.json');
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(backup, null, 2));

  if (Platform.OS === 'ios') {
    const result = await Share.share({
      url: file.uri,
      title: 'Library backup',
    });
    return result.action === Share.sharedAction;
  }

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Save library backup',
    UTI: 'public.json',
  });
  return false;
}
