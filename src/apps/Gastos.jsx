import { useState, useEffect } from 'react';
import { $$, n, getKey, fmtKey, getMonday, weekDates, dateStr, monthOf, fmtDate, monthOpts } from '../utils.js';
import { TODAS_CATEGORIAS, categorizarNuevos, categorizarUno, categorizarMovimientoTarjeta, TIPOS_FINANCIEROS } from '../categorias.js';

function CatModal({ item, items, categorias, onSave, onClose }) {
  const [customName,  setCustomName]  = useState('');
  const [customEmoji, setCustomEmoji] = useState('📦');
  const [showNew,     setShowNew]     = useState(false);

  const targetItems = items || [item];

  const predefNames = new Set(TODAS_CATEGORIAS.map(c => c.categoria));
  const customCats  = [...new Set(Object.values(categorias).map(c => c.categoria))]
    .filter(c => !predefNames.has(c))
    .map(c => ({ categoria:c, emoji: Object.values(categorias).find(x=>x.categoria===c)?.emoji||'📦' }));
  const allCats = [...TODAS_CATEGORIAS, ...customCats];

  const handleSave = (cat) => { onSave(targetItems.map(i=>i.key), cat); };
  const handleNewSave = () => { if (!customName.trim()) return; handleSave({ categoria: customName.trim(), emoji: customEmoji }); };

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-end justify-center">
      <div className="bg-white rounded-t-[20px] px-4 pt-5 pb-8 w-full max-w-[500px] max-h-[80vh] overflow-y-auto">
        <div className="font-extrabold text-base mb-1 text-ink">Cambiar categoría</div>
        {items ? (
          <div className="text-[13px] text-muted mb-4">{targetItems.length} gastos seleccionados</div>
        ) : (
          <div className="text-[13px] text-muted mb-4">"{item.key}"</div>
        )}

        {!showNew ? (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {allCats.map(c=>(
                <button key={c.categoria} onClick={()=>handleSave(c)}
                  className="px-3 py-2.5 border-[1.5px] border-border rounded-lg cursor-pointer bg-[#FAFAFA] text-left text-[13px] font-semibold text-ink flex items-center gap-2 touch-manipulation">
                  <span className="text-xl">{c.emoji}</span>{c.categoria}
                </button>
              ))}
            </div>
            <button onClick={()=>setShowNew(true)}
              className="w-full py-2.5 border-2 border-dashed border-border rounded-lg bg-none cursor-pointer text-[13px] font-bold text-muted mb-2 touch-manipulation">➕ Nueva categoría</button>
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

function EditCatModal({ categorias, onSave, onClose }) {
  const cats = {};
  Object.entries(categorias).forEach(([desc, cat]) => {
    const key = cat.categoria;
    if (!cats[key]) cats[key] = { emoji:cat.emoji, items:[], nombre:key };
    cats[key].items.push(desc);
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

export default function Gastos({ zapiaData, appData, saveData, loading, movimientos, onRefresh }) {
  const today = new Date();
  const [filtro,    setFiltro]    = useState('mes');
  const [selMes,    setSelMes]    = useState(getKey(today));
  const [monday,    setMonday]    = useState(()=>getMonday(today));
  const [expanded,  setExpanded]  = useState({});
  const [editItem,  setEditItem]  = useState(null);
  const [showEditCats, setShowEditCats] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected,  setSelected]  = useState(new Set());
  const [bulkEdit,  setBulkEdit]  = useState(false);
  const categories = appData.categories || {};
  const dolarTarjetaMap = appData.dolarTarjeta || {};

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh?.();
    setRefreshing(false);
  };

  const wDates = weekDates(monday);
  const wStr   = wDates.map(d=>dateStr(d));
  const isCurrentWeek = dateStr(monday) === dateStr(getMonday(today));

  useEffect(() => {
    if (!zapiaData.length) return;
    const nuevas = categorizarNuevos(zapiaData, categories);
    if (Object.keys(nuevas).length > 0) saveData({ ...appData, categories: { ...categories, ...nuevas } });
  }, [zapiaData]);

  const zapiaItems = zapiaData
    .filter(r => r.fecha && (filtro === 'semana' ? wStr.includes(r.fecha) : monthOf(r.fecha) === selMes))
    .map(r => ({ key:r.que, monto:r.costo, fecha:r.fecha, quien:r.quien, medio:r.medio, origen:'zapia' }));

  const tarjetaItems = filtro === 'mes' ? (movimientos || [])
    .filter(m => m.mes === selMes)
    .map(m => {
      const dolar = n(dolarTarjetaMap[m.mes]) || 0;
      const monto = m.moneda === 'USD' ? m.importe * dolar : m.importe;
      return { key:m.comercio, monto, fecha:m.fecha, tarjeta:m.tarjeta, cuotas:m.cuotas, tipoMovimiento:m.tipoMovimiento, origen:'tarjeta' };
    }) : [];

  const filtered = [...zapiaItems, ...tarjetaItems];

  const totalGen    = filtered.reduce((s,r)=>s+r.monto,0);
  const totalGerman = zapiaItems.filter(r=>r.quien==='Germán').reduce((s,r)=>s+r.monto,0);
  const totalJuli   = zapiaItems.filter(r=>r.quien==='Julieta').reduce((s,r)=>s+r.monto,0);
  const totalTarjeta= tarjetaItems.reduce((s,r)=>s+r.monto,0);

  const grupos = {};
  filtered.forEach(item=>{
    const cat = item.origen === 'tarjeta'
      ? categorizarMovimientoTarjeta({ comercio:item.key, cuotas:item.cuotas, tipoMovimiento:item.tipoMovimiento }, categories)
      : (categories[item.key] || categorizarUno(item.key));
    if(!grupos[cat.categoria]) grupos[cat.categoria]={emoji:cat.emoji,items:[],total:0};
    grupos[cat.categoria].items.push(item); grupos[cat.categoria].total+=item.monto;
  });
  const sortedGrupos = Object.entries(grupos).sort((a,b)=>b[1].total-a[1].total);
  const sinCat = filtered.filter(r => {
    if (r.origen === 'tarjeta') {
      if (r.cuotas && r.cuotas.trim() !== '') return false;
      if (TIPOS_FINANCIEROS.includes(r.tipoMovimiento)) return false;
    }
    return !categories[r.key];
  });

  const recategorizar = async (keys, newCat) => {
    setEditItem(null);
    setBulkEdit(false);
    const updates = {};
    keys.forEach(k => { updates[k] = newCat; });
    await saveData({ ...appData, categories: { ...categories, ...updates } });
    setSelectionMode(false);
    setSelected(new Set());
  };
  const guardarCategorias = async (newCats) => { await saveData({ ...appData, categories: newCats }); };

  const prevWeek = () => { const d=new Date(monday);d.setDate(d.getDate()-7);setMonday(d); };
  const nextWeek = () => { const d=new Date(monday);d.setDate(d.getDate()+7);setMonday(d); };

  const idOf = item => `${item.origen}|${item.key}|${item.fecha}|${item.monto}`;
  const toggleSelected = id => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const selectedItems = filtered.filter(item => selected.has(idOf(item)));
  const toggleSelectionMode = () => { setSelectionMode(p=>!p); setSelected(new Set()); };

  return (
    <div className="max-w-[640px] mx-auto p-4 bg-paper min-h-[calc(100vh-70px)]">
      {editItem     && <CatModal item={editItem} categorias={categories} onSave={recategorizar} onClose={()=>setEditItem(null)}/>}
      {bulkEdit     && <CatModal items={selectedItems} categorias={categories} onSave={recategorizar} onClose={()=>setBulkEdit(false)}/>}
      {showEditCats && <EditCatModal categorias={categories} onSave={guardarCategorias} onClose={()=>setShowEditCats(false)}/>}

      <div className="rounded-2xl px-5 py-4.5 mb-4.5 text-white shadow-md flex justify-between items-center bg-tab-gastos">
        <div>
          <div className="text-xl font-extrabold">🏷️ Gastos del hogar</div>
          <div className="text-xs opacity-75 mt-0.5">Zapia · WhatsApp + Tarjetas</div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRefresh} disabled={refreshing}
            className="bg-white/15 border border-white/30 rounded-lg text-white px-2.5 py-1.5 cursor-pointer text-xs font-bold touch-manipulation">
            {refreshing ? '...' : '↻'}
          </button>
          <button onClick={()=>setShowEditCats(true)}
            className="bg-white/15 border border-white/30 rounded-lg text-white px-2.5 py-1.5 cursor-pointer text-xs font-bold touch-manipulation">✏️ Categorías</button>
          <button onClick={toggleSelectionMode}
            className={`border border-white/30 rounded-lg px-2.5 py-1.5 cursor-pointer text-xs font-bold touch-manipulation ${selectionMode?'bg-white text-tab-gastos':'bg-white/15 text-white'}`}>
            {selectionMode ? '✕ Salir' : '☑️ Seleccionar'}
          </button>
        </div>
      </div>

      <div className="mb-3.5">
        <div className="flex bg-border-soft rounded-lg p-1 gap-0.5 mb-2.5">
          {[['semana','Esta semana'],['mes','Por mes']].map(([k,label])=>(
            <button key={k} onClick={()=>setFiltro(k)}
              className={`flex-1 py-2 border-none rounded-lg cursor-pointer font-bold text-xs touch-manipulation
                ${filtro===k ? 'bg-white text-tab-gastos shadow-sm' : 'bg-transparent text-muted'}`}>{label}</button>
          ))}
        </div>
        {filtro==='semana' ? (
          <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 shadow-sm">
            <button onClick={prevWeek} className="border-none bg-none cursor-pointer text-2xl text-tab-gastos px-2 touch-manipulation">‹</button>
            <div className="text-center">
              <div className="font-bold text-ink text-[13px]">{fmtDate(wDates[0])} – {fmtDate(wDates[6])}</div>
              {isCurrentWeek&&<div className="text-[11px] text-muted-light">Semana actual</div>}
            </div>
            <button onClick={nextWeek} className="border-none bg-none cursor-pointer text-2xl text-tab-gastos px-2 touch-manipulation">›</button>
          </div>
        ) : (
          <select value={selMes} onChange={e=>setSelMes(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-border text-sm bg-white text-ink font-semibold cursor-pointer">
            {monthOpts(today).map(k=><option key={k} value={k}>{fmtKey(k)}{k===getKey(today)?' — actual':''}</option>)}
          </select>
        )}
      </div>

      {loading&&<div className="text-center p-10 text-muted-light">Cargando datos...</div>}
      {!loading&&filtered.length===0&&(
        <div className="text-center px-5 py-15 text-muted-light">
          <div className="text-5xl mb-3">📋</div>
          <div className="font-semibold mb-1.5">Sin gastos {filtro==='semana'?'esta semana':'este mes'}</div>
          <div className="text-[13px]">Los gastos del grupo de WhatsApp{filtro==='mes'?' y los consumos de tarjeta ':' '}aparecen acá automáticamente.</div>
        </div>
      )}

      {filtered.length>0&&(
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
              {expanded[cat]&&data.items.map((item,i)=>(
                <div key={i} onClick={()=>selectionMode&&toggleSelected(idOf(item))}
                  className={`flex items-center pl-11 pr-3.5 py-2.5 border-b border-border-soft touch-manipulation
                    ${selectionMode&&selected.has(idOf(item))?'bg-[#FFF3E0]':'bg-[#FAFAFA]'} ${selectionMode?'cursor-pointer':'cursor-default'}`}>
                  {selectionMode && (
                    <input type="checkbox" checked={selected.has(idOf(item))} onChange={()=>toggleSelected(idOf(item))}
                      className="w-[18px] h-[18px] mr-2.5 shrink-0"/>
                  )}
                  <div className="flex-1">
                    <div className="text-[13px] text-ink font-medium">{item.key}</div>
                    <div className="text-[11px] text-muted-light mt-0.5 flex gap-2 items-center flex-wrap">
                      {item.origen==='zapia' ? (
                        <>
                          <span>{item.quien==='Germán'?'👨':'👩'}</span>
                          <span>{item.medio==='efectivo'?'💵':'📲'}</span>
                        </>
                      ) : (
                        <>
                          <span className="bg-accent-soft text-accent-strong rounded px-1.5 py-0.5 font-bold">💳 {item.tarjeta}</span>
                          {item.cuotas && <span className="text-[10px] bg-accent-soft text-accent-strong rounded px-1.5 py-0.5 font-bold">{item.cuotas}</span>}
                          {item.tipoMovimiento && TIPOS_FINANCIEROS.includes(item.tipoMovimiento) && <span className="text-[10px] bg-orange-100 text-tab-gastos rounded px-1.5 py-0.5 font-bold">{item.tipoMovimiento}</span>}
                        </>
                      )}
                      <span>{item.fecha.split('-').reverse().join('/')}</span>
                      {!selectionMode && <button onClick={()=>setEditItem(item)}
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

      {sinCat.length>0&&(
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-muted-light text-white px-4 py-2.5 font-bold text-[13px]">📦 Sin categoría ({sinCat.length})</div>
          {sinCat.map((item,i)=>(
            <div key={i} onClick={()=>selectionMode&&toggleSelected(idOf(item))}
              className={`flex items-center px-3.5 py-2.5 touch-manipulation ${i<sinCat.length-1?'border-b border-border-soft':''}
                ${selectionMode&&selected.has(idOf(item))?'bg-[#FFF3E0]':(i%2===0?'bg-white':'bg-paper')} ${selectionMode?'cursor-pointer':'cursor-default'}`}>
              {selectionMode && (
                <input type="checkbox" checked={selected.has(idOf(item))} onChange={()=>toggleSelected(idOf(item))}
                  className="w-[18px] h-[18px] mr-2.5 shrink-0"/>
              )}
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-ink">{item.key}</div>
                <div className="text-[11px] text-muted-light mt-0.5">
                  {item.origen==='zapia' ? `${item.quien==='Germán'?'👨':'👩'} · ${item.medio==='efectivo'?'💵':'📲'}` : `💳 ${item.tarjeta}`} · {item.fecha.split('-').reverse().join('/')}
                </div>
              </div>
              <span className="font-extrabold text-[13px] text-tab-gastos mr-2.5 tabular-nums">{$$(item.monto)}</span>
              {!selectionMode && <button onClick={()=>setEditItem(item)}
                className="border-none bg-border-soft rounded-lg cursor-pointer text-xs text-tab-gastos px-2.5 py-1.5 font-bold touch-manipulation">Categorizar</button>}
            </div>
          ))}
        </div>
      )}

      {selectionMode && selected.size > 0 && (
        <div className="fixed left-0 right-0 bottom-[70px] flex justify-center z-[200] px-4">
          <div className="bg-ink rounded-2xl px-3 py-2.5 flex items-center gap-2.5 shadow-lg w-full max-w-[500px]">
            <span className="text-white text-[13px] font-bold flex-1">{selected.size} seleccionado{selected.size>1?'s':''}</span>
            <button onClick={()=>setSelected(new Set())}
              className="border-none bg-white/15 rounded-lg text-white px-3 py-2 cursor-pointer text-xs font-semibold touch-manipulation">Limpiar</button>
            <button onClick={()=>setBulkEdit(true)}
              className="border-none bg-tab-gastos rounded-lg text-white px-3.5 py-2 cursor-pointer text-xs font-bold touch-manipulation">🏷️ Asignar categoría</button>
          </div>
        </div>
      )}
    </div>
  );
}
