// Mochi del lado del servidor: lee tu Drive (materias, carpetas, archivos, fechas)
// para que Claude lo use desde el conector. Usa el mismo permiso drive.file que la app.

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';
const FIELDS = 'id,name,mimeType,modifiedTime,size,parents,appProperties,webViewLink';

export type DFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  parents?: string[];
  appProperties?: Record<string, string>;
  webViewLink?: string;
};

export class Drive {
  constructor(private token: string) {}

  async req(url: string, init: RequestInit = {}) {
    const r = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${this.token}` } });
    if (!r.ok) throw new Error(`Google Drive respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r;
  }

  async list(q: string, max = 2000) {
    const out: DFile[] = [];
    let pageToken = '';
    do {
      const p = new URLSearchParams({ q, fields: `nextPageToken,files(${FIELDS})`, pageSize: '1000' });
      // Google no deja ordenar cuando se busca adentro del contenido.
      if (!q.includes('fullText')) p.set('orderBy', 'name');
      if (pageToken) p.set('pageToken', pageToken);
      const r: { files: DFile[]; nextPageToken?: string } = await (await this.req(`${API}/files?${p}`)).json();
      out.push(...r.files);
      pageToken = r.nextPageToken ?? '';
    } while (pageToken && out.length < max);
    return out;
  }

  async get(id: string) {
    return (await (await this.req(`${API}/files/${id}?fields=${FIELDS}`)).json()) as DFile;
  }

  async download(id: string) {
    return new Uint8Array(await (await this.req(`${API}/files/${id}?alt=media`)).arrayBuffer());
  }

  async exportText(id: string, mime: string) {
    return (await this.req(`${API}/files/${id}/export?mimeType=${encodeURIComponent(mime)}`)).text();
  }

  async create(name: string, parent: string, content: string, mimeType: string) {
    const boundary = 'mochi' + Math.random().toString(36).slice(2);
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name, parents: [parent], mimeType }) +
      `\r\n--${boundary}\r\nContent-Type: ${mimeType}; charset=UTF-8\r\n\r\n${content}\r\n--${boundary}--`;
    const r = await this.req(`${UPLOAD}/files?uploadType=multipart&fields=${FIELDS}`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    return (await r.json()) as DFile;
  }

  async createFolder(name: string, parent: string) {
    const r = await this.req(`${API}/files?fields=${FIELDS}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent], appProperties: { facu: 'folder' } }),
    });
    return (await r.json()) as DFile;
  }
}

// ---------------------------------------------------------------------------
// La estructura: Facultad / año / materia / carpetas libres.

export type Materia = { id: string; name: string; year: string; estado?: string; nota?: string };
export type Tree = {
  rootId: string;
  materias: Map<string, Materia>;
  // Carpeta → camino legible ("Diseño de Sistemas › TP Final › Entrega 1") y materia a la que pertenece.
  folders: Map<string, { name: string; path: string; materiaId: string; parentId: string }>;
};

export async function loadTree(d: Drive): Promise<Tree> {
  const all = await d.list(`mimeType='${FOLDER}' and trashed=false`);
  const root = all.find((f) => f.appProperties?.facu === 'root');
  if (!root) throw new Error('No encontré la carpeta Facultad. Entrá una vez a Mochi para crearla.');
  const byId = new Map(all.map((f) => [f.id, f]));
  const materias = new Map<string, Materia>();
  for (const f of all) {
    if (f.appProperties?.facu !== 'materia') continue;
    const year = byId.get(f.parents?.[0] ?? '');
    materias.set(f.id, { id: f.id, name: f.name, year: year?.name ?? '', estado: f.appProperties.estado, nota: f.appProperties.nota });
  }
  const folders: Tree['folders'] = new Map();
  const resolve = (f: DFile, seen = new Set<string>()): { path: string; materiaId: string } | null => {
    const parentId = f.parents?.[0];
    if (!parentId || seen.has(f.id)) return null;
    seen.add(f.id);
    const m = materias.get(parentId);
    if (m) return { path: `${m.name} › ${f.name}`, materiaId: m.id };
    const known = folders.get(parentId);
    if (known) return { path: `${known.path} › ${f.name}`, materiaId: known.materiaId };
    const parent = byId.get(parentId);
    if (!parent || ['root', 'year', 'materia'].includes(parent.appProperties?.facu ?? '')) return null;
    const up = resolve(parent, seen);
    if (!up) return null;
    folders.set(parent.id, { name: parent.name, path: up.path, materiaId: up.materiaId, parentId: parent.parents![0] });
    return { path: `${up.path} › ${f.name}`, materiaId: up.materiaId };
  };
  for (const f of all) {
    if (f.appProperties?.facu && f.appProperties.facu !== 'folder' && f.appProperties.facu !== 'cat') continue;
    const r = resolve(f);
    if (r) folders.set(f.id, { name: f.name, path: r.path, materiaId: r.materiaId, parentId: f.parents![0] });
  }
  return { rootId: root.id, materias, folders };
}

// Dónde está un archivo, en palabras.
export function where(t: Tree, parentId?: string) {
  if (!parentId) return '';
  return t.folders.get(parentId)?.path ?? t.materias.get(parentId)?.name ?? '';
}

// Busca una materia por id o por nombre (sin importar tildes ni mayúsculas).
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
export function findMateria(t: Tree, q: string) {
  if (t.materias.has(q)) return t.materias.get(q)!;
  const n = norm(q);
  const all = [...t.materias.values()];
  return all.find((m) => norm(m.name) === n) ?? all.find((m) => norm(m.name).includes(n)) ?? null;
}

export function findFolder(t: Tree, materiaId: string, q: string) {
  if (t.folders.has(q)) return { id: q, ...t.folders.get(q)! };
  const n = norm(q);
  const inM = [...t.folders.entries()].filter(([, f]) => f.materiaId === materiaId);
  const hit = inM.find(([, f]) => norm(f.name) === n) ?? inM.find(([, f]) => norm(f.path).endsWith(n)) ?? inM.find(([, f]) => norm(f.name).includes(n));
  return hit ? { id: hit[0], ...hit[1] } : null;
}

// Ids de una materia y todas sus carpetas, para buscar archivos adentro.
export function containerIds(t: Tree, materiaId?: string) {
  const ms = materiaId ? [materiaId] : [...t.materias.keys()];
  return [...ms, ...[...t.folders.entries()].filter(([, f]) => ms.includes(f.materiaId)).map(([id]) => id)];
}

export async function filesIn(d: Drive, ids: string[], extra = '') {
  const out: DFile[] = [];
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40).map((id) => `'${id}' in parents`).join(' or ');
    out.push(...(await d.list(`(${chunk}) and mimeType!='${FOLDER}' and trashed=false${extra}`)));
  }
  return out;
}

export const escapeQuery = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

// Fechas, notas y entregas: archivo "Mochi - fechas.json" en la carpeta Facultad.
export async function loadDatos(d: Drive, t: Tree) {
  const f = (await d.list(`'${t.rootId}' in parents and appProperties has { key='facu' and value='datos' } and trashed=false`))[0];
  if (!f) return { exams: [], grades: [], entregas: [] } as Datos;
  return { exams: [], grades: [], entregas: [], ...JSON.parse(new TextDecoder().decode(await d.download(f.id))) } as Datos;
}
export type Datos = {
  exams: { materiaId: string; title: string; date: string }[];
  grades: { materiaId: string; title: string; nota: number }[];
  entregas: { materiaId: string; title: string; desc?: string; date: string; done: boolean }[];
};

// ---------------------------------------------------------------------------
// Leer el contenido de un archivo como texto (o imagen, para que Claude la vea).

const ext = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');
const MAX_TEXT = 120_000;

export type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string };

export async function readContent(d: Drive, f: DFile): Promise<Content[]> {
  const e = ext(f.name);
  const head = (text: string) => {
    const cut = text.length > MAX_TEXT;
    return [{ type: 'text' as const, text: `${f.name}\n\n${text.slice(0, MAX_TEXT)}${cut ? '\n\n[El archivo sigue: se muestran solo las primeras partes.]' : ''}` }];
  };
  // Documentos nativos de Google.
  if (f.mimeType === 'application/vnd.google-apps.document') return head(await d.exportText(f.id, 'text/plain'));
  if (f.mimeType === 'application/vnd.google-apps.spreadsheet') return head(await d.exportText(f.id, 'text/csv'));
  if (f.mimeType === 'application/vnd.google-apps.presentation') return head(await d.exportText(f.id, 'text/plain'));

  if (Number(f.size ?? 0) > 40 * 1024 * 1024) return [{ type: 'text', text: `${f.name} es muy grande para leerlo (más de 40 MB).` }];

  if (e === 'pdf' || f.mimeType === 'application/pdf') return head(await pdfText(await d.download(f.id)));
  if (e === 'docx') {
    const mammoth = await import('mammoth');
    const buffer = Buffer.from(await d.download(f.id));
    return head((await (mammoth.default ?? mammoth).extractRawText({ buffer })).value);
  }
  if (['xlsx', 'xls', 'ods', 'csv'].includes(e)) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await d.download(f.id), { type: 'array' });
    return head(wb.SheetNames.map((n) => `## Hoja: ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join('\n\n'));
  }
  if (f.mimeType.startsWith('image/') && Number(f.size ?? 0) < 4.5 * 1024 * 1024 && !['heic', 'heif'].includes(e)) {
    const data = Buffer.from(await d.download(f.id)).toString('base64');
    return [
      { type: 'text', text: f.name },
      { type: 'image', data, mimeType: f.mimeType },
    ];
  }
  if (['txt', 'md', 'csv', 'json', 'html', 'xml', 'sql', 'py', 'js', 'ts', 'java', 'c', 'cpp', 'excalidraw'].includes(e) || f.mimeType.startsWith('text/'))
    return head(new TextDecoder().decode(await d.download(f.id)));
  return [{ type: 'text', text: `No puedo leer el contenido de ${f.name} (tipo .${e}). Se puede abrir en Drive: ${f.webViewLink ?? ''}` }];
}

async function pdfText(data: Uint8Array) {
  // En el servidor no hay "worker": se carga el de pdf.js directo y lo usa en el mismo proceso.
  const g = globalThis as { pdfjsWorker?: unknown };
  // @ts-expect-error: el worker de pdf.js no trae tipos.
  g.pdfjsWorker ??= await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
  const pages: string[] = [];
  let total = 0;
  for (let i = 1; i <= doc.numPages && total < MAX_TEXT; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    const text = c.items.map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : '')).join('');
    pages.push(`--- Página ${i} ---\n${text.trim()}`);
    total += text.length;
  }
  await doc.cleanup();
  const out = pages.join('\n\n');
  return out.replace(/--- Página \d+ ---\n/g, '').trim()
    ? out
    : 'Este PDF no tiene texto (parece escaneado o son fotos). Abrilo en Mochi para verlo.';
}
