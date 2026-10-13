import mammoth from 'mammoth/mammoth.browser.js';
import { useEffect, useState } from 'react';
import { Spinner } from '../components/ui';

export default function DocxView({ blob }: { blob: Blob }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    blob
      .arrayBuffer()
      .then((arrayBuffer) => mammoth.convertToHtml({ arrayBuffer }))
      .then((r) => alive && setHtml(r.value))
      .catch(() => alive && setError('No se pudo abrir este documento.'));
    return () => {
      alive = false;
    };
  }, [blob]);

  if (error) return <p className="text-center text-muted py-10">{error}</p>;
  if (html === null)
    return (
      <div className="py-16 grid place-items-center">
        <Spinner />
      </div>
    );
  return (
    <div className="px-3 sm:px-6 py-4">
      <article
        className="doc-body max-w-[800px] mx-auto bg-surface border border-line rounded-2xl px-5 sm:px-12 py-8 sm:py-12 text-[16px]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
