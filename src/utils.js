import { categorizarItem, GRUPOS_AUTO } from './categorias.js';

export const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
export const n=v=>parseFloat(String(v??'').replace(',','.'))||0;

// ── Ocultar importes ─────────────────────────────────────────────────
// Un solo interruptor: todo lo que pasa por $$ / fmtK respeta el estado.
let ocultarMontos = false;
export const setOcultarMontos = v => { ocultarMontos = !!v; };
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0});
export const $$=v=>{
  if(v===''||v===null||v===undefined||isNaN(v))return'—';
  return ocultarMontos ? '$ ••••' : fmtARS.format(v);
};
export const fmtK = v => ocultarMontos ? '' : `$${Math.round(v/1000)}K`;

// ── Fechas ───────────────────────────────────────────────────────────
const pad = x => String(x).padStart(2,'0');
export const getKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}`;
export const fmtKey=k=>{const[y,m]=k.split('-');return`${MESES[parseInt(m)-1]} ${y}`;};
// Fecha local (no UTC): evita que después de las 21 h se guarde "mañana".
export const dateStr=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const monthOf=ds=>ds.slice(0,7);
export const getMonday=d=>{const dt=new Date(d),day=dt.getDay();dt.setDate(dt.getDate()-day+(day===0?-6:1));dt.setHours(0,0,0,0);return dt;};
export const weekDates=mon=>Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(d.getDate()+i);return d;});
export const fmtDate=d=>`${pad(d.getDate())}/${pad(d.getMonth()+1)}`;
export const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-3);
// Hoy en Buenos Aires (misma zona que usa el backend).
const fmtBA = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'});
export const hoy=(now=new Date())=>fmtBA.format(now);
export const monthOpts=today=>{const o=[];for(let i=-4;i<=8;i++){const d=new Date(today.getFullYear(),today.getMonth()+i,1);o.push(getKey(d));}return o;};

// ¿La fecha dada (YYYY-MM-DD) es el último día de su mes?
export const esUltimoDiaMes = (fechaStr) => {
  if (!fechaStr) return false;
  const d = new Date(fechaStr + 'T12:00:00');
  const next = new Date(d); next.setDate(d.getDate() + 1);
  return next.getMonth() !== d.getMonth();
};

// Último día hábil (lunes a viernes) del mes: cuando cobra Julieta. No considera feriados.
export const ultimoDiaHabil = (mesKey) => {
  const [y, m] = mesKey.split('-').map(Number);
  const d = new Date(y, m, 0);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return dateStr(d);
};

// Meses (YYYY-MM) hacia atrás desde mesKey, incluyendo mesKey, en orden cronológico.
export const mesesAtras = (mesKey, cantidad) => {
  const [y,m] = mesKey.split('-').map(Number);
  return Array.from({length:cantidad},(_,i)=>getKey(new Date(y, m-1-(cantidad-1-i), 1)));
};

// ── Datos ────────────────────────────────────────────────────────────
export const EMPTY_DATA = () => ({
  monthly:{}, categories:{}, uberDiDi:[], gastosRecurrentes:{},
  saldoJulieta:{}, dolarTarjeta:{}, ahorroMovimientos:[], autoDetalle:{},
  vencimientos:{}, vehiculos:[], gastoVehiculo:{}, pagosFijos:{}, ajustes:{}, detalleFijos:{}, cierres:{},
});
export const normalizarAppData = (d) => {
  const e = EMPTY_DATA(), x = d || {};
  return {
    monthly: x.monthly||e.monthly, categories: x.categories||e.categories, uberDiDi: x.uberDiDi||e.uberDiDi,
    gastosRecurrentes: x.gastosRecurrentes||e.gastosRecurrentes, saldoJulieta: x.saldoJulieta||e.saldoJulieta,
    dolarTarjeta: x.dolarTarjeta||e.dolarTarjeta, ahorroMovimientos: x.ahorroMovimientos||e.ahorroMovimientos,
    autoDetalle: x.autoDetalle||e.autoDetalle,
    vencimientos: x.vencimientos||e.vencimientos, vehiculos: x.vehiculos||e.vehiculos, gastoVehiculo: x.gastoVehiculo||e.gastoVehiculo,
    pagosFijos: x.pagosFijos||e.pagosFijos, ajustes: x.ajustes||e.ajustes, detalleFijos: x.detalleFijos||e.detalleFijos, cierres: x.cierres||e.cierres,
  };
};

// Los movimientos de tarjeta se identifican por id_unico. Dos filas con el mismo
// id son el mismo movimiento (p. ej. el mismo PDF importado dos veces). Las filas
// SIN id nunca se descartan: coincidir en fecha/importe no prueba duplicado.
export const dedupePorId = (movs) => {
  const vistos = new Set();
  return (movs||[]).filter(m => {
    if (!m.id) return true;
    if (vistos.has(m.id)) return false;
    vistos.add(m.id); return true;
  });
};

// ── Tarjetas ─────────────────────────────────────────────────────────
export const montoEnPesos = (m, dolar) => m.moneda === 'USD' ? m.importe * dolar : m.importe;

// ── Gastos: ítems unificados (Zapia + tarjetas) ─────────────────────
// Cada ítem lleva un id estable: el de Zapia lo genera el backend; el de tarjeta
// es id_unico. Sirve para vincular el detalle de Auto sin duplicar el gasto.
export const itemsDeZapia = (zapiaData, pred) => (zapiaData||[])
  .filter(r => r.fecha && pred(r.fecha))
  .map(r => ({ id: r.id || `z|${r.fecha}|${r.hora||''}|${r.que}|${r.costo}`, key:r.que, monto:r.costo, fecha:r.fecha, quien:r.quien, medio:r.medio, origen:'zapia' }));

export const itemsDeTarjetas = (tarjetasData, dolarMap, pred) => (tarjetasData||[])
  .filter(pred)
  .map(m => {
    const dolar = n(dolarMap?.[m.mes]) || 0;
    return { id: m.id || `t|${m.tarjeta}|${m.fecha}|${m.comercio}|${m.importe}`, key:m.comercio, monto:montoEnPesos(m, dolar),
             fecha:m.fecha, mes:m.mes, tarjeta:m.tarjeta, cuotas:m.cuotas, tipoMovimiento:m.tipoMovimiento,
             moneda:m.moneda, importe:m.importe, origen:'tarjeta' };
  });

export const itemsDelMes = (zapiaData, tarjetasData, dolarMap, mesKey) => [
  ...itemsDeZapia(zapiaData, f => monthOf(f) === mesKey),
  ...itemsDeTarjetas(tarjetasData, dolarMap, m => m.mes === mesKey),
];
// La vista semanal usa la fecha real de la compra. Las compras de tarjeta
// recientes aparecen recién cuando llega el resumen.
export const itemsDeLaSemana = (zapiaData, tarjetasData, dolarMap, fechasSemana) => [
  ...itemsDeZapia(zapiaData, f => fechasSemana.includes(f)),
  ...itemsDeTarjetas(tarjetasData, dolarMap, m => fechasSemana.includes(m.fecha)),
];

export const agruparItems = (items, categories) => {
  const grupos = {};
  items.forEach(item => {
    const cat = categorizarItem(item, categories);
    if (!grupos[cat.categoria]) grupos[cat.categoria] = { emoji:cat.emoji, items:[], total:0 };
    grupos[cat.categoria].items.push(item);
    grupos[cat.categoria].total += item.monto;
  });
  return grupos;
};

export const agruparGastosPorCategoria = (zapiaData, tarjetasData, categories, dolarTarjetaMap, mesKey) => {
  const items = itemsDelMes(zapiaData, tarjetasData, dolarTarjetaMap, mesKey);
  return { items, grupos: agruparItems(items, categories), total: items.reduce((s,i)=>s+i.monto,0) };
};

// ── Auto: consulta sobre Gastos (no guarda gastos propios) ─────────
export const resumenAuto = (grupos, filtro = null) => {
  const out = {};
  Object.entries(GRUPOS_AUTO).forEach(([k, g]) => {
    const items = g.categorias.flatMap(c => grupos[c]?.items || []).filter(i => !filtro || filtro(i));
    out[k] = { ...g, items, total: items.reduce((s,i)=>s+i.monto,0) };
  });
  return out;
};
export const resumenAutoMeses = (zapiaData, tarjetasData, categories, dolarMap, meses, filtro = null) => {
  const porMes = meses.map(mes => {
    const { grupos } = agruparGastosPorCategoria(zapiaData, tarjetasData, categories, dolarMap, mes);
    const r = resumenAuto(grupos, filtro);
    return { mes, combustible:r.combustible.total, peajes:r.peajes.total, mantenimiento:r.mantenimiento.total, sinClasificar:r.sinClasificar.total };
  });
  const tot = porMes.reduce((a,m)=>({
    combustible:a.combustible+m.combustible, peajes:a.peajes+m.peajes,
    mantenimiento:a.mantenimiento+m.mantenimiento, sinClasificar:a.sinClasificar+m.sinClasificar }),
    { combustible:0, peajes:0, mantenimiento:0, sinClasificar:0 });
  return { porMes, total: tot };
};
// ── Vehículos ───────────────────────────────────────────────────────
// gastoVehiculo[idGasto] = idVehiculo. El gasto se carga UNA vez en Gastos; esto solo lo imputa.
// Los gastos sin asignar (y los de un vehículo borrado) van al primer vehículo.
export const normPatente = p => String(p||'').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const vehiculoDeGasto = (gastoId, gastoVehiculo, vehiculos) => {
  const v = gastoVehiculo?.[gastoId];
  if (v && (vehiculos||[]).some(x => x.id === v)) return v;
  return vehiculos?.[0]?.id || null;
};
export const esCategoriaAuto = (categoria) => Object.values(GRUPOS_AUTO).some(g => g.categorias.includes(categoria));

// Mes (YYYY-MM) desplazado en `delta` meses.
export const mesDesplazado = (key, delta) => { const [y, m] = key.split('-').map(Number); return getKey(new Date(y, m - 1 + delta, 1)); };
