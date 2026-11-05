import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularConciliaciones, calcularPeriodoAbierto, calcularIngresoGerman, conciliarGerman,
  calcularResultadoMensual, calcularTotalesTarjetas, dedupePorId, itemsDelMes, itemsDeLaSemana,
  agruparGastosPorCategoria, agruparItems, resumenAuto, calcularFilasControl, estadoUala, gastosZapiaDe, listarVencimientos, agruparPendientes, ventanaVencimiento, analizarGastosJulieta, esTransferencia,
  weekDates, getMonday, dateStr, hoy, calcularAhorroManual,
  ultimoSaldoDelMes, calcularTotalesMes, calcularVencimientos, fechaVencimiento, vehiculoDeGasto, esCategoriaAuto, resumenAutoMeses,
} from '../src/utils.js';
import { categorizarUno } from '../src/categorias.js';

const uber = (fecha, extra={}) => ({ id:fecha+JSON.stringify(extra), fecha, uber:0, didi:0, total:0, transferencia:0, efectivoCierreMes:0, ...extra });
const zap  = (fecha, quien, costo, medio='transferencia', que='x') => ({ id:`${fecha}${quien}${costo}${que}`, fecha, quien, costo, medio, que, hora:'10:00' });

// Escenario base: saldo 100k el dom 04/10; Germán giró 50k el dom 11/10; Julieta gastó 20k (30% efectivo).
const saldos = { '2026-10-04':100000, '2026-10-11':130000 };
const ud = [ uber('2026-10-11',{ transferencia:50000, total:60000 }) ];

test('8. conciliación con saldo real igual al esperado → diferencia 0 y el ingreso es el delta', () => {
  const z = [ zap('2026-10-07','Julieta',14000,'transferencia'), zap('2026-10-08','Julieta',6000,'transferencia'), zap('2026-10-08','Julieta',9999,'efectivo') ];   // el efectivo no sale de la Uala
  const [p] = calcularConciliaciones(saldos, ud, z);
  assert.equal(p.esperado, 100000 + 50000 - 20000);
  assert.equal(p.diferencia, 0);
  assert.equal(p.ingresoGerman, 30000);
});

test('9. diferencia negativa (gasto hormiga) y positiva (sobrante)', () => {
  const z = [ zap('2026-10-07','Julieta',10000) ];
  const [neg] = calcularConciliaciones(saldos, ud, z);          // esperado 140k, real 130k
  assert.equal(neg.diferencia, -10000);
  const [pos] = calcularConciliaciones({ ...saldos, '2026-10-11':150000 }, ud, z);  // real 150k
  assert.equal(pos.diferencia, 10000);
});

test('10. el gasto hormiga NO se descuenta otra vez del resultado mensual', () => {
  const ctx = { monthly:{ '2026-10':{ ingresos:{julieta:'1000000'}, gastos:{alquiler:'200000'} } }, gastosRecurrentes:{}, totalesTarjetas:{},
    uberDiDi:ud, zapiaData:[ zap('2026-10-07','Julieta',10000) ], saldoJulieta:saldos, hoyStr:'2026-10-20' };
  const r = calcularResultadoMensual(ctx, '2026-10');
  // ingreso Germán = saldo declarado (130k); la diferencia de -10k NO se resta otra vez
  assert.equal(r.germanIncome, 130000);
  assert.equal(r.saldo, 1000000 + 130000 - 200000);
});

test('de la Uala solo salen los gastos de Julieta en modo transferencia (ni efectivo, ni los de Germán)', () => {
  const z = [ zap('2026-10-07','Julieta',1000,'efectivo'), zap('2026-10-07','Julieta',2000,'transferencia'), zap('2026-10-07','Germán',99999,'transferencia') ];
  const [p] = calcularConciliaciones(saldos, ud, z);
  assert.equal(p.gastosJulieta, 2000);
});

test('depósito de fin de mes: cuenta una sola vez (en el esperado) y no se suma aparte al ingreso', () => {
  const s = { '2026-10-25':100000, '2026-11-01':160000 };
  const u = [ uber('2026-10-31',{ efectivoCierreMes:20000 }), uber('2026-10-30',{ transferencia:40000 }) ];
  const [p] = calcularConciliaciones(s, u, []);
  assert.equal(p.deposito, 20000);
  assert.equal(p.esperado, 160000);
  assert.equal(p.diferencia, 0);                      // antes del arreglo habría dado +20k de "sobrante"
  assert.equal(calcularIngresoGerman(s, '2026-11'), 160000); // saldo declarado, sin sumar el depósito de nuevo
  assert.equal(calcularIngresoGerman(s, '2026-10'), 100000); // octubre: su último saldo declarado, tal cual
});

test('11. los gastos se asignan al período correcto entre dos conciliaciones', () => {
  const s = { '2026-10-04':100000, '2026-10-11':100000, '2026-10-18':100000 };
  const z = [ zap('2026-10-04','Julieta',111), zap('2026-10-05','Julieta',222), zap('2026-10-11','Julieta',333), zap('2026-10-12','Julieta',444) ];
  const [p1, p2] = calcularConciliaciones(s, [], z);
  assert.equal(p1.gastosJulieta, 222 + 333);   // (04, 11]
  assert.equal(p2.gastosJulieta, 444);         // (11, 18]
});

test('ingreso de Germán = saldo declarado TAL CUAL: no suma transferencias ni resta gastos posteriores', () => {
  const z = [ zap('2026-10-13','Julieta',5000) ];
  const u = [ uber('2026-10-11',{ transferencia:50000 }), uber('2026-10-18',{ transferencia:40000 }) ];
  assert.equal(calcularIngresoGerman(saldos, '2026-10'), 130000);                 // último saldo declarado del mes
  assert.equal(ultimoSaldoDelMes(saldos, '2026-10').fecha, '2026-10-11');
  assert.equal(calcularIngresoGerman(saldos, '2026-11'), 0);                      // mes nuevo sin declarar
  assert.equal(calcularResultadoMensual({ monthly:{ '2026-10':{ ingresos:{julieta:'0'}, gastos:{} } }, gastosRecurrentes:{}, totalesTarjetas:{}, uberDiDi:u, zapiaData:z, saldoJulieta:saldos }, '2026-10').germanIncome, 130000);
});

test('7. sueldo de Julieta distinto en dos meses consecutivos', () => {
  const ctx = { monthly:{ '2026-09':{ ingresos:{julieta:'900000'}, gastos:{} }, '2026-10':{ ingresos:{julieta:'1100000'}, gastos:{} } },
    gastosRecurrentes:{}, totalesTarjetas:{}, uberDiDi:[], zapiaData:[], saldoJulieta:{}, hoyStr:'2026-10-20' };
  assert.equal(calcularResultadoMensual(ctx,'2026-09').ing, 900000);
  assert.equal(calcularResultadoMensual(ctx,'2026-10').ing, 1100000);
});

test('6. el bruto Uber/DiDi no se suma al resultado familiar (solo lo juntado en Uala)', () => {
  const ctx = { monthly:{ '2026-10':{ ingresos:{julieta:'0'}, gastos:{} } }, gastosRecurrentes:{}, totalesTarjetas:{},
    uberDiDi:[ uber('2026-10-11',{ total:500000, transferencia:50000 }) ], zapiaData:[], saldoJulieta:saldos, hoyStr:'2026-10-11' };
  assert.equal(calcularResultadoMensual(ctx,'2026-10').ing, 130000);   // saldo declarado, no el bruto de 500k
});

test('conciliación de Germán: la diferencia sale de su bruto', () => {
  assert.deepEqual(conciliarGerman({ bruto:100000, gastos:20000, aportes:60000, efectivo:15000 }), { usos:95000, diferencia:-5000 });
  assert.equal(conciliarGerman({ bruto:100000, gastos:20000, aportes:60000, efectivo:20000 }).diferencia, 0);
});

test('tarjetas: totales por mes y moneda; un resumen sin dólar cargado no explota', () => {
  const movs = [ { mes:'2026-10', tarjeta:'ICBC', importe:1000, moneda:'ARS' }, { mes:'2026-10', tarjeta:'ICBC', importe:10, moneda:'USD' }, { mes:'2026-10', tarjeta:'BNA', importe:500, moneda:'ARS' } ];
  assert.deepEqual(calcularTotalesTarjetas(movs, { '2026-10':1000 }), { '2026-10':{ icbc:11000, bna:500 } });
});

test('3. importar dos veces el mismo PDF no duplica; sin id no se descarta nada', () => {
  const a = { id:'abc', mes:'2026-10', comercio:'YPF', importe:100 };
  assert.equal(dedupePorId([a, { ...a }, { ...a, id:'def' }]).length, 2);
  const sinId = { id:'', comercio:'YPF', importe:100, fecha:'2026-10-01' };
  assert.equal(dedupePorId([sinId, { ...sinId }]).length, 2);   // misma fecha e importe ≠ duplicado probado
});

const tarj = [
  { id:'t1', mes:'2026-10', tarjeta:'ICBC', fecha:'2026-10-14', comercio:'YPF RUTA', importe:50000, moneda:'ARS', cuotas:'', tipoMovimiento:'consumo' },
  { id:'t2', mes:'2026-10', tarjeta:'BNA',  fecha:'2026-10-03', comercio:'TALLER PEPE', importe:80000, moneda:'ARS', cuotas:'', tipoMovimiento:'consumo' },
  { id:'t3', mes:'2026-10', tarjeta:'ICBC', fecha:'2026-10-05', comercio:'AUTOPISTAS DEL SOL', importe:3000, moneda:'ARS', cuotas:'', tipoMovimiento:'consumo' },
];
const zapia = [ zap('2026-10-14','Germán',20000,'efectivo','nafta'), zap('2026-10-15','Germán',1500,'efectivo','peaje') ];
const cats = {};

test('2. mensual y semanal ven los mismos registros (semana = subconjunto del mes por fecha)', () => {
  const mes = itemsDelMes(zapia, tarj, {}, '2026-10');
  const dias = weekDates(getMonday(new Date('2026-10-14T12:00:00'))).map(dateStr);
  const sem = itemsDeLaSemana(zapia, tarj, {}, dias);
  assert.equal(mes.length, 5);
  assert.deepEqual(sem.map(i=>i.id).sort(), ['t1', zapia[0].id, zapia[1].id].sort());
  sem.forEach(i => assert.ok(mes.some(m => m.id === i.id)));
});

test('4/5. Auto consulta Gastos: mantenimiento, combustible y peajes aparecen una vez y los totales coinciden', () => {
  const { grupos, total } = agruparGastosPorCategoria(zapia, tarj, cats, {}, '2026-10');
  const a = resumenAuto(grupos);
  assert.equal(a.combustible.total, 70000);       // 50.000 tarjeta + 20.000 efectivo
  assert.equal(a.mantenimiento.total, 80000);
  assert.equal(a.peajes.total, 4500);             // 3.000 tarjeta + 1.500 efectivo
  assert.equal(a.mantenimiento.items.length, 1);
  assert.equal(total, 50000+80000+3000+20000+1500);
  // lo que muestra Gastos por categoría es exactamente lo que toma Auto
  assert.equal(grupos['Mantenimiento'].total, a.mantenimiento.total);
});

test('categoría guardada por el usuario manda sobre las reglas; "Peajes/Autopistas" histórico sigue sumando', () => {
  const c = { 'AUTOPISTAS DEL SOL': { categoria:'Peajes/Autopistas', emoji:'🛣️' }, 'TALLER PEPE': { categoria:'Auto', emoji:'🚗' } };
  const { grupos } = agruparGastosPorCategoria([], tarj, c, {}, '2026-10');
  const a = resumenAuto(grupos);
  assert.equal(a.peajes.total, 3000);
  assert.equal(a.sinClasificar.total, 80000);
});

test('categorización: palabras cortas por palabra completa', () => {
  assert.equal(categorizarUno('PANTALON JEAN').categoria, 'Indumentaria');
  assert.equal(categorizarUno('Medialunas del Sur').categoria, 'Panadería');
  assert.equal(categorizarUno('PAN Y MAS').categoria, 'Panadería');
  assert.equal(categorizarUno('MERPAGO*TELEPASE 123456').categoria, 'Peajes/TelePASE');
  assert.equal(categorizarUno('YPF CABALLITO').categoria, 'Combustible');
});

test('control: la fila de la hoja sale de las mismas funciones que la pantalla', () => {
  const ctx = { monthly:{ '2026-10':{ ingresos:{julieta:'1000000'}, gastos:{ alquiler:'200000', icbc:'1' } } }, gastosRecurrentes:{},
    totalesTarjetas:{ '2026-10':{ icbc:50000, bna:10000 } }, uberDiDi:ud, zapiaData:[], saldoJulieta:saldos, hoyStr:'2026-10-20' };
  const [fila] = calcularFilasControl(ctx, 'x');
  const r = calcularResultadoMensual(ctx, '2026-10');
  assert.equal(fila.length, 15);
  assert.equal(fila[13], r.saldo);
  assert.equal(fila[4], 50000);                 // la tarjeta calculada pisa lo manual
  assert.equal(fila[3], 1130000);
});

test('ahorro manual: ingresos suman y retiros restan', () => {
  assert.equal(calcularAhorroManual([{ tipo:'ingreso_extra', monto:100, fecha:'2026-01-01' }, { tipo:'retiro', monto:30, fecha:'2026-01-02' }]), 70);
});

test('hoy() usa la fecha de Buenos Aires aunque en UTC ya sea el día siguiente', () => {
  assert.equal(hoy(new Date('2026-10-28T01:30:00Z')), '2026-10-27');   // 22:30 en Argentina
});

test('caso real: saldo declarado 600.000 el domingo 25/10 → Principal muestra 600.000 aunque haya diferencia y movimientos después', () => {
  const s = { '2026-09-27':425000, '2026-10-18':520000, '2026-10-25':600000 };
  const u = [ uber('2026-10-25',{ transferencia:150000 }), uber('2026-10-26',{ transferencia:10000 }) ];
  const z = [ zap('2026-10-20','Julieta',30000), zap('2026-10-27','Julieta',4000,'efectivo') ];
  const [, p] = calcularConciliaciones(s, u.slice(0,1), z.slice(0,1));
  assert.equal(p.diferencia, -40000);                       // hormiga: se informa en Control, no se resta
  assert.equal(calcularIngresoGerman(s, '2026-10'), 600000); // exacto
});

test('la deuda del mes anterior ya no se arrastra como dato: se ignora', () => {
  const mes = { ingresos:{ julieta:'1000' }, gastos:{ alquiler:'400' }, deuda_anterior: 99999 };
  const t = calcularTotalesMes(mes, 200);
  assert.equal(t.egresos, 400); assert.equal(t.saldo, 800); assert.equal(t.deuda, 0);
});

// ── Vencimientos ─────────────────────────────────────────────────────
const venc = { icbc:{ dia:3, mesSiguiente:true }, prestamos:{ dia:3, mesSiguiente:true }, bna:{ dia:4, mesSiguiente:true } };
const gastosOct = { icbc:'900000', bna:'600000', prestamos:'300000', alquiler:'500000', nicolas:'' };

test('vencimientos: el resumen de octubre vence en noviembre y se acumula por fecha', () => {
  const r = calcularVencimientos({ vencimientos:venc, gastos:gastosOct, mesKey:'2026-10', hoyStr:'2026-10-30', disponible:3575000 });
  assert.deepEqual(r.pendientes.map(p => p.fecha), ['2026-11-03', '2026-11-04']);
  assert.equal(r.pendientes[0].total, 1200000);              // ICBC + préstamos
  assert.equal(r.pendientes[0].balance, 3575000 - 1200000);
  assert.equal(r.pendientes[1].acumulado, 1800000);          // + BNA
  assert.equal(r.totalPendiente, 1800000);
  assert.equal(r.balance, 3575000 - 1800000);
  assert.equal(r.proximo.fecha, '2026-11-03');
});

test('vencimientos: faltante cuando lo disponible no alcanza; los gastos sin fecha no entran', () => {
  const r = calcularVencimientos({ vencimientos:venc, gastos:gastosOct, mesKey:'2026-10', hoyStr:'2026-10-30', disponible:1000000 });
  assert.equal(r.proximo.balance, -200000);
  assert.equal(r.totalPendiente, 1800000);                   // alquiler (sin fecha) no suma
});

test('vencimientos: los que ya pasaron salen de pendientes y, sin pendientes, vuelve el resultado mensual', () => {
  const r = calcularVencimientos({ vencimientos:venc, gastos:gastosOct, mesKey:'2026-10', hoyStr:'2026-11-04', disponible:1 });
  assert.deepEqual(r.pendientes.map(p => p.fecha), ['2026-11-04']);     // vence hoy: todavía cuenta
  const r2 = calcularVencimientos({ vencimientos:venc, gastos:gastosOct, mesKey:'2026-10', hoyStr:'2026-11-05', disponible:1 });
  assert.equal(r2.pendientes.length, 0); assert.equal(r2.proximo, null); assert.equal(r2.hayConfigurados, true);
});

test('vencimientos: cambio de año, día 31 en mes corto y monto 0 sin vencimiento', () => {
  assert.equal(fechaVencimiento('2026-12', 3, true), '2027-01-03');
  assert.equal(fechaVencimiento('2026-02', 31, false), '2026-02-28');
  const r = calcularVencimientos({ vencimientos:{ icbc:{ dia:3, mesSiguiente:false } }, gastos:{ icbc:'0' }, mesKey:'2026-10', hoyStr:'2026-10-01', disponible:0 });
  assert.equal(r.pendientes.length, 0);
});

// ── Vehículos ────────────────────────────────────────────────────────
const vehs = [ { id:'A', marca:'Toyota', modelo:'Etios', patente:'AB123CD', anio:2019 }, { id:'B', marca:'Fiat', modelo:'Cronos', patente:'AC456EF', anio:2021 } ];

test('vehículos: gastos sin asignar van al primero; una asignación se respeta; un vehículo borrado vuelve al primero', () => {
  const gv = { t2:'B' };
  assert.equal(vehiculoDeGasto('t1', gv, vehs), 'A');
  assert.equal(vehiculoDeGasto('t2', gv, vehs), 'B');
  assert.equal(vehiculoDeGasto('t2', gv, [vehs[0]]), 'A');
  assert.equal(vehiculoDeGasto('t2', gv, []), null);
});

test('vehículos: la suma por vehículo coincide con el total de Gastos (sin duplicar ni perder)', () => {
  const gv = { t2:'B' };
  const porVeh = id => resumenAutoMeses(zapia, tarj, cats, {}, ['2026-10'], i => vehiculoDeGasto(i.id, gv, vehs) === id).total;
  const todos = resumenAutoMeses(zapia, tarj, cats, {}, ['2026-10']).total;
  const A = porVeh('A'), B = porVeh('B');
  assert.equal(B.mantenimiento, 80000);                       // el taller se imputó al B
  assert.equal(A.mantenimiento, 0);
  ['combustible','peajes','mantenimiento','sinClasificar'].forEach(k => assert.equal(A[k] + B[k], todos[k]));
});

test('categorías de auto reconocidas para pedir vehículo', () => {
  ['Combustible','Mantenimiento','Peajes/TelePASE','Peajes/Autopistas','Auto'].forEach(c => assert.ok(esCategoriaAuto(c)));
  assert.equal(esCategoriaAuto('Supermercado'), false);
});

// ── Vencimientos con ventana, pagos marcados y saldo vivo ────────────
const ventOct = { icbc:{ dia:3, mesSiguiente:true }, prestamos:{ dia:3, mesSiguiente:true }, bna:{ dia:4, mesSiguiente:true } };
const gastosDe = k => ({ '2026-10': { icbc:'900000', prestamos:'300000', bna:'600000' }, '2026-11': { segundo:'330000', alquiler:'900000' } }[k] || {});
const ventNov = { ...ventOct, segundo:{ dia:4, mesSiguiente:true }, alquiler:{ dia:10, mesSiguiente:true } };
const lista = (hoyStr, pagosFijos = {}) => listarVencimientos({ vencimientos:ventNov, gastosDe, meses:['2026-10','2026-11','2026-12'], pagosFijos, hoyStr });

test('vencimientos: aparecen desde el 25 del mes anterior al de su fecha y no antes', () => {
  assert.equal(ventanaVencimiento('2026-12-04'), '2026-11-25');
  assert.equal(ventanaVencimiento('2027-01-03'), '2026-12-25');
  const antes = lista('2026-11-24').filter(i => i.visible);
  assert.equal(antes.length, 0);   // los de noviembre ya pasaron; los de diciembre todavía no aparecen
  const dia25 = lista('2026-11-25').filter(i => i.visible);
  assert.deepEqual(dia25.map(i => i.fecha), ['2026-12-04','2026-12-10']);
});

test('vencimientos: el 3/11 se ven primero los de noviembre (los más cercanos), no los de diciembre', () => {
  const v = lista('2026-11-03').filter(i => i.visible);
  assert.deepEqual(v.map(i => `${i.fecha} ${i.key}`), ['2026-11-03 icbc','2026-11-03 prestamos','2026-11-04 bna']);
  const g = agruparPendientes(lista('2026-11-03'), 2000000);
  assert.equal(g[0].total, 1200000); assert.equal(g[1].acumulado, 1800000); assert.equal(g[1].balance, 200000);
});

test('vencimientos: marcar un pago lo oculta y deja de contar como pendiente', () => {
  const v = lista('2026-11-03', { '2026-10|icbc': { fecha:'2026-11-02' } }).filter(i => i.visible);
  assert.deepEqual(v.map(i => i.key), ['prestamos','bna']);
});

test('vencimientos: cuando pasaron todos (o están marcados) no queda nada visible', () => {
  assert.equal(lista('2026-11-05').filter(i => i.visible).length, 0);          // hasta el 25/11 no aparecen los de diciembre
  const marcados = { '2026-10|icbc':{fecha:'2026-11-02'}, '2026-10|prestamos':{fecha:'2026-11-02'}, '2026-10|bna':{fecha:'2026-11-02'} };
  assert.equal(lista('2026-11-03', marcados).filter(i => i.visible).length, 0);
});

const pagosNov = hoyStr => lista(hoyStr).filter(i => i.pagado).map(i => ({ fecha:i.fechaPago, monto:i.monto }));
const baseUala = { saldoDeclarado:740000, fechaDeclaracion:'2026-11-01', mesKey:'2026-11' };

test('saldo vivo: antes de que llegue el primer vencimiento queda igual al declarado', () => {
  const r = estadoUala({ ...baseUala, pagos:pagosNov('2026-11-03'), sueldoPorMes:{ '2026-11':1000000 } });
  assert.equal(r.ualaHoy, 740000); assert.equal(r.sueldoRestante, 1000000);
});

test('saldo vivo: cada pago sale primero del sueldo de Julieta y, agotado, de la Uala', () => {
  const r = estadoUala({ ...baseUala, pagos:pagosNov('2026-11-05'), sueldoPorMes:{ '2026-11':1000000 } });
  assert.equal(r.pagadoDespues, 1800000); assert.equal(r.deUala, 800000);
  assert.equal(r.sueldoRestante, 0); assert.equal(r.ualaHoy, -60000);            // negativa hasta que Julieta declare de nuevo
});

test('saldo vivo: sin sueldo cargado en el mes, todo sale de la Uala', () => {
  assert.equal(estadoUala({ ...baseUala, pagos:pagosNov('2026-11-05'), sueldoPorMes:{} }).ualaHoy, 740000 - 1800000);
});

test('saldo vivo: un pago marcado antes de su vencimiento también baja el saldo (con el sueldo del mes en que se paga)', () => {
  const l = lista('2026-11-26', { '2026-11|segundo': { fecha:'2026-11-26' } });
  const pagos = l.filter(i => i.pagado).map(i => ({ fecha:i.fechaPago, monto:i.monto }));
  const r = estadoUala({ ...baseUala, pagos, sueldoPorMes:{ '2026-11':100000 } });
  assert.equal(r.deUala, 1800000 + 330000 - 100000);
});

test('saldo vivo: los pagos anteriores a la declaración ya están en el saldo declarado (solo gastaron sueldo)', () => {
  const r = estadoUala({ saldoDeclarado:740000, fechaDeclaracion:'2026-11-03', mesKey:'2026-11', pagos:pagosNov('2026-11-05'), sueldoPorMes:{ '2026-11':1000000 } });
  assert.equal(r.deUala, 600000 + 0);                // 3/11: 1.200.000 gastó el sueldo (1.000.000) y 200.000 ya estaban en el saldo; el del 4/11 sale entero de la Uala
});

test('saldo vivo: los gastos de Julieta por transferencia posteriores a la declaración bajan el saldo', () => {
  const z = [ zap('2026-11-02','Julieta',20000,'transferencia'), zap('2026-11-02','Julieta',50000,'efectivo'), zap('2026-10-31','Julieta',9000,'transferencia') ];
  const gastosUala = gastosZapiaDe(z, 'Julieta', '2026-11-01', '2026-11-03', 'transferencia');
  assert.equal(gastosUala, 20000);
  assert.equal(estadoUala({ ...baseUala, pagos:[], sueldoPorMes:{}, gastosUala }).ualaHoy, 720000);
});

test('Zapia: "transferencia" se reconoce por la raíz y se explica por qué un gasto resta o no', () => {
  assert.ok(esTransferencia('Transferencia')); assert.ok(esTransferencia('transf. bancaria')); assert.equal(esTransferencia('efectivo'), false);
  const z = [ zap('2026-11-01','Julieta',100,'efectivo'), zap('2026-11-02','Julieta',200,'transferencia'), zap('2026-11-02','Julieta',300,'efectivo'), { ...zap('2026-11-03','Juli',400,'transferencia') } ];
  const a = analizarGastosJulieta(z, '2026-11-01', '2026-11-05');
  assert.equal(a.restan.length, 1); assert.equal(a.mismoDia.length, 1); assert.equal(a.otroMedio.length, 1); assert.equal(a.sinIdentificar.length, 1);
});

test('conciliación: se declara en cualquier fecha y la diferencia sale de saldo anterior − gastos por transferencia', () => {
  const s = { '2026-11-01':740000, '2026-11-07':500000 };
  const z = [ zap('2026-11-03','Julieta',100000,'transferencia'), zap('2026-11-05','Julieta',50000,'transferencia') ];
  const [p] = calcularConciliaciones(s, [], z);
  assert.equal(p.esperado, 590000); assert.equal(p.diferencia, -90000);           // hormiga de 90.000
});
