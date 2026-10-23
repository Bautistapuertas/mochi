import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type CtxItem =
  | { label: string; icon?: ReactNode; shortcut?: string; onClick: () => void; danger?: boolean; disabled?: boolean }
  | 'sep';

// Menú del clic derecho, como el del Explorador de Windows: aparece donde está el mouse.
export default function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: CtxItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Si no entra a la derecha o abajo, se abre para el otro lado.
  useLayoutEffect(() => {
    const r = ref.current!.getBoundingClientRect();
    setPos({
      left: x + r.width > innerWidth - 8 ? Math.max(8, x - r.width) : x,
      top: y + r.height > innerHeight - 8 ? Math.max(8, y - r.height) : y,
    });
  }, [x, y]);

  useEffect(() => {
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    addEventListener('mousedown', down, true);
    addEventListener('keydown', key, true);
    addEventListener('blur', onClose);
    addEventListener('resize', onClose);
    addEventListener('scroll', onClose, true);
    return () => {
      removeEventListener('mousedown', down, true);
      removeEventListener('keydown', key, true);
      removeEventListener('blur', onClose);
      removeEventListener('resize', onClose);
      removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
      style={pos}
      className="fixed z-[90] min-w-60 bg-surface border border-line rounded-xl shadow-lg p-1 text-[14px] fade-in"
    >
      {items.map((it, i) =>
        it === 'sep' ? (
          <div key={i} className="h-px bg-line my-1 mx-2" />
        ) : (
          <button
            key={it.label}
            role="menuitem"
            disabled={it.disabled}
            onClick={() => {
              onClose();
              it.onClick();
            }}
            className={`w-full flex items-center gap-3 px-2.5 h-9 rounded-lg text-left hover:bg-sunken disabled:opacity-40 disabled:pointer-events-none ${
              it.danger ? 'text-danger' : ''
            }`}
          >
            <span className="w-5 grid place-items-center opacity-80 shrink-0">{it.icon}</span>
            <span className="flex-1">{it.label}</span>
            {it.shortcut && <span className="text-xs text-muted pl-4">{it.shortcut}</span>}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}
