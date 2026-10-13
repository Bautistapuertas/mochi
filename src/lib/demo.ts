// Datos falsos para revisar la interfaz en desarrollo: http://localhost:5173/?demo
// No se incluye en la versión publicada.
import type { DFile } from './drive';

const F = 'application/vnd.google-apps.folder';
const now = new Date().toISOString();
const folder = (id: string, name: string, parent: string, appProperties: Record<string, string>): DFile => ({
  id, name, mimeType: F, modifiedTime: now, parents: [parent], appProperties,
});

const temas = ['Introducción', 'Requerimientos', 'UML', 'Patrones de Diseño', 'Arquitectura', 'Bases de Datos', 'APIs REST',
  'Persistencia de Datos (2)', 'Relaciones y Validaciones', 'Seguridad en Aplicaciones Web', 'Integración Front - Back', 'Introducción al Testing'];

export const demoFolders: DFile[] = [
  folder('root', 'Facultad', 'x', { facu: 'root' }),
  folder('y3', '3er año', 'root', { facu: 'year', order: '3' }),
  folder('m1', 'Desarrollo de Software', 'y3', { facu: 'materia', color: '#4c6ef5' }),
  folder('m2', 'Análisis Matemático II', 'y3', { facu: 'materia', color: '#12b886', estado: 'aprobada', nota: '8.5' }),
  folder('m3', 'Sistemas Operativos', 'y3', { facu: 'materia', color: '#f59f00' }),
  folder('c-teo', 'Presentaciones dadas en clase', 'm1', { facu: 'cat', cat: 'teoria' }),
  folder('c-par', 'Promoción', 'm1', { facu: 'cat', cat: 'parciales' }),
  folder('c-bib', 'Bibliografía', 'm1', {}),
  folder('c-tp', 'Trabajos prácticos', 'm1', { facu: 'folder' }),
  folder('c-tp1', 'TP1', 'c-tp', { facu: 'folder' }),
  folder('c-tp2', 'TP2', 'c-tp', { facu: 'folder' }),
  folder('c-ent', 'Entrega', 'm1', { facu: 'folder' }),
];

export const demoFiles: DFile[] = [
  ...temas.map((t, i) => ({
    id: `f${i}`, name: `UTN DS26 - C${i + 1} - ${t}.pdf`, mimeType: 'application/pdf',
    modifiedTime: new Date(Date.now() - i * 86_400_000).toISOString(), size: '450000', parents: ['c-teo'],
  })),
  { id: 'p1', name: 'Parcial 1 2025.pdf', mimeType: 'application/pdf', modifiedTime: now, parents: ['c-par'] },
  { id: 'p2', name: 'Final resuelto.docx', mimeType: 'application/octet-stream', modifiedTime: now, parents: ['c-par'] },
  { id: 'p3', name: 'Foto pizarrón.jpg', mimeType: 'image/jpeg', modifiedTime: now, parents: ['c-par'] },
  { id: 't1', name: 'Consigna TP1.pdf', mimeType: 'application/pdf', modifiedTime: now, parents: ['c-tp1'] },
  { id: 't2', name: 'Modelo ER.excalidraw', mimeType: 'application/json', modifiedTime: now, parents: ['c-tp1'] },
  { id: 't3', name: 'Consigna TP2.pdf', mimeType: 'application/pdf', modifiedTime: now, parents: ['c-tp2'] },
  { id: 't4', name: 'Rúbrica de TPs.xlsx', mimeType: 'application/octet-stream', modifiedTime: now, parents: ['c-tp'] },
  { id: 's1', name: 'Programa de la materia.pdf', mimeType: 'application/pdf', modifiedTime: now, parents: ['m1'] },
];

export function demoList(q: string): DFile[] {
  if (q.includes(`mimeType='${F}'`)) return demoFolders;
  const ids = [...q.matchAll(/'([^']+)' in parents/g)].map((m) => m[1]);
  const files = ids.length ? demoFiles.filter((f) => f.parents!.some((p) => ids.includes(p))) : demoFiles;
  return files;
}
