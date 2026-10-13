import { lazy, Suspense, useEffect, useState } from 'react';
import MoveModal from '../components/MoveModal';
import { Back, Download, External, Move, Pencil, Trash } from '../components/icons';
import { Button, ConfirmModal, FileBadge, IconButton, Menu, PromptModal, Spinner, errorText, useToast } from '../components/ui';
import { notifyChanged, useFacu } from '../lib/context';
import { download, fileCache, getFile, rename, saveContent, trash, type DFile } from '../lib/drive';
import { DRAWING_MIME, itemOf, whereLabel } from '../lib/facu';
import { baseName, canPreview, extOf, kindOf, saveBlob } from '../lib/files';
import { closeFile } from '../lib/router';

const PdfView = lazy(() => import('../viewers/PdfView'));
const DocxView = lazy(() => import('../viewers/DocxView'));
const SheetView = lazy(() => import('../viewers/SheetView'));
const ImageView = lazy(() => import('../viewers/ImageView'));
const DrawingView = lazy(() => import('../viewers/DrawingView'));

export default function Viewer({ id }: { id: string }) {
  const { tree } = useFacu();
  const toast = useToast();
  const [file, setFile] = useState<DFile | null>(fileCache.get(id) ?? null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'rename' | 'move' | 'delete' | null>(null);

  useEffect(() => {
    if (!file) getFile(id).then(setFile, (e) => setError(errorText(e)));
  }, [id, file]);

  const fileId = file?.id;
  const previewable = !!file && canPreview(file);
  useEffect(() => {
    if (!fileId || !previewable) return;
    let alive = true;
    download(fileId).then(
      (b) => alive && setBlob(b),
      (e) => alive && setError(errorText(e)),
    );
    return () => {
      alive = false;
    };
  }, [fileId, previewable]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && !modal && closeFile();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [modal]);

  const item = file ? itemOf(tree, file) : null;
  const kind = file ? kindOf(file) : 'other';

  async function onDownload() {
    if (!file) return;
    try {
      saveBlob(blob ?? (await download(file.id)), file.name);
    } catch (e) {
      toast(errorText(e));
    }
  }

  const openInDrive = () => file?.webViewLink && open(file.webViewLink, '_blank');

  let body;
  if (error) body = <Center>{error}</Center>;
  else if (!file) body = <Center><Spinner /></Center>;
  else if (!previewable)
    body = (
      <Center>
        <FileBadge file={file} size="lg" />
        <p className="font-bold text-lg mt-4">{baseName(file.name)}</p>
        <p className="text-muted mt-1 max-w-xs">Este tipo de archivo (.{extOf(file.name)}) se ve mejor en Google Drive.</p>
        <div className="flex gap-2 mt-5">
          <Button variant="primary" onClick={openInDrive}>
            <External /> Abrir en Drive
          </Button>
          <Button onClick={onDownload}>
            <Download /> Descargar
          </Button>
        </div>
      </Center>
    );
  else if (!blob) body = <Center><Spinner /><p className="text-muted mt-3">Abriendo…</p></Center>;
  else
    body = (
      <Suspense fallback={<Center><Spinner /></Center>}>
        {kind === 'pdf' && <PdfView blob={blob} />}
        {kind === 'word' && <DocxView blob={blob} />}
        {kind === 'excel' && <SheetView blob={blob} />}
        {kind === 'image' && <ImageView blob={blob} name={file.name} />}
        {kind === 'excalidraw' && (
          <DrawingView
            blob={blob}
            onSave={async (json) => {
              setFile(await saveContent(file.id, new Blob([json], { type: DRAWING_MIME })));
              notifyChanged();
            }}
          />
        )}
      </Suspense>
    );

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col safe-top">
      <header className="h-14 shrink-0 flex items-center gap-1 px-2 border-b border-line bg-surface">
        <IconButton label="Cerrar" onClick={closeFile}>
          <Back />
        </IconButton>
        <div className="min-w-0 flex-1 px-1">
          <div className="font-semibold truncate leading-tight">{file ? baseName(file.name) : ''}</div>
          {item && (
            <div className="text-xs text-muted truncate">{whereLabel(item)}</div>
          )}
        </div>
        {file && (
          <>
            <IconButton label="Descargar" onClick={onDownload}>
              <Download />
            </IconButton>
            <Menu
              items={[
                { label: 'Abrir en Google Drive', icon: <External />, onClick: openInDrive },
                { label: 'Cambiar nombre', icon: <Pencil />, onClick: () => setModal('rename') },
                { label: 'Mover a otra carpeta', icon: <Move />, onClick: () => setModal('move') },
                { label: 'Eliminar', icon: <Trash />, danger: true, onClick: () => setModal('delete') },
              ]}
            />
          </>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-auto relative" data-scroll>
        {body}
      </div>

      {file && modal === 'rename' && (
        <PromptModal
          title="Nombre del archivo"
          initial={baseName(file.name)}
          onClose={() => setModal(null)}
          onSubmit={async (name) => {
            const ext = extOf(file.name);
            setFile(await rename(file.id, ext ? `${name}.${ext}` : name));
            notifyChanged();
          }}
        />
      )}
      {file && modal === 'move' && (
        <MoveModal
          files={[file]}
          initialMateria={item?.materia.id}
          initialFolder={item?.folder?.id}
          onClose={() => setModal(null)}
          onMoved={(moved, where) => {
            if (moved[0]) setFile(moved[0]);
            notifyChanged();
            toast(`Movido a ${where}`);
          }}
        />
      )}
      {file && modal === 'delete' && (
        <ConfirmModal
          title="¿Eliminar este archivo?"
          text="Va a la papelera de Google Drive. Podés recuperarlo desde ahí durante 30 días."
          action="Eliminar"
          onClose={() => setModal(null)}
          onConfirm={async () => {
            await trash(file.id);
            notifyChanged();
            closeFile();
            toast('Archivo en la papelera de Drive');
          }}
        />
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="h-full min-h-60 flex flex-col items-center justify-center text-center p-6">{children}</div>;
}
