import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import { n, $$, getKey, fmtKey, monthOpts, calcularTotalesTarjetas, calcularIngresoGerman } from '../utils.js';
import { MoneyInput } from '../components/ui.jsx';

const GASTOS_KEYS = ['icbc','bna','prestamos','nicolas','segundo','alquiler'];
const GASTOS_CONFIG = [
  { key:'icbc',      label:'Tarjeta ICBC',        icon:'💳', hint:'Total del resumen' },
  { key:'bna',       label:'Tarjeta Banco Nación', icon:'💳', hint:'Total del resumen' },
  { key:'prestamos', label:'Préstamos',            icon:'🏦', hint:'Cuotas del mes' },
  { key:'nicolas',   label:'Nicolás',              icon:'👤', hint:'' },
  { key:'segundo',   label:'Segundo',              icon:'👤', hint:'' },
  { key:'alquiler',  label:'Alquiler',             icon:'🏠', hint:'' },
];

const EMPTY_MES = () => ({
  ingresos: { julieta:'' },
  gastos:   { icbc:'', bna:'', prestamos:'', nicolas:'', segundo:'', alquiler:'' },
  deuda_anterior: 0
});

const calcTotals = (data, germanIncome) => {
  const ing     = n(data.ingresos?.julieta) + germanIncome;
  const gas     = Object.values(data.gastos||{}).reduce((s,v)=>s+n(v),0);
  const deuda   = n(data.deuda_anterior)||0;
  const egresos = gas + deuda;
  return { ing, gas, deuda, egresos, saldo: ing - egresos, germanIncome };
};

const calcAhorroAcum = (allData, upTo, uberDiDi, zapiaData) =>
  Object.keys(allData).sort().filter(k => k <= upTo).reduce((s, k) => {
    const gi = calcularIngresoGerman(uberDiDi, k, zapiaData);
    return s + Math.max(0, calcTotals(allData[k], gi).saldo);
  }, 0);

export default function ControlGastos({ appData, saveData, zapiaData, tarjetasData, syncing, syncStatus, onForceSync, usuario, metaAhorro, onOpenSettings }) {
  const today      = new Date();
  const currentKey = getKey(today);

  const [selKey,   setSelKey]   = useState(currentKey);
  const [tab,      setTab]      = useState('mes');
  const [saving,   setSaving]   = useState(false);
  const [savedOk,  setSavedOk]  = useState(false);
  const [edit,     setEdit]     = useState(null);

  const allData     = appData.monthly           || {};
  const uberDiDi     = appData.uberDiDi          || [];
  const recurrentes  = appData.gastosRecurrentes || {};
  const dolarTarjetaMap = appData.dolarTarjeta   || {};

  // Totales de cada tarjeta por mes, calculados desde los movimientos que carga Zapia
  const totalesTarjetas = calcularTotalesTarjetas(tarjetasData, dolarTarjetaMap);

  const getMes = k => {
    const s = allData[k] || {};
    const e = EMPTY_MES();
    const tMes = totalesTarjetas[k] || {};
    const gastos = Object.keys(e.gastos).reduce((acc, key) => {
      // Si hay total de tarjeta cargado por Zapia, priorizarlo sobre lo manual/recurrente
      if ((key === 'icbc' || key === 'bna') && tMes[key] !== undefined) {
        acc[key] = String(Math.round(tMes[key])); return acc;
      }
      acc[key] = s.gastos?.[key] || (recurrentes[key] ? String(recurrentes[key]) : '');
      return acc;
    }, {});
    return { ingresos:{...e.ingresos,...s.ingresos}, gastos, deuda_anterior:s.deuda_anterior||0 };
  };

  const mesData = getMes(selKey);
  const mesEdit = edit && edit.key === selKey ? edit.data : mesData;

  const germanIncome = calcularIngresoGerman(uberDiDi, selKey, zapiaData);
  const tot        = calcTotals(mesEdit, germanIncome);
  const ahorroAcum = calcAhorroAcum(allData, selKey, uberDiDi, zapiaData);
  const meta       = n(metaAhorro);

  const updateField = (section, field, value) => {
    const prev = mesEdit;
    setEdit({ key: selKey, data: { ...prev, [section]: { ...prev[section], [field]: value } } });
  };

  const toggleRecurrente = async (key) => {
    const val = n(mesEdit.gastos[key]);
    const newRec = { ...recurrentes };
    if (recurrentes[key] !== undefined) delete newRec[key];
    else newRec[key] = val || 0;
    await saveData({ ...appData, gastosRecurrentes: newRec });
  };

  const updateRecurrente = async (key, value) => {
    if (!recurrentes[key]) return;
    await saveData({ ...appData, gastosRecurrentes: { ...recurrentes, [key]: n(value) } });
  };

  const save = async () => {
    setSaving(true);
    const dataToSave = mesEdit;
    const [year, month] = selKey.split('-');
    const nextKey = getKey(new Date(parseInt(year), parseInt(month), 1));
    const nextMes = allData[nextKey] || EMPTY_MES();

    const newRec = { ...recurrentes };
    GASTOS_KEYS.forEach(k => { if (recurrentes[k] !== undefined) newRec[k] = n(mesEdit.gastos[k]); });

    const newMonthly = {
      ...allData,
      [selKey]:  dataToSave,
      [nextKey]: { ...nextMes, deuda_anterior: tot.saldo < 0 ? Math.abs(tot.saldo) : 0 }
    };
    await saveData({ ...appData, monthly: newMonthly, gastosRecurrentes: newRec });
    setEdit(null);
    setSaving(false); setSavedOk(true);
    setTimeout(() => setSavedOk(false), 3000);
  };

  const savedKeys = Object.keys(allData).sort();
  const chartData = savedKeys.slice(-6).map(k => {
    const gi = calcularIngresoGerman(uberDiDi, k, zapiaData);
    const t = calcTotals(allData[k], gi);
    return { mes:fmtKey(k).split(' ')[0].substring(0,3), Ingresos:t.ing, Gastos:t.gas, Saldo:Math.max(0,t.saldo) };
  });
  let rAcum = 0;
  const ahorroChart = savedKeys.map(k => {
    const gi = calcularIngresoGerman(uberDiDi, k, zapiaData);
    const t = calcTotals(allData[k], gi); rAcum += Math.max(0, t.saldo);
    return { mes:fmtKey(k).split(' ')[0].substring(0,3), 'Ahorro acum.':rAcum };
  });
  const histRows = savedKeys.map(k => {
    const gi = calcularIngresoGerman(uberDiDi, k, zapiaData);
    return { k, ...calcTotals(allData[k], gi) };
  }).reverse();

  const btnBg = savedOk ? '#38A169' : syncStatus==='error' ? '#E53E3E' : saving||syncing ? '#718096' : '#2B6CB0';
  const btnTx = savedOk ? '✓  Guardado' : syncStatus==='error' ? '✗  Error — reintentá' : saving||syncing ? '☁️  Guardando...' : '💾  Guardar y sincronizar';

  const TABS = [['mes','📅 Mes'],['historial','📊 Historial'],['ahorros','💰 Ahorros']];

  return (
    <div style={{ fontFamily:"'Segoe UI',Arial,sans-serif", maxWidth:640, margin:'0 auto', padding:16,
                  background:'#F7FAFC', minHeight:'calc(100vh - 70px)' }}>

      <div style={{ background:'linear-gradient(135deg,#1A365D,#2B6CB0)', borderRadius:16,
                    padding:'18px 20px', marginBottom:18, color:'#fff', boxShadow:'0 4px 16px rgba(27,54,93,0.3)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:21, fontWeight:800, letterSpacing:-.5 }}>💰 Principal</div>
            <div style={{ fontSize:12, opacity:.75, marginTop:3 }}>{usuario==='german'?'👨 Germán':'👩 Julieta'} · {fmtKey(currentKey)}</div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {syncing && <span style={{ fontSize:11, opacity:.8 }}>☁️</span>}
            <button onClick={onOpenSettings} style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:9, color:'white', padding:'7px 11px', cursor:'pointer', fontSize:16, touchAction:'manipulation' }}>⚙️</button>
          </div>
        </div>
        {syncStatus==='error' && (
          <button onClick={onForceSync} style={{ width:'100%', padding:'9px', border:'1.5px solid rgba(255,100,100,0.5)', borderRadius:10, background:'rgba(220,50,50,0.25)', color:'white', fontWeight:600, fontSize:12, cursor:'pointer', touchAction:'manipulation' }}>
            ⚠️ Error al sincronizar — tocar para reintentar
          </button>
        )}
      </div>

      <div style={{ display:'flex', background:'#E2E8F0', borderRadius:12, padding:4, marginBottom:18, gap:3 }}>
        {TABS.map(([k,label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex:1, padding:'9px 0', border:'none', borderRadius:9, cursor:'pointer',
            fontWeight:700, fontSize:12, background:tab===k?'#fff':'transparent', color:tab===k?'#2B6CB0':'#718096',
            boxShadow:tab===k?'0 1px 4px rgba(0,0,0,0.1)':'none', touchAction:'manipulation' }}>{label}</button>
        ))}
      </div>

      {tab==='mes' && (
        <>
          <select value={selKey} onChange={e=>{setSelKey(e.target.value);setEdit(null);}}
            style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #CBD5E0', fontSize:14, marginBottom:14, background:'#fff', color:'#2D3748', fontWeight:600, cursor:'pointer' }}>
            {monthOpts(today).map(k=><option key={k} value={k}>{fmtKey(k)}{k===currentKey?' — actual':''}{allData[k]?' ✓':''}</option>)}
          </select>

          <div style={{ borderRadius:14, padding:'18px 20px', marginBottom:8,
            background:tot.saldo>=0?'#F0FFF4':'#FFF5F5', border:`2px solid ${tot.saldo>=0?'#68D391':'#FC8181'}`, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1.2, color:'#718096' }}>{tot.saldo>=0?'Saldo / Ahorro':'Déficit del mes'}</div>
                <div style={{ fontSize:32, fontWeight:900, marginTop:4, letterSpacing:-1, color:tot.saldo>=0?'#276749':'#C53030' }}>{tot.ing===0&&tot.gas===0?'—':$$(Math.abs(tot.saldo))}</div>
                {meta>0&&tot.ing>0 && <div style={{ fontSize:11, color:'#718096', marginTop:4 }}>Meta: {$$(meta)} · {tot.saldo>=meta?'✓ Alcanzada':'Faltan '+$$(Math.max(0,meta-tot.saldo))}</div>}
                {tot.saldo<0 && <div style={{ fontSize:11, color:'#C53030', marginTop:6, lineHeight:1.5 }}>⚠️ Al guardar, {$$(Math.abs(tot.saldo))} pasan al mes siguiente como deuda.</div>}
              </div>
              <div style={{ textAlign:'right', fontSize:12, lineHeight:1.9 }}>
                <div style={{ color:'#276749' }}>▲ {$$(tot.ing)}</div>
                <div style={{ color:'#C53030' }}>▼ {$$(tot.egresos)}</div>
              </div>
            </div>
            {tot.ing>0&&tot.egresos>0 && (
              <div style={{ marginTop:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#718096', marginBottom:3 }}>
                  <span>Egresos {Math.round(tot.egresos/tot.ing*100)}%</span>
                  <span style={{ fontWeight:700, color:tot.saldo<0?'#C53030':'#276749' }}>{tot.saldo>=0?`Ahorro ${Math.round(tot.saldo/tot.ing*100)}%`:'Déficit'}</span>
                </div>
                <div style={{ height:8, background:'#EDF2F7', borderRadius:8, overflow:'hidden', display:'flex' }}>
                  <div style={{ height:'100%', width:`${Math.min(tot.egresos/tot.ing*100,100)}%`, background:'#FC8181' }}/>
                  {tot.saldo>0&&<div style={{ height:'100%', width:`${Math.min(tot.saldo/tot.ing*100,100)}%`, background:'#68D391' }}/>}
                </div>
              </div>
            )}
          </div>

          {ahorroAcum>0 && (
            <div style={{ borderRadius:10, padding:'10px 16px', marginBottom:14, background:'linear-gradient(135deg,#E6FFFA,#B2F5EA)', border:'1.5px solid #81E6D9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:13, fontWeight:600, color:'#234E52' }}>💰 Ahorro acumulado total</span>
              <span style={{ fontSize:18, fontWeight:800, color:'#2B7A78' }}>{$$(ahorroAcum)}</span>
            </div>
          )}

          <div style={{ background:'#fff', borderRadius:14, overflow:'hidden', marginBottom:14, boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }}>
            <div style={{ background:'#276749', color:'#fff', padding:'10px 16px', fontWeight:700, fontSize:13 }}>💵 Ingresos</div>
            <div style={{ display:'flex', alignItems:'center', padding:'10px 16px', borderBottom:'1px solid #F0F4F8' }}>
              <span style={{ fontSize:17, marginRight:10 }}>👩</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, color:'#2D3748', fontWeight:500 }}>Julieta</div>
                <div style={{ fontSize:11, color:'#A0AEC0' }}>Sueldo vía ICBC — cargar el día 1</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ color:'#A0AEC0', fontSize:13 }}>$</span>
                <MoneyInput value={mesEdit.ingresos.julieta} onChange={v=>updateField('ingresos','julieta',v)}/>
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', background:'#F0FFF4', borderTop:'1px solid #E6FFFA' }}>
              <div>
                <div style={{ fontSize:13, color:'#276749', fontWeight:600 }}>👨 Germán (automático)</div>
                <div style={{ fontSize:11, color:'#A0AEC0' }}>Transferencias − gastos de Julieta vía transferencia</div>
              </div>
              <span style={{ fontSize:16, fontWeight:800, color:'#276749' }}>{germanIncome>0?$$(germanIncome):'—'}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', background:'#F7FAFC', borderTop:'2px solid #EDF2F7' }}>
              <span style={{ fontSize:13, fontWeight:700, color:'#276749' }}>Total ingresos</span>
              <span style={{ fontSize:16, fontWeight:800, color:'#276749' }}>{$$(tot.ing)}</span>
            </div>
          </div>

          <div style={{ background:'#fff', borderRadius:14, overflow:'hidden', marginBottom:14, boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }}>
            <div style={{ background:'#C53030', color:'#fff', padding:'10px 16px', fontWeight:700, fontSize:13, display:'flex', justifyContent:'space-between' }}>
              <span>📤 Gastos fijos</span><span style={{ fontSize:11, opacity:.8, fontWeight:400 }}>🔁 = recurrente</span>
            </div>
            {GASTOS_CONFIG.map((g, i) => {
              const isRec  = recurrentes[g.key] !== undefined;
              const fromCard = (g.key==='icbc'||g.key==='bna') && (totalesTarjetas[selKey]?.[g.key] !== undefined);
              return (
                <div key={g.key} style={{ display:'flex', alignItems:'center', padding:'9px 12px',
                  borderBottom:i===GASTOS_CONFIG.length-1?'none':'1px solid #F0F4F8', background:fromCard?'#EBF8FF':isRec?'#FFFBF5':'transparent' }}>
                  <span style={{ fontSize:16, marginRight:8, minWidth:22 }}>{g.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                      <span style={{ fontSize:13, color:'#2D3748', fontWeight:500 }}>{g.label}</span>
                      {fromCard && <span style={{ fontSize:10, background:'#BEE3F8', color:'#2B6CB0', borderRadius:4, padding:'1px 5px', fontWeight:700 }}>💳 de Tarjetas</span>}
                      {!fromCard && isRec && <span style={{ fontSize:10, background:'#FED7AA', color:'#744210', borderRadius:4, padding:'1px 5px', fontWeight:700 }}>🔁 fijo</span>}
                    </div>
                    {g.hint && !fromCard && <div style={{ fontSize:11, color:'#A0AEC0' }}>{g.hint}</div>}
                  </div>
                  {!fromCard && (
                    <button onClick={() => toggleRecurrente(g.key)} title={isRec?'Quitar recurrente':'Marcar como recurrente'}
                      style={{ border:'none', background:isRec?'#FED7AA':'#EDF2F7', borderRadius:6, cursor:'pointer', fontSize:13, padding:'4px 8px', marginRight:6, color:isRec?'#744210':'#A0AEC0', touchAction:'manipulation' }}>🔁</button>
                  )}
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ color:'#A0AEC0', fontSize:13 }}>$</span>
                    {fromCard ? (
                      <div style={{ width:120, padding:'7px 8px', borderRadius:8, fontSize:14, textAlign:'right',
                                    border:'1.5px solid #90CDF4', background:'#EBF8FF', color:'#2B6CB0', fontWeight:700 }}>
                        {new Intl.NumberFormat('es-AR').format(n(mesEdit.gastos[g.key]))}
                      </div>
                    ) : (
                      <MoneyInput width={120} value={mesEdit.gastos[g.key]}
                        border={`1.5px solid ${isRec?'#F6AD55':'#E2E8F0'}`}
                        onChange={v => { updateField('gastos', g.key, v); if(isRec) updateRecurrente(g.key, v); }}/>
                    )}
                  </div>
                </div>
              );
            })}
            {tot.deuda>0 && (
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 16px', background:'#FFF5F5', borderTop:'1px solid #FED7D7' }}>
                <span style={{ fontSize:13, color:'#C53030', fontWeight:600 }}>⚠️ Deuda mes anterior</span>
                <span style={{ fontSize:13, fontWeight:800, color:'#C53030' }}>{$$(tot.deuda)}</span>
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', background:'#F7FAFC', borderTop:'2px solid #EDF2F7' }}>
              <span style={{ fontSize:13, fontWeight:700, color:'#C53030' }}>{tot.deuda>0?'Total egresos (con deuda)':'Total gastos fijos'}</span>
              <span style={{ fontSize:16, fontWeight:800, color:'#C53030' }}>{$$(tot.egresos)}</span>
            </div>
          </div>

          <button onClick={save} disabled={saving||syncing}
            style={{ width:'100%', padding:'14px', border:'none', borderRadius:12, cursor:'pointer', fontWeight:700, fontSize:15, color:'#fff',
                     background:btnBg, boxShadow:'0 2px 6px rgba(0,0,0,0.15)', transition:'background .3s', marginBottom:4, touchAction:'manipulation' }}>
            {btnTx}
          </button>
          <p style={{ textAlign:'center', fontSize:11, color:'#A0AEC0', marginTop:6 }}>
            Datos guardados en Google Drive · 🔁 = recurrente · 💳 = cargado desde Tarjetas
          </p>
        </>
      )}

      {tab==='historial' && (
        <>
          {savedKeys.length===0 ? (
            <div style={{ textAlign:'center', padding:'60px 20px', color:'#A0AEC0' }}><div style={{ fontSize:52, marginBottom:12 }}>📭</div><div style={{ fontWeight:600 }}>No hay datos todavía</div></div>
          ) : (
            <>
              <div style={{ background:'#fff', borderRadius:14, padding:'16px 12px', marginBottom:14, boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} barGap={2} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false}/>
                    <XAxis dataKey="mes" tick={{fontSize:11,fill:'#718096'}} axisLine={false} tickLine={false}/>
                    <YAxis tickFormatter={v=>`$${Math.round(v/1000)}K`} tick={{fontSize:10,fill:'#718096'}} width={52} axisLine={false} tickLine={false}/>
                    <Tooltip formatter={v=>$$(v)} contentStyle={{borderRadius:8,border:'1px solid #E2E8F0',fontSize:12}}/>
                    <Legend wrapperStyle={{fontSize:12}}/>
                    <Bar dataKey="Ingresos" fill="#68D391" radius={[4,4,0,0]}/>
                    <Bar dataKey="Gastos"   fill="#FC8181" radius={[4,4,0,0]}/>
                    <Bar dataKey="Saldo"    fill="#4FD1C5" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background:'#fff', borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }}>
                <div style={{ background:'#1A365D', color:'#fff', padding:'11px 16px', fontWeight:700, fontSize:13 }}>Historial mensual</div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr style={{ background:'#EDF2F7' }}>{['Mes','Ingresos','Egresos','Saldo'].map(h=><th key={h} style={{ padding:'8px 10px', textAlign:h==='Mes'?'left':'right', color:'#4A5568', fontWeight:700, borderBottom:'1px solid #E2E8F0', fontSize:10, textTransform:'uppercase' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {histRows.map(({k,ing,egresos,saldo},i)=>(
                      <tr key={k} onClick={()=>{setSelKey(k);setEdit(null);setTab('mes');}} style={{ cursor:'pointer', background:i%2===0?'#fff':'#F7FAFC' }}>
                        <td style={{ padding:'9px 10px', fontWeight:600, color:'#2D3748' }}>{fmtKey(k)}{k===currentKey&&<span style={{ marginLeft:4, fontSize:9, background:'#2B6CB0', color:'white', borderRadius:4, padding:'1px 4px' }}>actual</span>}</td>
                        <td style={{ padding:'9px 10px', textAlign:'right', color:'#276749' }}>{$$(ing)}</td>
                        <td style={{ padding:'9px 10px', textAlign:'right', color:'#C53030' }}>{$$(egresos)}</td>
                        <td style={{ padding:'9px 10px', textAlign:'right', fontWeight:800, color:saldo>=0?'#276749':'#C53030' }}>{$$(saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {tab==='ahorros' && (
        <>
          <div style={{ borderRadius:14, padding:'22px 20px', marginBottom:14, textAlign:'center', background:'linear-gradient(135deg,#E6FFFA,#B2F5EA)', border:'2px solid #81E6D9' }}>
            <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1.2, color:'#234E52', marginBottom:6 }}>Ahorro total acumulado</div>
            <div style={{ fontSize:40, fontWeight:900, color:'#2B7A78', letterSpacing:-1 }}>{$$(calcAhorroAcum(allData,'9999-99',uberDiDi,zapiaData))}</div>
            {metaAhorro && <div style={{ fontSize:12, color:'#4A9E9A', marginTop:6 }}>Meta mensual: {$$(n(metaAhorro))}</div>}
          </div>
          {ahorroChart.length>0 && (
            <div style={{ background:'#fff', borderRadius:14, padding:'16px 12px', marginBottom:14, boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }}>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={ahorroChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false}/>
                  <XAxis dataKey="mes" tick={{fontSize:11,fill:'#718096'}} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={v=>`$${Math.round(v/1000)}K`} tick={{fontSize:10,fill:'#718096'}} width={55} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={v=>$$(v)} contentStyle={{borderRadius:8,fontSize:12}}/>
                  <Line type="monotone" dataKey="Ahorro acum." stroke="#2B7A78" strokeWidth={2.5} dot={{fill:'#2B7A78',r:4}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {savedKeys.length>0 && (
            <div style={{ background:'#fff', borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ background:'#2B7A78', color:'#fff', padding:'11px 16px', fontWeight:700, fontSize:13 }}>Detalle por mes</div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead><tr style={{ background:'#E6FFFA' }}>{['Mes','Saldo','Acumulado'].map(h=><th key={h} style={{ padding:'8px 12px', textAlign:h==='Mes'?'left':'right', color:'#234E52', fontWeight:700, borderBottom:'1px solid #B2F5EA', fontSize:11 }}>{h}</th>)}</tr></thead>
                <tbody>{(()=>{ let c=0; return savedKeys.map((k,i)=>{
                  const gi=calcularIngresoGerman(uberDiDi, k, zapiaData);
                  const t=calcTotals(allData[k],gi); c+=Math.max(0,t.saldo);
                  return(<tr key={k} style={{ background:i%2===0?'#fff':'#F0FFFE' }}><td style={{ padding:'9px 12px', fontWeight:600, color:'#2D3748' }}>{fmtKey(k)}</td><td style={{ padding:'9px 12px', textAlign:'right', fontWeight:700, color:t.saldo>=0?'#2B7A78':'#C53030' }}>{$$(t.saldo)}</td><td style={{ padding:'9px 12px', textAlign:'right', fontWeight:800, color:'#2B7A78' }}>{$$(c)}</td></tr>);
                });})()}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
