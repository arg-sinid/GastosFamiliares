import { useState } from 'react';
import { $$, getKey, fmtKey, monthOpts, agruparGastosPorCategoria, fmtDate, hoy } from '../utils.js';
import { construirSituacion, armarCierre } from '../motor.js';

const fd = f => fmtDate(new Date(f + 'T12:00:00'));
const neg = v => v < 0 ? `-${$$(Math.abs(v))}` : $$(v);

function Fila({ label, valor, color, bold, sub, nota }) {
  return (
    <div className={`flex justify-between items-center border-t border-border-soft ${sub ? 'pl-7 pr-4 py-1.5 bg-[#FAFAFA]' : 'px-4 py-2.5 bg-white'}`}>
      <div><span className={`${sub ? 'text-xs' : 'text-[13px]'} ${bold ? 'font-bold text-ink' : 'text-muted'}`}>{label}</span>{nota && <div className="text-[10px] text-muted-light">{nota}</div>}</div>
      <span className={`tabular-nums ${bold ? 'text-sm font-extrabold' : 'text-[13px] font-bold'}`} style={{ color: color || 'var(--color-ink)' }}>{neg(valor)}</span>
    </div>
  );
}

// Cierre mensual: usa el MISMO motor que Principal y Control. Distingue resultado del período, saldos reales,
// obligaciones y ahorros, y puede guardar una foto del mes para que el historial no cambie solo.
export default function CierreReal({ appData, saveData, zapiaData, tarjetasData, tarjetasProv, onRefresh, mesKey, embebido }) {
  const today = new Date(), hoyStr = hoy();
  const [selLocal, setSelLocal] = useState(getKey(today));
  const selKey = mesKey || selLocal;
  const [expanded, setExpanded] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => { setRefreshing(true); await onRefresh?.(); setRefreshing(false); };

  const situ = construirSituacion({ appData, zapiaData, tarjetasData, tarjetasProvisorias: tarjetasProv || [], mesKey: selKey, hoyStr });
  const { resultado: r, disponibilidad: d, obligaciones: ob } = situ;
  const cierre = (appData.cierres || {})[selKey];
  const { grupos } = agruparGastosPorCategoria(zapiaData, tarjetasData, appData.categories || {}, appData.dolarTarjeta || {}, selKey);
  const sorted = Object.entries(grupos).sort((a,b) => b[1].total - a[1].total);
  const deltaVsCierre = cierre ? r.saldo - cierre.resultado.saldo : 0;

  const cerrar = () => saveData({ ...appData, cierres: { ...(appData.cierres || {}), [selKey]: armarCierre(situ) } });
  const reabrir = () => {
    if (!window.confirm(`¿Reabrir ${fmtKey(selKey)}? Se borra la foto del cierre (los datos no se tocan).`)) return;
    const nx = { ...(appData.cierres || {}) }; delete nx[selKey];
    return saveData({ ...appData, cierres: nx });
  };

  return (
    <div className={embebido ? '' : 'max-w-[640px] mx-auto p-4 bg-paper min-h-[calc(100vh-70px)]'}>
      {!embebido && (
        <div className="bg-tab-cierre rounded-2xl px-5 py-4.5 mb-4.5 text-white shadow-md flex justify-between items-center">
          <div><div className="text-xl font-extrabold">🧮 Cierre mensual</div><div className="text-xs opacity-75 mt-0.5">Resultado del período, saldos y obligaciones</div></div>
          <button onClick={handleRefresh} disabled={refreshing} className="bg-white/15 border border-white/30 rounded-lg text-white px-2.5 py-1.5 cursor-pointer text-xs font-bold touch-manipulation">{refreshing ? '...' : '↻'}</button>
        </div>
      )}
      {!mesKey && (
        <select value={selKey} onChange={e => setSelLocal(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-border text-sm mb-3.5 bg-white text-ink font-semibold cursor-pointer">
          {monthOpts(today).map(k => <option key={k} value={k}>{fmtKey(k)}{k===getKey(today)?' — actual':''}</option>)}
        </select>
      )}

      <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
        <div className="bg-tab-cierre text-white px-4 py-2.5 font-bold text-[13px]">📈 Resultado de {fmtKey(selKey)}</div>
        <Fila label="Sueldo de Julieta" valor={r.ingresos.sueldo} color="var(--color-julieta)"/>
        <Fila label="Bruto Uber/DiDi" valor={r.ingresos.uber} color="var(--color-german)"/>
        <Fila label="Ingresos reales del período" valor={r.ingresos.total} bold/>
        <Fila label="Gastos de Zapia (Germán y Julieta, efectivo y transferencia)" valor={r.gastos.zapia} color="var(--color-tab-gastos)" sub/>
        <Fila label="Tarjetas del mes (resúmenes definitivos)" valor={r.gastos.tarjetas} color="var(--color-tab-gastos)" sub/>
        <Fila label="Gastos fijos (sin tarjetas)" valor={r.gastos.fijos} color="var(--color-tab-gastos)" sub/>
        <Fila label="Gastos reales del período" valor={r.gastos.total} bold/>
        <div className={`flex justify-between items-center px-4 py-3 border-t-2 border-border-soft ${r.saldo >= 0 ? 'bg-positive-soft' : 'bg-negative-soft'}`}>
          <div><div className={`text-[13px] font-bold ${r.saldo>=0?'text-positive':'text-negative'}`}>Resultado del período</div>
            <div className="text-[10px] text-muted">Ingresos − gastos. No incluye transferencias, saldos ni lo estimado.</div></div>
          <div className={`text-2xl font-black tabular-nums ${r.saldo>=0?'text-positive':'text-negative'}`}>{neg(r.saldo)}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
        <div className="bg-ink text-white px-4 py-2.5 font-bold text-[13px]">🏦 Saldos reales disponibles (no es ganancia)</div>
        <Fila label={`Uala${d.uala ? ` · declarado ${fd(d.uala.fecha)}` : ''}`} valor={d.uala ? d.uala.valor : 0}/>
        <Fila label={`Efectivo${d.efectivo ? ` · declarado ${fd(d.efectivo.fecha)}` : ''}`} valor={d.efectivo ? d.efectivo.valor : 0}/>
        <Fila label="Disponibilidad total" valor={d.total} bold/>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
        <div className="bg-negative text-white px-4 py-2.5 font-bold text-[13px]">📅 Obligaciones a hoy</div>
        <Fila label="Deudas vencidas impagas" valor={ob.totales.vencido} color="var(--color-negative)"/>
        <Fila label="Obligaciones pendientes" valor={ob.totales.pendiente}/>
        <Fila label="Compromisos futuros estimados" valor={ob.totales.estimado} color="var(--color-muted)" nota="No cuentan en el resultado ni en lo que hay que pagar hoy"/>
        <Fila label="Ahorros (cargados a mano)" valor={situ.ahorro} color="var(--color-positive)" nota="No se suman a la disponibilidad ni al resultado"/>
      </div>

      {saveData && (
        <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
          <div className="bg-[#553C9A] text-white px-4 py-2.5 font-bold text-[13px]">🔒 Cierre de {fmtKey(selKey)}</div>
          {cierre ? (
            <div className="px-4 py-3 text-[12px] text-muted">
              <div>Cerrado el {fd(cierre.fecha)}: resultado <strong className="text-ink">{neg(cierre.resultado.saldo)}</strong>, disponibilidad <strong className="text-ink">{$$(cierre.disponibilidad.total)}</strong>.</div>
              {Math.round(deltaVsCierre) !== 0 && (
                <div className="mt-1.5 text-accent-strong font-semibold">⚠️ Los datos cargados después cambiarían el resultado actual en {neg(deltaVsCierre)} ({neg(r.saldo)} hoy). El historial conserva el valor del cierre.</div>
              )}
              <button onClick={reabrir} className="mt-2 border-[1.5px] border-border rounded-lg bg-white text-muted font-semibold text-xs px-3 py-1.5 touch-manipulation">Reabrir mes</button>
            </div>
          ) : (
            <div className="px-4 py-3">
              <div className="text-[12px] text-muted mb-2">Guarda una foto del resultado, la disponibilidad y las obligaciones de este mes. El historial la usa sin recalcular.</div>
              <button onClick={cerrar} className="w-full py-2.5 border-none rounded-lg bg-[#553C9A] text-white font-bold text-sm touch-manipulation">🔒 Cerrar {fmtKey(selKey)}</button>
            </div>
          )}
        </div>
      )}

      {sorted.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-[#553C9A] text-white px-4 py-2.5 font-bold text-[13px] flex justify-between"><span>Gastos por categoría</span><span className="text-[11px] opacity-80">{sorted.length} categorías</span></div>
          {sorted.map(([cat, data]) => (
            <div key={cat}>
              <div onClick={() => setExpanded(p => ({ ...p, [cat]: !p[cat] }))} className={`flex items-center px-3.5 py-3 border-b border-[#F0EAFB] cursor-pointer touch-manipulation ${expanded[cat]?'bg-[#FAF5FF]':'bg-white'}`}>
                <span className="text-xl mr-2.5">{data.emoji}</span><span className="flex-1 text-[13px] font-bold text-ink">{cat}</span>
                <span className="text-[11px] text-muted-light mr-2.5">{data.items.length} gasto{data.items.length>1?'s':''}</span>
                <span className="font-extrabold text-sm text-[#553C9A] mr-2 tabular-nums">{$$(data.total)}</span><span className="text-muted-light text-xs">{expanded[cat]?'▲':'▼'}</span>
              </div>
              {expanded[cat] && data.items.map(item => (
                <div key={item.id} className="flex items-center pl-11 pr-3.5 py-2.5 border-b border-border-soft bg-[#FAFAFA]">
                  <div className="flex-1">
                    <div className="text-[13px] text-ink font-medium">{item.key}</div>
                    <div className="text-[11px] text-muted-light mt-0.5 flex gap-2 items-center flex-wrap">
                      {item.origen==='zapia' ? (<><span>{item.quien==='Germán'?'👨':'👩'}</span><span>{/efect/i.test(item.medio)?'💵':'📲'}</span></>) : <span className="bg-accent-soft text-accent-strong rounded px-1.5 py-0.5 font-bold">💳 {item.tarjeta}</span>}
                      <span>{item.fecha.split('-').reverse().join('/')}</span>
                    </div>
                  </div>
                  <span className="font-bold text-[13px] text-[#553C9A] tabular-nums">{$$(item.monto)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
