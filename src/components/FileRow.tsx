import type { FileItem } from '../lib/facu';
import { baseName, fmtDate } from '../lib/files';
import { openFile } from '../lib/router';
import { FileBadge } from './ui';

export default function FileRow({ file, showWhere = false }: { file: FileItem; showWhere?: boolean }) {
  const where = showWhere ? [file.materia.name, file.folder?.name].filter(Boolean).join(' · ') : null;
  const meta = [where, fmtDate(file.modifiedTime)]
    .filter(Boolean)
    .join(' · ');
  return (
    <button
      onClick={() => openFile(file.id)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left hover:bg-sunken active:bg-sunken transition"
    >
      <FileBadge file={file} />
      <div className="min-w-0 flex-1">
        <div className="font-semibold truncate">{baseName(file.name)}</div>
        <div className="text-sm text-muted truncate">{meta}</div>
      </div>
    </button>
  );
}
