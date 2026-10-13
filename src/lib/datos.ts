// Datos chicos de la app (fechas de parciales) en un archivo JSON dentro de la carpeta Facultad.
// Así se ven igual en la compu y en el celu.

import { DEMO, createTextFile, download, list, saveContent } from './drive';

export type Exam = { id: string; materiaId: string; title: string; date: string /* AAAA-MM-DD */ };
export type Datos = { version: 1; exams: Exam[] };

const empty = (): Datos => ({ version: 1, exams: [] });
let fileId: string | null = null;
let demoDatos: Datos | null = null;

function demoSample(): Datos {
  const inDays = (n: number) => toISO(new Date(Date.now() + n * 86_400_000));
  return {
    version: 1,
    exams: [
      { id: 'e1', materiaId: 'm1', title: 'Parcial 1', date: inDays(2) },
      { id: 'e2', materiaId: 'm2', title: 'Entrega TP', date: inDays(9) },
      { id: 'e3', materiaId: 'm1', title: 'Final', date: inDays(40) },
    ],
  };
}

async function read(rootId: string): Promise<Datos> {
  if (DEMO) return (demoDatos ??= demoSample());
  const f = (await list(`'${rootId}' in parents and appProperties has { key='facu' and value='datos' } and trashed=false`))[0];
  if (!f) return empty();
  fileId = f.id;
  try {
    return { ...empty(), ...JSON.parse(await (await download(f.id)).text()) };
  } catch {
    return empty();
  }
}

export const loadDatos = read;

// Lee la última versión antes de guardar, para no pisar cambios hechos desde otro dispositivo.
export async function updateDatos(rootId: string, change: (d: Datos) => void) {
  const d = await read(rootId);
  change(d);
  if (DEMO) return;
  const text = JSON.stringify(d, null, 1);
  if (fileId) await saveContent(fileId, new Blob([text], { type: 'application/json' }));
  else fileId = (await createTextFile('Mochi - fechas.json', rootId, text, 'application/json', { facu: 'datos' })).id;
}

export function toISO(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function daysUntil(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / 86_400_000);
}

export function whenLabel(iso: string) {
  const n = daysUntil(iso);
  if (n === 0) return '¡Hoy!';
  if (n === 1) return 'Mañana';
  return `En ${n} días`;
}

export function dateLabel(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
  return `${weekday} ${d}/${m}`;
}
