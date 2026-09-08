import { useState } from 'react';
import { n, $$, hoy, getMonday, weekDates, dateStr, fmtDate, uid, esUltimoDiaMes } from '../utils.js';

const DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

function BigField({ label, colorVar, value, onChange }) {
  return (
    <div className="mb-4.5">
      <div className="text-[13px] font-extrabold uppercase tracking-wide mb-2" style={{color:`var(${colorVar})`}}>{label}</div>
      <div className="flex items-center bg-white rounded-2xl border-2 px-4 py-2 transition-colors"
        style={{ borderColor: value ? `var(${colorVar})` : 'var(--color-border)' }}>
        <span className="text-[22px] font-bold text-muted-light mr-2">$</span>
        <input type="number" inputMode="numeric" min="0" value={value}
          onChange={e=>onChange(e.target.value)} placeholder="0"
          className="flex-1 border-none outline-none text-[28px] font-extrabold text-ink bg-transparent py-1 w-full tabular-nums"/>
      </div>
    </div>
  );
}

function SmallField({ label, emoji, value, onChange, colorVar='--color-tab-tarjetas' }) {
  return (
    <div className="mb-3.5">
      <div className="text-xs font-bold text-muted mb-1.5">{emoji} {label}</div>
      <div className="flex items-center bg-white rounded-lg border-[1.5px] px-3.5 py-1.5 gap-1.5"
        style={{ borderColor: value ? `var(${colorVar})` : 'var(--color-border)' }}>
        <span className="text-base text-muted-light font-semibold">$</span>
        <input type="number" inputMode="numeric" min="0" value={value}
          onChange={e=>onChange(e.target.value)} placeholder="0"
          className="flex-1 border-none outline-none text-xl font-extrabold text-ink bg-transparent py-1 tabular-nums"/>
      </div>
    </div>
  );
}

function HorasField({ value, onChange }) {
  return (
    <div className="mb-3.5">
      <div className="text-xs font-bold text-muted mb-1.5">⏱️ Horas trabajadas</div>
      <div className={`flex items-center bg-white rounded-lg border-[1.5px] px-3.5 py-1.5 gap-1.5 ${value?'border-tab-cierre':'border-border'}`}>
        <input type="number" inputMode="decimal" min="0" max="24" step="0.5" value={value}
          onChange={e=>onChange(e.target.value)} placeholder="0"
          className="flex-1 border-none outline-none text-xl font-extrabold text-ink bg-transparent py-1"/>
        <span className="text-sm text-muted font-semibold">hs</span>
      </div>
    </div>
  );
}

function agruparPorSemana(registros) {
  const semanas = {};
  registros.forEach(r => {
    const d = new Date(r.fecha + 'T12:00:00');
    const key = dateStr(getMonday(d));
    if (!semanas[key]) semanas[key] = [];
    semanas[key].push(r);
  });
  return Object.entries(semanas).map(([mondayKey, regs]) => ({
    mondayKey,
    registros: regs.sort((a,b)=>a.fecha.localeCompare(b.fecha)),
    totalBruto: regs.reduce((s,r)=>s+r.total,0),
    totalHoras: regs.reduce((s,r)=>s+n(r.horas),0),
    totalTransferencia: regs.reduce((s,r)=>s+(r.transferencia||0),0),
    totalCierreMes: regs.reduce((s,r)=>s+(r.efectivoCierreMes||0),0),
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
          {semana.totalHoras>0 && <span>⏱️ {semana.totalHoras.toFixed(1)} hs</span>}
          {semana.totalTransferencia>0 && <span>💸 {$$(semana.totalTransferencia)} a Julieta</span>}
          {semana.totalCierreMes>0 && <span>💰 {$$(semana.totalCierreMes)} cierre de mes</span>}
        </div>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-tab-ganancias text-white px-4 py-2.5 font-bold text-[13px]">Detalle por día</div>
        {dias.map((d,i) => {
          const ds  = dateStr(d);
          const reg = semana.registros.find(r => r.fecha === ds);
          if (!reg) return (
            <div key={ds} className={`flex items-center px-3.5 py-2.5 opacity-40 ${i<6?'border-b border-positive-soft':''}`}>
              <div className="flex-1 text-[13px] text-muted-light">{DIAS[d.getDay()]} {fmtDate(d)}</div>
              <span className="text-xs text-border">sin registro</span>
            </div>
          );
          return (
            <div key={ds} className={`flex items-center px-3.5 py-2.5 bg-white ${i<6?'border-b border-positive-soft':''}`}>
              <div className="flex-1">
                <div className="text-[13px] font-bold text-ink">
                  {DIAS[d.getDay()]} {fmtDate(d)}
                  {reg.transferencia>0 && <span className="ml-1.5 text-[10px] bg-[#EBF8FF] text-tab-tarjetas rounded px-1.5 py-0.5">💸</span>}
                  {reg.efectivoCierreMes>0 && <span className="ml-1 text-[10px] bg-accent-soft text-accent-strong rounded px-1.5 py-0.5">💰 cierre</span>}
                  {reg.horas>0 && <span className="ml-1 text-[10px] bg-[#FAF5FF] text-tab-cierre rounded px-1.5 py-0.5">⏱️{reg.horas}h</span>}
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

export default function UberDiDi({ appData, saveData }) {
  const [uber,             setUber]             = useState('');
  const [didi,             setDidi]             = useState('');
  const [horas,            setHoras]            = useState('');
  const [fecha,            setFecha]            = useState(hoy());
  const [transferencia,    setTransferencia]    = useState('');
  const [efectivoEnMano,   setEfectivoEnMano]   = useState('');
  const [efectivoCierreMes,setEfectivoCierreMes]= useState('');
  const [status,           setStatus]           = useState('idle');
  const [selSemana,        setSelSemana]        = useState(null);

  const today       = new Date();
  const fechaSel    = new Date(fecha + 'T12:00:00');
  const esDomingo   = fechaSel.getDay() === 0;
  const esCierreMes = esUltimoDiaMes(fecha);
  const total       = n(uber) + n(didi);
  const registros   = appData.uberDiDi || [];

  const registrar = () => {
    if (total === 0 && n(transferencia) === 0 && n(efectivoCierreMes) === 0) {
      setStatus('error'); setTimeout(() => setStatus('idle'), 2000); return;
    }
    setStatus('saving');
    const nuevo = {
      id: uid(), fecha,
      uber:n(uber), didi:n(didi), total,
      horas:          n(horas) || 0,
      transferencia:  n(transferencia) || 0,
      efectivoEnMano: esDomingo   ? n(efectivoEnMano)    || 0 : 0,
      efectivoCierreMes: esCierreMes ? n(efectivoCierreMes) || 0 : 0,
    };
    const updated = [nuevo, ...registros].sort((a,b)=>b.fecha.localeCompare(a.fecha));
    saveData({ ...appData, uberDiDi: updated });
    setUber(''); setDidi(''); setHoras(''); setTransferencia(''); setEfectivoEnMano(''); setEfectivoCierreMes(''); setFecha(hoy());
    setStatus('saved'); setTimeout(() => setStatus('idle'), 1200);
  };

  const borrar = (id) => { saveData({ ...appData, uberDiDi: registros.filter(r=>r.id!==id) }); };

  const semanas = agruparPorSemana(registros);
  const semanaActualKey = dateStr(getMonday(today));

  if (selSemana) {
    const semana = semanas.find(s => s.mondayKey === selSemana);
    return semana ? (
      <DetalleSemana semana={semana} onBack={()=>setSelSemana(null)} onBorrar={borrar}/>
    ) : null;
  }

  const saveBg = { idle:'bg-tab-ganancias', saving:'bg-muted-light', saved:'bg-tab-tarjetas', error:'bg-negative' }[status];
  const saveTx = { idle:'✓  Registrar', saving:'Guardando...', saved:'✓  Guardado', error:'⚠️  Ingresá al menos un monto' }[status];

  return (
    <div className="max-w-[480px] mx-auto p-4 bg-positive-soft min-h-[calc(100vh-70px)] overflow-y-auto">

      <div className="bg-tab-ganancias rounded-2xl px-5 py-4.5 mb-5 text-white shadow-md">
        <div className="text-xl font-extrabold">🚗 Ganancias del día</div>
        <div className="text-xs opacity-75 mt-0.5">Uber · DiDi · Germán</div>
      </div>

      <div className="bg-paper rounded-2xl px-4 py-4.5 mb-4 shadow-sm">
        <BigField label="Uber" colorVar="--color-tab-ganancias" value={uber} onChange={setUber}/>
        <BigField label="DiDi" colorVar="--color-negative" value={didi} onChange={setDidi}/>

        <div className={`rounded-xl px-4 py-3 mb-4 flex justify-between items-center border-[1.5px] ${total>0?'bg-positive-soft border-[#9AE6B4]':'bg-border-soft border-border'}`}>
          <span className="text-sm font-bold text-muted">Total del día</span>
          <span className={`text-2xl font-extrabold tabular-nums ${total>0?'text-tab-ganancias':'text-muted-light'}`}>{total>0?$$(total):'—'}</span>
        </div>

        <HorasField value={horas} onChange={setHoras}/>

        <div className="mb-4">
          <div className="text-xs text-muted mb-1.5 font-semibold">📅 Fecha del registro</div>
          <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} max={hoy()}
            className="w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-border text-[15px] outline-none text-ink bg-white"/>
          {fecha!==hoy() && <div className="text-[11px] text-accent-strong mt-1 font-semibold">⚠️ Registrando para el {fecha.split('-').reverse().join('/')} — no hoy</div>}
        </div>

        {esDomingo && (
          <div className="bg-[#EBF8FF] rounded-xl p-3.5 mb-4 border-[1.5px] border-[#90CDF4]">
            <div className="text-[13px] font-extrabold text-tab-tarjetas mb-3">🗓️ Cierre dominical — {fecha.split('-').reverse().slice(0,2).join('/')}</div>
            <SmallField label="Transferencia a Julieta" emoji="💸" value={transferencia} onChange={setTransferencia}/>
            <SmallField label="Efectivo que me queda" emoji="💵" value={efectivoEnMano} onChange={setEfectivoEnMano}/>
            {n(transferencia)>0 && <div className="text-[11px] text-tab-tarjetas mt-1">✓ Se registra como ingreso de Germán en el mes</div>}
          </div>
        )}

        {esCierreMes && (
          <div className="bg-accent-soft rounded-xl p-3.5 mb-4 border-[1.5px] border-[#E9BE8F]">
            <div className="text-[13px] font-extrabold text-accent-strong mb-3">📦 Cierre de mes — {fecha.split('-').reverse().slice(0,2).join('/')}</div>
            <SmallField label="Efectivo depositado" emoji="💰" value={efectivoCierreMes} onChange={setEfectivoCierreMes} colorVar="--color-accent-strong"/>
            <div className="text-[11px] text-accent-strong mt-1">✓ Este monto también suma como ingreso de Germán en Principal</div>
          </div>
        )}

        <button onClick={registrar}
          className={`w-full py-4 border-none rounded-2xl cursor-pointer text-base font-extrabold text-white shadow-md transition-colors touch-manipulation ${saveBg}`}>
          {saveTx}
        </button>
      </div>

      {semanas.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-tab-ganancias text-white px-4 py-2.5 font-bold text-[13px]">Semanas</div>
          {semanas.map((s,i) => {
            const monday = new Date(s.mondayKey + 'T12:00:00');
            const sunday = new Date(monday); sunday.setDate(monday.getDate()+6);
            const isCurrent = s.mondayKey === semanaActualKey;
            return (
              <div key={s.mondayKey} onClick={()=>setSelSemana(s.mondayKey)}
                className={`flex items-center px-3.5 py-3 cursor-pointer touch-manipulation ${i<semanas.length-1?'border-b border-positive-soft':''}
                  ${isCurrent ? 'bg-[#EBF8FF]' : i%2===0 ? 'bg-white' : 'bg-[#F9FFFC]'}`}>
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-ink">
                    {fmtDate(monday)} – {fmtDate(sunday)}
                    {isCurrent && <span className="ml-1.5 text-[9px] bg-tab-tarjetas text-white rounded px-1.5 py-0.5">esta semana</span>}
                  </div>
                  <div className="text-[11px] text-muted-light mt-0.5 flex gap-2 flex-wrap">
                    <span>{s.registros.length} día{s.registros.length>1?'s':''}</span>
                    {s.totalHoras>0 && <span>⏱️ {s.totalHoras.toFixed(1)}hs</span>}
                    {s.totalTransferencia>0 && <span>💸 {$$(s.totalTransferencia)}</span>}
                  </div>
                </div>
                <span className="font-extrabold text-base text-tab-ganancias mr-2 tabular-nums">{$$(s.totalBruto)}</span>
                <span className="text-muted-light text-sm">›</span>
              </div>
            );
          })}
        </div>
      )}

      {semanas.length === 0 && (
        <div className="text-center py-7.5 px-5 text-muted-light">
          <div className="text-4xl mb-2">📋</div>
          <div className="text-[13px]">Todavía no hay registros</div>
        </div>
      )}
    </div>
  );
}
