// Sacar archivos de Mochi para usarlos en otra app (por ejemplo, mandárselos a Claude).
//   Celu: se abre el menú de compartir del teléfono con los archivos adjuntos.
//   Compu: se descargan todos juntos, listos para arrastrarlos al chat.

import type { DFile } from './drive';
import { fileBlob } from './fileBlob';
import { saveBlob } from './files';

// En el celu se comparte; en la compu el menú de compartir no suele tener las apps de chat, así que se descarga.
export const canSendToApp = () => {
  try {
    return matchMedia('(pointer: coarse)').matches && !!navigator.canShare?.({ files: [new File([''], 'a.pdf', { type: 'application/pdf' })] });
  } catch {
    return false;
  }
};

export async function sendFiles(files: DFile[], onProgress?: (done: number, total: number) => void): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blobs: { blob: Blob; file: DFile }[] = [];
  for (const f of files) {
    onProgress?.(blobs.length, files.length);
    blobs.push({ blob: await fileBlob(f), file: f });
  }
  if (canSendToApp()) {
    const list = blobs.map(({ blob, file }) => new File([blob], file.name, { type: blob.type || file.mimeType }));
    if (navigator.canShare?.({ files: list })) {
      try {
        await navigator.share({ files: list });
        return 'shared';
      } catch (e) {
        // Cerrar el menú de compartir no es un error.
        if ((e as Error).name === 'AbortError') return 'cancelled';
      }
    }
  }
  // Un poco de espacio entre descargas para que el navegador no corte ninguna.
  for (const { blob, file } of blobs) {
    saveBlob(blob, file.name);
    await new Promise((r) => setTimeout(r, 250));
  }
  return 'downloaded';
}
