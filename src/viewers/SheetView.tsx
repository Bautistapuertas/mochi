import { read, utils, type WorkBook } from 'xlsx';
import { useEffect, useState } from 'react';
import { Spinner } from '../components/ui';

export default function SheetView({ blob }: { blob: Blob }) {
  const [book, setBook] = useState<WorkBook | null>(null);
  const [sheet, setSheet] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    blob
      .arrayBuffer()
      .then((buf) => alive && setBook(read(buf, { type: 'array' })))
      .catch(() => alive && setError('No se pudo abrir esta planilla.'));
    return () => {
      alive = false;
    };
  }, [blob]);

  if (error) return <p className="text-center text-muted py-10">{error}</p>;
  if (!book)
    return (
      <div className="py-16 grid place-items-center">
        <Spinner />
      </div>
    );

  const name = book.SheetNames[sheet];
  const html = utils.sheet_to_html(book.Sheets[name], { header: '', footer: '' });

  return (
    <div className="flex flex-col h-full">
      {book.SheetNames.length > 1 && (
        <div className="flex gap-1 overflow-x-auto px-3 py-2 border-b border-line bg-surface shrink-0">
          {book.SheetNames.map((n, i) => (
            <button
              key={n}
              onClick={() => setSheet(i)}
              className={`shrink-0 h-8 px-3 rounded-lg text-sm font-semibold ${i === sheet ? 'bg-ink text-bg' : 'hover:bg-sunken'}`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
      <div className="sheet flex-1 overflow-auto p-3" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
