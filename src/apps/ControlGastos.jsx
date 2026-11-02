import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import {
  n, $$, fmtK, getKey, fmtKey, monthOpts, hoy, uid, fmtDate, calcularVencimientos, VENCIMIENTO_MES_SIGUIENTE_DEFECTO,
  calcularTotalesTarjetas, ultimoSaldoDelMes, repartirFijos, calcularAhorroManual, calcularAhorroAcumulado,
  calcularResultadoMensual, calcularTotalesMes, resolverMes, GASTOS_FIJOS_KEYS,
} from '../utils.js';
import { MoneyInput } from '../components/ui.jsx';
import Control from './Control.jsx';
import CierreReal from './CierreReal.jsx';

const GASTOS_CONFIG = [
  { key:'icbc',      label:'Tarjeta ICBC',        icon:'💳', hint:'Total del resumen' },
  { key:'bna',       label:'Tarjeta Banco Nación', icon:'💳', hint:'Total del resumen' },
  { key:'prestamos', label:'Préstamos',            icon:'🏦', hint:'Cuotas del mes' },
  { key:'nicolas',   label:'Nicolás',              icon:'👤', hint:'' },
  { key:'segundo',   label:'Segundo',              icon:'👤', hint:'' },
  { key:'alquiler',  label:'Alquiler',             icon:'🏠', hint:'' },
];

// Formulario chico para cargar un movimiento manual de ahorro (ingreso o retiro)
function AhorroForm({ tipo, onSave, onCancel }) {
  const [monto, setMonto]     = useState('');
  const [desc, setDesc]       = useState('');
  const [subtipo, setSubtipo] = useState('ingreso_extra');
  const esIngreso = tipo === 'ingreso';
  return (
    <div className="bg-[#FAFAFA] rounded-xl p-3.5 mb-3.5 border border-border">
      {esIngreso && (
        <div className="flex gap-2 mb-2.5">
          {[['ingreso_extra','Ingreso extra'],['ajuste_inicial','Ajuste inicial']].map(([k,label]) => (
            <button key={k} onClick={()=>setSubtipo(k)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold border touch-manipulation ${subtipo===k?'bg-positive text-white border-positive':'bg-white text-muted border-border'}`}>{label}</button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1 bg-white rounded-lg border-[1.5px] border-border px-3 py-2 mb-2.5">
        <span className="text-muted-light">$</span>
        <input type="number" inputMode="numeric" value={monto} onChange={e=>setMonto(e.target.value)} placeholder="0" autoFocus
          className="flex-1 border-none outline-none text-lg font-bold text-ink bg-transparent tabular-nums"/>
      </div>
      <input value={desc} onChange={e=>setDesc(e.target.value)}
        placeholder={esIngreso ? 'Ej: aguinaldo, changa...' : 'Ej: pago de deuda, arreglo del auto...'}
        className="w-full px-3 py-2 rounded-lg border-[1.5px] border-border text-sm outline-none mb-2.5"/>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 border-[1.5px] border-border rounded-lg bg-white text-muted font-semibold text-xs touch-manipulation">Cancelar</button>
        <button onClick={()=>{ if(!monto) return; onSave({ tipo: esIngreso?subtipo:'retiro', monto:n(monto), descripcion:desc.trim() }); }}
          className={`flex-[2] py-2 border-none rounded-lg text-white font-bold text-xs touch-manipulation ${esIngreso?'bg-positive':'bg-negative'}`}>Guardar</button>
      </div>
    </div>
  );
}

function AhorroMovimientoRow({ m, onBorrar }) {
  const esRetiro = m.tipo === 'retiro';
  const label = { retiro:'Retiro', ingreso_extra:'Ingreso extra', ajuste_inicial:'Ajuste inicial' }[m.tipo] || m.tipo;
  const icon  = esRetiro ? '➖' : m.tipo === 'ajuste_inicial' ? '🏁' : '➕';
  return (
    <div className="flex items-center px-4 py-2.5 border-b border-border-soft">
      <span className="text-base mr-2.5">{icon}</span>
      <div className="flex-1">
        <div className="text-[13px] text-ink font-medium">{m.descripcion || label}</div>
        <div className="text-[11px] text-muted-light mt-0.5">{label} · {m.fecha.split('-').reverse().join('/')}</div>
      </div>
      <span className={`font-bold text-[13px] tabular-nums mr-2 ${esRetiro?'text-negative':'text-positive'}`}>{esRetiro?'−':'+'}{$$(m.monto)}</span>
      <button onClick={()=>onBorrar(m.id)} className="border-none bg-none cursor-pointer text-border text-lg touch-manipulation">×</button>
    </div>
  );
}


// Editor del día de vencimiento de un gasto fijo (se repite todos los meses).
function EditorVencimiento({ valor, defectoSiguiente, onSave, onClear }) {
  const [dia, setDia] = useState(valor?.dia ? String(valor.dia) : '');
  const [sig, setSig] = useState(valor ? !!valor.mesSiguiente : !!defectoSiguiente);
  const ok = n(dia) >= 1 && n(dia) <= 31;
  return (
    <div className="px-4 py-2.5 bg-[#FFFBF5] border-b border-border-soft">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-muted">📅 Vence el día</span>
        <input type="number" inputMode="numeric" min="1" max="31" value={dia} onChange={e=>setDia(e.target.value)}
          className="w-16 px-2 py-1.5 rounded-lg border-[1.5px] border-border text-sm outline-none text-center"/>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={sig} onChange={e=>setSig(e.target.checked)}/> del mes siguiente
        </label>
      </div>
      <div className="flex gap-2">
        {valor && <button onClick={onClear} className="flex-1 py-1.5 border-[1.5px] border-border rounded-lg bg-white text-negative font-semibold text-xs touch-manipulation">Quitar</button>}
        <button onClick={()=>ok && onSave({ dia:Math.floor(n(dia)), mesSiguiente:sig })} disabled={!ok}
          className={`flex-[2] py-1.5 border-none rounded-lg text-white font-bold text-xs touch-manipulation ${ok?'bg-accent-strong':'bg-border'}`}>Guardar vencimiento</button>
      </div>
      <div className="text-[10px] text-muted-light mt-1">"Mes siguiente": el resumen/cuota de este mes vence el mes que viene (ej.: tarjeta de octubre → 3 de noviembre).</div>
    </div>
  );
}

// Arriba de todo mientras queden vencimientos por pagar: cuánto hay que reunir y si alcanza.
function VencimientosCard({ venc, hoyStr, etiquetas }) {
  const dias = f => Math.round((new Date(f+'T12:00:00') - new Date(hoyStr+'T12:00:00')) / 86400000);
  const txtDias = f => { const d = dias(f); return d === 0 ? 'vence hoy' : d === 1 ? 'mañana' : `en ${d} días`; };
  const p = venc.proximo, ok = p.balance >= 0;
  const fd = f => fmtDate(new Date(f+'T12:00:00'));
  return (
    <div className={`rounded-2xl overflow-hidden mb-3 border-2 shadow-sm ${ok?'border-[#68D391]':'border-[#FC8181]'}`}>
      <div className="bg-ink text-white px-4 py-2.5 flex justify-between items-center">
        <span className="font-bold text-[13px]">📅 Próximo vencimiento · {fd(p.fecha)}</span>
        <span className="text-[11px] opacity-80">{txtDias(p.fecha)}</span>
      </div>
      <div className={`px-4 py-3.5 ${ok?'bg-positive-soft':'bg-negative-soft'}`}>
        <div className="text-[10px] font-bold uppercase tracking-wide text-muted">Para este vencimiento hace falta reunir</div>
        <div className="text-[30px] font-extrabold tracking-tight tabular-nums text-ink">{$$(p.acumulado)}</div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-muted">Disponible (sueldo Julieta + saldo Uala): <strong className="tabular-nums">{$$(venc.disponible)}</strong></span>
        </div>
        <div className={`mt-2 text-[13px] font-extrabold ${ok?'text-positive':'text-negative'}`}>
          {ok ? `✓ Alcanza — sobran ${$$(p.balance)}` : `⚠️ Faltan ${$$(Math.abs(p.balance))}`}
        </div>
      </div>
      <div className="bg-white">
        {venc.pendientes.map((g, i) => (
          <div key={g.fecha} className={`px-4 py-2.5 ${i>0?'border-t border-border-soft':''}`}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[12px] font-bold text-ink">{fd(g.fecha)} <span className="text-muted-light font-normal">· {txtDias(g.fecha)}</span></span>
              <span className="text-[12px] font-extrabold text-negative tabular-nums">{$$(g.total)}</span>
            </div>
            {g.items.map(it => (
              <div key={it.key} className="flex justify-between text-[11px] text-muted pl-2">
                <span>{etiquetas[it.key] || it.key}</span><span className="tabular-nums">{$$(it.monto)}</span>
              </div>
            ))}
            {venc.pendientes.length > 1 && (
              <div className={`flex justify-between text-[11px] mt-1 pl-2 font-semibold ${g.balance>=0?'text-positive':'text-negative'}`}>
                <span>Acumulado {$$(g.acumulado)}</span><span>{g.balance>=0 ? `sobran ${$$(g.balance)}` : `faltan ${$$(Math.abs(g.balance))}`}</span>
              </div>
            )}
          </div>
        ))}
        <div className="px-4 py-2 bg-paper border-t border-border-soft text-[10px] text-muted-light">
          Solo cuentan los gastos fijos con vencimiento cargado (📅). Cuando pasen todos, vuelve a verse el resultado mensual.
        </div>
      </div>
    </div>
  );
}

export default function ControlGastos({ appData, saveData, zapiaData, tarjetasData, syncing, syncStatus, syncMsg, onRetry, onRefresh, usuario, metaAhorro, onOpenSettings, ocultar, onToggleOcultar }) {
  const today      = new Date();
  const currentKey = getKey(today);

  const [selKey,   setSelKey]   = useState(currentKey);   // mes calendario actual por defecto
  const [tab,      setTab]      = useState('mes');
  const [saving,   setSaving]   = useState(false);
  const [savedOk,  setSavedOk]  = useState(false);
  const [edit,     setEdit]     = useState(null);
  const [formAhorro, setFormAhorro] = useState(null);
  const [editVenc, setEditVenc] = useState(null);

  const allData     = appData.monthly            || {};
  const uberDiDi    = appData.uberDiDi           || [];
  const recurrentes = appData.gastosRecurrentes  || {};
  const dolarTarjetaMap   = appData.dolarTarjeta || {};
  const ahorroMovimientos = appData.ahorroMovimientos || [];
  const saldoJulieta = appData.saldoJulieta || {};

  const totalesTarjetas = calcularTotalesTarjetas(tarjetasData, dolarTarjetaMap);
  // Contexto único: TODAS las pantallas y la hoja Control calculan con esto.
  const ctx = { monthly:allData, gastosRecurrentes:recurrentes, totalesTarjetas, uberDiDi, zapiaData, saldoJulieta, hoyStr:hoy() };

  const agregarMovimientoAhorro = async ({ tipo, monto, descripcion }) => {
    const nuevo = { id: uid(), fecha: hoy(), tipo, monto, descripcion };
    await saveData({ ...appData, ahorroMovimientos: [nuevo, ...ahorroMovimientos] });
    setFormAhorro(null);
  };
  const borrarMovimientoAhorro = async (id) => {
    await saveData({ ...appData, ahorroMovimientos: ahorroMovimientos.filter(m=>m.id!==id) });
  };

  const mesData = resolverMes(allData, recurrentes, totalesTarjetas, selKey);
  const mesEdit = edit && edit.key === selKey ? edit.data : mesData;

  const saldoDecl    = ultimoSaldoDelMes(saldoJulieta, selKey);     // tal cual lo declara Julieta
  const germanIncome = saldoDecl ? saldoDecl.valor : 0;
  const tot        = calcularTotalesMes(mesEdit, germanIncome);
  const reparto    = repartirFijos({ sueldo: n(mesEdit.ingresos.julieta), fijos: tot.gas, saldoUala: germanIncome });
  const ahorroAcum = calcularAhorroAcumulado(ctx, selKey) + calcularAhorroManual(ahorroMovimientos, selKey);
  const meta       = n(metaAhorro);
  const vencimientos = appData.vencimientos || {};
  const hoyStr = hoy();
  // Disponible = ingresos familiares del mes (sueldo de Julieta + saldo de la Uala de Germán).
  const venc = calcularVencimientos({ vencimientos, gastos: mesEdit.gastos, mesKey: selKey, hoyStr, disponible: tot.ing });
  const etiquetas = Object.fromEntries(GASTOS_CONFIG.map(g => [g.key, g.label]));
  const guardarVenc = async (key, v) => { await saveData({ ...appData, vencimientos: { ...vencimientos, [key]: v } }); setEditVenc(null); };
  const quitarVenc = async (key) => { const nx = { ...vencimientos }; delete nx[key]; await saveData({ ...appData, vencimientos: nx }); setEditVenc(null); };

  const updateField = (section, field, value) => {
    setEdit({ key: selKey, data: { ...mesEdit, [section]: { ...mesEdit[section], [field]: value } } });
  };

  const toggleRecurrente = async (key) => {
    const val = n(mesEdit.gastos[key]);
    const newRec = { ...recurrentes };
    if (recurrentes[key] !== undefined) delete newRec[key]; else newRec[key] = val || 0;
    await saveData({ ...appData, gastosRecurrentes: newRec });
  };
  const updateRecurrente = async (key, value) => {
    if (!recurrentes[key]) return;
    await saveData({ ...appData, gastosRecurrentes: { ...recurrentes, [key]: n(value) } });
  };

  const save = async () => {
    setSaving(true);
    const newRec = { ...recurrentes };
    GASTOS_FIJOS_KEYS.forEach(k => { if (recurrentes[k] !== undefined) newRec[k] = n(mesEdit.gastos[k]); });
    const newMonthly = { ...allData, [selKey]: mesEdit };          // ya no se crea el mes siguiente con deuda
    const ok = await saveData({ ...appData, monthly: newMonthly, gastosRecurrentes: newRec });
    setSaving(false);
    if (ok) { setEdit(null); setSavedOk(true); setTimeout(() => setSavedOk(false), 3000); }
  };

  const savedKeys = Object.keys(allData).sort();
  const filaHist = k => calcularResultadoMensual(ctx, k);
  const chartData = savedKeys.slice(-6).map(k => {
    const t = filaHist(k);
    return { mes:fmtKey(k).split(' ')[0].substring(0,3), Ingresos:t.ing, Gastos:t.gas, Saldo:Math.max(0,t.saldo) };
  });
  let rAcum = 0;
  const ahorroChart = savedKeys.map(k => {
    rAcum += Math.max(0, filaHist(k).saldo);
    return { mes:fmtKey(k).split(' ')[0].substring(0,3), 'Ahorro acum.':rAcum };
  });
  const histRows = savedKeys.map(k => ({ k, ...filaHist(k) })).reverse();

  const btnBg = savedOk ? 'bg-positive' : syncStatus==='error' ? 'bg-negative' : saving||syncing ? 'bg-muted-light' : 'bg-tab-tarjetas';
  const btnTx = savedOk ? '✓  Guardado y sincronizado' : syncStatus==='error' ? '✗  No se pudo sincronizar — reintentá' : saving||syncing ? '☁️  Guardando...' : '💾  Guardar y sincronizar';

  const TABS = [['mes','📅 Mes'],['historial','📊 Historial'],['ahorros','💰 Ahorros'],['control','📊 Control'],['cierre','🧮 Cierre']];

  return (
    <div className="max-w-[640px] mx-auto p-4 bg-paper min-h-[calc(100vh-70px)]">

      <div className="bg-tab-principal rounded-2xl px-5 py-4.5 mb-4.5 text-white shadow-md">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="text-xl font-extrabold tracking-tight">💰 Principal</div>
            <div className="text-xs opacity-75 mt-0.5">{usuario==='german'?'👨 Germán':'👩 Julieta'} · {fmtKey(selKey)}</div>
          </div>
          <div className="flex gap-2 items-center">
            {syncing && <span className="text-[11px] opacity-80">☁️</span>}
            <button onClick={onToggleOcultar} title={ocultar?'Mostrar importes':'Ocultar importes'}
              className="bg-white/15 border border-white/30 rounded-lg text-white px-2.5 py-1.5 cursor-pointer text-base touch-manipulation">{ocultar?'🙈':'👁️'}</button>
            <button onClick={onOpenSettings} className="bg-white/15 border border-white/30 rounded-lg text-white px-2.5 py-1.5 cursor-pointer text-base touch-manipulation">⚙️</button>
          </div>
        </div>
        {syncStatus==='error' && (
          <button onClick={onRetry} className="w-full py-2.5 border-[1.5px] border-[#FC8181]/60 rounded-lg bg-negative/25 text-white font-semibold text-xs cursor-pointer touch-manipulation">
            ⚠️ {syncMsg || 'Error al sincronizar'} — tocar para reintentar (tus cambios no se pierden)
          </button>
        )}
      </div>

      {/* Selector de período: vale para TODAS las pestañas de Principal */}
      <select value={selKey} onChange={e=>{setSelKey(e.target.value);setEdit(null);}}
        className="w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-border text-sm mb-3 bg-white text-ink font-semibold cursor-pointer">
        {monthOpts(today).map(k=><option key={k} value={k}>{fmtKey(k)}{k===currentKey?' — actual':''}{allData[k]?' ✓':''}</option>)}
      </select>

      <div className="flex bg-border-soft rounded-xl p-1 mb-4.5 gap-0.5 overflow-x-auto">
        {TABS.map(([k,label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 whitespace-nowrap px-2 py-2.5 border-none rounded-lg cursor-pointer font-bold text-[11px] touch-manipulation
              ${tab===k ? 'bg-white text-tab-tarjetas shadow-sm' : 'bg-transparent text-muted'}`}>{label}</button>
        ))}
      </div>

      {tab==='mes' && (
        <>
          {venc.proximo && <VencimientosCard venc={venc} hoyStr={hoyStr} etiquetas={etiquetas}/>}
          <div className={`rounded-2xl px-5 py-4.5 mb-2 border-2 shadow-sm ${tot.saldo>=0?'bg-positive-soft border-[#68D391]':'bg-negative-soft border-[#FC8181]'}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{tot.saldo>=0?'Resultado mensual · ahorro':'Resultado mensual · déficit'}</div>
                <div className={`text-[32px] font-extrabold mt-1 tracking-tight tabular-nums ${tot.saldo>=0?'text-positive':'text-negative'}`}>{tot.ing===0&&tot.gas===0?'—':$$(Math.abs(tot.saldo))}</div>
                {meta>0&&tot.ing>0 && <div className="text-[11px] text-muted mt-1">Meta: {$$(meta)} · {tot.saldo>=meta?'✓ Alcanzada':'Faltan '+$$(Math.max(0,meta-tot.saldo))}</div>}
              </div>
              <div className="text-right text-xs leading-loose">
                <div className="text-positive">▲ {$$(tot.ing)}</div>
                <div className="text-negative">▼ {$$(tot.egresos)}</div>
              </div>
            </div>
            {tot.ing>0&&tot.egresos>0 && (
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-muted mb-1">
                  <span>Egresos {ocultar?'••':Math.round(tot.egresos/tot.ing*100)+'%'}</span>
                  <span className={`font-bold ${tot.saldo<0?'text-negative':'text-positive'}`}>{tot.saldo>=0?`Ahorro ${ocultar?'••':Math.round(tot.saldo/tot.ing*100)+'%'}`:'Déficit'}</span>
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
            <div className="bg-positive text-white px-4 py-2.5 font-bold text-[13px]">💵 Ingresos familiares</div>
            <div className="flex items-center px-4 py-2.5 border-b border-border-soft">
              <span className="text-lg mr-2.5">👩</span>
              <div className="flex-1">
                <div className="text-[13px] text-ink font-medium">Sueldo de Julieta</div>
                <div className="text-[11px] text-muted-light">Cobra por ICBC — cargar el día 1 (puede variar cada mes)</div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-light text-[13px]">$</span>
                <MoneyInput value={mesEdit.ingresos.julieta} onChange={v=>updateField('ingresos','julieta',v)}/>
              </div>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5 bg-positive-soft border-t border-[#E6FFFA]">
              <div>
                <div className="text-[13px] text-positive font-semibold">👨 Germán · saldo de la Uala</div>
                <div className="text-[11px] text-muted-light">{saldoDecl ? `Declarado por Julieta el ${fmtDate(new Date(saldoDecl.fecha+'T12:00:00'))}, tal cual (sin sumas ni restas).` : 'Todavía sin declarar este mes: se muestra cuando Julieta cargue el saldo del domingo.'}</div>
              </div>
              <span className="text-base font-extrabold text-positive tabular-nums">{germanIncome!==0?$$(germanIncome):'—'}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5 bg-paper border-t-2 border-border-soft">
              <span className="text-[13px] font-bold text-positive">Total ingresos familiares</span>
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
              const v = vencimientos[g.key];
              return (
                <div key={g.key}>
                  <div className={`flex items-center px-3 py-2.5 ${i===GASTOS_CONFIG.length-1 && editVenc!==g.key ?'':'border-b border-border-soft'} ${fromCard?'bg-[#EBF8FF]':isRec?'bg-[#FFFBF5]':''}`}>
                    <span className="text-base mr-2 min-w-[22px]">{g.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] text-ink font-medium">{g.label}</span>
                        {fromCard && <span className="text-[10px] bg-[#BEE3F8] text-tab-tarjetas rounded px-1.5 py-0.5 font-bold">💳 de Gastos</span>}
                        {!fromCard && isRec && <span className="text-[10px] bg-accent-soft text-accent-strong rounded px-1.5 py-0.5 font-bold">🔁 fijo</span>}
                      </div>
                      {g.hint && !fromCard && <div className="text-[11px] text-muted-light">{g.hint}</div>}
                    </div>
                    <button onClick={() => setEditVenc(editVenc===g.key?null:g.key)} title="Fecha de vencimiento"
                      className={`border-none rounded-md cursor-pointer text-[11px] font-bold px-1.5 py-1 mr-1.5 touch-manipulation ${v?'bg-ink text-white':'bg-border-soft text-muted-light'}`}>
                      {v ? `📅 ${v.dia}${v.mesSiguiente?'↗':''}` : '📅'}
                    </button>
                    {!fromCard && (
                      <button onClick={() => toggleRecurrente(g.key)} title={isRec?'Quitar recurrente':'Marcar como recurrente'}
                        className={`border-none rounded-md cursor-pointer text-[13px] px-2 py-1 mr-1.5 touch-manipulation ${isRec?'bg-accent-soft text-accent-strong':'bg-border-soft text-muted-light'}`}>🔁</button>
                    )}
                    <div className="flex items-center gap-1">
                      <span className="text-muted-light text-[13px]">$</span>
                      {fromCard ? (
                        <div className="w-[110px] px-2 py-1.5 rounded-lg text-sm text-right border-[1.5px] border-[#90CDF4] bg-[#EBF8FF] text-tab-tarjetas font-bold tabular-nums">
                          {ocultar ? '••••' : new Intl.NumberFormat('es-AR').format(n(mesEdit.gastos[g.key]))}
                        </div>
                      ) : (
                        <MoneyInput width={110} value={mesEdit.gastos[g.key]}
                          border={`1.5px solid ${isRec?'#E9BE8F':'#E2DDD3'}`}
                          onChange={val => { updateField('gastos', g.key, val); if(isRec) updateRecurrente(g.key, val); }}/>
                      )}
                    </div>
                  </div>
                  {editVenc===g.key && (
                    <EditorVencimiento valor={v} defectoSiguiente={!!VENCIMIENTO_MES_SIGUIENTE_DEFECTO[g.key]}
                      onSave={val => guardarVenc(g.key, val)} onClear={() => quitarVenc(g.key)}/>
                  )}
                </div>
              );
            })}
            <div className="flex justify-between items-center px-4 py-2.5 bg-paper border-t-2 border-border-soft">
              <span className="text-[13px] font-bold text-negative">Total gastos fijos</span>
              <span className="text-base font-extrabold text-negative tabular-nums">{$$(tot.egresos)}</span>
            </div>
          </div>

          {tot.gas>0 && (
            <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
              <div className="bg-ink text-white px-4 py-2.5 font-bold text-[13px]">📉 Cómo se cubren los fijos</div>
              <div className="flex justify-between px-4 py-2.5 border-b border-border-soft">
                <span className="text-[13px] text-muted">1º Sueldo de Julieta cubre</span><span className="text-[13px] font-bold text-negative tabular-nums">{$$(reparto.deJulieta)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5 border-b border-border-soft">
                <span className="text-[13px] text-muted">2º Lo que falta sale de la Uala de Germán</span><span className="text-[13px] font-bold text-negative tabular-nums">{$$(reparto.deUala)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5 border-b border-border-soft">
                <span className="text-[13px] text-ink font-semibold">👩 Julieta después de fijos</span><span className="text-[13px] font-extrabold tabular-nums text-ink">{$$(reparto.julietaDespues)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-2.5 bg-paper">
                <div>
                  <div className="text-[13px] text-ink font-semibold">👨 Uala de Germán después de fijos</div>
                  {!saldoDecl && reparto.ualaDespues < 0 && <div className="text-[10px] text-negative">Negativo provisorio hasta que Julieta declare su saldo el domingo.</div>}
                </div>
                <span className={`text-[15px] font-extrabold tabular-nums ${reparto.ualaDespues<0?'text-negative':'text-positive'}`}>{reparto.ualaDespues<0?`-${$$(Math.abs(reparto.ualaDespues))}`:$$(reparto.ualaDespues)}</span>
              </div>
            </div>
          )}

          <button onClick={save} disabled={saving||syncing}
            className={`w-full py-3.5 border-none rounded-xl cursor-pointer font-bold text-[15px] text-white shadow-md transition-colors mb-1 touch-manipulation ${btnBg}`}>{btnTx}</button>
          <p className="text-center text-[11px] text-muted-light mt-1.5">
            Se confirma contra Google Drive antes de avisar · 🔁 = recurrente · 💳 = cargado desde Gastos
          </p>
        </>
      )}

      {tab==='historial' && (
        savedKeys.length===0 ? (
          <div className="text-center py-15 px-5 text-muted-light"><div className="text-5xl mb-3">📭</div><div className="font-semibold">No hay datos todavía</div></div>
        ) : (
          <>
            <div className="bg-white rounded-2xl px-3 py-4 mb-3.5 shadow-sm">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barGap={2} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false}/>
                  <XAxis dataKey="mes" tick={{fontSize:11,fill:'#6B6459'}} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={fmtK} tick={{fontSize:10,fill:'#6B6459'}} width={52} axisLine={false} tickLine={false}/>
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
                <thead><tr className="bg-border-soft">{['Mes','Ingresos','Egresos','Resultado'].map(h=><th key={h} className={`px-2.5 py-2 ${h==='Mes'?'text-left':'text-right'} text-muted font-bold border-b border-border text-[10px] uppercase`}>{h}</th>)}</tr></thead>
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
        )
      )}

      {tab==='ahorros' && (
        <>
          <div className="rounded-2xl px-5 py-5.5 mb-3.5 text-center bg-gradient-to-br from-positive-soft to-[#B2F5EA] border-2 border-[#81E6D9]">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[#234E52] mb-1.5">Ahorro total acumulado</div>
            <div className="text-[40px] font-extrabold text-[#2B7A78] tracking-tight tabular-nums">
              {$$(calcularAhorroAcumulado(ctx,'9999-99') + calcularAhorroManual(ahorroMovimientos))}
            </div>
            {metaAhorro && <div className="text-xs text-[#4A9E9A] mt-1.5">Meta mensual: {$$(n(metaAhorro))}</div>}
          </div>

          <div className="flex gap-2 mb-3.5">
            <button onClick={()=>setFormAhorro(formAhorro==='ingreso'?null:'ingreso')}
              className={`flex-1 py-2.5 border-none rounded-xl font-bold text-sm text-white touch-manipulation ${formAhorro==='ingreso'?'bg-[#236348]':'bg-positive'}`}>+ Ingreso</button>
            <button onClick={()=>setFormAhorro(formAhorro==='retiro'?null:'retiro')}
              className={`flex-1 py-2.5 border-none rounded-xl font-bold text-sm text-white touch-manipulation ${formAhorro==='retiro'?'bg-[#8C3A2A]':'bg-negative'}`}>− Retiro/Gasto</button>
          </div>
          {formAhorro && <AhorroForm tipo={formAhorro} onSave={agregarMovimientoAhorro} onCancel={()=>setFormAhorro(null)}/>}

          {ahorroChart.length>0 && (
            <div className="bg-white rounded-2xl px-3 py-4 mb-3.5 shadow-sm">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={ahorroChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false}/>
                  <XAxis dataKey="mes" tick={{fontSize:11,fill:'#6B6459'}} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={fmtK} tick={{fontSize:10,fill:'#6B6459'}} width={55} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={v=>$$(v)} contentStyle={{borderRadius:8,fontSize:12}}/>
                  <Line type="monotone" dataKey="Ahorro acum." stroke="#2B7A78" strokeWidth={2.5} dot={{fill:'#2B7A78',r:4}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {ahorroMovimientos.length>0 && (
            <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
              <div className="bg-ink text-white px-4 py-2.5 font-bold text-[13px]">Movimientos manuales</div>
              {ahorroMovimientos.map(m => <AhorroMovimientoRow key={m.id} m={m} onBorrar={borrarMovimientoAhorro}/>)}
            </div>
          )}

          {savedKeys.length>0 && (
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-[#2B7A78] text-white px-4 py-2.5 font-bold text-[13px]">Detalle por mes (automático)</div>
              <table className="w-full border-collapse text-xs">
                <thead><tr className="bg-positive-soft">{['Mes','Resultado','Acumulado'].map(h=><th key={h} className={`px-3 py-2 ${h==='Mes'?'text-left':'text-right'} text-[#234E52] font-bold border-b border-[#B2F5EA] text-[11px]`}>{h}</th>)}</tr></thead>
                <tbody>{(()=>{ let c=0; return savedKeys.map((k,i)=>{
                  const t=filaHist(k); c+=Math.max(0,t.saldo);
                  return(<tr key={k} className={i%2===0?'bg-white':'bg-[#F0FFFE]'}><td className="px-3 py-2.5 font-semibold text-ink">{fmtKey(k)}</td><td className={`px-3 py-2.5 text-right font-bold tabular-nums ${t.saldo>=0?'text-[#2B7A78]':'text-negative'}`}>{$$(t.saldo)}</td><td className="px-3 py-2.5 text-right font-extrabold text-[#2B7A78] tabular-nums">{$$(c)}</td></tr>);
                });})()}</tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab==='control' && (
        <Control embebido appData={appData} saveData={saveData} zapiaData={zapiaData} onRefresh={onRefresh} mesKey={selKey}/>
      )}

      {tab==='cierre' && (
        <CierreReal embebido appData={appData} zapiaData={zapiaData} tarjetasData={tarjetasData} onRefresh={onRefresh} mesKey={selKey}/>
      )}
    </div>
  );
}
