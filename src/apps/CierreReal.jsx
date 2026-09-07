import { useState } from 'react';
import { $$, n, getKey, fmtKey, monthOpts, calcularGastosFijosSinTarjetas, calcularTotalesTarjetas, agruparGastosPorCategoria } from '../utils.js';
import { TIPOS_FINANCIEROS } from '../categorias.js';

function LineaInfo({ label, valor, color, sub, bold }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding: sub ? '6px 16px 6px 28px' : '9px 16px', borderTop:'1px solid #EDF2F7',
                  background: sub ? '#FAFAFA' : '#fff' }}>
      <span style={{ fontSize: sub ? 12 : 13, color: sub ? '#718096' : '#2D3748', fontWeight: bold?700:400 }}>{label}</span>
      <span style={{ fontSize: bold?14:13, fontWeight: bold?800:700, color: color||'#2D3748' }}>{$$(valor)}</span>
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

  // Ganancia bruta: lo que Germán cargó día a día en Ganancias (Uber/DiDi), antes de cualquier descuento
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
    <div style={{maxWidth:640,margin:'0 auto',padding:16,background:'#F7FAFC',minHeight:'calc(100vh - 70px)',fontFamily:'Segoe UI,Arial,sans-serif'}}>
      <div style={{background:'linear-gradient(135deg,#6B21A8,#9333EA)',borderRadius:16,padding:'18px 20px',marginBottom:18,color:'#fff',
                   boxShadow:'0 4px 16px rgba(107,33,168,0.3)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:21,fontWeight:800}}>🧮 Cierre Real</div>
          <div style={{fontSize:12,opacity:.75,marginTop:3}}>Ganancias vs. gastos reales del mes</div>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:9,color:'white',
                  padding:'7px 11px',cursor:'pointer',fontSize:12,fontWeight:700,touchAction:'manipulation'}}>
          {refreshing ? '...' : '↻'}
        </button>
      </div>

      <select value={selKey} onChange={e=>setSelKey(e.target.value)}
        style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1.5px solid #CBD5E0',
                fontSize:14,marginBottom:14,background:'#fff',color:'#2D3748',fontWeight:600,cursor:'pointer'}}>
        {monthOpts(today).map(k=><option key={k} value={k}>{fmtKey(k)}{k===getKey(today)?' — actual':''}</option>)}
      </select>

      <div style={{background:'#fff',borderRadius:14,overflow:'hidden',marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
        <div style={{background:'#6B21A8',color:'#fff',padding:'10px 16px',fontWeight:700,fontSize:13}}>💰 Ingresos</div>
        <LineaInfo label="Bruto Uber/DiDi" valor={brutoGanancias} color="#276749"/>
        <LineaInfo label="Sueldo Julieta" valor={sueldoJulieta} color="#D53F8C"/>
        <LineaInfo label="Total ingresos" valor={ingresos} bold/>
      </div>

      <div style={{background:'#fff',borderRadius:14,overflow:'hidden',marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
        <div style={{background:'#744210',color:'#fff',padding:'10px 16px',fontWeight:700,fontSize:13}}>📤 Egresos</div>
        <LineaInfo label="Gastos del mes (Zapia + Tarjetas)" valor={totalGastos} color="#744210"/>
        <LineaInfo label="Fijos del Principal" valor={fijos} color="#C05621"/>
        <LineaInfo label="Total egresos" valor={totalGastos + fijos} bold/>
      </div>

      <div style={{ background: ok ? '#F0FFF4' : '#FFF5F5', borderRadius:14, padding:'16px 18px', marginBottom:18,
                    border:`1.5px solid ${ok?'#9AE6B4':'#FEB2B2'}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{fontSize:13,fontWeight:700,color: ok?'#276749':'#C53030'}}>Resultado del mes</div>
          <div style={{fontSize:11,color: ok?'#276749':'#C53030',marginTop:2}}>Ingresos − gastos − fijos</div>
        </div>
        <div style={{fontSize:24,fontWeight:900,color: ok?'#276749':'#C53030'}}>
          {ok ? $$(resultado) : `-${$$(Math.abs(resultado))}`}
        </div>
      </div>

      {sortedGrupos.length > 0 ? (
        <div style={{background:'#fff',borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
          <div style={{background:'#553C9A',color:'#fff',padding:'10px 16px',fontWeight:700,fontSize:13,display:'flex',justifyContent:'space-between'}}>
            <span>Gastos por categoría</span><span style={{fontSize:11,opacity:.8}}>{sortedGrupos.length} categorías</span>
          </div>
          {sortedGrupos.map(([cat,data])=>(
            <div key={cat}>
              <div onClick={()=>setExpanded(p=>({...p,[cat]:!p[cat]}))}
                style={{display:'flex',alignItems:'center',padding:'12px 14px',borderBottom:'1px solid #F0EAFB',cursor:'pointer',
                        background:expanded[cat]?'#FAF5FF':'#fff',touchAction:'manipulation'}}>
                <span style={{fontSize:20,marginRight:10}}>{data.emoji}</span>
                <span style={{flex:1,fontSize:13,fontWeight:700,color:'#2D3748'}}>{cat}</span>
                <span style={{fontSize:11,color:'#A0AEC0',marginRight:10}}>{data.items.length} gasto{data.items.length>1?'s':''}</span>
                <span style={{fontWeight:800,fontSize:14,color:'#553C9A',marginRight:8}}>{$$(data.total)}</span>
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
                    </div>
                  </div>
                  <span style={{fontWeight:700,fontSize:13,color:'#553C9A'}}>{$$(item.monto)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div style={{textAlign:'center',padding:'40px 20px',color:'#A0AEC0'}}>
          <div style={{fontSize:40,marginBottom:10}}>📋</div>
          <div style={{fontSize:13}}>Sin gastos cargados este mes.</div>
        </div>
      )}
    </div>
  );
}
