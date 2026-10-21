import { Component, type ReactNode } from 'react';

// Si algo se rompe al dibujar una pantalla, muestra un aviso en vez de dejar todo en negro.
export default class ErrorBoundary extends Component<
  { children: ReactNode; onClose?: () => void; resetKey?: string },
  { error: Error | null; key?: string }
> {
  state: { error: Error | null; key?: string } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(p: { resetKey?: string }, s: { error: Error | null; key?: string }) {
    // Al pasar a otro archivo se vuelve a intentar.
    return p.resetKey !== s.key ? { error: null, key: p.resetKey } : null;
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="h-full min-h-60 flex flex-col items-center justify-center text-center p-6">
        <p className="font-bold text-lg">Algo no funcionó</p>
        <p className="text-muted mt-1 max-w-xs">Puede que haya una versión nueva de Mochi. Recargá y probá de nuevo.</p>
        <div className="flex gap-2 mt-5">
          <button onClick={() => location.reload()} className="h-11 px-5 rounded-xl bg-accent text-on-accent font-semibold">
            Recargar
          </button>
          {this.props.onClose && (
            <button onClick={this.props.onClose} className="h-11 px-5 rounded-xl border border-line font-semibold">
              Volver
            </button>
          )}
        </div>
      </div>
    );
  }
}
