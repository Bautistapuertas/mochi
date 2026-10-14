import { Sparkles } from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Close, Plus } from '../components/icons';
import { Button, Spinner } from '../components/ui';
import { notifyChanged, useFacu } from '../lib/context';
import { CHANGES, IaError, activity, ask, contexto, describe, runTool, type Call, type Content } from '../lib/ia';
import { getLastMateria } from '../lib/router';

type Item =
  | { kind: 'user'; text: string }
  | { kind: 'bot'; text: string }
  | { kind: 'activity'; text: string; done: boolean }
  | { kind: 'confirm'; id: number; text: string; status: 'pending' | 'ok' | 'cancel' | 'error'; error?: string }
  | { kind: 'error'; text: string };

// La conversación sigue mientras la app esté abierta, aunque cambies de pantalla.
const memory: { items: Item[]; contents: Content[]; restantes: number | null } = { items: [], contents: [], restantes: null };

export default function AsistenteScreen() {
  return <Chat variant="page" />;
}

export function Chat({ variant, onClose }: { variant: 'page' | 'panel'; onClose?: () => void }) {
  const panel = variant === 'panel';
  const { tree, reload, user } = useFacu();
  const [items, setItems] = useState<Item[]>(memory.items);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [restantes, setRestantes] = useState(memory.restantes);
  const pending = useRef(new Map<number, (ok: boolean) => void>());
  const bottom = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const materia = tree.materias.get(getLastMateria() ?? '');

  // Guarda la conversación al salir de la pantalla.
  useEffect(() => {
    memory.items = items;
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [items]);

  const add = (it: Item) => setItems((xs) => [...xs, it]);
  const patchLast = (fn: (it: Item) => Item) => setItems((xs) => [...xs.slice(0, -1), fn(xs[xs.length - 1])]);

  function confirm(call: Call): Promise<boolean> {
    const id = nextId.current++;
    add({ kind: 'confirm', id, text: describe(tree, call), status: 'pending' });
    return new Promise((ok) => pending.current.set(id, ok));
  }

  function decide(id: number, ok: boolean) {
    pending.current.get(id)?.(ok);
    pending.current.delete(id);
  }

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setText('');
    setBusy(true);
    add({ kind: 'user', text: q });
    const contents = [...memory.contents, { role: 'user' as const, parts: [{ text: q }] }];
    let changed = false;
    try {
      // Va y viene con Gemini hasta que responde sin pedir más herramientas.
      for (let step = 0; step < 8; step++) {
        const r = await ask(contents, contexto(tree, user?.name, materia?.id));
        if (r.restantes !== null) {
          setRestantes(r.restantes);
          memory.restantes = r.restantes;
        }
        if (!r.content?.parts?.length) throw new IaError('Gemini no devolvió respuesta. Probá preguntarlo de otra forma.', 'vacio');
        contents.push({ role: 'model', parts: r.content.parts });
        const said = r.content.parts.map((p) => p.text ?? '').join('').trim();
        if (said) add({ kind: 'bot', text: said });
        const calls = r.content.parts.filter((p) => p.functionCall).map((p) => ({ name: p.functionCall!.name, args: p.functionCall!.args ?? {} }));
        if (!calls.length) break;

        const responses = [];
        for (const call of calls) {
          let response: unknown;
          if (CHANGES.has(call.name)) {
            const ok = await confirm(call);
            if (!ok) {
              patchConfirm('cancel');
              response = { cancelado: true, mensaje: 'El usuario no quiso hacer este cambio.' };
            } else {
              try {
                response = await runTool(tree, call);
                changed = true;
                patchConfirm('ok');
              } catch (e) {
                response = { error: (e as Error).message };
                patchConfirm('error', (e as Error).message);
              }
            }
          } else {
            add({ kind: 'activity', text: activity(call), done: false });
            try {
              response = await runTool(tree, call);
            } catch (e) {
              response = { error: (e as Error).message };
            }
            patchLast((it) => (it.kind === 'activity' ? { ...it, done: true } : it));
          }
          responses.push({ functionResponse: { name: call.name, response: { resultado: response } } });
        }
        contents.push({ role: 'user', parts: responses });
      }
      memory.contents = contents;
    } catch (e) {
      add({ kind: 'error', text: e instanceof IaError ? e.message : 'Algo falló. Probá de nuevo.' });
      // Si falló a mitad de camino, la pregunta se descarta para no dejar la conversación rota.
    } finally {
      setBusy(false);
      if (changed) {
        await reload();
        notifyChanged();
      }
    }
  }

  // Actualiza la última tarjeta de confirmación que quedó pendiente.
  function patchConfirm(status: 'ok' | 'cancel' | 'error', error?: string) {
    setItems((xs) => {
      const i = xs.map((x) => x.kind === 'confirm' && x.status === 'pending').lastIndexOf(true);
      if (i < 0) return xs;
      const copy = [...xs];
      copy[i] = { ...(copy[i] as Extract<Item, { kind: 'confirm' }>), status, error };
      return copy;
    });
  }

  function reset() {
    memory.items = [];
    memory.contents = [];
    setItems([]);
  }

  const ideas = [
    '¿Cuándo es mi próximo parcial?',
    materia ? `Resumime el último apunte de ${materia.name}` : 'Resumime mi último apunte',
    materia ? `Tomame 5 preguntas tipo parcial de ${materia.name}` : 'Tomame 5 preguntas de repaso',
    materia ? `Creá una carpeta "Resúmenes" en ${materia.name}` : 'Mostrame qué materias estoy cursando',
  ];

  return (
    <div
      className={
        panel
          ? 'flex flex-col h-full min-h-0'
          : 'max-w-3xl mx-auto px-4 sm:px-6 flex flex-col min-h-[calc(100dvh-6rem)] md:min-h-dvh safe-top'
      }
    >
      <header className={panel ? 'flex items-center gap-3 px-4 py-3 border-b border-line shrink-0' : 'flex items-center gap-3 pt-6 pb-4'}>
        <span
          className={`${panel ? 'size-9 rounded-xl' : 'size-11 rounded-2xl'} bg-accent text-on-accent grid place-items-center shrink-0`}
        >
          <Sparkles size={panel ? 18 : 22} />
        </span>
        <div className="flex-1 min-w-0">
          <h1 className={`${panel ? 'text-base' : 'text-xl'} font-extrabold tracking-tight`}>Preguntale a Mochi</h1>
          <p className="text-sm text-muted truncate">
            {restantes !== null ? `Te quedan ${restantes} preguntas hoy` : 'Consultá y ordená tus apuntes'}
          </p>
        </div>
        {items.length > 0 && (
          <Button variant="ghost" onClick={reset} disabled={busy} className="h-10 px-3 text-sm">
            <Plus width={18} height={18} /> Nueva
          </Button>
        )}
        {panel && (
          <button onClick={onClose} aria-label="Cerrar el chat" className="size-10 rounded-full grid place-items-center hover:bg-sunken shrink-0">
            <Close />
          </button>
        )}
      </header>

      <div className={panel ? 'flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3' : 'flex-1 space-y-3 pb-4'}>
        {items.length === 0 && (
          <div className="py-6 fade-up">
            <p className="text-muted">
              Puedo buscar en tus apuntes, explicarte o resumir un PDF, tomarte preguntas, y también ordenar: crear carpetas,
              mover archivos, cargar fechas y notas. Antes de cambiar algo, te pregunto.
            </p>
            <div className={`grid gap-2 mt-5 ${panel ? '' : 'sm:grid-cols-2'}`}>
              {ideas.map((i) => (
                <button
                  key={i}
                  onClick={() => send(i)}
                  className="text-left rounded-2xl bg-surface border border-line px-4 py-3 text-[15px] font-medium hover:bg-sunken"
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        )}

        {items.map((it, i) =>
          it.kind === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-accent text-on-accent px-4 py-2.5 whitespace-pre-wrap">{it.text}</div>
            </div>
          ) : it.kind === 'bot' ? (
            <div key={i} className="max-w-[92%] rounded-3xl rounded-bl-lg bg-surface border border-line px-4 py-3 leading-relaxed">
              <Md text={it.text} />
            </div>
          ) : it.kind === 'activity' ? (
            <div key={i} className="flex items-center gap-2 text-sm text-muted pl-2">
              {it.done ? <Check width={16} height={16} /> : <Spinner className="size-4 border-2" />}
              {it.text}
              {!it.done && '…'}
            </div>
          ) : it.kind === 'confirm' ? (
            <div key={i} className="rounded-3xl border-2 border-accent/40 bg-accent-soft/50 p-4 max-w-[92%]">
              <p className="text-sm font-semibold text-accent mb-1">
                {it.status === 'pending' ? '¿Lo hago?' : it.status === 'ok' ? 'Hecho' : it.status === 'cancel' ? 'Cancelado' : 'No se pudo'}
              </p>
              <div className="leading-relaxed">
                <Md text={it.text} />
              </div>
              {it.error && <p className="text-danger text-sm mt-1">{it.error}</p>}
              {it.status === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <Button variant="primary" className="h-10" onClick={() => decide(it.id, true)}>
                    <Check width={18} height={18} /> Sí, hacelo
                  </Button>
                  <Button className="h-10" onClick={() => decide(it.id, false)}>
                    <Close width={18} height={18} /> No
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div key={i} className="rounded-2xl bg-sunken px-4 py-3 text-[15px]">
              {it.text}
            </div>
          ),
        )}
        {busy && items[items.length - 1]?.kind === 'user' && (
          <div className="flex items-center gap-2 text-sm text-muted pl-2">
            <Spinner className="size-4 border-2" /> Pensando…
          </div>
        )}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className={panel ? 'shrink-0 px-3 pt-2 pb-3 border-t border-line safe-bottom' : 'sticky bottom-20 md:bottom-4 pb-2 pt-2 bg-bg'}
      >
        <div className="flex items-end gap-2 rounded-3xl bg-surface border border-line focus-within:border-accent p-2 pl-4 shadow-sm">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            rows={1}
            placeholder={materia ? `Preguntá sobre ${materia.name} o lo que quieras…` : 'Preguntá lo que quieras…'}
            className="flex-1 resize-none bg-transparent outline-none text-base py-2 max-h-40 field-sizing-content"
          />
          <Button variant="primary" disabled={busy || !text.trim()} className="size-11 p-0 rounded-2xl shrink-0" aria-label="Enviar">
            <Sparkles size={20} />
          </Button>
        </div>
      </form>
    </div>
  );
}

// Markdown mínimo (negritas, listas, títulos) armado con elementos de React, sin HTML crudo.
function Md({ text }: { text: string }) {
  const lines = text.split('\n');
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const L = list.ordered ? 'ol' : 'ul';
    out.push(
      <L key={out.length} className={`${list.ordered ? 'list-decimal' : 'list-disc'} pl-5 my-1.5 space-y-1`}>
        {list.items.map((x, i) => (
          <li key={i}>{inline(x)}</li>
        ))}
      </L>,
    );
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const num = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || num) {
      const ordered = !!num;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? num)![1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const h = line.match(/^#{1,4}\s+(.*)$/);
    out.push(
      h ? (
        <p key={out.length} className="font-bold mt-2">
          {inline(h[1])}
        </p>
      ) : (
        <p key={out.length} className="my-1">
          {inline(line)}
        </p>
      ),
    );
  }
  flush();
  return <>{out}</>;
}

function inline(s: string): ReactNode {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : part.startsWith('`') && part.endsWith('`') ? (
      <code key={i} className="px-1 rounded bg-sunken text-[0.9em]">
        {part.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
