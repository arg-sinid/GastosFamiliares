// Pruebas de utilidades: fechas, categorías, duplicados, ítems de Gastos, Auto y vehículos.
// (El motor financiero se prueba en motor.test.js.)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupePorId, itemsDelMes, itemsDeLaSemana, agruparGastosPorCategoria, resumenAuto, resumenAutoMeses,
  weekDates, getMonday, dateStr, hoy, ultimoDiaHabil, vehiculoDeGasto, esCategoriaAuto, mesDesplazado, EMPTY_DATA, normalizarAppData,
} from '../src/utils.js';
import { categorizarUno } from '../src/categorias.js';

const zap = (fecha, quien, costo, medio = 'transferencia', que = 'x') => ({ id: `${fecha}${quien}${costo}${que}`, fecha, quien, costo, medio, que, hora: '10:00' });

test('hoy() usa la fecha de Buenos Aires aunque en UTC ya sea el día siguiente', () => {
  assert.equal(hoy(new Date('2026-10-28T01:30:00Z')), '2026-10-27');
});

test('último día hábil: se cobra el último día de lunes a viernes', () => {
  assert.equal(ultimoDiaHabil('2026-11'), '2026-11-30');
  assert.equal(ultimoDiaHabil('2026-10'), '2026-10-30');
  assert.equal(ultimoDiaHabil('2027-01'), '2027-01-29');
  assert.equal(mesDesplazado('2026-12', 1), '2027-01'); assert.equal(mesDesplazado('2026-11', -1), '2026-10');
});

test('datos: normalizarAppData completa los campos nuevos sin perder los existentes', () => {
  const n = normalizarAppData({ monthly:{ '2026-10':{} }, uberDiDi:[ { id:'a' } ] });
  assert.deepEqual(Object.keys(n).sort(), Object.keys(EMPTY_DATA()).sort());
  assert.equal(n.uberDiDi.length, 1); assert.deepEqual(n.cierres, {});
});

test('importar dos veces el mismo PDF no duplica; sin id no se descarta nada', () => {
  const a = { id:'abc', mes:'2026-10', comercio:'YPF', importe:100 };
  assert.equal(dedupePorId([a, { ...a }, { ...a, id:'def' }]).length, 2);
  const sinId = { id:'', comercio:'YPF', importe:100, fecha:'2026-10-01' };
  assert.equal(dedupePorId([sinId, { ...sinId }]).length, 2);
});

const tarj = [
  { id:'t1', mes:'2026-10', tarjeta:'ICBC', fecha:'2026-10-14', comercio:'YPF RUTA', importe:50000, moneda:'ARS', cuotas:'', tipoMovimiento:'consumo' },
  { id:'t2', mes:'2026-10', tarjeta:'BNA',  fecha:'2026-10-03', comercio:'TALLER PEPE', importe:80000, moneda:'ARS', cuotas:'', tipoMovimiento:'consumo' },
  { id:'t3', mes:'2026-10', tarjeta:'ICBC', fecha:'2026-10-05', comercio:'AUTOPISTAS DEL SOL', importe:3000, moneda:'ARS', cuotas:'', tipoMovimiento:'consumo' },
];
const zapia = [ zap('2026-10-14','Germán',20000,'efectivo','nafta'), zap('2026-10-15','Germán',1500,'efectivo','peaje') ];
const cats = {};

test('mensual y semanal ven los mismos registros (semana = subconjunto del mes por fecha)', () => {
  const mes = itemsDelMes(zapia, tarj, {}, '2026-10');
  const dias = weekDates(getMonday(new Date('2026-10-14T12:00:00'))).map(dateStr);
  const sem = itemsDeLaSemana(zapia, tarj, {}, dias);
  assert.equal(mes.length, 5);
  assert.deepEqual(sem.map(i=>i.id).sort(), ['t1', zapia[0].id, zapia[1].id].sort());
  sem.forEach(i => assert.ok(mes.some(m => m.id === i.id)));
});

test('Auto consulta Gastos: mantenimiento, combustible y peajes aparecen una vez y los totales coinciden', () => {
  const { grupos, total } = agruparGastosPorCategoria(zapia, tarj, cats, {}, '2026-10');
  const a = resumenAuto(grupos);
  assert.equal(a.combustible.total, 70000); assert.equal(a.mantenimiento.total, 80000); assert.equal(a.peajes.total, 4500);
  assert.equal(a.mantenimiento.items.length, 1);
  assert.equal(total, 50000+80000+3000+20000+1500);
  assert.equal(grupos['Mantenimiento'].total, a.mantenimiento.total);
});

test('categoría guardada por el usuario manda sobre las reglas; "Peajes/Autopistas" histórico sigue sumando', () => {
  const c = { 'AUTOPISTAS DEL SOL': { categoria:'Peajes/Autopistas', emoji:'🛣️' }, 'TALLER PEPE': { categoria:'Auto', emoji:'🚗' } };
  const a = resumenAuto(agruparGastosPorCategoria([], tarj, c, {}, '2026-10').grupos);
  assert.equal(a.peajes.total, 3000); assert.equal(a.sinClasificar.total, 80000);
});

test('categorización: palabras cortas por palabra completa', () => {
  assert.equal(categorizarUno('PANTALON JEAN').categoria, 'Indumentaria');
  assert.equal(categorizarUno('Medialunas del Sur').categoria, 'Panadería');
  assert.equal(categorizarUno('PAN Y MAS').categoria, 'Panadería');
  assert.equal(categorizarUno('MERPAGO*TELEPASE 123456').categoria, 'Peajes/TelePASE');
  assert.equal(categorizarUno('YPF CABALLITO').categoria, 'Combustible');
});

const vehs = [ { id:'A', marca:'Toyota', modelo:'Etios', patente:'AB123CD', anio:2019 }, { id:'B', marca:'Fiat', modelo:'Cronos', patente:'AC456EF', anio:2021 } ];

test('vehículos: sin asignar → primero; asignación respetada; vehículo borrado vuelve al primero', () => {
  const gv = { t2:'B' };
  assert.equal(vehiculoDeGasto('t1', gv, vehs), 'A'); assert.equal(vehiculoDeGasto('t2', gv, vehs), 'B');
  assert.equal(vehiculoDeGasto('t2', gv, [vehs[0]]), 'A'); assert.equal(vehiculoDeGasto('t2', gv, []), null);
});

test('vehículos: la suma por vehículo coincide con el total de Gastos', () => {
  const gv = { t2:'B' };
  const porVeh = id => resumenAutoMeses(zapia, tarj, cats, {}, ['2026-10'], i => vehiculoDeGasto(i.id, gv, vehs) === id).total;
  const todos = resumenAutoMeses(zapia, tarj, cats, {}, ['2026-10']).total, A = porVeh('A'), B = porVeh('B');
  assert.equal(B.mantenimiento, 80000); assert.equal(A.mantenimiento, 0);
  ['combustible','peajes','mantenimiento','sinClasificar'].forEach(k => assert.equal(A[k] + B[k], todos[k]));
});

test('categorías de auto reconocidas', () => {
  ['Combustible','Mantenimiento','Peajes/TelePASE','Peajes/Autopistas','Auto'].forEach(c => assert.ok(esCategoriaAuto(c)));
  assert.equal(esCategoriaAuto('Supermercado'), false);
});
