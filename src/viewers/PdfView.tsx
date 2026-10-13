import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// Dibuja cada página recién cuando está por aparecer en pantalla.
export default function PdfView({ blob }: { blob: Blob }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const container = ref.current!;
    let observer: IntersectionObserver | undefined;
    let cancelled = false;
    const task = (async () => {
      const data = new Uint8Array(await blob.arrayBuffer());
      return pdfjs.getDocument({ data });
    })();

    task
      .then(async (loading) => {
        const doc = await loading.promise;
        if (cancelled) return;
        const first = await doc.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        observer = new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (!e.isIntersecting) continue;
              observer!.unobserve(e.target);
              renderPage(doc, e.target as HTMLDivElement).catch(() => {});
            }
          },
          { root: container.closest('[data-scroll]'), rootMargin: '1200px 0px' },
        );
        for (let i = 1; i <= doc.numPages; i++) {
          const el = document.createElement('div');
          el.className = 'pdf-page';
          el.dataset.page = String(i);
          el.style.aspectRatio = `${vp.width} / ${vp.height}`;
          container.appendChild(el);
          observer.observe(el);
        }
      })
      .catch(() => setError('No se pudo abrir este PDF.'));

    return () => {
      cancelled = true;
      observer?.disconnect();
      task.then((l) => l.destroy()).catch(() => {});
      container.replaceChildren();
    };
  }, [blob]);

  return (
    <div className="px-2 sm:px-6 py-4">
      {error && <p className="text-center text-muted py-10">{error}</p>}
      <div ref={ref} className="max-w-[900px] mx-auto flex flex-col gap-3" />
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
  el.appendChild(canvas);
}
