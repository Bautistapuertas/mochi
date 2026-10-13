// Subida de archivos y carpetas enteras, respetando las subcarpetas.

import { upload } from './drive';
import { addFolder, type Tree } from './facu';

// dirs = carpetas dentro de las que va el archivo, relativas al destino.
export type UploadItem = { file: File; dirs: string[] };

const JUNK = /^(\.|~\$)|^(desktop\.ini|thumbs\.db)$/i;
const keep = (it: UploadItem) => !JUNK.test(it.file.name);

export function itemsFromInput(list: FileList): UploadItem[] {
  return [...list]
    .map((file) => ({ file, dirs: (file.webkitRelativePath || file.name).split('/').slice(0, -1) }))
    .filter(keep);
}

type Entry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (ok: (f: File) => void, err: (e: unknown) => void) => void;
  createReader?: () => { readEntries: (ok: (e: Entry[]) => void, err: (e: unknown) => void) => void };
};

// Lee lo que se arrastró a la ventana, incluyendo carpetas con todo su contenido.
export async function itemsFromDrop(dt: DataTransfer): Promise<UploadItem[]> {
  // Hay que pedir las entradas antes de cualquier await: después el navegador las invalida.
  const entries = [...dt.items]
    .map((i) => i.webkitGetAsEntry?.() as unknown as Entry | null | undefined)
    .filter((e): e is Entry => !!e);
  if (!entries.length) return [...dt.files].map((file) => ({ file, dirs: [] })).filter(keep);

  const out: UploadItem[] = [];
  const walk = async (entry: Entry, dirs: string[]) => {
    if (entry.isFile) {
      out.push({ file: await new Promise<File>((ok, err) => entry.file!(ok, err)), dirs });
    } else if (entry.isDirectory) {
      const reader = entry.createReader!();
      let batch: Entry[];
      do {
        batch = await new Promise<Entry[]>((ok, err) => reader.readEntries(ok, err));
        for (const e of batch) await walk(e, [...dirs, entry.name]);
      } while (batch.length);
    }
  };
  for (const e of entries) await walk(e, []);
  return out.filter(keep);
}

const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Si subís la carpeta "Base de Datos" adentro de "Base de Datos", se guarda solo lo de adentro.
export function mergeSameName(items: UploadItem[], destName: string): UploadItem[] {
  const top = items[0]?.dirs[0];
  if (!top || norm(top) !== norm(destName) || !items.every((i) => i.dirs[0] === top)) return items;
  return items.map((i) => ({ ...i, dirs: i.dirs.slice(1) }));
}

export function summarize(items: UploadItem[]) {
  const folders = new Set(items.map((i) => i.dirs.join('/')).filter(Boolean));
  return { files: items.length, folders: folders.size, bytes: items.reduce((s, i) => s + i.file.size, 0) };
}

export type Progress = { done: boolean[]; bytes: number; total: number; current?: string };

// Crea las carpetas que hagan falta (reusando las que ya existen con el mismo nombre)
// y sube los archivos de a 3 a la vez. Los ya subidos (done[i]) se saltean al reintentar.
export async function uploadItems(
  tree: Tree,
  parentId: string,
  items: UploadItem[],
  done: boolean[],
  onProgress: (p: Progress) => void,
) {
  const total = items.reduce((s, i) => s + i.file.size, 0);
  const partial = new Map<number, number>();
  let finished = items.reduce((s, it, i) => s + (done[i] ? it.file.size : 0), 0);
  const report = (current?: string) =>
    onProgress({ done: [...done], bytes: finished + [...partial.values()].reduce((a, b) => a + b, 0), total, current });

  const cache = new Map<string, string>();
  const existing = (pid: string, name: string) =>
    [...tree.folders.values()].find((f) => f.parentId === pid && f.name === name)?.id;
  const ensure = async (dirs: string[]) => {
    let pid = parentId;
    for (let i = 0; i < dirs.length; i++) {
      const key = dirs.slice(0, i + 1).join('/');
      let id = cache.get(key) ?? existing(pid, dirs[i]);
      if (!id) id = (await addFolder(dirs[i], pid)).id;
      cache.set(key, id);
      pid = id;
    }
    return pid;
  };

  // Carpetas primero, en orden, para no crear duplicados en paralelo.
  const paths = [...new Set(items.map((i) => i.dirs.join('/')))].sort();
  for (const p of paths) if (p) await ensure(p.split('/'));

  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      if (done[i]) continue;
      const it = items[i];
      const parent = await ensure(it.dirs);
      report(it.file.name);
      await upload(it.file, parent, (f) => {
        partial.set(i, f * it.file.size);
        report(it.file.name);
      });
      partial.delete(i);
      finished += it.file.size;
      done[i] = true;
      report();
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}
