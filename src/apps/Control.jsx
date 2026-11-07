import { useState } from 'react';
import {
  $$, n, getKey, getMonday, weekDates, dateStr, monthOf, fmtDate, hoy,
  calcularConciliaciones, calcularPeriodoAbierto, conciliarGerman,
} from '../utils.js';

// Diferencia de conciliación: negativa = salió plata sin registrar (gasto hormiga),
// positiva = sobra plata. Es solo un control: NUNCA se resta del resultado mensual.
function DiferenciaCard({ label, diferencia }) {
  const cero = Math.round(diferencia) === 0;
  const hormiga = diferencia < 0;
  const tono = cero ? 'positive' : hormiga ? 'negative' : 'accent';
  const bg  = { positive:'bg-positive-soft', negative:'bg-negative-soft', accent:'bg-accent-soft' }[tono];
  const txt = { positive:'text-positive', negative:'text-negative', accent:'text-accent-strong' }[tono];
  return (
    <div className={`flex justify-between items-center px-4 py-2.5 border-t-2 border-border-soft ${bg}`}>
      <div>
        <div className={`text-[13px] font-bold ${txt}`}>{label}</div>
        <div className={`text-[11px] mt-0.5 ${txt}`}>
          {cero ? '✓ Cierra justo' : hormiga ? 'Gasto hormiga: salió plata que no está registrada' : 'Sobrante: hay más plata de la esperada'}
        </div>
      </div>
      <div className={`text-xl font-extrabold tabular-nums ${txt}`}>{diferencia < 0 ? `-${$$(Math.abs(diferencia))}` : $$(diferencia)}</div>
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

export default function Control({ appData, saveData, zapiaData, onRefresh, mesKey, embebido }) {
  const today = new Date();
  const [filtro, setFiltro]   = useState('semana');
  const [monday, setMonday]   = useState(() => getMonday(today));
  const [saldoJuliInput, setSaldoJuliInput] = useState('');
  const [saving, setSaving]   = useState(false);
  const [fechaCarga, setFechaCarga] = useState(hoy());     // Julieta puede declarar en cualquier fecha
  const [edit, setEdit] = useState(null);                    // edición de un saldo ya declarado: { fecha, nuevaFecha, monto }
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => { setRefreshing(true); await onRefresh?.(); setRefreshing(false); };

  const wDates    = weekDates(monday);
  const sunday    = wDates[6];
  const sundayStr = dateStr(sunday);
  const wStr      = wDates.map(d => dateStr(d));
  const mes       = mesKey || getKey(today);
  const hoyStr    = hoy();

  const uberDiDi     = appData.uberDiDi     || [];
  const saldoJulieta = appData.saldoJulieta || {};

  const inPeriod = fecha => !!fecha && (filtro === 'semana' ? wStr.includes(fecha) : monthOf(fecha) === mes);
  const periodUD    = uberDiDi.filter(r => inPeriod(r.fecha));
  const periodZapia = (zapiaData||[]).filter(r => inPeriod(r.fecha));

  // ── Germán: su bruto se usa para sus gastos, lo girado/depositado a Uala y el efectivo que queda.
  const brutoUD = periodUD.reduce((s,r) => s + n(r.total), 0);
  const aportes = periodUD.reduce((s,r) => s + n(r.transferencia) + n(r.efectivoCierreMes), 0);
  const gastosGerman = periodZapia.filter(r => r.quien === 'Germán').reduce((s,r) => s + n(r.costo), 0);
  const getEfectivo = () => {
    if (filtro === 'semana') return n(uberDiDi.find(r => r.fecha === sundayStr)?.efectivoEnMano);
    const recs = uberDiDi.filter(r => monthOf(r.fecha) === mes && n(r.efectivoEnMano) > 0).sort((a,b) => b.fecha.localeCompare(a.fecha));
    return n(recs[0]?.efectivoEnMano);
  };
  const efectivo = getEfectivo();
  const cg = conciliarGerman({ bruto:brutoUD, gastos:gastosGerman, aportes, efectivo });

  // ── Julieta: conciliación de la cuenta Uala
  const periodos = calcularConciliaciones(saldoJulieta, uberDiDi, zapiaData);
  // Los períodos se identifican por la fecha de cierre (la carga del saldo real), que puede ser cualquier día.
  const periodosRango = periodos.filter(p => filtro === 'semana' ? wStr.includes(p.fechaFin) : p.fechaFin.slice(0,7) === mes);
  const hayConciliacion = periodosRango.length > 0;
  const abierto = calcularPeriodoAbierto(saldoJulieta, uberDiDi, zapiaData, hoyStr);
  const mostrarAbierto = !hayConciliacion && abierto && (filtro === 'semana' || mes === hoyStr.slice(0,7));
  const suma = (campo) => periodosRango.reduce((s,p) => s + p[campo], 0);
  const vista = hayConciliacion ? {
    saldoIni: periodosRango[0].saldoIni, saldoReal: periodosRango[periodosRango.length-1].saldoReal,
    transferido: suma('transferido'), deposito: suma('deposito'), gastosJulieta: suma('gastosJulieta'),
    esperado: periodosRango[periodosRango.length-1].esperado, diferencia: suma('diferencia'),
  } : null;

  const fechasRango = Object.keys(saldoJulieta).filter(k => filtro === 'semana' ? wStr.includes(k) : monthOf(k) === mes).sort();
  const fechaSaldo = fechasRango.length ? fechasRango[fechasRango.length-1] : null;
  const saldoActual = fechaSaldo ? saldoJulieta[fechaSaldo] : undefined;

  const guardarSaldoJuli = async () => {
    if (!saldoJuliInput || !fechaCarga) return;
    setSaving(true);
    // Una carga por fecha: volver a cargar el mismo día reemplaza, no suma otra conciliación.
    await saveData({ ...appData, saldoJulieta: { ...saldoJulieta, [fechaCarga]: n(saldoJuliInput) } });
    setSaldoJuliInput(''); setSaving(false);
  };

  const todasLasCargas = Object.keys(saldoJulieta).sort().reverse();
  const fdl = f => f.split('-').reverse().join('/');
  const guardarEdicion = async () => {
    if (!edit || !edit.nuevaFecha || edit.monto === '') return;
    const nx = { ...saldoJulieta };
    if (edit.nuevaFecha !== edit.fecha && nx[edit.nuevaFecha] !== undefined && !window.confirm(`Ya hay un saldo cargado el ${fdl(edit.nuevaFecha)}. ¿Reemplazarlo?`)) return;
    delete nx[edit.fecha]; nx[edit.nuevaFecha] = n(edit.monto);
    await saveData({ ...appData, saldoJulieta: nx });
    setEdit(null);
  };
  const borrarCarga = async (fecha) => {
    if (!window.confirm(`¿Borrar el saldo declarado del ${fdl(fecha)} (${$$(saldoJulieta[fecha])})?`)) return;
    const nx = { ...saldoJulieta }; delete nx[fecha];
    await saveData({ ...appData, saldoJulieta: nx });
  };

  const prevWeek = () => { const d=new Date(monday); d.setDate(d.getDate()-7); setMonday(d); };
  const nextWeek = () => { const d=new Date(monday); d.setDate(d.getDate()+7); setMonday(d); };
  const isCurrentWeek = sundayStr === dateStr(weekDates(getMonday(today))[6]);

  return (
    <div className={embebido ? '' : 'max-w-[640px] mx-auto p-4 bg-paper min-h-[calc(100vh-70px)]'}>
      {!embebido && (
        <div className="rounded-2xl px-5 py-4.5 mb-4.5 text-white shadow-md flex justify-between items-center bg-tab-control">
          <div>
            <div className="text-xl font-extrabold tracking-tight">📊 Control</div>
            <div className="text-xs opacity-75 mt-0.5">Conciliación semanal de la cuenta Uala</div>
          </div>
          <button onClick={handleRefresh} disabled={refreshing}
            className="bg-white/15 border border-white/30 rounded-lg text-white px-2.5 py-1.5 cursor-pointer text-xs font-bold touch-manipulation">{refreshing ? '...' : '↻'}</button>
        </div>
      )}

      <div className="flex bg-border-soft rounded-xl p-1 mb-3.5 gap-0.5">
        {[['semana','📅 Semana'],['mes','🗓️ Mes']].map(([k,label]) => (
          <button key={k} onClick={() => setFiltro(k)}
            className={`flex-1 py-2.5 border-none rounded-lg cursor-pointer font-bold text-[13px] touch-manipulation transition-colors ${filtro===k ? 'bg-white text-ink shadow-sm' : 'bg-transparent text-muted'}`}>{label}</button>
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
        <div className="bg-german text-white px-4 py-2.5 font-bold text-[13px]">👨 Germán — del bruto a la Uala</div>
        {brutoUD > 0 ? <>
          <LineaInfo label="Bruto Uber/DiDi" valor={brutoUD} color="var(--color-german)"/>
          <LineaInfo label="Mis gastos (Zapia, efectivo y transferencia)" valor={gastosGerman} color="var(--color-tab-gastos)"/>
          <LineaInfo label="Girado / depositado a la Uala de Julieta" valor={aportes} color="var(--color-tab-tarjetas)"/>
          <LineaInfo label="Efectivo que me queda" valor={efectivo} color="var(--color-german)"/>
          {efectivo === 0 && <div className="px-4 py-1.5 text-[11px] text-muted-light border-t border-border-soft">Sin efectivo registrado {filtro==='semana'?'este domingo':'este mes'}.</div>}
          <DiferenciaCard label="Diferencia Germán" diferencia={cg.diferencia}/>
        </> : (
          <div className="p-5 text-center text-muted-light text-[13px]">
            Sin ganancias registradas {filtro==='semana'?'esta semana':'este mes'}.<br/><span className="text-[11px]">Cargalas desde <strong>Auto</strong>.</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
        <div className="bg-julieta text-white px-4 py-2.5 font-bold text-[13px]">👩 Julieta — cuenta Uala</div>

        {hayConciliacion && vista ? (
          <>
            <LineaInfo label="Saldo real anterior" valor={vista.saldoIni} color="var(--color-muted)"/>
            <LineaInfo label="Gastos de Julieta por transferencia (Zapia)" valor={vista.gastosJulieta} color="var(--color-tab-gastos)"/>
            {vista.transferido > 0 && <LineaInfo label="Transferencias de Germán a la Uala" valor={vista.transferido} color="var(--color-tab-tarjetas)"/>}
            {vista.deposito > 0 && <LineaInfo label="Depósito de fin de mes" valor={vista.deposito} color="var(--color-tab-tarjetas)"/>}
            <LineaInfo label="Saldo esperado" valor={vista.esperado} color="var(--color-ink)"/>
            <LineaInfo label="Saldo real informado" valor={vista.saldoReal} color="var(--color-ink)"/>
            <DiferenciaCard label="Diferencia de conciliación" diferencia={vista.diferencia}/>
          </>
        ) : mostrarAbierto ? (
          <>
            <LineaInfo label={`Saldo real cargado el ${fmtDate(new Date(abierto.fechaInicio+'T12:00:00'))}`} valor={abierto.saldoIni} color="var(--color-muted)"/>
            <LineaInfo label="Gastos de Julieta por transferencia desde esa carga" valor={abierto.gastosJulieta} color="var(--color-tab-gastos)"/>
            {abierto.transferido > 0 && <LineaInfo label="Transferencias de Germán desde esa carga" valor={abierto.transferido} color="var(--color-tab-tarjetas)"/>}
            {abierto.deposito > 0 && <LineaInfo label="Depósito de fin de mes" valor={abierto.deposito} color="var(--color-tab-tarjetas)"/>}
            <LineaInfo label="Saldo esperado a hoy" valor={abierto.saldoEstimado} color="var(--color-ink)"/>
            <div className="px-4 py-2.5 text-[11px] text-accent-strong border-t border-border-soft bg-[#FFFBF5]">
              ⏳ Período abierto: cuando Julieta cargue su saldo real, la diferencia contra este esperado es el gasto hormiga.
            </div>
          </>
        ) : (
          <div className="px-4 py-3 text-[12px] text-muted-light border-t border-border-soft">
            {Object.keys(saldoJulieta).length
              ? 'No hay una conciliación cerrada en este período.'
              : 'Julieta todavía no cargó ningún saldo real: el primero es el punto de partida y recién el siguiente se concilia.'}
          </div>
        )}

        <div className="px-4 py-3 border-t border-border-soft">
          <div className="text-xs text-muted mb-2 font-semibold">💳 Saldo real de Uala que declara Julieta (cualquier día)</div>
          {saldoActual > 0 && !saldoJuliInput && (
            <div className="text-sm font-bold text-ink mb-2">
              Último declarado ({fmtDate(new Date(fechaSaldo+'T12:00:00'))}): {$$(saldoActual)}
              <button onClick={() => { setSaldoJuliInput(String(saldoActual)); setFechaCarga(fechaSaldo); }}
                className="ml-2.5 border-none bg-border-soft rounded-md cursor-pointer text-[11px] text-muted px-2 py-0.5 touch-manipulation">editar</button>
            </div>
          )}
          <input type="date" value={fechaCarga} max={hoy()} onChange={e => setFechaCarga(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border-[1.5px] border-border text-sm outline-none text-ink bg-white mb-2"/>
          <div className="flex gap-2">
            <div className={`flex-1 flex items-center bg-[#FAFAFA] rounded-lg border-[1.5px] px-3 py-1.5 gap-1 ${saldoJuliInput?'border-julieta':'border-border'}`}>
              <span className="text-muted-light font-semibold">$</span>
              <input type="number" inputMode="numeric" min="0" value={saldoJuliInput} onChange={e => setSaldoJuliInput(e.target.value)} placeholder="0"
                className="flex-1 border-none outline-none text-lg font-bold text-ink bg-transparent tabular-nums"/>
            </div>
            <button onClick={guardarSaldoJuli} disabled={!saldoJuliInput || !fechaCarga || saving}
              className={`px-4 py-2 border-none rounded-lg cursor-pointer font-bold text-[13px] text-white touch-manipulation ${saving ? 'bg-muted-light' : 'bg-julieta'}`}>{saving ? '...' : 'Guardar'}</button>
          </div>
          <div className="text-[11px] text-muted-light mt-1.5">Puede cargarlo cualquier día. Sobre ese saldo se descuentan sus gastos por transferencia; lo que no cierre en la próxima carga es gasto hormiga.</div>
        </div>
      </div>

      {todasLasCargas.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden mb-3.5 shadow-sm">
          <div className="bg-julieta text-white px-4 py-2.5 font-bold text-[13px] flex justify-between">
            <span>🗂️ Saldos declarados por Julieta</span><span className="text-[11px] opacity-80 font-normal">{todasLasCargas.length} cargas</span>
          </div>
          {todasLasCargas.map((f, i) => (
            <div key={f} className={`px-4 py-2.5 ${i<todasLasCargas.length-1?'border-b border-border-soft':''}`}>
              {edit && edit.fecha === f ? (
                <div>
                  <div className="flex gap-2 mb-2">
                    <input type="date" value={edit.nuevaFecha} max={hoy()} onChange={e=>setEdit({ ...edit, nuevaFecha:e.target.value })}
                      className="flex-1 px-2 py-1.5 rounded-lg border-[1.5px] border-border text-sm outline-none bg-white"/>
                    <input type="number" inputMode="numeric" min="0" value={edit.monto} onChange={e=>setEdit({ ...edit, monto:e.target.value })}
                      className="flex-1 px-2 py-1.5 rounded-lg border-[1.5px] border-julieta text-sm outline-none text-right tabular-nums"/>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={()=>setEdit(null)} className="flex-1 py-1.5 border-[1.5px] border-border rounded-lg bg-white text-muted font-semibold text-xs touch-manipulation">Cancelar</button>
                    <button onClick={guardarEdicion} className="flex-[2] py-1.5 border-none rounded-lg bg-julieta text-white font-bold text-xs touch-manipulation">Guardar cambios</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-[13px] font-semibold text-ink">{fdl(f)}</span>
                  <span className="text-[14px] font-extrabold text-ink tabular-nums">{$$(saldoJulieta[f])}</span>
                  <button onClick={()=>setEdit({ fecha:f, nuevaFecha:f, monto:String(saldoJulieta[f]) })} className="border-none bg-border-soft rounded-md cursor-pointer text-[12px] px-2 py-1 touch-manipulation">✏️</button>
                  <button onClick={()=>borrarCarga(f)} className="border-none bg-border-soft rounded-md cursor-pointer text-[12px] px-2 py-1 touch-manipulation">🗑️</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {periodos.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-ink text-white px-4 py-2.5 font-bold text-[13px]">Historial de conciliaciones</div>
          <table className="w-full border-collapse text-xs">
            <thead><tr className="bg-border-soft">
              {['Cierre','Esperado','Real','Dif.'].map(h => <th key={h} className={`px-2.5 py-2 ${h==='Cierre'?'text-left':'text-right'} text-muted font-bold border-b border-border text-[10px] uppercase`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {[...periodos].reverse().slice(0,12).map((p,i) => (
                <tr key={p.fechaFin} className={i%2===0?'bg-white':'bg-paper'}>
                  <td className="px-2.5 py-2 font-semibold text-ink">{fmtDate(new Date(p.fechaFin+'T12:00:00'))}</td>
                  <td className="px-2.5 py-2 text-right tabular-nums text-muted">{$$(p.esperado)}</td>
                  <td className="px-2.5 py-2 text-right tabular-nums text-ink">{$$(p.saldoReal)}</td>
                  <td className={`px-2.5 py-2 text-right font-bold tabular-nums ${p.diferencia<0?'text-negative':p.diferencia>0?'text-accent-strong':'text-positive'}`}>{p.diferencia<0?`-${$$(Math.abs(p.diferencia))}`:$$(p.diferencia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
