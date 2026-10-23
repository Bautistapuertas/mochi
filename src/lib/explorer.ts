// Operaciones "como en Windows" sobre archivos y carpetas de una materia:
// copiar, cortar y pegar (con un portapapeles propio de la app), renombrar y eliminar.

import { API, DEMO, FOLDER, list, move, rename, req, trash, type DFile } from './drive';
import { addFolder, type Tree } from './facu';
import { extOf } from './files';

// Un elemento de la pantalla: archivo o carpeta, con dónde está.
export type Item = { id: string; kind: 'file' | 'folder'; name: string; parentId: string };

type Clip = { mode: 'copy' | 'cut'; items: Item[] } | null;
let clip: Clip = null;
export const CLIPBOARD = 'mochi:portapapeles';

export const getClipboard = () => clip;
export function setClipboard(c: Clip) {
  clip = c && c.items.length ? c : null;
  dispatchEvent(new Event(CLIPBOARD));
}

// ¿Está "dest" adentro de "folderId" (o es la misma)? No se puede pegar una carpeta adentro de sí misma.
export function isInside(tree: Tree, dest: string, folderId: string) {
  for (let f = tree.folders.get(dest); f; f = f.parent) if (f.id === folderId) return true;
  return dest === folderId;
}

// "Apunte.pdf" → "Apunte - copia.pdf", y si ya existe, "Apunte - copia (2).pdf".
function freeName(name: string, taken: Set<string>, isFolder: boolean) {
  if (!taken.has(name.toLowerCase())) return name;
  const ext = isFolder ? '' : extOf(name);
  const base = ext ? name.slice(0, -(ext.length + 1)) : name;
  const dot = ext ? `.${ext}` : '';
  for (let i = 1; ; i++) {
    const n = `${base} - copia${i > 1 ? ` (${i})` : ''}${dot}`;
    if (!taken.has(n.toLowerCase())) return n;
  }
}

async function namesIn(folderId: string) {
  return new Set((await list(`'${folderId}' in parents and trashed=false`)).map((f) => f.name.toLowerCase()));
}

async function copyFile(id: string, name: string, dest: string) {
  if (DEMO) return (await import('./demo')).demoCopy(id, name, dest);
  const r = await req(`${API}/files/${id}/copy?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parents: [dest] }),
  });
  return (await r.json()) as { id: string };
}

async function copyFolder(id: string, name: string, dest: string) {
  const f = await addFolder(name, dest);
  for (const c of await list(`'${id}' in parents and trashed=false`)) {
    if (c.mimeType === FOLDER) await copyFolder(c.id, c.name, f.id);
    else await copyFile(c.id, c.name, f.id);
  }
  return f;
}

// Pega lo del portapapeles en una carpeta (o suelto en la materia). Devuelve cuántos se pegaron.
export async function paste(tree: Tree, dest: string, onProgress?: (done: number, total: number) => void) {
  const c = clip;
  if (!c) return 0;
  for (const it of c.items)
    if (it.kind === 'folder' && isInside(tree, dest, it.id)) throw new Error(`No se puede pegar “${it.name}” adentro de sí misma.`);
  const taken = c.mode === 'copy' ? await namesIn(dest) : new Set<string>();
  let done = 0;
  for (const it of c.items) {
    onProgress?.(done, c.items.length);
    if (c.mode === 'cut') {
      if (it.parentId !== dest) await move(it.id, [it.parentId], dest);
    } else {
      const name = freeName(it.name, taken, it.kind === 'folder');
      taken.add(name.toLowerCase());
      if (it.kind === 'folder') await copyFolder(it.id, name, dest);
      else await copyFile(it.id, name, dest);
    }
    done++;
  }
  // Lo cortado se pega una sola vez, como en Windows.
  if (c.mode === 'cut') setClipboard(null);
  return done;
}

// Mover arrastrando (o con "Mover a…"): igual que cortar y pegar, sin pasar por el portapapeles.
export async function moveItems(tree: Tree, items: Item[], dest: string) {
  for (const it of items)
    if (it.kind === 'folder' && isInside(tree, dest, it.id)) throw new Error(`No se puede mover “${it.name}” adentro de sí misma.`);
  const todo = items.filter((it) => it.parentId !== dest);
  for (const it of todo) await move(it.id, [it.parentId], dest);
  return todo.length;
}

export async function copyItems(tree: Tree, items: Item[], dest: string) {
  const prev = clip;
  clip = { mode: 'copy', items };
  try {
    return await paste(tree, dest);
  } finally {
    clip = prev;
  }
}

export async function removeItems(items: Item[]) {
  for (const it of items) await trash(it.id);
}

export const renameItem = (id: string, name: string) => rename(id, name.trim());

// Nombre libre para "Nueva carpeta", "Nueva carpeta (2)"…
export async function newFolderName(dest: string) {
  const taken = await namesIn(dest);
  for (let i = 1; ; i++) {
    const n = `Nueva carpeta${i > 1 ? ` (${i})` : ''}`;
    if (!taken.has(n.toLowerCase())) return n;
  }
}

export const fileItem = (f: DFile, parentId: string): Item => ({ id: f.id, kind: 'file', name: f.name, parentId });
