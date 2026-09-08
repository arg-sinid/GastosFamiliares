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
