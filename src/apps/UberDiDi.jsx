import { useState } from 'react';
import { n, $$, hoy, getMonday, weekDates, dateStr, fmtDate, uid, esUltimoDiaMes } from '../utils.js';

const DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

function BigField({ label, color, value, onChange }) {
  return (
    <div style={{marginBottom:18}}>
      <div style={{fontSize:13,fontWeight:800,color,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>{label}</div>
      <div style={{display:'flex',alignItems:'center',background:'#fff',borderRadius:14,
                   border:`2px solid ${value?color:'#E2E8F0'}`,padding:'8px 16px',
                   boxShadow:value?`0 0 0 3px ${color}22`:'none',transition:'border-color .2s'}}>
        <span style={{fontSize:22,fontWeight:700,color:'#A0AEC0',marginRight:8}}>$</span>
        <input type="number" inputMode="numeric" min="0" value={value}
          onChange={e=>onChange(e.target.value)} placeholder="0"
          style={{flex:1,border:'none',outline:'none',fontSize:28,fontWeight:900,
                  color:'#1A365D',background:'transparent',padding:'4px 0',width:'100%'}}/>
      </div>
    </div>
  );
}

function SmallField({ label, emoji, value, onChange, color='#2B6CB0' }) {
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:12,fontWeight:700,color:'#4A5568',marginBottom:6}}>{emoji} {label}</div>
      <div style={{display:'flex',alignItems:'center',background:'#fff',borderRadius:10,
                   border:`1.5px solid ${value?color:'#E2E8F0'}`,padding:'6px 14px',gap:6}}>
        <span style={{fontSize:16,color:'#A0AEC0',fontWeight:600}}>$</span>
        <input type="number" inputMode="numeric" min="0" value={value}
          onChange={e=>onChange(e.target.value)} placeholder="0"
          style={{flex:1,border:'none',outline:'none',fontSize:20,fontWeight:800,
                  color:'#1A365D',background:'transparent',padding:'4px 0'}}/>
      </div>
    </div>
  );
}

function HorasField({ value, onChange }) {
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:12,fontWeight:700,color:'#4A5568',marginBottom:6}}>⏱️ Horas trabajadas</div>
      <div style={{display:'flex',alignItems:'center',background:'#fff',borderRadius:10,
                   border:`1.5px solid ${value?'#553C9A':'#E2E8F0'}`,padding:'6px 14px',gap:6}}>
        <input type="number" inputMode="decimal" min="0" max="24" step="0.5" value={value}
          onChange={e=>onChange(e.target.value)} placeholder="0"
          style={{flex:1,border:'none',outline:'none',fontSize:20,fontWeight:800,
                  color:'#1A365D',background:'transparent',padding:'4px 0'}}/>
        <span style={{fontSize:14,color:'#718096',fontWeight:600}}>hs</span>
      </div>
    </div>
  );
}

// ── Agrupar registros por semana (lunes a domingo) ──────────────────────
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

// ── Detalle de una semana ────────────────────────────────────────────────
function DetalleSemana({ semana, onBack, onBorrar }) {
  const monday = new Date(semana.mondayKey + 'T12:00:00');
  const dias = weekDates(monday);
  const isCurrentWeek = dateStr(monday) === dateStr(getMonday(new Date()));

  return (
    <div style={{maxWidth:480,margin:'0 auto',padding:16,background:'#F0FFF4',
                 minHeight:'calc(100vh - 70px)',fontFamily:'Segoe UI,Arial,sans-serif'}}>
      <button onClick={onBack} style={{border:'none',background:'#EDF2F7',borderRadius:10,cursor:'pointer',
        padding:'8px 16px',fontWeight:700,color:'#4A5568',marginBottom:16,touchAction:'manipulation'}}>‹ Volver</button>

      <div style={{background:'linear-gradient(135deg,#1A4731,#276749)',borderRadius:16,padding:'18px 20px',
                   marginBottom:18,color:'#fff',boxShadow:'0 4px 16px rgba(26,71,49,0.3)'}}>
        <div style={{fontSize:13,opacity:.8}}>{fmtDate(dias[0])} – {fmtDate(dias[6])}{isCurrentWeek?' · esta semana':''}</div>
        <div style={{fontSize:32,fontWeight:900,marginTop:6,letterSpacing:-1}}>{$$(semana.totalBruto)}</div>
        <div style={{fontSize:11,opacity:.8,marginTop:6,display:'flex',gap:12,flexWrap:'wrap'}}>
          {semana.totalHoras>0 && <span>⏱️ {semana.totalHoras.toFixed(1)} hs</span>}
          {semana.totalTransferencia>0 && <span>💸 {$$(semana.totalTransferencia)} a Julieta</span>}
          {semana.totalCierreMes>0 && <span>💰 {$$(semana.totalCierreMes)} cierre de mes</span>}
        </div>
      </div>

      <div style={{background:'#fff',borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
        <div style={{background:'#1A4731',color:'#fff',padding:'11px 16px',fontWeight:700,fontSize:13}}>Detalle por día</div>
        {dias.map((d,i) => {
          const ds  = dateStr(d);
          const reg = semana.registros.find(r => r.fecha === ds);
          if (!reg) return (
            <div key={ds} style={{display:'flex',alignItems:'center',padding:'10px 14px',
              borderBottom:i<6?'1px solid #F0FFF4':'none',opacity:.4}}>
              <div style={{flex:1,fontSize:13,color:'#A0AEC0'}}>{DIAS[d.getDay()]} {fmtDate(d)}</div>
              <span style={{fontSize:12,color:'#CBD5E0'}}>sin registro</span>
            </div>
          );
          return (
            <div key={ds} style={{display:'flex',alignItems:'center',padding:'11px 14px',
              borderBottom:i<6?'1px solid #F0FFF4':'none',background:'#fff'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:'#1A365D'}}>
                  {DIAS[d.getDay()]} {fmtDate(d)}
                  {reg.transferencia>0 && <span style={{marginLeft:6,fontSize:10,background:'#EBF8FF',color:'#2B6CB0',borderRadius:4,padding:'1px 5px'}}>💸</span>}
                  {reg.efectivoCierreMes>0 && <span style={{marginLeft:4,fontSize:10,background:'#FFF5EB',color:'#C05621',borderRadius:4,padding:'1px 5px'}}>💰 cierre</span>}
                  {reg.horas>0 && <span style={{marginLeft:4,fontSize:10,background:'#FAF5FF',color:'#553C9A',borderRadius:4,padding:'1px 5px'}}>⏱️{reg.horas}h</span>}
                </div>
                <div style={{fontSize:11,color:'#A0AEC0',marginTop:2,display:'flex',gap:10,flexWrap:'wrap'}}>
                  {reg.uber>0 && <span style={{color:'#276749'}}>Uber {$$(reg.uber)}</span>}
                  {reg.didi>0 && <span style={{color:'#C53030'}}>DiDi {$$(reg.didi)}</span>}
                  {reg.transferencia>0 && <span style={{color:'#2B6CB0'}}>→Juliet {$$(reg.transferencia)}</span>}
                  {reg.efectivoCierreMes>0 && <span style={{color:'#C05621'}}>Depósito {$$(reg.efectivoCierreMes)}</span>}
                </div>
              </div>
              <div style={{fontWeight:900,fontSize:15,color:'#1A4731',marginRight:10}}>{reg.total>0?$$(reg.total):'—'}</div>
              <button onClick={()=>onBorrar(reg.id)} style={{border:'none',background:'none',cursor:'pointer',color:'#CBD5E0',fontSize:20,touchAction:'manipulation'}}>×</button>
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
    // No esperamos la sincronización de red para liberar el botón — el registro ya está aplicado localmente
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

  const saveBg = { idle:'#276749', saving:'#A0AEC0', saved:'#2B6CB0', error:'#E53E3E' }[status];
  const saveTx = { idle:'✓  Registrar', saving:'Guardando...', saved:'✓  Guardado', error:'⚠️  Ingresá al menos un monto' }[status];

  return (
    <div style={{maxWidth:480,margin:'0 auto',padding:16,background:'#F0FFF4',
                 minHeight:'calc(100vh - 70px)',overflowY:'auto',fontFamily:'Segoe UI,Arial,sans-serif'}}>

      <div style={{background:'linear-gradient(135deg,#1A4731,#276749)',borderRadius:16,padding:'18px 20px',
                   marginBottom:20,color:'#fff',boxShadow:'0 4px 16px rgba(26,71,49,0.3)'}}>
        <div style={{fontSize:20,fontWeight:800}}>🚗 Ganancias del día</div>
        <div style={{fontSize:12,opacity:.75,marginTop:3}}>Uber · DiDi · Germán</div>
      </div>

      <div style={{background:'#F7FAFC',borderRadius:16,padding:'18px 16px',marginBottom:16,boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>
        <BigField label="Uber" color="#276749" value={uber} onChange={setUber}/>
        <BigField label="DiDi" color="#C53030" value={didi} onChange={setDidi}/>

        <div style={{background:total>0?'#F0FFF4':'#EDF2F7',borderRadius:12,padding:'12px 16px',marginBottom:16,
                     display:'flex',justifyContent:'space-between',alignItems:'center',
                     border:`1.5px solid ${total>0?'#9AE6B4':'#E2E8F0'}`}}>
          <span style={{fontSize:14,fontWeight:700,color:'#4A5568'}}>Total del día</span>
          <span style={{fontSize:24,fontWeight:900,color:total>0?'#276749':'#A0AEC0'}}>{total>0?$$(total):'—'}</span>
        </div>

        <HorasField value={horas} onChange={setHoras}/>

        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,color:'#718096',marginBottom:6,fontWeight:600}}>📅 Fecha del registro</div>
          <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} max={hoy()}
            style={{width:'100%',padding:'11px 14px',borderRadius:10,border:'1.5px solid #E2E8F0',
                    fontSize:15,outline:'none',color:'#2D3748',background:'#fff'}}/>
          {fecha!==hoy() && <div style={{fontSize:11,color:'#C05621',marginTop:4,fontWeight:600}}>⚠️ Registrando para el {fecha.split('-').reverse().join('/')} — no hoy</div>}
        </div>

        {esDomingo && (
          <div style={{background:'#EBF8FF',borderRadius:12,padding:'14px',marginBottom:16,border:'1.5px solid #90CDF4'}}>
            <div style={{fontSize:13,fontWeight:800,color:'#2B6CB0',marginBottom:12}}>🗓️ Cierre dominical — {fecha.split('-').reverse().slice(0,2).join('/')}</div>
            <SmallField label="Transferencia a Julieta" emoji="💸" value={transferencia} onChange={setTransferencia}/>
            <SmallField label="Efectivo que me queda" emoji="💵" value={efectivoEnMano} onChange={setEfectivoEnMano}/>
            {n(transferencia)>0 && <div style={{fontSize:11,color:'#2B6CB0',marginTop:4}}>✓ Se registra como ingreso de Germán en el mes</div>}
          </div>
        )}

        {esCierreMes && (
          <div style={{background:'#FFF5EB',borderRadius:12,padding:'14px',marginBottom:16,border:'1.5px solid #F6AD55'}}>
            <div style={{fontSize:13,fontWeight:800,color:'#C05621',marginBottom:12}}>📦 Cierre de mes — {fecha.split('-').reverse().slice(0,2).join('/')}</div>
            <SmallField label="Efectivo depositado" emoji="💰" value={efectivoCierreMes} onChange={setEfectivoCierreMes} color="#C05621"/>
            <div style={{fontSize:11,color:'#C05621',marginTop:4}}>✓ Este monto también suma como ingreso de Germán en Principal</div>
          </div>
        )}

        <button onClick={registrar} style={{width:'100%',padding:'15px',border:'none',borderRadius:13,cursor:'pointer',
          fontSize:16,fontWeight:800,color:'#fff',background:saveBg,boxShadow:'0 4px 12px rgba(0,0,0,0.15)',
          transition:'background .3s',touchAction:'manipulation'}}>
          {saveTx}
        </button>
      </div>

      {/* Vista semanal — reemplaza la lista de "recientes" */}
      {semanas.length > 0 && (
        <div style={{background:'#fff',borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
          <div style={{background:'#1A4731',color:'#fff',padding:'11px 16px',fontWeight:700,fontSize:13}}>Semanas</div>
          {semanas.map((s,i) => {
            const monday = new Date(s.mondayKey + 'T12:00:00');
            const sunday = new Date(monday); sunday.setDate(monday.getDate()+6);
            const isCurrent = s.mondayKey === semanaActualKey;
            return (
              <div key={s.mondayKey} onClick={()=>setSelSemana(s.mondayKey)}
                style={{display:'flex',alignItems:'center',padding:'12px 14px',cursor:'pointer',touchAction:'manipulation',
                        borderBottom:i<semanas.length-1?'1px solid #F0FFF4':'none',
                        background: isCurrent ? '#EBF8FF' : i%2===0 ? '#fff' : '#F9FFFC'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#1A365D'}}>
                    {fmtDate(monday)} – {fmtDate(sunday)}
                    {isCurrent && <span style={{marginLeft:6,fontSize:9,background:'#2B6CB0',color:'white',borderRadius:4,padding:'1px 5px'}}>esta semana</span>}
                  </div>
                  <div style={{fontSize:11,color:'#A0AEC0',marginTop:2,display:'flex',gap:8,flexWrap:'wrap'}}>
                    <span>{s.registros.length} día{s.registros.length>1?'s':''}</span>
                    {s.totalHoras>0 && <span>⏱️ {s.totalHoras.toFixed(1)}hs</span>}
                    {s.totalTransferencia>0 && <span>💸 {$$(s.totalTransferencia)}</span>}
                  </div>
                </div>
                <span style={{fontWeight:900,fontSize:16,color:'#1A4731',marginRight:8}}>{$$(s.totalBruto)}</span>
                <span style={{color:'#A0AEC0',fontSize:14}}>›</span>
              </div>
            );
          })}
        </div>
      )}

      {semanas.length === 0 && (
        <div style={{textAlign:'center',padding:'30px 20px',color:'#A0AEC0'}}>
          <div style={{fontSize:40,marginBottom:8}}>📋</div>
          <div style={{fontSize:13}}>Todavía no hay registros</div>
        </div>
      )}
    </div>
  );
}
