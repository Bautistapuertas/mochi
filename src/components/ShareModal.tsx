import { useState } from 'react';
import { useFacu } from '../lib/context';
import { shareFolder, unshareFolder } from '../lib/drive';
import { shareLink } from '../lib/shared';
import { Check, Share } from './icons';
import { Button, Modal, errorText, useToast } from './ui';

// Compartir una carpeta o materia con un link para que un compañero la copie a su Mochi.
export default function ShareModal({
  target,
  onClose,
}: {
  target: { id: string; name: string; compartido: boolean };
  onClose: () => void;
}) {
  const { reload } = useFacu();
  const toast = useToast();
  const [shared, setShared] = useState(target.compartido);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const link = shareLink(target.id);

  async function run(fn: () => Promise<unknown>, next: boolean) {
    setBusy(true);
    setError('');
    try {
      await fn();
      setShared(next);
      await reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('No se pudo copiar. Mantené apretado el link para copiarlo.');
    }
  }

  async function send() {
    try {
      await navigator.share({ title: target.name, text: `Te comparto "${target.name}" en Mochi`, url: link });
    } catch {}
  }

  return (
    <Modal title={`Compartir ${target.name}`} onClose={onClose}>
      {!shared ? (
        <>
          <p className="text-muted">
            Se crea un link para que un compañero pueda <b className="text-ink">copiar estos apuntes a su Mochi</b>, con
            todas sus carpetas y archivos.
          </p>
          <div className="mt-4 rounded-2xl bg-sunken p-4 text-[15px]">
            <p className="font-semibold">Antes de compartir</p>
            <ul className="text-muted mt-1 space-y-1 list-disc pl-5">
              <li>Cualquiera que tenga el link puede ver esta carpeta. Nadie la encuentra si no se lo pasás.</li>
              <li>Solo pueden verla y copiarla. No pueden cambiar ni borrar nada tuyo.</li>
              <li>Podés dejar de compartirla cuando quieras.</li>
            </ul>
          </div>
          {error && <p className="text-danger mt-3 text-[15px]">{error}</p>}
          <Button variant="primary" className="w-full mt-5" disabled={busy} onClick={() => run(() => shareFolder(target.id), true)}>
            {busy ? 'Creando link…' : 'Crear link para compartir'}
          </Button>
        </>
      ) : (
        <>
          <p className="text-muted">Mandale este link a tu compañero. Al abrirlo, elige en qué materia guardarlo.</p>
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-sunken p-2 pl-4">
            <span className="flex-1 min-w-0 truncate text-[15px] select-all">{link}</span>
            <Button onClick={copy} className="h-9 px-3 shrink-0">
              {copied ? (
                <>
                  <Check width={18} height={18} /> Copiado
                </>
              ) : (
                'Copiar'
              )}
            </Button>
          </div>
          {'share' in navigator && (
            <Button variant="primary" className="w-full mt-3" onClick={send}>
              <Share /> Mandar por WhatsApp u otra app
            </Button>
          )}
          {error && <p className="text-danger mt-3 text-[15px]">{error}</p>}
          <button
            disabled={busy}
            onClick={() => run(() => unshareFolder(target.id), false)}
            className="w-full mt-4 h-10 text-sm font-semibold text-danger hover:underline disabled:opacity-50"
          >
            {busy ? 'Un momento…' : 'Dejar de compartir'}
          </button>
        </>
      )}
    </Modal>
  );
}
