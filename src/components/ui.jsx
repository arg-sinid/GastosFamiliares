import { useState } from 'react';
import { TODAS_CATEGORIAS } from '../categorias.js';

// Componentes UI compartidos entre pantallas.

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

// Skeletons: rectángulo gris que "respira" mientras llegan los datos.
export function Skeleton({ className='' }) {
  return <div className={`animate-pulse bg-border-soft rounded-lg ${className}`} />;
}
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
export function SkeletonHero() {
  return (
    <div className="rounded-2xl px-5 py-5 bg-white shadow-sm">
      <Skeleton className="h-2.5 w-24 mb-3"/>
      <Skeleton className="h-9 w-40 mb-2"/>
      <Skeleton className="h-2.5 w-32"/>
    </div>
  );
}

// ÚNICO selector de categoría de toda la app (Gastos, Tarjetas, Auto).
// Muestra las categorías predefinidas + las personalizadas ya usadas y permite crear una nueva.
// onSelect recibe { categoria, emoji }.
export function CategoriaModal({ subtitulo, categorias, onSelect, onClose }) {
  const [showNew,     setShowNew]     = useState(false);
  const [customName,  setCustomName]  = useState('');
  const [customEmoji, setCustomEmoji] = useState('📦');

  const predef = new Set(TODAS_CATEGORIAS.map(c => c.categoria));
  const vistos = Object.values(categorias || {});
  const custom = [...new Set(vistos.map(c => c.categoria))]
    .filter(c => !predef.has(c))
    .map(c => ({ categoria:c, emoji: vistos.find(x => x.categoria === c)?.emoji || '📦' }));
  const todas = [...TODAS_CATEGORIAS, ...custom];

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-end justify-center">
      <div className="bg-white rounded-t-[20px] px-4 pt-5 pb-8 w-full max-w-[500px] max-h-[80vh] overflow-y-auto">
        <div className="font-extrabold text-base mb-1 text-ink">Cambiar categoría</div>
        <div className="text-[13px] text-muted mb-4">{subtitulo}</div>

        {!showNew ? (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {todas.map(c => (
                <button key={c.categoria} onClick={() => onSelect(c)}
                  className="px-3 py-2.5 border-[1.5px] border-border rounded-lg cursor-pointer bg-[#FAFAFA] text-left text-[13px] font-semibold text-ink flex items-center gap-2 touch-manipulation">
                  <span className="text-xl">{c.emoji}</span>{c.categoria}
                </button>
              ))}
            </div>
            <button onClick={() => setShowNew(true)}
              className="w-full py-2.5 border-2 border-dashed border-border rounded-lg bg-none cursor-pointer text-[13px] font-bold text-muted mb-2 touch-manipulation">
              ➕ Nueva categoría
            </button>
          </>
        ) : (
          <div className="mb-3">
            <div className="text-xs font-bold text-muted mb-2">Nueva categoría</div>
            <div className="flex gap-2 mb-2.5">
              <input value={customEmoji} onChange={e => setCustomEmoji(e.target.value)}
                className="w-[50px] p-2 rounded-lg border-[1.5px] border-border text-xl text-center outline-none"/>
              <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Nombre de categoría"
                className="flex-1 px-3 py-2 rounded-lg border-[1.5px] border-border text-sm outline-none"/>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNew(false)}
                className="flex-1 py-2.5 border-[1.5px] border-border rounded-lg bg-white cursor-pointer font-semibold text-muted touch-manipulation">Volver</button>
              <button onClick={() => customName.trim() && onSelect({ categoria: customName.trim(), emoji: customEmoji })} disabled={!customName.trim()}
                className={`flex-[2] py-2.5 border-none rounded-lg cursor-pointer font-bold text-white touch-manipulation ${customName.trim() ? 'bg-tab-cierre' : 'bg-border'}`}>Crear y asignar</button>
            </div>
          </div>
        )}

        <button onClick={onClose}
          className="w-full p-3 border-[1.5px] border-border rounded-lg bg-white cursor-pointer font-semibold text-muted text-sm touch-manipulation">Cancelar</button>
      </div>
    </div>
  );
}

// Elegir a qué vehículo se imputa un gasto del auto. onSelect recibe el id del vehículo.
export function VehiculoModal({ subtitulo, vehiculos, onSelect, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[310] flex items-end justify-center">
      <div className="bg-white rounded-t-[20px] px-4 pt-5 pb-8 w-full max-w-[500px] max-h-[80vh] overflow-y-auto">
        <div className="font-extrabold text-base mb-1 text-ink">¿A qué vehículo corresponde?</div>
        <div className="text-[13px] text-muted mb-4">{subtitulo}</div>
        <div className="flex flex-col gap-2 mb-3">
          {vehiculos.map(v => (
            <button key={v.id} onClick={() => onSelect(v.id)}
              className="px-3 py-3 border-[1.5px] border-border rounded-lg cursor-pointer bg-[#FAFAFA] text-left text-[13px] font-semibold text-ink flex items-center gap-2 touch-manipulation">
              <span className="text-xl">🚗</span>
              <span className="flex-1">{v.marca} {v.modelo}</span>
              <span className="text-[11px] text-muted font-mono">{v.patente}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose}
          className="w-full p-3 border-[1.5px] border-border rounded-lg bg-white cursor-pointer font-semibold text-muted text-sm touch-manipulation">Cancelar</button>
      </div>
    </div>
  );
}
