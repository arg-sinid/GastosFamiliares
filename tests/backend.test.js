// Ejecuta apps_script_v6.js real dentro de un sandbox con una planilla simulada.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import crypto from 'node:crypto';

const codigo = fs.readFileSync(new URL('../backend/apps_script_v6.js', import.meta.url), 'utf8');

function crearEntorno(hojasIniciales = {}) {
  const hojas = {};
  const nuevaHoja = (name, filas = []) => {
    const celdas = new Map(); filas.forEach((f,i) => f.forEach((v,j) => celdas.set(`${i+1},${j+1}`, v)));
    const sh = { name, celdas, oculta:false };
    const rango = (r, c, nr = 1, nc = 1) => {
      const api = {
        getValue: () => celdas.get(`${r},${c}`) ?? '',
        getValues: () => Array.from({length:nr},(_,i)=>Array.from({length:nc},(_,j)=>celdas.get(`${r+i},${c+j}`) ?? '')),
        setValue: v => { celdas.set(`${r},${c}`, v); return api; },
        setValues: vs => { vs.forEach((f,i)=>f.forEach((v,j)=>celdas.set(`${r+i},${c+j}`, v))); return api; },
        clearContent: () => { for (let i=0;i<nr;i++) for (let j=0;j<nc;j++) celdas.delete(`${r+i},${c+j}`); return api; },
      };
      const p = new Proxy(api, { get:(t,k)=> k in t ? t[k] : () => p });   // métodos de formato: no-ops encadenables
      return p;
    };
    sh.getRange = (a, b, c, d) => typeof a === 'string' ? rango(1, a.charCodeAt(0) - 64) : rango(a, b, c, d);
    sh.getDataRange = () => { const filas = Math.max(0, ...[...celdas.keys()].map(k=>+k.split(',')[0])), cols = Math.max(0, ...[...celdas.keys()].map(k=>+k.split(',')[1])); return rango(1,1,filas,cols); };
    sh.getLastRow = () => Math.max(0, ...[...celdas.keys()].map(k=>+k.split(',')[0]));
    sh.hideSheet = () => { sh.oculta = true; };
    ['setFrozenRows','setRowHeight','setColumnWidth'].forEach(m => sh[m] = () => {});
    hojas[name] = sh; return sh;
  };
  Object.entries(hojasIniciales).forEach(([n,f]) => nuevaHoja(n, f));
  const ctx = {
    console, JSON, Date, Math, Number, String, Array, Object, Error, parseFloat, RegExp,
    SpreadsheetApp: { openById: () => ({ getSheetByName: n => hojas[n] || null, insertSheet: n => nuevaHoja(n) }) },
    LockService: { getScriptLock: () => ({ waitLock(){}, releaseLock(){} }) },
    ContentService: { MimeType:{JSON:'json'}, createTextOutput: t => ({ t, setMimeType(){ return this; } }) },
    Utilities: {
      DigestAlgorithm:{MD5:'md5'},
      computeDigest: (_, s) => [...crypto.createHash('md5').update(String(s)).digest()].map(b => b > 127 ? b - 256 : b),
      formatDate: (d, tz, f) => f.startsWith('yyyy-MM-dd') ? d.toISOString().slice(0,10) : f.startsWith('yyyyMMdd') ? d.toISOString().replace(/[-:T]/g,'').slice(0,15).replace(/^(\d{8})/, '$1_') : d.toISOString(),
    },
  };
  vm.createContext(ctx); vm.runInContext(codigo, ctx);
  const get = tipo => JSON.parse(ctx.doGet({ parameter:{ tipo } }).t);
  const post = payload => JSON.parse(ctx.doPost({ postData:{ contents: JSON.stringify(payload) } }).t);
  return { ctx, hojas, get, post };
}
const vacio = () => ({ monthly:{}, categories:{}, uberDiDi:[], gastosRecurrentes:{}, saldoJulieta:{}, dolarTarjeta:{}, ahorroMovimientos:[], autoDetalle:{} });
const fila = n => ['Octubre 2026', n, 0, n, 0,0,0,0,0,0, 0, 0, 0, n, ''];

test('lee el formato viejo (todo en A1) como versión 0', () => {
  const legacy = { monthly:{ '2026-10':{ ingresos:{julieta:'5'} } }, uberDiDi:[{ id:'a', fecha:'2026-10-01' }] };
  const { get } = crearEntorno({ _app_data_: [[JSON.stringify(legacy)]] });
  const r = get('appdata');
  assert.equal(r.version, 0);
  assert.equal(r.data.uberDiDi.length, 1);
  assert.deepEqual(r.data.autoDetalle, {});
});

test('15. primera escritura sobre el formato viejo: hace backup y conserva todos los datos', () => {
  const legacy = { monthly:{ '2026-10':{ ingresos:{julieta:'5'} } }, uberDiDi:[{ id:'a', fecha:'2026-10-01' }] };
  const { post, get, hojas } = crearEntorno({ _app_data_: [[JSON.stringify(legacy)]] });
  const d = { ...vacio(), ...legacy, uberDiDi:[{ id:'b', fecha:'2026-10-02' }, { id:'a', fecha:'2026-10-01' }] };
  const r = post({ baseVersion:0, data:d, filasControl:[fila(5)] });
  assert.equal(r.status, 'ok'); assert.equal(r.version, 1); assert.ok(r.backup);
  assert.equal(JSON.parse(hojas[r.backup].celdas.get('1,1')).uberDiDi.length, 1);   // copia del original intacta
  assert.equal(get('appdata').data.uberDiDi.length, 2);
});

test('sin tope de 50.000 caracteres: un estado de 300 KB se parte, se lee igual y se achica sin dejar basura', () => {
  const { post, get, hojas } = crearEntorno();
  const grande = vacio(); grande.uberDiDi = Array.from({length:2000},(_,i)=>({ id:'r'+i, fecha:'2026-10-01', total:i, nota:'x'.repeat(120) }));
  grande.monthly['2026-10'] = {};
  assert.equal(post({ baseVersion:0, data:grande }).status, 'ok');
  const sh = hojas['_app_data_'];
  assert.ok(JSON.parse(sh.celdas.get('1,2')).n > 1);
  [...sh.celdas.entries()].filter(([k]) => k.endsWith(',1')).forEach(([,v]) => assert.ok(String(v).length <= 40000));
  assert.deepEqual(get('appdata').data.uberDiDi, grande.uberDiDi);
  const chico = vacio(); chico.monthly['2026-10'] = {}; chico.uberDiDi = [{ id:'solo', fecha:'2026-10-01' }];
  assert.equal(post({ baseVersion:1, data:chico }).status, 'ok');
  assert.deepEqual(get('appdata').data.uberDiDi, chico.uberDiDi);
  assert.equal([...sh.celdas.keys()].filter(k => k.endsWith(',1')).length, 1);
});

test('13. guardado con versión vieja → conflict con el estado actual; no pisa', () => {
  const { post, get } = crearEntorno();
  const base = vacio(); base.monthly['2026-10'] = {};
  assert.equal(post({ baseVersion:0, data:base }).status, 'ok');
  const otro = { ...base, uberDiDi:[{ id:'del-otro', fecha:'2026-10-02' }] };
  assert.equal(post({ baseVersion:1, data:otro }).status, 'ok');
  const r = post({ baseVersion:1, data:{ ...base, categories:{ x:{ categoria:'Otros' } } } });   // dispositivo desactualizado
  assert.equal(r.status, 'conflict'); assert.equal(r.version, 2);
  assert.equal(r.data.uberDiDi.length, 1);
  assert.equal(get('appdata').data.uberDiDi.length, 1);
});

test('rechaza guardado vacío sobre datos existentes y payload de app vieja sin baseVersion', () => {
  const { post, get } = crearEntorno();
  const d = vacio(); d.monthly['2026-10'] = {}; d.uberDiDi = [{ id:'a', fecha:'2026-10-01' }];
  post({ baseVersion:0, data:d });
  assert.equal(post({ baseVersion:1, data:vacio() }).status, 'error');
  assert.equal(post({ allData:{}, categories:{} }).status, 'error');          // formato de la app anterior
  assert.equal(get('appdata').data.uberDiDi.length, 1);
});

test('la hoja Control se escribe con las filas de la app, y un fallo ahí no invalida el guardado', () => {
  const { post, hojas } = crearEntorno();
  const d = vacio(); d.monthly['2026-10'] = {};
  const r = post({ baseVersion:0, data:d, filasControl:[fila(10), ['fila corta']] });
  assert.equal(r.status, 'ok'); assert.equal(r.controlOk, true);
  assert.equal(hojas['Control 2026'].celdas.get('2,2'), 10);
  assert.equal(hojas['Control 2026'].celdas.get('3,1'), undefined);            // la fila inválida se descarta
  const r2 = post({ baseVersion:1, data:d, filasControl:'basura' });
  assert.equal(r2.status, 'ok');
});

test('Registro Diario: ids estables y distintos incluso con filas idénticas', () => {
  const rows = [['fecha','hora','quien','que','costo','medio'],
    ['2026-10-14','10:00','Germán','nafta',20000,'efectivo'], ['2026-10-14','10:00','Germán','nafta',20000,'efectivo'], ['2026-10-15','09:00','Julieta','pan',500,'transferencia']];
  const { get } = crearEntorno({ 'Registro Diario': rows });
  const a = get('zapia').data, b = get('zapia').data;
  assert.equal(new Set(a.map(r=>r.id)).size, 3);
  assert.deepEqual(a.map(r=>r.id), b.map(r=>r.id));
});

test('Tarjetas: normaliza el mes y devuelve id_unico para deduplicar importaciones', () => {
  const rows = [['id_unico','mes','tarjeta','fecha','comercio','importe','moneda','cuotas','tipo_movimiento'],
    ['k1','2026-8','icbc','2026-08-03','YPF',1000,'ARS','','consumo'], ['k1','2026-8','icbc','2026-08-03','YPF',1000,'ARS','','consumo']];
  const { get } = crearEntorno({ Tarjetas: rows });
  const d = get('tarjetas').data;
  assert.equal(d[0].mes, '2026-08'); assert.equal(d[0].tarjeta, 'ICBC'); assert.equal(d[0].id, 'k1');
});

test('restaurarBackup vuelve a dejar el estado del backup como versión nueva', () => {
  const legacy = { monthly:{ '2026-10':{} }, uberDiDi:[{ id:'a', fecha:'2026-10-01' }] };
  const { post, get, ctx } = crearEntorno({ _app_data_: [[JSON.stringify(legacy)]] });
  const r = post({ baseVersion:0, data:{ ...vacio(), monthly:{ '2026-10':{} }, uberDiDi:[{ id:'z', fecha:'2026-10-09' }] } });
  ctx.restaurarBackup(r.backup);
  const s = get('appdata'); assert.equal(s.version, 2); assert.equal(s.data.uberDiDi[0].id, 'a');
});

test('v6.1: escribe las hojas legibles derivadas, descarta filas inválidas e ignora nombres que no están en la lista', () => {
  const { post, hojas } = crearEntorno();
  const d = vacio(); d.monthly['2026-10'] = {};
  const r = post({ baseVersion:0, data:d, hojasExtra:{
    'Saldos Uala': { headers:['Fecha','Saldo real declarado'], rows:[ ['2026-11-01', 740000], ['fila corta'] ] },
    'Hoja rara':   { headers:['x'], rows:[[1]] },
  } });
  assert.equal(r.status, 'ok'); assert.equal(r.hojasOk, true);
  assert.equal(hojas['Saldos Uala'].celdas.get('1,1'), 'Fecha');
  assert.equal(hojas['Saldos Uala'].celdas.get('2,2'), 740000);
  assert.equal(hojas['Saldos Uala'].celdas.get('3,1'), undefined);
  assert.equal(hojas['Hoja rara'], undefined);
  // un segundo guardado reescribe sin dejar filas viejas
  post({ baseVersion:1, data:d, hojasExtra:{ 'Saldos Uala': { headers:['Fecha','Saldo real declarado'], rows:[ ['2026-11-08', 500000] ] } } });
  assert.equal(hojas['Saldos Uala'].celdas.get('2,1'), '2026-11-08');
});
