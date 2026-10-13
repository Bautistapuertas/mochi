import { useEffect, useRef, useState } from 'react';
import { useFacu } from '../lib/context';
import { fmtSize } from '../lib/files';
import { summarize, uploadItems, type Progress, type UploadItem } from '../lib/upload';
import { Button, Modal, errorText } from './ui';

// Sube directo al destino, sin preguntas, y muestra el progreso.
export default function UploadSheet({
  items,
  parentId,
  destName,
  onClose,
  onDone,
}: {
  items: UploadItem[];
  parentId: string;
  destName: string;
  onClose: () => void;
  onDone: (count: number) => void;
}) {
  const { tree } = useFacu();
  const done = useRef<boolean[]>(items.map(() => false));
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const started = useRef(false);
  const info = summarize(items);

  async function start() {
    setError('');
    setRunning(true);
    try {
      await uploadItems(tree, parentId, items, done.current, setProgress);
      onDone(items.length);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const count = progress?.done.filter(Boolean).length ?? 0;
  const pct = progress && progress.total ? (progress.bytes / progress.total) * 100 : 0;

  return (
    <Modal title={`Subiendo a ${destName}`} onClose={running ? () => {} : onClose}>
      <p className="text-muted">
        {info.files} {info.files === 1 ? 'archivo' : 'archivos'}
        {info.folders > 0 && ` en ${info.folders} ${info.folders === 1 ? 'carpeta' : 'carpetas'}`} · {fmtSize(String(info.bytes))}
      </p>
      <div className="h-2.5 rounded-full bg-sunken mt-4 overflow-hidden">
        <div className="h-full bg-accent transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-sm mt-2 gap-4">
        <span className="text-muted truncate">{progress?.current ?? (running ? 'Preparando…' : '')}</span>
        <span className="font-semibold shrink-0">
          {count} de {info.files}
        </span>
      </div>
      {error && (
        <>
          <p className="text-danger mt-4 text-[15px]">{error}</p>
          <p className="text-muted text-sm mt-1">Lo que ya se subió queda guardado. Reintentá para subir el resto.</p>
          <div className="flex gap-3 mt-4">
            <Button className="flex-1" onClick={onClose}>
              Cerrar
            </Button>
            <Button variant="primary" className="flex-1" onClick={start}>
              Reintentar
            </Button>
          </div>
        </>
      )}
      {running && <p className="text-sm text-muted mt-4">No cierres la app hasta que termine.</p>}
    </Modal>
  );
}
