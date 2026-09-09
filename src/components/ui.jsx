// Componentes UI compartidos. Las pantallas (Control, ControlGastos, Gastos,
// Tarjetas, UberDiDi) están escritas con JSX propio; MoneyInput es el único
// componente realmente compartido entre ellas.
//
// Nota de migración: los props border/background siguen aceptando overrides
// puntuales (algunas pantallas todavía los usan) para no romper nada mientras
// migramos el resto de la app a Tailwind pantalla por pantalla.

const formatMiles = (digits) => {
  if (!digits) return '';
  return new Intl.NumberFormat('es-AR').format(parseInt(digits, 10));
};
const soloDigitos = (str) => String(str||'').replace(/\D/g, '');

export function MoneyInput({ value, onChange, placeholder='0', width=130, border, background }) {
  const digits = soloDigitos(value);
  return (
    <input
      type="text" inputMode="numeric"
      value={formatMiles(digits)}
      onChange={e => onChange(soloDigitos(e.target.value))}
      placeholder={placeholder}
      className="rounded-lg text-sm text-right outline-none tabular-nums px-2.5 py-1.5"
      style={{
        width,
        border: border || '1.5px solid var(--color-border)',
        background: background || '#FAFAFA',
      }}
    />
  );
}

// Badge chico para estados ("💳 de Tarjetas", "🔁 fijo", etc.)
export function Badge({ children, tone='accent' }) {
  const tones = {
    accent:   'bg-accent-soft text-accent-strong',
    positive: 'bg-positive-soft text-positive',
    negative: 'bg-negative-soft text-negative',
  };
  return (
    <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${tones[tone]||tones.accent}`}>
      {children}
    </span>
  );
}

// Bloque base para skeleton loaders — un rectángulo gris que "respira"
// mientras se espera la data real. Los componentes de abajo lo combinan
// para armar la silueta de cada pantalla.
export function Skeleton({ className='' }) {
  return <div className={`animate-pulse bg-border-soft rounded-lg ${className}`} />;
}

// Silueta de una fila tipo "lista" (usada en Tarjetas, Gastos, etc.)
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white">
      <Skeleton className="w-9 h-9 rounded-full shrink-0"/>
      <div className="flex-1 flex flex-col gap-1.5">
        <Skeleton className="h-3 w-2/3"/>
        <Skeleton className="h-2.5 w-1/3"/>
      </div>
      <Skeleton className="h-4 w-16"/>
    </div>
  );
}

// Silueta de una tarjeta "hero" (el bloque grande con el número principal)
export function SkeletonHero() {
  return (
    <div className="rounded-2xl px-5 py-5 bg-white shadow-sm">
      <Skeleton className="h-2.5 w-24 mb-3"/>
      <Skeleton className="h-9 w-40 mb-2"/>
      <Skeleton className="h-2.5 w-32"/>
    </div>
  );
}

// Botón chico estilo "chip" (usado en headers de pantalla: refrescar, editar categorías, etc.)
export function ChipButton({ children, onClick, active, disabled, dark }) {
  const base = 'text-xs font-bold rounded-lg px-3 py-1.5 cursor-pointer touch-manipulation border';
  const style = dark
    ? 'bg-white/15 border-white/30 text-white'
    : active
      ? 'bg-white text-[var(--color-ink)] border-white'
      : 'bg-[var(--color-border-soft)] border-transparent text-[var(--color-muted)]';
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${style} disabled:opacity-60`}>
      {children}
    </button>
  );
}
