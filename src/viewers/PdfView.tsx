import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const ZOOMS = [0.75, 1, 1.25, 1.5, 2, 2.5, 3];

// Dibuja cada página recién cuando está por aparecer en pantalla.
// Abajo muestra en qué página estás y botones de zoom.
export default function PdfView({ blob }: { blob: Blob }) {
  const ref = useRef<HTMLDivElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const renderObs = useRef<IntersectionObserver | null>(null);
  const [error, setError] = useState('');
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);

  // Carga el documento y arma un lugar vacío por página.
  useEffect(() => {
    const container = ref.current!;
    let cancelled = false;
    let pageObs: IntersectionObserver | undefined;
    const task = (async () => pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }))();

    task
      .then(async (loading) => {
        const doc = await loading.promise;
        if (cancelled) return;
        docRef.current = doc;
        const vp = (await doc.getPage(1)).getViewport({ scale: 1 });
        const root = container.closest('[data-scroll]');
        renderObs.current = new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (!e.isIntersecting) continue;
              renderObs.current!.unobserve(e.target);
              renderPage(doc, e.target as HTMLDivElement).catch(() => {});
            }
          },
          { root, rootMargin: '1200px 0px' },
        );
        // Página actual: la que ocupa el centro de la pantalla.
        pageObs = new IntersectionObserver(
          (entries) => {
            for (const e of entries) if (e.isIntersecting) setPage(Number((e.target as HTMLElement).dataset.page));
          },
          { root, rootMargin: '-50% 0px -50% 0px' },
        );
        for (let i = 1; i <= doc.numPages; i++) {
          const el = document.createElement('div');
          el.className = 'pdf-page';
          el.dataset.page = String(i);
          el.style.aspectRatio = `${vp.width} / ${vp.height}`;
          container.appendChild(el);
          renderObs.current.observe(el);
          pageObs.observe(el);
        }
        setPages(doc.numPages);
      })
      .catch(() => !cancelled && setError('No se pudo abrir este PDF.'));

    return () => {
      cancelled = true;
      renderObs.current?.disconnect();
      pageObs?.disconnect();
      task.then((l) => l.destroy()).catch(() => {});
      container.replaceChildren();
      docRef.current = null;
    };
  }, [blob]);

  // Al cambiar el zoom se vuelven a dibujar las páginas con más resolución.
  useEffect(() => {
    const container = ref.current;
    if (!container || !renderObs.current) return;
    for (const el of container.children as HTMLCollectionOf<HTMLDivElement>) {
      el.replaceChildren();
      renderObs.current.observe(el);
    }
  }, [zoom]);

  const zi = ZOOMS.indexOf(zoom);

  return (
    <div className="px-2 sm:px-6 py-4 pb-24">
      {error && <p className="text-center text-muted py-10">{error}</p>}
      <div
        ref={ref}
        className="mx-auto flex flex-col gap-3"
        style={{ width: `calc(min(100%, 900px) * ${zoom})` }}
      />
      {pages > 0 && (
        <div className="fixed bottom-5 inset-x-0 z-10 flex justify-center pointer-events-none safe-bottom">
          <div className="pointer-events-auto flex items-center gap-1 bg-ink/90 text-bg rounded-full shadow-lg px-1.5 h-11 backdrop-blur">
            <button
              onClick={() => setZoom(ZOOMS[Math.max(0, zi - 1)])}
              disabled={zi <= 0}
              aria-label="Alejar"
              className="size-9 rounded-full grid place-items-center text-lg font-bold hover:bg-white/15 disabled:opacity-40"
            >
              −
            </button>
            <span className="text-sm font-semibold tabular-nums px-2 min-w-20 text-center">
              {page} / {pages}
            </span>
            <button
              onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, zi + 1)])}
              disabled={zi >= ZOOMS.length - 1}
              aria-label="Acercar"
              className="size-9 rounded-full grid place-items-center text-lg font-bold hover:bg-white/15 disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

async function renderPage(doc: PDFDocumentProxy, el: HTMLDivElement) {
  const page = await doc.getPage(Number(el.dataset.page));
  const base = page.getViewport({ scale: 1 });
  el.style.aspectRatio = `${base.width} / ${base.height}`;
  const scale = (el.clientWidth / base.width) * Math.min(devicePixelRatio || 1, 2) * 1.25;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = '100%';
  canvas.style.display = 'block';
  await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
  el.replaceChildren(canvas);
}
