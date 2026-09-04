import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { $$, n, fmtKey, getKey, monthOpts } from '../utils.js';
import { categorizarUno, TODAS_CATEGORIAS, emojiCorrectoParaCategoria, TIPOS_FINANCIEROS } from '../categorias.js';

const TARJETAS_CONFIG = {
  ICBC: { nombre:'Tarjeta ICBC',        color:'#553C9A', icon:'💳', key:'icbc' },
  BNA:  { nombre:'Tarjeta Banco Nación', color:'#2B6CB0', icon:'💳', key:'bna'  },
};

// (TIPOS_FINANCIEROS ahora se importa de categorias.js, compartido con Gastos.jsx)

// ── Vista detalle de una tarjeta ───────────────────────────────────────
function DetalleTarjeta({ movimientos, config, dolarTarjeta, categorias, setCategoria, onBack }) {
  const [expanded, setExpanded] = useState({});

  const montoEnPesos = (m) => m.moneda === 'USD' ? m.importe * dolarTarjeta : m.importe;

  // Prioridad de clasificación:
  // 1. Tiene cuotas → siempre va a "Cuotas", sin importar de qué sea o su tipo_movimiento
  // 2. Sin cuotas + tipo financiero (pago/interes/impuesto/comision) → "Pagos/Impuestos/Intereses"
  // 3. El resto → categorización normal por rubro
  const cuotasItems     = movimientos.filter(m => m.cuotas && m.cuotas.trim() !== '');
  const financierosItems= movimientos.filter(m => (!m.cuotas || m.cuotas.trim()==='') && TIPOS_FINANCIEROS.includes(m.tipoMovimiento));
  const consumos        = movimientos.filter(m => (!m.cuotas || m.cuotas.trim()==='') && !TIPOS_FINANCIEROS.includes(m.tipoMovimiento));

  const totalCuotas      = cuotasItems.reduce((s,m) => s + montoEnPesos(m), 0);
  const totalFinancieros = financierosItems.reduce((s,m) => s + montoEnPesos(m), 0);
  const totalConsumos    = consumos.reduce((s,m) => s + montoEnPesos(m), 0);
  const totalGeneral     = totalCuotas + totalFinancieros + totalConsumos;

  // Agrupar consumos por categoría (propia, no la de Zapia)
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
    <div style={{maxWidth:480,margin:'0 auto',padding:16,background:'#F7FAFC',
                 minHeight:'calc(100vh - 70px)',fontFamily:'Segoe UI,Arial,sans-serif'}}>
      <button onClick={onBack} style={{border:'none',background:'#EDF2F7',borderRadius:10,cursor:'pointer',
        padding:'8px 16px',fontWeight:700,color:'#4A5568',marginBottom:16,touchAction:'manipulation'}}>‹ Volver</button>

      <div style={{background:`linear-gradient(135deg,${config.color},${config.color}CC)`,borderRadius:16,
                   padding:'18px 20px',marginBottom:18,color:'#fff',boxShadow:`0 4px 16px ${config.color}55`}}>
        <div style={{fontSize:20,fontWeight:800}}>{config.icon} {config.nombre}</div>
        <div style={{fontSize:32,fontWeight:900,marginTop:10,letterSpacing:-1}}>{$$(totalGeneral)}</div>
        <div style={{fontSize:11,opacity:.8,marginTop:4}}>{consumos.length} consumos · {cuotasItems.length} en cuotas · {financierosItems.length} otros</div>
      </div>

      <div style={{background:'#fff',borderRadius:14,padding:'14px 16px',marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
        <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0'}}>
          <span style={{fontSize:13,color:'#718096'}}>Consumos categorizables</span>
          <span style={{fontSize:14,fontWeight:700,color:'#2D3748'}}>{$$(totalConsumos)}</span>
        </div>
        {totalCuotas > 0 && (
          <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderTop:'1px solid #F0F4F8'}}>
            <span style={{fontSize:13,color:'#718096'}}>Cuotas</span>
            <span style={{fontSize:14,fontWeight:700,color:'#553C9A'}}>{$$(totalCuotas)}</span>
          </div>
        )}
        {totalFinancieros > 0 && (
          <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderTop:'1px solid #F0F4F8'}}>
            <span style={{fontSize:13,color:'#718096'}}>Pagos / impuestos / intereses</span>
            <span style={{fontSize:14,fontWeight:700,color:'#C53030'}}>{$$(totalFinancieros)}</span>
          </div>
        )}
      </div>


      {cuotasItems.length > 0 && (
        <div style={{background:'#fff',borderRadius:14,overflow:'hidden',marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
          <div style={{background:'#553C9A',color:'#fff',padding:'10px 16px',fontWeight:700,fontSize:13,display:'flex',justifyContent:'space-between'}}>
            <span>🧾 Cuotas</span><span style={{fontSize:11,opacity:.8}}>{$$(totalCuotas)}</span>
          </div>
          {cuotasItems.map((m,i) => (
            <div key={m.id||i} style={{display:'flex',alignItems:'center',padding:'9px 14px',
                                  borderBottom:i<cuotasItems.length-1?'1px solid #F7FAFC':'none',background:i%2===0?'#fff':'#FAFAFA'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:12,color:'#2D3748'}}>{m.comercio} <span style={{fontSize:10,background:'#EDE9FE',color:'#553C9A',borderRadius:4,padding:'1px 5px',fontWeight:700}}>{m.cuotas}</span></div>
                <div style={{fontSize:11,color:'#A0AEC0'}}>{m.fecha.split('-').reverse().join('/')}{m.moneda==='USD'&&<span style={{color:'#2B6CB0',marginLeft:6}}>USD {m.importe.toFixed(2)}</span>}</div>
              </div>
              <span style={{fontWeight:700,fontSize:13,color:'#553C9A'}}>{$$(montoEnPesos(m))}</span>
            </div>
          ))}
        </div>
      )}

      {sortedGrupos.length > 0 && (
        <div style={{background:'#fff',borderRadius:14,overflow:'hidden',marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
          <div style={{background:config.color,color:'#fff',padding:'10px 16px',fontWeight:700,fontSize:13}}>Consumos por categoría</div>
          {sortedGrupos.map(([cat,data]) => (
            <div key={cat}>
              <div onClick={()=>setExpanded(p=>({...p,[cat]:!p[cat]}))}
                style={{display:'flex',alignItems:'center',padding:'12px 14px',borderBottom:'1px solid #F0F4F8',
                        cursor:'pointer',background:expanded[cat]?'#FAFAFA':'#fff',touchAction:'manipulation'}}>
                <span style={{fontSize:20,marginRight:10}}>{data.emoji}</span>
                <span style={{flex:1,fontSize:13,fontWeight:700,color:'#2D3748'}}>{cat}</span>
                <span style={{fontSize:11,color:'#A0AEC0',marginRight:10}}>{data.items.length}</span>
                <span style={{fontWeight:800,fontSize:14,color:config.color,marginRight:8}}>{$$(data.total)}</span>
                <span style={{color:'#A0AEC0',fontSize:12}}>{expanded[cat]?'▲':'▼'}</span>
              </div>
              {expanded[cat] && data.items.map((m,i) => (
                <div key={m.id||i} style={{display:'flex',alignItems:'center',padding:'9px 14px 9px 44px',
                                      borderBottom:'1px solid #F7FAFC',background:'#FAFAFA'}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:'#2D3748'}}>{m.comercio}</div>
                    <div style={{fontSize:11,color:'#A0AEC0',display:'flex',gap:8,alignItems:'center'}}>
                      <span>{m.fecha.split('-').reverse().join('/')}</span>
                      {m.moneda==='USD'&&<span style={{color:'#2B6CB0'}}>USD {m.importe.toFixed(2)}</span>}
                      <button onClick={()=>setCategoria(m.comercio)}
                        style={{border:'none',background:'#EDF2F7',borderRadius:6,cursor:'pointer',fontSize:10,color:'#718096',padding:'2px 6px',touchAction:'manipulation'}}>✏️</button>
                    </div>
                  </div>
                  <span style={{fontWeight:700,fontSize:13,color:config.color}}>{$$(montoEnPesos(m))}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {financierosItems.length > 0 && (
        <div style={{background:'#fff',borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
          <div style={{background:'#744210',color:'#fff',padding:'10px 16px',fontWeight:700,fontSize:13}}>💰 Pagos / Impuestos / Intereses</div>
          {financierosItems.map((m,i) => (
            <div key={m.id||i} style={{display:'flex',alignItems:'center',padding:'9px 14px',
                                  borderBottom:i<financierosItems.length-1?'1px solid #F7FAFC':'none',background:i%2===0?'#fff':'#FAFAFA'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:12,color:'#2D3748'}}>{m.comercio}</div>
                <div style={{fontSize:11,color:'#A0AEC0'}}>{m.fecha.split('-').reverse().join('/')} · {m.tipoMovimiento}</div>
              </div>
              <span style={{fontWeight:700,fontSize:13,color:'#744210'}}>{$$(montoEnPesos(m))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Modal para elegir categoría — grilla de predefinidas + crear nueva ──
function CatPickerModal({ comercio, categorias, onSave, onClose }) {
  const [showNew,     setShowNew]     = useState(false);
  const [customName,  setCustomName]  = useState('');
  const [customEmoji, setCustomEmoji] = useState('📦');

  // Predefinidas + las personalizadas que ya existen en las categorías guardadas
  const predefNames = new Set(TODAS_CATEGORIAS.map(c => c.categoria));
  const customCats = [...new Set(Object.values(categorias || {}).map(c => c.categoria))]
    .filter(c => !predefNames.has(c))
    .map(c => ({ categoria:c, emoji: Object.values(categorias).find(x=>x.categoria===c)?.emoji || '📦' }));
  const allCats = [...TODAS_CATEGORIAS, ...customCats];

  const handleNewSave = () => { if (!customName.trim()) return; onSave({ categoria: customName.trim(), emoji: customEmoji }); };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:300,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
      <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'20px 16px 32px',width:'100%',maxWidth:500,maxHeight:'80vh',overflowY:'auto'}}>
        <div style={{fontWeight:800,fontSize:16,marginBottom:4,color:'#1A365D'}}>Cambiar categoría</div>
        <div style={{fontSize:13,color:'#718096',marginBottom:16}}>"{comercio}"</div>

        {!showNew ? (
          <>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
              {allCats.map(c=>(
                <button key={c.categoria} onClick={()=>onSave(c)}
                  style={{padding:'10px 12px',border:'1.5px solid #E2E8F0',borderRadius:10,cursor:'pointer',
                          background:'#FAFAFA',textAlign:'left',fontSize:13,fontWeight:600,color:'#2D3748',
                          display:'flex',alignItems:'center',gap:8,touchAction:'manipulation'}}>
                  <span style={{fontSize:20}}>{c.emoji}</span>{c.categoria}
                </button>
              ))}
            </div>
            <button onClick={()=>setShowNew(true)}
              style={{width:'100%',padding:'11px',border:'2px dashed #CBD5E0',borderRadius:10,background:'none',
                      cursor:'pointer',fontSize:13,fontWeight:700,color:'#718096',marginBottom:8,touchAction:'manipulation'}}>
              ➕ Nueva categoría
            </button>
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
          style={{width:'100%',padding:12,border:'1.5px solid #CBD5E0',borderRadius:10,background:'white',
                  cursor:'pointer',fontWeight:600,color:'#718096',fontSize:14,touchAction:'manipulation'}}>Cancelar</button>
      </div>
    </div>
  );
}

// ── Vista lista ─────────────────────────────────────────────────────────
export default function Tarjetas({ appData, saveData, movimientos, loading, onRefresh }) {
  const today = new Date();
  const [tab,        setTab]        = useState('mes'); // 'mes' | 'historial'
  const [selKey,     setSelKey]     = useState(getKey(today));
  const [selTarjeta, setSelTarjeta] = useState(null);
  const [catEditando, setCatEditando] = useState(null);

  const dolarTarjetaMap = appData.dolarTarjeta || {};
  const [dolarInput, setDolarInput] = useState('');
  const categorias = appData.categories || {};

  const movimientosMes = (movimientos||[]).filter(m => m.mes === selKey);
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

  // Repara íconos: para cada categoría guardada, si su nombre coincide con una
  // categoría conocida (predefinida), reemplaza el emoji por el correcto.
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
    <div style={{maxWidth:480,margin:'0 auto',padding:16,background:'#F7FAFC',
                 minHeight:'calc(100vh - 70px)',fontFamily:'Segoe UI,Arial,sans-serif'}}>

      <div style={{background:'linear-gradient(135deg,#2B6CB0,#1A365D)',borderRadius:16,
                   padding:'18px 20px',marginBottom:18,color:'#fff',boxShadow:'0 4px 16px rgba(27,54,93,0.3)',
                   display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:21,fontWeight:800}}>💳 Tarjetas</div>
          <div style={{fontSize:12,opacity:.75,marginTop:3}}>Cargado por Zapia</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={repararIconos} disabled={reparando}
            style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:9,color:'white',
                    padding:'7px 12px',cursor:'pointer',fontSize:12,fontWeight:700,touchAction:'manipulation'}}>
            {reparando ? '...' : '🔧'}
          </button>
          <button onClick={onRefresh} disabled={loading}
            style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:9,color:'white',
                    padding:'7px 12px',cursor:'pointer',fontSize:12,fontWeight:700,touchAction:'manipulation'}}>
            {loading ? '...' : '↻'}
          </button>
        </div>
      </div>

      {/* Tabs Mes / Historial */}
      <div style={{display:'flex',background:'#E2E8F0',borderRadius:12,padding:4,marginBottom:14,gap:3}}>
        {[['mes','📅 Mes'],['historial','📊 Historial']].map(([k,label])=>(
          <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:'9px 0',border:'none',borderRadius:9,
            cursor:'pointer',fontWeight:700,fontSize:12,touchAction:'manipulation',
            background:tab===k?'#fff':'transparent',color:tab===k?'#2B6CB0':'#718096',
            boxShadow:tab===k?'0 1px 4px rgba(0,0,0,0.1)':'none'}}>{label}</button>
        ))}
      </div>

      {tab==='mes' && <>
      <select value={selKey} onChange={e=>setSelKey(e.target.value)}
        style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1.5px solid #CBD5E0',
                fontSize:14,marginBottom:14,background:'#fff',color:'#2D3748',fontWeight:600,cursor:'pointer'}}>
        {monthOpts(today).map(k=><option key={k} value={k}>{fmtKey(k)}</option>)}
      </select>

      {/* Dólar tarjeta */}
      {hayUSD && (
        <div style={{background:'#EBF8FF',borderRadius:12,padding:'12px 16px',marginBottom:14,border:'1.5px solid #90CDF4'}}>
          <div style={{fontSize:12,fontWeight:700,color:'#2B6CB0',marginBottom:8}}>💵 Dólar tarjeta de este mes</div>
          {dolarTarjeta > 0 && !dolarInput ? (
            <div style={{fontSize:14,fontWeight:700,color:'#2D3748'}}>
              ${dolarTarjeta.toLocaleString('es-AR')}
              <button onClick={()=>setDolarInput(String(dolarTarjeta))}
                style={{marginLeft:10,border:'none',background:'#fff',borderRadius:6,cursor:'pointer',fontSize:11,color:'#2B6CB0',padding:'2px 8px',touchAction:'manipulation'}}>editar</button>
            </div>
          ) : (
            <div style={{display:'flex',gap:8}}>
              <div style={{flex:1,display:'flex',alignItems:'center',background:'#fff',borderRadius:8,border:'1.5px solid #90CDF4',padding:'6px 12px',gap:4}}>
                <span style={{color:'#A0AEC0'}}>$</span>
                <input type="number" inputMode="decimal" value={dolarInput} onChange={e=>setDolarInput(e.target.value)} placeholder="1969.50"
                  style={{flex:1,border:'none',outline:'none',fontSize:16,fontWeight:700,color:'#1A365D',background:'transparent'}}/>
              </div>
              <button onClick={guardarDolar} style={{padding:'8px 16px',border:'none',borderRadius:8,background:'#2B6CB0',color:'white',fontWeight:700,cursor:'pointer',touchAction:'manipulation'}}>OK</button>
            </div>
          )}
        </div>
      )}

      {loading && <div style={{textAlign:'center',padding:'40px',color:'#A0AEC0'}}>Cargando...</div>}

      {!loading && movimientosMes.length === 0 && (
        <div style={{textAlign:'center',padding:'50px 20px',color:'#A0AEC0'}}>
          <div style={{fontSize:56,marginBottom:16}}>📎</div>
          <div style={{fontSize:16,fontWeight:700,color:'#4A5568',marginBottom:8}}>Sin resúmenes este mes</div>
          <div style={{fontSize:13,lineHeight:1.6,maxWidth:280,margin:'0 auto'}}>
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
            style={{background:'#fff',borderRadius:14,overflow:'hidden',marginBottom:12,cursor:'pointer',
                    boxShadow:'0 1px 6px rgba(0,0,0,0.1)',touchAction:'manipulation'}}>
            <div style={{background:config.color,color:'#fff',padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:700,fontSize:14}}>{config.icon} {config.nombre}</span>
              <span style={{fontSize:12,opacity:.8}}>›</span>
            </div>
            <div style={{padding:'14px 16px'}}>
              <div style={{fontSize:10,color:'#A0AEC0',textTransform:'uppercase',fontWeight:700,letterSpacing:.5}}>Total del mes</div>
              <div style={{fontSize:26,fontWeight:900,color:'#1A365D',letterSpacing:-1,marginBottom:10}}>{$$(total)}</div>
              <div style={{display:'flex',gap:10,fontSize:11,color:'#718096',flexWrap:'wrap'}}>
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

// ── Historial mes a mes ────────────────────────────────────────────────
function TarjetasHistorial({ movimientos, dolarTarjetaMap }) {
  const mesesConDatos = [...new Set((movimientos||[]).map(m => m.mes))].filter(Boolean).sort();

  if (mesesConDatos.length === 0) {
    return (
      <div style={{textAlign:'center',padding:'50px 20px',color:'#A0AEC0'}}>
        <div style={{fontSize:56,marginBottom:16}}>📊</div>
        <div style={{fontSize:16,fontWeight:700,color:'#4A5568',marginBottom:8}}>Sin historial todavía</div>
        <div style={{fontSize:13}}>Cuando tengas resúmenes de más de un mes, acá vas a ver la evolución.</div>
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
      <div style={{background:'#fff',borderRadius:14,padding:'16px 12px',marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
        <div style={{fontWeight:700,color:'#2D3748',marginBottom:12,fontSize:13,paddingLeft:4}}>ICBC vs Banco Nación — últimos {chartData.length} meses</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barGap={3} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false}/>
            <XAxis dataKey="mes" tick={{fontSize:11,fill:'#718096'}} axisLine={false} tickLine={false}/>
            <YAxis tickFormatter={v=>`$${Math.round(v/1000)}K`} tick={{fontSize:10,fill:'#718096'}} width={52} axisLine={false} tickLine={false}/>
            <Tooltip formatter={v=>$$(v)} contentStyle={{borderRadius:8,border:'1px solid #E2E8F0',fontSize:12}}/>
            <Legend wrapperStyle={{fontSize:12}}/>
            <Bar dataKey="ICBC" fill="#553C9A" radius={[4,4,0,0]}/>
            <Bar dataKey="BNA"  fill="#2B6CB0" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{background:'#fff',borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
        <div style={{background:'#1A365D',color:'#fff',padding:'11px 16px',fontWeight:700,fontSize:13}}>Detalle por mes</div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead><tr style={{background:'#EDF2F7'}}>
            {['Mes','ICBC','BNA','Total'].map(h=>(
              <th key={h} style={{padding:'8px 10px',textAlign:h==='Mes'?'left':'right',color:'#4A5568',
                fontWeight:700,borderBottom:'1px solid #E2E8F0',fontSize:10,textTransform:'uppercase'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {histRows.map(({mes,icbc,bna},i) => (
              <tr key={mes} style={{background:i%2===0?'#fff':'#F7FAFC'}}>
                <td style={{padding:'9px 10px',fontWeight:600,color:'#2D3748'}}>{fmtKey(mes)}</td>
                <td style={{padding:'9px 10px',textAlign:'right',color:'#553C9A'}}>{icbc>0?$$(icbc):'—'}</td>
                <td style={{padding:'9px 10px',textAlign:'right',color:'#2B6CB0'}}>{bna>0?$$(bna):'—'}</td>
                <td style={{padding:'9px 10px',textAlign:'right',fontWeight:800,color:'#1A365D'}}>{$$(icbc+bna)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
