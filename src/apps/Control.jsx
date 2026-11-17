import { useState } from 'react';
import { $$, n, hoy, fmtDate } from '../utils.js';
import { construirSituacion } from '../motor.js';
import { ConciliacionUalaDetalle, ConciliacionEfectivoDetalle } from '../components/conciliacion.jsx';

const fd = f => fmtDate(new Date(f + 'T12:00:00'));
const fdl = f => f.split('-').reverse().join('/');
const neg = v => v < 0 ? `-${$$(Math.abs(v))}` : $$(v);

// Control: conciliación de la Uala de Julieta y del efectivo familiar. No calcula nada: muestra lo que devuelve el motor.
export default function Control({ appData, saveData, zapiaData, tarjetasData, tarjetasProv, onRefresh, mesKey, embebido }) {
  const hoyStr = hoy();
  const situ = construirSituacion({ appData, zapiaData, tarjetasData, tarjetasProvisorias: tarjetasProv || [], mesKey: mesKey || hoyStr.slice(0,7), hoyStr });
  const saldoJulieta = appData.saldoJulieta || {};
  const [saldoInput, setSaldoInput] = useState('');
  const [fechaCarga, setFechaCarga] = useState(hoyStr);     // Julieta puede declarar en cualquier fecha
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [edit, setEdit] = useState(null);                   // { fecha, nuevaFecha, monto }
  const handleRefresh = async () => { setRefreshing(true); await onRefresh?.(); setRefreshing(false); };

  const todas = Object.keys(saldoJulieta).sort().reverse();
  const ultima = todas[0];

  const guardar = async () => {
    if (!saldoInput || !fechaCarga) return;
    setSaving(true);
    // Una carga por fecha: volver a cargar el mismo día reemplaza, no suma otra conciliación.
    await saveData({ ...appData, saldoJulieta: { ...saldoJulieta, [fechaCarga]: n(saldoInput) } });
    setSaldoInput(''); setSaving(false);
  };
  const guardarEdicion = async () => {
    if (!edit || !edit.nuevaFecha || edit.monto === '') return;
    const nx = { ...saldoJulieta };
    if (edit.nuevaFecha !== edit.fecha && nx[edit.nuevaFecha] !== undefined && !window.confirm(`Ya hay un saldo cargado el ${fdl(edit.nuevaFecha)}. ¿Reemplazarlo?`)) return;
    delete nx[edit.fecha]; nx[edit.nuevaFecha] = n(edit.monto);
    await saveData({ ...appData, saldoJulieta: nx });
    setEdit(null);
  };
  const borrar = async (fecha) => {
    if (!window.confirm(`¿Borrar el saldo declarado del ${fdl(fecha)} (${$$(saldoJulieta[fecha])})?`)) return;
    const nx = { ...saldoJulieta }; delete nx[fecha];
    await saveData({ ...appData, saldoJulieta: nx });
  };

  const histUala = [...situ.conciliacionUala.periodos].reverse().slice(0, 12);
  const histEf = [...situ.conciliacionEfectivo.periodos].reverse().slice(0, 12);
  const Tabla = ({ filas, cols }) => (
    <table className="w-full border-collapse text-xs">
      <thead><tr className="bg-border-soft">{cols.map(h => <th key={h} className={`px-2.5 py-2 ${h==='Período'?'text-left':'text-right'} text-muted font-bold border-b border-border text-[10px] uppercase`}>{h}</th>)}</tr></thead>
      <tbody>{filas.map((p, i) => (
        <tr key={p.fechaFin} className={i%2===0?'bg-white':'bg-paper'}>
          <td className="px-2.5 py-2 font-semibold text-ink">{fd(p.fechaInicio)}→{fd(p.fechaFin)}</td>
          <td className="px-2.5 py-2 text-right tabular-nums text-muted">{$$(p.esperado)}</td>
          <td className="px-2.5 py-2 text-right tabular-nums text-ink">{$$(p.saldoReal)}</td>
          <td className={`px-2.5 py-2 text-right font-bold tabular-nums ${p.diferencia<0?'text-negative':p.diferencia>0?'text-accent-strong':'text-positive'}`}>{neg(p.diferencia)}</td>
        </tr>))}</tbody>
    </table>
  );

  return (
    <div className={embebido ? '' : 'max-w-[640px] mx-auto p-4 bg-paper min-h-[calc(100vh-70px)]'}>
      {!embebido && (
        <div className="rounded-2xl px-5 py-4.5 mb-4.5 text-white shadow-md flex justify-between items-center bg-tab-control">
          <div><div className="text-xl font-extrabold tracking-tight">📊 Control</div><div className="text-xs opacity-75 mt-0.5">Conciliación de la Uala y del efectivo</div></div>
          <button onClick={handleRefresh} disabled={refreshing} className="bg-white/15 border border-white/30 rounded-lg text-white px-2.5 py-1.5 cursor-pointer text-xs font-bold touch-manipulation">{refreshing ? '...' : '↻'}</button>
        </div>
      )}

      {/* ── Uala de Julieta ── */}
      <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
        <div className="bg-julieta text-white px-4 py-2.5 font-bold text-[13px]">👩 Uala de Julieta</div>
        <ConciliacionUalaDetalle conciliacion={situ.conciliacionUala}/>
        <div className="px-4 py-3 border-t border-border-soft">
          <div className="text-xs text-muted mb-2 font-semibold">💳 Saldo real que declara Julieta (cualquier día)</div>
          {ultima && !saldoInput && <div className="text-sm font-bold text-ink mb-2">Último declarado ({fdl(ultima)}): {$$(saldoJulieta[ultima])}</div>}
          <input type="date" value={fechaCarga} max={hoyStr} onChange={e => setFechaCarga(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border-[1.5px] border-border text-sm outline-none text-ink bg-white mb-2"/>
          <div className="flex gap-2">
            <div className={`flex-1 flex items-center bg-[#FAFAFA] rounded-lg border-[1.5px] px-3 py-1.5 gap-1 ${saldoInput?'border-julieta':'border-border'}`}>
              <span className="text-muted-light font-semibold">$</span>
              <input type="number" inputMode="numeric" min="0" value={saldoInput} onChange={e => setSaldoInput(e.target.value)} placeholder="0"
                className="flex-1 border-none outline-none text-lg font-bold text-ink bg-transparent tabular-nums"/>
            </div>
            <button onClick={guardar} disabled={!saldoInput || !fechaCarga || saving}
              className={`px-4 py-2 border-none rounded-lg cursor-pointer font-bold text-[13px] text-white touch-manipulation ${saving ? 'bg-muted-light' : 'bg-julieta'}`}>{saving ? '...' : 'Guardar'}</button>
          </div>
          <div className="text-[11px] text-muted-light mt-1.5">El saldo declarado es dinero real: no se modifica ni se suma a las transferencias.</div>
        </div>
      </div>

      {todas.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
          <div className="bg-julieta text-white px-4 py-2.5 font-bold text-[13px] flex justify-between"><span>🗂️ Saldos declarados por Julieta</span><span className="text-[11px] opacity-80 font-normal">{todas.length} cargas</span></div>
          {todas.map((f, i) => (
            <div key={f} className={`px-4 py-2.5 ${i<todas.length-1?'border-b border-border-soft':''}`}>
              {edit && edit.fecha === f ? (
                <div>
                  <div className="flex gap-2 mb-2">
                    <input type="date" value={edit.nuevaFecha} max={hoyStr} onChange={e => setEdit({ ...edit, nuevaFecha: e.target.value })} className="flex-1 px-2 py-1.5 rounded-lg border-[1.5px] border-border text-sm outline-none bg-white"/>
                    <input type="number" inputMode="numeric" min="0" value={edit.monto} onChange={e => setEdit({ ...edit, monto: e.target.value })} className="flex-1 px-2 py-1.5 rounded-lg border-[1.5px] border-julieta text-sm outline-none text-right tabular-nums"/>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEdit(null)} className="flex-1 py-1.5 border-[1.5px] border-border rounded-lg bg-white text-muted font-semibold text-xs touch-manipulation">Cancelar</button>
                    <button onClick={guardarEdicion} className="flex-[2] py-1.5 border-none rounded-lg bg-julieta text-white font-bold text-xs touch-manipulation">Guardar cambios</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-[13px] font-semibold text-ink">{fdl(f)}</span>
                  <span className="text-[14px] font-extrabold text-ink tabular-nums">{$$(saldoJulieta[f])}</span>
                  <button onClick={() => setEdit({ fecha: f, nuevaFecha: f, monto: String(saldoJulieta[f]) })} className="border-none bg-border-soft rounded-md cursor-pointer text-[12px] px-2 py-1 touch-manipulation">✏️</button>
                  <button onClick={() => borrar(f)} className="border-none bg-border-soft rounded-md cursor-pointer text-[12px] px-2 py-1 touch-manipulation">🗑️</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {histUala.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
          <div className="bg-ink text-white px-4 py-2.5 font-bold text-[13px]">Historial de conciliaciones de la Uala</div>
          <Tabla filas={histUala} cols={['Período','Esperado','Real','Dif.']}/>
        </div>
      )}

      {/* ── Efectivo familiar ── */}
      <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
        <div className="bg-german text-white px-4 py-2.5 font-bold text-[13px]">💵 Efectivo familiar</div>
        <ConciliacionEfectivoDetalle conciliacion={situ.conciliacionEfectivo}/>
        <div className="px-4 py-2 text-[11px] text-muted-light border-t border-border-soft">El efectivo se declara en Auto → cierre dominical ("Efectivo que me queda").</div>
      </div>

      {histEf.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-ink text-white px-4 py-2.5 font-bold text-[13px]">Historial de conciliaciones de efectivo</div>
          <Tabla filas={histEf} cols={['Período','Esperado','Real','Dif.']}/>
        </div>
      )}
    </div>
  );
}
