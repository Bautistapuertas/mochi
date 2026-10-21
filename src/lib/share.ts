// Compartir una carpeta o materia con un link.
//
// Lo normal es compartir la carpeta entera. Pero Google no deja hacerlo si adentro hay archivos que
// no se subieron desde Mochi (por ejemplo, agregados desde la página de Drive): con el permiso
// drive.file la app solo maneja lo que creó. En ese caso se comparte cada archivo que Mochi sí ve,
// y se arma un índice (un JSON en la carpeta Facultad) con las carpetas y archivos. El link apunta a ese índice.

import { FOLDER, createTextFile, download, list, req, saveContent, trash, update, API } from './drive';

export type ShareManifest = {
  mochi: 'share';
  version: 1;
  name: string;
  files: { id: string; name: string; mimeType: string; size?: string; dirs: string[] }[];
};

const NOT_ALL_CHILDREN = /appNotAuthorizedToChild|write access to all of the children/i;

async function makePublic(id: string) {
  await req(`${API}/files/${id}/permissions?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'anyone', role: 'reader', allowFileDiscovery: false }),
  });
}

async function makePrivate(id: string) {
  const r: { permissions: { id: string; type: string }[] } = await (
    await req(`${API}/files/${id}/permissions?fields=permissions(id,type)`)
  ).json();
  for (const p of r.permissions.filter((x) => x.type === 'anyone'))
    await req(`${API}/files/${id}/permissions/${p.id}`, { method: 'DELETE' });
}

// Varias tareas a la vez, sin pasarse (Drive corta si llegan demasiadas juntas).
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

// Todo lo que Mochi ve adentro de la carpeta, con el camino de subcarpetas.
async function walk(id: string, dirs: string[] = []): Promise<ShareManifest['files']> {
  const out: ShareManifest['files'] = [];
  for (const f of await list(`'${id}' in parents and trashed=false`)) {
    if (f.mimeType === FOLDER) out.push(...(await walk(f.id, [...dirs, f.name])));
    else if (!f.mimeType.startsWith('application/vnd.google-apps.'))
      out.push({ id: f.id, name: f.name, mimeType: f.mimeType, size: f.size, dirs });
  }
  return out;
}

async function snapshot(target: { id: string; name: string }, rootId: string, manifestId?: string) {
  const files = await walk(target.id);
  await pool(files, 4, (f) => makePublic(f.id));
  const manifest: ShareManifest = { mochi: 'share', version: 1, name: target.name, files };
  const text = JSON.stringify(manifest);
  let id = manifestId;
  if (id) await saveContent(id, new Blob([text], { type: 'application/json' }));
  else id = (await createTextFile(`Mochi - compartido - ${target.name}.json`, rootId, text, 'application/json', { facu: 'share' })).id;
  await makePublic(id);
  return { id, count: files.length };
}

// Devuelve el id que va en el link y, si se compartió archivo por archivo, cuántos entraron.
export async function shareTarget(target: { id: string; name: string }, rootId: string): Promise<{ shareId: string; count?: number }> {
  try {
    await makePublic(target.id);
    await update(target.id, { appProperties: { compartido: '1' } });
    return { shareId: target.id };
  } catch (e) {
    if (!NOT_ALL_CHILDREN.test(String((e as Error).message))) throw e;
  }
  const s = await snapshot(target, rootId);
  await update(target.id, { appProperties: { compartido: s.id } });
  return { shareId: s.id, count: s.count };
}

// Suma al link lo que se agregó después de compartir (solo cuando se comparte archivo por archivo).
export async function refreshShare(target: { id: string; name: string }, rootId: string, manifestId: string) {
  return (await snapshot(target, rootId, manifestId)).count;
}

export async function unshareTarget(target: { id: string }, shareId: string) {
  if (shareId === target.id) await makePrivate(target.id);
  else {
    try {
      const m: ShareManifest = JSON.parse(await (await download(shareId)).text());
      await pool(m.files, 4, (f) => makePrivate(f.id).catch(() => {}));
    } catch {}
    await trash(shareId).catch(() => {});
  }
  await update(target.id, { appProperties: { compartido: null } });
}
