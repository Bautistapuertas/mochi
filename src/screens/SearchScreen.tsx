import { useEffect, useRef, useState } from 'react';
import FileRow from '../components/FileRow';
import { MateriaBadge } from '../components/MateriaCover';
import { Back, SearchIcon } from '../components/icons';
import { IconButton, Spinner } from '../components/ui';
import { useFacu } from '../lib/context';
import { searchFiles, type FileItem } from '../lib/facu';
import { go, setParam } from '../lib/router';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function SearchScreen({ initial }: { initial: string }) {
  const { tree } = useFacu();
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState<FileItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    const text = q.trim();
    setParam('q', text || null);
    if (text.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const n = ++latest.current;
    const t = setTimeout(async () => {
      const r = await searchFiles(tree, text).catch(() => []);
      if (n !== latest.current) return;
      setResults(r);
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [q, tree]);

  const materias = q.trim() ? [...tree.materias.values()].filter((m) => norm(m.name).includes(norm(q.trim()))) : [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 safe-top">
      <div className="flex items-center gap-2 pt-4 -ml-2">
        <IconButton label="Volver" onClick={() => go('/')}>
          <Back />
        </IconButton>
        <div className="flex-1 flex items-center gap-2 h-12 px-4 rounded-2xl bg-surface border border-accent">
          <SearchIcon className="text-muted shrink-0" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar en tus apuntes…"
            enterKeyHint="search"
            className="flex-1 bg-transparent outline-none text-base min-w-0"
          />
          {loading && <Spinner className="size-5 border-2" />}
        </div>
      </div>

      {materias.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-5">
          {materias.map((m) => (
            <button
              key={m.id}
              onClick={() => go(`/m/${m.id}`)}
              className="h-10 pl-2 pr-4 rounded-full bg-surface border border-line flex items-center gap-2 font-semibold text-sm hover:bg-sunken"
            >
              <MateriaBadge m={m} size={26} />
              {m.name}
            </button>
          ))}
        </div>
      )}

      {results === null ? (
        <p className="text-muted mt-8 text-center px-6">
          Escribí una palabra. Buscamos en el nombre de los archivos y también adentro de los PDF y los Word.
        </p>
      ) : results.length === 0 && !loading ? (
        <p className="text-muted mt-8 text-center">No encontramos nada con “{q.trim()}”.</p>
      ) : (
        <div className="bg-surface border border-line rounded-3xl p-1.5 mt-5">
          {results.map((f) => (
            <FileRow key={f.id} file={f} showWhere />
          ))}
        </div>
      )}
    </div>
  );
}
