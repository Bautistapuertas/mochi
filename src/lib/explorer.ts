// Operaciones "como en Windows" sobre archivos y carpetas de una materia:
// copiar, cortar y pegar (con un portapapeles propio de la app), renombrar y eliminar.

import { API, DEMO, FOLDER, list, move, rename, req, trash, update, type DFile } from './drive';
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

// Deshacer (Ctrl+Z): cada cambio guarda cómo volver atrás. Se guardan los últimos 30.
type Undo = { label: string; run: () => Promise<void> };
const undos: Undo[] = [];
function pushUndo(label: string, run: () => Promise<void>) {
  undos.push({ label, run });
  if (undos.length > 30) undos.shift();
}
export const canUndo = () => undos.length > 0;
// Devuelve qué se deshizo, o null si no había nada.
export async function undoLast() {
  const u = undos.pop();
  if (!u) return null;
  try {
    await u.run();
  } catch (e) {
    undos.push(u);
    throw e;
  }
  return u.label;
}
const many = (n: number, one: string) => (n === 1 ? one : `${n} elementos`);

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
  const moved: Item[] = [];
  const created: string[] = [];
  try {
    for (const it of c.items) {
      onProgress?.(done, c.items.length);
      if (c.mode === 'cut') {
        if (it.parentId !== dest) {
          await move(it.id, [it.parentId], dest);
          moved.push(it);
        }
      } else {
        const name = freeName(it.name, taken, it.kind === 'folder');
        taken.add(name.toLowerCase());
        created.push((it.kind === 'folder' ? await copyFolder(it.id, name, dest) : await copyFile(it.id, name, dest)).id);
      }
      done++;
    }
  } finally {
    // Aunque se corte a la mitad, se puede deshacer lo que llegó a hacerse.
    if (moved.length) pushUndo(`mover ${many(moved.length, moved[0].name)}`, () => moveBack(moved, dest));
    if (created.length) pushUndo(`pegar ${many(created.length, 'la copia')}`, async () => {
      for (const id of created) await trash(id);
    });
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
  const moved: Item[] = [];
  try {
    for (const it of todo) {
      await move(it.id, [it.parentId], dest);
      moved.push(it);
    }
  } finally {
    if (moved.length) pushUndo(`mover ${many(moved.length, moved[0].name)}`, () => moveBack(moved, dest));
  }
  return todo.length;
}

// Vuelve cada cosa a la carpeta donde estaba.
async function moveBack(items: Item[], from: string) {
  for (const it of items) await move(it.id, [from], it.parentId);
}

// Para "Mover a…": registra el cambio para poder deshacerlo.
export function recordMove(items: Item[], dest: string) {
  const moved = items.filter((it) => it.parentId !== dest);
  if (moved.length) pushUndo(`mover ${many(moved.length, moved[0].name)}`, () => moveBack(moved, dest));
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
  const gone: Item[] = [];
  try {
    for (const it of items) {
      await trash(it.id);
      gone.push(it);
    }
  } finally {
    // Se saca de la papelera de Drive.
    if (gone.length) pushUndo(`eliminar ${many(gone.length, gone[0].name)}`, async () => {
      for (const it of gone) await update(it.id, { trashed: false });
    });
  }
}

export async function renameItem(it: Item, name: string) {
  await rename(it.id, name.trim());
  pushUndo(`cambiar el nombre de ${it.name}`, async () => void (await rename(it.id, it.name)));
}

export async function newFolder(dest: string) {
  const f = await addFolder(await newFolderName(dest), dest);
  pushUndo(`crear ${f.name}`, async () => void (await trash(f.id)));
  return f;
}

// Nombre libre para "Nueva carpeta", "Nueva carpeta (2)"…
export async function newFolderName(dest: string) {
  const taken = await namesIn(dest);
  for (let i = 1; ; i++) {
    const n = `Nueva carpeta${i > 1 ? ` (${i})` : ''}`;
    if (!taken.has(n.toLowerCase())) return n;
  }
}

export const fileItem = (f: DFile, parentId: string): Item => ({ id: f.id, kind: 'file', name: f.name, parentId });
