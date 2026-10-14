import { useEffect, useState } from 'react';
import { Folder as FolderIcon } from '../components/icons';
import UploadSheet from '../components/UploadSheet';
import { Button, Spinner, errorText, useToast } from '../components/ui';
import { useFacu } from '../lib/context';
import { COLORS, addMateria } from '../lib/facu';
import { fmtSize } from '../lib/files';
import { go } from '../lib/router';
import { sharedDownload, sharedFiles, sharedInfo, type SharedEntry, type SharedInfo } from '../lib/shared';
import type { UploadItem } from '../lib/upload';

const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

// Lo que ve un compañero al abrir un link de "Compartir": elige dónde guardarlo y se copia a su Drive.
export default function ImportScreen({ id }: { id: string }) {
  const { tree, reload } = useFacu();
  const toast = useToast();
  const [info, setInfo] = useState<SharedInfo | null>(null);
  const [entries, setEntries] = useState<SharedEntry[] | null>(null);
  const [error, setError] = useState('');
  const [dest, setDest] = useState('');
  const [importing, setImporting] = useState<{ parentId: string; destName: string; materiaId: string; items: UploadItem[] } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const i = await sharedInfo(id);
        if (!alive) return;
        setInfo(i);
        const e = await sharedFiles(id);
        if (!alive) return;
        setEntries(e);
        // Si ya tenés una materia con el mismo nombre, se propone guardarlo ahí.
        const same = [...tree.materias.values()].find((m) => norm(m.name) === norm(i.name));
        const cursando = [...tree.materias.values()].find((m) => m.estado === 'cursando');
        setDest(same ? `m:${same.id}` : cursando ? `m:${cursando.id}` : tree.years[0] ? `y:${tree.years[0].id}` : '');
      } catch (e) {
        if (alive) setError(errorText(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, tree]);

  const total = entries?.reduce((s, e) => s + Number(e.file.size ?? 0), 0) ?? 0;
  const folders = new Set(entries?.map((e) => e.dirs.join('/')).filter(Boolean)).size;

  async function start() {
    if (!info || !entries || !dest) return;
    setBusy(true);
    try {
      const [kind, targetId] = dest.split(':');
      let materiaId: string;
      let prefix: string[] = [];
      if (kind === 'y') {
        // Materia nueva con el nombre de lo compartido.
        const year = tree.years.find((y) => y.id === targetId)!;
        materiaId = (await addMateria(year, info.name, COLORS[tree.materias.size % COLORS.length])).id;
      } else {
        materiaId = targetId;
        const m = tree.materias.get(targetId)!;
        // Si la materia se llama igual que lo compartido, va directo adentro; si no, en una carpeta nueva.
        if (norm(m.name) !== norm(info.name)) prefix = [info.name];
      }
      const items: UploadItem[] = entries.map((e) => ({
        dirs: [...prefix, ...e.dirs],
        file: {
          name: e.file.name,
          size: Number(e.file.size ?? 0),
          load: async () => new File([await sharedDownload(e.file.id)], e.file.name, { type: e.file.mimeType }),
        },
      }));
      const destName = kind === 'y' ? info.name : tree.materias.get(materiaId)!.name;
      setImporting({ parentId: materiaId, destName, materiaId, items });
    } catch (e) {
      toast(errorText(e));
      setBusy(false);
    }
  }

  if (tree.years.length === 0)
    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-16 text-center safe-top">
        <p className="font-bold text-lg">Te compartieron apuntes</p>
        <p className="text-muted mt-2">Antes de guardarlos, armá tus años de la carrera. Después volvés acá solo.</p>
        <Button
          variant="primary"
          className="mt-6"
          onClick={() => {
            try {
              localStorage.setItem('mochi:importar', location.hash);
            } catch {}
            go('/');
          }}
        >
          Armar mis años
        </Button>
      </div>
    );

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-10 safe-top">
      {error ? (
        <div className="text-center py-10">
          <p className="font-bold text-lg">No pudimos abrir lo que te compartieron</p>
          <p className="text-muted mt-2">{error}</p>
          <Button className="mt-6" onClick={() => go('/')}>
            Ir al inicio
          </Button>
        </div>
      ) : !info || !entries ? (
        <div className="py-16 flex flex-col items-center gap-3 text-muted">
          <Spinner />
          {info ? `Leyendo ${info.name}…` : 'Abriendo…'}
        </div>
      ) : (
        <>
          <p className="text-sm font-semibold text-accent">{info.owner ? `${info.owner} te compartió` : 'Te compartieron'}</p>
          <div className="flex items-center gap-4 mt-3">
            <span className="size-16 rounded-2xl bg-accent-soft text-accent grid place-items-center shrink-0">
              <FolderIcon width={30} height={30} />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{info.name}</h1>
              <p className="text-muted mt-0.5">
                {entries.length} {entries.length === 1 ? 'archivo' : 'archivos'}
                {folders > 0 && ` en ${folders} ${folders === 1 ? 'carpeta' : 'carpetas'}`} · {fmtSize(String(total))}
              </p>
            </div>
          </div>

          {entries.length === 0 ? (
            <p className="text-muted mt-8">Esta carpeta está vacía.</p>
          ) : (
            <>
              <label className="font-semibold block mt-8 mb-2">¿Dónde lo guardo?</label>
              <select
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                className="w-full h-12 px-3 rounded-xl bg-surface border border-line outline-none text-base"
              >
                {tree.years.map((y) => (
                  <optgroup key={y.id} label={y.name}>
                    {y.materias.map((m) => (
                      <option key={m.id} value={`m:${m.id}`}>
                        {m.name}
                      </option>
                    ))}
                    <option value={`y:${y.id}`}>+ Crear la materia “{info.name}” en {y.name}</option>
                  </optgroup>
                ))}
              </select>
              <p className="text-sm text-muted mt-2">
                Se copia a tu Google Drive: queda tuyo y lo podés ordenar como quieras. Lo de {info.owner ?? 'tu compañero'} no
                cambia.
              </p>
              <Button variant="primary" className="w-full mt-6 h-12" disabled={busy || !dest} onClick={start}>
                {busy ? 'Preparando…' : 'Agregar a mi Mochi'}
              </Button>
            </>
          )}
          <Button variant="ghost" className="w-full mt-2" onClick={() => go('/')}>
            Ahora no
          </Button>
        </>
      )}

      {importing && (
        <UploadSheet
          items={importing.items}
          parentId={importing.parentId}
          destName={importing.destName}
          onClose={async () => {
            await reload();
            setImporting(null);
            setBusy(false);
          }}
          onDone={async (n) => {
            toast(`Listo: ${n} archivos agregados a ${importing.destName}`);
            await reload();
            go(`/m/${importing.materiaId}`);
          }}
        />
      )}
    </div>
  );
}
