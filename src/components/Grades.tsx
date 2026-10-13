import { useState } from 'react';
import { useFacu } from '../lib/context';
import { fmtNota, updateDatos, type Grade } from '../lib/datos';
import { setAprobada, type Materia } from '../lib/facu';
import { Plus } from './icons';
import { Button, Modal, errorText, useToast } from './ui';

const SUGGESTIONS = ['Parcial 1', 'Parcial 2', 'Recuperatorio', 'TP', 'Final'];

// Acepta "7,5" o "7.5"; devuelve null si no es una nota válida.
function parseNota(s: string) {
  const n = Number(s.trim().replace(',', '.'));
  return s.trim() && Number.isFinite(n) && n >= 0 && n <= 10 ? n : null;
}

function NotaInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Ej: 8 o 7,5"
      className="w-full h-12 px-4 rounded-xl bg-sunken border border-transparent focus:border-accent outline-none text-base"
    />
  );
}

// Nota de un parcial, TP, etc.
function GradeModal({ grade, materiaId, onClose }: { grade?: Grade; materiaId: string; onClose: () => void }) {
  const { tree, reload } = useFacu();
  const [title, setTitle] = useState(grade?.title ?? '');
  const [nota, setNota] = useState(grade ? fmtNota(grade.nota) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(remove = false) {
    const n = parseNota(nota);
    if (!remove && (!title.trim() || n === null)) return setError('Completá qué fue y una nota del 0 al 10.');
    setBusy(true);
    setError('');
    try {
      await updateDatos(tree.rootId, (d) => {
        d.grades = (d.grades ?? []).filter((g) => g.id !== grade?.id);
        if (!remove) d.grades.push({ id: grade?.id ?? crypto.randomUUID(), materiaId, title: title.trim(), nota: n! });
      });
      await reload();
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <Modal title={grade ? 'Editar nota' : 'Nueva nota'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="font-semibold block mb-2">¿De qué?</label>
        <div className="flex gap-2 flex-wrap mb-2">
          {SUGGESTIONS.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setTitle(s)}
              className={`h-9 px-3 rounded-full text-sm font-semibold border transition ${
                title === s ? 'bg-accent-soft border-accent' : 'border-line hover:bg-sunken'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="O escribilo: TP 2, Coloquio…"
          className="w-full h-12 px-4 rounded-xl bg-sunken border border-transparent focus:border-accent outline-none text-base mb-4"
        />
        <label className="font-semibold block mb-2">Nota</label>
        <NotaInput value={nota} onChange={setNota} />
        {error && <p className="text-danger mt-3 text-[15px]">{error}</p>}
        <div className="flex gap-3 mt-5">
          {grade && (
            <Button type="button" variant="ghost" className="text-danger" disabled={busy} onClick={() => save(true)}>
              Borrar
            </Button>
          )}
          <Button variant="primary" className="flex-1" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar nota'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Chips con las notas de una materia.
export function MateriaGrades({ materiaId }: { materiaId: string }) {
  const { tree } = useFacu();
  const [editing, setEditing] = useState<Grade | 'new' | null>(null);
  const grades = tree.grades.filter((g) => g.materiaId === materiaId);
  return (
    <div className="flex gap-2 flex-wrap mb-5 -mt-2">
      {grades.map((g) => (
        <button
          key={g.id}
          onClick={() => setEditing(g)}
          className="h-9 px-3 rounded-full bg-sunken text-sm font-semibold flex items-center gap-1.5 hover:brightness-95"
        >
          {g.title}: <span className="font-extrabold">{fmtNota(g.nota)}</span>
        </button>
      ))}
      <button
        onClick={() => setEditing('new')}
        className="h-9 px-3 rounded-full border border-dashed border-line text-sm font-semibold text-muted flex items-center gap-1 hover:text-ink hover:border-muted"
      >
        <Plus width={16} height={16} /> Nota
      </button>
      {editing && <GradeModal grade={editing === 'new' ? undefined : editing} materiaId={materiaId} onClose={() => setEditing(null)} />}
    </div>
  );
}

// Marcar como aprobada (o cambiar la nota final).
export function ApproveModal({ materia, onClose }: { materia: Materia; onClose: () => void }) {
  const { reload } = useFacu();
  const toast = useToast();
  const [nota, setNota] = useState(materia.nota !== undefined ? fmtNota(materia.nota) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editing = materia.aprobada;

  async function save(withNota: boolean) {
    const n = parseNota(nota);
    if (withNota && n === null) return setError('Poné una nota del 0 al 10, o tocá "Sin nota".');
    setBusy(true);
    try {
      await setAprobada(materia, true, withNota ? n! : undefined);
      await reload();
      if (!editing) toast(`¡Felicitaciones! Aprobaste ${materia.name}`);
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <Modal title={editing ? 'Nota final' : `¿Aprobaste ${materia.name}?`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(true);
        }}
      >
        <label className="font-semibold block mb-2">¿Con qué nota?</label>
        <NotaInput value={nota} onChange={setNota} />
        <p className="text-sm text-muted mt-2">Se usa para calcular tu promedio.</p>
        {error && <p className="text-danger mt-3 text-[15px]">{error}</p>}
        <div className="flex gap-3 mt-5">
          <Button type="button" className="flex-1" disabled={busy} onClick={() => save(false)}>
            Sin nota
          </Button>
          <Button variant="primary" className="flex-1" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
