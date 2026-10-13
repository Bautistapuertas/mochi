// La estructura de la facultad dentro de Drive:
//   Facultad / 3er año / Base de Datos / Trabajos prácticos / TP1 / ...
// Año y materia se marcan con appProperties (así no importa si se renombran).
// Adentro de la materia, las carpetas son libres y pueden tener subcarpetas.

import { createFolder, escapeQuery, FOLDER, list, rename, trash, type DFile } from './drive';

export const YEAR_NAMES = ['1er año', '2do año', '3er año', '4to año', '5to año', '6to año', '7mo año'];
export const COLORS = ['#4c6ef5', '#12b886', '#f59f00', '#e64980', '#7950f2', '#15aabf', '#fa5252', '#74b816'];

export type Folder = { id: string; name: string; parentId: string; parent?: Folder; materia: Materia; children: Folder[] };
export type Materia = { id: string; name: string; color: string; yearId: string; folders: Folder[] };
export type Year = { id: string; name: string; order: number; materias: Materia[] };
export type Tree = {
  rootId: string;
  rootLink?: string;
  years: Year[];
  materias: Map<string, Materia>;
  // Todas las carpetas que están adentro de alguna materia (a cualquier profundidad).
  folders: Map<string, Folder>;
};
// folder vacío = archivo suelto en la materia.
export type FileItem = DFile & { materia: Materia; folder?: Folder };

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'es', { numeric: true });

export async function loadTree(): Promise<Tree> {
  const all = await list(`mimeType='${FOLDER}' and trashed=false`);
  const root = all.find((f) => f.appProperties?.facu === 'root') ?? (await createFolder('Facultad', undefined, { facu: 'root' }));

  const years: Year[] = all
    .filter((f) => f.appProperties?.facu === 'year' && f.parents?.includes(root.id))
    .map((f) => ({ id: f.id, name: f.name, order: Number(f.appProperties?.order ?? 0), materias: [] }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'));
  const yearById = new Map(years.map((y) => [y.id, y]));

  const materias = new Map<string, Materia>();
  for (const f of all) {
    if (f.appProperties?.facu !== 'materia') continue;
    const year = f.parents?.map((p) => yearById.get(p)).find(Boolean);
    if (!year) continue;
    const m: Materia = { id: f.id, name: f.name, color: f.appProperties.color ?? COLORS[0], yearId: year.id, folders: [] };
    materias.set(m.id, m);
    year.materias.push(m);
  }
  for (const y of years) y.materias.sort(byName);

  // Arma el árbol de carpetas de cada materia subiendo por los padres.
  const raw = new Map(all.map((f) => [f.id, f]));
  const folders = new Map<string, Folder>();
  const structural = (f: DFile) => ['root', 'year', 'materia'].includes(f.appProperties?.facu ?? '');
  const resolve = (id: string, seen = new Set<string>()): Folder | Materia | null => {
    if (materias.has(id)) return materias.get(id)!;
    if (folders.has(id)) return folders.get(id)!;
    const f = raw.get(id);
    const parentId = f?.parents?.[0];
    if (!f || !parentId || seen.has(id) || structural(f)) return null;
    seen.add(id);
    const parent = resolve(parentId, seen);
    if (!parent) return null;
    const isFolder = 'materia' in parent;
    const folder: Folder = {
      id: f.id,
      name: f.name,
      parentId,
      parent: isFolder ? parent : undefined,
      materia: isFolder ? parent.materia : parent,
      children: [],
    };
    folders.set(f.id, folder);
    (isFolder ? parent.children : parent.folders).push(folder);
    return folder;
  };
  // Incluye las viejas secciones (Teoría, Parciales…), que ahora son carpetas normales.
  for (const f of all) if (!structural(f)) resolve(f.id);
  for (const m of materias.values()) m.folders.sort(byName);
  for (const f of folders.values()) f.children.sort(byName);

  return { rootId: root.id, rootLink: root.webViewLink, years, materias, folders };
}

const yearName = (index: number) => YEAR_NAMES[index] ?? `Año ${index + 1}`;
export const nextYearName = (tree: Tree) => yearName(tree.years.length);

export async function addYear(tree: Tree, index = tree.years.length) {
  return createFolder(yearName(index), tree.rootId, { facu: 'year', order: String(index + 1) });
}

export async function addMateria(year: Year, name: string, color: string) {
  return createFolder(name.trim(), year.id, { facu: 'materia', color });
}

export const addFolder = (name: string, parentId: string) => createFolder(name.trim(), parentId, { facu: 'folder' });
export const renameFolder = rename;
export const trashFolder = trash;

// Camino desde la materia: [Trabajos prácticos, TP1]
export function folderPath(folder?: Folder): Folder[] {
  const out: Folder[] = [];
  for (let f = folder; f; f = f.parent) out.unshift(f);
  return out;
}

export function whereLabel(item: { materia: Materia; folder?: Folder }) {
  return [item.materia.name, ...folderPath(item.folder).map((f) => f.name)].join(' · ');
}

export function descendants(folder: Folder): Folder[] {
  return folder.children.flatMap((c) => [c, ...descendants(c)]);
}

export function materiaFolders(m: Materia): Folder[] {
  return m.folders.flatMap((f) => [f, ...descendants(f)]);
}

function toItems(tree: Tree, files: DFile[]): FileItem[] {
  const out: FileItem[] = [];
  for (const f of files) {
    for (const p of f.parents ?? []) {
      const folder = tree.folders.get(p);
      if (folder) {
        out.push({ ...f, materia: folder.materia, folder });
        break;
      }
      const materia = tree.materias.get(p);
      if (materia) {
        out.push({ ...f, materia });
        break;
      }
    }
  }
  return out;
}

export function itemOf(tree: Tree, f: DFile): FileItem | null {
  return toItems(tree, [f])[0] ?? null;
}

const notFolder = `mimeType!='${FOLDER}' and trashed=false`;

export async function materiaFiles(tree: Tree, m: Materia) {
  const ids = [m.id, ...materiaFolders(m).map((f) => f.id)];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 40) chunks.push(ids.slice(i, i + 40));
  const parts = await Promise.all(
    chunks.map((c) => list(`(${c.map((id) => `'${id}' in parents`).join(' or ')}) and ${notFolder}`)),
  );
  return toItems(tree, parts.flat());
}

export async function recentFiles(tree: Tree) {
  return toItems(tree, await list(notFolder, { orderBy: 'modifiedTime desc', pageSize: 12, firstPageOnly: true })).slice(0, 6);
}

// Busca en el nombre y también dentro del contenido (PDF, Word, etc.).
export async function searchFiles(tree: Tree, text: string) {
  return toItems(tree, await list(`fullText contains '${escapeQuery(text)}' and ${notFolder}`, { pageSize: 50, firstPageOnly: true }));
}

export const EMPTY_DRAWING = JSON.stringify({
  type: 'excalidraw',
  version: 2,
  source: 'mochi',
  elements: [],
  appState: { viewBackgroundColor: '#ffffff' },
  files: {},
});
export const DRAWING_MIME = 'application/vnd.excalidraw+json';
