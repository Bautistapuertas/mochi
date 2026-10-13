import { useEffect, useRef, useState } from 'react';
import FileRow from '../components/FileRow';
import { Check, Folder as FolderIcon, Plus, SearchIcon, Pencil, Trash } from '../components/icons';
import { UpcomingExams } from '../components/Exams';
import UploadSheet from '../components/UploadSheet';
import { itemsFromDrop, itemsFromInput, summarize, type UploadItem } from '../lib/upload';
import UserMenu from '../components/UserMenu';
import { Button, ConfirmModal, Menu, Modal, PromptModal, Spinner, errorText, useToast } from '../components/ui';
import { CHANGED, useFacu } from '../lib/context';
import {
  COLORS,
  YEAR_NAMES,
  addMateria,
  addYear,
  nextYearName,
  recentFiles,
  renameFolder,
  trashFolder,
  type FileItem,
  type Year,
} from '../lib/facu';
import { go } from '../lib/router';

export default function Home() {
  const { tree, reload, user } = useFacu();
  const toast = useToast();
  const [recent, setRecent] = useState<FileItem[]>([]);
  const [adding, setAdding] = useState<{ year: Year; prefill?: Group } | null>(null);
  const [bulk, setBulk] = useState<{ year: Year; groups: Group[] } | null>(null);
  const [renaming, setRenaming] = useState<Year | null>(null);
  const [deleting, setDeleting] = useState<Year | null>(null);
  const [busy, setBusy] = useState(false);
  const [dropYear, setDropYear] = useState<string | null>(null);

  // Al soltar carpetas sobre un año, cada carpeta de primer nivel se convierte en una materia.
  function importGroups(year: Year, items: UploadItem[]) {
    const groups = groupByFolder(items);
    if (!groups.length) return toast('Soltá carpetas (no archivos sueltos) para crear materias.');
    if (groups.length === 1) setAdding({ year, prefill: groups[0] });
    else setBulk({ year, groups });
  }

  useEffect(() => {
    const load = () => recentFiles(tree).then(setRecent).catch(() => {});
    load();
    addEventListener(CHANGED, load);
    return () => removeEventListener(CHANGED, load);
  }, [tree]);

  if (tree.years.length === 0) return <Onboarding />;

  const firstName = user?.name.split(' ')[0];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 safe-top">
      <header className="flex items-center justify-between pt-5 pb-4">
        <div>
          <p className="text-muted text-sm font-medium">Hola{firstName ? `, ${firstName}` : ''} 👋</p>
          <h1 className="text-2xl font-extrabold tracking-tight">Tus materias</h1>
        </div>
        <UserMenu />
      </header>

      <button
        onClick={() => go('/buscar')}
        className="w-full flex items-center gap-3 h-12 px-4 rounded-2xl bg-surface border border-line text-muted text-[15px] hover:border-accent transition"
      >
        <SearchIcon />
        Buscar en todos tus apuntes…
      </button>

      <UpcomingExams />

      {tree.years.map((y) => (
        <section
          key={y.id}
          className={`mt-8 rounded-3xl transition ${dropYear === y.id ? 'outline-4 outline-dashed outline-accent outline-offset-8 bg-accent-soft/40' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDropYear(y.id);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropYear(null);
          }}
          onDrop={async (e) => {
            e.preventDefault();
            setDropYear(null);
            importGroups(y, await itemsFromDrop(e.dataTransfer));
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">
              {y.name}
              {dropYear === y.id && <span className="text-accent font-semibold text-base"> · Soltá para crear las materias acá</span>}
            </h2>
            <Menu
              label={`Opciones de ${y.name}`}
              items={[
                { label: 'Cambiar nombre', icon: <Pencil />, onClick: () => setRenaming(y) },
                { label: 'Eliminar año', icon: <Trash />, danger: true, onClick: () => setDeleting(y) },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {y.materias.filter((m) => !m.aprobada).map((m) => (
              <button
                key={m.id}
                onClick={() => go(`/m/${m.id}`)}
                className="group relative text-left bg-surface border border-line rounded-2xl p-4 min-h-28 flex flex-col justify-between overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition"
              >
                <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: m.color }} />
                <span
                  className="size-9 rounded-xl grid place-items-center font-extrabold text-white"
                  style={{ background: m.color }}
                >
                  {m.name.charAt(0).toUpperCase()}
                </span>
                <span className="font-semibold leading-snug mt-3 line-clamp-2">{m.name}</span>
              </button>
            ))}
            <button
              onClick={() => setAdding({ year: y })}
              className="rounded-2xl border-2 border-dashed border-line min-h-28 flex flex-col items-center justify-center gap-1 text-muted font-semibold hover:border-accent hover:text-accent transition"
            >
              <Plus />
              Agregar materia
            </button>
          </div>
        </section>
      ))}

      <Button
        className="mt-8"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await addYear(tree);
            await reload();
          } catch (e) {
            toast(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Plus /> Agregar {nextYearName(tree)}
      </Button>

      <Approved />

      {recent.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold mb-2">Lo último que subiste</h2>
          <div className="bg-surface border border-line rounded-3xl p-1.5">
            {recent.map((f) => (
              <FileRow key={f.id} file={f} showWhere />
            ))}
          </div>
        </section>
      )}

      {adding && (
        <NewMateria
          key={adding.prefill?.name ?? 'nueva'}
          year={adding.year}
          prefill={adding.prefill}
          onClose={() => setAdding(null)}
        />
      )}
      {bulk && <BulkImport year={bulk.year} groups={bulk.groups} onClose={() => setBulk(null)} />}
      {renaming && (
        <PromptModal
          title="Nombre del año"
          initial={renaming.name}
          onClose={() => setRenaming(null)}
          onSubmit={async (name) => {
            await renameFolder(renaming.id, name);
            await reload();
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title={`¿Eliminar ${deleting.name}?`}
          text={
            deleting.materias.length
              ? `Se van a la papelera de Google Drive ${deleting.materias.length} materia(s) con todos sus archivos. Podés recuperarlos desde ahí durante 30 días.`
              : 'Se va a la papelera de Google Drive.'
          }
          action="Eliminar"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await trashFolder(deleting.id);
            await reload();
            toast('Listo. Está en la papelera de Drive por 30 días.');
          }}
        />
      )}
    </div>
  );
}

// Materias aprobadas, plegadas al final para que el inicio muestre solo lo que se cursa.
function Approved() {
  const { tree } = useFacu();
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem('facu:aprobadas') === '1';
    } catch {
      return false;
    }
  });
  const list = tree.years.flatMap((y) => y.materias.filter((m) => m.aprobada).map((m) => ({ m, y })));
  if (!list.length) return null;
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem('facu:aprobadas', open ? '0' : '1');
    } catch {}
  };
  return (
    <section className="mt-10">
      <button onClick={toggle} className="flex items-center gap-2 text-lg font-bold" aria-expanded={open}>
        <span className={`transition ${open ? 'rotate-90' : ''}`}>›</span>
        Aprobadas
        <span className="text-sm font-semibold text-muted bg-sunken rounded-full px-2 py-0.5">{list.length}</span>
      </button>
      {open && (
        <div className="flex gap-2 flex-wrap mt-3">
          {list.map(({ m, y }) => (
            <button
              key={m.id}
              onClick={() => go(`/m/${m.id}`)}
              className="h-11 pl-2 pr-4 rounded-full bg-surface border border-line flex items-center gap-2 text-[15px] font-semibold hover:bg-sunken"
            >
              <span className="size-7 rounded-full grid place-items-center text-white" style={{ background: m.color }}>
                <Check width={16} height={16} />
              </span>
              {m.name}
              <span className="text-xs text-muted font-medium">{y.name}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

type Group = { name: string; items: UploadItem[] };

// Agrupa lo elegido por carpeta de primer nivel; lo de adentro queda relativo a esa carpeta.
function groupByFolder(items: UploadItem[]): Group[] {
  const groups = new Map<string, UploadItem[]>();
  for (const it of items) {
    const top = it.dirs[0];
    if (!top) continue;
    groups.set(top, [...(groups.get(top) ?? []), { ...it, dirs: it.dirs.slice(1) }]);
  }
  return [...groups].map(([name, items]) => ({ name, items }));
}

function NewMateria({ year, prefill, onClose }: { year: Year; prefill?: Group; onClose: () => void }) {
  const { tree, reload } = useFacu();
  const toast = useToast();
  const used = tree.materias.size;
  const [name, setName] = useState(prefill?.name ?? '');
  const [color, setColor] = useState(COLORS[used % COLORS.length]);
  const [busy, setBusy] = useState(false);
  // Contenido de una carpeta de la compu para importar como materia.
  const [items, setItems] = useState<UploadItem[] | null>(prefill?.items ?? null);
  const [uploading, setUploading] = useState<{ id: string; name: string } | null>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '');
  }, []);

  if (uploading && items)
    return (
      <UploadSheet
        items={items}
        parentId={uploading.id}
        destName={uploading.name}
        onClose={async () => {
          await reload();
          onClose();
        }}
        onDone={async (n) => {
          toast(`${uploading.name}: ${n} archivos importados`);
          await reload();
          onClose();
          go(`/m/${uploading.id}`);
        }}
      />
    );

  const info = items ? summarize(items) : null;

  return (
    <Modal title={`Nueva materia · ${year.name}`} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setBusy(true);
          try {
            const f = await addMateria(year, name, color);
            if (items?.length) return setUploading({ id: f.id, name: f.name });
            await reload();
            onClose();
          } catch (err) {
            toast(errorText(err));
            setBusy(false);
          }
        }}
      >
        <input
          ref={folderInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const all = e.target.files ? itemsFromInput(e.target.files) : [];
            e.target.value = '';
            // La carpeta elegida pasa a ser la materia; lo de adentro, sus carpetas.
            const g = groupByFolder(all)[0];
            if (!g) return;
            setName(g.name);
            setItems(g.items);
          }}
        />
        {info ? (
          <div className="flex items-center gap-3 rounded-2xl bg-accent-soft px-4 py-3 mb-4">
            <FolderIcon className="text-accent shrink-0" />
            <p className="text-[15px] flex-1">
              Se van a importar <b>{info.files} archivos</b>
              {info.folders > 0 && ` en ${info.folders} carpetas`}.
            </p>
            <button type="button" onClick={() => setItems(null)} className="text-sm font-semibold text-muted hover:text-ink">
              Quitar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => folderInput.current?.click()}
            className="w-full flex items-center gap-3 rounded-2xl border-2 border-dashed border-line px-4 py-3 mb-4 text-left hover:border-accent transition"
          >
            <FolderIcon className="text-accent shrink-0" />
            <span>
              <span className="font-semibold block">Importar una carpeta de la compu</span>
              <span className="text-sm text-muted">Se crea la materia con todas sus carpetas y archivos</span>
            </span>
          </button>
        )}
        <p className="text-sm text-muted mb-2">{info ? 'Nombre de la materia' : 'O creala vacía con este nombre:'}</p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Análisis Matemático I"
          className="w-full h-12 px-4 rounded-xl bg-sunken border border-transparent focus:border-accent outline-none text-base"
        />
        <p className="text-sm text-muted mt-4 mb-2">Color</p>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              className={`size-9 rounded-full transition ${color === c ? 'ring-2 ring-offset-2 ring-offset-surface ring-ink' : ''}`}
              style={{ background: c }}
            />
          ))}
        </div>
        <Button variant="primary" className="w-full mt-5" disabled={busy || !name.trim()}>
          {busy ? 'Creando…' : info ? 'Crear e importar' : 'Crear materia'}
        </Button>
      </form>
    </Modal>
  );
}

// Varias carpetas soltadas a la vez: crea una materia por carpeta y las sube una atrás de otra.
function BulkImport({ year, groups, onClose }: { year: Year; groups: Group[]; onClose: () => void }) {
  const { tree, reload } = useFacu();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState('');
  // Guarda la promesa (no el resultado) para no crear la misma materia dos veces.
  const created = useRef(new Map<number, Promise<{ id: string; name: string }>>());
  const baseColor = useRef(tree.materias.size).current;

  useEffect(() => {
    let alive = true;
    setTarget(null);
    (async () => {
      try {
        if (!created.current.has(step)) {
          const g = groups[step];
          const existing = year.materias.find((x) => x.name.trim().toLowerCase() === g.name.trim().toLowerCase());
          created.current.set(
            step,
            existing ? Promise.resolve(existing) : addMateria(year, g.name, COLORS[(baseColor + step) % COLORS.length]),
          );
        }
        const m = await created.current.get(step)!;
        if (alive) setTarget({ id: m.id, name: m.name });
      } catch (e) {
        if (alive) setError(errorText(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [step, groups, year, baseColor]);

  const finish = async () => {
    await reload();
    onClose();
  };

  if (error)
    return (
      <Modal title="No se pudo crear la materia" onClose={finish}>
        <p className="text-danger">{error}</p>
        <Button className="w-full mt-5" onClick={finish}>
          Cerrar
        </Button>
      </Modal>
    );

  if (!target)
    return (
      <Modal title={`Importando ${step + 1} de ${groups.length}`} onClose={() => {}}>
        <div className="flex items-center gap-3 text-muted">
          <Spinner /> Creando {groups[step].name}…
        </div>
      </Modal>
    );

  return (
    <UploadSheet
      key={step}
      items={groups[step].items}
      parentId={target.id}
      destName={`${target.name} (${step + 1} de ${groups.length})`}
      onClose={finish}
      onDone={async () => {
        if (step + 1 < groups.length) return setStep(step + 1);
        toast(`Listo: ${groups.length} materias importadas en ${year.name}`);
        await finish();
      }}
    />
  );
}

function Onboarding() {
  const { tree, reload, user } = useFacu();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function start(count: number) {
    setBusy(true);
    try {
      for (let i = 0; i < count; i++) await addYear(tree, i);
      await reload();
    } catch (e) {
      toast(errorText(e));
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh max-w-lg mx-auto px-6 py-12 flex flex-col justify-center">
      <p className="text-muted font-medium">¡Hola{user ? `, ${user.name.split(' ')[0]}` : ''}!</p>
      <h1 className="text-3xl font-extrabold tracking-tight mt-1">¿Qué año de la carrera estás cursando?</h1>
      <p className="text-muted mt-3">Armamos un espacio para cada año. Después agregás las materias.</p>
      {busy ? (
        <div className="mt-10 flex items-center gap-3 text-muted">
          <Spinner /> Preparando todo…
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-8">
          {YEAR_NAMES.slice(0, 6).map((name, i) => (
            <Button key={name} className="h-16 text-lg" onClick={() => start(i + 1)}>
              {name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
