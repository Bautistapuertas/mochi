import { useState } from 'react';
import type { FileItem } from '../lib/facu';
import { KIND_STYLE, fmtDate, kindOf } from '../lib/files';
import { openFile } from '../lib/router';

// Para arrastrar un archivo a una carpeta dentro de la app.
export const DRAG_TYPE = 'application/x-mochi-file';

// Cuadradito de archivo: vista previa arriba (si Drive la tiene) y título abajo.
export default function FileTile({ file, code, title }: { file: FileItem; code?: string; title: string }) {
  const s = KIND_STYLE[kindOf(file)];
  const [thumbOk, setThumbOk] = useState(!!file.thumbnailLink);

  return (
    <button
      onClick={() => openFile(file.id)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ id: file.id, parents: file.parents ?? [] }));
        e.dataTransfer.effectAllowed = 'move';
      }}
      className="group text-left bg-surface border border-line rounded-2xl overflow-hidden flex flex-col hover:-translate-y-0.5 hover:shadow-md active:scale-[.98] transition"
    >
      <div
        className="relative aspect-[4/3] grid place-items-center overflow-hidden"
        style={{ background: `color-mix(in srgb, ${s.color} 10%, var(--sunken))` }}
      >
        {thumbOk ? (
          <img
            src={file.thumbnailLink!.replace(/=s\d+$/, '=s400')}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setThumbOk(false)}
            className="absolute inset-0 size-full object-cover object-top"
          />
        ) : (
          <DocGlyph color={s.color} label={s.label} />
        )}
        {code && (
          <span className="absolute top-2 left-2 h-6 px-2 rounded-lg bg-surface/95 text-ink text-xs font-extrabold grid place-items-center shadow-sm">
            {code}
          </span>
        )}
        {thumbOk && (
          <span
            className="absolute bottom-2 right-2 h-5 px-1.5 rounded-md text-[10px] font-extrabold grid place-items-center text-white"
            style={{ background: s.color }}
          >
            {s.label}
          </span>
        )}
      </div>
      <div className="px-3 pt-2.5 pb-3">
        <div className="font-semibold text-[14px] leading-snug line-clamp-2">{title}</div>
        <div className="text-xs text-muted mt-1">{fmtDate(file.modifiedTime)}</div>
      </div>
    </button>
  );
}

function DocGlyph({ color, label }: { color: string; label: string }) {
  return (
    <svg viewBox="0 0 64 76" className="w-14 h-auto" aria-hidden>
      <path d="M8 4h34l18 18v46a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z" fill="var(--surface)" stroke={color} strokeWidth="3" />
      <path d="M42 4v14a4 4 0 0 0 4 4h14" fill="none" stroke={color} strokeWidth="3" />
      <rect x="10" y="40" width="44" height="18" rx="5" fill={color} />
      <text x="32" y="53.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="inherit">
        {label}
      </text>
    </svg>
  );
}
