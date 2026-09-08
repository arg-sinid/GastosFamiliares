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

  const totalesTarjetas = calcularTotalesTarjetas(tarjetasData, dolarTarjetaMap);

  const getMes = k => {
    const s = allData[k] || {};
    const e = EMPTY_MES();
    const tMes = totalesTarjetas[k] || {};
    const gastos = Object.keys(e.gastos).reduce((acc, key) => {
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

  // Colores para recharts (SVG requiere hex real, no clases de Tailwind)
  const C = { positive:'#2F7A52', negative:'#B54834', accent:'#C2703D', teal:'#2B6CB0', ink:'#1C2530', tealDeep:'#2B7A78' };

  const btnBg = savedOk ? 'bg-positive' : syncStatus==='error' ? 'bg-negative' : saving||syncing ? 'bg-muted-light' : 'bg-tab-tarjetas';
  const btnTx = savedOk ? '✓  Guardado' : syncStatus==='error' ? '✗  Error — reintentá' : saving||syncing ? '☁️  Guardando...' : '💾  Guardar y sincronizar';

  const TABS = [['mes','📅 Mes'],['historial','📊 Historial'],['ahorros','💰 Ahorros']];

  return (
    <div className="max-w-[640px] mx-auto p-4 bg-paper min-h-[calc(100vh-70px)]">

      <div className="bg-tab-principal rounded-2xl px-5 py-4.5 mb-4.5 text-white shadow-md">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="text-xl font-extrabold tracking-tight">💰 Principal</div>
            <div className="text-xs opacity-75 mt-0.5">{usuario==='german'?'👨 Germán':'👩 Julieta'} · {fmtKey(currentKey)}</div>
          </div>
          <div className="flex gap-2 items-center">
            {syncing && <span className="text-[11px] opacity-80">☁️</span>}
            <button onClick={onOpenSettings} className="bg-white/15 border border-white/30 rounded-lg text-white px-2.5 py-1.5 cursor-pointer text-base touch-manipulation">⚙️</button>
          </div>
        </div>
        {syncStatus==='error' && (
          <button onClick={onForceSync} className="w-full py-2.5 border-[1.5px] border-[#FC8181]/60 rounded-lg bg-negative/25 text-white font-semibold text-xs cursor-pointer touch-manipulation">
            ⚠️ Error al sincronizar — tocar para reintentar
          </button>
        )}
      </div>

      <div className="flex bg-border-soft rounded-xl p-1 mb-4.5 gap-0.5">
        {TABS.map(([k,label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 py-2.5 border-none rounded-lg cursor-pointer font-bold text-xs touch-manipulation
              ${tab===k ? 'bg-white text-tab-tarjetas shadow-sm' : 'bg-transparent text-muted'}`}>{label}</button>
        ))}
      </div>

      {tab==='mes' && (
        <>
          <select value={selKey} onChange={e=>{setSelKey(e.target.value);setEdit(null);}}
            className="w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-border text-sm mb-3.5 bg-white text-ink font-semibold cursor-pointer">
            {monthOpts(today).map(k=><option key={k} value={k}>{fmtKey(k)}{k===currentKey?' — actual':''}{allData[k]?' ✓':''}</option>)}
          </select>

          <div className={`rounded-2xl px-5 py-4.5 mb-2 border-2 shadow-sm ${tot.saldo>=0?'bg-positive-soft border-[#68D391]':'bg-negative-soft border-[#FC8181]'}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{tot.saldo>=0?'Saldo / Ahorro':'Déficit del mes'}</div>
                <div className={`text-[32px] font-extrabold mt-1 tracking-tight tabular-nums ${tot.saldo>=0?'text-positive':'text-negative'}`}>{tot.ing===0&&tot.gas===0?'—':$$(Math.abs(tot.saldo))}</div>
                {meta>0&&tot.ing>0 && <div className="text-[11px] text-muted mt-1">Meta: {$$(meta)} · {tot.saldo>=meta?'✓ Alcanzada':'Faltan '+$$(Math.max(0,meta-tot.saldo))}</div>}
                {tot.saldo<0 && <div className="text-[11px] text-negative mt-1.5 leading-relaxed">⚠️ Al guardar, {$$(Math.abs(tot.saldo))} pasan al mes siguiente como deuda.</div>}
              </div>
              <div className="text-right text-xs leading-loose">
                <div className="text-positive">▲ {$$(tot.ing)}</div>
                <div className="text-negative">▼ {$$(tot.egresos)}</div>
              </div>
            </div>
            {tot.ing>0&&tot.egresos>0 && (
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-muted mb-1">
                  <span>Egresos {Math.round(tot.egresos/tot.ing*100)}%</span>
                  <span className={`font-bold ${tot.saldo<0?'text-negative':'text-positive'}`}>{tot.saldo>=0?`Ahorro ${Math.round(tot.saldo/tot.ing*100)}%`:'Déficit'}</span>
                </div>
                <div className="h-2 bg-border-soft rounded-lg overflow-hidden flex">
                  <div className="h-full bg-[#FC8181]" style={{width:`${Math.min(tot.egresos/tot.ing*100,100)}%`}}/>
                  {tot.saldo>0&&<div className="h-full bg-[#68D391]" style={{width:`${Math.min(tot.saldo/tot.ing*100,100)}%`}}/>}
                </div>
              </div>
            )}
          </div>

          {ahorroAcum>0 && (
            <div className="rounded-lg px-4 py-2.5 mb-3.5 bg-gradient-to-r from-positive-soft to-[#B2F5EA] border-[1.5px] border-[#81E6D9] flex justify-between items-center">
              <span className="text-[13px] font-semibold text-[#234E52]">💰 Ahorro acumulado total</span>
              <span className="text-lg font-extrabold text-[#2B7A78] tabular-nums">{$$(ahorroAcum)}</span>
            </div>
          )}

          <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
            <div className="bg-positive text-white px-4 py-2.5 font-bold text-[13px]">💵 Ingresos</div>
            <div className="flex items-center px-4 py-2.5 border-b border-border-soft">
              <span className="text-lg mr-2.5">👩</span>
              <div className="flex-1">
                <div className="text-[13px] text-ink font-medium">Julieta</div>
                <div className="text-[11px] text-muted-light">Sueldo vía ICBC — cargar el día 1</div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-light text-[13px]">$</span>
                <MoneyInput value={mesEdit.ingresos.julieta} onChange={v=>updateField('ingresos','julieta',v)}/>
              </div>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5 bg-positive-soft border-t border-[#E6FFFA]">
              <div>
                <div className="text-[13px] text-positive font-semibold">👨 Germán (automático)</div>
                <div className="text-[11px] text-muted-light">Transferencias − gastos de Julieta vía transferencia</div>
              </div>
              <span className="text-base font-extrabold text-positive tabular-nums">{germanIncome>0?$$(germanIncome):'—'}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5 bg-paper border-t-2 border-border-soft">
              <span className="text-[13px] font-bold text-positive">Total ingresos</span>
              <span className="text-base font-extrabold text-positive tabular-nums">{$$(tot.ing)}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
            <div className="bg-negative text-white px-4 py-2.5 font-bold text-[13px] flex justify-between">
              <span>📤 Gastos fijos</span><span className="text-[11px] opacity-80 font-normal">🔁 = recurrente</span>
            </div>
            {GASTOS_CONFIG.map((g, i) => {
              const isRec  = recurrentes[g.key] !== undefined;
              const fromCard = (g.key==='icbc'||g.key==='bna') && (totalesTarjetas[selKey]?.[g.key] !== undefined);
              return (
                <div key={g.key} className={`flex items-center px-3 py-2.5 ${i===GASTOS_CONFIG.length-1?'':'border-b border-border-soft'} ${fromCard?'bg-[#EBF8FF]':isRec?'bg-[#FFFBF5]':''}`}>
                  <span className="text-base mr-2 min-w-[22px]">{g.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[13px] text-ink font-medium">{g.label}</span>
                      {fromCard && <span className="text-[10px] bg-[#BEE3F8] text-tab-tarjetas rounded px-1.5 py-0.5 font-bold">💳 de Tarjetas</span>}
                      {!fromCard && isRec && <span className="text-[10px] bg-accent-soft text-accent-strong rounded px-1.5 py-0.5 font-bold">🔁 fijo</span>}
                    </div>
                    {g.hint && !fromCard && <div className="text-[11px] text-muted-light">{g.hint}</div>}
                  </div>
                  {!fromCard && (
                    <button onClick={() => toggleRecurrente(g.key)} title={isRec?'Quitar recurrente':'Marcar como recurrente'}
                      className={`border-none rounded-md cursor-pointer text-[13px] px-2 py-1 mr-1.5 touch-manipulation ${isRec?'bg-accent-soft text-accent-strong':'bg-border-soft text-muted-light'}`}>🔁</button>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="text-muted-light text-[13px]">$</span>
                    {fromCard ? (
                      <div className="w-[120px] px-2 py-1.5 rounded-lg text-sm text-right border-[1.5px] border-[#90CDF4] bg-[#EBF8FF] text-tab-tarjetas font-bold tabular-nums">
                        {new Intl.NumberFormat('es-AR').format(n(mesEdit.gastos[g.key]))}
                      </div>
                    ) : (
                      <MoneyInput width={120} value={mesEdit.gastos[g.key]}
                        border={`1.5px solid ${isRec?'#E9BE8F':'#E2DDD3'}`}
                        onChange={v => { updateField('gastos', g.key, v); if(isRec) updateRecurrente(g.key, v); }}/>
                    )}
                  </div>
                </div>
              );
            })}
            {tot.deuda>0 && (
              <div className="flex justify-between items-center px-4 py-2.5 bg-negative-soft border-t border-[#F5B4A8]">
                <span className="text-[13px] text-negative font-semibold">⚠️ Deuda mes anterior</span>
                <span className="text-[13px] font-extrabold text-negative tabular-nums">{$$(tot.deuda)}</span>
              </div>
            )}
            <div className="flex justify-between items-center px-4 py-2.5 bg-paper border-t-2 border-border-soft">
              <span className="text-[13px] font-bold text-negative">{tot.deuda>0?'Total egresos (con deuda)':'Total gastos fijos'}</span>
              <span className="text-base font-extrabold text-negative tabular-nums">{$$(tot.egresos)}</span>
            </div>
          </div>

          <button onClick={save} disabled={saving||syncing}
            className={`w-full py-3.5 border-none rounded-xl cursor-pointer font-bold text-[15px] text-white shadow-md transition-colors mb-1 touch-manipulation ${btnBg}`}>
            {btnTx}
          </button>
          <p className="text-center text-[11px] text-muted-light mt-1.5">
            Datos guardados en Google Drive · 🔁 = recurrente · 💳 = cargado desde Tarjetas
          </p>
        </>
      )}

      {tab==='historial' && (
        <>
          {savedKeys.length===0 ? (
            <div className="text-center py-15 px-5 text-muted-light"><div className="text-5xl mb-3">📭</div><div className="font-semibold">No hay datos todavía</div></div>
          ) : (
            <>
              <div className="bg-white rounded-2xl px-3 py-4 mb-3.5 shadow-sm">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} barGap={2} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false}/>
                    <XAxis dataKey="mes" tick={{fontSize:11,fill:'#6B6459'}} axisLine={false} tickLine={false}/>
                    <YAxis tickFormatter={v=>`$${Math.round(v/1000)}K`} tick={{fontSize:10,fill:'#6B6459'}} width={52} axisLine={false} tickLine={false}/>
                    <Tooltip formatter={v=>$$(v)} contentStyle={{borderRadius:8,border:'1px solid #E2DDD3',fontSize:12}}/>
                    <Legend wrapperStyle={{fontSize:12}}/>
                    <Bar dataKey="Ingresos" fill="#68D391" radius={[4,4,0,0]}/>
                    <Bar dataKey="Gastos"   fill="#FC8181" radius={[4,4,0,0]}/>
                    <Bar dataKey="Saldo"    fill="#4FD1C5" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-ink text-white px-4 py-2.5 font-bold text-[13px]">Historial mensual</div>
                <table className="w-full border-collapse text-xs">
                  <thead><tr className="bg-border-soft">{['Mes','Ingresos','Egresos','Saldo'].map(h=><th key={h} className={`px-2.5 py-2 ${h==='Mes'?'text-left':'text-right'} text-muted font-bold border-b border-border text-[10px] uppercase`}>{h}</th>)}</tr></thead>
                  <tbody>
                    {histRows.map(({k,ing,egresos,saldo},i)=>(
                      <tr key={k} onClick={()=>{setSelKey(k);setEdit(null);setTab('mes');}} className={`cursor-pointer ${i%2===0?'bg-white':'bg-paper'}`}>
                        <td className="px-2.5 py-2.5 font-semibold text-ink">{fmtKey(k)}{k===currentKey&&<span className="ml-1 text-[9px] bg-tab-tarjetas text-white rounded px-1 py-0.5">actual</span>}</td>
                        <td className="px-2.5 py-2.5 text-right text-positive tabular-nums">{$$(ing)}</td>
                        <td className="px-2.5 py-2.5 text-right text-negative tabular-nums">{$$(egresos)}</td>
                        <td className={`px-2.5 py-2.5 text-right font-extrabold tabular-nums ${saldo>=0?'text-positive':'text-negative'}`}>{$$(saldo)}</td>
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
          <div className="rounded-2xl px-5 py-5.5 mb-3.5 text-center bg-gradient-to-br from-positive-soft to-[#B2F5EA] border-2 border-[#81E6D9]">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[#234E52] mb-1.5">Ahorro total acumulado</div>
            <div className="text-[40px] font-extrabold text-[#2B7A78] tracking-tight tabular-nums">{$$(calcAhorroAcum(allData,'9999-99',uberDiDi,zapiaData))}</div>
            {metaAhorro && <div className="text-xs text-[#4A9E9A] mt-1.5">Meta mensual: {$$(n(metaAhorro))}</div>}
          </div>
          {ahorroChart.length>0 && (
            <div className="bg-white rounded-2xl px-3 py-4 mb-3.5 shadow-sm">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={ahorroChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false}/>
                  <XAxis dataKey="mes" tick={{fontSize:11,fill:'#6B6459'}} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={v=>`$${Math.round(v/1000)}K`} tick={{fontSize:10,fill:'#6B6459'}} width={55} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={v=>$$(v)} contentStyle={{borderRadius:8,fontSize:12}}/>
                  <Line type="monotone" dataKey="Ahorro acum." stroke="#2B7A78" strokeWidth={2.5} dot={{fill:'#2B7A78',r:4}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {savedKeys.length>0 && (
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-[#2B7A78] text-white px-4 py-2.5 font-bold text-[13px]">Detalle por mes</div>
              <table className="w-full border-collapse text-xs">
                <thead><tr className="bg-positive-soft">{['Mes','Saldo','Acumulado'].map(h=><th key={h} className={`px-3 py-2 ${h==='Mes'?'text-left':'text-right'} text-[#234E52] font-bold border-b border-[#B2F5EA] text-[11px]`}>{h}</th>)}</tr></thead>
                <tbody>{(()=>{ let c=0; return savedKeys.map((k,i)=>{
                  const gi=calcularIngresoGerman(uberDiDi, k, zapiaData);
                  const t=calcTotals(allData[k],gi); c+=Math.max(0,t.saldo);
                  return(<tr key={k} className={i%2===0?'bg-white':'bg-[#F0FFFE]'}><td className="px-3 py-2.5 font-semibold text-ink">{fmtKey(k)}</td><td className={`px-3 py-2.5 text-right font-bold tabular-nums ${t.saldo>=0?'text-[#2B7A78]':'text-negative'}`}>{$$(t.saldo)}</td><td className="px-3 py-2.5 text-right font-extrabold text-[#2B7A78] tabular-nums">{$$(c)}</td></tr>);
                });})()}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
