import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import { n, $$, fmtK, getKey, fmtKey, monthOpts, hoy, uid, fmtDate, mesDesplazado } from '../utils.js';
import {
  VENCIMIENTO_MES_SIGUIENTE_DEFECTO, fechaVencimiento, clavesFijos, esTarjetaClave, totalFijos,
  construirSituacion, calcularResultadoMensual, calcularAhorroManual,
} from '../motor.js';
import { MoneyInput, CategoriaModal } from '../components/ui.jsx';
import { ConciliacionUalaDetalle } from '../components/conciliacion.jsx';
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


// Editor del vencimiento de un gasto fijo (se repite todos los meses). Muestra qué fecha da para el mes que se mira.
function EditorVencimiento({ valor, defectoSiguiente, mesKey, onSave, onClear }) {
  const [dia, setDia] = useState(valor?.dia ? String(valor.dia) : '');
  const [sig, setSig] = useState(valor ? !!valor.mesSiguiente : !!defectoSiguiente);
  const ok = n(dia) >= 1 && n(dia) <= 31;
  const fecha = ok ? fechaVencimiento(mesKey, dia, sig) : null;
  return (
    <div className="px-4 py-2.5 bg-[#FFFBF5] border-b border-border-soft">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-xs text-muted">📅 Vence el día</span>
        <input type="number" inputMode="numeric" min="1" max="31" value={dia} onChange={e=>setDia(e.target.value)}
          className="w-14 px-2 py-1.5 rounded-lg border-[1.5px] border-border text-sm outline-none text-center"/>
        <select value={sig?'1':'0'} onChange={e=>setSig(e.target.value==='1')}
          className="border-[1.5px] border-border rounded-lg bg-white text-xs px-1.5 py-1.5">
          <option value="0">del mismo mes</option>
          <option value="1">del mes siguiente</option>
        </select>
      </div>
      {fecha && <div className="text-[11px] font-semibold text-accent-strong mb-2">Para {fmtKey(mesKey)} vence el {fmtDate(new Date(fecha+'T12:00:00'))}/{fecha.slice(0,4)}</div>}
      <div className="flex gap-2">
        {valor && <button onClick={onClear} className="flex-1 py-1.5 border-[1.5px] border-border rounded-lg bg-white text-negative font-semibold text-xs touch-manipulation">Quitar</button>}
        <button onClick={()=>ok && onSave({ dia:Math.floor(n(dia)), mesSiguiente:sig })} disabled={!ok}
          className={`flex-[2] py-1.5 border-none rounded-lg text-white font-bold text-xs touch-manipulation ${ok?'bg-accent-strong':'bg-border'}`}>Guardar vencimiento</button>
      </div>
    </div>
  );
}

const ESTADOS = {
  vencido:   { txt: 'Vencido',          cls: 'bg-negative-soft text-negative' },
  proximo:   { txt: 'Próximo a vencer', cls: 'bg-accent-soft text-accent-strong' },
  pendiente: { txt: 'Pendiente',        cls: 'bg-border-soft text-muted' },
  pagado:    { txt: 'Pagado',           cls: 'bg-positive-soft text-positive' },
};

// Una obligación: gasto fijo + período + vencimiento + estado. Solo muestra lo que calculó el motor.
function ObligacionRow({ o, etiquetas, onPagar, onDeshacer, onAbrir }) {
  const e = ESTADOS[o.estado], provisorio = o.tipo === 'provisorio';
  const mn = k => fmtKey(k).split(' ')[0].toLowerCase();
  const insignia = o.fuente === 'movimientos' ? `Temporal de ${mn(o.mesResumen)}`
    : o.fuente === 'recurrente' ? 'Estimado · importe recurrente'
    : `Estimado${o.basadoEn ? ` · basado en el resumen de ${mn(o.basadoEn)}` : ''}`;
  const puedePagar = !o.pagado && (!provisorio || o.estado === 'vencido');
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border-soft bg-white">
      <div className="flex-1 min-w-0">
        <button onClick={() => onAbrir(o)} className="border-none bg-transparent p-0 text-left cursor-pointer touch-manipulation">
          <span className="text-[13px] font-semibold text-ink">{etiquetas[o.key] || o.key} ›</span>
        </button>
        <div className="flex gap-1.5 flex-wrap mt-0.5 items-center">
          <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${e.cls}`}>{e.txt}</span>
          {provisorio && <span className="text-[10px] font-bold rounded px-1.5 py-0.5 bg-[#FEEBC8] text-[#9C4221]">{insignia}</span>}
          <span className="text-[10px] text-muted-light">
            {o.pagado ? `pagado ${fmtDate(new Date((o.fechaPago || o.fecha) + 'T12:00:00'))}` : `vence ${fmtDate(new Date(o.fecha + 'T12:00:00'))}/${o.fecha.slice(0,4)}`}
            {` · período: ${o.mesResumen ? 'resumen de ' : ''}${fmtKey(o.mesResumen || o.periodo)}`}
          </span>
        </div>
      </div>
      <span className="text-[13px] font-bold tabular-nums text-ink">{provisorio ? '≈ ' : ''}{$$(o.monto)}</span>
      {puedePagar && <button onClick={() => onPagar(o)} className="border-none bg-positive-soft text-positive rounded-lg px-2 py-1 text-[11px] font-bold cursor-pointer touch-manipulation">✓ Pagado</button>}
      {o.pagado && <button onClick={() => onDeshacer(o)} className="border-none bg-border-soft rounded-md px-1.5 py-0.5 text-[10px] text-muted cursor-pointer touch-manipulation">deshacer</button>}
    </div>
  );
}

function SeccionObligaciones({ titulo, color, lista, total, nota, ...props }) {
  if (!lista.length) return null;
  return (
    <div>
      <div className="px-4 py-2 flex justify-between items-center bg-paper border-t-2 border-border-soft">
        <span className={`text-[11px] font-extrabold uppercase tracking-wide ${color}`}>{titulo}</span>
        <span className={`text-[12px] font-extrabold tabular-nums ${color}`}>{$$(total)}</span>
      </div>
      {nota && <div className="px-4 py-1 text-[10px] text-muted-light bg-paper">{nota}</div>}
      {lista.map(o => <ObligacionRow key={o.id} o={o} {...props}/>)}
    </div>
  );
}

// Detalle de un gasto fijo (Nicolás, Segundo, Préstamos, Alquiler…): en qué se compone y a qué categoría va cada parte.
function DetalleFijoModal({ titulo, mesLabel, items, montoFijo, categorias, hayAnterior, onSave, onUsarSuma, onCopiarAnterior, onClose }) {
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [cat, setCat] = useState({ categoria:'Otros', emoji:'📦' });
  const [showCat, setShowCat] = useState(false);
  const total = items.reduce((s,i) => s + n(i.monto), 0);
  const agregar = () => {
    if (!concepto.trim() || !(n(monto) > 0)) return;
    onSave([...items, { id: uid(), concepto: concepto.trim(), monto: n(monto), categoria: cat.categoria, emoji: cat.emoji }]);
    setConcepto(''); setMonto('');
  };
  return (
    <div className="fixed inset-0 bg-black/60 z-[250] flex items-end justify-center">
      <div className="bg-white rounded-t-[20px] px-4 pt-5 pb-8 w-full max-w-[500px] max-h-[85vh] overflow-y-auto">
        <div className="font-extrabold text-base text-ink">{titulo}</div>
        <div className="text-[12px] text-muted mb-3">Detalle de {mesLabel} · en qué se gasta y a qué categoría corresponde</div>
        {items.length === 0 && <div className="text-[12px] text-muted-light mb-3">Todavía no cargaste detalle.</div>}
        {items.map(it => (
          <div key={it.id} className="flex items-center gap-2 py-2 border-b border-border-soft">
            <span className="text-lg">{it.emoji}</span>
            <div className="flex-1">
              <div className="text-[13px] text-ink font-medium">{it.concepto}</div>
              <div className="text-[11px] text-muted-light">{it.categoria}</div>
            </div>
            <span className="text-[13px] font-bold text-ink tabular-nums">{$$(it.monto)}</span>
            <button onClick={()=>onSave(items.filter(x => x.id !== it.id))} className="border-none bg-border-soft rounded-md cursor-pointer text-[12px] px-2 py-1 touch-manipulation">🗑️</button>
          </div>
        ))}
        <div className="flex justify-between py-2 text-[12px]">
          <span className="text-muted">Suma del detalle</span><span className="font-extrabold text-ink tabular-nums">{$$(total)}</span>
        </div>
        <div className="flex justify-between pb-2 text-[12px]">
          <span className="text-muted">Importe del gasto fijo</span><span className="font-bold text-ink tabular-nums">{$$(montoFijo)}</span>
        </div>
        {items.length > 0 && Math.round(total) !== Math.round(montoFijo) && (
          <button onClick={()=>onUsarSuma(total)} className="w-full mb-3 py-2 border-[1.5px] border-accent rounded-lg bg-accent-soft text-accent-strong font-bold text-xs touch-manipulation">Usar la suma ({$$(total)}) como importe del fijo</button>
        )}
        <div className="bg-[#FAFAFA] rounded-xl p-3 mb-3 border border-border">
          <div className="text-[11px] font-bold text-muted uppercase mb-2">Agregar al detalle</div>
          <input value={concepto} onChange={e=>setConcepto(e.target.value)} placeholder="Concepto (ej: cuota del auto)"
            className="w-full px-3 py-2 rounded-lg border-[1.5px] border-border text-sm outline-none mb-2 bg-white"/>
          <div className="flex gap-2 mb-2">
            <input type="number" inputMode="numeric" value={monto} onChange={e=>setMonto(e.target.value)} placeholder="Monto"
              className="flex-1 px-3 py-2 rounded-lg border-[1.5px] border-border text-sm outline-none bg-white tabular-nums"/>
            <button onClick={()=>setShowCat(true)} className="flex-1 px-2 py-2 rounded-lg border-[1.5px] border-border bg-white text-sm font-semibold text-ink touch-manipulation">{cat.emoji} {cat.categoria}</button>
          </div>
          <button onClick={agregar} className="w-full py-2 border-none rounded-lg bg-tab-principal text-white font-bold text-xs touch-manipulation">+ Agregar</button>
        </div>
        {hayAnterior && items.length === 0 && (
          <button onClick={onCopiarAnterior} className="w-full mb-3 py-2 border-[1.5px] border-border rounded-lg bg-white text-muted font-semibold text-xs touch-manipulation">Copiar el detalle del mes anterior</button>
        )}
        <button onClick={onClose} className="w-full p-3 border-[1.5px] border-border rounded-lg bg-white cursor-pointer font-semibold text-muted text-sm touch-manipulation">Cerrar</button>
      </div>
      {showCat && <CategoriaModal subtitulo={concepto || titulo} categorias={categorias} onSelect={c=>{ setCat(c); setShowCat(false); }} onClose={()=>setShowCat(false)}/>}
    </div>
  );
}

export default function ControlGastos({ appData, saveData, zapiaData, tarjetasData, tarjetasProv, syncing, syncStatus, syncMsg, backendInfo, onRetry, onRefresh, usuario, metaAhorro, onOpenSettings, ocultar, onToggleOcultar, onIrATarjeta }) {
  const today = new Date();
  const currentKey = getKey(today);
  const hoyStr = hoy();

  const [selKey, setSelKey] = useState(currentKey);
  const [tab, setTab] = useState('mes');
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [edit, setEdit] = useState(null);
  const [formAhorro, setFormAhorro] = useState(null);
  const [editVenc, setEditVenc] = useState(null);
  const [detalleFijo, setDetalleFijo] = useState(null);
  const [nuevoFijo, setNuevoFijo] = useState(null);
  const [verUala, setVerUala] = useState(false);
  const [verPagadas, setVerPagadas] = useState(false);
  const [verCob, setVerCob] = useState(true);
  const [verVencAnt, setVerVencAnt] = useState(false);
  const [editarImportes, setEditarImportes] = useState(false);

  const allData = appData.monthly || {};
  const recurrentes = appData.gastosRecurrentes || {};
  const vencimientos = appData.vencimientos || {};
  const detalleFijos = appData.detalleFijos || {};
  const pagosFijos = appData.pagosFijos || {};
  const ahorroMovimientos = appData.ahorroMovimientos || [];
  const ajustes = appData.ajustes || {};
  const claves = clavesFijos(ajustes);
  const mesResumen = selKey;       // el resumen de un mes (gastos de noviembre) figura en el Principal de ese mes y vence el siguiente

  // ÚNICA fuente de cálculo: el motor financiero. Los importes que se están editando (sin guardar) se reflejan en todo.
  const appCalc = edit && edit.key === selKey ? { ...appData, monthly: { ...allData, [selKey]: edit.data } } : appData;
  const situ = construirSituacion({ appData: appCalc, zapiaData, tarjetasData, tarjetasProvisorias: tarjetasProv || [], mesKey: selKey, hoyStr });
  const mesEdit = situ.mes, totalesTarjetas = situ.totalesTarjetas;
  const { disponibilidad: disp, obligaciones: ob, resultado: res, cobertura } = situ;
  const esMesActual = selKey === currentKey;

  const extras = ajustes.fijosExtra || [];
  const filasFijos = [...GASTOS_CONFIG, ...extras.map(e => ({ key: e.id, label: e.label, icon: e.icon || '📌', hint: '', extra: true }))];
  const etiquetas = Object.fromEntries(filasFijos.map(g => [g.key, g.label]));
  const obligacionesMes = ob.todas.filter(o => o.visible && o.periodo === selKey);
  const sinFecha = claves.filter(k => n(mesEdit.gastos[k]) > 0 && !(vencimientos[k] && n(vencimientos[k].dia)));
  const neg = v => v < 0 ? `-${$$(Math.abs(v))}` : $$(v);

  // ── acciones ──
  const marcarPago = (o) => saveData({ ...appData, pagosFijos: { ...pagosFijos, [o.id]: { fecha: hoyStr } } });
  const deshacerPago = (o) => { const nx = { ...pagosFijos }; delete nx[o.id]; return saveData({ ...appData, pagosFijos: nx }); };
  const abrirObligacion = (o) => {
    if (esTarjetaClave(o.key)) onIrATarjeta?.(o.key.toUpperCase(), o.mesResumen || o.periodo);
    else { if (o.periodo !== selKey) setSelKey(o.periodo); setDetalleFijo(o.key); }
  };
  const guardarVenc = async (key, v) => { await saveData({ ...appData, vencimientos: { ...vencimientos, [key]: v } }); setEditVenc(null); };
  const quitarVenc = async (key) => { const nx = { ...vencimientos }; delete nx[key]; await saveData({ ...appData, vencimientos: nx }); setEditVenc(null); };

  const agregarMovimientoAhorro = async ({ tipo, monto, descripcion }) => {
    await saveData({ ...appData, ahorroMovimientos: [{ id: uid(), fecha: hoy(), tipo, monto, descripcion }, ...ahorroMovimientos] });
    setFormAhorro(null);
  };
  const borrarMovimientoAhorro = async (id) => { await saveData({ ...appData, ahorroMovimientos: ahorroMovimientos.filter(m => m.id !== id) }); };

  const updateField = (section, field, value) => {
    const base = { ingresos: mesEdit.ingresos, gastos: mesEdit.gastos };
    setEdit({ key: selKey, data: { ...base, [section]: { ...base[section], [field]: value } } });
  };
  const toggleRecurrente = async (key) => {
    const newRec = { ...recurrentes };
    if (recurrentes[key] !== undefined) delete newRec[key]; else newRec[key] = n(mesEdit.gastos[key]) || 0;
    await saveData({ ...appData, gastosRecurrentes: newRec });
  };
  const updateRecurrente = async (key, value) => {
    if (!recurrentes[key]) return;
    await saveData({ ...appData, gastosRecurrentes: { ...recurrentes, [key]: n(value) } });
  };
  // Sueldo de Julieta recurrente: cobra siempre lo mismo, se puede adelantar la carga de los meses que vienen.
  const sueldoRecurrente = n(ajustes.sueldoJulieta) > 0;
  const toggleSueldoRecurrente = () => saveData({ ...appData, ajustes: { ...ajustes, sueldoJulieta: sueldoRecurrente ? 0 : n(mesEdit.ingresos.julieta) } });
  const updateSueldo = (v) => { updateField('ingresos', 'julieta', v); if (sueldoRecurrente) saveData({ ...appData, ajustes: { ...ajustes, sueldoJulieta: n(v) } }); };

  const agregarFijo = async () => {
    if (!nuevoFijo || !nuevoFijo.label.trim()) return;
    const f = { id: 'f' + uid(), label: nuevoFijo.label.trim(), icon: nuevoFijo.icon || '📌' };
    await saveData({ ...appData, ajustes: { ...ajustes, fijosExtra: [...extras, f] } });
    setNuevoFijo(null);
  };
  const quitarFijo = async (f) => {
    if (!f || !window.confirm(`¿Quitar el gasto fijo "${f.label}"? Deja de sumar en todos los meses (los importes cargados quedan guardados).`)) return;
    await saveData({ ...appData, ajustes: { ...ajustes, fijosExtra: extras.filter(x => x.id !== f.id) } });
  };
  const claveDetalle = (k, key) => `${k}|${key}`;
  const mesRel = d => mesDesplazado(selKey, d);
  const itemsDetalle = (key) => detalleFijos[claveDetalle(selKey, key)] || [];
  const guardarDetalle = (key, items) => {
    const nx = { ...detalleFijos }; if (items.length) nx[claveDetalle(selKey, key)] = items; else delete nx[claveDetalle(selKey, key)];
    return saveData({ ...appData, detalleFijos: nx });
  };

  const save = async () => {
    setSaving(true);
    const newRec = { ...recurrentes };
    claves.forEach(k => { if (recurrentes[k] !== undefined) newRec[k] = n(mesEdit.gastos[k]); });
    const ok = await saveData({ ...appData, monthly: { ...allData, [selKey]: { ingresos: mesEdit.ingresos, gastos: mesEdit.gastos } }, gastosRecurrentes: newRec });
    setSaving(false);
    if (ok) { setEdit(null); setSavedOk(true); setTimeout(() => setSavedOk(false), 3000); }
  };

  // ── historial (el cierre guardado manda sobre el recálculo) ──
  const savedKeys = Object.keys(allData).sort();
  const filaHist = (k) => {
    const c = (appData.cierres || {})[k];
    if (c) return { ing: c.resultado.ingresos, gas: c.resultado.gastos, egresos: c.resultado.gastos, saldo: c.resultado.saldo, frozen: true };
    const r = calcularResultadoMensual({ appData, zapiaData, tarjetasData, mesKey: k });
    return { ing: r.ingresos.total, gas: r.gastos.total, egresos: r.gastos.total, saldo: r.saldo };
  };
  const chartData = savedKeys.slice(-6).map(k => { const t = filaHist(k); return { mes: fmtKey(k).split(' ')[0].substring(0,3), Ingresos: t.ing, Gastos: t.gas, Saldo: Math.max(0, t.saldo) }; });
  let rAcum = 0;
  const ahorroChart = [...ahorroMovimientos].sort((a,b) => String(a.fecha).localeCompare(String(b.fecha))).map(m => {
    rAcum += m.tipo === 'retiro' ? -n(m.monto) : n(m.monto);
    return { mes: m.fecha.split('-').reverse().slice(0,2).join('/'), 'Ahorro': rAcum };
  });
  const histRows = savedKeys.map(k => ({ k, ...filaHist(k) })).reverse();

  const btnBg = savedOk ? 'bg-positive' : syncStatus==='error' ? 'bg-negative' : saving||syncing ? 'bg-muted-light' : 'bg-tab-tarjetas';
  const btnTx = savedOk ? '✓  Guardado y sincronizado' : syncStatus==='error' ? '✗  No se pudo sincronizar — reintentá' : saving||syncing ? '☁️  Guardando...' : '💾  Guardar importes y sincronizar';
  const meta = n(metaAhorro);
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

      {backendInfo !== null && backendInfo !== undefined && !/^7\./.test(String(backendInfo)) && (
        <div className="mb-3 rounded-xl bg-accent-soft border border-[#E9BE8F] px-3.5 py-2.5 text-[11px] text-accent-strong leading-relaxed">
          ⚠️ El Apps Script publicado no es la v7.0{backendInfo ? ` (es la ${backendInfo})` : ''}: las tablas nuevas, los encabezados de Control y los movimientos provisorios no funcionan hasta actualizarlo. Pegá <strong>apps_script_v7.js</strong> en Apps Script y publicá una versión nueva.
        </div>
      )}

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
          {/* A. Disponibilidad familiar: saldos REALES declarados. No suma ingresos, transferencias ni sueldo pendiente. */}
          <div className="bg-ink text-white rounded-2xl px-5 py-4 mb-3.5 shadow-md">
            <div className="text-[11px] font-bold uppercase tracking-wide opacity-80">Disponibilidad familiar{esMesActual ? '' : ' (al cierre del mes)'}</div>
            <div className="text-[34px] font-extrabold tracking-tight tabular-nums mt-1">{(disp.uala || disp.efectivo) ? $$(disp.total) : '—'}</div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-white/10 rounded-lg px-3 py-2"><div className="text-[10px] opacity-80">Saldo real en Uala{disp.uala ? ` · ${fmtDate(new Date(disp.uala.fecha+'T12:00:00'))}` : ''}</div><div className="text-[16px] font-extrabold tabular-nums">{disp.uala ? $$(disp.uala.valor) : '—'}</div></div>
              <div className="bg-white/10 rounded-lg px-3 py-2"><div className="text-[10px] opacity-80">Efectivo real{disp.efectivo ? ` · ${fmtDate(new Date(disp.efectivo.fecha+'T12:00:00'))}` : ''}</div><div className="text-[16px] font-extrabold tabular-nums">{disp.efectivo ? $$(disp.efectivo.valor) : '—'}</div></div>
            </div>
            <div className="text-[10px] opacity-70 mt-2 leading-relaxed">Es plata real declarada, no ganancia. No incluye el sueldo previsto ni lo estimado.</div>
          </div>

          {/* A2. Cobertura del mes siguiente: solo lo que vence ese mes, restando disponibilidad real y sueldo previsto */}
          {esMesActual && (() => {
            const c = cobertura, mn = k => fmtKey(k).split(' ')[0].toLowerCase(), sp = c.sueldoPrevisto;
            const Fila = ({ signo, label, sub, valor, cls }) => (
              <div className="flex justify-between items-start gap-3 px-4 py-2 border-t border-border-soft">
                <div className="min-w-0">
                  <div className="text-[13px] text-ink font-semibold">{signo ? <span className="text-muted-light mr-1">{signo}</span> : null}{label}</div>
                  {sub && <div className="text-[11px] text-muted-light leading-snug">{sub}</div>}
                </div>
                <span className={`text-[13px] font-bold tabular-nums shrink-0 ${cls || 'text-ink'}`}>{valor}</span>
              </div>
            );
            return (
              <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
                <div className="bg-tab-principal text-white px-4 py-2.5 font-bold text-[13px] flex justify-between">
                  <span>🧭 Cobertura de {mn(c.mes)}</span><span className="text-[11px] opacity-80 font-normal">solo lo que vence en {mn(c.mes)}</span>
                </div>
                <Fila label={`Obligaciones de ${mn(c.mes)}`} valor={$$(c.obligaciones.total)}
                  sub={[c.obligaciones.definitivo > 0 && `definitivas ${$$(c.obligaciones.definitivo)}`, c.obligaciones.temporal > 0 && `temporales ${$$(c.obligaciones.temporal)}`, c.obligaciones.estimado > 0 && `estimadas ${$$(c.obligaciones.estimado)}`].filter(Boolean).join(' · ') || 'No hay obligaciones cargadas para ese mes'}/>
                <Fila signo="−" label="Disponibilidad real" valor={$$(c.disponible)} cls="text-positive"
                  sub={`Uala ${disp.uala ? $$(disp.uala.valor) : '—'} + efectivo ${disp.efectivo ? $$(disp.efectivo.valor) : '—'} (declarados)`}/>
                <Fila signo="−" label={`Sueldo previsto de Julieta (${mn(sp.mesSueldo)})`} valor={sp.monto > 0 ? $$(sp.monto) : '—'} cls="text-muted"
                  sub={sp.estado === 'cobrado' ? `Se cobró el ${fmtDate(new Date(sp.fechaCobro+'T12:00:00'))}; va a la cuenta ICBC, no está en la disponibilidad` : `Todavía no cobrado: se cobra el ${fmtDate(new Date(sp.fechaCobro+'T12:00:00'))}. No es dinero disponible hoy`}/>
                <div className={`flex justify-between items-center px-4 py-3 border-t-2 ${c.alcanza ? 'bg-positive-soft border-[#9AE6B4]' : 'bg-negative-soft border-[#F5B4A8]'}`}>
                  <span className={`text-[13px] font-extrabold ${c.alcanza ? 'text-positive' : 'text-negative'}`}>{c.alcanza ? '✓ Alcanza · sobrarían' : '⚠️ Faltarían'}</span>
                  <span className={`text-xl font-extrabold tabular-nums ${c.alcanza ? 'text-positive' : 'text-negative'}`}>{$$(c.alcanza ? c.balance : c.falta)}</span>
                </div>
                {c.items.length > 0 && (
                  <>
                    <button onClick={() => setVerCob(v => !v)} className="w-full px-4 py-2 border-none border-t border-border-soft bg-paper text-[11px] font-bold text-muted text-left cursor-pointer touch-manipulation">
                      {verCob ? '▲' : '▼'} Qué vence en {mn(c.mes)} ({c.items.length})
                    </button>
                    {verCob && c.items.map(o => <ObligacionRow key={o.id} o={o} etiquetas={etiquetas} onPagar={marcarPago} onDeshacer={deshacerPago} onAbrir={abrirObligacion}/>)}
                  </>
                )}
                <div className="px-4 py-2 text-[10px] text-muted-light bg-paper border-t border-border-soft leading-relaxed">No incluye meses posteriores ni lo vencido de meses anteriores. Lo temporal y lo estimado se reemplazan por el resumen definitivo cuando llega.</div>
              </div>
            );
          })()}

          {/* A3. Vencidas e impagas de meses anteriores: bloque aparte, no entra en la cobertura */}
          {esMesActual && ob.vencidasAnteriores.length > 0 && (
            <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm border-[1.5px] border-[#F5B4A8]">
              <button onClick={() => setVerVencAnt(v => !v)} className="w-full flex justify-between items-center gap-3 px-4 py-3 border-none bg-negative-soft cursor-pointer text-left touch-manipulation">
                <div>
                  <div className="text-[13px] font-extrabold text-negative">⚠️ Vencidas de meses anteriores {verVencAnt ? '▲' : '▼'}</div>
                  <div className="text-[11px] text-negative/80">{ob.vencidasAnteriores.length} impaga{ob.vencidasAnteriores.length > 1 ? 's' : ''} · tocá para ver cuáles son</div>
                </div>
                <span className="text-xl font-extrabold tabular-nums text-negative">{$$(ob.totales.vencidoAnterior)}</span>
              </button>
              {verVencAnt && ob.vencidasAnteriores.map(o => <ObligacionRow key={o.id} o={o} etiquetas={etiquetas} onPagar={marcarPago} onDeshacer={deshacerPago} onAbrir={abrirObligacion}/>)}
            </div>
          )}

          {/* B. Ingresos familiares */}
          <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
            <div className="bg-positive text-white px-4 py-2.5 font-bold text-[13px]">💵 Ingresos familiares</div>
            <div className="flex items-center px-4 py-3 border-b border-border-soft">
              <span className="text-lg mr-2.5">👩</span>
              <div className="flex-1">
                <div className="text-[13px] text-ink font-medium">Sueldo de Julieta</div>
                <div className="text-[11px] text-muted-light">
                  {situ.ingresos.sueldo.estado === 'cobrado' ? `Cobrado el ${fmtDate(new Date(situ.ingresos.sueldo.fechaCobro+'T12:00:00'))}` : `Pendiente de cobro · se cobra el ${fmtDate(new Date(situ.ingresos.sueldo.fechaCobro+'T12:00:00'))} (último día hábil)`}
                  {sueldoRecurrente ? ' · 🔁 recurrente' : ''}
                </div>
              </div>
              <span className={`text-base font-extrabold tabular-nums ${situ.ingresos.sueldo.estado==='cobrado'?'text-positive':'text-muted'}`}>{n(mesEdit.ingresos.julieta) > 0 ? $$(n(mesEdit.ingresos.julieta)) : '—'}</span>
            </div>
            <button onClick={() => setVerUala(v => !v)} className="w-full flex justify-between items-center px-4 py-3 bg-positive-soft border-none cursor-pointer text-left touch-manipulation">
              <div className="pr-2">
                <div className="text-[13px] text-positive font-semibold">👨 Germán · saldo de Uala {verUala ? '▲' : '▼'}</div>
                <div className="text-[11px] text-muted-light">{disp.uala ? `Declarado por Julieta el ${fmtDate(new Date(disp.uala.fecha+'T12:00:00'))}, tal cual. Tocá para ver la conciliación.` : 'Todavía sin declarar. Tocá para ver el detalle.'}</div>
              </div>
              <span className="text-base font-extrabold tabular-nums text-positive">{disp.uala ? $$(disp.uala.valor) : '—'}</span>
            </button>
            {verUala && (
              <div className="border-t border-border-soft">
                <ConciliacionUalaDetalle conciliacion={situ.conciliacionUala}/>
                <button onClick={() => setTab('control')} className="w-full py-2 border-none border-t border-border-soft bg-paper text-[12px] font-bold text-tab-tarjetas cursor-pointer touch-manipulation">Ver todo en Control ›</button>
              </div>
            )}
          </div>

          {/* C. Gastos fijos y obligaciones: vencidas, pendientes y próximos compromisos estimados */}
          <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
            <div className="bg-negative text-white px-4 py-2.5 font-bold text-[13px] flex justify-between">
              <span>📤 Gastos fijos y obligaciones</span><span className="text-[11px] opacity-80 font-normal">por vencimiento</span>
            </div>
            {esMesActual ? (
              <>
                <SeccionObligaciones titulo={`Vencen en ${fmtKey(currentKey).split(' ')[0].toLowerCase()}`} color="text-ink" lista={ob.delMes} total={ob.totales.delMes} nota="Incluye lo vencido este mes que sigue impago. Lo de meses anteriores está en su bloque aparte y lo del mes siguiente, en la cobertura." etiquetas={etiquetas} onPagar={marcarPago} onDeshacer={deshacerPago} onAbrir={abrirObligacion}/>
                <SeccionObligaciones titulo="Más adelante (fuera de la cobertura)" color="text-muted" lista={ob.masAdelante} total={ob.totales.masAdelante} nota="Meses posteriores al siguiente: no cuentan en la cobertura ni en el resultado." etiquetas={etiquetas} onPagar={marcarPago} onDeshacer={deshacerPago} onAbrir={abrirObligacion}/>
                {ob.delMes.length + ob.masAdelante.length + ob.delMesSiguiente.length + ob.vencidasAnteriores.length === 0 && (
                  <div className="px-4 py-3 text-[12px] text-muted-light">No hay obligaciones con vencimiento cargado. Poné la fecha (📅) en "Editar importes y vencimientos".</div>
                )}
              </>
            ) : (
              <SeccionObligaciones titulo={`Obligaciones de ${fmtKey(selKey)}`} color="text-ink" lista={obligacionesMes} total={obligacionesMes.reduce((s,o) => s + o.monto, 0)} etiquetas={etiquetas} onPagar={marcarPago} onDeshacer={deshacerPago} onAbrir={abrirObligacion}/>
            )}
            {sinFecha.length > 0 && (
              <div className="px-4 py-2 text-[11px] text-accent-strong bg-[#FFFBF5] border-t border-border-soft">⚠️ Sin fecha de vencimiento: {sinFecha.map(k => etiquetas[k] || k).join(', ')}. Cargá el 📅 para que aparezcan como obligaciones.</div>
            )}
            {ob.pagadas.length > 0 && (
              <div className="border-t border-border-soft">
                <button onClick={() => setVerPagadas(v => !v)} className="w-full px-4 py-2 border-none bg-white text-[11px] font-bold text-muted text-left cursor-pointer touch-manipulation">✓ Pagadas ({ob.pagadas.length}) {verPagadas ? '▲' : '▼'}</button>
                {verPagadas && ob.pagadas.slice(0, 15).map(o => <ObligacionRow key={o.id} o={o} etiquetas={etiquetas} onPagar={marcarPago} onDeshacer={deshacerPago} onAbrir={abrirObligacion}/>)}
              </div>
            )}
          </div>

          {/* D. Resultado mensual: económico, distinto de la disponibilidad */}
          <div className={`rounded-2xl px-4 py-3 mb-3.5 border-2 ${res.saldo>=0?'bg-positive-soft border-[#68D391]':'bg-negative-soft border-[#FC8181]'}`}>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{res.saldo>=0?'Resultado mensual · a favor':'Resultado mensual · déficit'}</div>
                <div className="text-[11px] text-muted mt-0.5">Ingresos {$$(res.ingresos.total)} − gastos {$$(res.gastos.total)}{meta>0 ? ` · meta ${$$(meta)}` : ''}</div>
              </div>
              <div className={`text-[26px] font-extrabold tracking-tight tabular-nums ${res.saldo>=0?'text-positive':'text-negative'}`}>{res.ingresos.total===0&&res.gastos.total===0 ? '—' : neg(res.saldo)}</div>
            </div>
            <div className="text-[10px] text-muted-light mt-1.5 leading-relaxed">Sueldo + bruto Uber/DiDi − gastos de Zapia − tarjetas del mes − fijos. No es la disponibilidad ni cuenta transferencias, saldos ni lo estimado.</div>
          </div>

          {/* E. Ahorros (cargados a mano) */}
          <button onClick={() => setTab('ahorros')} className="w-full rounded-lg px-4 py-2.5 mb-3.5 bg-gradient-to-r from-positive-soft to-[#B2F5EA] border-[1.5px] border-[#81E6D9] flex justify-between items-center cursor-pointer touch-manipulation text-left">
            <span className="text-[13px] font-semibold text-[#234E52]">💰 Ahorro (cargado a mano) ›</span>
            <span className="text-lg font-extrabold text-[#2B7A78] tabular-nums">{$$(calcularAhorroManual(ahorroMovimientos))}</span>
          </button>

          {/* Importes del mes (edición): se guarda con el botón */}
          <button onClick={() => setEditarImportes(v => !v)} className="w-full py-2.5 mb-3.5 border-[1.5px] border-border rounded-xl bg-white text-[13px] font-bold text-muted cursor-pointer touch-manipulation">
            ✏️ {editarImportes ? 'Ocultar' : 'Editar'} importes y vencimientos de {fmtKey(selKey)}
          </button>
          {editarImportes && (
            <>
              <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
                <div className="bg-positive text-white px-4 py-2.5 font-bold text-[13px]">👩 Sueldo de Julieta</div>
                <div className="flex items-center px-4 py-2.5">
                  <div className="flex-1 text-[11px] text-muted-light">Cobra siempre lo mismo: con 🔁 se completa solo en los meses que no cargues otro importe.</div>
                  <button onClick={toggleSueldoRecurrente} className={`border-none rounded-md cursor-pointer text-[13px] px-2 py-1 mr-1.5 touch-manipulation ${sueldoRecurrente?'bg-accent-soft text-accent-strong':'bg-border-soft text-muted-light'}`}>🔁</button>
                  <span className="text-muted-light text-[13px] mr-1">$</span>
                  <MoneyInput width={110} value={mesEdit.ingresos.julieta} onChange={updateSueldo}/>
                </div>
              </div>
          <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
            <div className="bg-negative text-white px-4 py-2.5 font-bold text-[13px] flex justify-between">
              <span>📤 Gastos fijos</span><span className="text-[11px] opacity-80 font-normal">tocá uno para ver su detalle</span>
            </div>
            <div className="px-4 py-2 bg-[#EBF8FF] border-b border-[#BEE3F8] text-[11px] text-tab-tarjetas">
              💳 Las tarjetas de {fmtKey(selKey)} son los gastos de ese mes: se pagan el mes siguiente.
            </div>
            {filasFijos.map((g) => {
              const isRec  = recurrentes[g.key] !== undefined;
              const esTarjeta = g.key === 'icbc' || g.key === 'bna';
              const fromCard = esTarjeta && (totalesTarjetas[selKey]?.[g.key] !== undefined);
              const v = vencimientos[g.key];
              const nDetalle = itemsDetalle(g.key).length;
              const abrir = () => esTarjeta ? onIrATarjeta?.(g.key.toUpperCase(), mesResumen) : setDetalleFijo(g.key);
              return (
                <div key={g.key}>
                  <div className={`flex items-center px-3 py-2.5 border-b border-border-soft ${fromCard?'bg-[#EBF8FF]':isRec?'bg-[#FFFBF5]':''}`}>
                    <span className="text-base mr-2 min-w-[22px]">{g.icon}</span>
                    <div className="flex-1 min-w-0">
                      <button onClick={abrir} className="border-none bg-transparent p-0 text-left cursor-pointer touch-manipulation">
                        <span className="text-[13px] text-ink font-semibold underline decoration-dotted underline-offset-2">{g.label} ›</span>
                      </button>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {fromCard && <span className="text-[10px] bg-[#BEE3F8] text-tab-tarjetas rounded px-1.5 py-0.5 font-bold">💳 resumen de {fmtKey(mesResumen).split(' ')[0]}</span>}
                        {esTarjeta && !fromCard && <span className="text-[10px] bg-border-soft text-muted rounded px-1.5 py-0.5 font-bold">sin resumen de {fmtKey(mesResumen).split(' ')[0]}</span>}
                        {!esTarjeta && isRec && <span className="text-[10px] bg-accent-soft text-accent-strong rounded px-1.5 py-0.5 font-bold">🔁 fijo</span>}
                        {nDetalle > 0 && <span className="text-[10px] bg-border-soft text-muted rounded px-1.5 py-0.5 font-bold">📝 {nDetalle}</span>}
                        {g.hint && !fromCard && !isRec && <span className="text-[10px] text-muted-light">{g.hint}</span>}
                      </div>
                    </div>
                    <button onClick={() => setEditVenc(editVenc===g.key?null:g.key)} title="Fecha de vencimiento"
                      className={`border-none rounded-md cursor-pointer text-[11px] font-bold px-1.5 py-1 mr-1 touch-manipulation ${v?'bg-ink text-white':'bg-border-soft text-muted-light'}`}>
                      {v ? `📅 ${v.dia}${v.mesSiguiente?'↗':''}` : '📅'}
                    </button>
                    {!fromCard && (
                      <button onClick={() => toggleRecurrente(g.key)} title={isRec?'Quitar recurrente':'Marcar como recurrente'}
                        className={`border-none rounded-md cursor-pointer text-[13px] px-1.5 py-1 mr-1 touch-manipulation ${isRec?'bg-accent-soft text-accent-strong':'bg-border-soft text-muted-light'}`}>🔁</button>
                    )}
                    <div className="flex items-center gap-1">
                      <span className="text-muted-light text-[13px]">$</span>
                      {fromCard ? (
                        <div className="w-[100px] px-2 py-1.5 rounded-lg text-sm text-right border-[1.5px] border-[#90CDF4] bg-[#EBF8FF] text-tab-tarjetas font-bold tabular-nums">
                          {ocultar ? '••••' : new Intl.NumberFormat('es-AR').format(n(mesEdit.gastos[g.key]))}
                        </div>
                      ) : (
                        <MoneyInput width={100} value={mesEdit.gastos[g.key]}
                          border={`1.5px solid ${isRec?'#E9BE8F':'#E2DDD3'}`}
                          onChange={val => { updateField('gastos', g.key, val); if(isRec) updateRecurrente(g.key, val); }}/>
                      )}
                    </div>
                    {g.extra && <button onClick={()=>quitarFijo(extras.find(x=>x.id===g.key))} title="Quitar este gasto fijo" className="border-none bg-none cursor-pointer text-border text-lg ml-1 touch-manipulation">×</button>}
                  </div>
                  {editVenc===g.key && (
                    <EditorVencimiento valor={v} defectoSiguiente={!!VENCIMIENTO_MES_SIGUIENTE_DEFECTO[g.key]} mesKey={selKey}
                      onSave={val => guardarVenc(g.key, val)} onClear={() => quitarVenc(g.key)}/>
                  )}
                </div>
              );
            })}
            {nuevoFijo ? (
              <div className="px-4 py-3 border-b border-border-soft bg-[#FAFAFA]">
                <div className="flex gap-2 mb-2">
                  <input value={nuevoFijo.icon} onChange={e=>setNuevoFijo({ ...nuevoFijo, icon:e.target.value })} className="w-12 p-2 rounded-lg border-[1.5px] border-border text-lg text-center outline-none"/>
                  <input value={nuevoFijo.label} onChange={e=>setNuevoFijo({ ...nuevoFijo, label:e.target.value })} placeholder="Nombre del gasto fijo (ej: Gimnasio)"
                    className="flex-1 px-3 py-2 rounded-lg border-[1.5px] border-border text-sm outline-none bg-white"/>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>setNuevoFijo(null)} className="flex-1 py-2 border-[1.5px] border-border rounded-lg bg-white text-muted font-semibold text-xs touch-manipulation">Cancelar</button>
                  <button onClick={agregarFijo} disabled={!nuevoFijo.label.trim()} className={`flex-[2] py-2 border-none rounded-lg text-white font-bold text-xs touch-manipulation ${nuevoFijo.label.trim()?'bg-negative':'bg-border'}`}>Agregar gasto fijo</button>
                </div>
              </div>
            ) : (
              <button onClick={()=>setNuevoFijo({ label:'', icon:'📌' })} className="w-full py-2.5 border-none border-b border-border-soft bg-white text-[12px] font-bold text-muted cursor-pointer touch-manipulation">➕ Agregar gasto fijo</button>
            )}
            <div className="flex justify-between items-center px-4 py-2.5 bg-paper border-t-2 border-border-soft">
              <span className="text-[13px] font-bold text-negative">Total gastos fijos</span>
              <span className="text-base font-extrabold text-negative tabular-nums">{$$(totalFijos(mesEdit.gastos))}</span>
            </div>
          </div>


              <button onClick={save} disabled={saving||syncing}
                className={`w-full py-3.5 border-none rounded-xl cursor-pointer font-bold text-[15px] text-white shadow-md transition-colors mb-1 touch-manipulation ${btnBg}`}>{btnTx}</button>
              <p className="text-center text-[11px] text-muted-light mt-1.5 mb-3.5">Se confirma contra Google Drive antes de avisar · 🔁 = recurrente · 💳 = cargado desde Gastos</p>
            </>
          )}

          {detalleFijo && (
            <DetalleFijoModal titulo={etiquetas[detalleFijo] || detalleFijo} mesLabel={fmtKey(selKey)}
              items={itemsDetalle(detalleFijo)} montoFijo={n(mesEdit.gastos[detalleFijo])} categorias={appData.categories || {}}
              hayAnterior={(detalleFijos[claveDetalle(mesRel(-1), detalleFijo)] || []).length > 0}
              onSave={items => guardarDetalle(detalleFijo, items)}
              onUsarSuma={total => { updateField('gastos', detalleFijo, String(Math.round(total))); if (recurrentes[detalleFijo] !== undefined) updateRecurrente(detalleFijo, String(Math.round(total))); }}
              onCopiarAnterior={() => guardarDetalle(detalleFijo, (detalleFijos[claveDetalle(mesRel(-1), detalleFijo)] || []).map(i => ({ ...i, id: uid() })))}
              onClose={() => setDetalleFijo(null)}/>
          )}
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
                  {histRows.map(({k,ing,egresos,saldo,frozen},i)=>(
                    <tr key={k} onClick={()=>{setSelKey(k);setEdit(null);setTab('mes');}} className={`cursor-pointer ${i%2===0?'bg-white':'bg-paper'}`}>
                      <td className="px-2.5 py-2.5 font-semibold text-ink">{fmtKey(k)}{frozen&&<span title="Cierre guardado" className="ml-1">🔒</span>}{k===currentKey&&<span className="ml-1 text-[9px] bg-tab-tarjetas text-white rounded px-1 py-0.5">actual</span>}</td>
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
            <div className="text-[11px] font-bold uppercase tracking-wide text-[#234E52] mb-1.5">Ahorro total (solo lo que cargás a mano)</div>
            <div className="text-[40px] font-extrabold text-[#2B7A78] tracking-tight tabular-nums">
              {$$(calcularAhorroManual(ahorroMovimientos))}
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
                  <Line type="monotone" dataKey="Ahorro" stroke="#2B7A78" strokeWidth={2.5} dot={{fill:'#2B7A78',r:4}}/>
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

        </>
      )}

      {tab==='control' && (
        <Control embebido appData={appData} saveData={saveData} zapiaData={zapiaData} tarjetasData={tarjetasData} tarjetasProv={tarjetasProv} onRefresh={onRefresh} mesKey={selKey}/>
      )}

      {tab==='cierre' && (
        <CierreReal embebido appData={appData} saveData={saveData} zapiaData={zapiaData} tarjetasData={tarjetasData} tarjetasProv={tarjetasProv} onRefresh={onRefresh} mesKey={selKey}/>
      )}
    </div>
  );
}
