// Rutas con "#" para que funcione el botón Atrás del celular.
//   #/              inicio
//   #/m/<id>        una materia
//   #/buscar?q=     buscador
//   ...?f=<id>      archivo abierto encima de cualquier pantalla

import { useEffect, useState } from 'react';

export type Route = { name: 'home' | 'materia' | 'search'; id?: string; folder?: string; q?: string; file?: string };

function split() {
  const [path, qs = ''] = location.hash.replace(/^#/, '').split('?');
  return { path: path || '/', params: new URLSearchParams(qs) };
}

export function parse(): Route {
  const { path, params } = split();
  const parts = path.split('/').filter(Boolean);
  const file = params.get('f') ?? undefined;
  if (parts[0] === 'm' && parts[1]) return { name: 'materia', id: parts[1], folder: parts[2], file };
  if (parts[0] === 'buscar') return { name: 'search', q: params.get('q') ?? '', file };
  return { name: 'home', file };
}

const notify = () => dispatchEvent(new Event('facu:route'));

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const f = () => setRoute(parse());
    for (const e of ['hashchange', 'popstate', 'facu:route']) addEventListener(e, f);
    return () => {
      for (const e of ['hashchange', 'popstate', 'facu:route']) removeEventListener(e, f);
    };
  }, []);
  return route;
}

export function go(path: string) {
  location.hash = path;
}

function build(path: string, params: URLSearchParams) {
  const qs = params.toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
}

export function setParam(key: string, value: string | null) {
  const { path, params } = split();
  if (value) params.set(key, value);
  else params.delete(key);
  history.replaceState(history.state, '', build(path, params));
  notify();
}

export function openFile(id: string) {
  const { path, params } = split();
  params.set('f', id);
  history.pushState({ viewer: true }, '', build(path, params));
  notify();
}

export function closeFile() {
  if (history.state?.viewer) return history.back();
  setParam('f', null);
}
