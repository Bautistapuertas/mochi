// Plan de estudios 2023 de Ingeniería en Sistemas de Información (UTN FRLP), con sus correlativas.
//   cursar: las que tenés que tener regularizadas (cursadas) para poder cursarla.
//   aprobar: las que tenés que tener aprobadas (con final) para poder cursarla.
// Las horas son las anuales del plan; se usan para el porcentaje de la carrera.

import type { Estado, Materia, Tree } from './facu';

export type PlanItem = {
  code: string;
  name: string;
  nivel: number;
  horas: number;
  cursar: string[];
  aprobar: string[];
  electiva?: boolean;
  // Otros nombres con los que puede estar tu carpeta.
  alias?: string[];
};

const m = (code: string, nivel: number, name: string, horas: number, cursar = '', aprobar = '', alias?: string[]): PlanItem => ({
  code,
  name,
  nivel,
  horas,
  cursar: cursar ? cursar.split('-') : [],
  aprobar: aprobar ? aprobar.split('-') : [],
  alias,
});
const e = (code: string, nivel: number, name: string, horas: number, cursar = '', aprobar = '', alias?: string[]): PlanItem => ({
  ...m(code, nivel, name, horas, cursar, aprobar, alias),
  electiva: true,
});

export const CARRERA = 'Ingeniería en Sistemas de Información';
export const PLAN_NOMBRE = 'UTN FRLP · Plan 2023';

export const PLAN: PlanItem[] = [
  m('1', 1, 'Análisis Matemático I', 5, '', '', ['am1', 'analisis 1']),
  m('2', 1, 'Álgebra y Geometría Analítica', 5, '', '', ['algebra', 'aga']),
  m('3', 1, 'Física I', 5, '', '', ['fisica 1']),
  m('4', 1, 'Inglés I', 2, '', '', ['ingles 1']),
  m('5', 1, 'Lógica y Estructuras Discretas', 3, '', '', ['matematica discreta', 'discreta']),
  m('6', 1, 'Algoritmos y Estructuras de Datos', 5, '', '', ['algoritmos', 'aed']),
  m('7', 1, 'Arquitectura de Computadoras', 4, '', '', ['arquitecturas de computadoras', 'arquitectura']),
  m('8', 1, 'Sistemas y Procesos de Negocio', 3, '', '', ['sistemas y organizaciones', 'spn']),
  m('9', 2, 'Análisis Matemático II', 5, '1-2', '', ['am2', 'analisis 2']),
  m('10', 2, 'Física II', 5, '1-3', '', ['fisica 2']),
  m('11', 2, 'Ingeniería y Sociedad', 2),
  m('12', 2, 'Inglés II', 2, '4', '', ['ingles 2']),
  m('13', 2, 'Sintaxis y Semántica del Lenguaje', 4, '5-6', '', ['sintaxis', 'ssl']),
  m('14', 2, 'Paradigmas de Programación', 4, '5-6', '', ['paradigmas', 'pdp']),
  m('15', 2, 'Sistemas Operativos', 4, '7', '', ['so']),
  m('16', 2, 'Análisis de Sistemas de Información', 6, '6-8', '', ['analisis de sistemas', 'asi']),
  m('17', 3, 'Probabilidades y Estadística', 3, '1-2', '', ['probabilidad y estadistica', 'estadistica']),
  m('18', 3, 'Economía', 3, '', '1-2'),
  m('19', 3, 'Bases de Datos', 4, '13-16', '5-6', ['base de datos', 'bdd']),
  m('20', 3, 'Desarrollo de Software', 4, '14-16', '5-6', ['dds']),
  m('21', 3, 'Comunicación de Datos', 4, '', '3-7', ['comunicaciones de datos']),
  m('22', 3, 'Análisis Numérico', 3, '9', '1-2', ['calculo numerico']),
  m('23', 3, 'Diseño de Sistemas de Información', 6, '14-16', '4-6-8', ['diseno de sistemas', 'dsi']),
  m('24', 4, 'Legislación', 2, '11'),
  m('25', 4, 'Ingeniería y Calidad de Software', 3, '19-20-23', '13-14', ['ingenieria de software', 'calidad de software']),
  m('26', 4, 'Redes de Datos', 4, '15-21', '', ['redes']),
  m('27', 4, 'Investigación Operativa', 4, '17-22', '', ['io']),
  m('28', 4, 'Simulación', 3, '17', '9'),
  m('29', 4, 'Tecnologías para la Automatización', 3, '10-22', '9', ['automatizacion']),
  m('30', 4, 'Administración de Sistemas de Información', 6, '18-23', '16', ['administracion de sistemas']),
  m('31', 5, 'Inteligencia Artificial', 3, '28', '17-22', ['ia']),
  m('32', 5, 'Ciencia de Datos', 3, '28', '17-19'),
  m('33', 5, 'Sistemas de Gestión', 4, '18-27', '23'),
  m('34', 5, 'Gestión Gerencial', 3, '24-30', '18'),
  m('35', 5, 'Seguridad en los Sistemas de Información', 3, '26-30', '20-21', ['seguridad']),
  m('36', 5, 'Proyecto Final', 6, '25-26-30', '12-20-23'),
  e('E1', 3, 'Programación Concurrente', 2, '14-15'),
  e('E2', 3, 'Sistemas de Tiempo Real', 3, '15', '7'),
  e('E3', 3, 'Tecnología y Gestión Web', 2, '13-15', '6', ['tec y gestion web', 'tecnologias y gestion web']),
  e('E4', 3, 'Sistemas de Transmisión y Redes Inalámbricas', 2, '9', '7'),
  e('E5', 3, 'Responsabilidad Social e Institucional', 2, '8-16'),
  e('E6', 3, 'Comunicación Profesional', 3, '11', '8'),
  e('E7', 4, 'Administración de Base de Datos', 2, '19', '15', ['administracion de bases de datos']),
  e('E8', 4, 'Desarrollo de Software Cloud', 2, '15-20-23', '13-14'),
  e('E9', 4, 'Diseño Inclusivo para Usuarios con Discapacidad', 2, '23', '16', ['diseno inclusivo']),
  e('E10', 4, 'Metodología de la Investigación', 2, '', '23'),
  e('E11', 4, 'Metodologías Ágiles', 3, '19-20-23', '16'),
  e('E12', 4, 'Tecnología de Interfaces Interactivas', 2, '23', '16'),
  e('E13', 4, 'Tecnologías para la Explotación de la Información', 2, '17-23', '14'),
  e('E14', 4, 'Aplicaciones Móviles', 3, '14-23', '6'),
  e('E15', 5, 'Ingeniería en Calidad', 3, '30', '23'),
  e('E16', 5, 'Internetworking', 4, '30', '26'),
  e('E17', 5, 'Protocolos y Seguridad en Redes Inalámbricas', 2, '21-26', '9-10'),
  e('E18', 5, 'Sistemas en la Industria 4.0', 3, '19-21-25-26', '7'),
  e('E19', 5, 'Tecnologías de Información para la Gestión Empresarial', 2, '25', '23'),
  e('E20', 5, 'Emprendedorismo', 2, '18-24'),
];

// Horas de electivas que pide el plan en cada nivel. No hay que hacerlas todas: alcanza con sumar esas horas
// (en 3º, 4 hs = dos electivas de 2 hs).
export const ELECTIVAS_NIVEL: Record<number, number> = { 3: 4, 4: 6, 5: 10 };
export const ELECTIVAS_HORAS = 20;
export const PPS = 'PPS';
// La Práctica Profesional Supervisada (200 hs reloj) pesa en el porcentaje como una materia anual.
const PPS_PESO = 5;

export const NIVELES = ['Primer nivel', 'Segundo nivel', 'Tercer nivel', 'Cuarto nivel', 'Quinto nivel'];

// Lo que marcaste en la pantalla Carrera para materias que no tienen carpeta en Mochi.
export type PlanMark = { estado: Estado; nota?: number };

const STOP = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'para', 'con', 'a']);
export function normName(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\btec\b\.?/g, 'tecnologia')
    .replace(/\bing\b\.?/g, 'ingenieria')
    .replace(/\biii\b/g, '3')
    .replace(/\bii\b/g, '2')
    .replace(/\bi\b/g, '1')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !STOP.has(w))
    .join(' ');
}

const KEYS = new Map<string, string>();
for (const p of PLAN) for (const n of [p.name, ...(p.alias ?? [])]) KEYS.set(normName(n), p.code);

// A qué materia del plan corresponde una carpeta de Mochi (por el nombre).
export function planCodeOf(name: string) {
  return KEYS.get(normName(name));
}

export type PlanState = 'aprobada' | 'final' | 'cursando' | null;
export type PlanRow = PlanItem & { state: PlanState; nota?: number; materia?: Materia };

// El estado de cada materia del plan: lo de tus carpetas manda; si no hay carpeta, lo que marcaste acá.
export function planRows(tree: Tree): PlanRow[] {
  const linked = new Map<string, Materia>();
  for (const mt of tree.materias.values()) {
    const c = planCodeOf(mt.name);
    // Si hay dos carpetas para la misma materia, gana la que tenga estado.
    if (c && (!linked.has(c) || (!linked.get(c)!.estado && mt.estado))) linked.set(c, mt);
  }
  return PLAN.map((p) => {
    const mt = linked.get(p.code);
    const mark = tree.plan[p.code];
    if (mt?.estado) return { ...p, materia: mt, state: mt.estado, nota: mt.nota };
    return { ...p, materia: mt, state: mark?.estado ?? null, nota: mark?.nota };
  });
}

export const done = (s: PlanState) => s === 'aprobada';
export const regular = (s: PlanState) => s === 'aprobada' || s === 'final';

// Qué le falta para poder cursarla. Vacío = la podés cursar.
export function missing(row: PlanRow, byCode: Map<string, PlanRow>) {
  const out: { row: PlanRow; need: 'regular' | 'aprobada' }[] = [];
  for (const c of row.cursar) {
    const r = byCode.get(c)!;
    if (!regular(r.state)) out.push({ row: r, need: 'regular' });
  }
  for (const c of row.aprobar) {
    const r = byCode.get(c)!;
    if (!done(r.state)) out.push({ row: r, need: 'aprobada' });
  }
  return out;
}

// Porcentaje de la carrera según la carga horaria aprobada.
export function progress(tree: Tree) {
  const rows = planRows(tree);
  const obligatorias = rows.filter((r) => !r.electiva);
  const electivas = rows.filter((r) => r.electiva);
  const total = obligatorias.reduce((a, r) => a + r.horas, 0) + ELECTIVAS_HORAS + PPS_PESO;
  const porNivel = Object.entries(ELECTIVAS_NIVEL).map(([n, pide]) => {
    const hechas = electivas.filter((r) => r.nivel === Number(n) && done(r.state)).reduce((a, r) => a + r.horas, 0);
    return { nivel: Number(n), pide, hechas, completo: hechas >= pide };
  });
  // Cada nivel suma como mucho lo que pide: hacer electivas de más no adelanta la carrera.
  const horasElectivas = porNivel.reduce((a, x) => a + Math.min(x.pide, x.hechas), 0);
  const pps = tree.plan[PPS]?.estado === 'aprobada';
  const hechas = obligatorias.filter((r) => done(r.state)).reduce((a, r) => a + r.horas, 0) + horasElectivas + (pps ? PPS_PESO : 0);
  return {
    rows,
    porcentaje: Math.floor((hechas / total) * 100),
    aprobadas: obligatorias.filter((r) => done(r.state)).length,
    regulares: obligatorias.filter((r) => r.state === 'final').length,
    obligatorias: obligatorias.length,
    horasElectivas,
    electivasPorNivel: porNivel,
    pps,
  };
}
