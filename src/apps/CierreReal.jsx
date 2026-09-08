import { useState } from 'react';
import { $$, n, getKey, fmtKey, monthOpts, calcularGastosFijosSinTarjetas, calcularTotalesTarjetas, agruparGastosPorCategoria } from '../utils.js';
import { TIPOS_FINANCIEROS } from '../categorias.js';

function LineaInfo({ label, valor, color, sub, bold }) {
  return (
    <div className={`flex justify-between items-center border-t border-border-soft ${sub ? 'pl-7 pr-4 py-1.5 bg-[#FAFAFA]' : 'px-4 py-2.5 bg-white'}`}>
      <span className={`${sub ? 'text-xs' : 'text-[13px]'} text-muted ${bold?'font-bold':''}`} style={bold?{color:'var(--color-ink)'}:{}}>{label}</span>
      <span className={`tabular-nums ${bold?'text-sm font-extrabold':'text-[13px] font-bold'}`} style={{ color: color || 'var(--color-ink)' }}>{$$(valor)}</span>
    </div>
  );
}

export default function CierreReal({ appData, zapiaData, tarjetasData, onRefresh }) {
  const today = new Date();
  const [selKey,     setSelKey]     = useState(getKey(today));
  const [expanded,   setExpanded]   = useState({});
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => { setRefreshing(true); await onRefresh?.(); setRefreshing(false); };

  const monthly           = appData.monthly           || {};
  const uberDiDi           = appData.uberDiDi          || [];
  const categories         = appData.categories        || {};
  const dolarTarjetaMap    = appData.dolarTarjeta      || {};
  const gastosRecurrentes  = appData.gastosRecurrentes || {};

  const totalesTarjetas = calcularTotalesTarjetas(tarjetasData, dolarTarjetaMap);

  const brutoGanancias = (uberDiDi||[])
    .filter(r => r.fecha && r.fecha.slice(0,7) === selKey)
    .reduce((s,r) => s + (r.total || 0), 0);

  const sueldoJulieta = n(monthly[selKey]?.ingresos?.julieta);
  const ingresos      = brutoGanancias + sueldoJulieta;

  const fijos = calcularGastosFijosSinTarjetas(monthly, gastosRecurrentes, selKey);

  const { grupos, total: totalGastos } = agruparGastosPorCategoria(
    zapiaData, tarjetasData, categories, dolarTarjetaMap, selKey, TIPOS_FINANCIEROS
  );
  const sortedGrupos = Object.entries(grupos).sort((a,b) => b[1].total - a[1].total);

  const resultado = ingresos - totalGastos - fijos;
  const ok = resultado >= 0;

  return (
    <div className="max-w-[640px] mx-auto p-4 bg-paper min-h-[calc(100vh-70px)]">
      <div className="bg-tab-cierre rounded-2xl px-5 py-4.5 mb-4.5 text-white shadow-md flex justify-between items-center">
        <div>
          <div className="text-xl font-extrabold">🧮 Cierre Real</div>
          <div className="text-xs opacity-75 mt-0.5">Ganancias vs. gastos reales del mes</div>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="bg-white/15 border border-white/30 rounded-lg text-white px-2.5 py-1.5 cursor-pointer text-xs font-bold touch-manipulation">
          {refreshing ? '...' : '↻'}
        </button>
      </div>

      <select value={selKey} onChange={e=>setSelKey(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-border text-sm mb-3.5 bg-white text-ink font-semibold cursor-pointer">
        {monthOpts(today).map(k=><option key={k} value={k}>{fmtKey(k)}{k===getKey(today)?' — actual':''}</option>)}
      </select>

      <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
        <div className="bg-tab-cierre text-white px-4 py-2.5 font-bold text-[13px]">💰 Ingresos</div>
        <LineaInfo label="Bruto Uber/DiDi" valor={brutoGanancias} color="var(--color-german)"/>
        <LineaInfo label="Sueldo Julieta" valor={sueldoJulieta} color="var(--color-julieta)"/>
        <LineaInfo label="Total ingresos" valor={ingresos} bold/>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
        <div className="bg-tab-gastos text-white px-4 py-2.5 font-bold text-[13px]">📤 Egresos</div>
        <LineaInfo label="Gastos del mes (Zapia + Tarjetas)" valor={totalGastos} color="var(--color-tab-gastos)"/>
        <LineaInfo label="Fijos del Principal" valor={fijos} color="var(--color-accent-strong)"/>
        <LineaInfo label="Total egresos" valor={totalGastos + fijos} bold/>
      </div>

      <div className={`rounded-2xl px-4.5 py-4 mb-4.5 border-[1.5px] flex justify-between items-center ${ok ? 'bg-positive-soft border-[#9AE6B4]' : 'bg-negative-soft border-[#F5B4A8]'}`}>
        <div>
          <div className={`text-[13px] font-bold ${ok?'text-positive':'text-negative'}`}>Resultado del mes</div>
          <div className={`text-[11px] mt-0.5 ${ok?'text-positive':'text-negative'}`}>Ingresos − gastos − fijos</div>
        </div>
        <div className={`text-2xl font-black tabular-nums ${ok?'text-positive':'text-negative'}`}>
          {ok ? $$(resultado) : `-${$$(Math.abs(resultado))}`}
        </div>
      </div>

      {sortedGrupos.length > 0 ? (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-[#553C9A] text-white px-4 py-2.5 font-bold text-[13px] flex justify-between">
            <span>Gastos por categoría</span><span className="text-[11px] opacity-80">{sortedGrupos.length} categorías</span>
          </div>
          {sortedGrupos.map(([cat,data])=>(
            <div key={cat}>
              <div onClick={()=>setExpanded(p=>({...p,[cat]:!p[cat]}))}
                className={`flex items-center px-3.5 py-3 border-b border-[#F0EAFB] cursor-pointer touch-manipulation ${expanded[cat]?'bg-[#FAF5FF]':'bg-white'}`}>
                <span className="text-xl mr-2.5">{data.emoji}</span>
                <span className="flex-1 text-[13px] font-bold text-ink">{cat}</span>
                <span className="text-[11px] text-muted-light mr-2.5">{data.items.length} gasto{data.items.length>1?'s':''}</span>
                <span className="font-extrabold text-sm text-[#553C9A] mr-2 tabular-nums">{$$(data.total)}</span>
                <span className="text-muted-light text-xs">{expanded[cat]?'▲':'▼'}</span>
              </div>
              {expanded[cat]&&data.items.map((item,i)=>(
                <div key={i} className="flex items-center pl-11 pr-3.5 py-2.5 border-b border-border-soft bg-[#FAFAFA]">
                  <div className="flex-1">
                    <div className="text-[13px] text-ink font-medium">{item.key}</div>
                    <div className="text-[11px] text-muted-light mt-0.5 flex gap-2 items-center flex-wrap">
                      {item.origen==='zapia' ? (
                        <>
                          <span>{item.quien==='Germán'?'👨':'👩'}</span>
                          <span>{item.medio==='efectivo'?'💵':'📲'}</span>
                        </>
                      ) : (
                        <span className="bg-accent-soft text-accent-strong rounded px-1.5 py-0.5 font-bold">💳 {item.tarjeta}</span>
                      )}
                      <span>{item.fecha.split('-').reverse().join('/')}</span>
                    </div>
                  </div>
                  <span className="font-bold text-[13px] text-[#553C9A] tabular-nums">{$$(item.monto)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center px-5 py-10 text-muted-light">
          <div className="text-4xl mb-2.5">📋</div>
          <div className="text-[13px]">Sin gastos cargados este mes.</div>
        </div>
      )}
    </div>
  );
}
