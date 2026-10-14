import { useEffect, useState } from 'react';

// Muestra una foto. Si el navegador no puede (por ejemplo, fotos HEIC de iPhone aunque digan .jpg),
// usa la versión que genera Google Drive, y si tampoco se puede, avisa en vez de quedar en negro.
export default function ImageView({
  blob,
  name,
  thumbnail,
  onOpenDrive,
}: {
  blob: Blob;
  name: string;
  thumbnail?: string;
  onOpenDrive?: () => void;
}) {
  const [url, setUrl] = useState('');
  const [stage, setStage] = useState<'original' | 'drive' | 'error'>('original');
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    setStage('original');
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  if (!url) return null;

  if (stage === 'error')
    return (
      <div className="h-full min-h-60 flex flex-col items-center justify-center text-center p-6">
        <p className="font-bold text-lg">No se pudo mostrar esta foto</p>
        <p className="text-muted mt-1 max-w-xs">Puede estar en un formato que este navegador no abre. En Google Drive se ve bien.</p>
        {onOpenDrive && (
          <button onClick={onOpenDrive} className="mt-5 h-11 px-5 rounded-xl bg-accent text-on-accent font-semibold">
            Abrir en Drive
          </button>
        )}
      </div>
    );

  const src = stage === 'drive' && thumbnail ? thumbnail.replace(/=s\d+$/, '=s2000') : url;

  return (
    <div className={`min-h-full flex p-3 ${zoom ? '' : 'items-center justify-center'}`}>
      <img
        key={stage}
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        onClick={() => setZoom((z) => !z)}
        onError={() => setStage(stage === 'original' && thumbnail ? 'drive' : 'error')}
        className={zoom ? 'max-w-none cursor-zoom-out' : 'max-w-full max-h-[calc(100dvh-7rem)] object-contain cursor-zoom-in rounded-lg'}
      />
    </div>
  );
}
