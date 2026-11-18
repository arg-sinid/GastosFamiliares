// ═══════════════════════════════════════════════════════════════════════════
//  MOTOR FINANCIERO — único lugar donde se calcula la plata de la familia.
//  Las pantallas (Principal, Control, Cierre) NO calculan: muestran lo que devuelve
//  construirSituacion(). Todo es puro: recibe datos, devuelve resultados, no guarda nada.
//
//  Reglas económicas (confirmadas por Germán):
//   · Uber/DiDi: se registra el bruto diario. Los gastos personales de Germán pagados por
//     transferencia se descuentan del bruto ANTES de transferir a la Uala. La transferencia
//     dominical es un movimiento entre bolsillos, NO un ingreso.
//   · Uala (Julieta): el saldo que declara es dinero real. Se concilia contra
//     saldo anterior confirmado + transferencias/depósitos − gastos de Julieta por transferencia.
//     Los gastos de Germán por transferencia NO se descuentan de la Uala.
//   · Efectivo: un único fondo familiar. Lo declara Germán los domingos y REEMPLAZA al anterior.
//   · Disponibilidad = saldo real de la Uala + efectivo real. No suma ingresos futuros ni transferencias.
//   · Resultado mensual = ingresos del período (sueldo + bruto Uber/DiDi) − gastos del período
//     (Zapia + tarjetas del mes + fijos). Lo provisorio/futuro nunca entra.
//   · Obligaciones: período + vencimiento + estado + pago. Lo vencido impago no desaparece
//     al empezar un período nuevo; lo estimado se reemplaza por el definitivo y nunca se suma.
// ═══════════════════════════════════════════════════════════════════════════
import { n, monthOf, mesDesplazado, ultimoDiaHabil, montoEnPesos } from './utils.js';

// ── Constantes ───────────────────────────────────────────────────────────
export const GASTOS_FIJOS_KEYS = ['icbc','bna','prestamos','nicolas','segundo','alquiler'];
export const esTarjetaClave = k => k === 'icbc' || k === 'bna';
// Claves de los fijos: los de siempre + los agregados a mano (ajustes.fijosExtra).
export const clavesFijos = (ajustes) => [...GASTOS_FIJOS_KEYS, ...(((ajustes && ajustes.fijosExtra) || []).map(f => f.id))];

// Tarjetas: el resumen etiquetado con un mes (los gastos de noviembre) se paga en el mes SIGUIENTE (diciembre).
// El período de la obligación es el mes del resumen: el de noviembre vence en diciembre; el de octubre ya venció en noviembre.
// Las obligaciones con vencimiento anterior a esta fecha se consideran historia (no se muestran como vencidas).
// 5/11/2026: los resúmenes de octubre (vencían el 3 y 4 de noviembre) ya fueron pagados.
export const OBLIGACIONES_DESDE_DEFECTO = '2026-11-05';
export const VENCIMIENTO_MES_SIGUIENTE_DEFECTO = { icbc:true, bna:true, prestamos:true };

const diasEntre = (a, b) => Math.round((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 86400000);
const ultimoDiaDelMes = (y, m) => new Date(y, m, 0).getDate();
export const fechaVencimiento = (mesKey, dia, mesSiguiente) => {
  let [y, m] = mesKey.split('-').map(Number);
  if (mesSiguiente) { m += 1; if (m > 12) { m = 1; y += 1; } }
  const d = Math.min(Math.max(1, Math.floor(n(dia))), ultimoDiaDelMes(y, m));
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
};

// ── Zapia ────────────────────────────────────────────────────────────────
export const esTransferencia = m => /transf/i.test(String(m||''));
export const esEfectivo = m => /efect/i.test(String(m||''));
const medioOk = (r, medio) => !medio || (medio === 'transferencia' ? esTransferencia(r.medio) : medio === 'efectivo' ? esEfectivo(r.medio) : r.medio === medio);
const quienOk = (r, quien) => quien == null || (Array.isArray(quien) ? quien.includes(r.quien) : r.quien === quien);
// Gastos de Zapia en el período (desde, hasta]: los del día de la declaración pertenecen al período que ESA declaración cierra.
export const gastosZapiaDe = (zapiaData, quien, desde, hasta, medio = null) =>
  (zapiaData||[]).filter(r => r.fecha && r.fecha > desde && r.fecha <= hasta && quienOk(r, quien) && medioOk(r, medio))
                 .reduce((s,r) => s + n(r.costo), 0);

// ── Uber/DiDi ────────────────────────────────────────────────────────────
export const brutoUberDiDiMes = (uberDiDi, mesKey) =>
  (uberDiDi||[]).filter(r => r.fecha && r.fecha.slice(0,7) === mesKey).reduce((s,r) => s + n(r.total), 0);
const brutoEnPeriodo = (uberDiDi, desde, hasta) =>
  (uberDiDi||[]).filter(r => r.fecha && r.fecha > desde && r.fecha <= hasta).reduce((s,r) => s + n(r.total), 0);

// ── Uala de Julieta ──────────────────────────────────────────────────────
// Aportes a la Uala: lo que Germán transfiere (ya neto de sus gastos por transferencia) + el efectivo que deposita
// el último día del mes (efectivoCierreMes). NO es efectivoEnMano (eso es el efectivo declarado, otro fondo).
export const aportesAUala = (uberDiDi, desde, hasta) => {
  let transferencias = 0, deposito = 0;
  (uberDiDi||[]).forEach(r => {
    if (!r.fecha || !(r.fecha > desde && r.fecha <= hasta)) return;
    transferencias += n(r.transferencia); deposito += n(r.efectivoCierreMes);
  });
  return { transferencias, deposito, total: transferencias + deposito };
};

// saldo esperado = saldo anterior confirmado + aportes − gastos de Julieta por transferencia.
// Equivale a comparar la VARIACIÓN esperada (aportes − gastos) con la variación real (saldo − saldo anterior).
// `diferenciaSinSaldoAnterior` es la alternativa "solo flujo" (aportes − gastos vs saldo): difiere de la
// diferencia correcta exactamente en el saldo anterior, así que solo sirve si la cuenta arrancó en 0 (ver docs).
export const conciliarUala = ({ saldoIni, saldoReal, aportes, gastos }) => {
  const esperado = saldoIni + aportes - gastos;
  return {
    esperado, diferencia: saldoReal - esperado,
    variacionEsperada: aportes - gastos, variacionReal: saldoReal - saldoIni,
    diferenciaSinSaldoAnterior: saldoReal - (aportes - gastos),
  };
};

// Períodos CERRADOS entre declaraciones consecutivas. La primera declaración es solo el punto de partida (no hay
// base contra la cual comparar). Cada saldo declarado se usa una sola vez como inicio del período siguiente.
export const calcularConciliaciones = (saldoJulieta, uberDiDi, zapiaData) => {
  const fechas = Object.keys(saldoJulieta||{}).sort();
  const periodos = [];
  for (let i = 1; i < fechas.length; i++) {
    const fIni = fechas[i-1], fFin = fechas[i];
    const saldoIni = n(saldoJulieta[fIni]), saldoReal = n(saldoJulieta[fFin]);
    const ap = aportesAUala(uberDiDi, fIni, fFin);
    const gastos = gastosZapiaDe(zapiaData, 'Julieta', fIni, fFin, 'transferencia');
    periodos.push({
      fechaInicio: fIni, fechaFin: fFin, saldoIni, saldoReal,
      transferido: ap.transferencias, deposito: ap.deposito, gastosJulieta: gastos,
      ...conciliarUala({ saldoIni, saldoReal, aportes: ap.total, gastos }),
    });
  }
  return periodos;
};

// Período ABIERTO: desde la última declaración hasta hoy. Es una estimación: todavía no hay saldo real nuevo.
export const calcularPeriodoAbierto = (saldoJulieta, uberDiDi, zapiaData, hoyStr) => {
  const fechas = Object.keys(saldoJulieta||{}).sort().filter(f => f <= hoyStr);
  const ultima = fechas.length ? fechas[fechas.length-1] : null;
  if (!ultima) return null;
  const saldoIni = n(saldoJulieta[ultima]);
  const ap = aportesAUala(uberDiDi, ultima, hoyStr);
  const gastos = gastosZapiaDe(zapiaData, 'Julieta', ultima, hoyStr, 'transferencia');
  return { fechaInicio: ultima, saldoIni, transferido: ap.transferencias, deposito: ap.deposito, gastosJulieta: gastos, esperado: saldoIni + ap.total - gastos };
};

export const ultimoSaldoHasta = (saldoJulieta, hastaFecha) => {
  const f = Object.keys(saldoJulieta||{}).filter(k => k <= hastaFecha).sort();
  return f.length ? { fecha: f[f.length-1], valor: n(saldoJulieta[f[f.length-1]]) } : null;
};

// ── Efectivo familiar ────────────────────────────────────────────────────
// Un solo fondo para Germán y Julieta. Se declara en Auto (domingo, "efectivo que me queda" = efectivoEnMano).
// Una declaración REEMPLAZA a la anterior. (Una declaración en 0 se reconoce solo si el registro tiene efectivoDeclarado.)
export const declaracionesEfectivo = (uberDiDi) => {
  const m = {};
  (uberDiDi||[]).forEach(r => { if (r.fecha && (r.efectivoDeclarado === true || n(r.efectivoEnMano) > 0)) m[r.fecha] = n(r.efectivoEnMano); });
  return m;
};

// efectivo esperado = efectivo anterior + (bruto − gastos de Germán por transferencia) − transferencias a la Uala
//                     − depósito de fin de mes − gastos en efectivo de Germán y de Julieta.
// Se usa el bruto NETO de los gastos de Germán por transferencia porque la transferencia dominical ya los tiene
// descontados (transferencia = bruto − esos gastos): con el bruto sin netear se sumarían dos veces al efectivo.
const componentesEfectivo = (uberDiDi, zapiaData, desde, hasta) => {
  const bruto = brutoEnPeriodo(uberDiDi, desde, hasta);
  const gastosGermanTransf = gastosZapiaDe(zapiaData, 'Germán', desde, hasta, 'transferencia');
  const ap = aportesAUala(uberDiDi, desde, hasta);
  const efGerman = gastosZapiaDe(zapiaData, 'Germán', desde, hasta, 'efectivo');
  const efJulieta = gastosZapiaDe(zapiaData, 'Julieta', desde, hasta, 'efectivo');
  const brutoNeto = bruto - gastosGermanTransf;
  return {
    bruto, gastosGermanTransf, brutoNeto, transferido: ap.transferencias, deposito: ap.deposito,
    gastosEfectivoGerman: efGerman, gastosEfectivoJulieta: efJulieta, gastosEfectivo: efGerman + efJulieta,
    // Lo que no se transfirió: lo que quedó en efectivo (bruto neto − transferencia).
    efectivoRetenido: brutoNeto - ap.transferencias,
  };
};
const esperadoEfectivo = (saldoIni, c) => saldoIni + c.brutoNeto - c.transferido - c.deposito - c.gastosEfectivo;

export const calcularConciliacionesEfectivo = (uberDiDi, zapiaData) => {
  const dec = declaracionesEfectivo(uberDiDi), fechas = Object.keys(dec).sort(), periodos = [];
  for (let i = 1; i < fechas.length; i++) {
    const fIni = fechas[i-1], fFin = fechas[i], saldoIni = dec[fIni], saldoReal = dec[fFin];
    const c = componentesEfectivo(uberDiDi, zapiaData, fIni, fFin), esperado = esperadoEfectivo(saldoIni, c);
    periodos.push({ fechaInicio: fIni, fechaFin: fFin, saldoIni, saldoReal, ...c, esperado, diferencia: saldoReal - esperado });
  }
  return periodos;
};
export const calcularPeriodoAbiertoEfectivo = (uberDiDi, zapiaData, hoyStr) => {
  const dec = declaracionesEfectivo(uberDiDi), fechas = Object.keys(dec).sort().filter(f => f <= hoyStr);
  const ultima = fechas.length ? fechas[fechas.length-1] : null;
  if (!ultima) return null;
  const c = componentesEfectivo(uberDiDi, zapiaData, ultima, hoyStr);
  return { fechaInicio: ultima, saldoIni: dec[ultima], ...c, esperado: esperadoEfectivo(dec[ultima], c) };
};

// ── Disponibilidad familiar ──────────────────────────────────────────────
// La suma de los dos fondos REALES (último declarado de cada uno). No incluye ingresos futuros, ni transferencias,
// ni el sueldo pendiente de cobro, ni los ahorros cargados a mano.
export const calcularDisponibilidad = ({ saldoJulieta, uberDiDi, hastaFecha }) => {
  const u = ultimoSaldoHasta(saldoJulieta, hastaFecha);
  const dec = declaracionesEfectivo(uberDiDi), fe = Object.keys(dec).filter(f => f <= hastaFecha).sort().pop();
  const uala = u ? { fecha: u.fecha, valor: u.valor } : null;
  const efectivo = fe ? { fecha: fe, valor: dec[fe] } : null;
  return { uala, efectivo, total: (uala ? uala.valor : 0) + (efectivo ? efectivo.valor : 0) };
};

// ── Fijos y sueldo ───────────────────────────────────────────────────────
// Mes de Principal: el total de tarjeta calculado de los resúmenes pisa lo manual; lo vacío toma el recurrente.
// El sueldo de Julieta vacío toma el sueldo recurrente (ajustes.sueldoJulieta, "cobra siempre lo mismo").
export const resolverMes = (monthly, recurrentes, totalesTarjetas, key, ajustes = null) => {
  const s = monthly?.[key] || {}, tMes = totalesTarjetas?.[key] || {}, gastos = {};
  clavesFijos(ajustes).forEach(k => {
    if (esTarjetaClave(k) && tMes[k] !== undefined) { gastos[k] = String(Math.round(tMes[k])); return; }
    gastos[k] = s.gastos?.[k] || (recurrentes?.[k] ? String(recurrentes[k]) : '');
  });
  const ingresos = { julieta:'', ...(s.ingresos||{}) };
  if (!ingresos.julieta && ajustes && n(ajustes.sueldoJulieta) > 0) ingresos.julieta = String(ajustes.sueldoJulieta);
  return { ingresos, gastos };
};
export const totalFijos = (gastos) => Object.values(gastos||{}).reduce((s,v) => s + n(v), 0);

// Totales de tarjeta por mes del resumen (que es el mes de Principal en el que figura). El dólar es el del mes del resumen.
export const calcularTotalesTarjetas = (movimientos, dolarTarjetaMap) => {
  const out = {};
  (movimientos||[]).forEach(m => {
    if (!m.mes || !m.tarjeta) return;
    const t = m.tarjeta.toLowerCase(), key = t === 'icbc' ? 'icbc' : t === 'bna' ? 'bna' : null;
    if (!key) return;
    if (!out[m.mes]) out[m.mes] = {};
    out[m.mes][key] = (out[m.mes][key] || 0) + montoEnPesos(m, n(dolarTarjetaMap?.[m.mes]) || 0);
  });
  return out;
};

export const estadoSueldo = ({ monto, mesKey, hoyStr }) => {
  const fechaCobro = ultimoDiaHabil(mesKey);          // último día hábil (lunes a viernes; no considera feriados)
  return { monto, fechaCobro, estado: hoyStr >= fechaCobro ? 'cobrado' : 'pendiente' };
};

// ── Resultado mensual (económico) ────────────────────────────────────────
// Ingresos del período: sueldo de Julieta + bruto Uber/DiDi (los gastos de Germán por transferencia están dentro
// de los gastos, una sola vez). Gastos del período: Zapia (todos, de ambos y de ambos medios) + tarjetas del mes
// (resúmenes definitivos) + fijos sin tarjeta. Las transferencias entre bolsillos, los saldos declarados, los
// compromisos futuros y los importes provisorios NO entran.
export const calcularResultadoMensual = ({ appData, zapiaData, tarjetasData, mesKey }) => {
  const aj = appData.ajustes || {};
  const mes = resolverMes(appData.monthly, appData.gastosRecurrentes, {}, mesKey, aj);
  const sueldo = n(mes.ingresos.julieta);
  const uber = brutoUberDiDiMes(appData.uberDiDi, mesKey);
  const zapia = (zapiaData||[]).filter(r => r.fecha && monthOf(r.fecha) === mesKey).reduce((s,r) => s + n(r.costo), 0);
  const dolar = appData.dolarTarjeta || {};
  const tarjetas = (tarjetasData||[]).filter(m => m.mes === mesKey).reduce((s,m) => s + montoEnPesos(m, n(dolar[m.mes]) || 0), 0);
  const fijos = clavesFijos(aj).filter(k => !esTarjetaClave(k)).reduce((s,k) => s + n(mes.gastos[k]), 0);
  const ingresos = { sueldo, uber, total: sueldo + uber };
  const gastos = { zapia, tarjetas, fijos, total: zapia + tarjetas + fijos };
  return { mesKey, ingresos, gastos, saldo: ingresos.total - gastos.total };
};

// AHORRO = solo los movimientos que se cargan a mano. No se suma a la disponibilidad ni al resultado.
export const calcularAhorroManual = (movimientos, upTo) => (movimientos||[])
  .filter(m => !upTo || (m.fecha && m.fecha.slice(0,7) <= upTo))
  .reduce((s,m) => s + (m.tipo === 'retiro' ? -n(m.monto) : n(m.monto)), 0);

// ── Obligaciones (vencimientos, estados y pagos) ─────────────────────────
// Una obligación = un gasto fijo con vencimiento en un período de Principal (mes en que se paga el fijo).
//   estado: pagado | vencido | proximo (vence en ≤ 7 días) | pendiente
//   tipo:   definitivo | provisorio (estimado). Un provisorio se reemplaza por el definitivo y NUNCA se suma con él.
// Un vencimiento no se da por pagado por pasar la fecha: queda "vencido" hasta que se marque como pagado.
export const clasificarObligacion = ({ fecha, pagado, hoyStr }) =>
  pagado ? 'pagado' : fecha < hoyStr ? 'vencido' : diasEntre(fecha, hoyStr) <= 7 ? 'proximo' : 'pendiente';

const resumenTarjeta = (movs, dolar, tarjeta, mes) => {
  const filas = (movs||[]).filter(m => m.tarjeta === tarjeta && m.mes === mes);
  return { cantidad: filas.length, total: filas.reduce((s,m) => s + montoEnPesos(m, n(dolar[mes]) || 0), 0) };
};

// Monto de la obligación del fijo `k` en el período `p`.
const montoObligacion = ({ k, p, ajustes, monthly, rec, dolar, tarjetasData, tarjetasProvisorias, mesHoy }) => {
  const manual = n(monthly?.[p]?.gastos?.[k]);
  if (esTarjetaClave(k)) {
    const tarjeta = k.toUpperCase(), rm = p;      // período = mes del resumen (vence el mes siguiente)
    const def = resumenTarjeta(tarjetasData, dolar, tarjeta, rm);
    if (def.cantidad > 0) return { monto: def.total, tipo: 'definitivo', fuente: 'resumen', mesResumen: rm };
    if (manual > 0) return { monto: manual, tipo: 'definitivo', fuente: 'manual', mesResumen: rm };
    const prov = resumenTarjeta(tarjetasProvisorias, dolar, tarjeta, rm);
    if (prov.cantidad > 0) return { monto: prov.total, tipo: 'provisorio', fuente: 'movimientos', mesResumen: rm };
    // Sin resumen ni movimientos: estimación = último resumen definitivo anterior (marcada como estimada).
    const previos = [...new Set((tarjetasData||[]).filter(m => m.tarjeta === tarjeta && m.mes < rm).map(m => m.mes))].sort();
    if (previos.length) {
      const ult = previos[previos.length-1];
      return { monto: resumenTarjeta(tarjetasData, dolar, tarjeta, ult).total, tipo: 'provisorio', fuente: 'estimado', mesResumen: rm, basadoEn: ult };
    }
    return null;
  }
  if (manual > 0) return { monto: manual, tipo: 'definitivo', fuente: 'manual' };
  if (n(rec?.[k]) > 0) return { monto: n(rec[k]), tipo: p <= mesHoy ? 'definitivo' : 'provisorio', fuente: 'recurrente' };
  return null;
};

export const generarObligaciones = ({ appData, tarjetasData, tarjetasProvisorias = [], hoyStr }) => {
  const ajustes = appData.ajustes || {}, venc = appData.vencimientos || {}, pagos = appData.pagosFijos || {};
  const monthly = appData.monthly || {}, rec = appData.gastosRecurrentes || {}, dolar = appData.dolarTarjeta || {};
  const desde = ajustes.obligacionesDesde || OBLIGACIONES_DESDE_DEFECTO;
  const mesHoy = hoyStr.slice(0,7);
  const periodos = [-2,-1,0,1,2].map(d => mesDesplazado(mesHoy, d));
  const todas = [];
  clavesFijos(ajustes).forEach(k => {
    const v = venc[k];
    if (!v || !n(v.dia)) return;
    let previa = null;
    periodos.forEach(p => {
      const info = montoObligacion({ k, p, ajustes, monthly, rec, dolar, tarjetasData, tarjetasProvisorias, mesHoy });
      if (!info || !(info.monto > 0)) return;
      const fecha = fechaVencimiento(p, v.dia, !!v.mesSiguiente), pago = pagos[`${p}|${k}`];
      const o = { id: `${p}|${k}`, key: k, periodo: p, fecha, monto: info.monto, tipo: info.tipo, fuente: info.fuente, mesResumen: info.mesResumen || null, basadoEn: info.basadoEn || null,
                  pagado: !!pago, fechaPago: pago ? (pago.fecha || hoyStr) : null };
      // Lo provisorio del período siguiente recién se muestra cuando la anterior se pagó o ya venció.
      o.visible = o.tipo === 'definitivo' || !previa || previa.pagado || previa.fecha < hoyStr;
      o.estado = clasificarObligacion({ fecha, pagado: o.pagado, hoyStr });
      previa = o;
      if (fecha >= desde) todas.push(o);
    });
  });
  const porFecha = (a,b) => a.fecha.localeCompare(b.fecha) || a.key.localeCompare(b.key);
  const visibles = todas.filter(o => o.visible).sort(porFecha);
  const vencidas   = visibles.filter(o => !o.pagado && o.fecha < hoyStr);
  const pendientes = visibles.filter(o => !o.pagado && o.fecha >= hoyStr && o.tipo === 'definitivo');
  const estimados  = visibles.filter(o => !o.pagado && o.fecha >= hoyStr && o.tipo === 'provisorio');
  const pagadas    = todas.filter(o => o.pagado).sort((a,b) => (b.fechaPago||'').localeCompare(a.fechaPago||''));
  const suma = arr => arr.reduce((s,o) => s + o.monto, 0);
  // Agrupación para la pantalla principal (relativa a hoy):
  const inicioMes = `${mesHoy}-01`, mesSiguiente = mesDesplazado(mesHoy, 1);
  const vencidasAnteriores = vencidas.filter(o => o.fecha < inicioMes);                       // vencidas e impagas de meses anteriores
  const delMes = visibles.filter(o => !o.pagado && o.fecha.slice(0,7) === mesHoy);             // vencen este mes (vencidas del mes incluidas)
  // Mes siguiente: TODO lo impago que vence ese mes (aunque todavía sea provisorio). Es la base de la cobertura.
  const delMesSiguiente = todas.filter(o => !o.pagado && o.fecha.slice(0,7) === mesSiguiente).sort(porFecha);
  const masAdelante = visibles.filter(o => !o.pagado && o.fecha.slice(0,7) > mesSiguiente);   // meses posteriores: fuera de la cobertura
  const clase = o => o.tipo === 'definitivo' ? 'definitivo' : o.fuente === 'movimientos' ? 'temporal' : 'estimado';
  const sig = { definitivo: 0, temporal: 0, estimado: 0 };
  delMesSiguiente.forEach(o => { sig[clase(o)] += o.monto; });
  sig.total = sig.definitivo + sig.temporal + sig.estimado;
  const totales = { vencido: suma(vencidas), pendiente: suma(pendientes), estimado: suma(estimados), aPagar: suma(vencidas) + suma(pendientes),
                    vencidoAnterior: suma(vencidasAnteriores), delMes: suma(delMes), masAdelante: suma(masAdelante), mesSiguiente: sig };
  return { todas, vencidas, pendientes, estimados, pagadas, totales, mesSiguiente, vencidasAnteriores, delMes, delMesSiguiente, masAdelante };
};

// Cobertura del MES SIGUIENTE. Obligaciones: solo lo impago que vence ese mes (no meses posteriores ni lo vencido de
// meses anteriores, que va aparte). Se restan, por separado: la disponibilidad real (últimos saldos declarados de Uala
// + efectivo) y el sueldo PREVISTO de Julieta que paga ese mes (el del mes anterior a las obligaciones, que se cobra el
// último día hábil), aunque todavía no se haya cobrado. El sueldo NO es dinero disponible: no entra en la disponibilidad.
export const calcularCoberturaMesSiguiente = ({ appData, obligaciones, disponibilidad, hoyStr }) => {
  const mes = obligaciones.mesSiguiente, t = obligaciones.totales.mesSiguiente;
  const mesSueldo = mesDesplazado(mes, -1);
  const m = resolverMes(appData.monthly, appData.gastosRecurrentes, {}, mesSueldo, appData.ajustes || {});
  const sueldo = estadoSueldo({ monto: n(m.ingresos.julieta), mesKey: mesSueldo, hoyStr });
  const sueldoPrevisto = { ...sueldo, mesSueldo };
  const balance = disponibilidad.total + sueldoPrevisto.monto - t.total;
  return { mes, items: obligaciones.delMesSiguiente, obligaciones: t, disponible: disponibilidad.total, sueldoPrevisto,
           balance, falta: Math.max(0, -balance), alcanza: balance >= 0 };
};

// ── Situación completa (lo único que consumen las pantallas) ────────────
export const construirSituacion = ({ appData, zapiaData, tarjetasData, tarjetasProvisorias = [], mesKey, hoyStr }) => {
  const ajustes = appData.ajustes || {};
  const finMes = `${mesKey}-31`;
  const hastaFecha = hoyStr < finMes ? hoyStr : finMes;           // disponibilidad "a esa fecha" para meses pasados
  const disponibilidad = calcularDisponibilidad({ saldoJulieta: appData.saldoJulieta, uberDiDi: appData.uberDiDi, hastaFecha });
  const totalesTarjetas = calcularTotalesTarjetas(tarjetasData, appData.dolarTarjeta);
  const mes = resolverMes(appData.monthly, appData.gastosRecurrentes, totalesTarjetas, mesKey, ajustes);
  const obligaciones = generarObligaciones({ appData, tarjetasData, tarjetasProvisorias, hoyStr });
  return {
    mesKey, hoyStr, mes, totalesTarjetas,
    disponibilidad,
    ingresos: { sueldo: estadoSueldo({ monto: n(mes.ingresos.julieta), mesKey, hoyStr }), germanUala: disponibilidad.uala },
    conciliacionUala: { periodos: calcularConciliaciones(appData.saldoJulieta, appData.uberDiDi, zapiaData), abierto: calcularPeriodoAbierto(appData.saldoJulieta, appData.uberDiDi, zapiaData, hoyStr) },
    conciliacionEfectivo: { periodos: calcularConciliacionesEfectivo(appData.uberDiDi, zapiaData), abierto: calcularPeriodoAbiertoEfectivo(appData.uberDiDi, zapiaData, hoyStr) },
    obligaciones, cobertura: calcularCoberturaMesSiguiente({ appData, obligaciones, disponibilidad, hoyStr }),
    resultado: calcularResultadoMensual({ appData, zapiaData, tarjetasData, mesKey }),
    ahorro: calcularAhorroManual(appData.ahorroMovimientos),
  };
};

// Foto de un mes cerrado: se guarda y no se recalcula (el historial no cambia solo). Si después cambian los
// datos, la pantalla muestra la diferencia contra el cálculo actual.
export const armarCierre = (situacion) => ({
  fecha: situacion.hoyStr,
  resultado: { ingresos: situacion.resultado.ingresos.total, gastos: situacion.resultado.gastos.total, saldo: situacion.resultado.saldo },
  disponibilidad: { uala: situacion.disponibilidad.uala?.valor ?? null, efectivo: situacion.disponibilidad.efectivo?.valor ?? null, total: situacion.disponibilidad.total },
  obligaciones: { vencido: situacion.obligaciones.totales.vencido, pendiente: situacion.obligaciones.totales.pendiente, estimado: situacion.obligaciones.totales.estimado },
  ahorro: situacion.ahorro,
});

// ── Salidas hacia Google Sheets ──────────────────────────────────────────
export const HEADERS_CONTROL = [
  'Mes','Sueldo Julieta','Uber/DiDi (bruto)','Total ingresos','Tarjeta ICBC','Tarjeta BNA','Préstamos','Nicolás','Segundo','Alquiler',
  'Total gastos fijos (con tarjetas)','Gastos Zapia','Total egresos','Resultado del mes','Última sync',
];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
// Una fila por mes con el MISMO resultado que ve Principal/Cierre. Tarjetas del mes en que se hicieron los gastos.
export const calcularFilaControl = ({ appData, zapiaData, tarjetasData }, key, ahora = '') => {
  const [y, m] = key.split('-'), r = calcularResultadoMensual({ appData, zapiaData, tarjetasData, mesKey: key });
  const mes = resolverMes(appData.monthly, appData.gastosRecurrentes, {}, key, appData.ajustes);
  const tc = calcularTotalesTarjetas(tarjetasData, appData.dolarTarjeta, 0)[key] || {};
  const g = mes.gastos;
  return [`${MESES[parseInt(m,10)-1]} ${y}`, r.ingresos.sueldo, r.ingresos.uber, r.ingresos.total,
          Math.round(tc.icbc || 0), Math.round(tc.bna || 0), n(g.prestamos), n(g.nicolas), n(g.segundo), n(g.alquiler),
          r.gastos.tarjetas + r.gastos.fijos, r.gastos.zapia, r.gastos.total, r.saldo, ahora];
};
export const calcularFilasControl = (ctx, ahora = '') =>
  Object.keys(ctx.appData.monthly||{}).sort().map(k => calcularFilaControl(ctx, k, ahora));

// Tablas legibles (derivadas; editarlas en la planilla no cambia la app).
export const calcularHojasExtra = (appData, zapiaData, tarjetasData, tarjetasProvisorias, hoyStr) => {
  const f = x => x || '';
  const ganancias = [...(appData.uberDiDi||[])].sort((a,b) => String(b.fecha).localeCompare(String(a.fecha)))
    .map(r => [r.fecha, n(r.uber), n(r.didi), n(r.total), n(r.transferencia), n(r.efectivoEnMano), n(r.efectivoCierreMes)]);
  const saldos = Object.keys(appData.saldoJulieta||{}).sort().reverse().map(k => [k, n(appData.saldoJulieta[k])]);
  const conc = calcularConciliaciones(appData.saldoJulieta, appData.uberDiDi, zapiaData).reverse()
    .map(p => [p.fechaInicio, p.fechaFin, p.saldoIni, p.transferido, p.deposito, p.gastosJulieta, p.esperado, p.saldoReal, p.diferencia]);
  const efect = calcularConciliacionesEfectivo(appData.uberDiDi, zapiaData).reverse()
    .map(p => [p.fechaInicio, p.fechaFin, p.saldoIni, p.bruto, p.gastosGermanTransf, p.transferido, p.deposito, p.gastosEfectivo, p.esperado, p.saldoReal, p.diferencia]);
  const ahorros = [...(appData.ahorroMovimientos||[])].sort((a,b) => String(b.fecha).localeCompare(String(a.fecha)))
    .map(m => [f(m.fecha), m.tipo === 'retiro' ? 'Retiro' : m.tipo === 'ajuste_inicial' ? 'Ajuste inicial' : 'Ingreso extra', m.tipo === 'retiro' ? -n(m.monto) : n(m.monto), f(m.descripcion)]);
  const ob = generarObligaciones({ appData, tarjetasData, tarjetasProvisorias, hoyStr }).todas.filter(o => o.visible);
  const obligaciones = ob.map(o => [o.periodo, o.key, o.fecha, o.monto, o.tipo === 'provisorio' ? 'Estimado' : 'Definitivo', o.estado, f(o.fechaPago)]);
  return {
    'Ganancias Auto': { headers:['Fecha','Uber','DiDi','Total bruto','Transferido a Uala','Efectivo que queda (declarado)','Depósito cierre de mes'], rows: ganancias },
    'Saldos Uala': { headers:['Fecha','Saldo real declarado'], rows: saldos },
    'Conciliaciones': { headers:['Desde','Hasta','Saldo anterior','Transferencias de Germán','Depósito fin de mes','Gastos de Julieta por transferencia','Saldo esperado','Saldo real','Diferencia (negativa = gasto hormiga)'], rows: conc },
    'Efectivo': { headers:['Desde','Hasta','Efectivo anterior','Bruto Uber/DiDi','Gastos de Germán por transferencia','Transferido a Uala','Depósito fin de mes','Gastos en efectivo (ambos)','Efectivo esperado','Efectivo declarado','Diferencia'], rows: efect },
    'Ahorros': { headers:['Fecha','Tipo','Monto','Descripción'], rows: ahorros },
    'Obligaciones': { headers:['Período','Gasto','Vence','Monto','Tipo','Estado','Fecha de pago'], rows: obligaciones },
  };
};
