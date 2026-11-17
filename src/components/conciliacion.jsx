// Vistas de conciliación compartidas por Control y Principal. Solo MUESTRAN lo que calcula el motor.
import { $$, fmtDate } from '../utils.js';

const fd = f => fmtDate(new Date(f + 'T12:00:00'));
const neg = v => v < 0 ? `-${$$(Math.abs(v))}` : $$(v);

export function Linea({ label, valor, color, bold, signo }) {
  return (
    <div className="flex justify-between items-center px-4 py-2 border-t border-border-soft bg-white">
      <span className={`text-[13px] ${bold ? 'font-bold text-ink' : 'text-muted'}`}>{label}</span>
      <span className={`text-[13px] tabular-nums ${bold ? 'font-extrabold' : 'font-bold'}`} style={{ color: color || 'var(--color-ink)' }}>{signo}{$$(valor)}</span>
    </div>
  );
}

// Diferencia de conciliación: negativa = plata sin explicar (posible gasto hormiga); positiva = sobrante a justificar.
export function DiferenciaBox({ diferencia, etiqueta = 'Diferencia' }) {
  const cero = Math.round(diferencia) === 0, hormiga = diferencia < 0;
  const bg = cero ? 'bg-positive-soft' : hormiga ? 'bg-negative-soft' : 'bg-accent-soft';
  const tx = cero ? 'text-positive' : hormiga ? 'text-negative' : 'text-accent-strong';
  return (
    <div className={`flex justify-between items-center px-4 py-2.5 border-t-2 border-border-soft ${bg}`}>
      <div>
        <div className={`text-[13px] font-bold ${tx}`}>{etiqueta}</div>
        <div className={`text-[11px] mt-0.5 ${tx}`}>{cero ? '✓ Cierra justo' : hormiga ? 'Posible gasto hormiga o movimiento sin registrar' : 'Sobrante: falta justificar de dónde salió'}</div>
      </div>
      <div className={`text-xl font-extrabold tabular-nums ${tx}`}>{neg(diferencia)}</div>
    </div>
  );
}

// Uala de Julieta: saldo anterior confirmado + transferencias (y depósito) − gastos de Julieta por transferencia = esperado,
// contra el saldo que ella declaró. Equivale a comparar la variación esperada con la variación real del saldo.
export function ConciliacionUalaDetalle({ conciliacion }) {
  const { periodos, abierto } = conciliacion;
  const p = periodos.length ? periodos[periodos.length - 1] : null;
  if (!p && !abierto) return <div className="px-4 py-3 text-[12px] text-muted-light">Julieta todavía no declaró ningún saldo: el primero es el punto de partida y recién el siguiente se concilia.</div>;
  return (
    <div>
      {p ? (
        <>
          <div className="px-4 py-2 bg-paper text-[11px] font-bold text-muted uppercase tracking-wide">Período {fd(p.fechaInicio)} → {fd(p.fechaFin)} (declaración a declaración)</div>
          <Linea label="Saldo anterior confirmado" valor={p.saldoIni}/>
          {p.transferido > 0 && <Linea label="+ Transferencias de Germán" valor={p.transferido} color="var(--color-tab-tarjetas)"/>}
          {p.deposito > 0 && <Linea label="+ Depósito de fin de mes" valor={p.deposito} color="var(--color-tab-tarjetas)"/>}
          <Linea label="− Gastos de Julieta por transferencia" valor={p.gastosJulieta} color="var(--color-tab-gastos)"/>
          <Linea label="= Saldo esperado" valor={p.esperado} bold/>
          <Linea label="Saldo declarado por Julieta" valor={p.saldoReal} bold/>
          <DiferenciaBox diferencia={p.diferencia} etiqueta="Diferencia de conciliación"/>
          <div className="px-4 py-2 text-[10px] text-muted-light leading-relaxed bg-paper">
            Se compara la variación esperada (transferencias − gastos: {neg(p.variacionEsperada)}) con la real (saldo − saldo anterior: {neg(p.variacionReal)}). Los gastos de Germán por transferencia no se descuentan acá (ya salieron de su bruto).
          </div>
        </>
      ) : null}
      {abierto && (!p || abierto.fechaInicio === p.fechaFin) && (
        <div className="border-t-2 border-border-soft">
          <div className="px-4 py-2 bg-[#FFFBF5] text-[11px] font-bold text-accent-strong uppercase tracking-wide">⏳ Período abierto desde {fd(abierto.fechaInicio)}</div>
          <Linea label="Saldo declarado" valor={abierto.saldoIni}/>
          {abierto.transferido > 0 && <Linea label="+ Transferencias de Germán" valor={abierto.transferido} color="var(--color-tab-tarjetas)"/>}
          {abierto.deposito > 0 && <Linea label="+ Depósito de fin de mes" valor={abierto.deposito} color="var(--color-tab-tarjetas)"/>}
          <Linea label="− Gastos de Julieta por transferencia" valor={abierto.gastosJulieta} color="var(--color-tab-gastos)"/>
          <Linea label="= Saldo esperado a hoy" valor={abierto.esperado} bold/>
          <div className="px-4 py-2 text-[10px] text-accent-strong bg-[#FFFBF5]">La diferencia se calcula cuando Julieta declare su saldo real.</div>
        </div>
      )}
    </div>
  );
}

// Efectivo familiar (un solo fondo): efectivo anterior + (bruto − gastos de Germán por transferencia) − transferencia a la Uala
// − depósito de fin de mes − gastos en efectivo de Germán y Julieta = esperado, contra el efectivo declarado el domingo.
export function ConciliacionEfectivoDetalle({ conciliacion }) {
  const { periodos, abierto } = conciliacion;
  const p = periodos.length ? periodos[periodos.length - 1] : null;
  if (!p && !abierto) return <div className="px-4 py-3 text-[12px] text-muted-light">Todavía no declaraste efectivo (Auto → cierre dominical). La primera declaración es el punto de partida.</div>;
  const filas = (x, titulo, esAbierto) => (
    <div className={esAbierto ? 'border-t-2 border-border-soft' : ''}>
      <div className={`px-4 py-2 text-[11px] font-bold uppercase tracking-wide ${esAbierto ? 'bg-[#FFFBF5] text-accent-strong' : 'bg-paper text-muted'}`}>{titulo}</div>
      <Linea label="Efectivo anterior declarado" valor={x.saldoIni}/>
      <Linea label="+ Bruto Uber/DiDi" valor={x.bruto} color="var(--color-german)"/>
      {x.gastosGermanTransf > 0 && <Linea label="− Gastos de Germán por transferencia (ya salen del bruto)" valor={x.gastosGermanTransf} color="var(--color-tab-gastos)"/>}
      <Linea label="− Transferido a la Uala" valor={x.transferido} color="var(--color-tab-tarjetas)"/>
      {x.deposito > 0 && <Linea label="− Depositado en la Uala (fin de mes)" valor={x.deposito} color="var(--color-tab-tarjetas)"/>}
      <Linea label="− Gastos en efectivo de Germán" valor={x.gastosEfectivoGerman} color="var(--color-tab-gastos)"/>
      <Linea label="− Gastos en efectivo de Julieta" valor={x.gastosEfectivoJulieta} color="var(--color-tab-gastos)"/>
      <Linea label={esAbierto ? '= Efectivo esperado a hoy' : '= Efectivo esperado'} valor={x.esperado} bold/>
      {!esAbierto && <Linea label="Efectivo declarado" valor={x.saldoReal} bold/>}
      {!esAbierto && <DiferenciaBox diferencia={x.diferencia} etiqueta="Diferencia de efectivo"/>}
    </div>
  );
  return (
    <div>
      {p && filas(p, `Período ${fd(p.fechaInicio)} → ${fd(p.fechaFin)} (declaración a declaración)`, false)}
      {abierto && (!p || abierto.fechaInicio === p.fechaFin) && filas(abierto, `⏳ Período abierto desde ${fd(abierto.fechaInicio)}`, true)}
      <div className="px-4 py-2 text-[10px] text-muted-light leading-relaxed bg-paper">
        Un solo fondo para Germán y Julieta. Cada declaración reemplaza a la anterior. Se usa el bruto neto de los gastos de Germán por transferencia porque la transferencia dominical ya los tiene descontados.
      </div>
    </div>
  );
}
