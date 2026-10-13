import { useState } from 'react';
import { useFacu } from '../lib/context';
import { move, type DFile } from '../lib/drive';
import { folderPath, materiaFolders, whereLabel } from '../lib/facu';
import { Button, Modal, errorText } from './ui';

// Mover uno o varios archivos a otra materia o carpeta.
export default function MoveModal({
  files,
  initialMateria,
  initialFolder,
  onClose,
  onMoved,
}: {
  files: DFile[];
  initialMateria?: string;
  initialFolder?: string;
  onClose: () => void;
  onMoved: (moved: DFile[], where: string) => void;
}) {
  const { tree } = useFacu();
  const [materiaId, setMateriaId] = useState(initialMateria ?? tree.years[0]?.materias[0]?.id ?? '');
  // '' = suelto en la materia, sin carpeta.
  const [folderId, setFolderId] = useState(initialFolder ?? '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState('');
  const unchanged = materiaId === initialMateria && folderId === (initialFolder ?? '');
  const materia = tree.materias.get(materiaId);
  const options = materia ? materiaFolders(materia) : [];

  return (
    <Modal title={files.length === 1 ? 'Mover archivo' : `Mover ${files.length} archivos`} onClose={busy ? () => {} : onClose}>
      <p className="font-semibold mb-2">Materia</p>
      <select
        value={materiaId}
        onChange={(e) => {
          setMateriaId(e.target.value);
          setFolderId('');
        }}
        className="w-full h-12 px-3 rounded-xl bg-sunken outline-none text-base mb-4"
      >
        {tree.years.map((y) => (
          <optgroup key={y.id} label={y.name}>
            {y.materias.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <p className="font-semibold mb-2">Carpeta</p>
      <select
        value={folderId}
        onChange={(e) => setFolderId(e.target.value)}
        className="w-full h-12 px-3 rounded-xl bg-sunken outline-none text-base"
      >
        <option value="">Sin carpeta (suelto en la materia)</option>
        {options.map((f) => (
          <option key={f.id} value={f.id}>
            {folderPath(f)
              .map((x) => x.name)
              .join(' › ')}
          </option>
        ))}
      </select>
      {error && <p className="text-danger mt-3">{error}</p>}
      <Button
        variant="primary"
        className="w-full mt-5"
        disabled={busy || unchanged || !materiaId}
        onClick={async () => {
          if (!materia) return;
          setBusy(true);
          setError('');
          const target = tree.folders.get(folderId);
          const to = target?.id ?? materia.id;
          const moved: DFile[] = [];
          try {
            for (const f of files) {
              if (!f.parents?.includes(to)) moved.push(await move(f.id, f.parents ?? [], to));
              setDone((n) => n + 1);
            }
            onMoved(moved, whereLabel({ materia, folder: target }));
            onClose();
          } catch (e) {
            setError(errorText(e));
            setBusy(false);
            if (moved.length) onMoved(moved, whereLabel({ materia, folder: target }));
          }
        }}
      >
        {busy ? (files.length > 1 ? `Moviendo ${done} de ${files.length}…` : 'Moviendo…') : 'Mover'}
      </Button>
    </Modal>
  );
}
