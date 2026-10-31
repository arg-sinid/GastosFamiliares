import { useState } from 'react';
import { storage } from '../storage.js';
import {
  n, $$, hoy, getMonday, weekDates, dateStr, fmtDate, uid, esUltimoDiaMes, getKey, fmtKey, monthOpts,
  mesesAtras, agruparGastosPorCategoria, resumenAuto, resumenAutoMeses, brutoUberDiDiMes,
  vehiculoDeGasto, normPatente,
} from '../utils.js';

const SK_VEH = 'vehiculo_activo_v1';

const DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const TIPOS_TRABAJO = ['Cambio de aceite y filtros','Cubiertas','Reparación','Mantenimiento preventivo','Otro'];

// ── Ganancias (Uber / DiDi): el mecanismo de carga diaria sigue igual. Se quitó "horas trabajadas".
function BigField({ label, colorVar, value, onChange }) {
  return (
    <div className="mb-4.5">
      <div className="text-[13px] font-extrabold uppercase tracking-wide mb-2" style={{color:`var(${colorVar})`}}>{label}</div>
      <div className="flex items-center bg-white rounded-2xl border-2 px-4 py-2 transition-colors" style={{ borderColor: value ? `var(${colorVar})` : 'var(--color-border)' }}>
        <span className="text-[22px] font-bold text-muted-light mr-2">$</span>
        <input type="number" inputMode="numeric" min="0" value={value} onChange={e=>onChange(e.target.value)} placeholder="0"
          className="flex-1 border-none outline-none text-[28px] font-extrabold text-ink bg-transparent py-1 w-full tabular-nums"/>
      </div>
    </div>
  );
}
function SmallField({ label, emoji, value, onChange, colorVar='--color-tab-tarjetas' }) {
  return (
    <div className="mb-3.5">
      <div className="text-xs font-bold text-muted mb-1.5">{emoji} {label}</div>
      <div className="flex items-center bg-white rounded-lg border-[1.5px] px-3.5 py-1.5 gap-1.5" style={{ borderColor: value ? `var(${colorVar})` : 'var(--color-border)' }}>
        <span className="text-base text-muted-light font-semibold">$</span>
        <input type="number" inputMode="numeric" min="0" value={value} onChange={e=>onChange(e.target.value)} placeholder="0"
          className="flex-1 border-none outline-none text-xl font-extrabold text-ink bg-transparent py-1 tabular-nums"/>
      </div>
    </div>
  );
}

function agruparPorSemana(registros) {
  const semanas = {};
  registros.forEach(r => {
    const key = dateStr(getMonday(new Date(r.fecha + 'T12:00:00')));
    (semanas[key] = semanas[key] || []).push(r);
  });
  return Object.entries(semanas).map(([mondayKey, regs]) => ({
    mondayKey, registros: regs.sort((a,b)=>a.fecha.localeCompare(b.fecha)),
    totalBruto: regs.reduce((s,r)=>s+n(r.total),0),
    totalTransferencia: regs.reduce((s,r)=>s+n(r.transferencia),0),
    totalCierreMes: regs.reduce((s,r)=>s+n(r.efectivoCierreMes),0),
  })).sort((a,b)=>b.mondayKey.localeCompare(a.mondayKey));
}

function DetalleSemana({ semana, onBack, onBorrar }) {
  const monday = new Date(semana.mondayKey + 'T12:00:00');
  const dias = weekDates(monday);
  const isCurrentWeek = dateStr(monday) === dateStr(getMonday(new Date()));
  return (
    <div className="max-w-[480px] mx-auto p-4 bg-positive-soft min-h-[calc(100vh-70px)]">
      <button onClick={onBack} className="border-none bg-border-soft rounded-lg cursor-pointer px-4 py-2 font-bold text-muted mb-4 touch-manipulation">‹ Volver</button>
      <div className="bg-tab-ganancias rounded-2xl px-5 py-4.5 mb-4.5 text-white shadow-md">
        <div className="text-[13px] opacity-80">{fmtDate(dias[0])} – {fmtDate(dias[6])}{isCurrentWeek?' · esta semana':''}</div>
        <div className="text-[32px] font-extrabold mt-1.5 tracking-tight tabular-nums">{$$(semana.totalBruto)}</div>
        <div className="text-[11px] opacity-80 mt-1.5 flex gap-3 flex-wrap">
          {semana.totalTransferencia>0 && <span>💸 {$$(semana.totalTransferencia)} a Julieta</span>}
          {semana.totalCierreMes>0 && <span>💰 {$$(semana.totalCierreMes)} cierre de mes</span>}
        </div>
      </div>
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-tab-ganancias text-white px-4 py-2.5 font-bold text-[13px]">Detalle por día</div>
        {dias.map((d,i) => {
          const ds = dateStr(d), reg = semana.registros.find(r => r.fecha === ds);
          if (!reg) return (
            <div key={ds} className={`flex items-center px-3.5 py-2.5 opacity-40 ${i<6?'border-b border-positive-soft':''}`}>
              <div className="flex-1 text-[13px] text-muted-light">{DIAS[d.getDay()]} {fmtDate(d)}</div><span className="text-xs text-border">sin registro</span>
            </div>
          );
          return (
            <div key={ds} className={`flex items-center px-3.5 py-2.5 bg-white ${i<6?'border-b border-positive-soft':''}`}>
              <div className="flex-1">
                <div className="text-[13px] font-bold text-ink">
                  {DIAS[d.getDay()]} {fmtDate(d)}
                  {reg.transferencia>0 && <span className="ml-1.5 text-[10px] bg-[#EBF8FF] text-tab-tarjetas rounded px-1.5 py-0.5">💸</span>}
                  {reg.efectivoCierreMes>0 && <span className="ml-1 text-[10px] bg-accent-soft text-accent-strong rounded px-1.5 py-0.5">💰 cierre</span>}
                </div>
                <div className="text-[11px] text-muted-light mt-0.5 flex gap-2.5 flex-wrap">
                  {reg.uber>0 && <span className="text-tab-ganancias">Uber {$$(reg.uber)}</span>}
                  {reg.didi>0 && <span className="text-negative">DiDi {$$(reg.didi)}</span>}
                  {reg.transferencia>0 && <span className="text-tab-tarjetas">→Juliet {$$(reg.transferencia)}</span>}
                  {reg.efectivoCierreMes>0 && <span className="text-accent-strong">Depósito {$$(reg.efectivoCierreMes)}</span>}
                </div>
              </div>
              <div className="font-extrabold text-[15px] text-tab-ganancias mr-2.5 tabular-nums">{reg.total>0?$$(reg.total):'—'}</div>
              <button onClick={()=>onBorrar(reg.id)} className="border-none bg-none cursor-pointer text-border text-xl touch-manipulation">×</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Ganancias({ appData, saveData }) {
  const [uber, setUber] = useState(''); const [didi, setDidi] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [transferencia, setTransferencia] = useState('');
  const [efectivoEnMano, setEfectivoEnMano] = useState('');
  const [efectivoCierreMes, setEfectivoCierreMes] = useState('');
  const [status, setStatus] = useState('idle');
  const [selSemana, setSelSemana] = useState(null);

  const fechaSel = new Date(fecha + 'T12:00:00');
  const esDomingo = fechaSel.getDay() === 0;
  const esCierreMes = esUltimoDiaMes(fecha);
  const total = n(uber) + n(didi);
  const registros = appData.uberDiDi || [];

  const registrar = async () => {
    if (total === 0 && n(transferencia) === 0 && n(efectivoCierreMes) === 0) { setStatus('error'); setTimeout(() => setStatus('idle'), 2000); return; }
    setStatus('saving');
    const nuevo = {
      id: uid(), fecha, uber:n(uber), didi:n(didi), total,
      transferencia: n(transferencia) || 0,
      efectivoEnMano: esDomingo ? n(efectivoEnMano) || 0 : 0,
      efectivoCierreMes: esCierreMes ? n(efectivoCierreMes) || 0 : 0,
    };
    const updated = [nuevo, ...registros].sort((a,b)=>b.fecha.localeCompare(a.fecha));
    setUber(''); setDidi(''); setTransferencia(''); setEfectivoEnMano(''); setEfectivoCierreMes(''); setFecha(hoy());
    const ok = await saveData({ ...appData, uberDiDi: updated });
    setStatus(ok ? 'saved' : 'pending'); setTimeout(() => setStatus('idle'), 2000);
  };
  const borrar = (id) => saveData({ ...appData, uberDiDi: registros.filter(r=>r.id!==id) });

  const semanas = agruparPorSemana(registros);
  const semanaActualKey = dateStr(getMonday(new Date()));
  if (selSemana) {
    const semana = semanas.find(s => s.mondayKey === selSemana);
    return semana ? <DetalleSemana semana={semana} onBack={()=>setSelSemana(null)} onBorrar={borrar}/> : null;
  }

  const saveBg = { idle:'bg-tab-ganancias', saving:'bg-muted-light', saved:'bg-tab-tarjetas', pending:'bg-accent', error:'bg-negative' }[status];
  const saveTx = { idle:'✓  Registrar', saving:'Guardando...', saved:'✓  Guardado y sincronizado', pending:'⏳ Guardado en el celular · pendiente de sincronizar', error:'⚠️  Ingresá al menos un monto' }[status];

  return (
    <div>
      <div className="bg-paper rounded-2xl px-4 py-4.5 mb-4 shadow-sm">
        <BigField label="Uber" colorVar="--color-tab-ganancias" value={uber} onChange={setUber}/>
        <BigField label="DiDi" colorVar="--color-negative" value={didi} onChange={setDidi}/>
        <div className={`rounded-xl px-4 py-3 mb-4 flex justify-between items-center border-[1.5px] ${total>0?'bg-positive-soft border-[#9AE6B4]':'bg-border-soft border-border'}`}>
          <span className="text-sm font-bold text-muted">Total del día (bruto)</span>
          <span className={`text-2xl font-extrabold tabular-nums ${total>0?'text-tab-ganancias':'text-muted-light'}`}>{total>0?$$(total):'—'}</span>
        </div>
        <div className="mb-4">
          <div className="text-xs text-muted mb-1.5 font-semibold">📅 Fecha del registro</div>
          <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} max={hoy()}
            className="w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-border text-[15px] outline-none text-ink bg-white"/>
          {fecha!==hoy() && <div className="text-[11px] text-accent-strong mt-1 font-semibold">⚠️ Registrando para el {fecha.split('-').reverse().join('/')} — no hoy</div>}
        </div>
        {esDomingo && (
          <div className="bg-[#EBF8FF] rounded-xl p-3.5 mb-4 border-[1.5px] border-[#90CDF4]">
            <div className="text-[13px] font-extrabold text-tab-tarjetas mb-3">🗓️ Cierre dominical — {fecha.split('-').reverse().slice(0,2).join('/')}</div>
            <SmallField label="Transferencia a la Uala de Julieta" emoji="💸" value={transferencia} onChange={setTransferencia}/>
            <SmallField label="Efectivo que me queda" emoji="💵" value={efectivoEnMano} onChange={setEfectivoEnMano}/>
          </div>
        )}
        {esCierreMes && (
          <div className="bg-accent-soft rounded-xl p-3.5 mb-4 border-[1.5px] border-[#E9BE8F]">
            <div className="text-[13px] font-extrabold text-accent-strong mb-3">📦 Cierre de mes — {fecha.split('-').reverse().slice(0,2).join('/')}</div>
            <SmallField label="Efectivo depositado en la Uala" emoji="💰" value={efectivoCierreMes} onChange={setEfectivoCierreMes} colorVar="--color-accent-strong"/>
            <div className="text-[11px] text-accent-strong mt-1">✓ Cuenta como aporte a la Uala en la conciliación (una sola vez).</div>
          </div>
        )}
        <button onClick={registrar} className={`w-full py-4 border-none rounded-2xl cursor-pointer text-base font-extrabold text-white shadow-md transition-colors touch-manipulation ${saveBg}`}>{saveTx}</button>
      </div>

      {semanas.length > 0 ? (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-tab-ganancias text-white px-4 py-2.5 font-bold text-[13px]">Semanas</div>
          {semanas.map((s,i) => {
            const monday = new Date(s.mondayKey + 'T12:00:00'); const sunday = new Date(monday); sunday.setDate(monday.getDate()+6);
            const isCurrent = s.mondayKey === semanaActualKey;
            return (
              <div key={s.mondayKey} onClick={()=>setSelSemana(s.mondayKey)}
                className={`flex items-center px-3.5 py-3 cursor-pointer touch-manipulation ${i<semanas.length-1?'border-b border-positive-soft':''} ${isCurrent ? 'bg-[#EBF8FF]' : i%2===0 ? 'bg-white' : 'bg-[#F9FFFC]'}`}>
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-ink">{fmtDate(monday)} – {fmtDate(sunday)}{isCurrent && <span className="ml-1.5 text-[9px] bg-tab-tarjetas text-white rounded px-1.5 py-0.5">esta semana</span>}</div>
                  <div className="text-[11px] text-muted-light mt-0.5 flex gap-2 flex-wrap"><span>{s.registros.length} día{s.registros.length>1?'s':''}</span>{s.totalTransferencia>0 && <span>💸 {$$(s.totalTransferencia)}</span>}</div>
                </div>
                <span className="font-extrabold text-base text-tab-ganancias mr-2 tabular-nums">{$$(s.totalBruto)}</span><span className="text-muted-light text-sm">›</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-7.5 px-5 text-muted-light"><div className="text-4xl mb-2">📋</div><div className="text-[13px]">Todavía no hay registros</div></div>
      )}
    </div>
  );
}

// ── Detalle de un gasto del vehículo. Se guarda aparte, ligado por el id del gasto original
// (no crea otro gasto, no toca importes): appData.autoDetalle[idGasto].
function DetalleGastoAuto({ item, detalle, onSave, onClear }) {
  const [f, setF] = useState({ tipo:'', km:'', descripcion:'', proximoKm:'', proximaFecha:'', ...(detalle||{}) });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const inp = 'w-full px-3 py-2 rounded-lg border-[1.5px] border-border text-sm outline-none bg-white';
  return (
    <div className="bg-[#F9FFFC] px-4 py-3 border-b border-border-soft">
      <div className="text-[11px] font-bold text-muted mb-2 uppercase">Detalle del trabajo</div>
      <select value={f.tipo} onChange={e=>set('tipo', e.target.value)} className={inp + ' mb-2'}>
        <option value="">Tipo de trabajo…</option>{TIPOS_TRABAJO.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <div className="flex gap-2 mb-2">
        <input type="number" inputMode="numeric" placeholder="Km actual" value={f.km} onChange={e=>set('km', e.target.value)} className={inp}/>
        <input type="number" inputMode="numeric" placeholder="Próximo a los km" value={f.proximoKm} onChange={e=>set('proximoKm', e.target.value)} className={inp}/>
      </div>
      <input type="date" value={f.proximaFecha} onChange={e=>set('proximaFecha', e.target.value)} className={inp + ' mb-2'}/>
      <textarea rows={2} placeholder="Descripción (repuestos, taller, notas)" value={f.descripcion} onChange={e=>set('descripcion', e.target.value)} className={inp + ' mb-2'}/>
      <div className="flex gap-2">
        {detalle && <button onClick={onClear} className="flex-1 py-2 border-[1.5px] border-border rounded-lg bg-white text-negative font-semibold text-xs touch-manipulation">Quitar detalle</button>}
        <button onClick={()=>onSave({ ...f, km: f.km===''?'':n(f.km), proximoKm: f.proximoKm===''?'':n(f.proximoKm) })}
          className="flex-[2] py-2 border-none rounded-lg bg-tab-ganancias text-white font-bold text-xs touch-manipulation">Guardar detalle</button>
      </div>
      <div className="text-[10px] text-muted-light mt-1.5">El importe y la categoría se editan en Gastos: {$$(item.monto)} · {item.key}</div>
    </div>
  );
}

// Alta / edición de un vehículo: marca, modelo, patente y año.
function FormVehiculo({ inicial, existentes, onSave, onCancel }) {
  const [f, setF] = useState({ marca:'', modelo:'', patente:'', anio:'', ...(inicial || {}) });
  const [err, setErr] = useState('');
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const inp = 'w-full px-3 py-2 rounded-lg border-[1.5px] border-border text-sm outline-none bg-white';
  const guardar = () => {
    if (!f.marca.trim() || !f.modelo.trim() || !normPatente(f.patente)) { setErr('Completá marca, modelo y patente.'); return; }
    const anio = f.anio === '' ? '' : Math.floor(n(f.anio));
    if (anio !== '' && (anio < 1950 || anio > 2100)) { setErr('El año no es válido.'); return; }
    if (existentes.some(v => v.id !== inicial?.id && normPatente(v.patente) === normPatente(f.patente))) { setErr('Ya hay un vehículo con esa patente.'); return; }
    onSave({ id: inicial?.id || uid(), marca: f.marca.trim(), modelo: f.modelo.trim(), patente: normPatente(f.patente), anio });
  };
  return (
    <div className="bg-white rounded-2xl p-4 mb-3.5 shadow-sm border-[1.5px] border-tab-ganancias">
      <div className="text-[13px] font-extrabold text-tab-ganancias mb-3">{inicial ? '✏️ Editar vehículo' : '➕ Nuevo vehículo'}</div>
      <div className="flex gap-2 mb-2">
        <input placeholder="Marca" value={f.marca} onChange={e=>set('marca', e.target.value)} className={inp}/>
        <input placeholder="Modelo" value={f.modelo} onChange={e=>set('modelo', e.target.value)} className={inp}/>
      </div>
      <div className="flex gap-2 mb-2">
        <input placeholder="Patente" value={f.patente} onChange={e=>set('patente', e.target.value.toUpperCase())} className={inp + ' font-mono'}/>
        <input placeholder="Año" type="number" inputMode="numeric" value={f.anio} onChange={e=>set('anio', e.target.value)} className={inp}/>
      </div>
      {err && <div className="text-[11px] text-negative font-semibold mb-2">{err}</div>}
      <div className="flex gap-2">
        {onCancel && <button onClick={onCancel} className="flex-1 py-2 border-[1.5px] border-border rounded-lg bg-white text-muted font-semibold text-xs touch-manipulation">Cancelar</button>}
        <button onClick={guardar} className="flex-[2] py-2 border-none rounded-lg bg-tab-ganancias text-white font-bold text-xs touch-manipulation">Guardar vehículo</button>
      </div>
    </div>
  );
}

function GastosAuto({ appData, saveData, zapiaData, tarjetasData, brutoMes, selMes, setSelMes }) {
  const [periodo, setPeriodo] = useState(1);        // meses hacia atrás: 1, 3, 6, 12
  const [abierto, setAbierto] = useState({});
  const [detalleAbierto, setDetalleAbierto] = useState(null);
  const [selVeh, setSelVeh] = useState(() => storage.get(SK_VEH)?.value || '');
  const [formVeh, setFormVeh] = useState(null);     // null | 'nuevo' | 'editar'
  const categories = appData.categories || {};
  const dolarMap = appData.dolarTarjeta || {};
  const autoDetalle = appData.autoDetalle || {};
  const vehiculos = appData.vehiculos || [];
  const gv = appData.gastoVehiculo || {};
  const meses = mesesAtras(selMes, periodo);

  // Vehículo activo: el elegido, o el primero (a él van los gastos sin asignar).
  const vehActivo = vehiculos.find(v => v.id === selVeh) || vehiculos[0] || null;
  const elegir = (id) => { setSelVeh(id); storage.set(SK_VEH, id); };
  const filtro = vehActivo ? (i => vehiculoDeGasto(i.id, gv, vehiculos) === vehActivo.id) : null;

  // Consulta sobre Gastos: mismas funciones, mismos filtros, sin duplicar registros.
  const porMes = meses.map(mes => resumenAuto(agruparGastosPorCategoria(zapiaData, tarjetasData, categories, dolarMap, mes).grupos, filtro));
  const unir = k => porMes.flatMap(r => r[k].items).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const grupos = ['combustible','peajes','mantenimiento','sinClasificar'].map(k => {
    const items = unir(k);
    return { k, label: porMes[0][k].label, emoji: porMes[0][k].emoji, items, total: items.reduce((s,i)=>s+i.monto,0) };
  });
  const tot = k => grupos.find(g => g.k === k).total;
  const resumen = resumenAutoMeses(zapiaData, tarjetasData, categories, dolarMap, meses, filtro);
  // Rentabilidad: el bruto de Uber/DiDi no se reparte por vehículo, así que se compara con TODOS los vehículos.
  const mesTodos = resumenAutoMeses(zapiaData, tarjetasData, categories, dolarMap, [selMes]).total;
  const gastosTodos = mesTodos.combustible + mesTodos.peajes + mesTodos.mantenimiento;

  // Km y próximo mantenimiento: solo del vehículo activo.
  const detallesVeh = Object.values(autoDetalle).filter(d => !vehActivo || (d.vehiculoId || vehiculos[0]?.id) === vehActivo.id);
  const kms = detallesVeh.map(d => n(d.km)).filter(Boolean);
  const ultimoKm = kms.length ? Math.max(...kms) : 0;
  const proximos = detallesVeh.filter(d => n(d.proximoKm) > 0).map(d => n(d.proximoKm)).sort((a,b)=>a-b).find(k => k >= ultimoKm);

  const guardarDetalle = (id, d) => saveData({ ...appData, autoDetalle: { ...autoDetalle, [id]: { ...d, vehiculoId: vehActivo?.id || '' } } }).then(() => setDetalleAbierto(null));
  const quitarDetalle = (id) => { const nx = { ...autoDetalle }; delete nx[id]; return saveData({ ...appData, autoDetalle: nx }).then(() => setDetalleAbierto(null)); };
  const asignarVehiculo = (id, vid) => saveData({
    ...appData, gastoVehiculo: { ...gv, [id]: vid },
    autoDetalle: autoDetalle[id] ? { ...autoDetalle, [id]: { ...autoDetalle[id], vehiculoId: vid } } : autoDetalle,
  });

  const guardarVehiculo = async (v) => {
    const lista = vehiculos.some(x => x.id === v.id) ? vehiculos.map(x => x.id === v.id ? v : x) : [...vehiculos, v];
    await saveData({ ...appData, vehiculos: lista });
    elegir(v.id); setFormVeh(null);
  };
  const borrarVehiculo = async () => {
    if (!vehActivo || !window.confirm(`¿Quitar ${vehActivo.marca} ${vehActivo.modelo} (${vehActivo.patente})? Sus gastos no se borran: pasan al primer vehículo.`)) return;
    const gvNuevo = Object.fromEntries(Object.entries(gv).filter(([,vid]) => vid !== vehActivo.id));
    await saveData({ ...appData, vehiculos: vehiculos.filter(v => v.id !== vehActivo.id), gastoVehiculo: gvNuevo });
    setSelVeh('');
  };

  if (vehiculos.length === 0 || formVeh === 'nuevo') return (
    <div>
      <div className="text-[13px] text-muted mb-3">{vehiculos.length === 0 ? 'Cargá tu vehículo para ver y imputar sus gastos. Los que ya tenés en Gastos pasan al primero que cargues.' : ''}</div>
      <FormVehiculo existentes={vehiculos} onSave={guardarVehiculo} onCancel={vehiculos.length ? () => setFormVeh(null) : null}/>
    </div>
  );

  return (
    <div>
      {/* Primero el vehículo, después el mes */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-2">
        {vehiculos.map(v => (
          <button key={v.id} onClick={()=>elegir(v.id)}
            className={`shrink-0 px-3 py-2 rounded-xl text-left border-[1.5px] touch-manipulation cursor-pointer ${vehActivo.id===v.id?'bg-tab-ganancias text-white border-tab-ganancias':'bg-white text-ink border-border'}`}>
            <div className="text-[13px] font-bold">🚗 {v.marca} {v.modelo}</div>
            <div className={`text-[10px] font-mono ${vehActivo.id===v.id?'opacity-80':'text-muted'}`}>{v.patente}{v.anio ? ` · ${v.anio}` : ''}</div>
          </button>
        ))}
        <button onClick={()=>setFormVeh('nuevo')} className="shrink-0 px-3 py-2 rounded-xl border-2 border-dashed border-border bg-none text-[13px] font-bold text-muted cursor-pointer touch-manipulation">➕ Vehículo</button>
      </div>
      <div className="flex gap-2 mb-3">
        <button onClick={()=>setFormVeh(formVeh==='editar'?null:'editar')} className="border-none bg-border-soft rounded-md cursor-pointer text-[11px] text-muted px-2.5 py-1 touch-manipulation">✏️ Editar</button>
        <button onClick={borrarVehiculo} className="border-none bg-border-soft rounded-md cursor-pointer text-[11px] text-negative px-2.5 py-1 touch-manipulation">🗑️ Quitar</button>
      </div>
      {formVeh === 'editar' && <FormVehiculo inicial={vehActivo} existentes={vehiculos} onSave={guardarVehiculo} onCancel={()=>setFormVeh(null)}/>}

      <select value={selMes} onChange={e=>setSelMes(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-border text-sm mb-2.5 bg-white text-ink font-semibold cursor-pointer">
        {monthOpts(new Date()).map(k=><option key={k} value={k}>{fmtKey(k)}{k===getKey(new Date())?' — actual':''}</option>)}
      </select>
      <div className="flex bg-border-soft rounded-lg p-1 gap-0.5 mb-3.5">
        {[[1,'Mes'],[3,'3 meses'],[6,'6 meses'],[12,'12 meses']].map(([v,l]) => (
          <button key={v} onClick={()=>setPeriodo(v)} className={`flex-1 py-2 border-none rounded-lg cursor-pointer font-bold text-xs touch-manipulation ${periodo===v?'bg-white text-tab-ganancias shadow-sm':'bg-transparent text-muted'}`}>{l}</button>
        ))}
      </div>

      <div className="bg-tab-ganancias text-white rounded-2xl px-5 py-4 mb-3.5 shadow-md">
        <div className="text-[11px] opacity-80 uppercase font-bold tracking-wide">{vehActivo.marca} {vehActivo.modelo} · {periodo===1?fmtKey(selMes):`últimos ${periodo} meses`}</div>
        <div className="text-[30px] font-extrabold tracking-tight tabular-nums">{$$(tot('combustible')+tot('peajes')+tot('mantenimiento'))}</div>
        <div className="text-[11px] opacity-80 flex gap-3 flex-wrap mt-1">
          <span>⛽ {$$(tot('combustible'))}</span><span>🛣️ {$$(tot('peajes'))}</span><span>🔧 {$$(tot('mantenimiento'))}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
        <div className="bg-tab-ganancias text-white px-4 py-2.5 font-bold text-[13px]">🚗 Rentabilidad · todos los vehículos · {fmtKey(selMes)}</div>
        <div className="flex justify-between px-4 py-2.5 border-b border-border-soft"><span className="text-[13px] text-muted">Ingreso bruto (Uber/DiDi)</span><span className="text-[13px] font-bold text-german tabular-nums">{$$(brutoMes)}</span></div>
        <div className="flex justify-between px-4 py-2.5 border-b border-border-soft"><span className="text-[13px] text-muted">Combustible + peajes + mantenimiento</span><span className="text-[13px] font-bold text-negative tabular-nums">{$$(gastosTodos)}</span></div>
        <div className="flex justify-between px-4 py-2.5 bg-paper"><span className="text-[13px] font-bold text-ink">Queda después del auto</span><span className={`text-base font-extrabold tabular-nums ${brutoMes-gastosTodos>=0?'text-positive':'text-negative'}`}>{$$(brutoMes-gastosTodos)}</span></div>
      </div>

      {(ultimoKm > 0 || proximos) && (
        <div className="bg-accent-soft rounded-xl px-4 py-2.5 mb-3.5 text-[12px] text-accent-strong">
          {ultimoKm>0 && <div>Último km registrado: <strong>{new Intl.NumberFormat('es-AR').format(ultimoKm)}</strong></div>}
          {proximos && <div>Próximo mantenimiento previsto: <strong>{new Intl.NumberFormat('es-AR').format(proximos)} km</strong>{ultimoKm>0 && ` (faltan ${new Intl.NumberFormat('es-AR').format(proximos-ultimoKm)})`}</div>}
        </div>
      )}

      {periodo > 1 && (
        <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
          <table className="w-full border-collapse text-xs">
            <thead><tr className="bg-border-soft">{['Mes','⛽','🛣️','🔧'].map(h=><th key={h} className={`px-2.5 py-2 ${h==='Mes'?'text-left':'text-right'} text-muted font-bold text-[11px]`}>{h}</th>)}</tr></thead>
            <tbody>
              {[...resumen.porMes].reverse().map((m,i)=>(
                <tr key={m.mes} className={i%2===0?'bg-white':'bg-paper'}>
                  <td className="px-2.5 py-2 font-semibold text-ink">{fmtKey(m.mes)}</td>
                  <td className="px-2.5 py-2 text-right tabular-nums">{$$(m.combustible)}</td><td className="px-2.5 py-2 text-right tabular-nums">{$$(m.peajes)}</td><td className="px-2.5 py-2 text-right tabular-nums">{$$(m.mantenimiento)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {grupos.map(g => (
        <div key={g.k} className="bg-white rounded-2xl overflow-hidden mb-3 shadow-sm">
          <div onClick={()=>setAbierto(p=>({...p,[g.k]:!p[g.k]}))} className="flex items-center px-4 py-3 cursor-pointer touch-manipulation">
            <span className="text-xl mr-2.5">{g.emoji}</span>
            <div className="flex-1"><div className="text-[13px] font-bold text-ink">{g.label}</div><div className="text-[11px] text-muted-light">{g.items.length} gasto{g.items.length!==1?'s':''}</div></div>
            <span className="font-extrabold text-sm text-tab-ganancias mr-2 tabular-nums">{$$(g.total)}</span><span className="text-muted-light text-xs">{abierto[g.k]?'▲':'▼'}</span>
          </div>
          {g.k==='sinClasificar' && g.items.length>0 && abierto[g.k] && <div className="px-4 pb-2 text-[11px] text-muted bg-[#FFFBF5]">Estos gastos están en "Auto" genérico. Pasalos a Combustible, Mantenimiento o Peajes/TelePASE desde la pestaña Gastos (✏️) para que se sumen arriba.</div>}
          {abierto[g.k] && g.items.map(item => (
            <div key={item.id}>
              <div className="flex items-center pl-11 pr-3.5 py-2.5 border-t border-border-soft bg-[#FAFAFA]">
                <div className="flex-1">
                  <div className="text-[13px] text-ink font-medium">{item.key}</div>
                  <div className="text-[11px] text-muted-light mt-0.5 flex gap-2 items-center flex-wrap">
                    {item.origen==='tarjeta' ? <span className="bg-accent-soft text-accent-strong rounded px-1.5 py-0.5 font-bold">💳 {item.tarjeta}</span> : <span>{item.medio==='efectivo'?'💵':'📲'}</span>}
                    <span>{item.fecha.split('-').reverse().join('/')}</span>
                    {autoDetalle[item.id]?.tipo && <span className="bg-positive-soft text-positive rounded px-1.5 py-0.5 font-bold">{autoDetalle[item.id].tipo}</span>}
                    {autoDetalle[item.id]?.km ? <span>{new Intl.NumberFormat('es-AR').format(autoDetalle[item.id].km)} km</span> : null}
                    <button onClick={()=>setDetalleAbierto(detalleAbierto===item.id?null:item.id)} className="border-none bg-border-soft rounded-md cursor-pointer text-[10px] text-muted px-1.5 py-0.5 font-semibold touch-manipulation">{autoDetalle[item.id]?'📝 ver / editar':'➕ detalle'}</button>
                    {vehiculos.length > 1 && (
                      <select value={vehActivo.id} onChange={e=>asignarVehiculo(item.id, e.target.value)}
                        className="border-none bg-border-soft rounded-md text-[10px] text-muted px-1 py-0.5 font-semibold">
                        {vehiculos.map(v => <option key={v.id} value={v.id}>🚗 {v.patente}</option>)}
                      </select>
                    )}
                  </div>
                </div>
                <span className="font-bold text-[13px] text-tab-ganancias tabular-nums">{$$(item.monto)}</span>
              </div>
              {detalleAbierto===item.id && <DetalleGastoAuto item={item} detalle={autoDetalle[item.id]} onSave={d=>guardarDetalle(item.id,d)} onClear={()=>quitarDetalle(item.id)}/>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Auto({ appData, saveData, zapiaData, tarjetasData, onRefresh }) {
  const [tab, setTab] = useState('ganancias');
  const [selMes, setSelMes] = useState(getKey(new Date()));
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => { setRefreshing(true); await onRefresh?.(); setRefreshing(false); };
  const brutoMes = brutoUberDiDiMes(appData.uberDiDi, selMes);

  return (
    <div className="max-w-[480px] mx-auto p-4 bg-positive-soft min-h-[calc(100vh-70px)] overflow-y-auto">
      <div className="bg-tab-ganancias rounded-2xl px-5 py-4.5 mb-4 text-white shadow-md flex justify-between items-center">
        <div><div className="text-xl font-extrabold">🚗 Auto</div><div className="text-xs opacity-75 mt-0.5">Ganancias · vehículos · combustible · peajes · mantenimiento</div></div>
        <button onClick={handleRefresh} disabled={refreshing} className="bg-white/15 border border-white/30 rounded-lg text-white px-2.5 py-1.5 cursor-pointer text-xs font-bold touch-manipulation">{refreshing ? '...' : '↻'}</button>
      </div>
      <div className="flex bg-border-soft rounded-xl p-1 mb-3.5 gap-0.5">
        {[['ganancias','💵 Ganancias'],['gastos','🔧 Vehículos y gastos']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} className={`flex-1 py-2.5 border-none rounded-lg cursor-pointer font-bold text-xs touch-manipulation ${tab===k?'bg-white text-tab-ganancias shadow-sm':'bg-transparent text-muted'}`}>{l}</button>
        ))}
      </div>
      {tab==='ganancias' && <Ganancias appData={appData} saveData={saveData}/>}
      {tab==='gastos' && <GastosAuto appData={appData} saveData={saveData} zapiaData={zapiaData} tarjetasData={tarjetasData} brutoMes={brutoMes} selMes={selMes} setSelMes={setSelMes}/>}
    </div>
  );
}
