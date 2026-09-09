import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { $$, n, fmtKey, getKey, monthOpts } from '../utils.js';
import { categorizarUno, TODAS_CATEGORIAS, emojiCorrectoParaCategoria, TIPOS_FINANCIEROS } from '../categorias.js';
import { Skeleton } from '../components/ui.jsx';

// Los charts de recharts necesitan valores hex reales (no clases), así que
// repetimos acá los mismos tonos definidos en src/styles.css.
const TARJETAS_CONFIG = {
  ICBC: { nombre:'Tarjeta ICBC',        color:'#6B21A8', icon:'💳', key:'icbc' },
  BNA:  { nombre:'Tarjeta Banco Nación', color:'#2B6CB0', icon:'💳', key:'bna'  },
};

function DetalleTarjeta({ movimientos, config, dolarTarjeta, categorias, setCategoria, onBack }) {
  const [expanded, setExpanded] = useState({});

  const montoEnPesos = (m) => m.moneda === 'USD' ? m.importe * dolarTarjeta : m.importe;

  const cuotasItems     = movimientos.filter(m => m.cuotas && m.cuotas.trim() !== '');
  const financierosItems= movimientos.filter(m => (!m.cuotas || m.cuotas.trim()==='') && TIPOS_FINANCIEROS.includes(m.tipoMovimiento));
  const consumos        = movimientos.filter(m => (!m.cuotas || m.cuotas.trim()==='') && !TIPOS_FINANCIEROS.includes(m.tipoMovimiento));

  const totalCuotas      = cuotasItems.reduce((s,m) => s + montoEnPesos(m), 0);
  const totalFinancieros = financierosItems.reduce((s,m) => s + montoEnPesos(m), 0);
  const totalConsumos    = consumos.reduce((s,m) => s + montoEnPesos(m), 0);
  const totalGeneral     = totalCuotas + totalFinancieros + totalConsumos;

  const grupos = {};
  consumos.forEach(m => {
    const cat = categorias[m.comercio] || categorizarUno(m.comercio);
    const key = cat.categoria;
    if (!grupos[key]) grupos[key] = { emoji:cat.emoji, items:[], total:0 };
    grupos[key].items.push(m);
    grupos[key].total += montoEnPesos(m);
  });
  const sortedGrupos = Object.entries(grupos).sort((a,b) => b[1].total - a[1].total);

  return (
    <div className="max-w-[480px] mx-auto p-4 bg-paper min-h-[calc(100vh-70px)]">
      <button onClick={onBack} className="border-none bg-border-soft rounded-lg cursor-pointer px-4 py-2 font-bold text-muted mb-4 touch-manipulation">‹ Volver</button>

      <div className="rounded-2xl px-5 py-4.5 mb-4.5 text-white shadow-md" style={{background:config.color}}>
        <div className="text-xl font-extrabold">{config.icon} {config.nombre}</div>
        <div className="text-[32px] font-extrabold mt-2.5 tracking-tight tabular-nums">{$$(totalGeneral)}</div>
        <div className="text-[11px] opacity-80 mt-1">{consumos.length} consumos · {cuotasItems.length} en cuotas · {financierosItems.length} otros</div>
      </div>

      <div className="bg-white rounded-2xl px-4 py-3.5 mb-3.5 shadow-sm">
        <div className="flex justify-between py-1.5">
          <span className="text-[13px] text-muted">Consumos categorizables</span>
          <span className="text-sm font-bold text-ink tabular-nums">{$$(totalConsumos)}</span>
        </div>
        {totalCuotas > 0 && (
          <div className="flex justify-between py-1.5 border-t border-border-soft">
            <span className="text-[13px] text-muted">Cuotas</span>
            <span className="text-sm font-bold text-tab-cierre tabular-nums">{$$(totalCuotas)}</span>
          </div>
        )}
        {totalFinancieros > 0 && (
          <div className="flex justify-between py-1.5 border-t border-border-soft">
            <span className="text-[13px] text-muted">Pagos / impuestos / intereses</span>
            <span className="text-sm font-bold text-negative tabular-nums">{$$(totalFinancieros)}</span>
          </div>
        )}
      </div>

      {cuotasItems.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
          <div className="bg-tab-cierre text-white px-4 py-2.5 font-bold text-[13px] flex justify-between">
            <span>🧾 Cuotas</span><span className="text-[11px] opacity-80">{$$(totalCuotas)}</span>
          </div>
          {cuotasItems.map((m,i) => (
            <div key={m.id||i} className={`flex items-center px-3.5 py-2.5 ${i<cuotasItems.length-1?'border-b border-border-soft':''} ${i%2===0?'bg-white':'bg-[#FAFAFA]'}`}>
              <div className="flex-1">
                <div className="text-xs text-ink">{m.comercio} <span className="text-[10px] bg-accent-soft text-accent-strong rounded px-1.5 py-0.5 font-bold">{m.cuotas}</span></div>
                <div className="text-[11px] text-muted-light">{m.fecha.split('-').reverse().join('/')}{m.moneda==='USD'&&<span className="text-tab-tarjetas ml-1.5">USD {m.importe.toFixed(2)}</span>}</div>
              </div>
              <span className="font-bold text-[13px] text-tab-cierre tabular-nums">{$$(montoEnPesos(m))}</span>
            </div>
          ))}
        </div>
      )}

      {sortedGrupos.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
          <div className="text-white px-4 py-2.5 font-bold text-[13px]" style={{background:config.color}}>Consumos por categoría</div>
          {sortedGrupos.map(([cat,data]) => (
            <div key={cat}>
              <div onClick={()=>setExpanded(p=>({...p,[cat]:!p[cat]}))}
                className={`flex items-center px-3.5 py-3 border-b border-border-soft cursor-pointer touch-manipulation ${expanded[cat]?'bg-[#FAFAFA]':'bg-white'}`}>
                <span className="text-xl mr-2.5">{data.emoji}</span>
                <span className="flex-1 text-[13px] font-bold text-ink">{cat}</span>
                <span className="text-[11px] text-muted-light mr-2.5">{data.items.length}</span>
                <span className="font-extrabold text-sm mr-2 tabular-nums" style={{color:config.color}}>{$$(data.total)}</span>
                <span className="text-muted-light text-xs">{expanded[cat]?'▲':'▼'}</span>
              </div>
              {expanded[cat] && data.items.map((m,i) => (
                <div key={m.id||i} className="flex items-center pl-11 pr-3.5 py-2.5 border-b border-border-soft bg-[#FAFAFA]">
                  <div className="flex-1">
                    <div className="text-xs text-ink">{m.comercio}</div>
                    <div className="text-[11px] text-muted-light flex gap-2 items-center">
                      <span>{m.fecha.split('-').reverse().join('/')}</span>
                      {m.moneda==='USD'&&<span className="text-tab-tarjetas">USD {m.importe.toFixed(2)}</span>}
                      <button onClick={()=>setCategoria(m.comercio)}
                        className="border-none bg-border-soft rounded-md cursor-pointer text-[10px] text-muted px-1.5 py-0.5 touch-manipulation">✏️</button>
                    </div>
                  </div>
                  <span className="font-bold text-[13px] tabular-nums" style={{color:config.color}}>{$$(montoEnPesos(m))}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {financierosItems.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-tab-gastos text-white px-4 py-2.5 font-bold text-[13px]">💰 Pagos / Impuestos / Intereses</div>
          {financierosItems.map((m,i) => (
            <div key={m.id||i} className={`flex items-center px-3.5 py-2.5 ${i<financierosItems.length-1?'border-b border-border-soft':''} ${i%2===0?'bg-white':'bg-[#FAFAFA]'}`}>
              <div className="flex-1">
                <div className="text-xs text-ink">{m.comercio}</div>
                <div className="text-[11px] text-muted-light">{m.fecha.split('-').reverse().join('/')} · {m.tipoMovimiento}</div>
              </div>
              <span className="font-bold text-[13px] text-tab-gastos tabular-nums">{$$(montoEnPesos(m))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CatPickerModal({ comercio, categorias, onSave, onClose }) {
  const [showNew,     setShowNew]     = useState(false);
  const [customName,  setCustomName]  = useState('');
  const [customEmoji, setCustomEmoji] = useState('📦');

  const predefNames = new Set(TODAS_CATEGORIAS.map(c => c.categoria));
  const customCats = [...new Set(Object.values(categorias || {}).map(c => c.categoria))]
    .filter(c => !predefNames.has(c))
    .map(c => ({ categoria:c, emoji: Object.values(categorias).find(x=>x.categoria===c)?.emoji || '📦' }));
  const allCats = [...TODAS_CATEGORIAS, ...customCats];

  const handleNewSave = () => { if (!customName.trim()) return; onSave({ categoria: customName.trim(), emoji: customEmoji }); };

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-end justify-center">
      <div className="bg-white rounded-t-[20px] px-4 pt-5 pb-8 w-full max-w-[500px] max-h-[80vh] overflow-y-auto">
        <div className="font-extrabold text-base mb-1 text-ink">Cambiar categoría</div>
        <div className="text-[13px] text-muted mb-4">"{comercio}"</div>

        {!showNew ? (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {allCats.map(c=>(
                <button key={c.categoria} onClick={()=>onSave(c)}
                  className="px-3 py-2.5 border-[1.5px] border-border rounded-lg cursor-pointer bg-[#FAFAFA] text-left text-[13px] font-semibold text-ink flex items-center gap-2 touch-manipulation">
                  <span className="text-xl">{c.emoji}</span>{c.categoria}
                </button>
              ))}
            </div>
            <button onClick={()=>setShowNew(true)}
              className="w-full py-2.5 border-2 border-dashed border-border rounded-lg bg-none cursor-pointer text-[13px] font-bold text-muted mb-2 touch-manipulation">
              ➕ Nueva categoría
            </button>
          </>
        ) : (
          <div className="mb-3">
            <div className="text-xs font-bold text-muted mb-2">Nueva categoría</div>
            <div className="flex gap-2 mb-2.5">
              <input value={customEmoji} onChange={e=>setCustomEmoji(e.target.value)}
                className="w-[50px] p-2 rounded-lg border-[1.5px] border-border text-xl text-center outline-none"/>
              <input value={customName} onChange={e=>setCustomName(e.target.value)} placeholder="Nombre de categoría"
                className="flex-1 px-3 py-2 rounded-lg border-[1.5px] border-border text-sm outline-none"/>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>setShowNew(false)}
                className="flex-1 py-2.5 border-[1.5px] border-border rounded-lg bg-white cursor-pointer font-semibold text-muted touch-manipulation">Volver</button>
              <button onClick={handleNewSave} disabled={!customName.trim()}
                className={`flex-[2] py-2.5 border-none rounded-lg cursor-pointer font-bold text-white touch-manipulation ${customName.trim()?'bg-tab-cierre':'bg-border'}`}>Crear y asignar</button>
            </div>
          </div>
        )}

        <button onClick={onClose}
          className="w-full p-3 border-[1.5px] border-border rounded-lg bg-white cursor-pointer font-semibold text-muted text-sm touch-manipulation">Cancelar</button>
      </div>
    </div>
  );
}

export default function Tarjetas({ appData, saveData, movimientos, loading, onRefresh }) {
  const today = new Date();
  const [tab,        setTab]        = useState('mes');
  const [selKey,     setSelKey]     = useState(getKey(today));
  const [selTarjeta, setSelTarjeta] = useState(null);
  const [catEditando, setCatEditando] = useState(null);

  const dolarTarjetaMap = appData.dolarTarjeta || {};
  const [dolarInput, setDolarInput] = useState('');
  const categorias = appData.categories || {};

  const movimientosMes = (movimientos||[]).filter(m => String(m.mes||'').trim() === String(selKey||'').trim());
  const porTarjeta = { ICBC: movimientosMes.filter(m=>m.tarjeta==='ICBC'), BNA: movimientosMes.filter(m=>m.tarjeta==='BNA') };
  const dolarTarjeta = n(dolarTarjetaMap[selKey]) || 0;

  const guardarDolar = async () => {
    if (!dolarInput) return;
    await saveData({ ...appData, dolarTarjeta: { ...dolarTarjetaMap, [selKey]: n(dolarInput) } });
    setDolarInput('');
  };

  const setCategoria = async (cat) => {
    await saveData({ ...appData, categories: { ...categorias, [catEditando]: cat } });
    setCatEditando(null);
  };

  const [reparando, setReparando] = useState(false);
  const repararIconos = async () => {
    setReparando(true);
    const nuevas = { ...categorias };
    let cambios = 0;
    Object.keys(nuevas).forEach(key => {
      const correcto = emojiCorrectoParaCategoria(nuevas[key].categoria);
      if (correcto && nuevas[key].emoji !== correcto) { nuevas[key] = { ...nuevas[key], emoji: correcto }; cambios++; }
    });
    if (cambios > 0) await saveData({ ...appData, categories: nuevas });
    setReparando(false);
  };

  const hayUSD = movimientosMes.some(m => m.moneda === 'USD');

  if (selTarjeta) {
    const config = TARJETAS_CONFIG[selTarjeta];
    return <>
      <DetalleTarjeta movimientos={porTarjeta[selTarjeta]} config={config} dolarTarjeta={dolarTarjeta}
        categorias={categorias} setCategoria={setCatEditando} onBack={()=>setSelTarjeta(null)}/>
      {catEditando && <CatPickerModal comercio={catEditando} categorias={categorias} onSave={setCategoria} onClose={()=>setCatEditando(null)}/>}
    </>;
  }

  return (
    <div className="max-w-[480px] mx-auto p-4 bg-paper min-h-[calc(100vh-70px)]">
      <div className="rounded-2xl px-5 py-4.5 mb-4.5 text-white shadow-md flex justify-between items-center bg-tab-tarjetas">
        <div>
          <div className="text-xl font-extrabold">💳 Tarjetas</div>
          <div className="text-xs opacity-75 mt-0.5">Cargado por Zapia</div>
        </div>
        <div className="flex gap-2">
          <button onClick={repararIconos} disabled={reparando}
            className="bg-white/15 border border-white/30 rounded-lg text-white px-3 py-1.5 cursor-pointer text-xs font-bold touch-manipulation">
            {reparando ? '...' : '🔧'}
          </button>
          <button onClick={onRefresh} disabled={loading}
            className="bg-white/15 border border-white/30 rounded-lg text-white px-3 py-1.5 cursor-pointer text-xs font-bold touch-manipulation">
            {loading ? '...' : '↻'}
          </button>
        </div>
      </div>

      <div className="flex bg-border-soft rounded-xl p-1 mb-3.5 gap-0.5">
        {[['mes','📅 Mes'],['historial','📊 Historial']].map(([k,label])=>(
          <button key={k} onClick={()=>setTab(k)}
            className={`flex-1 py-2.5 border-none rounded-lg cursor-pointer font-bold text-xs touch-manipulation
              ${tab===k ? 'bg-white text-tab-tarjetas shadow-sm' : 'bg-transparent text-muted'}`}>{label}</button>
        ))}
      </div>

      {tab==='mes' && <>
      <select value={selKey} onChange={e=>setSelKey(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-border text-sm mb-3.5 bg-white text-ink font-semibold cursor-pointer">
        {monthOpts(today).map(k=><option key={k} value={k}>{fmtKey(k)}</option>)}
      </select>

      {hayUSD && (
        <div className="bg-[#EBF8FF] rounded-xl px-4 py-3 mb-3.5 border-[1.5px] border-[#90CDF4]">
          <div className="text-xs font-bold text-tab-tarjetas mb-2">💵 Dólar tarjeta de este mes</div>
          {dolarTarjeta > 0 && !dolarInput ? (
            <div className="text-sm font-bold text-ink">
              ${dolarTarjeta.toLocaleString('es-AR')}
              <button onClick={()=>setDolarInput(String(dolarTarjeta))}
                className="ml-2.5 border-none bg-white rounded-md cursor-pointer text-[11px] text-tab-tarjetas px-2 py-0.5 touch-manipulation">editar</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-white rounded-lg border-[1.5px] border-[#90CDF4] px-3 py-1.5 gap-1">
                <span className="text-muted-light">$</span>
                <input type="number" inputMode="decimal" value={dolarInput} onChange={e=>setDolarInput(e.target.value)} placeholder="1969.50"
                  className="flex-1 border-none outline-none text-base font-bold text-ink bg-transparent tabular-nums"/>
              </div>
              <button onClick={guardarDolar} className="px-4 py-2 border-none rounded-lg bg-tab-tarjetas text-white font-bold cursor-pointer touch-manipulation">OK</button>
            </div>
          )}
        </div>
      )}

      {loading && (
        <>
          {[0,1].map(i => (
            <div key={i} className="rounded-2xl overflow-hidden mb-3 shadow-sm">
              <Skeleton className="h-11 rounded-none"/>
              <div className="bg-white px-4 py-3.5">
                <Skeleton className="h-2.5 w-20 mb-2.5"/>
                <Skeleton className="h-7 w-32 mb-3"/>
                <Skeleton className="h-2.5 w-40"/>
              </div>
            </div>
          ))}
        </>
      )}

      {!loading && movimientosMes.length === 0 && (
        <div className="text-center px-5 py-12.5 text-muted-light">
          <div className="text-6xl mb-4">📎</div>
          <div className="text-base font-bold text-muted mb-2">Sin resúmenes este mes</div>
          <div className="text-[13px] leading-relaxed max-w-[280px] mx-auto">
            Pasale los PDFs a Zapia con la instrucción de cargar en la hoja "Tarjetas" — acá se reflejan solos.
          </div>
        </div>
      )}

      {!loading && Object.entries(TARJETAS_CONFIG).map(([key, config]) => {
        const movs = porTarjeta[key];
        if (movs.length === 0) return null;
        const montoEnPesos = (m) => m.moneda === 'USD' ? m.importe * dolarTarjeta : m.importe;
        const cuotasItems      = movs.filter(m => m.cuotas && m.cuotas.trim() !== '');
        const financierosItems = movs.filter(m => (!m.cuotas || m.cuotas.trim()==='') && TIPOS_FINANCIEROS.includes(m.tipoMovimiento));
        const consumos         = movs.filter(m => (!m.cuotas || m.cuotas.trim()==='') && !TIPOS_FINANCIEROS.includes(m.tipoMovimiento));
        const total = movs.reduce((s,m)=>s+montoEnPesos(m),0);
        const totalConsumos = consumos.reduce((s,m)=>s+montoEnPesos(m),0);
        const totalCuotas   = cuotasItems.reduce((s,m)=>s+montoEnPesos(m),0);

        return (
          <div key={key} onClick={()=>setSelTarjeta(key)}
            className="bg-white rounded-2xl overflow-hidden mb-3 cursor-pointer shadow-sm touch-manipulation">
            <div className="text-white px-4 py-3 flex justify-between items-center" style={{background:config.color}}>
              <span className="font-bold text-sm">{config.icon} {config.nombre}</span>
              <span className="text-xs opacity-80">›</span>
            </div>
            <div className="px-4 py-3.5">
              <div className="text-[10px] text-muted-light uppercase font-bold tracking-wide">Total del mes</div>
              <div className="text-[26px] font-extrabold text-ink tracking-tight mb-2.5 tabular-nums">{$$(total)}</div>
              <div className="flex gap-2.5 text-[11px] text-muted flex-wrap">
                <span>🛍️ Consumos {$$(totalConsumos)}</span>
                {cuotasItems.length>0 && <span>🧾 Cuotas {$$(totalCuotas)}</span>}
                {financierosItems.length>0 && <span>💰 Otros {financierosItems.length}</span>}
              </div>
            </div>
          </div>
        );
      })}
      </>}

      {tab==='historial' && (
        <TarjetasHistorial movimientos={movimientos} dolarTarjetaMap={dolarTarjetaMap}/>
      )}
    </div>
  );
}

function TarjetasHistorial({ movimientos, dolarTarjetaMap }) {
  const mesesConDatos = [...new Set((movimientos||[]).map(m => m.mes))].filter(Boolean).sort();

  if (mesesConDatos.length === 0) {
    return (
      <div className="text-center px-5 py-12.5 text-muted-light">
        <div className="text-6xl mb-4">📊</div>
        <div className="text-base font-bold text-muted mb-2">Sin historial todavía</div>
        <div className="text-[13px]">Cuando tengas resúmenes de más de un mes, acá vas a ver la evolución.</div>
      </div>
    );
  }

  const chartData = mesesConDatos.slice(-6).map(mes => {
    const dolar = n(dolarTarjetaMap[mes]) || 0;
    const montoEnPesos = (m) => m.moneda === 'USD' ? m.importe * dolar : m.importe;
    const movsMes = (movimientos||[]).filter(m => m.mes === mes);
    const icbc = movsMes.filter(m => m.tarjeta === 'ICBC').reduce((s,m)=>s+montoEnPesos(m), 0);
    const bna  = movsMes.filter(m => m.tarjeta === 'BNA').reduce((s,m)=>s+montoEnPesos(m), 0);
    return { mes: fmtKey(mes).split(' ')[0].substring(0,3), ICBC: icbc, BNA: bna };
  });

  const histRows = mesesConDatos.map(mes => {
    const dolar = n(dolarTarjetaMap[mes]) || 0;
    const montoEnPesos = (m) => m.moneda === 'USD' ? m.importe * dolar : m.importe;
    const movsMes = (movimientos||[]).filter(m => m.mes === mes);
    const icbc = movsMes.filter(m => m.tarjeta === 'ICBC').reduce((s,m)=>s+montoEnPesos(m), 0);
    const bna  = movsMes.filter(m => m.tarjeta === 'BNA').reduce((s,m)=>s+montoEnPesos(m), 0);
    return { mes, icbc, bna };
  }).reverse();

  return (
    <>
      <div className="bg-white rounded-2xl px-3 py-4 mb-3.5 shadow-sm">
        <div className="font-bold text-ink mb-3 text-[13px] pl-1">ICBC vs Banco Nación — últimos {chartData.length} meses</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barGap={3} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false}/>
            <XAxis dataKey="mes" tick={{fontSize:11,fill:'#6B6459'}} axisLine={false} tickLine={false}/>
            <YAxis tickFormatter={v=>`$${Math.round(v/1000)}K`} tick={{fontSize:10,fill:'#6B6459'}} width={52} axisLine={false} tickLine={false}/>
            <Tooltip formatter={v=>$$(v)} contentStyle={{borderRadius:8,border:'1px solid #E2DDD3',fontSize:12}}/>
            <Legend wrapperStyle={{fontSize:12}}/>
            <Bar dataKey="ICBC" fill="#6B21A8" radius={[4,4,0,0]}/>
            <Bar dataKey="BNA"  fill="#2B6CB0" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-ink text-white px-4 py-2.5 font-bold text-[13px]">Detalle por mes</div>
        <table className="w-full border-collapse text-xs">
          <thead><tr className="bg-border-soft">
            {['Mes','ICBC','BNA','Total'].map(h=>(
              <th key={h} className={`px-2.5 py-2 ${h==='Mes'?'text-left':'text-right'} text-muted font-bold border-b border-border text-[10px] uppercase`}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {histRows.map(({mes,icbc,bna},i) => (
              <tr key={mes} className={i%2===0?'bg-white':'bg-paper'}>
                <td className="px-2.5 py-2.5 font-semibold text-ink">{fmtKey(mes)}</td>
                <td className="px-2.5 py-2.5 text-right text-tab-cierre tabular-nums">{icbc>0?$$(icbc):'—'}</td>
                <td className="px-2.5 py-2.5 text-right text-tab-tarjetas tabular-nums">{bna>0?$$(bna):'—'}</td>
                <td className="px-2.5 py-2.5 text-right font-extrabold text-ink tabular-nums">{$$(icbc+bna)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
