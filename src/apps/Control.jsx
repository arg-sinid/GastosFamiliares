import { useState } from 'react';
import { $$, n, getKey, getMonday, weekDates, dateStr, monthOf, fmtDate } from '../utils.js';

function ResultadoCard({ label, valor }) {
  const ok = valor >= 0;
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'11px 16px', background: ok ? '#F0FFF4' : '#FFF5F5', borderTop:'2px solid #EDF2F7' }}>
      <div>
        <div style={{ fontSize:13, fontWeight:700, color: ok ? '#276749' : '#C53030' }}>{label}</div>
        {!ok && <div style={{ fontSize:11, color:'#C53030', marginTop:2 }}>Gasto hormiga — plata no registrada</div>}
        {ok && <div style={{ fontSize:11, color:'#276749', marginTop:2 }}>✓ OK</div>}
      </div>
      <div style={{ fontSize:20, fontWeight:900, color: ok ? '#276749' : '#C53030' }}>
        {ok ? $$(valor) : `-${$$(Math.abs(valor))}`}
      </div>
    </div>
  );
}

function LineaInfo({ label, valor, color, sub }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding: sub ? '6px 16px 6px 28px' : '9px 16px', borderTop:'1px solid #EDF2F7',
                  background: sub ? '#FAFAFA' : '#fff' }}>
      <span style={{ fontSize: sub ? 12 : 13, color:'#718096' }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:700, color: color||'#2D3748' }}>{$$(valor)}</span>
    </div>
  );
}

export default function Control({ appData, saveData, zapiaData, onRefresh }) {
  const today = new Date();
  const [filtro, setFiltro]   = useState('semana');
  const [monday, setMonday]   = useState(() => getMonday(today));
  const [saldoJuliInput, setSaldoJuliInput] = useState('');
  const [saving, setSaving]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => { setRefreshing(true); await onRefresh?.(); setRefreshing(false); };

  const wDates    = weekDates(monday);
  const sunday    = wDates[6];
  const sundayStr = dateStr(sunday);
  const wStr      = wDates.map(d => dateStr(d));
  const mesKey    = getKey(today);

  const uberDiDi     = appData.uberDiDi     || [];
  const saldoJulieta = appData.saldoJulieta || {};

  const inPeriod = fecha => {
    if (!fecha) return false;
    if (filtro === 'semana') return wStr.includes(fecha);
    return monthOf(fecha) === mesKey;
  };

  const periodUD    = uberDiDi.filter(r => inPeriod(r.fecha));
  const periodZapia = zapiaData.filter(r => inPeriod(r.fecha));

  const brutoUD         = periodUD.reduce((s,r) => s + (r.total || 0), 0);
  const transferido     = periodUD.reduce((s,r) => s + (r.transferencia || 0), 0);
  const gastosZapiaGerm = periodZapia.filter(r => r.quien === 'Germán').reduce((s,r) => s + r.costo, 0);

  const getEfectivo = () => {
    if (filtro === 'semana') { const rec = uberDiDi.find(r => r.fecha === sundayStr); return n(rec?.efectivoEnMano); }
    const recs = uberDiDi.filter(r => monthOf(r.fecha) === mesKey && r.efectivoEnMano > 0).sort((a,b) => b.fecha.localeCompare(a.fecha));
    return n(recs[0]?.efectivoEnMano);
  };
  const efectivo = getEfectivo();
  const resultadoGerman = brutoUD - transferido - efectivo - gastosZapiaGerm;

  const gastosZapiaJuli = periodZapia.filter(r => r.quien === 'Julieta' && r.medio === 'transferencia').reduce((s,r) => s + r.costo, 0);

  const getSaldoJuli = () => {
    if (filtro === 'semana') return n(saldoJulieta[sundayStr]);
    const keys = Object.keys(saldoJulieta).filter(k => monthOf(k) === mesKey).sort();
    return keys.length ? n(saldoJulieta[keys[keys.length - 1]]) : 0;
  };
  const saldoJuli = getSaldoJuli();
  const resultadoJulieta = transferido - gastosZapiaJuli - saldoJuli;

  const guardarSaldoJuli = async () => {
    if (!saldoJuliInput) return;
    setSaving(true);
    const updated = { ...saldoJulieta, [sundayStr]: n(saldoJuliInput) };
    await saveData({ ...appData, saldoJulieta: updated });
    setSaldoJuliInput('');
    setSaving(false);
  };

  const prevWeek = () => { const d=new Date(monday); d.setDate(d.getDate()-7); setMonday(d); };
  const nextWeek = () => { const d=new Date(monday); d.setDate(d.getDate()+7); setMonday(d); };
  const isCurrentWeek = sundayStr === dateStr(weekDates(getMonday(today))[6]);

  return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:16, background:'#F7FAFC',
                  minHeight:'calc(100vh - 70px)', fontFamily:'Segoe UI,Arial,sans-serif' }}>
      <div style={{ background:'linear-gradient(135deg,#2D3748,#4A5568)', borderRadius:16,
                    padding:'18px 20px', marginBottom:18, color:'#fff', boxShadow:'0 4px 16px rgba(45,55,72,0.3)',
                    display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:21, fontWeight:800, letterSpacing:-.5 }}>📊 Control</div>
          <div style={{ fontSize:12, opacity:.75, marginTop:3 }}>Seguimiento semanal de flujo de dinero</div>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:9,color:'white',
                  padding:'7px 11px',cursor:'pointer',fontSize:12,fontWeight:700,touchAction:'manipulation'}}>
          {refreshing ? '...' : '↻'}
        </button>
      </div>

      <div style={{ display:'flex', background:'#E2E8F0', borderRadius:12, padding:4, marginBottom:14, gap:3 }}>
        {[['semana','📅 Semana'],['mes','🗓️ Este mes']].map(([k,label]) => (
          <button key={k} onClick={() => setFiltro(k)} style={{ flex:1, padding:'9px 0', border:'none',
            borderRadius:9, cursor:'pointer', fontWeight:700, fontSize:13,
            background:filtro===k?'#fff':'transparent', color:filtro===k?'#2D3748':'#718096',
            boxShadow:filtro===k?'0 1px 4px rgba(0,0,0,0.1)':'none', touchAction:'manipulation' }}>{label}</button>
        ))}
      </div>

      {filtro === 'semana' && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                      background:'#fff', borderRadius:12, padding:'10px 16px', marginBottom:14, boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }}>
          <button onClick={prevWeek} style={{ border:'none', background:'none', cursor:'pointer', fontSize:22, color:'#4A5568', padding:'0 8px', touchAction:'manipulation' }}>‹</button>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontWeight:700, color:'#2D3748', fontSize:14 }}>{fmtDate(wDates[0])} – {fmtDate(wDates[6])}</div>
            {isCurrentWeek && <div style={{ fontSize:11, color:'#A0AEC0' }}>Semana actual</div>}
          </div>
          <button onClick={nextWeek} style={{ border:'none', background:'none', cursor:'pointer', fontSize:22, color:'#4A5568', padding:'0 8px', touchAction:'manipulation' }}>›</button>
        </div>
      )}

      <div style={{ background:'#fff', borderRadius:14, overflow:'hidden', marginBottom:14, boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ background:'#276749', color:'#fff', padding:'10px 16px', fontWeight:700, fontSize:13 }}>👨 Germán</div>
        {brutoUD > 0 ? <>
          <LineaInfo label="Bruto Uber/DiDi" valor={brutoUD} color="#276749"/>
          <LineaInfo label="Transferido a Julieta" valor={transferido} color="#2B6CB0"/>
          <LineaInfo label="Efectivo en mano" valor={efectivo} color="#276749"/>
          {efectivo === 0 && <div style={{ padding:'7px 16px', fontSize:11, color:'#A0AEC0', borderTop:'1px solid #EDF2F7' }}>Sin efectivo registrado {filtro==='semana'?'este domingo':'este mes'}.</div>}
          <LineaInfo label="Gastos Zapia de Germán" valor={gastosZapiaGerm} color="#744210"/>
          <ResultadoCard label="Resultado Germán" valor={resultadoGerman}/>
        </> : (
          <div style={{ padding:'20px', textAlign:'center', color:'#A0AEC0', fontSize:13 }}>
            Sin ganancias registradas {filtro==='semana'?'esta semana':'este mes'}.<br/><span style={{ fontSize:11 }}>Cargalas desde <strong>Ganancias</strong>.</span>
          </div>
        )}
      </div>

      <div style={{ background:'#fff', borderRadius:14, overflow:'hidden', marginBottom:14, boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ background:'#D53F8C', color:'#fff', padding:'10px 16px', fontWeight:700, fontSize:13 }}>👩 Julieta</div>
        <LineaInfo label="Transferido a Julieta" valor={transferido} color="#2B6CB0"/>
        <LineaInfo label="Gastos Zapia via transferencia" valor={gastosZapiaJuli} color="#744210"/>
        <div style={{ padding:'12px 16px', borderTop:'1px solid #EDF2F7' }}>
          <div style={{ fontSize:12, color:'#718096', marginBottom:8, fontWeight:600 }}>
            💳 Saldo real en cuenta — {filtro==='semana' ? `domingo ${fmtDate(sunday)}` : `último domingo del mes`}
          </div>
          {saldoJuli > 0 && !saldoJuliInput && (
            <div style={{ fontSize:14, fontWeight:700, color:'#2D3748', marginBottom:8 }}>
              Registrado: {$$(saldoJuli)}
              <button onClick={() => setSaldoJuliInput(String(saldoJuli))}
                style={{ marginLeft:10, border:'none', background:'#EDF2F7', borderRadius:6, cursor:'pointer', fontSize:11, color:'#718096', padding:'2px 8px', touchAction:'manipulation' }}>editar</button>
            </div>
          )}
          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1, display:'flex', alignItems:'center', background:'#FAFAFA', borderRadius:10,
                          border:`1.5px solid ${saldoJuliInput?'#D53F8C':'#E2E8F0'}`, padding:'6px 12px', gap:4 }}>
              <span style={{ color:'#A0AEC0', fontWeight:600 }}>$</span>
              <input type="number" inputMode="numeric" min="0" value={saldoJuliInput}
                onChange={e => setSaldoJuliInput(e.target.value)} placeholder="0"
                style={{ flex:1, border:'none', outline:'none', fontSize:18, fontWeight:700, color:'#1A365D', background:'transparent' }}/>
            </div>
            <button onClick={guardarSaldoJuli} disabled={!saldoJuliInput || saving}
              style={{ padding:'8px 16px', border:'none', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:13, color:'#fff',
                       background: saving ? '#A0AEC0' : '#D53F8C', touchAction:'manipulation' }}>{saving ? '...' : 'Guardar'}</button>
          </div>
          <div style={{ fontSize:11, color:'#A0AEC0', marginTop:6 }}>Lo carga Julieta el domingo o al cierre del mes.</div>
        </div>
        {(transferido > 0 || gastosZapiaJuli > 0 || saldoJuli > 0) && <ResultadoCard label="Resultado Julieta" valor={resultadoJulieta}/>}
        {transferido === 0 && <div style={{ padding:'16px', textAlign:'center', color:'#A0AEC0', fontSize:13 }}>Sin transferencias registradas {filtro==='semana'?'esta semana':'este mes'}.</div>}
      </div>

      {(brutoUD > 0 || transferido > 0) && (
        <div style={{ background:'#fff', borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ background:'#2D3748', color:'#fff', padding:'10px 16px', fontWeight:700, fontSize:13 }}>📊 Resumen del período</div>
          {brutoUD > 0 && <LineaInfo label="Total bruto Uber/DiDi" valor={brutoUD} color="#276749"/>}
          {transferido > 0 && <LineaInfo label="Total transferido a Julieta" valor={transferido} color="#2B6CB0"/>}
          {(gastosZapiaGerm + gastosZapiaJuli) > 0 && <LineaInfo label="Total gastos Zapia" valor={gastosZapiaGerm + gastosZapiaJuli} color="#744210"/>}
          {gastosZapiaGerm > 0 && <LineaInfo label="  · Germán" valor={gastosZapiaGerm} color="#744210" sub/>}
          {gastosZapiaJuli > 0 && <LineaInfo label="  · Julieta" valor={gastosZapiaJuli} color="#D53F8C" sub/>}
        </div>
      )}
    </div>
  );
}
