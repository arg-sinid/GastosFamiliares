import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import {
  n, $$, fmtK, getKey, fmtKey, monthOpts, hoy, uid, fmtDate, VENCIMIENTO_MES_SIGUIENTE_DEFECTO, desfaseTarjetas, mesDesplazado,
  calcularTotalesTarjetas, ultimoSaldoDelMes, simularCaja, gastosZapiaDe, calcularAhorroManual, listarVencimientos,
  fechaVencimiento, ultimoDiaHabil, clavesFijos,
  calcularResultadoMensual, calcularTotalesMes, resolverMes,
} from '../utils.js';
import { MoneyInput, CategoriaModal } from '../components/ui.jsx';
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

// Plata para los vencimientos: qué hay hoy, qué se paga y cuándo, y cuánto falta juntar. Los más cercanos primero.
function CajaCard({ caja, hoyStr, etiquetas, mesActual, onPagar, pagadosManual, onDeshacer }) {
  const dias = f => Math.round((new Date(f+'T12:00:00') - new Date(hoyStr+'T12:00:00')) / 86400000);
  const txtDias = f => { const d = dias(f); return d === 0 ? 'vence hoy' : d === 1 ? 'mañana' : `en ${d} días`; };
  const fd = f => fmtDate(new Date(f+'T12:00:00'));
  const neg = v => v < 0 ? `-${$$(Math.abs(v))}` : $$(v);
  const p = caja.grupos[0], ok = caja.alcanza;
  const nombre = it => etiquetas[it.key] || it.key;
  return (
    <div className={`rounded-2xl overflow-hidden mb-3.5 border-2 shadow-sm ${ok?'border-[#68D391]':'border-[#FC8181]'}`}>
      <div className="bg-ink text-white px-4 py-2.5 flex justify-between items-center">
        <span className="font-bold text-[13px]">📅 Vencimientos</span>
        <span className="text-[11px] opacity-80">próximo {fd(p.fecha)} · {txtDias(p.fecha)}</span>
      </div>
      <div className={`px-4 py-3.5 ${ok?'bg-positive-soft':'bg-negative-soft'}`}>
        {ok ? (
          <>
            <div className="text-[17px] font-extrabold text-positive">✓ Alcanza para pagar todo lo que vence</div>
            <div className="text-[13px] font-bold text-positive mt-1">Sobran {$$(caja.sobra)} después del último vencimiento</div>
          </>
        ) : (
          <>
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Falta juntar</div>
            <div className="text-[30px] font-extrabold tracking-tight tabular-nums text-negative">{$$(caja.falta)}</div>
            <div className="text-[12px] font-semibold text-negative">Se queda corto el {fd(caja.primeraFalta.fecha)} al pagar {nombre(caja.primeraFalta)}</div>
          </>
        )}
        <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
          <div className="bg-white/70 rounded-lg px-2.5 py-2">
            <div className="text-muted">Saldo de la Uala hoy</div>
            <div className={`text-[15px] font-extrabold tabular-nums ${caja.ualaHoy<0?'text-negative':'text-ink'}`}>{neg(caja.ualaHoy)}</div>
          </div>
          <div className="bg-white/70 rounded-lg px-2.5 py-2">
            <div className="text-muted">Sueldo ya cobrado sin usar</div>
            <div className="text-[15px] font-extrabold tabular-nums text-ink">{$$(caja.sueldoCobrado)}</div>
          </div>
        </div>
        {caja.proximoCobro && (
          <div className="text-[11px] text-muted mt-2 leading-relaxed">
            💼 Julieta cobra {$$(caja.proximoCobro.monto)} el {fd(caja.proximoCobro.fechaCobro)} (último día hábil de {fmtKey(caja.proximoCobro.mes).split(' ')[0]}): sirve para pagar desde esa fecha, no antes.
          </div>
        )}
      </div>
      <div className="bg-white">
        {caja.grupos.map((g, i) => (
          <div key={g.fecha} className={`px-4 py-2.5 ${i>0?'border-t border-border-soft':''}`}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[12px] font-bold text-ink">{fd(g.fecha)} <span className="text-muted-light font-normal">· {txtDias(g.fecha)}</span></span>
              <span className="text-[12px] font-extrabold text-negative tabular-nums">{$$(g.total)}</span>
            </div>
            {g.items.map(it => (
              <div key={it.id} className="flex items-center gap-2 py-1 pl-2">
                <div className="flex-1 text-[12px] text-ink">
                  {nombre(it)}
                  {it.mesKey !== mesActual && <span className="text-[10px] text-muted-light"> · de {fmtKey(it.mesKey).split(' ')[0]}</span>}
                </div>
                <span className="text-[12px] text-muted tabular-nums">{$$(it.monto)}</span>
                <button onClick={()=>onPagar(it)} className="border-none bg-positive-soft text-positive rounded-lg px-2 py-1 text-[11px] font-bold cursor-pointer touch-manipulation">✓ Pagado</button>
              </div>
            ))}
            <div className={`flex justify-between text-[11px] mt-1 pl-2 font-semibold ${g.balance>=0?'text-positive':'text-negative'}`}>
              <span>Acumulado {$$(g.acumulado)}</span><span>{g.balance>=0 ? `queda ${$$(g.balance)}` : `faltan ${$$(Math.abs(g.balance))}`}</span>
            </div>
          </div>
        ))}
        {pagadosManual.length > 0 && (
          <div className="px-4 py-2 border-t border-border-soft bg-paper">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1">Marcados como pagados</div>
            {pagadosManual.map(it => (
              <div key={it.id} className="flex items-center gap-2 text-[11px] text-muted">
                <span className="flex-1">✓ {nombre(it)} · vencía {fd(it.fecha)}</span>
                <span className="tabular-nums">{$$(it.monto)}</span>
                <button onClick={()=>onDeshacer(it)} className="border-none bg-border-soft rounded-md px-1.5 py-0.5 text-[10px] text-muted cursor-pointer touch-manipulation">deshacer</button>
              </div>
            ))}
          </div>
        )}
        <div className="px-4 py-2 bg-paper border-t border-border-soft text-[10px] text-muted-light leading-relaxed">
          Cada pago sale primero del sueldo ya cobrado y después de la Uala. Aparecen desde el 25 del mes anterior a su fecha y se ocultan al pagarse. Solo cuentan los fijos con vencimiento cargado (📅).
        </div>
      </div>
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

export default function ControlGastos({ appData, saveData, zapiaData, tarjetasData, syncing, syncStatus, syncMsg, onRetry, onRefresh, usuario, metaAhorro, onOpenSettings, ocultar, onToggleOcultar, onIrATarjeta }) {
  const today      = new Date();
  const currentKey = getKey(today);

  const [selKey,   setSelKey]   = useState(currentKey);   // mes calendario actual por defecto
  const [tab,      setTab]      = useState('mes');
  const [saving,   setSaving]   = useState(false);
  const [savedOk,  setSavedOk]  = useState(false);
  const [edit,     setEdit]     = useState(null);
  const [formAhorro, setFormAhorro] = useState(null);
  const [editVenc, setEditVenc] = useState(null);
  const [detalleFijo, setDetalleFijo] = useState(null);       // clave del fijo cuyo detalle se está viendo
  const [nuevoFijo, setNuevoFijo] = useState(null);           // { label, icon } mientras se agrega un gasto fijo

  const allData     = appData.monthly            || {};
  const uberDiDi    = appData.uberDiDi           || [];
  const recurrentes = appData.gastosRecurrentes  || {};
  const dolarTarjetaMap   = appData.dolarTarjeta || {};
  const ahorroMovimientos = appData.ahorroMovimientos || [];
  const saldoJulieta = appData.saldoJulieta || {};

  // Los resúmenes de tarjeta se pagan después: con desfase 1, el Principal de noviembre usa el resumen de octubre.
  const ajustes = appData.ajustes || {};
  const claves = clavesFijos(ajustes);
  const desfase = desfaseTarjetas(ajustes);
  const mesResumen = mesDesplazado(selKey, -desfase);
  const totalesTarjetas = calcularTotalesTarjetas(tarjetasData, dolarTarjetaMap, desfase);
  const cambiarDesfase = (v) => saveData({ ...appData, ajustes: { ...(appData.ajustes || {}), tarjetaDesfase: Number(v) } });
  // Contexto único: TODAS las pantallas y la hoja Control calculan con esto.
  const ctx = { monthly:allData, gastosRecurrentes:recurrentes, totalesTarjetas, uberDiDi, zapiaData, saldoJulieta, hoyStr:hoy(), ajustes };

  const agregarMovimientoAhorro = async ({ tipo, monto, descripcion }) => {
    const nuevo = { id: uid(), fecha: hoy(), tipo, monto, descripcion };
    await saveData({ ...appData, ahorroMovimientos: [nuevo, ...ahorroMovimientos] });
    setFormAhorro(null);
  };
  const borrarMovimientoAhorro = async (id) => {
    await saveData({ ...appData, ahorroMovimientos: ahorroMovimientos.filter(m=>m.id!==id) });
  };

  const mesData = resolverMes(allData, recurrentes, totalesTarjetas, selKey, ajustes);
  const mesEdit = edit && edit.key === selKey ? edit.data : mesData;

  const saldoDecl    = ultimoSaldoDelMes(saldoJulieta, selKey);     // tal cual lo declara Julieta
  const germanIncome = saldoDecl ? saldoDecl.valor : 0;
  const tot        = calcularTotalesMes(mesEdit, germanIncome);
  const meta       = n(metaAhorro);
  const vencimientos = appData.vencimientos || {};
  const hoyStr = hoy();
  // ── Caja: vencimientos y plata para pagarlos ─────────────────────
  // Se arma con TODOS los fijos con fecha de los meses vecinos, sin importar de qué mes de Principal vienen:
  // así aparecen primero los más cercanos (p. ej. el alquiler del 10/11 antes que el del 10/12).
  const pagosFijos = appData.pagosFijos || {};
  const detalleFijos = appData.detalleFijos || {};
  const [py, pm] = selKey.split('-').map(Number);
  const mesRel = d => getKey(new Date(py, pm - 1 + d, 1));
  const resolver = k => resolverMes(allData, recurrentes, totalesTarjetas, k, ajustes);
  const gastosDe = k => k === selKey ? mesEdit.gastos : resolver(k).gastos;
  const sueldoDe = k => k === selKey ? n(mesEdit.ingresos.julieta) : n(resolver(k).ingresos.julieta);
  const lista = listarVencimientos({ vencimientos, gastosDe, meses: [mesRel(-1), selKey, mesRel(1)], pagosFijos, hoyStr, claves });
  // Gastos de Zapia que Julieta carga en modo transferencia después de su declaración: salen de la Uala.
  const gastosUala = saldoDecl ? gastosZapiaDe(zapiaData, 'Julieta', saldoDecl.fecha, hoyStr, 'transferencia') : 0;
  // El sueldo de Julieta se cobra el último día hábil: recién desde ese día sirve para pagar.
  const sueldos = [mesRel(-1), selKey, mesRel(1)].map(k => ({ mes: k, fechaCobro: ultimoDiaHabil(k), monto: sueldoDe(k) }));
  const caja = simularCaja({
    saldoDeclarado: saldoDecl ? saldoDecl.valor : null, fechaDeclaracion: saldoDecl?.fecha || '', mesKey: selKey, gastosUala, hoyStr, sueldos,
    pagados: lista.filter(i => i.pagado).map(i => ({ fecha: i.fechaPago, monto: i.monto, key: i.key })),
    pendientes: lista.filter(i => i.visible),
  });
  const mostrarCaja = selKey === currentKey && caja.filas.length > 0;
  const pagadosManual = lista.filter(i => i.manual && i.fecha >= hoyStr);
  const extras = ajustes.fijosExtra || [];
  const filasFijos = [...GASTOS_CONFIG, ...extras.map(e => ({ key: e.id, label: e.label, icon: e.icon || '📌', hint: '', extra: true }))];
  const etiquetas = Object.fromEntries(filasFijos.map(g => [g.key, g.label]));
  const marcarPago = async (it) => { await saveData({ ...appData, pagosFijos: { ...pagosFijos, [it.id]: { fecha: hoyStr } } }); };
  const deshacerPago = async (it) => { const nx = { ...pagosFijos }; delete nx[it.id]; await saveData({ ...appData, pagosFijos: nx }); };
  const guardarVenc = async (key, v) => { await saveData({ ...appData, vencimientos: { ...vencimientos, [key]: v } }); setEditVenc(null); };
  const quitarVenc = async (key) => { const nx = { ...vencimientos }; delete nx[key]; await saveData({ ...appData, vencimientos: nx }); setEditVenc(null); };

  // Sueldo de Julieta recurrente: como cobra siempre lo mismo, se puede adelantar la carga de los meses que vienen.
  const sueldoRecurrente = n(ajustes.sueldoJulieta) > 0;
  const toggleSueldoRecurrente = () => saveData({ ...appData, ajustes: { ...ajustes, sueldoJulieta: sueldoRecurrente ? 0 : n(mesEdit.ingresos.julieta) } });
  const updateSueldo = (v) => { updateField('ingresos', 'julieta', v); if (sueldoRecurrente) saveData({ ...appData, ajustes: { ...ajustes, sueldoJulieta: n(v) } }); };

  // Gastos fijos nuevos
  const agregarFijo = async () => {
    if (!nuevoFijo || !nuevoFijo.label.trim()) return;
    const f = { id: 'f' + uid(), label: nuevoFijo.label.trim(), icon: nuevoFijo.icon || '📌' };
    await saveData({ ...appData, ajustes: { ...ajustes, fijosExtra: [...extras, f] } });
    setNuevoFijo(null);
  };
  const quitarFijo = async (f) => {
    if (!window.confirm(`¿Quitar el gasto fijo "${f.label}"? Deja de sumar en todos los meses (los importes cargados quedan guardados).`)) return;
    await saveData({ ...appData, ajustes: { ...ajustes, fijosExtra: extras.filter(x => x.id !== f.id) } });
  };

  // Detalle de un fijo (en qué se gasta y a qué categoría va)
  const claveDetalle = (k, key) => `${k}|${key}`;
  const itemsDetalle = (key) => detalleFijos[claveDetalle(selKey, key)] || [];
  const guardarDetalle = (key, items) => {
    const nx = { ...detalleFijos }; if (items.length) nx[claveDetalle(selKey, key)] = items; else delete nx[claveDetalle(selKey, key)];
    return saveData({ ...appData, detalleFijos: nx });
  };

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
    claves.forEach(k => { if (recurrentes[k] !== undefined) newRec[k] = n(mesEdit.gastos[k]); });
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
  const ahorroChart = [...ahorroMovimientos].sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))).map(m => {
    rAcum += m.tipo === 'retiro' ? -n(m.monto) : n(m.monto);
    return { mes: m.fecha.split('-').reverse().slice(0,2).join('/'), 'Ahorro': rAcum };
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
          {mostrarCaja && (
            <CajaCard caja={caja} hoyStr={hoyStr} etiquetas={etiquetas} mesActual={selKey}
              onPagar={marcarPago} pagadosManual={pagadosManual} onDeshacer={deshacerPago}/>
          )}

          <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
            <div className="bg-positive text-white px-4 py-2.5 font-bold text-[13px]">💵 Ingresos familiares</div>
            <div className="px-4 py-2.5 border-b border-border-soft">
              <div className="flex items-center">
                <span className="text-lg mr-2.5">👩</span>
                <div className="flex-1">
                  <div className="text-[13px] text-ink font-medium">Sueldo de Julieta</div>
                  <div className="text-[11px] text-muted-light">Cobra el último día hábil ({fmtDate(new Date(ultimoDiaHabil(selKey)+'T12:00:00'))}): sirve para pagar desde esa fecha</div>
                </div>
                <button onClick={toggleSueldoRecurrente} title="Cobra siempre lo mismo: se completa solo en los meses que vienen"
                  className={`border-none rounded-md cursor-pointer text-[13px] px-2 py-1 mr-1.5 touch-manipulation ${sueldoRecurrente?'bg-accent-soft text-accent-strong':'bg-border-soft text-muted-light'}`}>🔁</button>
                <div className="flex items-center gap-1">
                  <span className="text-muted-light text-[13px]">$</span>
                  <MoneyInput width={110} value={mesEdit.ingresos.julieta} onChange={updateSueldo}/>
                </div>
              </div>
              {sueldoRecurrente && <div className="text-[10px] text-accent-strong mt-1 pl-8">🔁 Se completa solo en los meses que no cargues otro importe.</div>}
            </div>
            <div className="flex justify-between items-center px-4 py-2.5 bg-positive-soft">
              <div className="pr-2">
                <div className="text-[13px] text-positive font-semibold">👨 Germán · saldo de la Uala</div>
                <div className="text-[11px] text-muted-light">
                  {saldoDecl
                    ? <>Declarado por Julieta el {fmtDate(new Date(saldoDecl.fecha+'T12:00:00'))}: <strong>{$$(saldoDecl.valor)}</strong>{(caja.pagadoDespues>0 || caja.gastosUala>0) ? ' · hoy, después de pagos y gastos por transferencia' : ''}.</>
                    : 'Todavía sin declarar este mes: se muestra cuando Julieta cargue su saldo.'}
                </div>
              </div>
              <span className={`text-base font-extrabold tabular-nums ${caja.ualaHoy<0?'text-negative':'text-positive'}`}>{(saldoDecl || caja.ualaHoy!==0) ? (caja.ualaHoy<0?`-${$$(Math.abs(caja.ualaHoy))}`:$$(caja.ualaHoy)) : '—'}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
            <div className="bg-negative text-white px-4 py-2.5 font-bold text-[13px] flex justify-between">
              <span>📤 Gastos fijos</span><span className="text-[11px] opacity-80 font-normal">tocá uno para ver su detalle</span>
            </div>
            <div className="px-4 py-2 bg-[#EBF8FF] border-b border-[#BEE3F8] text-[11px] text-tab-tarjetas flex items-center gap-2 flex-wrap">
              <span>💳 En {fmtKey(selKey)} se pagan los resúmenes de</span>
              <select value={desfase} onChange={e=>cambiarDesfase(e.target.value)}
                className="border-[1.5px] border-[#90CDF4] rounded-md bg-white text-tab-tarjetas font-bold text-[11px] px-1.5 py-1">
                <option value={1}>el mes anterior ({fmtKey(mesDesplazado(selKey,-1)).split(' ')[0]})</option>
                <option value={0}>el mismo mes ({fmtKey(selKey).split(' ')[0]})</option>
              </select>
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
              <span className="text-base font-extrabold text-negative tabular-nums">{$$(tot.egresos)}</span>
            </div>
          </div>

          <div className={`rounded-2xl px-4 py-3 mb-3.5 border-2 flex justify-between items-center ${tot.saldo>=0?'bg-positive-soft border-[#68D391]':'bg-negative-soft border-[#FC8181]'}`}>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{tot.saldo>=0?'Resultado mensual · a favor':'Resultado mensual · déficit'}</div>
              <div className="text-[11px] text-muted mt-0.5">Sueldo de Julieta + saldo de la Uala − gastos fijos{meta>0&&tot.ing>0 ? ` · meta ${$$(meta)}` : ''}</div>
            </div>
            <div className={`text-[26px] font-extrabold tracking-tight tabular-nums ${tot.saldo>=0?'text-positive':'text-negative'}`}>{tot.ing===0&&tot.gas===0?'—':(tot.saldo<0?'-':'')+$$(Math.abs(tot.saldo))}</div>
          </div>

          <button onClick={save} disabled={saving||syncing}
            className={`w-full py-3.5 border-none rounded-xl cursor-pointer font-bold text-[15px] text-white shadow-md transition-colors mb-1 touch-manipulation ${btnBg}`}>
            {btnTx}
          </button>
          <p className="text-center text-[11px] text-muted-light mt-1.5">
            Se confirma contra Google Drive antes de avisar · 🔁 = recurrente · 💳 = cargado desde Gastos
          </p>

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
        <Control embebido appData={appData} saveData={saveData} zapiaData={zapiaData} onRefresh={onRefresh} mesKey={selKey}/>
      )}

      {tab==='cierre' && (
        <CierreReal embebido appData={appData} zapiaData={zapiaData} tarjetasData={tarjetasData} onRefresh={onRefresh} mesKey={selKey}/>
      )}
    </div>
  );
}
