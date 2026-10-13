import { Excalidraw, serializeAsJSON } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useEffect, useRef, useState } from 'react';
import { Spinner } from '../components/ui';

type Status = 'saved' | 'pending' | 'saving' | 'error';

// Editor de Excalidraw que guarda solo en Drive unos segundos después de cada cambio.
export default function DrawingView({ blob, onSave }: { blob: Blob; onSave: (json: string) => Promise<void> }) {
  const [initial, setInitial] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState<Status>('saved');
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const savedVersion = useRef<number | null>(null);
  const timer = useRef<number>(undefined);
  const saving = useRef<Promise<void> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    blob.text().then((text) => {
      try {
        const j = JSON.parse(text || '{}');
        const appState = { ...(j.appState ?? {}) };
        delete appState.collaborators;
        setInitial({ elements: j.elements ?? [], appState, files: j.files ?? {}, scrollToContent: true });
      } catch {
        setInitial({ elements: [] });
      }
    });
  }, [blob]);

  const version = () =>
    api.current?.getSceneElementsIncludingDeleted().reduce((s, e) => s + e.version, 0) ?? 0;

  async function save() {
    const a = api.current;
    if (!a) return;
    await saving.current;
    const v = version();
    if (v === savedVersion.current) return setStatus('saved');
    setStatus('saving');
    const json = serializeAsJSON(a.getSceneElements(), a.getAppState(), a.getFiles(), 'local');
    saving.current = onSaveRef.current(json);
    try {
      await saving.current;
      savedVersion.current = v;
      setStatus(version() === v ? 'saved' : 'pending');
    } catch {
      setStatus('error');
    } finally {
      saving.current = null;
    }
  }

  // Guarda lo pendiente al salir.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (api.current && savedVersion.current !== null && version() !== savedVersion.current) save();
    },
    [],
  );

  if (!initial)
    return (
      <div className="h-full grid place-items-center">
        <Spinner />
      </div>
    );

  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const label = { saved: 'Guardado', pending: 'Sin guardar…', saving: 'Guardando…', error: 'Error al guardar' }[status];

  return (
    <div className="absolute inset-0">
      <Excalidraw
        excalidrawAPI={(a) => (api.current = a)}
        initialData={initial}
        langCode="es-ES"
        theme={dark ? 'dark' : 'light'}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false } }}
        onChange={() => {
          if (savedVersion.current === null) {
            savedVersion.current = version();
            return;
          }
          if (version() === savedVersion.current) return;
          setStatus('pending');
          clearTimeout(timer.current);
          timer.current = window.setTimeout(save, 1500);
        }}
        renderTopRightUI={() => (
          <button
            onClick={save}
            className={`h-9 px-3 rounded-lg text-sm font-semibold border ${
              status === 'error' ? 'border-danger text-danger' : 'border-line text-muted'
            } bg-surface`}
          >
            {label}
          </button>
        )}
      />
    </div>
  );
}
