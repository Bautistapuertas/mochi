import { useRef, useState } from 'react';
import type { FileItem } from '../lib/facu';
import { KIND_STYLE, fmtDate, kindOf } from '../lib/files';
import { openFile } from '../lib/router';
import { Check } from './icons';

// Para arrastrar archivos a una carpeta dentro de la app.
export const DRAG_TYPE = 'application/x-mochi-files';
export type DragFile = { id: string; parents: string[] };

// Cuadradito de archivo: vista previa arriba (si Drive la tiene) y título abajo.
// Con onToggle se puede seleccionar: círculo al pasar el mouse, o mantener apretado en el celu.
export default function FileTile({
  file,
  code,
  title,
  subtitle,
  selected = false,
  selecting = false,
  onToggle,
  dragFiles,
}: {
  file: FileItem;
  code?: string;
  title: string;
  subtitle?: string;
  selected?: boolean;
  selecting?: boolean;
  onToggle?: () => void;
  // Qué se arrastra: este archivo, o todos los seleccionados.
  dragFiles?: () => DragFile[];
}) {
  const s = KIND_STYLE[kindOf(file)];
  const [thumbOk, setThumbOk] = useState(!!file.thumbnailLink);
  const press = useRef<number>(undefined);
  const longPressed = useRef(false);

  return (
    <div className="relative group">
      <button
        onClick={() => {
          if (longPressed.current) return void (longPressed.current = false);
          if (selecting && onToggle) onToggle();
          else openFile(file.id);
        }}
        draggable
        onDragStart={(e) => {
          const list = dragFiles?.() ?? [{ id: file.id, parents: file.parents ?? [] }];
          e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(list));
          e.dataTransfer.effectAllowed = 'move';
        }}
        onTouchStart={() => {
          if (!onToggle) return;
          press.current = window.setTimeout(() => {
            longPressed.current = true;
            navigator.vibrate?.(15);
            onToggle();
          }, 450);
        }}
        onTouchEnd={() => clearTimeout(press.current)}
        onTouchMove={() => clearTimeout(press.current)}
        onContextMenu={(e) => onToggle && e.preventDefault()}
        className={`w-full h-full text-left bg-surface border rounded-2xl overflow-hidden flex flex-col transition select-none [-webkit-touch-callout:none] ${
          selected
            ? 'border-accent ring-2 ring-accent'
            : 'border-line hover:-translate-y-0.5 hover:shadow-md active:scale-[.98]'
        }`}
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
              draggable={false}
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
          {selected && <span className="absolute inset-0 bg-accent/15" />}
        </div>
        <div className="px-3 pt-2.5 pb-3">
          <div className="font-semibold text-[14px] leading-snug line-clamp-2">{title}</div>
          <div className="text-xs text-muted mt-1 truncate">{subtitle ?? fmtDate(file.modifiedTime)}</div>
        </div>
      </button>
      {onToggle && (
        <button
          onClick={onToggle}
          aria-label={selected ? 'Quitar de la selección' : 'Seleccionar'}
          aria-pressed={selected}
          className={`absolute top-2 right-2 size-7 rounded-full grid place-items-center border-2 transition ${
            selected
              ? 'bg-accent border-accent text-white'
              : `bg-surface/90 border-white/80 text-transparent shadow ${selecting ? '' : 'opacity-0 group-hover:opacity-100 [@media(hover:none)]:hidden'}`
          }`}
        >
          <Check width={16} height={16} />
        </button>
      )}
    </div>
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
