import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export async function sharePDF(base64DataUri: string, fileName: string): Promise<boolean> {
  try {
    // Extract pure base64 from data URI
    const base64 = base64DataUri.split(',')[1];

    if (Capacitor.isNativePlatform()) {
      // Native: write to cache, then share
      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      });
      await Share.share({
        title: 'Spielbericht',
        url: result.uri,
        dialogTitle: 'Spielbericht teilen',
      });
      return true;
    } else {
      // Web fallback: download via link
      const link = document.createElement('a');
      link.href = base64DataUri;
      link.download = fileName;
      link.click();
      return true;
    }
  } catch (err) {
    console.error('Share PDF error:', err);
    return false;
  }
}

export async function shareXLS(data: Uint8Array, fileName: string): Promise<boolean> {
  try {
    // Convert to base64
    let binary = '';
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    const base64 = btoa(binary);

    if (Capacitor.isNativePlatform()) {
      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      });
      await Share.share({
        title: 'Spielbericht',
        url: result.uri,
        dialogTitle: 'Spielbericht teilen',
      });
      return true;
    } else {
      // Web fallback
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      return true;
    }
  } catch (err) {
    console.error('Share XLS error:', err);
    return false;
  }
}
