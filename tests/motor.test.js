// Pruebas del motor financiero (escenarios A–E del plan v7.0 + invariantes).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularConciliaciones, calcularPeriodoAbierto, conciliarUala, gastosZapiaDe, esTransferencia,
  calcularConciliacionesEfectivo, declaracionesEfectivo, calcularDisponibilidad,
  calcularResultadoMensual, construirSituacion, generarObligaciones, estadoSueldo,
  calcularFilaControl, calcularTotalesTarjetas, fechaVencimiento, resolverMes, armarCierre,
  calcularHojasExtra, calcularAhorroManual, clavesFijos, calcularFilasControl,
} from '../src/motor.js';
import { EMPTY_DATA } from '../src/utils.js';

const uber = (fecha, extra = {}) => ({ id: fecha + JSON.stringify(extra), fecha, uber: 0, didi: 0, total: 0, transferencia: 0, efectivoEnMano: 0, efectivoCierreMes: 0, ...extra });
const zap  = (fecha, quien, costo, medio = 'transferencia', que = 'x') => ({ id: `${fecha}${quien}${costo}${medio}${que}`, fecha, quien, costo, medio, que, hora: '10:00' });
const app  = (o = {}) => ({ ...EMPTY_DATA(), ...o });

// ═══ Prueba A — Ingresos de Germán ═══════════════════════════════════════
const semanaA = [ uber('2026-11-03',{ total:100000 }), uber('2026-11-04',{ total:120000 }), uber('2026-11-06',{ total:80000 }),
                  uber('2026-11-08',{ transferencia:270000, efectivoEnMano:0, efectivoDeclarado:true }) ];
const gastosA = [ zap('2026-11-05','Germán',30000,'transferencia','nafta') ];

test('A: el gasto personal de Germán por transferencia se descuenta UNA sola vez (ya está neto en la transferencia)', () => {
  const [ab] = calcularConciliacionesEfectivo([ uber('2026-11-01',{ efectivoDeclarado:true, efectivoEnMano:10000 }), ...semanaA ], gastosA);
  assert.equal(ab.bruto, 300000); assert.equal(ab.gastosGermanTransf, 30000);
  assert.equal(ab.brutoNeto, 270000);                       // bruto − gastos de Germán por transferencia = transferencia esperada
  assert.equal(ab.efectivoRetenido, 0);                     // transfirió exactamente eso: no quedó efectivo retenido
  const ua = calcularPeriodoAbierto({ '2026-11-01':100000 }, semanaA, gastosA, '2026-11-08');
  assert.equal(ua.gastosJulieta, 0); assert.equal(ua.esperado, 100000 + 270000);
});

test('A: la transferencia no es un ingreso nuevo y el bruto cuenta una vez', () => {
  const con = calcularResultadoMensual({ appData: app({ uberDiDi: semanaA }), zapiaData: gastosA, tarjetasData: [], mesKey: '2026-11' });
  const sin = calcularResultadoMensual({ appData: app({ uberDiDi: semanaA.map(r => ({ ...r, transferencia: 0 })) }), zapiaData: gastosA, tarjetasData: [], mesKey: '2026-11' });
  assert.equal(con.ingresos.uber, 300000);
  assert.equal(con.saldo, 300000 - 30000);
  assert.equal(con.saldo, sin.saldo);
});

// ═══ Prueba B — Conciliación de la Uala ══════════════════════════════════
test('B: saldo declarado igual al esperado → diferencia 0', () => {
  const s = { '2026-11-01':740000, '2026-11-08':500000 };
  const z = [ zap('2026-11-03','Julieta',150000,'transferencia'), zap('2026-11-05','Julieta',90000,'transferencia') ];
  const [p] = calcularConciliaciones(s, [], z);
  assert.equal(p.esperado, 740000 - 240000); assert.equal(p.diferencia, 0);
});

test('B: la regla "transferencias − gastos" se compara con la VARIACIÓN del saldo; negativa = gasto hormiga', () => {
  const [p] = calcularConciliaciones({ '2026-11-01':740000, '2026-11-07':500000 }, [], [ zap('2026-11-03','Julieta',150000) ]);
  assert.equal(p.variacionEsperada, -150000); assert.equal(p.variacionReal, -240000);
  assert.equal(p.esperado, 590000); assert.equal(p.diferencia, -90000);
});

test('B: diferencia positiva = sobrante', () => {
  const [p] = calcularConciliaciones({ '2026-11-01':100000, '2026-11-08':150000 }, [ uber('2026-11-08',{ transferencia:30000 }) ], [ zap('2026-11-03','Julieta',10000) ]);
  assert.equal(p.esperado, 120000); assert.equal(p.diferencia, 30000);
});

test('B: gastos de Germán por transferencia y los de efectivo NO restan de la Uala', () => {
  const [p] = calcularConciliaciones({ '2026-11-01':100000, '2026-11-08':100000 }, [], [
    zap('2026-11-03','Germán',50000,'transferencia'), zap('2026-11-03','Julieta',9999,'efectivo'), zap('2026-11-04','Julieta',1000,'transferencia') ]);
  assert.equal(p.gastosJulieta, 1000);
});

test('B: períodos consecutivos y movimientos de períodos distintos (el del día de la declaración cierra ese período)', () => {
  const s = { '2026-10-04':100000, '2026-10-11':100000, '2026-10-18':100000 };
  const z = [ zap('2026-10-04','Julieta',111), zap('2026-10-05','Julieta',222), zap('2026-10-11','Julieta',333), zap('2026-10-12','Julieta',444) ];
  const [p1, p2] = calcularConciliaciones(s, [], z);
  assert.equal(p1.gastosJulieta, 222 + 333); assert.equal(p2.gastosJulieta, 444);
  assert.equal(calcularConciliaciones({ '2026-10-04':1 }, [], z).length, 0);
});

test('B: análisis de las dos alternativas con los datos históricos (27/09 → 25/10 → 01/11)', () => {
  const s = { '2026-09-27':425000, '2026-10-25':800000, '2026-11-01':740000 };
  const u = [ uber('2026-10-18',{ transferencia:600000 }) ];
  const z = [ zap('2026-10-30','Julieta',10900,'transferencia') ];
  const [p1, p2] = calcularConciliaciones(s, u, z);
  assert.equal(p1.diferencia, -225000); assert.equal(p2.diferencia, -49100);
  assert.equal(p1.diferenciaSinSaldoAnterior, 200000); assert.equal(p2.diferenciaSinSaldoAnterior, 750900);
  assert.equal(p1.diferenciaSinSaldoAnterior - p1.diferencia, p1.saldoIni);
  assert.equal(p2.diferenciaSinSaldoAnterior - p2.diferencia, p2.saldoIni);
  const enCero = conciliarUala({ saldoIni: 0, saldoReal: 50000, aportes: 70000, gastos: 20000 });
  assert.equal(enCero.diferencia, enCero.diferenciaSinSaldoAnterior);
});

test('B: el depósito de fin de mes es un aporte a la Uala (una sola vez) y no es "efectivoEnMano"', () => {
  const s = { '2026-10-25':100000, '2026-11-01':160000 };
  const u = [ uber('2026-10-30',{ transferencia:40000 }), uber('2026-10-31',{ efectivoCierreMes:20000, efectivoEnMano:777 }) ];
  const [p] = calcularConciliaciones(s, u, []);
  assert.equal(p.deposito, 20000); assert.equal(p.esperado, 160000); assert.equal(p.diferencia, 0);
});

test('B: "transferencia" se reconoce por la raíz', () => {
  assert.ok(esTransferencia('Transferencia')); assert.ok(esTransferencia('transf. bancaria')); assert.equal(esTransferencia('efectivo'), false);
  assert.equal(gastosZapiaDe([ zap('2026-11-03','Julieta',5,'transf.') ], 'Julieta', '2026-11-01', '2026-11-07', 'transferencia'), 5);
});

// ═══ Prueba C — Efectivo familiar ═════════════════════════════════════════
const efectivo0 = uber('2026-11-01',{ efectivoDeclarado:true, efectivoEnMano:50000 });
const semanaC = [ uber('2026-11-03',{ total:100000 }), uber('2026-11-05',{ total:200000 }), uber('2026-11-08',{ transferencia:270000, efectivoDeclarado:true, efectivoEnMano:15000 }) ];
const gastosC = [ zap('2026-11-04','Germán',30000,'transferencia'), zap('2026-11-06','Germán',20000,'efectivo'), zap('2026-11-07','Julieta',15000,'efectivo'), zap('2026-11-07','Julieta',99999,'transferencia') ];

test('C: efectivo esperado = anterior + (bruto − gastos de Germán por transferencia) − transferencia − gastos en efectivo de ambos', () => {
  const [p] = calcularConciliacionesEfectivo([ efectivo0, ...semanaC ], gastosC);
  assert.equal(p.saldoIni, 50000);
  assert.equal(p.brutoNeto, 270000); assert.equal(p.transferido, 270000);
  assert.equal(p.gastosEfectivoGerman, 20000); assert.equal(p.gastosEfectivoJulieta, 15000);
  assert.equal(p.esperado, 50000 + 270000 - 270000 - 35000);
  assert.equal(p.diferencia, 0);
});

test('C: diferencia negativa y positiva; la declaración REEMPLAZA a la anterior (no se acumula)', () => {
  const menos = [ efectivo0, ...semanaC.slice(0,2), uber('2026-11-08',{ transferencia:270000, efectivoDeclarado:true, efectivoEnMano:5000 }) ];
  assert.equal(calcularConciliacionesEfectivo(menos, gastosC)[0].diferencia, -10000);
  const mas = [ efectivo0, ...semanaC.slice(0,2), uber('2026-11-08',{ transferencia:270000, efectivoDeclarado:true, efectivoEnMano:40000 }) ];
  assert.equal(calcularConciliacionesEfectivo(mas, gastosC)[0].diferencia, 25000);
  const tercera = [ efectivo0, ...semanaC, uber('2026-11-15',{ efectivoDeclarado:true, efectivoEnMano:15000 }) ];
  const per = calcularConciliacionesEfectivo(tercera, []);
  assert.equal(per.length, 2); assert.equal(per[1].saldoIni, 15000); assert.equal(per[1].diferencia, 0);
  assert.equal(calcularDisponibilidad({ saldoJulieta:{}, uberDiDi:tercera, hastaFecha:'2026-11-20' }).efectivo.valor, 15000);
});

test('C: el depósito de fin de mes sale del efectivo (efectivoCierreMes) y es distinto del efectivo declarado (efectivoEnMano)', () => {
  const u = [ uber('2026-10-25',{ efectivoDeclarado:true, efectivoEnMano:100000 }), uber('2026-10-31',{ efectivoCierreMes:30000 }), uber('2026-11-01',{ efectivoDeclarado:true, efectivoEnMano:70000 }) ];
  const [p] = calcularConciliacionesEfectivo(u, []);
  assert.equal(p.deposito, 30000); assert.equal(p.esperado, 70000); assert.equal(p.diferencia, 0);
  assert.deepEqual(declaracionesEfectivo(u), { '2026-10-25':100000, '2026-11-01':70000 });
});

test('C: efectivo ≠ Uala (disponibilidad = Uala real + efectivo real, sin transferencias)', () => {
  const d = calcularDisponibilidad({ saldoJulieta:{ '2026-11-01':740000 }, uberDiDi:[ efectivo0, uber('2026-11-02',{ transferencia:999999 }) ], hastaFecha:'2026-11-05' });
  assert.equal(d.uala.valor, 740000); assert.equal(d.efectivo.valor, 50000); assert.equal(d.total, 790000);
  assert.equal(calcularDisponibilidad({ saldoJulieta:{}, uberDiDi:[], hastaFecha:'2026-11-05' }).total, 0);
});

// ═══ Prueba D — Gastos fijos, vencimientos y período de tarjetas ═════════
// Tarjetas: el resumen de un mes (gastos de noviembre) vence el mes SIGUIENTE (3/12). Su período/ID es el mes del resumen.
const datosD = (extra = {}) => app({
  vencimientos: { alquiler:{ dia:10, mesSiguiente:false }, icbc:{ dia:3, mesSiguiente:true } },
  gastosRecurrentes: { alquiler: 900000 }, ...extra,
  ajustes: { obligacionesDesde:'2026-11-01', ...(extra.ajustes || {}) },     // tests históricos; el corte por defecto se prueba aparte
});
const icbc = (mes, importe) => ({ id:`t${mes}${importe}`, mes, tarjeta:'ICBC', fecha:`${mes}-10`, comercio:'X', importe, moneda:'ARS', cuotas:'', tipoMovimiento:'consumo' });
const ob = (appData, hoyStr, def = [], prov = []) => generarObligaciones({ appData, tarjetasData:def, tarjetasProvisorias:prov, hoyStr });
const porId = (r, id) => r.todas.find(o => o.id === id);

test('D: el resumen de octubre vence el 3/11 y el de noviembre el 3/12 (cada resumen, su vencimiento)', () => {
  const r = ob(datosD(), '2026-11-02', [ icbc('2026-10', 600000) ]);
  const oct = porId(r, '2026-10|icbc');
  assert.equal(oct.monto, 600000); assert.equal(oct.fecha, '2026-11-03'); assert.equal(oct.tipo, 'definitivo'); assert.equal(oct.mesResumen, '2026-10');
  const nov = porId(r, '2026-11|icbc');
  assert.equal(nov.fecha, '2026-12-03'); assert.equal(nov.mesResumen, '2026-11');
  const alq = porId(r, '2026-11|alquiler');
  assert.equal(alq.estado, 'pendiente'); assert.equal(alq.fecha, '2026-11-10');
  assert.deepEqual(r.pendientes.map(o => o.id), ['2026-10|icbc', '2026-11|alquiler']);
});

test('D: obligación próxima a vencer (≤ 7 días)', () => {
  assert.equal(porId(ob(datosD(), '2026-11-06', [ icbc('2026-10',1) ]), '2026-11|alquiler').estado, 'proximo');
});

test('D: vencida impaga NO desaparece y el período siguiente aparece como estimado (sin sumarse como dos deudas)', () => {
  const r = ob(datosD(), '2026-11-12', [ icbc('2026-10', 600000) ]);
  assert.deepEqual(r.vencidas.map(o => o.id), ['2026-10|icbc', '2026-11|alquiler']);
  assert.equal(porId(r, '2026-11|alquiler').estado, 'vencido');
  assert.deepEqual(r.estimados.map(o => `${o.id} ${o.monto}`), ['2026-11|icbc 600000', '2026-12|alquiler 900000']);
  assert.equal(porId(r, '2026-12|alquiler').tipo, 'provisorio');
  assert.equal(r.totales.vencido, 600000 + 900000); assert.equal(r.totales.estimado, 600000 + 900000);
  assert.equal(r.totales.aPagar, 600000 + 900000);
});

test('D: obligación pagada deja de ser pendiente, se conserva en el historial y habilita el siguiente período', () => {
  const r = ob(datosD({ pagosFijos:{ '2026-11|alquiler': { fecha:'2026-11-05' }, '2026-10|icbc': { fecha:'2026-11-04' } } }), '2026-11-06', [ icbc('2026-10', 600000) ]);
  assert.equal(r.vencidas.length, 0); assert.ok(!r.pendientes.some(o => o.id === '2026-11|alquiler'));
  assert.equal(r.pagadas[0].id, '2026-11|alquiler'); assert.equal(r.pagadas[0].fechaPago, '2026-11-05');
  assert.deepEqual(r.estimados.map(o => o.id), ['2026-11|icbc', '2026-12|alquiler']);
});

test('D: no se da por pagado un vencimiento por pasar la fecha ni por empezar un período nuevo', () => {
  const r = ob(datosD(), '2026-12-20', [ icbc('2026-10', 600000) ]);
  assert.ok(r.vencidas.some(o => o.id === '2026-11|alquiler'));
  assert.ok(r.vencidas.some(o => o.id === '2026-10|icbc'));
});

test('D: tarjetas — temporal mientras no llega el resumen, estimado sin movimientos, y el definitivo REEMPLAZA (nunca los dos)', () => {
  const hoyStr = '2026-12-04', def = [ icbc('2026-10', 600000) ];
  const sinNada = ob(datosD(), hoyStr, def);
  const est = porId(sinNada, '2026-11|icbc');
  assert.equal(est.tipo, 'provisorio'); assert.equal(est.fuente, 'estimado'); assert.equal(est.monto, 600000); assert.equal(est.basadoEn, '2026-10');
  assert.ok(sinNada.vencidas.some(o => o.id === '2026-11|icbc'));
  const conMov = ob(datosD(), hoyStr, def, [ { ...icbc('2026-11', 150000), provisorio:true }, { ...icbc('2026-11', 50000), provisorio:true } ]);
  assert.equal(porId(conMov, '2026-11|icbc').monto, 200000); assert.equal(porId(conMov, '2026-11|icbc').fuente, 'movimientos');
  assert.equal(porId(conMov, '2026-11|icbc').basadoEn, null);
  const llego = ob(datosD(), hoyStr, [ ...def, icbc('2026-11', 700000) ], [ { ...icbc('2026-11', 150000), provisorio:true } ]);
  const nov = porId(llego, '2026-11|icbc');
  assert.equal(nov.tipo, 'definitivo'); assert.equal(nov.monto, 700000); assert.equal(nov.fuente, 'resumen');
  assert.equal(llego.todas.filter(o => o.id === '2026-11|icbc').length, 1);
  assert.equal(llego.estimados.some(o => o.id === '2026-11|icbc'), false);
});

test('D: con el corte por defecto el resumen de octubre (ya pagado, vencía el 3/11) no aparece como obligación', () => {
  const r = ob(datosD({ ajustes:{ obligacionesDesde: undefined } }), '2026-11-12', [ icbc('2026-10', 600000) ], [ { ...icbc('2026-11', 200000), provisorio:true } ]);
  assert.ok(!r.todas.some(o => o.id === '2026-10|icbc'));
  assert.ok(!r.todas.some(o => o.fecha < '2026-11-05'));
  const nov = porId(r, '2026-11|icbc');
  assert.equal(nov.fecha, '2026-12-03'); assert.equal(nov.monto, 200000); assert.equal(nov.fuente, 'movimientos');
});

// ═══ Prueba D2 — Cobertura del mes siguiente y vencidas de meses anteriores ═
const datosD2 = (extra = {}) => app({
  vencimientos: { alquiler:{ dia:10, mesSiguiente:false }, icbc:{ dia:3, mesSiguiente:true }, prestamos:{ dia:5, mesSiguiente:false } },
  gastosRecurrentes: { alquiler: 900000 },
  monthly: { '2026-10': { gastos:{ prestamos:'50000' } }, '2026-11': { ingresos:{ julieta:'1000000' } } },
  saldoJulieta: { '2026-11-01': 740000 }, uberDiDi: [ efectivo0 ],
  ajustes: { obligacionesDesde:'2026-10-01' }, ...extra,
});
const sitD2 = (appData, hoyStr = '2026-11-12') => construirSituacion({ appData, zapiaData:[], tarjetasData:[ icbc('2026-10', 600000) ],
  tarjetasProvisorias:[ { ...icbc('2026-11', 150000), provisorio:true }, { ...icbc('2026-11', 50000), provisorio:true } ], mesKey:'2026-11', hoyStr });

test('D2: la cobertura incluye SOLO lo impago que vence el mes siguiente (no el mes actual, no meses posteriores, no lo vencido)', () => {
  const s = sitD2(datosD2()), c = s.cobertura;
  assert.equal(c.mes, '2026-12');
  assert.deepEqual(c.items.map(o => o.id), ['2026-11|icbc', '2026-12|alquiler']);          // vence el 3/12 y el 10/12
  assert.equal(c.obligaciones.temporal, 200000); assert.equal(c.obligaciones.estimado, 900000); assert.equal(c.obligaciones.definitivo, 0);
  assert.equal(c.obligaciones.total, 1100000);
  // fuera: alquiler vencido de noviembre, préstamo vencido de octubre, y los que vencen desde enero
  assert.ok(!c.items.some(o => o.fecha.slice(0,7) !== '2026-12'));
  assert.ok(s.obligaciones.masAdelante.every(o => o.fecha >= '2027-01-01'));
  assert.equal(s.obligaciones.totales.masAdelante, s.obligaciones.masAdelante.reduce((a,o) => a + o.monto, 0));
});

test('D2: falta = obligaciones − disponibilidad real − sueldo previsto (componentes por separado; el sueldo no es disponibilidad)', () => {
  const s = sitD2(datosD2()), c = s.cobertura;
  assert.equal(s.disponibilidad.total, 790000); assert.equal(c.disponible, 790000);           // el sueldo NO suma a la disponibilidad
  assert.equal(c.sueldoPrevisto.monto, 1000000); assert.equal(c.sueldoPrevisto.mesSueldo, '2026-11');
  assert.equal(c.sueldoPrevisto.estado, 'pendiente'); assert.equal(c.sueldoPrevisto.fechaCobro, '2026-11-30');
  assert.equal(c.balance, 790000 + 1000000 - 1100000); assert.equal(c.alcanza, true); assert.equal(c.falta, 0);
  const sin = sitD2(datosD2({ monthly:{ '2026-10': { gastos:{ prestamos:'50000' } } }, saldoJulieta:{ '2026-11-01':100000 }, uberDiDi:[] })).cobertura;
  assert.equal(sin.sueldoPrevisto.monto, 0); assert.equal(sin.falta, 1100000 - 100000); assert.equal(sin.alcanza, false);
  assert.equal(sitD2(datosD2(), '2026-11-30').cobertura.sueldoPrevisto.estado, 'cobrado');
});

test('D2: lo vencido e impago de meses anteriores va en un bloque aparte con su total y NO entra en la cobertura', () => {
  const s = sitD2(datosD2()), o = s.obligaciones;
  assert.deepEqual(o.vencidasAnteriores.map(x => x.id), ['2026-10|prestamos', '2026-10|alquiler']);   // vencieron el 5/10 y el 10/10
  assert.equal(o.totales.vencidoAnterior, 50000 + 900000);
  o.vencidasAnteriores.forEach(x => { assert.ok(x.periodo && x.key && x.fecha && x.monto > 0); assert.equal(x.estado, 'vencido'); });
  assert.deepEqual(o.delMes.map(x => x.id), ['2026-10|icbc', '2026-11|alquiler']);                    // vencidas de ESTE mes: otra sección
  assert.ok(!s.cobertura.items.some(x => o.vencidasAnteriores.includes(x)));
  // pagar una la saca del bloque
  const pago = sitD2(datosD2({ pagosFijos:{ '2026-10|prestamos': { fecha:'2026-11-12' } } })).obligaciones;
  assert.deepEqual(pago.vencidasAnteriores.map(x => x.id), ['2026-10|alquiler']); assert.equal(pago.totales.vencidoAnterior, 900000);
});

test('D2: al llegar el resumen definitivo de noviembre reemplaza a los temporales (sin duplicar movimientos ni importes)', () => {
  const s = construirSituacion({ appData: datosD2(), zapiaData:[], tarjetasData:[ icbc('2026-10', 600000), icbc('2026-11', 700000) ],
    tarjetasProvisorias:[ { ...icbc('2026-11', 150000), provisorio:true }, { ...icbc('2026-11', 50000), provisorio:true } ], mesKey:'2026-11', hoyStr:'2026-11-12' });
  const nov = s.cobertura.items.find(o => o.id === '2026-11|icbc');
  assert.equal(nov.monto, 700000); assert.equal(nov.tipo, 'definitivo'); assert.equal(nov.fuente, 'resumen');
  assert.equal(s.cobertura.obligaciones.temporal, 0); assert.equal(s.cobertura.obligaciones.definitivo, 700000);
  assert.equal(s.cobertura.items.filter(o => o.key === 'icbc').length, 1);
  assert.equal(s.cobertura.obligaciones.total, 700000 + 900000);
});



test('D: un gasto fijo sin fecha cargada no es una obligación; uno nuevo con fecha sí', () => {
  const a = datosD({ ajustes:{ fijosExtra:[ { id:'x1', label:'Gimnasio' } ] }, gastosRecurrentes:{ alquiler:900000, x1:25000 }, vencimientos:{ x1:{ dia:8, mesSiguiente:false } } });
  const r = ob(a, '2026-11-02');
  assert.ok(r.pendientes.some(o => o.key === 'x1')); assert.ok(!r.todas.some(o => o.key === 'alquiler'));
});

test('D: fechas de vencimiento (mes siguiente, año nuevo, día 31 en mes corto)', () => {
  assert.equal(fechaVencimiento('2026-12', 3, true), '2027-01-03'); assert.equal(fechaVencimiento('2026-02', 31, false), '2026-02-28');
});

// ═══ Prueba E — Resultado mensual, disponibilidad y coherencia ═══════════
const semanaE = [ ...semanaA.slice(0,3), uber('2026-11-08',{ transferencia:270000 }) ];     // sin nueva declaración de efectivo
const appE = app({ uberDiDi:[ efectivo0, ...semanaE ], saldoJulieta:{ '2026-11-01':740000 }, ajustes:{ sueldoJulieta:1000000 },
  monthly:{ '2026-11': { gastos:{ alquiler:'200000', nicolas:'50000' }, ingresos:{ julieta:'' } } },
  vencimientos:{ alquiler:{ dia:10, mesSiguiente:false } } });
const zapE = [ ...gastosA, zap('2026-11-05','Julieta',40000,'transferencia'), zap('2026-11-06','Julieta',10000,'efectivo') ];
const tarE = [ icbc('2026-11', 80000) ];

test('E: resultado = ingresos del período − gastos del período, sin transferencias ni saldos', () => {
  const r = calcularResultadoMensual({ appData: appE, zapiaData: zapE, tarjetasData: tarE, mesKey: '2026-11' });
  assert.equal(r.ingresos.sueldo, 1000000); assert.equal(r.ingresos.uber, 300000);
  assert.equal(r.gastos.zapia, 30000 + 40000 + 10000);
  assert.equal(r.gastos.tarjetas, 80000); assert.equal(r.gastos.fijos, 250000);
  assert.equal(r.saldo, 1300000 - (80000 + 80000 + 250000));
});

test('E: lo provisorio, lo futuro y lo estimado no afectan el resultado actual', () => {
  const a = calcularResultadoMensual({ appData: appE, zapiaData: zapE, tarjetasData: tarE, mesKey: '2026-11' });
  const b = calcularResultadoMensual({ appData: { ...appE, gastosRecurrentes:{ alquiler:900000 } }, zapiaData: zapE, tarjetasData: tarE, mesKey: '2026-11' });
  assert.equal(a.saldo, b.saldo);
  const d = calcularResultadoMensual({ appData: appE, zapiaData: zapE, tarjetasData: tarE, mesKey: '2026-12' });
  assert.equal(d.gastos.zapia, 0); assert.equal(d.gastos.tarjetas, 0);
});

test('E: la disponibilidad es la suma de saldos reales; resultado y disponibilidad son cosas distintas', () => {
  const s = construirSituacion({ appData: appE, zapiaData: zapE, tarjetasData: tarE, mesKey: '2026-11', hoyStr: '2026-11-08' });
  assert.equal(s.disponibilidad.total, 740000 + 50000);
  assert.notEqual(s.disponibilidad.total, s.resultado.saldo);
  assert.equal(s.ingresos.germanUala.valor, 740000);
  assert.equal(s.ahorro, 0);
});

test('E: Principal, Control y Cierre usan el mismo resultado (una sola función)', () => {
  const ctx = { appData: appE, zapiaData: zapE, tarjetasData: tarE };
  const s = construirSituacion({ ...ctx, mesKey: '2026-11', hoyStr: '2026-11-08' });
  const fila = calcularFilaControl(ctx, '2026-11');
  assert.equal(fila[13], s.resultado.saldo); assert.equal(fila[12], s.resultado.gastos.total); assert.equal(fila[3], s.resultado.ingresos.total);
  assert.equal(fila[10] + fila[11], fila[12]);
  assert.equal(calcularFilasControl(ctx).length, 1);
});

test('E: cobertura del mes siguiente (obligaciones de ese mes − disponibilidad − sueldo previsto) y estado del sueldo', () => {
  const s = construirSituacion({ appData: appE, zapiaData: zapE, tarjetasData: tarE, mesKey: '2026-11', hoyStr: '2026-11-08' });
  assert.equal(s.cobertura.obligaciones.total, s.obligaciones.totales.mesSiguiente.total);
  assert.equal(s.cobertura.balance, s.cobertura.disponible + s.cobertura.sueldoPrevisto.monto - s.cobertura.obligaciones.total);
  const sq = estadoSueldo({ monto: 1000000, mesKey: '2026-11', hoyStr: '2026-11-08' });
  assert.equal(sq.estado, 'pendiente'); assert.equal(sq.fechaCobro, '2026-11-30');
  assert.equal(estadoSueldo({ monto: 1, mesKey: '2026-11', hoyStr: '2026-11-30' }).estado, 'cobrado');
});

test('E: el cierre guarda una foto y las tablas de Google Sheets salen del mismo motor', () => {
  const s = construirSituacion({ appData: appE, zapiaData: zapE, tarjetasData: tarE, mesKey: '2026-11', hoyStr: '2026-11-08' });
  const c = armarCierre(s);
  assert.equal(c.resultado.saldo, s.resultado.saldo); assert.equal(c.disponibilidad.total, 790000);
  const h = calcularHojasExtra(appE, zapE, tarE, [], '2026-11-08');
  assert.deepEqual(Object.keys(h), ['Ganancias Auto','Saldos Uala','Conciliaciones','Efectivo','Ahorros','Obligaciones']);
  Object.values(h).forEach(t => t.rows.forEach(r => assert.equal(r.length, t.headers.length)));
});

test('invariantes: ahorro manual, claves de fijos, totales de tarjeta por mes del resumen y sueldo recurrente', () => {
  assert.equal(calcularAhorroManual([ { tipo:'ingreso_extra', monto:100, fecha:'2026-01-01' }, { tipo:'retiro', monto:30, fecha:'2026-01-02' } ]), 70);
  assert.deepEqual(clavesFijos({ fijosExtra:[ { id:'x' } ] }).slice(-2), ['alquiler','x']);
  assert.deepEqual(calcularTotalesTarjetas([ { mes:'2026-10', tarjeta:'ICBC', importe:10, moneda:'USD' } ], { '2026-10':1000 }), { '2026-10': { icbc:10000 } });
  assert.equal(resolverMes({}, {}, {}, '2026-12', { sueldoJulieta:1600000 }).ingresos.julieta, '1600000');
});

test('robustez: con datos vacíos la situación no falla y todo da 0 o "sin datos"', () => {
  const s = construirSituacion({ appData: EMPTY_DATA(), zapiaData: [], tarjetasData: [], tarjetasProvisorias: [], mesKey: '2026-11', hoyStr: '2026-11-08' });
  assert.equal(s.disponibilidad.total, 0); assert.equal(s.disponibilidad.uala, null); assert.equal(s.resultado.saldo, 0);
  assert.equal(s.obligaciones.todas.length, 0); assert.equal(s.cobertura.alcanza, true);
  assert.equal(s.conciliacionUala.abierto, null); assert.equal(s.conciliacionEfectivo.periodos.length, 0);
  assert.equal(calcularFilasControl({ appData: EMPTY_DATA(), zapiaData: [], tarjetasData: [] }).length, 0);
});

test('robustez: mes pasado → la disponibilidad es la del cierre de ese mes y no la de hoy', () => {
  const a = app({ saldoJulieta: { '2026-10-25': 800000, '2026-11-01': 740000 } });
  assert.equal(construirSituacion({ appData: a, zapiaData: [], tarjetasData: [], mesKey: '2026-10', hoyStr: '2026-11-08' }).disponibilidad.uala.valor, 800000);
  assert.equal(construirSituacion({ appData: a, zapiaData: [], tarjetasData: [], mesKey: '2026-11', hoyStr: '2026-11-08' }).disponibilidad.uala.valor, 740000);
});
