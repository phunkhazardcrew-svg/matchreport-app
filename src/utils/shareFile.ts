import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

function uint8ToBase64(arr: Uint8Array): string {
  let binary = '';
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

export async function sharePDF(base64DataUri: string, fileName: string): Promise<boolean> {
  try {
    const base64 = base64DataUri.split(',')[1] || base64DataUri;
    if (Capacitor.isNativePlatform()) {
      const result = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
      await Share.share({ title: 'Spielbericht', url: result.uri, dialogTitle: 'Spielbericht teilen' });
      return true;
    } else {
      const link = document.createElement('a');
      link.href = base64DataUri;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    }
  } catch (err) { console.error('Share PDF:', err); return false; }
}

export async function shareXLS(data: Uint8Array, fileName: string): Promise<boolean> {
  try {
    const base64 = uint8ToBase64(data);
    if (Capacitor.isNativePlatform()) {
      const result = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
      await Share.share({ title: 'Spielbericht', url: result.uri, dialogTitle: 'Spielbericht teilen' });
      return true;
    } else {
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    }
  } catch (err) { console.error('Share XLS:', err); return false; }
}
