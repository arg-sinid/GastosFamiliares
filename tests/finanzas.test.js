import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularConciliaciones, calcularPeriodoAbierto, calcularIngresoGerman, conciliarGerman,
  calcularResultadoMensual, calcularTotalesTarjetas, dedupePorId, itemsDelMes, itemsDeLaSemana,
  agruparGastosPorCategoria, agruparItems, resumenAuto, calcularFilasControl, calcularAhorroAcumulado,
  weekDates, getMonday, dateStr, hoy, calcularAhorroManual,
} from '../src/utils.js';
import { categorizarUno } from '../src/categorias.js';

const uber = (fecha, extra={}) => ({ id:fecha+JSON.stringify(extra), fecha, uber:0, didi:0, total:0, transferencia:0, efectivoCierreMes:0, ...extra });
const zap  = (fecha, quien, costo, medio='transferencia', que='x') => ({ id:`${fecha}${quien}${costo}${que}`, fecha, quien, costo, medio, que, hora:'10:00' });

// Escenario base: saldo 100k el dom 04/10; Germán giró 50k el dom 11/10; Julieta gastó 20k (30% efectivo).
const saldos = { '2026-10-04':100000, '2026-10-11':130000 };
const ud = [ uber('2026-10-11',{ transferencia:50000, total:60000 }) ];

test('8. conciliación con saldo real igual al esperado → diferencia 0 y el ingreso es el delta', () => {
  const z = [ zap('2026-10-07','Julieta',14000,'transferencia'), zap('2026-10-08','Julieta',6000,'efectivo') ];
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
  // ingreso Germán = delta real 30k (ya incluye la hormiga de -10k); resultado = 1.000.000 + 30.000 − 200.000
  assert.equal(r.germanIncome, 30000);
  assert.equal(r.saldo, 830000);
});

test('gastos de Julieta incluyen efectivo y transferencia; los de Germán no entran a la Uala', () => {
  const z = [ zap('2026-10-07','Julieta',1000,'efectivo'), zap('2026-10-07','Julieta',2000,'transferencia'), zap('2026-10-07','Germán',99999,'efectivo') ];
  const [p] = calcularConciliaciones(saldos, ud, z);
  assert.equal(p.gastosJulieta, 3000);
});

test('depósito de fin de mes: cuenta una sola vez (en el esperado) y no se suma aparte al ingreso', () => {
  const s = { '2026-10-25':100000, '2026-11-01':160000 };
  const u = [ uber('2026-10-31',{ efectivoCierreMes:20000 }), uber('2026-10-30',{ transferencia:40000 }) ];
  const [p] = calcularConciliaciones(s, u, []);
  assert.equal(p.deposito, 20000);
  assert.equal(p.esperado, 160000);
  assert.equal(p.diferencia, 0);                      // antes del arreglo habría dado +20k de "sobrante"
  assert.equal(calcularIngresoGerman(u, '2026-11', [], s, '2026-11-02'), 60000); // delta, sin sumar 20k de nuevo
});

test('11. los gastos se asignan al período correcto entre dos conciliaciones', () => {
  const s = { '2026-10-04':100000, '2026-10-11':100000, '2026-10-18':100000 };
  const z = [ zap('2026-10-04','Julieta',111), zap('2026-10-05','Julieta',222), zap('2026-10-11','Julieta',333), zap('2026-10-12','Julieta',444) ];
  const [p1, p2] = calcularConciliaciones(s, [], z);
  assert.equal(p1.gastosJulieta, 222 + 333);   // (04, 11]
  assert.equal(p2.gastosJulieta, 444);         // (11, 18]
});

test('ingreso de Germán: mes cerrado (delta real) y mes abierto (estimación) usan el mismo concepto', () => {
  const z = [ zap('2026-10-13','Julieta',5000) ];
  const u = [ uber('2026-10-11',{ transferencia:50000 }), uber('2026-10-18',{ transferencia:40000 }) ];
  // Con hoy=20/10 el período abierto (desde el 11) estima 40.000 − 5.000
  assert.equal(calcularPeriodoAbierto(saldos, u, z, '2026-10-20').ingresoEstimado, 35000);
  // 11/10 cerró: delta 30k; abierto: 35k
  assert.equal(calcularIngresoGerman(u, '2026-10', z, saldos, '2026-10-20'), 30000 + 35000);
  // Meses futuros: nada
  assert.equal(calcularIngresoGerman(u, '2026-12', z, saldos, '2026-10-20'), 0);
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
  assert.equal(calcularResultadoMensual(ctx,'2026-10').ing, 30000);
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
  assert.equal(fila[3], 1030000);
});

test('ahorro manual: ingresos suman y retiros restan', () => {
  assert.equal(calcularAhorroManual([{ tipo:'ingreso_extra', monto:100, fecha:'2026-01-01' }, { tipo:'retiro', monto:30, fecha:'2026-01-02' }]), 70);
});

test('hoy() usa la fecha de Buenos Aires aunque en UTC ya sea el día siguiente', () => {
  assert.equal(hoy(new Date('2026-10-28T01:30:00Z')), '2026-10-27');   // 22:30 en Argentina
});

test('ahorro acumulado no suma meses con saldo negativo', () => {
  const ctx = { monthly:{ '2026-08':{ ingresos:{julieta:'100'}, gastos:{ alquiler:'300' } }, '2026-09':{ ingresos:{julieta:'500'}, gastos:{ alquiler:'100' } } },
    gastosRecurrentes:{}, totalesTarjetas:{}, uberDiDi:[], zapiaData:[], saldoJulieta:{}, hoyStr:'2026-10-01' };
  assert.equal(calcularAhorroAcumulado(ctx, '2026-12'), 400);
});
