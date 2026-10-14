import { ICONS, iconKey } from '../lib/materiaIcon';

type M = { name: string; color: string; icono?: string };

// Portada: el color de la materia con su ícono, y una versión grande de fondo como decoración.
export function MateriaCover({ m, className = '' }: { m: M; className?: string }) {
  const Icon = ICONS[iconKey(m)].icon;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: m.color }} aria-hidden>
      <Icon className="absolute -right-4 -bottom-6 text-white/15 rotate-[-12deg]" size={110} strokeWidth={1.5} />
      <span className="absolute left-4 bottom-3 size-10 rounded-xl bg-white/20 grid place-items-center">
        <Icon className="text-white" size={22} strokeWidth={2.2} />
      </span>
    </div>
  );
}

// Ícono chico con el color de la materia (para listas y encabezados).
export function MateriaBadge({ m, size = 36, className = '' }: { m: M; size?: number; className?: string }) {
  const Icon = ICONS[iconKey(m)].icon;
  return (
    <span
      className={`grid place-items-center shrink-0 text-white ${className}`}
      style={{ background: m.color, width: size, height: size, borderRadius: size * 0.3 }}
      aria-hidden
    >
      <Icon size={Math.round(size * 0.55)} strokeWidth={2.2} />
    </span>
  );
}
