import { useState } from 'react';
import { $$, n, getKey, getMonday, weekDates, dateStr, monthOf, fmtDate } from '../utils.js';

function ResultadoCard({ label, valor }) {
  const ok = valor >= 0;
  return (
    <div className={`flex justify-between items-center px-4 py-2.5 border-t-2 border-border-soft ${ok ? 'bg-positive-soft' : 'bg-negative-soft'}`}>
      <div>
        <div className={`text-[13px] font-bold ${ok ? 'text-positive' : 'text-negative'}`}>{label}</div>
        {!ok && <div className="text-[11px] text-negative mt-0.5">Gasto hormiga — plata no registrada</div>}
        {ok && <div className="text-[11px] text-positive mt-0.5">✓ OK</div>}
      </div>
      <div className={`text-xl font-extrabold tabular-nums ${ok ? 'text-positive' : 'text-negative'}`}>
        {ok ? $$(valor) : `-${$$(Math.abs(valor))}`}
      </div>
    </div>
  );
}

function LineaInfo({ label, valor, color, sub }) {
  return (
    <div className={`flex justify-between items-center border-t border-border-soft ${sub ? 'pl-7 pr-4 py-1.5 bg-[#FAFAFA]' : 'px-4 py-2.5 bg-white'}`}>
      <span className={`${sub ? 'text-xs' : 'text-[13px]'} text-muted`}>{label}</span>
      <span className="text-[13px] font-bold tabular-nums" style={{ color: color || 'var(--color-ink)' }}>{$$(valor)}</span>
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
    <div className="max-w-[640px] mx-auto p-4 bg-paper min-h-[calc(100vh-70px)]">
      <div className="rounded-2xl px-5 py-4.5 mb-4.5 text-white shadow-md flex justify-between items-center bg-tab-control">
        <div>
          <div className="text-xl font-extrabold tracking-tight">📊 Control</div>
          <div className="text-xs opacity-75 mt-0.5">Seguimiento semanal de flujo de dinero</div>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="bg-white/15 border border-white/30 rounded-lg text-white px-2.5 py-1.5 cursor-pointer text-xs font-bold touch-manipulation">
          {refreshing ? '...' : '↻'}
        </button>
      </div>

      <div className="flex bg-border-soft rounded-xl p-1 mb-3.5 gap-0.5">
        {[['semana','📅 Semana'],['mes','🗓️ Este mes']].map(([k,label]) => (
          <button key={k} onClick={() => setFiltro(k)}
            className={`flex-1 py-2.5 border-none rounded-lg cursor-pointer font-bold text-[13px] touch-manipulation transition-colors
              ${filtro===k ? 'bg-white text-ink shadow-sm' : 'bg-transparent text-muted'}`}>{label}</button>
        ))}
      </div>

      {filtro === 'semana' && (
        <div className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 mb-3.5 shadow-sm">
          <button onClick={prevWeek} className="border-none bg-none cursor-pointer text-2xl text-muted px-2 touch-manipulation">‹</button>
          <div className="text-center">
            <div className="font-bold text-ink text-sm">{fmtDate(wDates[0])} – {fmtDate(wDates[6])}</div>
            {isCurrentWeek && <div className="text-[11px] text-muted-light">Semana actual</div>}
          </div>
          <button onClick={nextWeek} className="border-none bg-none cursor-pointer text-2xl text-muted px-2 touch-manipulation">›</button>
        </div>
      )}

      <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
        <div className="bg-german text-white px-4 py-2.5 font-bold text-[13px]">👨 Germán</div>
        {brutoUD > 0 ? <>
          <LineaInfo label="Bruto Uber/DiDi" valor={brutoUD} color="var(--color-german)"/>
          <LineaInfo label="Transferido a Julieta" valor={transferido} color="var(--color-tab-tarjetas)"/>
          <LineaInfo label="Efectivo en mano" valor={efectivo} color="var(--color-german)"/>
          {efectivo === 0 && <div className="px-4 py-1.5 text-[11px] text-muted-light border-t border-border-soft">Sin efectivo registrado {filtro==='semana'?'este domingo':'este mes'}.</div>}
          <LineaInfo label="Gastos Zapia de Germán" valor={gastosZapiaGerm} color="var(--color-tab-gastos)"/>
          <ResultadoCard label="Resultado Germán" valor={resultadoGerman}/>
        </> : (
          <div className="p-5 text-center text-muted-light text-[13px]">
            Sin ganancias registradas {filtro==='semana'?'esta semana':'este mes'}.<br/><span className="text-[11px]">Cargalas desde <strong>Ganancias</strong>.</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
        <div className="bg-julieta text-white px-4 py-2.5 font-bold text-[13px]">👩 Julieta</div>
        <LineaInfo label="Transferido a Julieta" valor={transferido} color="var(--color-tab-tarjetas)"/>
        <LineaInfo label="Gastos Zapia via transferencia" valor={gastosZapiaJuli} color="var(--color-tab-gastos)"/>
        <div className="px-4 py-3 border-t border-border-soft">
          <div className="text-xs text-muted mb-2 font-semibold">
            💳 Saldo real en cuenta — {filtro==='semana' ? `domingo ${fmtDate(sunday)}` : `último domingo del mes`}
          </div>
          {saldoJuli > 0 && !saldoJuliInput && (
            <div className="text-sm font-bold text-ink mb-2">
              Registrado: {$$(saldoJuli)}
              <button onClick={() => setSaldoJuliInput(String(saldoJuli))}
                className="ml-2.5 border-none bg-border-soft rounded-md cursor-pointer text-[11px] text-muted px-2 py-0.5 touch-manipulation">editar</button>
            </div>
          )}
          <div className="flex gap-2">
            <div className={`flex-1 flex items-center bg-[#FAFAFA] rounded-lg border-[1.5px] px-3 py-1.5 gap-1 ${saldoJuliInput?'border-julieta':'border-border'}`}>
              <span className="text-muted-light font-semibold">$</span>
              <input type="number" inputMode="numeric" min="0" value={saldoJuliInput}
                onChange={e => setSaldoJuliInput(e.target.value)} placeholder="0"
                className="flex-1 border-none outline-none text-lg font-bold text-ink bg-transparent tabular-nums"/>
            </div>
            <button onClick={guardarSaldoJuli} disabled={!saldoJuliInput || saving}
              className={`px-4 py-2 border-none rounded-lg cursor-pointer font-bold text-[13px] text-white touch-manipulation ${saving ? 'bg-muted-light' : 'bg-julieta'}`}>{saving ? '...' : 'Guardar'}</button>
          </div>
          <div className="text-[11px] text-muted-light mt-1.5">Lo carga Julieta el domingo o al cierre del mes.</div>
        </div>
        {(transferido > 0 || gastosZapiaJuli > 0 || saldoJuli > 0) && <ResultadoCard label="Resultado Julieta" valor={resultadoJulieta}/>}
        {transferido === 0 && <div className="p-4 text-center text-muted-light text-[13px]">Sin transferencias registradas {filtro==='semana'?'esta semana':'este mes'}.</div>}
      </div>
    </div>
  );
}
