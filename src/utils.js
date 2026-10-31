import { categorizarItem, GRUPOS_AUTO } from './categorias.js';

export const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
export const n=v=>parseFloat(String(v??'').replace(',','.'))||0;

// ── Ocultar importes ─────────────────────────────────────────────────
// Un solo interruptor: todo lo que pasa por $$ / fmtK respeta el estado.
let ocultarMontos = false;
export const setOcultarMontos = v => { ocultarMontos = !!v; };
export const getOcultarMontos = () => ocultarMontos;
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

// Meses (YYYY-MM) hacia atrás desde mesKey, incluyendo mesKey, en orden cronológico.
export const mesesAtras = (mesKey, cantidad) => {
  const [y,m] = mesKey.split('-').map(Number);
  return Array.from({length:cantidad},(_,i)=>getKey(new Date(y, m-1-(cantidad-1-i), 1)));
};

// ── Datos ────────────────────────────────────────────────────────────
export const EMPTY_DATA = () => ({
  monthly:{}, categories:{}, uberDiDi:[], gastosRecurrentes:{},
  saldoJulieta:{}, dolarTarjeta:{}, ahorroMovimientos:[], autoDetalle:{},
  vencimientos:{}, vehiculos:[], gastoVehiculo:{},
});
export const normalizarAppData = (d) => {
  const e = EMPTY_DATA(), x = d || {};
  return {
    monthly: x.monthly||e.monthly, categories: x.categories||e.categories, uberDiDi: x.uberDiDi||e.uberDiDi,
    gastosRecurrentes: x.gastosRecurrentes||e.gastosRecurrentes, saldoJulieta: x.saldoJulieta||e.saldoJulieta,
    dolarTarjeta: x.dolarTarjeta||e.dolarTarjeta, ahorroMovimientos: x.ahorroMovimientos||e.ahorroMovimientos,
    autoDetalle: x.autoDetalle||e.autoDetalle,
    vencimientos: x.vencimientos||e.vencimientos, vehiculos: x.vehiculos||e.vehiculos, gastoVehiculo: x.gastoVehiculo||e.gastoVehiculo,
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

// ── Conciliación de la cuenta Uala de Julieta ───────────────────────
// Modelo: Germán gira los domingos lo que le sobra del bruto a la Uala (y el
// último día del mes deposita efectivo). De esa cuenta salen los gastos de
// Julieta cargados en Zapia (efectivo y transferencia). Julieta declara el saldo
// real; la diferencia contra el esperado es la diferencia de conciliación
// (negativa = gasto hormiga, positiva = sobrante).
export const aportesAUala = (uberDiDi, desde, hasta) => {
  let transferencias = 0, deposito = 0;
  (uberDiDi||[]).forEach(r => {
    if (!r.fecha || !(r.fecha > desde && r.fecha <= hasta)) return;
    transferencias += n(r.transferencia); deposito += n(r.efectivoCierreMes);
  });
  return { transferencias, deposito, total: transferencias + deposito };
};
export const gastosZapiaDe = (zapiaData, quien, desde, hasta) =>
  (zapiaData||[]).filter(r => r.fecha && r.fecha > desde && r.fecha <= hasta && r.quien === quien)
                 .reduce((s,r) => s + n(r.costo), 0);

export const conciliarUala = ({ saldoIni, saldoReal, aportes, gastos }) => {
  const esperado = saldoIni + aportes - gastos;
  return { esperado, diferencia: saldoReal - esperado, ingresoGerman: saldoReal - saldoIni };
};

// Períodos CERRADOS: entre cargas consecutivas de saldo real. Cada saldo
// declarado es el punto de partida del siguiente período (se procesa una vez).
export const calcularConciliaciones = (saldoJulieta, uberDiDi, zapiaData) => {
  const fechas = Object.keys(saldoJulieta||{}).sort();
  const periodos = [];
  for (let i = 1; i < fechas.length; i++) {
    const fIni = fechas[i-1], fFin = fechas[i];
    const saldoIni = n(saldoJulieta[fIni]), saldoReal = n(saldoJulieta[fFin]);
    const ap = aportesAUala(uberDiDi, fIni, fFin);
    const gastos = gastosZapiaDe(zapiaData, 'Julieta', fIni, fFin);
    periodos.push({
      fechaInicio: fIni, fechaFin: fFin, saldoIni, saldoReal,
      transferido: ap.transferencias, deposito: ap.deposito, gastosJulieta: gastos,
      ...conciliarUala({ saldoIni, saldoReal, aportes: ap.total, gastos }),
    });
  }
  return periodos;
};

// Período ABIERTO: desde el último saldo real hasta hoy. Es una estimación
// (no hay saldo real todavía, por eso no hay diferencia de conciliación).
export const calcularPeriodoAbierto = (saldoJulieta, uberDiDi, zapiaData, hoyStr = hoy()) => {
  const fechas = Object.keys(saldoJulieta||{}).sort();
  const ultima = fechas.length ? fechas[fechas.length-1] : null;
  if (!ultima) return null;
  const saldoIni = n(saldoJulieta[ultima]);
  const ap = aportesAUala(uberDiDi, ultima, hoyStr);
  const gastos = gastosZapiaDe(zapiaData, 'Julieta', ultima, hoyStr);
  return {
    fechaInicio: ultima, saldoIni, transferido: ap.transferencias, deposito: ap.deposito,
    gastosJulieta: gastos, saldoEstimado: saldoIni + ap.total - gastos, ingresoEstimado: ap.total - gastos,
  };
};

// Ingreso de Germán en Principal = el saldo de la Uala.
// · Mes donde está la ÚLTIMA carga de saldo real de Julieta: ese saldo declarado ES el dato
//   (no se le resta la diferencia de conciliación: es plata que ya se gastó sin registrar y el
//   saldo declarado ya la refleja). Se le suman SOLO los movimientos posteriores a esa carga:
//   transferencias + depósito de fin de mes − gastos de Julieta en Zapia (efectivo y transferencia).
// · Meses anteriores ya cerrados: se mantiene la lógica histórica (suba del saldo entre cargas
//   cuyo cierre cae en el mes). Pendiente de decidir si también deben mostrar el saldo declarado.
export const calcularIngresoGerman = (uberDiDi, mesKey, zapiaData, saldoJulieta, hoyStr = hoy()) => {
  const fechas = Object.keys(saldoJulieta||{}).sort();
  const ultima = fechas.length ? fechas[fechas.length-1] : null;
  if (ultima && ultima.slice(0,7) === mesKey) {
    return calcularPeriodoAbierto(saldoJulieta, uberDiDi, zapiaData, hoyStr).saldoEstimado;
  }
  return calcularConciliaciones(saldoJulieta, uberDiDi, zapiaData)
    .filter(p => p.fechaFin.slice(0,7) === mesKey)
    .reduce((s,p) => s + p.ingresoGerman, 0);
};

// Conciliación del lado de Germán: su bruto se usa para sus gastos de Zapia, lo
// transferido/depositado a Uala y el efectivo que le queda. Lo que no cierra es
// diferencia (negativa = salida sin registrar / gasto hormiga).
export const conciliarGerman = ({ bruto, gastos, aportes, efectivo }) => ({
  usos: gastos + aportes + efectivo,
  diferencia: (gastos + aportes + efectivo) - bruto,
});

// ── Tarjetas ─────────────────────────────────────────────────────────
export const montoEnPesos = (m, dolar) => m.moneda === 'USD' ? m.importe * dolar : m.importe;

export const calcularTotalesTarjetas = (movimientos, dolarTarjetaMap) => {
  const out = {};
  (movimientos||[]).forEach(m => {
    if (!m.mes || !m.tarjeta) return;
    const t = m.tarjeta.toLowerCase();
    const key = t === 'icbc' ? 'icbc' : t === 'bna' ? 'bna' : null;
    if (!key) return;
    const dolar = n(dolarTarjetaMap?.[m.mes]) || 0;
    if (!out[m.mes]) out[m.mes] = {};
    out[m.mes][key] = (out[m.mes][key] || 0) + montoEnPesos(m, dolar);
  });
  return out;
};

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
export const brutoUberDiDiMes = (uberDiDi, mesKey) =>
  (uberDiDi||[]).filter(r => r.fecha && r.fecha.slice(0,7) === mesKey).reduce((s,r) => s + n(r.total), 0);

// ── Gastos fijos y resultado mensual (UNA sola definición) ──────────
export const GASTOS_FIJOS_KEYS = ['icbc','bna','prestamos','nicolas','segundo','alquiler'];
const EMPTY_GASTOS = () => Object.fromEntries(GASTOS_FIJOS_KEYS.map(k => [k,'']));

// Mes tal como lo ve la familia: el total de tarjeta calculado de los resúmenes
// pisa lo manual; lo vacío toma el valor recurrente.
export const resolverMes = (monthly, recurrentes, totalesTarjetas, key) => {
  const s = monthly?.[key] || {};
  const tMes = totalesTarjetas?.[key] || {};
  const gastos = {};
  Object.keys(EMPTY_GASTOS()).forEach(k => {
    if ((k === 'icbc' || k === 'bna') && tMes[k] !== undefined) { gastos[k] = String(Math.round(tMes[k])); return; }
    gastos[k] = s.gastos?.[k] || (recurrentes?.[k] ? String(recurrentes[k]) : '');
  });
  return { ingresos:{ julieta:'', ...(s.ingresos||{}) }, gastos, deuda_anterior: s.deuda_anterior || 0 };
};

// Resultado mensual = ingresos (sueldo Julieta + lo juntado en Uala) − egresos
// (fijos con tarjetas + deuda anterior). Los gastos de Zapia ya están netos en el
// saldo de Uala y la diferencia de conciliación nunca se descuenta aparte.
export const calcularTotalesMes = (mes, germanIncome) => {
  const ing     = n(mes.ingresos?.julieta) + germanIncome;
  const gas     = Object.values(mes.gastos||{}).reduce((s,v)=>s+n(v),0);
  const deuda   = n(mes.deuda_anterior) || 0;
  const egresos = gas + deuda;
  return { ing, gas, deuda, egresos, saldo: ing - egresos, germanIncome };
};

export const calcularResultadoMensual = (ctx, key) => {
  const mes = resolverMes(ctx.monthly, ctx.gastosRecurrentes, ctx.totalesTarjetas, key);
  const germanIncome = calcularIngresoGerman(ctx.uberDiDi, key, ctx.zapiaData, ctx.saldoJulieta, ctx.hoyStr);
  return { mes, ...calcularTotalesMes(mes, germanIncome) };
};

// Ahorro automático: suma de saldos mensuales positivos hasta un mes.
export const calcularAhorroAcumulado = (ctx, upTo) =>
  Object.keys(ctx.monthly||{}).sort().filter(k => k <= upTo)
    .reduce((s,k) => s + Math.max(0, calcularResultadoMensual(ctx, k).saldo), 0);

// Movimientos MANUALES de ahorro (ajuste inicial, ingresos extra, retiros).
export const calcularAhorroManual = (movimientos, upTo) => (movimientos||[])
  .filter(m => !upTo || (m.fecha && m.fecha.slice(0,7) <= upTo))
  .reduce((s,m) => s + (m.tipo === 'retiro' ? -n(m.monto) : n(m.monto)), 0);

// Fila de la hoja "Control 2026". La calcula el CLIENTE con las mismas funciones
// que la pantalla; el servidor solo la escribe (no recalcula nada).
export const calcularFilaControl = (ctx, key, ahora = '') => {
  const [y, m] = key.split('-');
  const r = calcularResultadoMensual(ctx, key);
  const g = r.mes.gastos;
  return [`${MESES[parseInt(m,10)-1]} ${y}`, n(r.mes.ingresos.julieta), r.germanIncome, r.ing,
          n(g.icbc), n(g.bna), n(g.prestamos), n(g.nicolas), n(g.segundo), n(g.alquiler),
          r.gas, r.deuda, r.egresos, r.saldo, ahora];
};
export const calcularFilasControl = (ctx, ahora = '') =>
  Object.keys(ctx.monthly||{}).sort().map(k => calcularFilaControl(ctx, k, ahora));

// Fijos del Principal SIN icbc/bna (en Cierre económico las tarjetas ya están
// contadas dentro de los gastos por categoría).
export const calcularGastosFijosSinTarjetas = (monthly, gastosRecurrentes, mesKey) => {
  const g = resolverMes(monthly, gastosRecurrentes, {}, mesKey).gastos;
  return GASTOS_FIJOS_KEYS.filter(k => k !== 'icbc' && k !== 'bna').reduce((s,k) => s + n(g[k]), 0);
};

// ── Vencimientos de gastos fijos ────────────────────────────────────
// vencimientos[clave] = { dia, mesSiguiente }. El monto es el del mes que se está mirando
// (las tarjetas: total del resumen de ese mes). "mesSiguiente" = vence el mes siguiente
// (p. ej. resumen de octubre que vence el 3/11).
export const VENCIMIENTO_MES_SIGUIENTE_DEFECTO = { icbc:true, bna:true, prestamos:true };
const ultimoDiaDelMes = (y, m) => new Date(y, m, 0).getDate();
export const fechaVencimiento = (mesKey, dia, mesSiguiente) => {
  let [y, m] = mesKey.split('-').map(Number);
  if (mesSiguiente) { m += 1; if (m > 12) { m = 1; y += 1; } }
  const d = Math.min(Math.max(1, Math.floor(n(dia))), ultimoDiaDelMes(y, m));
  return `${y}-${pad(m)}-${pad(d)}`;
};
// Cuánto hay que reunir para cada vencimiento que todavía no pasó, acumulado, contra lo disponible.
// "Disponible" lo define quien llama (en Principal: sueldo de Julieta + saldo de la Uala de Germán).
export const calcularVencimientos = ({ vencimientos, gastos, mesKey, hoyStr, disponible }) => {
  const porFecha = {};
  GASTOS_FIJOS_KEYS.forEach(key => {
    const v = vencimientos?.[key], monto = n(gastos?.[key]);
    if (!v || !n(v.dia) || monto <= 0) return;
    const fecha = fechaVencimiento(mesKey, v.dia, !!v.mesSiguiente);
    (porFecha[fecha] = porFecha[fecha] || []).push({ key, monto });
  });
  const grupos = Object.keys(porFecha).sort().map(fecha => ({
    fecha, items: porFecha[fecha], total: porFecha[fecha].reduce((s,i) => s + i.monto, 0),
  }));
  let acumulado = 0;
  const pendientes = grupos.filter(g => g.fecha >= hoyStr).map(g => {
    acumulado += g.total;
    return { ...g, acumulado, balance: disponible - acumulado };
  });
  return {
    pendientes, vencidos: grupos.filter(g => g.fecha < hoyStr), proximo: pendientes[0] || null,
    totalPendiente: acumulado, disponible, balance: disponible - acumulado, hayConfigurados: grupos.length > 0,
  };
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
