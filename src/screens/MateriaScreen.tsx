import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import FileTile, { DRAG_TYPE, type DragFile } from '../components/FileTile';
import {
  Back,
  Camera,
  ChevronRight,
  Close,
  External,
  Folder as FolderIcon,
  Move,
  Offline,
  Pencil,
  Plus,
  Share,
  SearchIcon,
  Trash,
  UploadIcon,
} from '../components/icons';
import { MateriaBadge, MateriaCover } from '../components/MateriaCover';
import { MateriaInfoModal, MateriaSummary } from '../components/MateriaInfo';
import MoveModal from '../components/MoveModal';
import ShareModal from '../components/ShareModal';
import UploadSheet from '../components/UploadSheet';
import { Button, ConfirmModal, IconButton, Menu, Modal, PromptModal, errorText, useToast, type MenuItem } from '../components/ui';
import { CHANGED, notifyChanged, useFacu } from '../lib/context';
import { list, move, trash } from '../lib/drive';
import {
  addFolder,
  folderPath,
  materiaFiles,
  renameFolder,
  searchInMateria,
  trashFolder,
  type FileItem,
  type Folder,
  type Materia,
} from '../lib/facu';
import { keepOffline } from '../lib/fileBlob';
import { baseName, cleanNames, naturalCompare } from '../lib/files';
import { offlineIds } from '../lib/offline';
import { go, setLastMateria, setViewerList } from '../lib/router';
import { itemsFromDrop, itemsFromInput, mergeSameName, type UploadItem } from '../lib/upload';

type Sort = 'nombre' | 'recientes';
const SORT_KEY = 'facu:sort';

function readSort(): Sort {
  try {
    return localStorage.getItem(SORT_KEY) === 'recientes' ? 'recientes' : 'nombre';
  } catch {
    return 'nombre';
  }
}

type ModalKind =
  | 'rename-materia'
  | 'delete-materia'
  | 'rename-folder'
  | 'unwrap-folder'
  | 'delete-folder'
  | 'new-folder'
  | 'info'
  | 'add'
  | 'share';

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const selecting = selectMode || selected.size > 0;
  const clearSelection = () => {
    setSelected(new Set());
    setSelectMode(false);
  };
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [contentHits, setContentHits] = useState<FileItem[] | null>(null);
  const [bulk, setBulk] = useState<'move' | 'delete' | null>(null);
  const [offline, setOffline] = useState<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  useEffect(() => setLastMateria(id), [id]);

  // React no conoce el atributo para elegir carpetas.
  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '');
  }, []);

  const load = useCallback(async () => {
    if (!m) return;
    offlineIds().then(setOffline);
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

  // Al cambiar de carpeta se limpia la selección y vuelve arriba.
  useEffect(() => {
    clearSelection();
    scrollTo({ top: 0 });
  }, [current?.id]);

  // Además del nombre, busca adentro de los PDF y Word de la materia.
  useEffect(() => {
    const text = query.trim();
    setContentHits(null);
    if (!m || text.length < 3) return;
    let alive = true;
    const t = setTimeout(() => {
      searchInMateria(tree, m, text).then(
        (r) => alive && setContentHits(r),
        () => alive && setContentHits([]),
      );
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, tree, m]);

  const results = useMemo(() => {
    const text = norm(query.trim());
    if (!text) return null;
    const byName = (files ?? []).filter((f) => norm(f.name).includes(text));
    const seen = new Set(byName.map((f) => f.id));
    const byContent = (contentHits ?? []).filter((f) => !seen.has(f.id));
    return { byName, byContent };
  }, [query, files, contentHits]);

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

  // El lector usa esta lista para pasar al anterior o siguiente.
  useEffect(() => {
    const shown = results ? [...results.byName, ...results.byContent] : here.list;
    setViewerList(shown.map((f) => f.id));
  }, [results, here]);

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
  const openFolder = (f?: Folder) => go(f ? `/m/${m.id}/${f.id}` : `/m/${m.id}`);
  const goBack = () => (current ? openFolder(current.parent) : go('/'));
  const destId = current?.id ?? m.id;
  const destName = current?.name ?? m.name;

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!e.dataTransfer.types.includes('Files')) return;
    const items = mergeSameName(await itemsFromDrop(e.dataTransfer), destName);
    if (items.length) setPicked(items);
  };

  const moveTo = async (list: DragFile[], targetId: string, targetName: string) => {
    const todo = list.filter((d) => !d.parents.includes(targetId));
    if (!todo.length) return;
    try {
      for (const d of todo) await move(d.id, d.parents, targetId);
      toast(todo.length === 1 ? `Movido a ${targetName}` : `${todo.length} archivos movidos a ${targetName}`);
      clearSelection();
    } catch (e) {
      toast(errorText(e));
    } finally {
      notifyChanged();
    }
  };

  const toggle = (fid: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(fid)) n.delete(fid);
      else n.add(fid);
      return n;
    });
  const selectedFiles = (files ?? []).filter((f) => selected.has(f.id));
  // Si arrastrás uno de los seleccionados, se mueven todos.
  const dragFor = (f: FileItem) => () =>
    (selected.has(f.id) ? selectedFiles : [f]).map((x) => ({ id: x.id, parents: x.parents ?? [] }));

  const tile = (f: FileItem, code: string | undefined, title: string, subtitle?: string) => (
    <FileTile
      key={f.id}
      file={f}
      code={code}
      title={title}
      subtitle={subtitle}
      selected={selected.has(f.id)}
      selecting={selecting}
      offline={offline.has(f.id)}
      onToggle={() => toggle(f.id)}
      dragFiles={dragFor(f)}
    />
  );

  async function saveSelectedOffline() {
    const list = selectedFiles;
    try {
      for (let i = 0; i < list.length; i++) {
        toast(`Guardando sin conexión ${i + 1} de ${list.length}…`);
        await keepOffline(list[i]);
      }
      toast(`Listo: ${list.length} ${list.length === 1 ? 'archivo disponible' : 'archivos disponibles'} sin internet`);
      clearSelection();
    } catch (e) {
      toast(errorText(e));
    } finally {
      offlineIds().then(setOffline);
    }
  }

  const changeSort = (s: Sort) => {
    setSort(s);
    try {
      localStorage.setItem(SORT_KEY, s);
    } catch {}
  };

  const menu: MenuItem[] = [
    {
      label: current ? `Compartir ${current.name}` : 'Compartir la materia',
      icon: <Share />,
      onClick: () => setModal('share'),
    },
    ...(current
      ? [
          { label: 'Renombrar carpeta', icon: <Pencil />, onClick: () => setModal('rename-folder') },
          { label: 'Sacar el contenido de esta carpeta', icon: <Move />, onClick: () => setModal('unwrap-folder') },
          { label: 'Eliminar carpeta', icon: <Trash />, danger: true, onClick: () => setModal('delete-folder') },
        ]
      : []),
    { label: 'Ver en Google Drive', icon: <External />, onClick: () => open(`https://drive.google.com/drive/folders/${destId}`, '_blank') },
    { label: 'Renombrar materia', icon: <Pencil />, onClick: () => setModal('rename-materia') },
    { label: 'Eliminar materia', icon: <Trash />, danger: true, onClick: () => setModal('delete-materia') },
  ];

  const pickInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const items = mergeSameName(itemsFromInput(e.target.files), destName);
      if (items.length) setPicked(items);
    }
    e.target.value = '';
  };

  const searchBox = (autoFocus: boolean) => (
    <div className="flex items-center gap-2 h-10 px-3 rounded-xl bg-sunken border border-transparent focus-within:border-accent min-w-0">
      <SearchIcon width={18} height={18} className="text-muted shrink-0" />
      <input
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setQuery('');
            setSearchOpen(false);
          }
        }}
        placeholder={`Buscar en ${m.name}…`}
        className="flex-1 bg-transparent outline-none text-[15px] min-w-0"
      />
      {query && (
        <button onClick={() => setQuery('')} aria-label="Borrar búsqueda" className="text-muted hover:text-ink">
          <Close width={18} height={18} />
        </button>
      )}
    </div>
  );

  // Carpeta abierta: subcarpetas arriba, archivos abajo. Sin carpeta: lo último y los sueltos.
  const content =
    files === null ? (
      <SkeletonGrid />
    ) : results ? (
      <SearchResults
        query={query}
        results={results}
        searching={contentHits === null && query.trim().length >= 3}
        materia={m}
        tile={tile}
      />
    ) : (
      <>
        {current && current.children.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
            {current.children.map((f) => (
              <FolderCard
                key={f.id}
                name={f.name}
                color={m.color}
                count={counts.get(f.id) ?? 0}
                onClick={() => openFolder(f)}
                onFileDrop={(d) => moveTo(d, f.id, f.name)}
              />
            ))}
          </div>
        )}

        {here.list.length > 0 ? (
          <section>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-bold text-muted truncate">
                {current ? '' : 'Sueltos · '}
                {here.list.length} {here.list.length === 1 ? 'archivo' : 'archivos'}
              </h2>
              <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
                <button
                  onClick={() => (selecting ? clearSelection() : setSelectMode(true))}
                  className="h-9 px-2.5 rounded-xl text-sm font-semibold text-muted hover:text-ink hover:bg-sunken"
                >
                  {selecting ? 'Listo' : 'Seleccionar'}
                </button>
                <button
                  onClick={() => changeSort(sort === 'nombre' ? 'recientes' : 'nombre')}
                  title="Cambiar el orden"
                  className="h-9 px-3 rounded-xl bg-sunken text-sm font-semibold flex items-center gap-1.5"
                >
                  <SortIcon /> {sort === 'nombre' ? 'En orden' : 'Recientes'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {here.list.map((f) => {
                const n = here.names.get(f.id)!;
                return tile(f, n.code, n.title);
              })}
            </div>
          </section>
        ) : current ? (
          current.children.length === 0 && (
            <EmptyDrop onClick={() => fileInput.current?.click()} title="Esta carpeta está vacía" />
          )
        ) : m.folders.length === 0 ? (
          <EmptyDrop onClick={() => fileInput.current?.click()} title="Todavía no hay nada acá" />
        ) : (
          <p className="text-muted text-center py-10">Elegí una carpeta para ver sus archivos.</p>
        )}
      </>
    );

  return (
    <div
      className="min-h-dvh"
      onDragOver={(e) => {
        e.preventDefault();
        // Solo archivos que vienen de la compu; los cuadraditos de la app se mueven entre carpetas.
        if (e.dataTransfer.types.includes('Files')) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <input ref={fileInput} type="file" multiple hidden onChange={pickInput} />
      <input ref={folderInput} type="file" multiple hidden onChange={pickInput} />
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={pickInput} />

      <div className="lg:flex">
        {/* Compu: barra lateral con la materia y sus carpetas */}
        <aside className="hidden lg:flex flex-col w-72 shrink-0 h-dvh sticky top-0 overflow-y-auto border-r border-line px-4 py-5 gap-5">
          <button onClick={() => go('/')} className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink -ml-1">
            <Back width={18} height={18} /> Inicio
          </button>
          <DropTarget onFile={(d) => moveTo(d, m.id, m.name)}>
            {(over) => (
              <button
                onClick={() => openFolder()}
                className={`text-left rounded-2xl p-2 -m-2 transition ${over ? 'bg-accent-soft ring-2 ring-accent' : ''}`}
              >
                <MateriaCover m={m} className="h-24 rounded-2xl mb-3" />
                <h1 className="text-xl font-extrabold tracking-tight leading-tight">{m.name}</h1>
                <p className="text-sm text-muted mt-0.5">{year?.name}</p>
              </button>
            )}
          </DropTarget>

          <MateriaSummary m={m} onOpen={() => setModal('info')} />

          <nav className="flex flex-col gap-0.5 -mx-2">
            <TreeItem
              label="Toda la materia"
              depth={0}
              on={!current}
              color={m.color}
              onClick={() => openFolder()}
              onFileDrop={(d) => moveTo(d, m.id, m.name)}
            />
            {m.folders.map((f) => (
              <FolderTree key={f.id} folder={f} depth={0} current={current} path={path} counts={counts} color={m.color} open={openFolder} drop={moveTo} />
            ))}
            <button
              onClick={() => setModal('new-folder')}
              className="flex items-center gap-2 h-9 px-3 rounded-xl text-sm font-semibold text-muted hover:text-ink hover:bg-sunken"
            >
              <Plus width={18} height={18} /> Nueva carpeta{current && ` en ${current.name}`}
            </button>
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          {/* Celu y tablet: barra de arriba fija */}
          <header className="lg:hidden sticky top-0 z-20 bg-bg/90 backdrop-blur safe-top">
            <div className="flex items-center gap-1 h-14 px-2">
              <IconButton label="Volver" onClick={goBack}>
                <Back />
              </IconButton>
              {searchOpen ? (
                <div className="flex-1 min-w-0">{searchBox(true)}</div>
              ) : (
                <button onClick={() => openFolder()} className="flex-1 min-w-0 flex items-center gap-2 text-left">
                  <MateriaBadge m={m} size={28} />
                  <span className="font-bold text-[17px] truncate">{m.name}</span>
                </button>
              )}
              <IconButton
                label={searchOpen ? 'Cerrar búsqueda' : 'Buscar en la materia'}
                onClick={() => {
                  if (searchOpen) setQuery('');
                  setSearchOpen(!searchOpen);
                }}
              >
                {searchOpen ? <Close /> : <SearchIcon />}
              </IconButton>
              <Menu items={menu} />
            </div>
            {/* Pestañas de carpetas */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-3">
              <Tab on={!current} onClick={() => openFolder()}>
                General
              </Tab>
              {m.folders.map((f) => (
                <Tab key={f.id} on={path[0]?.id === f.id} onClick={() => openFolder(f)} count={counts.get(f.id) ?? 0}>
                  {f.name}
                </Tab>
              ))}
              <button
                onClick={() => setModal('new-folder')}
                aria-label="Nueva carpeta"
                className="shrink-0 h-9 w-9 rounded-full border border-dashed border-line grid place-items-center text-muted"
              >
                <Plus width={18} height={18} />
              </button>
            </div>
          </header>

          {/* Compu: barra de herramientas */}
          <div className="hidden lg:flex items-center gap-3 px-8 pt-6 pb-4">
            <nav className="flex items-center gap-1 min-w-0 flex-1 text-[15px]">
              {!current && <span className="font-bold text-xl truncate">Toda la materia</span>}
              {path.map((f, i) => (
                <span key={f.id} className="flex items-center gap-1 min-w-0">
                  {i > 0 && <ChevronRight width={16} height={16} className="text-muted shrink-0" />}
                  <button
                    onClick={() => openFolder(f)}
                    className={`truncate ${i === path.length - 1 ? 'font-bold text-xl' : 'text-muted hover:text-ink font-medium'}`}
                  >
                    {f.name}
                  </button>
                </span>
              ))}
            </nav>
            <div className="w-56 xl:w-64">{searchBox(false)}</div>
            <Button variant="primary" onClick={() => fileInput.current?.click()}>
              <UploadIcon /> Subir archivos
            </Button>
            <Button onClick={() => folderInput.current?.click()} title="Subir carpeta">
              <FolderIcon /> <span className="hidden xl:inline">Subir carpeta</span>
            </Button>
            <Menu items={menu} />
          </div>

          <div className="px-4 sm:px-6 lg:px-8 pb-28 lg:pb-12">
            {/* Celu: resumen de fechas y notas, y camino de subcarpetas */}
            <div className="lg:hidden">
              {!current && !results && (
                <div className="mb-5">
                  <MateriaSummary m={m} onOpen={() => setModal('info')} />
                </div>
              )}
              {path.length > 1 && !results && (
                <button
                  onClick={() => openFolder(current!.parent)}
                  className="flex items-center gap-1 text-sm font-semibold text-muted mb-3"
                >
                  <Back width={16} height={16} /> {path.slice(0, -1).map((f) => f.name).join(' › ')}
                  <span className="text-ink"> › {current!.name}</span>
                </button>
              )}
            </div>
            {content}
            <p className="hidden lg:block text-sm text-muted mt-10 text-center">
              Tip: arrastrá archivos o carpetas desde tu compu a esta ventana para subirlos a {destName}.
            </p>
          </div>
        </main>
      </div>

      {/* Celu: botón + para subir */}
      {!selecting && (
        <button
          onClick={() => setModal('add')}
          aria-label="Agregar"
          className="lg:hidden fixed right-4 bottom-24 z-30 size-14 rounded-2xl bg-accent text-on-accent shadow-lg grid place-items-center active:scale-95 transition"
        >
          <Plus width={28} height={28} />
        </button>
      )}

      {modal === 'add' && (
        <Modal title={`Agregar a ${destName}`} onClose={() => setModal(null)}>
          <div className="grid gap-2">
            <SheetAction icon={<UploadIcon />} label="Subir archivos" hint="PDF, Word, fotos…" onClick={() => (setModal(null), fileInput.current?.click())} />
            <SheetAction icon={<Camera />} label="Sacar una foto" hint="Del pizarrón o de tus apuntes" onClick={() => (setModal(null), cameraInput.current?.click())} />
            <SheetAction icon={<FolderIcon />} label="Subir una carpeta entera" onClick={() => (setModal(null), folderInput.current?.click())} />
            <SheetAction icon={<Plus />} label="Nueva carpeta" onClick={() => setModal('new-folder')} />
          </div>
        </Modal>
      )}
      {modal === 'info' && <MateriaInfoModal m={m} onClose={() => setModal(null)} />}
      {modal === 'share' && <ShareModal target={current ?? m} onClose={() => setModal(null)} />}

      {selecting && (
        <div className="fixed inset-x-0 bottom-20 lg:bottom-0 z-40 flex justify-center px-3 pb-4 lg:pl-20 safe-bottom pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-1 bg-ink text-bg rounded-2xl shadow-xl p-1.5 pl-4 max-w-full sheet-up">
            <span className="font-semibold text-[15px] whitespace-nowrap mr-2">
              {selected.size}
              <span className="hidden sm:inline"> {selected.size === 1 ? 'seleccionado' : 'seleccionados'}</span>
            </span>
            <BarButton onClick={() => setSelected(new Set(here.list.map((f) => f.id)))}>Todos</BarButton>
            <BarButton disabled={!selected.size} onClick={() => setBulk('move')}>
              <Move width={18} height={18} /> Mover
            </BarButton>
            <BarButton disabled={!selected.size} onClick={saveSelectedOffline} label="Guardar sin conexión">
              <Offline width={18} height={18} /> <span className="hidden sm:inline">Sin conexión</span>
            </BarButton>
            <BarButton disabled={!selected.size} onClick={() => setBulk('delete')}>
              <Trash width={18} height={18} /> <span className="hidden sm:inline">Eliminar</span>
            </BarButton>
            <BarButton onClick={clearSelection} label="Cancelar selección">
              <Close width={18} height={18} />
            </BarButton>
          </div>
        </div>
      )}
      {bulk === 'move' && (
        <MoveModal
          files={selectedFiles}
          initialMateria={m.id}
          initialFolder={current?.id}
          onClose={() => setBulk(null)}
          onMoved={(moved, where) => {
            toast(`${moved.length} ${moved.length === 1 ? 'archivo movido' : 'archivos movidos'} a ${where}`);
            clearSelection();
            notifyChanged();
          }}
        />
      )}
      {bulk === 'delete' && (
        <ConfirmModal
          title={`¿Eliminar ${selected.size} ${selected.size === 1 ? 'archivo' : 'archivos'}?`}
          text="Van a la papelera de Google Drive. Podés recuperarlos desde ahí durante 30 días."
          action="Eliminar"
          onClose={() => setBulk(null)}
          onConfirm={async () => {
            try {
              for (const f of selectedFiles) await trash(f.id);
              toast(`${selectedFiles.length} en la papelera de Drive`);
              clearSelection();
            } finally {
              notifyChanged();
            }
          }}
        />
      )}

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
      {modal === 'unwrap-folder' && current && (
        <ConfirmModal
          title={`¿Sacar todo de ${current.name}?`}
          text={`Las carpetas y archivos de adentro pasan a ${current.parent?.name ?? m.name}, y la carpeta “${current.name}” vacía se borra.`}
          action="Sacar contenido"
          danger={false}
          onClose={() => setModal(null)}
          onConfirm={async () => {
            const target = current.parent?.id ?? m.id;
            // Se pregunta a Drive lo que queda adentro, así reintentar después de un corte funciona.
            const children = await list(`'${current.id}' in parents and trashed=false`);
            for (const c of children) await move(c.id, [current.id], target);
            // Solo se borra si de verdad quedó vacía.
            const left = await list(`'${current.id}' in parents and trashed=false`);
            if (left.length) throw new Error(`Quedaron ${left.length} elementos sin mover. Reintentá.`);
            await trashFolder(current.id);
            openFolder(current.parent);
            await reload();
            toast(`Listo, ${children.length} elementos pasaron a ${current.parent?.name ?? m.name}`);
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
    </div>
  );
}

function SearchResults({
  query,
  results,
  searching,
  materia,
  tile,
}: {
  query: string;
  results: { byName: FileItem[]; byContent: FileItem[] };
  searching: boolean;
  materia: Materia;
  tile: (f: FileItem, code: string | undefined, title: string, subtitle?: string) => ReactNode;
}) {
  if (results.byName.length + results.byContent.length === 0)
    return (
      <p className="text-muted text-center py-10">
        {searching ? 'Buscando…' : `No encontramos nada con “${query.trim()}” en ${materia.name}.`}
      </p>
    );
  return (
    <section>
      {results.byName.length > 0 && (
        <>
          <h2 className="text-sm font-bold text-muted mb-3">
            {results.byName.length} {results.byName.length === 1 ? 'archivo' : 'archivos'} con ese nombre
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {results.byName.map((f) => tile(f, undefined, baseName(f.name), placeLabel(f)))}
          </div>
        </>
      )}
      {results.byContent.length > 0 && (
        <>
          <h2 className="text-sm font-bold text-muted mb-3 mt-8">Lo mencionan adentro</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {results.byContent.map((f) => tile(f, undefined, baseName(f.name), placeLabel(f)))}
          </div>
        </>
      )}
    </section>
  );
}

// Árbol de carpetas de la barra lateral. Se despliega solo el camino de la carpeta abierta.
function FolderTree({
  folder,
  depth,
  current,
  path,
  counts,
  color,
  open,
  drop,
}: {
  folder: Folder;
  depth: number;
  current?: Folder;
  path: Folder[];
  counts: Map<string, number>;
  color: string;
  open: (f?: Folder) => void;
  drop: (d: DragFile[], id: string, name: string) => void;
}) {
  const inPath = path.some((p) => p.id === folder.id);
  const [expanded, setExpanded] = useState(inPath);
  useEffect(() => {
    if (inPath) setExpanded(true);
  }, [inPath]);
  return (
    <>
      <TreeItem
        label={folder.name}
        depth={depth}
        on={current?.id === folder.id}
        color={color}
        count={counts.get(folder.id) ?? 0}
        expandable={folder.children.length > 0}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
        onClick={() => {
          open(folder);
          setExpanded(true);
        }}
        onFileDrop={(d) => drop(d, folder.id, folder.name)}
      />
      {expanded &&
        folder.children.map((c) => (
          <FolderTree key={c.id} folder={c} depth={depth + 1} current={current} path={path} counts={counts} color={color} open={open} drop={drop} />
        ))}
    </>
  );
}

function TreeItem({
  label,
  depth,
  on,
  color,
  count,
  expandable,
  expanded,
  onToggle,
  onClick,
  onFileDrop,
}: {
  label: string;
  depth: number;
  on: boolean;
  color: string;
  count?: number;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onClick: () => void;
  onFileDrop: (d: DragFile[]) => void;
}) {
  return (
    <DropTarget onFile={onFileDrop}>
      {(over) => (
        <div
          className={`group flex items-center h-9 rounded-xl text-sm transition ${
            over ? 'bg-accent-soft ring-2 ring-accent' : on ? 'bg-accent-soft text-ink font-bold' : 'hover:bg-sunken'
          }`}
          style={{ paddingLeft: 4 + depth * 16 }}
        >
          <button
            onClick={onToggle}
            aria-label={expanded ? 'Plegar' : 'Desplegar'}
            className={`size-6 grid place-items-center text-muted shrink-0 ${expandable ? '' : 'invisible'}`}
          >
            <ChevronRight width={14} height={14} className={`transition ${expanded ? 'rotate-90' : ''}`} />
          </button>
          <button onClick={onClick} className="flex-1 min-w-0 flex items-center gap-2 h-full pr-3 text-left">
            <svg viewBox="0 0 48 40" className="w-5 h-auto shrink-0" aria-hidden>
              <path d="M4 8a4 4 0 0 1 4-4h11l5 5h16a4 4 0 0 1 4 4v3H4z" fill={color} opacity=".55" />
              <rect x="4" y="13" width="40" height="23" rx="4" fill={count === 0 ? 'var(--line)' : color} />
            </svg>
            <span className="truncate flex-1">{label}</span>
            {count !== undefined && count > 0 && <span className="text-xs text-muted font-medium">{count}</span>}
          </button>
        </div>
      )}
    </DropTarget>
  );
}

function Tab({ on, onClick, count, children }: { on: boolean; onClick: () => void; count?: number; children: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!on) return;
    // Solo se mueve la fila de pestañas (scrollIntoView movería toda la página).
    const id = setTimeout(() => {
      const el = ref.current;
      const row = el?.parentElement;
      if (!el || !row) return;
      const delta = el.getBoundingClientRect().left - row.getBoundingClientRect().left;
      row.scrollTo({ left: row.scrollLeft + delta - row.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
    }, 0);
    return () => clearTimeout(id);
  }, [on]);
  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`shrink-0 h-9 px-4 rounded-full text-sm font-semibold border transition flex items-center gap-1.5 whitespace-nowrap ${
        on ? 'bg-ink text-bg border-ink' : 'bg-surface border-line'
      }`}
    >
      {children}
      {!!count && <span className={on ? 'opacity-70' : 'text-muted'}>{count}</span>}
    </button>
  );
}

function SheetAction({ icon, label, hint, onClick }: { icon: ReactNode; label: string; hint?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-sunken text-left">
      <span className="size-11 rounded-xl bg-accent-soft text-accent grid place-items-center shrink-0">{icon}</span>
      <span>
        <span className="font-semibold block">{label}</span>
        {hint && <span className="text-sm text-muted">{hint}</span>}
      </span>
    </button>
  );
}

function FolderCard({
  name,
  color,
  count,
  onClick,
  onFileDrop,
}: {
  name: string;
  color: string;
  count: number;
  onClick: () => void;
  onFileDrop: (d: DragFile[]) => void;
}) {
  return (
    <DropTarget onFile={onFileDrop}>
      {(over) => (
        <button
          onClick={onClick}
          className={`text-left border rounded-2xl flex items-center gap-3 p-3 transition active:scale-[.98] ${
            over ? 'bg-accent-soft border-accent ring-2 ring-accent scale-[1.03]' : 'bg-surface border-line hover:border-muted/40 hover:shadow-sm'
          }`}
        >
          <svg viewBox="0 0 48 40" className="w-9 h-auto shrink-0" aria-hidden>
            <path d="M4 8a4 4 0 0 1 4-4h11l5 5h16a4 4 0 0 1 4 4v3H4z" fill={color} opacity=".55" />
            <rect x="4" y="13" width="40" height="23" rx="4" fill={count ? color : 'var(--line)'} />
          </svg>
          <div className="min-w-0">
            <div className="font-semibold leading-snug line-clamp-2 text-[15px]">{name}</div>
            <div className="text-xs text-muted mt-0.5">
              {over ? 'Soltá para mover acá' : count ? `${count} ${count === 1 ? 'archivo' : 'archivos'}` : 'Vacía'}
            </div>
          </div>
        </button>
      )}
    </DropTarget>
  );
}

// Recibe un cuadradito de archivo arrastrado. "contents" no altera la grilla.
function DropTarget({ onFile, children }: { onFile: (d: DragFile[]) => void; children: (over: boolean) => ReactNode }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className="contents"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData(DRAG_TYPE);
        if (!raw) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        onFile(JSON.parse(raw));
      }}
    >
      {children(over)}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3" aria-label="Cargando">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="rounded-2xl border border-line overflow-hidden bg-surface">
          <div className="aspect-[4/3] skeleton" />
          <div className="p-3 space-y-2">
            <div className="h-3.5 rounded skeleton w-4/5" />
            <div className="h-3 rounded skeleton w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyDrop({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-3xl border border-dashed border-line py-14 px-6 text-center hover:border-accent transition"
    >
      <p className="font-bold text-lg">{title}</p>
      <p className="text-muted mt-1">
        Tocá acá para subir archivos
        <span className="hidden md:inline">, o arrastrá archivos y carpetas enteras a esta ventana</span>.
      </p>
    </button>
  );
}

function BarButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="h-10 px-3 rounded-xl text-sm font-semibold flex items-center gap-1.5 hover:bg-white/15 disabled:opacity-40 whitespace-nowrap"
    >
      {children}
    </button>
  );
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

// Dónde está un archivo dentro de la materia: 'Trabajos prácticos › TP1' o 'Suelto en la materia'.
function placeLabel(f: FileItem) {
  return (
    folderPath(f.folder)
      .map((x) => x.name)
      .join(' › ') || 'Suelto en la materia'
  );
}

function SortIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />
    </svg>
  );
}
