import { useEffect, useState } from 'react';

export default function ImageView({ blob, name }: { blob: Blob; name: string }) {
  const [url, setUrl] = useState('');
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  if (!url) return null;
  return (
    <div className={`min-h-full flex p-3 ${zoom ? '' : 'items-center justify-center'}`}>
      <img
        src={url}
        alt={name}
        onClick={() => setZoom((z) => !z)}
        className={zoom ? 'max-w-none cursor-zoom-out' : 'max-w-full max-h-[calc(100dvh-7rem)] object-contain cursor-zoom-in rounded-lg'}
      />
    </div>
  );
}
