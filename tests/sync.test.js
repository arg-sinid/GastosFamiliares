import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeAppData, SyncEngine, deepEqual } from '../src/sync.js';
import { EMPTY_DATA, normalizarAppData } from '../src/utils.js';

const reg = (id, fecha, extra={}) => ({ id, fecha, total:100, transferencia:0, ...extra });
const data = (o={}) => ({ ...EMPTY_DATA(), ...o });

// Servidor simulado con la misma semántica que apps_script_v6 (versión + conflict + rechazo de vacío).
function fakeServer(initial = data()) {
  const s = { version:1, data:structuredClone(initial), llamadas:0, caido:false, perderRespuesta:false };
  s.post = async ({ baseVersion, data: d }) => {
    s.llamadas++;
    if (s.caido) throw new Error('network');
    const hayDatos = Object.keys(s.data.monthly).length || s.data.uberDiDi.length;
    if (baseVersion !== s.version) return { status:'conflict', version:s.version, data:structuredClone(s.data) };
    if (hayDatos && !Object.keys(d.monthly).length && !d.uberDiDi.length) return { status:'error', msg:'vacío' };
    s.data = structuredClone(d); s.version++;
    if (s.perderRespuesta) { s.perderRespuesta = false; throw new Error('timeout'); }
    return { status:'ok', version:s.version };
  };
  return s;
}
const memStore = () => { const m = new Map(); return { get:k=>m.has(k)?{value:m.get(k)}:null, set:(k,v)=>m.set(k,v), remove:k=>m.delete(k), m }; };

test('merge: cada dispositivo agrega un registro distinto → quedan los dos', () => {
  const base = data({ uberDiDi:[reg('a','2026-10-01')] });
  const mine = data({ uberDiDi:[reg('m','2026-10-03'), reg('a','2026-10-01')] });
  const theirs = data({ uberDiDi:[reg('t','2026-10-02'), reg('a','2026-10-01')] });
  const out = mergeAppData(base, mine, theirs);
  assert.deepEqual(out.uberDiDi.map(r=>r.id), ['m','t','a']);
});

test('merge: el mismo registro agregado en ambos lados no se duplica', () => {
  const base = data(); const r = reg('x','2026-10-03');
  assert.equal(mergeAppData(base, data({ uberDiDi:[r] }), data({ uberDiDi:[r] })).uberDiDi.length, 1);
});

test('merge: bajas y ediciones de cada lado se respetan', () => {
  const base = data({ ahorroMovimientos:[reg('1','2026-01-01'), reg('2','2026-01-02'), reg('3','2026-01-03')] });
  const mine = data({ ahorroMovimientos:[reg('2','2026-01-02'), reg('3','2026-01-03', { total:999 })] });     // borré 1, edité 3
  const theirs = data({ ahorroMovimientos:[reg('1','2026-01-01'), reg('3','2026-01-03')] });                  // ellos borraron 2
  const out = mergeAppData(base, mine, theirs).ahorroMovimientos;
  assert.deepEqual(out.map(r=>r.id), ['3']);
  assert.equal(out[0].total, 999);
});

test('merge: campos distintos del mismo mes y meses distintos se conservan', () => {
  const base = data({ monthly:{ '2026-10':{ ingresos:{julieta:''}, gastos:{ alquiler:'1', nicolas:'' } } } });
  const mine = data({ monthly:{ '2026-10':{ ingresos:{julieta:'900'}, gastos:{ alquiler:'1', nicolas:'' } } } });
  const theirs = data({ monthly:{ '2026-10':{ ingresos:{julieta:''}, gastos:{ alquiler:'1', nicolas:'50' } }, '2026-11':{ ingresos:{julieta:'7'}, gastos:{} } } });
  const out = mergeAppData(base, mine, theirs).monthly;
  assert.equal(out['2026-10'].ingresos.julieta, '900');
  assert.equal(out['2026-10'].gastos.nicolas, '50');
  assert.equal(out['2026-11'].ingresos.julieta, '7');
});

test('12/13. dos dispositivos modifican datos distintos antes de sincronizar: no se pierde nada', async () => {
  const srv = fakeServer(data({ uberDiDi:[reg('a','2026-10-01')], saldoJulieta:{ '2026-10-04':100 } }));
  const A = new SyncEngine({ post:srv.post }), B = new SyncEngine({ post:srv.post });
  A.init({ version:srv.version, data:srv.data }); B.init({ version:srv.version, data:srv.data });
  // A carga una ganancia, B carga el saldo de Julieta; B guarda primero
  const rb = await B.save({ ...B.mine, saldoJulieta:{ '2026-10-04':100, '2026-10-11':250 } });
  const ra = await A.save({ ...A.mine, uberDiDi:[reg('nuevo','2026-10-05'), ...A.mine.uberDiDi] });
  assert.ok(rb.ok && ra.ok);
  assert.deepEqual(srv.data.uberDiDi.map(r=>r.id), ['nuevo','a']);
  assert.equal(srv.data.saldoJulieta['2026-10-11'], 250);
  assert.equal(A.mine.saldoJulieta['2026-10-11'], 250);   // A recibió lo de B
});

test('14. error de red: no se informa guardado exitoso, queda pendiente y se recupera', async () => {
  const srv = fakeServer(data({ uberDiDi:[reg('a','2026-10-01')] }));
  const estados = [], store = memStore();
  const E = new SyncEngine({ post:srv.post, store, onStatus:(s)=>estados.push(s) });
  E.init({ version:srv.version, data:srv.data });
  srv.caido = true;
  const r = await E.save({ ...E.mine, uberDiDi:[reg('n','2026-10-02'), ...E.mine.uberDiDi] });
  assert.equal(r.ok, false);
  assert.ok(!estados.includes('ok'));
  assert.equal(E.hayPendiente, true);
  assert.equal(srv.data.uberDiDi.length, 1);
  srv.caido = false;
  assert.ok((await E.flush()).ok);
  assert.equal(srv.data.uberDiDi.length, 2);
  assert.equal(store.m.size, 0);
});

test('cambios pendientes sobreviven a cerrar la app y se combinan con lo que hizo el otro dispositivo', async () => {
  const srv = fakeServer(data({ uberDiDi:[reg('a','2026-10-01')] }));
  const store = memStore();
  const E1 = new SyncEngine({ post:srv.post, store });
  E1.init({ version:srv.version, data:srv.data });
  srv.caido = true;
  await E1.save({ ...E1.mine, uberDiDi:[reg('local','2026-10-02'), ...E1.mine.uberDiDi] });
  srv.caido = false;
  srv.data.uberDiDi.unshift(reg('otro','2026-10-03')); srv.version++;           // el otro celular guardó
  const E2 = new SyncEngine({ post:srv.post, store });                          // la app se reabre
  E2.init({ version:srv.version, data:srv.data });
  assert.deepEqual(E2.mine.uberDiDi.map(r=>r.id).sort(), ['a','local','otro']);
  assert.ok((await E2.flush()).ok);
  assert.equal(srv.data.uberDiDi.length, 3);
});

test('respuesta perdida: el reintento no duplica el registro', async () => {
  const srv = fakeServer(data({ uberDiDi:[reg('a','2026-10-01')] }));
  const E = new SyncEngine({ post:srv.post });
  E.init({ version:srv.version, data:srv.data });
  srv.perderRespuesta = true;                       // el servidor guarda pero la app no se entera
  const r1 = await E.save({ ...E.mine, uberDiDi:[reg('n','2026-10-02'), ...E.mine.uberDiDi] });
  assert.equal(r1.ok, false);
  const r2 = await E.flush();
  assert.ok(r2.ok);
  assert.equal(srv.data.uberDiDi.filter(r=>r.id==='n').length, 1);
});

test('una app que no cargó (estado vacío) no puede borrar los datos del servidor', async () => {
  const srv = fakeServer(data({ uberDiDi:[reg('a','2026-10-01')], monthly:{ '2026-10':{} } }));
  const E = new SyncEngine({ post:srv.post });
  E.init({ version:srv.version, data:srv.data });
  const r = await E.save(EMPTY_DATA());
  assert.equal(r.ok, false);
  assert.equal(srv.data.uberDiDi.length, 1);
});

test('adoptarServidor no pisa cambios pendientes', async () => {
  const srv = fakeServer(data({ uberDiDi:[reg('a','2026-10-01')] }));
  const E = new SyncEngine({ post:srv.post });
  E.init({ version:srv.version, data:srv.data });
  srv.caido = true; await E.save({ ...E.mine, uberDiDi:[] }); srv.caido = false;
  assert.equal(E.adoptarServidor({ version:99, data:data() }).aplicado, false);
  assert.ok(deepEqual(normalizarAppData(E.mine), normalizarAppData({ ...EMPTY_DATA(), uberDiDi:[] })));
});
