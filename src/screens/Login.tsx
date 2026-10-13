const ERRORS: Record<string, string> = {
  cancelado: 'No se completó el ingreso. Probá de nuevo cuando quieras.',
  reintentar: 'Algo falló al entrar. Probá de nuevo.',
  falta_drive: 'Para guardar tus apuntes, tenés que marcar la casilla de permiso de Google Drive.',
};

export default function Login() {
  const error = ERRORS[new URLSearchParams(location.search).get('error') ?? ''];
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 text-center">
      <img src="/icon.svg" alt="" className="size-20 rounded-3xl shadow-md" />
      <p className="text-2xl font-extrabold tracking-tight mt-3 mb-8 text-accent">Mochi</p>
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight max-w-md">Tus apuntes de la facu, en un solo lugar.</h1>
      <p className="text-muted mt-4 max-w-sm text-[17px] leading-relaxed">
        Ordenados por año y materia. Se guardan en tu Google Drive, así no se pierden y los ves desde la compu o el celu.
      </p>

      {error && <p className="mt-6 max-w-sm bg-accent-soft text-ink rounded-2xl px-4 py-3 text-[15px]">{error}</p>}

      <a
        href="/api/login"
        className="mt-8 inline-flex items-center gap-3 h-14 px-7 rounded-2xl bg-surface border border-line shadow-sm font-semibold text-[17px] hover:bg-sunken transition"
      >
        <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        Entrar con Google
      </a>
      <p className="text-muted text-sm mt-4 max-w-xs">
        La app solo puede ver los archivos que subas desde acá. El resto de tu Drive no lo toca.
      </p>
      <a href="/privacidad.html" className="text-sm text-muted underline mt-10">
        Política de privacidad
      </a>
    </div>
  );
}
