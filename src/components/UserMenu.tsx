import { useEffect, useRef, useState } from 'react';
import { useFacu } from '../lib/context';
import { Folder, Logout, Share } from './icons';
import { useToast } from './ui';

export default function UserMenu() {
  const { user, tree } = useFacu();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    addEventListener('mousedown', close);
    return () => removeEventListener('mousedown', close);
  }, [open]);

  const initial = (user?.name ?? '?').charAt(0).toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Tu cuenta"
        className="size-10 rounded-full overflow-hidden bg-accent-soft text-accent font-bold grid place-items-center"
      >
        {user?.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" className="size-full object-cover" /> : initial}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-72 bg-surface border border-line rounded-2xl shadow-lg p-1.5">
          <div className="px-3 py-2.5">
            <div className="font-semibold truncate">{user?.name}</div>
            <div className="text-sm text-muted truncate">{user?.email}</div>
          </div>
          <div className="h-px bg-line my-1" />
          {tree.rootLink && (
            <a href={tree.rootLink} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 h-11 rounded-xl hover:bg-sunken">
              <Folder /> Ver la carpeta en Google Drive
            </a>
          )}
          <button
            onClick={async () => {
              setOpen(false);
              const data = { title: 'Mochi', text: 'Organizá tus apuntes de la facu con Mochi', url: location.origin };
              try {
                if (navigator.share) await navigator.share(data);
                else {
                  await navigator.clipboard.writeText(location.origin);
                  toast('Link copiado. Pasáselo a tus compañeros.');
                }
              } catch {}
            }}
            className="w-full flex items-center gap-3 px-3 h-11 rounded-xl hover:bg-sunken text-left"
          >
            <Share /> Invitar a un compañero
          </button>
          <a href="/api/logout" className="flex items-center gap-3 px-3 h-11 rounded-xl hover:bg-sunken">
            <Logout /> Cerrar sesión
          </a>
        </div>
      )}
    </div>
  );
}
