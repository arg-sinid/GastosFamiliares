import { useState, useEffect } from 'react';
import { $$, n, getKey, fmtKey, getMonday, weekDates, dateStr, monthOf, fmtDate, monthOpts } from '../utils.js';
import { TODAS_CATEGORIAS, categorizarNuevos, TIPOS_FINANCIEROS } from '../categorias.js';

function CatModal({ item, categorias, onSave, onClose }) {
  const [customName,  setCustomName]  = useState('');
  const [customEmoji, setCustomEmoji] = useState('📦');
  const [showNew,     setShowNew]     = useState(false);

  const predefNames = new Set(TODAS_CATEGORIAS.map(c => c.categoria));
  const customCats  = [...new Set(Object.values(categorias).map(c => c.categoria))]
    .filter(c => !predefNames.has(c))
    .map(c => ({ categoria:c, emoji: Object.values(categorias).find(x=>x.categoria===c)?.emoji||'📦' }));
  const allCats = [...TODAS_CATEGORIAS, ...customCats];

  const handleSave = (cat) => { onSave(item.key, cat); };
  const handleNewSave = () => { if (!customName.trim()) return; handleSave({ categoria: customName.trim(), emoji: customEmoji }); };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:300,
                 display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
      <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'20px 16px 32px',
                   width:'100%',maxWidth:500,maxHeight:'80vh',overflowY:'auto'}}>
        <div style={{fontWeight:800,fontSize:16,marginBottom:4,color:'#1A365D'}}>Cambiar categoría</div>
        <div style={{fontSize:13,color:'#718096',marginBottom:16}}>"{item.key}"</div>

        {!showNew ? (
          <>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
              {allCats.map(c=>(
                <button key={c.categoria} onClick={()=>handleSave(c)}
                  style={{padding:'10px 12px',border:'1.5px solid #E2E8F0',borderRadius:10,cursor:'pointer',
                          background:'#FAFAFA',textAlign:'left',fontSize:13,fontWeight:600,color:'#2D3748',
                          display:'flex',alignItems:'center',gap:8,touchAction:'manipulation'}}>
                  <span style={{fontSize:20}}>{c.emoji}</span>{c.categoria}
                </button>
              ))}
            </div>
            <button onClick={()=>setShowNew(true)}
              style={{width:'100%',padding:'11px',border:'2px dashed #CBD5E0',borderRadius:10,
                      background:'none',cursor:'pointer',fontSize:13,fontWeight:700,color:'#718096',
                      marginBottom:8,touchAction:'manipulation'}}>➕ Nueva categoría</button>
          </>
        ) : (
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:'#4A5568',marginBottom:8}}>Nueva categoría</div>
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              <input value={customEmoji} onChange={e=>setCustomEmoji(e.target.value)}
                style={{width:50,padding:'8px',borderRadius:8,border:'1.5px solid #CBD5E0',fontSize:20,textAlign:'center',outline:'none'}}/>
              <input value={customName} onChange={e=>setCustomName(e.target.value)} placeholder="Nombre de categoría"
                style={{flex:1,padding:'8px 12px',borderRadius:8,border:'1.5px solid #CBD5E0',fontSize:14,outline:'none'}}/>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setShowNew(false)}
                style={{flex:1,padding:10,border:'1.5px solid #CBD5E0',borderRadius:9,background:'#fff',cursor:'pointer',fontWeight:600,color:'#718096',touchAction:'manipulation'}}>Volver</button>
              <button onClick={handleNewSave} disabled={!customName.trim()}
                style={{flex:2,padding:10,border:'none',borderRadius:9,background:customName.trim()?'#553C9A':'#E2E8F0',
                        cursor:'pointer',fontWeight:700,color:'white',touchAction:'manipulation'}}>Crear y asignar</button>
            </div>
          </div>
        )}

        <button onClick={onClose}
          style={{width:'100%',padding:12,border:'1.5px solid #CBD5E0',borderRadius:10,
                  background:'white',cursor:'pointer',fontWeight:600,color:'#718096',fontSize:14,touchAction:'manipulation'}}>Cancelar</button>
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
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:300,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
      <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'20px 16px 32px',width:'100%',maxWidth:500,maxHeight:'85vh',overflowY:'auto'}}>
        <div style={{fontWeight:800,fontSize:16,marginBottom:4,color:'#1A365D'}}>Gestionar categorías</div>
        <div style={{fontSize:12,color:'#718096',marginBottom:16}}>Editá el nombre o emoji. Aplica a todos los gastos con esa categoría.</div>
        {lista.map(cat => (
          <div key={cat.nombre} style={{background:'#FAFAFA',borderRadius:10,padding:'12px 14px',marginBottom:10,border:'1px solid #E2E8F0'}}>
            <div style={{fontSize:11,color:'#A0AEC0',marginBottom:6}}>{cat.items.length} gasto{cat.items.length>1?'s':''}</div>
            <div style={{display:'flex',gap:8}}>
              <input value={editEmoji[cat.nombre]??cat.emoji} onChange={e=>setEditEmoji(p=>({...p,[cat.nombre]:e.target.value}))}
                style={{width:44,padding:'6px',borderRadius:8,border:'1.5px solid #CBD5E0',fontSize:18,textAlign:'center',outline:'none'}}/>
              <input value={editNombre[cat.nombre]??cat.nombre} onChange={e=>setEditNombre(p=>({...p,[cat.nombre]:e.target.value}))}
                style={{flex:1,padding:'6px 10px',borderRadius:8,border:'1.5px solid #CBD5E0',fontSize:14,outline:'none'}}/>
              <button onClick={()=>guardarRename(cat.nombre)}
                style={{padding:'6px 14px',border:'none',borderRadius:8,background:'#2B6CB0',color:'white',fontWeight:700,fontSize:12,cursor:'pointer',touchAction:'manipulation'}}>OK</button>
            </div>
          </div>
        ))}
        <button onClick={onClose} style={{width:'100%',padding:12,border:'1.5px solid #CBD5E0',borderRadius:10,background:'white',cursor:'pointer',fontWeight:600,color:'#718096',fontSize:14,marginTop:4,touchAction:'manipulation'}}>Cerrar</button>
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

  // Ítems de Zapia (WhatsApp), normalizados a la forma unificada
  const zapiaItems = zapiaData
    .filter(r => r.fecha && (filtro === 'semana' ? wStr.includes(r.fecha) : monthOf(r.fecha) === selMes))
    .map(r => ({ key:r.que, monto:r.costo, fecha:r.fecha, quien:r.quien, medio:r.medio, origen:'zapia' }));

  // Ítems de Tarjeta (solo en vista de mes, y solo consumos reales — sin cuotas ni financieros)
  const tarjetaItems = filtro === 'mes' ? (movimientos || [])
    .filter(m => m.mes === selMes)
    .filter(m => !(m.cuotas && m.cuotas.trim() !== '') && !TIPOS_FINANCIEROS.includes(m.tipoMovimiento))
    .map(m => {
      const dolar = n(dolarTarjetaMap[m.mes]) || 0;
      const monto = m.moneda === 'USD' ? m.importe * dolar : m.importe;
      return { key:m.comercio, monto, fecha:m.fecha, tarjeta:m.tarjeta, origen:'tarjeta' };
    }) : [];

  const filtered = [...zapiaItems, ...tarjetaItems];

  const totalGen    = filtered.reduce((s,r)=>s+r.monto,0);
  const totalGerman = zapiaItems.filter(r=>r.quien==='Germán').reduce((s,r)=>s+r.monto,0);
  const totalJuli   = zapiaItems.filter(r=>r.quien==='Julieta').reduce((s,r)=>s+r.monto,0);
  const totalTarjeta= tarjetaItems.reduce((s,r)=>s+r.monto,0);

  const grupos = {};
  filtered.forEach(item=>{
    const cat = categories[item.key]||{categoria:'Sin categoría',emoji:'📦'};
    if(!grupos[cat.categoria]) grupos[cat.categoria]={emoji:cat.emoji,items:[],total:0};
    grupos[cat.categoria].items.push(item); grupos[cat.categoria].total+=item.monto;
  });
  const sortedGrupos = Object.entries(grupos).sort((a,b)=>b[1].total-a[1].total);
  const sinCat = filtered.filter(r=>!categories[r.key]);

  const recategorizar = async (key, newCat) => {
    setEditItem(null);
    await saveData({ ...appData, categories: { ...categories, [key]: newCat } });
  };
  const guardarCategorias = async (newCats) => { await saveData({ ...appData, categories: newCats }); };

  const prevWeek = () => { const d=new Date(monday);d.setDate(d.getDate()-7);setMonday(d); };
  const nextWeek = () => { const d=new Date(monday);d.setDate(d.getDate()+7);setMonday(d); };

  return (
    <div style={{maxWidth:640,margin:'0 auto',padding:16,background:'#F7FAFC',minHeight:'calc(100vh - 70px)',fontFamily:'Segoe UI,Arial,sans-serif'}}>
      {editItem     && <CatModal item={editItem} categorias={categories} onSave={recategorizar} onClose={()=>setEditItem(null)}/>}
      {showEditCats && <EditCatModal categorias={categories} onSave={guardarCategorias} onClose={()=>setShowEditCats(false)}/>}

      <div style={{background:'linear-gradient(135deg,#744210,#C05621)',borderRadius:16,padding:'18px 20px',marginBottom:18,color:'#fff',
                   boxShadow:'0 4px 16px rgba(116,66,16,0.3)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:21,fontWeight:800}}>🏷️ Gastos del hogar</div>
          <div style={{fontSize:12,opacity:.75,marginTop:3}}>Zapia · WhatsApp + Tarjetas</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={handleRefresh} disabled={refreshing}
            style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:9,color:'white',
                    padding:'7px 11px',cursor:'pointer',fontSize:12,fontWeight:700,touchAction:'manipulation'}}>
            {refreshing ? '...' : '↻'}
          </button>
          <button onClick={()=>setShowEditCats(true)}
            style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:9,color:'white',
                    padding:'7px 11px',cursor:'pointer',fontSize:12,fontWeight:700,touchAction:'manipulation'}}>✏️ Categorías</button>
        </div>
      </div>

      <div style={{marginBottom:14}}>
        <div style={{display:'flex',background:'#E2E8F0',borderRadius:10,padding:3,gap:2,marginBottom:10}}>
          {[['semana','Esta semana'],['mes','Por mes']].map(([k,label])=>(
            <button key={k} onClick={()=>setFiltro(k)} style={{flex:1,padding:'8px 0',border:'none',borderRadius:8,
              cursor:'pointer',fontWeight:700,fontSize:12,touchAction:'manipulation',
              background:filtro===k?'#fff':'transparent',color:filtro===k?'#744210':'#718096',
              boxShadow:filtro===k?'0 1px 3px rgba(0,0,0,0.1)':'none'}}>{label}</button>
          ))}
        </div>
        {filtro==='semana' ? (
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'#fff',borderRadius:10,padding:'8px 12px',boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
            <button onClick={prevWeek} style={{border:'none',background:'none',cursor:'pointer',fontSize:22,color:'#744210',padding:'0 8px',touchAction:'manipulation'}}>‹</button>
            <div style={{textAlign:'center'}}>
              <div style={{fontWeight:700,color:'#2D3748',fontSize:13}}>{fmtDate(wDates[0])} – {fmtDate(wDates[6])}</div>
              {isCurrentWeek&&<div style={{fontSize:11,color:'#A0AEC0'}}>Semana actual</div>}
            </div>
            <button onClick={nextWeek} style={{border:'none',background:'none',cursor:'pointer',fontSize:22,color:'#744210',padding:'0 8px',touchAction:'manipulation'}}>›</button>
          </div>
        ) : (
          <select value={selMes} onChange={e=>setSelMes(e.target.value)}
            style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1.5px solid #CBD5E0',fontSize:14,
                    background:'#fff',color:'#2D3748',fontWeight:600,cursor:'pointer'}}>
            {monthOpts(today).map(k=><option key={k} value={k}>{fmtKey(k)}{k===getKey(today)?' — actual':''}</option>)}
          </select>
        )}
      </div>

      {loading&&<div style={{textAlign:'center',padding:'40px',color:'#A0AEC0'}}>Cargando datos...</div>}
      {!loading&&filtered.length===0&&(
        <div style={{textAlign:'center',padding:'60px 20px',color:'#A0AEC0'}}>
          <div style={{fontSize:48,marginBottom:12}}>📋</div>
          <div style={{fontWeight:600,marginBottom:6}}>Sin gastos {filtro==='semana'?'esta semana':'este mes'}</div>
          <div style={{fontSize:13}}>Los gastos del grupo de WhatsApp{filtro==='mes'?' y los consumos de tarjeta ':' '}aparecen acá automáticamente.</div>
        </div>
      )}

      {filtered.length>0&&(
        <div style={{background:'#fff',borderRadius:14,padding:'14px 16px',marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:.8,color:'#718096'}}>Total {filtro==='semana'?'semana':'mes'}</div>
            <div style={{fontSize:26,fontWeight:900,color:'#744210',letterSpacing:-1}}>{$$(totalGen)}</div>
          </div>
          {(totalGerman>0||totalJuli>0||totalTarjeta>0)&&<>
            <div style={{height:8,background:'#EDF2F7',borderRadius:8,overflow:'hidden',display:'flex',marginBottom:6}}>
              <div style={{height:'100%',width:`${totalGen>0?totalGerman/totalGen*100:0}%`,background:'#2B6CB0'}}/>
              <div style={{height:'100%',width:`${totalGen>0?totalJuli/totalGen*100:0}%`,background:'#D53F8C'}}/>
              <div style={{height:'100%',width:`${totalGen>0?totalTarjeta/totalGen*100:0}%`,background:'#553C9A'}}/>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,flexWrap:'wrap',gap:6}}>
              {totalGerman>0&&<span style={{color:'#2B6CB0',fontWeight:600}}>👨 Germán {$$(totalGerman)}</span>}
              {totalJuli>0&&<span style={{color:'#D53F8C',fontWeight:600}}>👩 Julieta {$$(totalJuli)}</span>}
              {totalTarjeta>0&&<span style={{color:'#553C9A',fontWeight:600}}>💳 Tarjeta {$$(totalTarjeta)}</span>}
            </div>
          </>}
        </div>
      )}

      {sortedGrupos.length>0&&(
        <div style={{background:'#fff',borderRadius:14,overflow:'hidden',marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
          <div style={{background:'#744210',color:'#fff',padding:'10px 16px',fontWeight:700,fontSize:13,display:'flex',justifyContent:'space-between'}}>
            <span>Por categoría</span><span style={{fontSize:11,opacity:.8}}>{sortedGrupos.length} categorías</span>
          </div>
          {sortedGrupos.map(([cat,data])=>(
            <div key={cat}>
              <div onClick={()=>setExpanded(p=>({...p,[cat]:!p[cat]}))}
                style={{display:'flex',alignItems:'center',padding:'12px 14px',borderBottom:'1px solid #FFF3E0',cursor:'pointer',
                        background:expanded[cat]?'#FFFBF5':'#fff',touchAction:'manipulation'}}>
                <span style={{fontSize:20,marginRight:10}}>{data.emoji}</span>
                <span style={{flex:1,fontSize:13,fontWeight:700,color:'#2D3748'}}>{cat}</span>
                <span style={{fontSize:11,color:'#A0AEC0',marginRight:10}}>{data.items.length} gasto{data.items.length>1?'s':''}</span>
                <span style={{fontWeight:800,fontSize:14,color:'#744210',marginRight:8}}>{$$(data.total)}</span>
                <span style={{color:'#A0AEC0',fontSize:12}}>{expanded[cat]?'▲':'▼'}</span>
              </div>
              {expanded[cat]&&data.items.map((item,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',padding:'9px 14px 9px 44px',borderBottom:'1px solid #F7FAFC',background:'#FAFAFA'}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,color:'#2D3748',fontWeight:500}}>{item.key}</div>
                    <div style={{fontSize:11,color:'#A0AEC0',marginTop:2,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                      {item.origen==='zapia' ? (
                        <>
                          <span>{item.quien==='Germán'?'👨':'👩'}</span>
                          <span>{item.medio==='efectivo'?'💵':'📲'}</span>
                        </>
                      ) : (
                        <span style={{background:'#EDE9FE',color:'#553C9A',borderRadius:4,padding:'1px 5px',fontWeight:700}}>💳 {item.tarjeta}</span>
                      )}
                      <span>{item.fecha.split('-').reverse().join('/')}</span>
                      <button onClick={()=>setEditItem(item)}
                        style={{border:'none',background:'#EDF2F7',borderRadius:6,cursor:'pointer',fontSize:10,color:'#718096',padding:'2px 6px',fontWeight:600,touchAction:'manipulation'}}>✏️ cambiar</button>
                    </div>
                  </div>
                  <span style={{fontWeight:700,fontSize:13,color:'#744210'}}>{$$(item.monto)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {sinCat.length>0&&(
        <div style={{background:'#fff',borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
          <div style={{background:'#A0AEC0',color:'#fff',padding:'10px 16px',fontWeight:700,fontSize:13}}>📦 Sin categoría ({sinCat.length})</div>
          {sinCat.map((item,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',padding:'10px 14px',borderBottom:i<sinCat.length-1?'1px solid #F0F4F8':'none',background:i%2===0?'#fff':'#F7FAFC'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:'#2D3748'}}>{item.key}</div>
                <div style={{fontSize:11,color:'#A0AEC0',marginTop:2}}>
                  {item.origen==='zapia' ? `${item.quien==='Germán'?'👨':'👩'} · ${item.medio==='efectivo'?'💵':'📲'}` : `💳 ${item.tarjeta}`} · {item.fecha.split('-').reverse().join('/')}
                </div>
              </div>
              <span style={{fontWeight:800,fontSize:13,color:'#744210',marginRight:10}}>{$$(item.monto)}</span>
              <button onClick={()=>setEditItem(item)}
                style={{border:'none',background:'#EDF2F7',borderRadius:8,cursor:'pointer',fontSize:12,color:'#744210',padding:'5px 10px',fontWeight:700,touchAction:'manipulation'}}>Categorizar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
