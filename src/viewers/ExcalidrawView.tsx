import { useCallback, useEffect, useRef, useState } from 'react';
import { Excalidraw, restore, serializeAsJSON } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { saveContent, type DFile } from '../lib/drive';
import { notifyChanged } from '../lib/context';
import { isDark } from '../lib/theme';
import { Spinner, errorText, useToast } from '../components/ui';
import { Check, CloudUpload, Save } from 'lucide-react';

export default function ExcalidrawView({
  blob,
  file,
}: {
  blob: Blob;
  file: DFile;
}) {
  const toast = useToast();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiRef = useRef<any>(null);
  const [initialData, setInitialData] = useState<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    elements: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    appState: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    files: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carga inicial del archivo .excalidraw
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const text = await blob.text();
        if (!alive) return;
        if (!text || !text.trim()) {
          setInitialData({ elements: [], appState: { isLoading: false }, files: {} });
          setLoading(false);
          return;
        }
        const parsed = JSON.parse(text);
        const restored = restore(parsed, null, null);
        setInitialData({
          elements: restored.elements,
          appState: { ...restored.appState, isLoading: false },
          files: restored.files,
        });
      } catch (e) {
        console.error('Error al parsear Excalidraw:', e);
        // Si no es un JSON válido, empieza en blanco
        setInitialData({ elements: [], appState: { isLoading: false }, files: {} });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [blob]);

  // Función para guardar en Google Drive / Mochi
  const handleSave = useCallback(
    async (silent = false) => {
      if (!apiRef.current || isSaving) return;
      const api = apiRef.current;
      const elements = api.getSceneElements();
      const appState = api.getAppState();
      const files = api.getFiles();

      const json = serializeAsJSON(elements, appState, files, 'local');
      const newBlob = new Blob([json], { type: 'application/vnd.excalidraw+json' });

      setIsSaving(true);
      try {
        await saveContent(file.id, newBlob);
        setDirty(false);
        setLastSaved(new Date());
        notifyChanged();
        if (!silent) toast('Pizarra guardada en Mochi');
      } catch (err) {
        toast(errorText(err));
      } finally {
        setIsSaving(false);
      }
    },
    [file.id, isSaving, toast],
  );

  // Atajo Ctrl+S / Cmd+S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave]);

  // Autoguardado con debounce de 3.5 segundos
  const handleChange = useCallback(() => {
    setDirty(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      handleSave(true);
    }, 3500);
  }, [handleSave]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (loading || !initialData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3">
        <Spinner />
        <p className="text-muted text-sm">Cargando pizarra…</p>
      </div>
    );
  }

  const dark = isDark();

  return (
    <div className="relative flex-1 w-full h-full flex flex-col min-h-0 overflow-hidden select-none">
      {/* Canvas de Excalidraw */}
      <div className="flex-1 w-full h-full min-h-0">
        <Excalidraw
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          excalidrawAPI={(api: any) => {
            apiRef.current = api;
          }}
          initialData={initialData}
          onChange={handleChange}
          theme={dark ? 'dark' : 'light'}
          langCode="es-ES"
          renderTopRightUI={(isMobile) => (
            <div className="flex items-center gap-1.5 mr-2">
              {isSaving ? (
                <span className="flex items-center gap-1.5 text-xs text-muted font-medium px-2 py-1 bg-surface/90 rounded-lg border border-line">
                  <Spinner />
                  {!isMobile && <span>Guardando…</span>}
                </span>
              ) : dirty ? (
                <span className="flex items-center gap-1.5 text-xs text-amber-500 font-medium px-2 py-1 bg-surface/90 rounded-lg border border-line">
                  <CloudUpload className="size-3.5" />
                  {!isMobile && <span>Sin guardar</span>}
                </span>
              ) : lastSaved ? (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium px-2 py-1 bg-surface/90 rounded-lg border border-line">
                  <Check className="size-3.5" />
                  {!isMobile && <span>Guardado</span>}
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => handleSave()}
                disabled={isSaving}
                title="Guardar en Mochi (Ctrl+S)"
                className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer select-none ${
                  dirty
                    ? 'bg-accent text-on-accent hover:opacity-90 active:scale-95 shadow-sm'
                    : 'bg-surface hover:bg-sunken text-ink border border-line active:scale-95'
                }`}
              >
                <Save className="size-3.5" />
                <span>Guardar</span>
              </button>
            </div>
          )}
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: true,
              export: { saveFileToDisk: true },
            },
          }}
        />
      </div>
    </div>
  );
}
