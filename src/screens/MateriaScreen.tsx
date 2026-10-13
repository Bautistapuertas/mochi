import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import FileTile from '../components/FileTile';
import { Back, Camera, Draw, External, Folder as FolderIcon, Pencil, Plus, Trash, UploadIcon } from '../components/icons';
import UploadSheet from '../components/UploadSheet';
import { Button, ConfirmModal, IconButton, Menu, PromptModal, Spinner, errorText, useToast, type MenuItem } from '../components/ui';
import { CHANGED, notifyChanged, useFacu } from '../lib/context';
import { createTextFile } from '../lib/drive';
import {
  DRAWING_MIME,
  EMPTY_DRAWING,
  addFolder,
  folderPath,
  materiaFiles,
  renameFolder,
  trashFolder,
  type FileItem,
  type Folder,
} from '../lib/facu';
import { cleanNames, naturalCompare } from '../lib/files';
import { go, openFile } from '../lib/router';
import { itemsFromDrop, itemsFromInput, type UploadItem } from '../lib/upload';

type Sort = 'nombre' | 'recientes';
const SORT_KEY = 'facu:sort';

function readSort(): Sort {
  try {
    return localStorage.getItem(SORT_KEY) === 'recientes' ? 'recientes' : 'nombre';
  } catch {
    return 'nombre';
  }
}

type ModalKind = 'rename-materia' | 'delete-materia' | 'rename-folder' | 'delete-folder' | 'new-folder' | 'draw';

export default function MateriaScreen({ id, folderId }: { id: string; folderId?: string }) {
  const { tree, reload } = useFacu();
  const toast = useToast();
  const m = tree.materias.get(id);
  const found = folderId ? tree.folders.get(folderId) : undefined;
  const current = found && found.materia.id === id ? found : undefined;
  const [files, setFiles] = useState<FileItem[] | null>(null);
  const [picked, setPicked] = useState<UploadItem[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [sort, setSort] = useState<Sort>(readSort);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  // React no conoce el atributo para elegir carpetas.
  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '');
  }, []);

  const load = useCallback(async () => {
    if (!m) return;
    try {
      setFiles(await materiaFiles(tree, m));
    } catch (e) {
      toast(errorText(e));
      setFiles([]);
    }
  }, [tree, m, toast]);

  useEffect(() => {
    load();
    addEventListener(CHANGED, load);
    return () => removeEventListener(CHANGED, load);
  }, [load]);

  // Cantidad de archivos por carpeta, contando las subcarpetas.
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const f of files ?? []) for (let d = f.folder; d; d = d.parent) c.set(d.id, (c.get(d.id) ?? 0) + 1);
    return c;
  }, [files]);

  const here = useMemo(() => {
    const list = (files ?? []).filter((f) => f.folder?.id === current?.id);
    const names = cleanNames(list);
    const key = (f: FileItem) => names.get(f.id)!.code ?? names.get(f.id)!.title;
    list.sort((a, b) =>
      sort === 'recientes'
        ? b.modifiedTime.localeCompare(a.modifiedTime)
        : naturalCompare(key(a), key(b)) || naturalCompare(a.name, b.name),
    );
    return { list, names };
  }, [files, current, sort]);

  if (!m)
    return (
      <div className="min-h-dvh grid place-items-center p-6 text-center">
        <div>
          <p className="font-bold text-lg mb-4">Esta materia ya no existe</p>
          <Button onClick={() => go('/')}>Volver al inicio</Button>
        </div>
      </div>
    );

  const year = tree.years.find((y) => y.id === m.yearId);
  const path = folderPath(current);
  const selectedTop = path[0];
  const openFolder = (f?: Folder) => go(f ? `/m/${m.id}/${f.id}` : `/m/${m.id}`);
  const destId = current?.id ?? m.id;
  const destName = current?.name ?? m.name;

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const items = await itemsFromDrop(e.dataTransfer);
    if (items.length) setPicked(items);
  };

  const changeSort = (s: Sort) => {
    setSort(s);
    try {
      localStorage.setItem(SORT_KEY, s);
    } catch {}
  };

  const menu: MenuItem[] = [
    ...(current
      ? [
          { label: 'Renombrar carpeta', icon: <Pencil />, onClick: () => setModal('rename-folder') },
          { label: 'Eliminar carpeta', icon: <Trash />, danger: true, onClick: () => setModal('delete-folder') },
        ]
      : []),
    { label: 'Ver en Google Drive', icon: <External />, onClick: () => open(`https://drive.google.com/drive/folders/${destId}`, '_blank') },
    { label: 'Renombrar materia', icon: <Pencil />, onClick: () => setModal('rename-materia') },
    { label: 'Eliminar materia', icon: <Trash />, danger: true, onClick: () => setModal('delete-materia') },
  ];

  const pickInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const items = itemsFromInput(e.target.files);
      if (items.length) setPicked(items);
    }
    e.target.value = '';
  };

  return (
    <div
      className="min-h-dvh"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 safe-top">
        <header className="flex items-center gap-1 pt-4 pb-2 -ml-2">
          <IconButton label="Volver" onClick={() => (current ? openFolder(current.parent) : go('/'))}>
            <Back />
          </IconButton>
          <span className="text-sm font-medium text-muted flex-1">{year?.name}</span>
          <Menu items={menu} />
        </header>

        <button onClick={() => openFolder()} className="flex items-center gap-3 mb-5 text-left">
          <span
            className="size-11 rounded-2xl grid place-items-center text-white text-lg font-extrabold shrink-0"
            style={{ background: m.color }}
          >
            {m.name.charAt(0).toUpperCase()}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">{m.name}</h1>
        </button>

        <div className="flex gap-2 flex-wrap">
          <Button variant="primary" onClick={() => fileInput.current?.click()} className="flex-1 sm:flex-none">
            <UploadIcon className="shrink-0" /> <span className="sm:hidden">Subir</span>
            <span className="hidden sm:inline">Subir archivos</span>
          </Button>
          <Button onClick={() => folderInput.current?.click()} className="hidden md:inline-flex">
            <FolderIcon /> Subir carpeta
          </Button>
          <Button onClick={() => cameraInput.current?.click()} className="md:hidden">
            <Camera /> Foto
          </Button>
          <Button onClick={() => setModal('draw')}>
            <Draw /> Dibujo
          </Button>
        </div>
        <input ref={fileInput} type="file" multiple hidden onChange={pickInput} />
        <input ref={folderInput} type="file" multiple hidden onChange={pickInput} />
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={pickInput} />

        {files === null ? (
          <div className="py-16 grid place-items-center">
            <Spinner />
          </div>
        ) : (
          <>
            {/* Carpetas de la materia */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-7">
              {m.folders.map((f) => (
                <FolderCard
                  key={f.id}
                  name={f.name}
                  color={m.color}
                  count={counts.get(f.id) ?? 0}
                  selected={selectedTop?.id === f.id}
                  onClick={() => openFolder(selectedTop?.id === f.id && !current?.parent ? undefined : f)}
                />
              ))}
              <NewFolderCard label="Nueva carpeta" onClick={() => (openFolder(), setModal('new-folder'))} />
            </div>

            {/* Contenido de la carpeta elegida (o archivos sueltos) */}
            <section className="mt-8">
              {current && (
                <nav className="flex items-center gap-1.5 flex-wrap mb-4 text-[15px]">
                  {path.map((f, i) => (
                    <span key={f.id} className="flex items-center gap-1.5">
                      {i > 0 && <span className="text-muted">›</span>}
                      <button
                        onClick={() => openFolder(f)}
                        className={i === path.length - 1 ? 'font-bold text-lg' : 'text-muted hover:text-ink font-medium'}
                      >
                        {f.name}
                      </button>
                    </span>
                  ))}
                </nav>
              )}

              {current && current.children.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                  {current.children.map((f) => (
                    <FolderCard key={f.id} small name={f.name} color={m.color} count={counts.get(f.id) ?? 0} onClick={() => openFolder(f)} />
                  ))}
                </div>
              )}

              {here.list.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted font-medium">
                      {current ? '' : 'Archivos sueltos · '}
                      {here.list.length} {here.list.length === 1 ? 'archivo' : 'archivos'}
                    </p>
                    <div className="flex bg-sunken rounded-xl p-1 text-sm font-semibold">
                      <SortButton on={sort === 'nombre'} onClick={() => changeSort('nombre')}>
                        En orden
                      </SortButton>
                      <SortButton on={sort === 'recientes'} onClick={() => changeSort('recientes')}>
                        Recientes
                      </SortButton>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {here.list.map((f) => {
                      const n = here.names.get(f.id)!;
                      return <FileTile key={f.id} file={f} code={n.code} title={n.title} />;
                    })}
                  </div>
                </>
              ) : current ? (
                current.children.length === 0 && (
                  <EmptyDrop onClick={() => fileInput.current?.click()} title="Esta carpeta está vacía" />
                )
              ) : m.folders.length === 0 ? (
                <EmptyDrop onClick={() => fileInput.current?.click()} title="Todavía no hay nada acá" />
              ) : (
                <p className="text-muted text-center py-6">Elegí una carpeta para ver sus archivos.</p>
              )}

              {current && (
                <button
                  onClick={() => setModal('new-folder')}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink"
                >
                  <Plus /> Nueva subcarpeta en {current.name}
                </button>
              )}
            </section>
          </>
        )}
      </div>

      {dragging && (
        <div className="fixed inset-3 z-40 rounded-3xl border-4 border-dashed border-accent bg-accent-soft/80 grid place-items-center pointer-events-none">
          <p className="text-xl font-bold text-accent text-center px-6">Soltá para subir a {destName}</p>
        </div>
      )}

      {picked && (
        <UploadSheet
          items={picked}
          parentId={destId}
          destName={destName}
          onClose={() => {
            setPicked(null);
            reload();
          }}
          onDone={async (n) => {
            setPicked(null);
            toast(n === 1 ? `Guardado en ${destName}` : `${n} archivos guardados en ${destName}`);
            await reload();
          }}
        />
      )}
      {modal === 'new-folder' && (
        <PromptModal
          title={current ? `Nueva carpeta en ${current.name}` : 'Nueva carpeta'}
          placeholder="Ej: Trabajos prácticos"
          action="Crear carpeta"
          onClose={() => setModal(null)}
          onSubmit={async (name) => {
            const f = await addFolder(name, destId);
            await reload();
            go(`/m/${m.id}/${f.id}`);
          }}
        />
      )}
      {modal === 'rename-folder' && current && (
        <PromptModal
          title="Nombre de la carpeta"
          initial={current.name}
          onClose={() => setModal(null)}
          onSubmit={async (name) => {
            await renameFolder(current.id, name);
            await reload();
          }}
        />
      )}
      {modal === 'delete-folder' && current && (
        <ConfirmModal
          title={`¿Eliminar ${current.name}?`}
          text="La carpeta y todo lo que tiene adentro van a la papelera de Google Drive. Podés recuperarlos desde ahí durante 30 días."
          action="Eliminar"
          onClose={() => setModal(null)}
          onConfirm={async () => {
            await trashFolder(current.id);
            openFolder(current.parent);
            await reload();
            toast('Carpeta en la papelera de Drive');
          }}
        />
      )}
      {modal === 'rename-materia' && (
        <PromptModal
          title="Nombre de la materia"
          initial={m.name}
          onClose={() => setModal(null)}
          onSubmit={async (name) => {
            await renameFolder(m.id, name);
            await reload();
          }}
        />
      )}
      {modal === 'delete-materia' && (
        <ConfirmModal
          title={`¿Eliminar ${m.name}?`}
          text="La materia y todos sus archivos van a la papelera de Google Drive. Podés recuperarlos desde ahí durante 30 días."
          action="Eliminar"
          onClose={() => setModal(null)}
          onConfirm={async () => {
            await trashFolder(m.id);
            go('/');
            await reload();
            toast('Listo. Está en la papelera de Drive por 30 días.');
          }}
        />
      )}
      {modal === 'draw' && (
        <PromptModal
          title={`Nuevo dibujo en ${destName}`}
          placeholder="Ej: Diagrama unidad 2"
          action="Crear y abrir"
          onClose={() => setModal(null)}
          onSubmit={async (name) => {
            const f = await createTextFile(`${name}.excalidraw`, destId, EMPTY_DRAWING, DRAWING_MIME);
            notifyChanged();
            openFile(f.id);
          }}
        />
      )}
    </div>
  );
}

function FolderCard({
  name,
  color,
  count,
  selected = false,
  small = false,
  onClick,
}: {
  name: string;
  color: string;
  count: number;
  selected?: boolean;
  small?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`text-left border rounded-2xl flex items-center gap-3 transition active:scale-[.98] ${
        small ? 'p-3' : 'p-3.5'
      } ${
        selected
          ? 'bg-accent-soft border-accent ring-1 ring-accent'
          : 'bg-surface border-line hover:-translate-y-0.5 hover:shadow-md'
      }`}
    >
      <svg viewBox="0 0 48 40" className={`${small ? 'w-8' : 'w-10'} h-auto shrink-0`} aria-hidden>
        <path d="M4 8a4 4 0 0 1 4-4h11l5 5h16a4 4 0 0 1 4 4v3H4z" fill={color} opacity=".55" />
        <rect x="4" y="13" width="40" height="23" rx="4" fill={count ? color : 'var(--line)'} />
      </svg>
      <div className="min-w-0">
        <div className="font-semibold leading-snug line-clamp-2 text-[15px]">{name}</div>
        <div className="text-xs text-muted mt-0.5">{count ? `${count} ${count === 1 ? 'archivo' : 'archivos'}` : 'Vacía'}</div>
      </div>
    </button>
  );
}

function NewFolderCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border-2 border-dashed border-line p-3.5 flex items-center gap-3 text-muted font-semibold text-[15px] hover:border-accent hover:text-accent transition"
    >
      <Plus className="shrink-0" /> {label}
    </button>
  );
}

function EmptyDrop({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-3xl border-2 border-dashed border-line py-14 px-6 text-center hover:border-accent transition"
    >
      <p className="font-bold text-lg">{title}</p>
      <p className="text-muted mt-1">
        Tocá acá para subir archivos
        <span className="hidden md:inline">, o arrastrá archivos y carpetas enteras a esta ventana</span>.
      </p>
    </button>
  );
}

function SortButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-3 rounded-lg transition ${on ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
    >
      {children}
    </button>
  );
}

