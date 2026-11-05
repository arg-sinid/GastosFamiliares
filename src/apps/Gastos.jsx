import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  $$, n, fmtK, getKey, fmtKey, getMonday, weekDates, dateStr, fmtDate, monthOpts,
  itemsDelMes, itemsDeLaSemana, agruparItems, calcularTotalesTarjetas, resolverMes, esCategoriaAuto, desfaseTarjetas, mesDesplazado, fechaVencimiento,
} from '../utils.js';
import {
  categorizarNuevos, emojiCorrectoParaCategoria, TIPOS_FINANCIEROS,
} from '../categorias.js';
import { Skeleton, CategoriaModal, VehiculoModal } from '../components/ui.jsx';

// Los charts de recharts necesitan hex reales (no clases).
const TARJETAS_CONFIG = {
  ICBC: { nombre:'Tarjeta ICBC',         color:'#6B21A8', icon:'💳' },
  BNA:  { nombre:'Tarjeta Banco Nación', color:'#2B6CB0', icon:'💳' },
};
const fmtFechaCorta = f => f.split('-').reverse().join('/');

function EditCatModal({ categorias, onSave, onClose }) {
  const cats = {};
  Object.entries(categorias).forEach(([desc, cat]) => {
    if (!cats[cat.categoria]) cats[cat.categoria] = { emoji:cat.emoji, items:[], nombre:cat.categoria };
    cats[cat.categoria].items.push(desc);
  });
  const lista = Object.values(cats).sort((a,b)=>a.nombre.localeCompare(b.nombre));
  const [editNombre, setEditNombre] = useState({});
  const [editEmoji,  setEditEmoji]  = useState({});

  const guardarRename = (oldNombre) => {
    const newNombre = editNombre[oldNombre]?.trim();
    const newEmoji  = editEmoji[oldNombre];
    if (!newNombre || newNombre === oldNombre) return;
    const updated = { ...categorias };
    Object.keys(updated).forEach(desc => {
      if (updated[desc].categoria === oldNombre) updated[desc] = { categoria:newNombre, emoji:newEmoji||updated[desc].emoji };
    });
    onSave(updated);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-end justify-center">
      <div className="bg-white rounded-t-[20px] px-4 pt-5 pb-8 w-full max-w-[500px] max-h-[85vh] overflow-y-auto">
        <div className="font-extrabold text-base mb-1 text-ink">Gestionar categorías</div>
        <div className="text-xs text-muted mb-4">Editá el nombre o emoji. Aplica a todos los gastos con esa categoría.</div>
        {lista.map(cat => (
          <div key={cat.nombre} className="bg-[#FAFAFA] rounded-lg px-3.5 py-3 mb-2.5 border border-border">
            <div className="text-[11px] text-muted-light mb-1.5">{cat.items.length} gasto{cat.items.length>1?'s':''}</div>
            <div className="flex gap-2">
              <input value={editEmoji[cat.nombre]??cat.emoji} onChange={e=>setEditEmoji(p=>({...p,[cat.nombre]:e.target.value}))}
                className="w-11 p-1.5 rounded-lg border-[1.5px] border-border text-lg text-center outline-none"/>
              <input value={editNombre[cat.nombre]??cat.nombre} onChange={e=>setEditNombre(p=>({...p,[cat.nombre]:e.target.value}))}
                className="flex-1 px-2.5 py-1.5 rounded-lg border-[1.5px] border-border text-sm outline-none"/>
              <button onClick={()=>guardarRename(cat.nombre)}
                className="px-3.5 py-1.5 border-none rounded-lg bg-tab-tarjetas text-white font-bold text-xs cursor-pointer touch-manipulation">OK</button>
            </div>
          </div>
        ))}
        <button onClick={onClose} className="w-full p-3 border-[1.5px] border-border rounded-lg bg-white cursor-pointer font-semibold text-muted text-sm mt-1 touch-manipulation">Cerrar</button>
      </div>
    </div>
  );
}

// Detalle de una tarjeta en un mes: consumos por categoría, cuotas y pagos/impuestos/intereses.
function DetalleTarjeta({ items, config, categorias, onEditar, onBack }) {
  const [expanded, setExpanded] = useState({});
  const cuotas      = items.filter(m => m.cuotas && m.cuotas.trim() !== '');
  const financieros = items.filter(m => (!m.cuotas || m.cuotas.trim()==='') && TIPOS_FINANCIEROS.includes(m.tipoMovimiento));
  const consumos    = items.filter(m => (!m.cuotas || m.cuotas.trim()==='') && !TIPOS_FINANCIEROS.includes(m.tipoMovimiento));
  const sum = arr => arr.reduce((s,m)=>s+m.monto,0);
  const totalGeneral = sum(items);
  const grupos = Object.entries(agruparItems(consumos, categorias)).sort((a,b)=>b[1].total-a[1].total);

  return (
    <div className="max-w-[480px] mx-auto p-4 bg-paper min-h-[calc(100vh-70px)]">
      <button onClick={onBack} className="border-none bg-border-soft rounded-lg cursor-pointer px-4 py-2 font-bold text-muted mb-4 touch-manipulation">‹ Volver</button>
      <div className="rounded-2xl px-5 py-4.5 mb-4.5 text-white shadow-md" style={{background:config.color}}>
        <div className="text-xl font-extrabold">{config.icon} {config.nombre}</div>
        <div className="text-[32px] font-extrabold mt-2.5 tracking-tight tabular-nums">{$$(totalGeneral)}</div>
        <div className="text-[11px] opacity-80 mt-1">{consumos.length} consumos · {cuotas.length} en cuotas · {financieros.length} otros</div>
      </div>

      <div className="bg-white rounded-2xl px-4 py-3.5 mb-3.5 shadow-sm">
        <div className="flex justify-between py-1.5"><span className="text-[13px] text-muted">Consumos categorizables</span><span className="text-sm font-bold text-ink tabular-nums">{$$(sum(consumos))}</span></div>
        {cuotas.length > 0 && <div className="flex justify-between py-1.5 border-t border-border-soft"><span className="text-[13px] text-muted">Cuotas</span><span className="text-sm font-bold text-tab-cierre tabular-nums">{$$(sum(cuotas))}</span></div>}
        {financieros.length > 0 && <div className="flex justify-between py-1.5 border-t border-border-soft"><span className="text-[13px] text-muted">Pagos / impuestos / intereses</span><span className="text-sm font-bold text-negative tabular-nums">{$$(sum(financieros))}</span></div>}
      </div>

      {cuotas.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
          <div className="bg-tab-cierre text-white px-4 py-2.5 font-bold text-[13px] flex justify-between"><span>🧾 Cuotas</span><span className="text-[11px] opacity-80">{$$(sum(cuotas))}</span></div>
          {cuotas.map((m,i) => (
            <div key={m.id} className={`flex items-center px-3.5 py-2.5 ${i<cuotas.length-1?'border-b border-border-soft':''}`}>
              <div className="flex-1">
                <div className="text-xs text-ink">{m.key} <span className="text-[10px] bg-accent-soft text-accent-strong rounded px-1.5 py-0.5 font-bold">{m.cuotas}</span></div>
                <div className="text-[11px] text-muted-light">{fmtFechaCorta(m.fecha)}{m.moneda==='USD'&&<span className="text-tab-tarjetas ml-1.5">USD {m.importe.toFixed(2)}</span>}</div>
              </div>
              <span className="font-bold text-[13px] text-tab-cierre tabular-nums">{$$(m.monto)}</span>
            </div>
          ))}
        </div>
      )}

      {grupos.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
          <div className="text-white px-4 py-2.5 font-bold text-[13px]" style={{background:config.color}}>Consumos por categoría</div>
          {grupos.map(([cat,data]) => (
            <div key={cat}>
              <div onClick={()=>setExpanded(p=>({...p,[cat]:!p[cat]}))}
                className={`flex items-center px-3.5 py-3 border-b border-border-soft cursor-pointer touch-manipulation ${expanded[cat]?'bg-[#FAFAFA]':'bg-white'}`}>
                <span className="text-xl mr-2.5">{data.emoji}</span>
                <span className="flex-1 text-[13px] font-bold text-ink">{cat}</span>
                <span className="text-[11px] text-muted-light mr-2.5">{data.items.length}</span>
                <span className="font-extrabold text-sm mr-2 tabular-nums" style={{color:config.color}}>{$$(data.total)}</span>
                <span className="text-muted-light text-xs">{expanded[cat]?'▲':'▼'}</span>
              </div>
              {expanded[cat] && data.items.map(m => (
                <div key={m.id} className="flex items-center pl-11 pr-3.5 py-2.5 border-b border-border-soft bg-[#FAFAFA]">
                  <div className="flex-1">
                    <div className="text-xs text-ink">{m.key}</div>
                    <div className="text-[11px] text-muted-light flex gap-2 items-center">
                      <span>{fmtFechaCorta(m.fecha)}</span>
                      {m.moneda==='USD'&&<span className="text-tab-tarjetas">USD {m.importe.toFixed(2)}</span>}
                      <button onClick={()=>onEditar(m)} className="border-none bg-border-soft rounded-md cursor-pointer text-[10px] text-muted px-1.5 py-0.5 touch-manipulation">✏️</button>
                    </div>
                  </div>
                  <span className="font-bold text-[13px] tabular-nums" style={{color:config.color}}>{$$(m.monto)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {financieros.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-tab-gastos text-white px-4 py-2.5 font-bold text-[13px]">💰 Pagos / Impuestos / Intereses</div>
          {financieros.map((m,i) => (
            <div key={m.id} className={`flex items-center px-3.5 py-2.5 ${i<financieros.length-1?'border-b border-border-soft':''}`}>
              <div className="flex-1"><div className="text-xs text-ink">{m.key}</div><div className="text-[11px] text-muted-light">{fmtFechaCorta(m.fecha)} · {m.tipoMovimiento}</div></div>
              <span className="font-bold text-[13px] text-tab-gastos tabular-nums">{$$(m.monto)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistorialTarjetas({ tarjetasData, dolarMap }) {
  const meses = [...new Set((tarjetasData||[]).map(m => m.mes))].filter(Boolean).sort();
  if (meses.length === 0) return (
    <div className="text-center px-5 py-12.5 text-muted-light">
      <div className="text-6xl mb-4">📊</div>
      <div className="text-base font-bold text-muted mb-2">Sin historial todavía</div>
      <div className="text-[13px]">Cuando haya resúmenes de más de un mes, acá vas a ver la evolución.</div>
    </div>
  );
  const totales = calcularTotalesTarjetas(tarjetasData, dolarMap);
  const rows = meses.map(mes => ({ mes, icbc: totales[mes]?.icbc || 0, bna: totales[mes]?.bna || 0 }));
  const chartData = rows.slice(-6).map(r => ({ mes: fmtKey(r.mes).split(' ')[0].substring(0,3), ICBC:r.icbc, BNA:r.bna }));
  return (
    <>
      <div className="bg-white rounded-2xl px-3 py-4 mb-3.5 shadow-sm">
        <div className="font-bold text-ink mb-3 text-[13px] pl-1">ICBC vs Banco Nación — últimos {chartData.length} meses</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barGap={3} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false}/>
            <XAxis dataKey="mes" tick={{fontSize:11,fill:'#6B6459'}} axisLine={false} tickLine={false}/>
            <YAxis tickFormatter={fmtK} tick={{fontSize:10,fill:'#6B6459'}} width={52} axisLine={false} tickLine={false}/>
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
          <thead><tr className="bg-border-soft">{['Mes','ICBC','BNA','Total'].map(h=><th key={h} className={`px-2.5 py-2 ${h==='Mes'?'text-left':'text-right'} text-muted font-bold border-b border-border text-[10px] uppercase`}>{h}</th>)}</tr></thead>
          <tbody>
            {[...rows].reverse().map(({mes,icbc,bna},i) => (
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

export default function Gastos({ zapiaData, tarjetasData, appData, saveData, onRefresh, onRefreshTarjetas, loadingTarjetas }) {
  const today = new Date();
  const [tab,       setTab]       = useState('detalle');
  const [filtro,    setFiltro]    = useState('mes');
  const [selMes,    setSelMes]    = useState(getKey(today));
  const [monday,    setMonday]    = useState(()=>getMonday(today));
  const [expanded,  setExpanded]  = useState({});
  const [editKeys,  setEditKeys]  = useState(null);      // claves (comercio/descripcion) a recategorizar
  const [editLabel, setEditLabel] = useState('');
  const [editIds,   setEditIds]   = useState([]);
  const [pendVeh,   setPendVeh]   = useState(null);     // { cat, keys, ids, label } esperando elegir vehículo
  const [showEditCats, setShowEditCats] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected,  setSelected]  = useState(new Set());
  const [selTarjeta, setSelTarjeta] = useState(null);
  const [dolarInput, setDolarInput] = useState('');
  const [reparando, setReparando] = useState(false);

  const categories = appData.categories || {};
  const vehiculos  = appData.vehiculos || [];
  const dolarMap   = appData.dolarTarjeta || {};
  const dolarMes   = n(dolarMap[selMes]) || 0;

  const handleRefresh = async () => { setRefreshing(true); await onRefresh?.(); setRefreshing(false); };

  const wDates = weekDates(monday);
  const wStr   = wDates.map(d=>dateStr(d));
  const isCurrentWeek = dateStr(monday) === dateStr(getMonday(today));

  // Categoriza automáticamente lo nuevo de Zapia (se guarda por descripción, como antes).
  useEffect(() => {
    if (!zapiaData.length) return;
    const nuevas = categorizarNuevos(zapiaData, categories);
    if (Object.keys(nuevas).length > 0) saveData({ ...appData, categories: { ...categories, ...nuevas } });
  }, [zapiaData]);

  // Mismas funciones que usan Principal, Cierre y Auto → los totales coinciden.
  const items = filtro === 'semana'
    ? itemsDeLaSemana(zapiaData, tarjetasData, dolarMap, wStr)
    : itemsDelMes(zapiaData, tarjetasData, dolarMap, selMes);
  const zapiaItems   = items.filter(i => i.origen === 'zapia');
  const tarjetaItems = items.filter(i => i.origen === 'tarjeta');
  const totalGen     = items.reduce((s,r)=>s+r.monto,0);
  const totalGerman  = zapiaItems.filter(r=>r.quien==='Germán').reduce((s,r)=>s+r.monto,0);
  const totalJuli    = zapiaItems.filter(r=>r.quien==='Julieta').reduce((s,r)=>s+r.monto,0);
  const totalTarjeta = tarjetaItems.reduce((s,r)=>s+r.monto,0);
  const sortedGrupos = Object.entries(agruparItems(items, categories)).sort((a,b)=>b[1].total-a[1].total);

  // Fijos del Principal: solo lectura acá (se editan en Principal).
  const totalesTarjetas = calcularTotalesTarjetas(tarjetasData, dolarMap, desfaseTarjetas(appData.ajustes));
  const fijos = resolverMes(appData.monthly || {}, appData.gastosRecurrentes || {}, totalesTarjetas, selMes).gastos;
  const FIJOS = [['prestamos','🏦 Préstamos'],['nicolas','👤 Nicolás'],['segundo','👤 Segundo'],['alquiler','🏠 Alquiler']].filter(([k]) => n(fijos[k]) > 0);

  const pedirCategoria = (keys, label, ids = []) => { setEditKeys(keys); setEditLabel(label); setEditIds(ids); };

  // Guarda la categoría y, si es del auto, a qué vehículo se imputa cada gasto elegido.
  // El gasto sigue siendo uno solo: acá solo se anota la imputación (gastoVehiculo).
  const aplicarCategoria = async (keys, cat, ids, vehiculoId) => {
    const updates = {}; keys.forEach(k => { updates[k] = cat; });
    const next = { ...appData, categories: { ...categories, ...updates } };
    if (vehiculoId && ids.length) {
      next.gastoVehiculo = { ...(appData.gastoVehiculo || {}) };
      next.autoDetalle = { ...(appData.autoDetalle || {}) };
      ids.forEach(id => { next.gastoVehiculo[id] = vehiculoId; if (next.autoDetalle[id]) next.autoDetalle[id] = { ...next.autoDetalle[id], vehiculoId }; });
    }
    await saveData(next);
    setSelectionMode(false); setSelected(new Set());
  };
  const recategorizar = async (cat) => {
    const keys = editKeys, ids = editIds, label = editLabel;
    setEditKeys(null);
    if (esCategoriaAuto(cat.categoria) && vehiculos.length > 1) { setPendVeh({ cat, keys, ids, label }); return; }
    await aplicarCategoria(keys, cat, ids, null);
  };
  const elegirVehiculo = async (vehiculoId) => {
    const { cat, keys, ids } = pendVeh; setPendVeh(null);
    await aplicarCategoria(keys, cat, ids, vehiculoId);
  };
  const guardarCategorias = async (newCats) => { await saveData({ ...appData, categories: newCats }); };

  const prevWeek = () => { const d=new Date(monday);d.setDate(d.getDate()-7);setMonday(d); };
  const nextWeek = () => { const d=new Date(monday);d.setDate(d.getDate()+7);setMonday(d); };
  const toggleSelected = id => setSelected(prev => { const nx = new Set(prev); nx.has(id) ? nx.delete(id) : nx.add(id); return nx; });
  const selectedItems = items.filter(i => selected.has(i.id));
  const toggleSelectionMode = () => { setSelectionMode(p=>!p); setSelected(new Set()); };

  const guardarDolar = async () => {
    if (!dolarInput) return;
    await saveData({ ...appData, dolarTarjeta: { ...dolarMap, [selMes]: n(dolarInput) } });
    setDolarInput('');
  };
  const repararIconos = async () => {
    setReparando(true);
    const nuevas = { ...categories }; let cambios = 0;
    Object.keys(nuevas).forEach(key => {
      const correcto = emojiCorrectoParaCategoria(nuevas[key].categoria);
      if (correcto && nuevas[key].emoji !== correcto) { nuevas[key] = { ...nuevas[key], emoji: correcto }; cambios++; }
    });
    if (cambios > 0) await saveData({ ...appData, categories: nuevas });
    setReparando(false);
  };

  const modales = (
    <>
      {pendVeh && <VehiculoModal subtitulo={`${pendVeh.label} → ${pendVeh.cat.emoji} ${pendVeh.cat.categoria}`} vehiculos={vehiculos} onSelect={elegirVehiculo} onClose={()=>setPendVeh(null)}/>}
      {editKeys && <CategoriaModal subtitulo={editLabel} categorias={categories} onSelect={recategorizar} onClose={()=>setEditKeys(null)}/>}
      {showEditCats && <EditCatModal categorias={categories} onSave={guardarCategorias} onClose={()=>setShowEditCats(false)}/>}
    </>
  );

  // Detalle de una tarjeta (pantalla completa dentro de Gastos)
  if (selTarjeta) {
    const movs = itemsDelMes([], tarjetasData, dolarMap, selMes).filter(m => m.tarjeta === selTarjeta);
    return <>
      <DetalleTarjeta items={movs} config={TARJETAS_CONFIG[selTarjeta]} categorias={categories}
        onEditar={m => pedirCategoria([m.key], `"${m.key}"`, [m.id])} onBack={()=>setSelTarjeta(null)}/>
      {modales}
    </>;
  }

  const hayUSD = tarjetasData.some(m => m.mes === selMes && m.moneda === 'USD');
  const mesesOpts = monthOpts(today);

  return (
    <div className="max-w-[640px] mx-auto p-4 bg-paper min-h-[calc(100vh-70px)]">
      {modales}

      <div className="rounded-2xl px-5 py-4.5 mb-4.5 text-white shadow-md flex justify-between items-center bg-tab-gastos">
        <div>
          <div className="text-xl font-extrabold">🏷️ Gastos</div>
          <div className="text-xs opacity-75 mt-0.5">Zapia · WhatsApp + Tarjetas + Fijos</div>
        </div>
        <div className="flex gap-2">
          <button onClick={tab==='tarjetas' ? onRefreshTarjetas : handleRefresh} disabled={refreshing||loadingTarjetas}
            className="bg-white/15 border border-white/30 rounded-lg text-white px-2.5 py-1.5 cursor-pointer text-xs font-bold touch-manipulation">{refreshing||loadingTarjetas ? '...' : '↻'}</button>
          <button onClick={()=>setShowEditCats(true)}
            className="bg-white/15 border border-white/30 rounded-lg text-white px-2.5 py-1.5 cursor-pointer text-xs font-bold touch-manipulation">✏️ Categorías</button>
          {tab==='detalle' && (
            <button onClick={toggleSelectionMode}
              className={`border border-white/30 rounded-lg px-2.5 py-1.5 cursor-pointer text-xs font-bold touch-manipulation ${selectionMode?'bg-white text-tab-gastos':'bg-white/15 text-white'}`}>{selectionMode ? '✕' : '☑️'}</button>
          )}
        </div>
      </div>

      <div className="flex bg-border-soft rounded-xl p-1 mb-3.5 gap-0.5">
        {[['detalle','🏷️ Gastos'],['tarjetas','💳 Tarjetas'],['historial','📊 Historial']].map(([k,label]) => (
          <button key={k} onClick={()=>setTab(k)}
            className={`flex-1 py-2.5 border-none rounded-lg cursor-pointer font-bold text-xs touch-manipulation ${tab===k ? 'bg-white text-tab-gastos shadow-sm' : 'bg-transparent text-muted'}`}>{label}</button>
        ))}
      </div>

      {tab==='detalle' && (<>
        <div className="mb-3.5">
          <div className="flex bg-border-soft rounded-lg p-1 gap-0.5 mb-2.5">
            {[['semana','Semana'],['mes','Mes']].map(([k,label])=>(
              <button key={k} onClick={()=>setFiltro(k)}
                className={`flex-1 py-2 border-none rounded-lg cursor-pointer font-bold text-xs touch-manipulation ${filtro===k ? 'bg-white text-tab-gastos shadow-sm' : 'bg-transparent text-muted'}`}>{label}</button>
            ))}
          </div>
          {filtro==='semana' ? (
            <>
              <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 shadow-sm">
                <button onClick={prevWeek} className="border-none bg-none cursor-pointer text-2xl text-tab-gastos px-2 touch-manipulation">‹</button>
                <div className="text-center">
                  <div className="font-bold text-ink text-[13px]">{fmtDate(wDates[0])} – {fmtDate(wDates[6])}</div>
                  {isCurrentWeek&&<div className="text-[11px] text-muted-light">Semana actual</div>}
                </div>
                <button onClick={nextWeek} className="border-none bg-none cursor-pointer text-2xl text-tab-gastos px-2 touch-manipulation">›</button>
              </div>
              <div className="text-[11px] text-muted-light mt-1.5">Las compras de tarjeta se muestran por fecha de compra y aparecen cuando llega el resumen.</div>
            </>
          ) : (
            <select value={selMes} onChange={e=>setSelMes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-border text-sm bg-white text-ink font-semibold cursor-pointer">
              {mesesOpts.map(k=><option key={k} value={k}>{fmtKey(k)}{k===getKey(today)?' — actual':''}</option>)}
            </select>
          )}
        </div>

        {items.length===0&&(
          <div className="text-center px-5 py-15 text-muted-light">
            <div className="text-5xl mb-3">📋</div>
            <div className="font-semibold mb-1.5">Sin gastos {filtro==='semana'?'esta semana':'este mes'}</div>
            <div className="text-[13px]">Los gastos de WhatsApp y los consumos de tarjeta aparecen acá automáticamente.</div>
          </div>
        )}

        {items.length>0&&(
          <div className="bg-white rounded-2xl px-4 py-3.5 mb-3.5 shadow-sm">
            <div className="flex justify-between items-center mb-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Total {filtro==='semana'?'semana':'mes'}</div>
              <div className="text-[26px] font-extrabold text-tab-gastos tracking-tight tabular-nums">{$$(totalGen)}</div>
            </div>
            {(totalGerman>0||totalJuli>0||totalTarjeta>0)&&<>
              <div className="h-2 bg-border-soft rounded-lg overflow-hidden flex mb-1.5">
                <div className="h-full bg-tab-tarjetas" style={{width:`${totalGen>0?totalGerman/totalGen*100:0}%`}}/>
                <div className="h-full bg-julieta" style={{width:`${totalGen>0?totalJuli/totalGen*100:0}%`}}/>
                <div className="h-full bg-tab-cierre" style={{width:`${totalGen>0?totalTarjeta/totalGen*100:0}%`}}/>
              </div>
              <div className="flex justify-between text-xs flex-wrap gap-1.5">
                {totalGerman>0&&<span className="text-tab-tarjetas font-semibold">👨 Germán {$$(totalGerman)}</span>}
                {totalJuli>0&&<span className="text-julieta font-semibold">👩 Julieta {$$(totalJuli)}</span>}
                {totalTarjeta>0&&<span className="text-tab-cierre font-semibold">💳 Tarjeta {$$(totalTarjeta)}</span>}
              </div>
            </>}
          </div>
        )}

        {filtro==='mes' && FIJOS.length>0 && (
          <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
            <div className="bg-negative text-white px-4 py-2.5 font-bold text-[13px] flex justify-between"><span>📌 Gastos fijos</span><span className="text-[11px] opacity-80 font-normal">se editan en Principal</span></div>
            {FIJOS.map(([k,label],i)=>(
              <div key={k} className={`flex justify-between px-4 py-2.5 ${i<FIJOS.length-1?'border-b border-border-soft':''}`}>
                <span className="text-[13px] text-ink">{label}</span><span className="text-[13px] font-bold text-negative tabular-nums">{$$(n(fijos[k]))}</span>
              </div>
            ))}
          </div>
        )}

        {sortedGrupos.length>0&&(
          <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
            <div className="bg-tab-gastos text-white px-4 py-2.5 font-bold text-[13px] flex justify-between">
              <span>Por categoría</span><span className="text-[11px] opacity-80">{sortedGrupos.length} categorías</span>
            </div>
            {sortedGrupos.map(([cat,data])=>(
              <div key={cat}>
                <div onClick={()=>setExpanded(p=>({...p,[cat]:!p[cat]}))}
                  className={`flex items-center px-3.5 py-3 border-b border-[#FFF3E0] cursor-pointer touch-manipulation ${expanded[cat]?'bg-[#FFFBF5]':'bg-white'}`}>
                  <span className="text-xl mr-2.5">{data.emoji}</span>
                  <span className="flex-1 text-[13px] font-bold text-ink">{cat}</span>
                  <span className="text-[11px] text-muted-light mr-2.5">{data.items.length} gasto{data.items.length>1?'s':''}</span>
                  <span className="font-extrabold text-sm text-tab-gastos mr-2 tabular-nums">{$$(data.total)}</span>
                  <span className="text-muted-light text-xs">{expanded[cat]?'▲':'▼'}</span>
                </div>
                {expanded[cat]&&data.items.map(item=>(
                  <div key={item.id} onClick={()=>selectionMode&&toggleSelected(item.id)}
                    className={`flex items-center pl-11 pr-3.5 py-2.5 border-b border-border-soft touch-manipulation ${selectionMode&&selected.has(item.id)?'bg-[#FFF3E0]':'bg-[#FAFAFA]'} ${selectionMode?'cursor-pointer':'cursor-default'}`}>
                    {selectionMode && <input type="checkbox" checked={selected.has(item.id)} onChange={()=>toggleSelected(item.id)} className="w-[18px] h-[18px] mr-2.5 shrink-0"/>}
                    <div className="flex-1">
                      <div className="text-[13px] text-ink font-medium">{item.key}</div>
                      <div className="text-[11px] text-muted-light mt-0.5 flex gap-2 items-center flex-wrap">
                        {item.origen==='zapia' ? (<><span>{item.quien==='Germán'?'👨':'👩'}</span><span>{item.medio==='efectivo'?'💵':'📲'}</span></>) : (<>
                          <span className="bg-accent-soft text-accent-strong rounded px-1.5 py-0.5 font-bold">💳 {item.tarjeta}</span>
                          {item.cuotas && <span className="text-[10px] bg-accent-soft text-accent-strong rounded px-1.5 py-0.5 font-bold">{item.cuotas}</span>}
                          {item.tipoMovimiento && TIPOS_FINANCIEROS.includes(item.tipoMovimiento) && <span className="text-[10px] bg-orange-100 text-tab-gastos rounded px-1.5 py-0.5 font-bold">{item.tipoMovimiento}</span>}
                        </>)}
                        <span>{fmtFechaCorta(item.fecha)}</span>
                        {!selectionMode && <button onClick={()=>pedirCategoria([item.key], `"${item.key}"`, [item.id])}
                          className="border-none bg-border-soft rounded-md cursor-pointer text-[10px] text-muted px-1.5 py-0.5 font-semibold touch-manipulation">✏️ cambiar</button>}
                      </div>
                    </div>
                    <span className="font-bold text-[13px] text-tab-gastos tabular-nums">{$$(item.monto)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {selectionMode && selected.size > 0 && (
          <div className="fixed left-0 right-0 bottom-[70px] flex justify-center z-[200] px-4">
            <div className="bg-ink rounded-2xl px-3 py-2.5 flex items-center gap-2.5 shadow-lg w-full max-w-[500px]">
              <span className="text-white text-[13px] font-bold flex-1">{selected.size} seleccionado{selected.size>1?'s':''}</span>
              <button onClick={()=>setSelected(new Set())} className="border-none bg-white/15 rounded-lg text-white px-3 py-2 cursor-pointer text-xs font-semibold touch-manipulation">Limpiar</button>
              <button onClick={()=>pedirCategoria([...new Set(selectedItems.map(i=>i.key))], `${selectedItems.length} gastos seleccionados`, selectedItems.map(i=>i.id))}
                className="border-none bg-tab-gastos rounded-lg text-white px-3.5 py-2 cursor-pointer text-xs font-bold touch-manipulation">🏷️ Asignar categoría</button>
            </div>
          </div>
        )}
      </>)}

      {tab==='tarjetas' && (<>
        <select value={selMes} onChange={e=>setSelMes(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-border text-sm mb-3.5 bg-white text-ink font-semibold cursor-pointer">
          {mesesOpts.map(k=><option key={k} value={k}>{fmtKey(k)}{k===getKey(today)?' — actual':''}</option>)}
        </select>

        {hayUSD && (
          <div className="bg-[#EBF8FF] rounded-xl px-4 py-3 mb-3.5 border-[1.5px] border-[#90CDF4]">
            <div className="text-xs font-bold text-tab-tarjetas mb-2">💵 Dólar tarjeta de este mes</div>
            {dolarMes > 0 && !dolarInput ? (
              <div className="text-sm font-bold text-ink">${dolarMes.toLocaleString('es-AR')}
                <button onClick={()=>setDolarInput(String(dolarMes))} className="ml-2.5 border-none bg-white rounded-md cursor-pointer text-[11px] text-tab-tarjetas px-2 py-0.5 touch-manipulation">editar</button>
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

        {loadingTarjetas && [0,1].map(i => (
          <div key={i} className="rounded-2xl overflow-hidden mb-3 shadow-sm">
            <Skeleton className="h-11 rounded-none"/>
            <div className="bg-white px-4 py-3.5"><Skeleton className="h-2.5 w-20 mb-2.5"/><Skeleton className="h-7 w-32 mb-3"/><Skeleton className="h-2.5 w-40"/></div>
          </div>
        ))}

        {!loadingTarjetas && !tarjetasData.some(m => m.mes === selMes) && (
          <div className="text-center px-5 py-12.5 text-muted-light">
            <div className="text-6xl mb-4">📎</div>
            <div className="text-base font-bold text-muted mb-2">Sin resúmenes este mes</div>
            <div className="text-[13px] leading-relaxed max-w-[280px] mx-auto">Pasale los PDFs a Zapia con la instrucción de cargar en la hoja "Tarjetas" — acá se reflejan solos. Si se importa dos veces el mismo PDF, no se duplica.</div>
          </div>
        )}

        {!loadingTarjetas && Object.entries(TARJETAS_CONFIG).map(([key, config]) => {
          const movs = itemsDelMes([], tarjetasData, dolarMap, selMes).filter(m => m.tarjeta === key);
          if (movs.length === 0) return null;
          const cuotas = movs.filter(m => m.cuotas && m.cuotas.trim() !== '');
          const financ = movs.filter(m => (!m.cuotas || m.cuotas.trim()==='') && TIPOS_FINANCIEROS.includes(m.tipoMovimiento));
          const consumos = movs.filter(m => (!m.cuotas || m.cuotas.trim()==='') && !TIPOS_FINANCIEROS.includes(m.tipoMovimiento));
          const sum = a => a.reduce((s,m)=>s+m.monto,0);
          return (
            <div key={key} onClick={()=>setSelTarjeta(key)} className="bg-white rounded-2xl overflow-hidden mb-3 cursor-pointer shadow-sm touch-manipulation">
              <div className="text-white px-4 py-3 flex justify-between items-center" style={{background:config.color}}>
                <span className="font-bold text-sm">{config.icon} {config.nombre}</span><span className="text-xs opacity-80">›</span>
              </div>
              <div className="px-4 py-3.5">
                <div className="text-[10px] text-muted-light uppercase font-bold tracking-wide">Total del resumen</div>
                <div className="text-[26px] font-extrabold text-ink tracking-tight mb-2.5 tabular-nums">{$$(sum(movs))}</div>
                {(() => {
                  const mesPrincipal = mesDesplazado(selMes, desfaseTarjetas(appData.ajustes));
                  const v = (appData.vencimientos || {})[key.toLowerCase()];
                  const vence = v && n(v.dia) ? fechaVencimiento(mesPrincipal, v.dia, !!v.mesSiguiente) : null;
                  return <div className="text-[11px] text-tab-tarjetas font-semibold mb-2">🗓️ Entra en el Principal de {fmtKey(mesPrincipal).split(' ')[0]}{vence ? ` · vence ${vence.split('-').reverse().slice(0,2).join('/')}` : ''}</div>;
                })()}
                <div className="flex gap-2.5 text-[11px] text-muted flex-wrap">
                  <span>🛍️ Consumos {$$(sum(consumos))}</span>
                  {cuotas.length>0 && <span>🧾 Cuotas {$$(sum(cuotas))}</span>}
                  {financ.length>0 && <span>💰 Otros {financ.length}</span>}
                </div>
              </div>
            </div>
          );
        })}
        <button onClick={repararIconos} disabled={reparando}
          className="w-full mt-1 py-2 border-[1.5px] border-border rounded-lg bg-white text-muted text-xs font-semibold touch-manipulation">{reparando ? '...' : '🔧 Reparar íconos de categorías'}</button>
      </>)}

      {tab==='historial' && <HistorialTarjetas tarjetasData={tarjetasData} dolarMap={dolarMap}/>}
    </div>
  );
}
