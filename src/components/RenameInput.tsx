import { useEffect, useRef, useState } from 'react';
import { extOf } from '../lib/files';

// Cambiar el nombre ahí mismo, como con F2 en Windows: se marca el nombre sin la extensión.
// Enter guarda, Escape cancela, y hacer clic afuera también guarda.
export default function RenameInput({ initial, isFile, onDone }: { initial: string; isFile: boolean; onDone: (name: string | null) => void }) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current!;
    el.focus();
    const ext = isFile ? extOf(initial) : '';
    el.setSelectionRange(0, ext ? initial.length - ext.length - 1 : initial.length);
  }, [initial, isFile]);

  const finish = (name: string | null) => {
    if (done.current) return;
    done.current = true;
    const v = name?.trim();
    onDone(v && v !== initial ? v : null);
  };

  return (
    <textarea
      ref={ref}
      value={value}
      rows={2}
      spellCheck={false}
      onChange={(e) => setValue(e.target.value.replace(/\n/g, ''))}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(value);
        }
        if (e.key === 'Escape') finish(null);
      }}
      onBlur={() => finish(value)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      aria-label="Nombre nuevo"
      className="w-full resize-none rounded-md border border-accent bg-surface px-1.5 py-0.5 text-[14px] font-semibold leading-snug outline-none"
    />
  );
}
