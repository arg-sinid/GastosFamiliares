import { categorizarUno, categorizarMovimientoTarjeta } from './categorias.js';

export const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
export const n=v=>parseFloat(String(v??'').replace(',','.'))||0;
export const $$=v=>{if(v===''||v===null||v===undefined||isNaN(v))return'—';return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(v);};
export const getKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
export const fmtKey=k=>{const[y,m]=k.split('-');return`${MESES[parseInt(m)-1]} ${y}`;};
export const dateStr=d=>d.toISOString().split('T')[0];
export const monthOf=ds=>ds.slice(0,7);
export const getMonday=d=>{const dt=new Date(d),day=dt.getDay();dt.setDate(dt.getDate()-day+(day===0?-6:1));dt.setHours(0,0,0,0);return dt;};
export const weekDates=mon=>Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(d.getDate()+i);return d;});
export const fmtDate=d=>`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
export const uid=()=>Math.random().toString(36).slice(2,9);
export const hoy=()=>new Date().toISOString().split('T')[0];
export const monthOpts=today=>{const o=[];for(let i=-4;i<=8;i++){const d=new Date(today.getFullYear(),today.getMonth()+i,1);o.push(getKey(d));}return o;};

// Los últimos N meses (incluyendo mesKey), en orden cronológico — usado
// para armar el gráfico de tendencia de una categoría.
export const ultimosMeses = (mesKey, cantidad=6) => {
  const [y,m] = mesKey.split('-').map(Number);
  const out = [];
  for (let i = cantidad-1; i >= 0; i--) {
    const d = new Date(y, m-1-i, 1);
    out.push(getKey(d));
  }
  return out;
};

// ¿La fecha dada (string YYYY-MM-DD) es el último día de su mes?
export const esUltimoDiaMes = (fechaStr) => {
  if (!fechaStr) return false;
  const d = new Date(fechaStr + 'T12:00:00');
  const next = new Date(d); next.setDate(d.getDate() + 1);
  return next.getMonth() !== d.getMonth();
};

// Reconstruye los períodos entre cargas CONSECUTIVAS del saldo real de
// Julieta. Cada período cierra en la fecha de una carga real; el anterior
// (o el primero, si no hay uno previo) queda sin período — no hay saldo de
// referencia contra el cual comparar. Si Julieta se salteó semanas, el
// período simplemente se estira hasta la próxima carga real: todo lo
// transferido y gastado en el medio se reconcilia junto, de una.
//   ingresoGerman = diferencia real de saldo (S1 − S0), nunca negativo
//   gastoHormiga  = lo transferido y no gastado (registrado) ni tampoco
//                   presente en el saldo final — la plata que se evaporó
export const calcularReconciliacionJulieta = (saldoJulieta, uberDiDi, zapiaData) => {
  const fechas = Object.keys(saldoJulieta||{}).sort();
  const periodos = [];
  for (let i = 1; i < fechas.length; i++) {
    const fIni = fechas[i-1], fFin = fechas[i];
    const saldoIni = n(saldoJulieta[fIni]), saldoFin = n(saldoJulieta[fFin]);
    const transferido = (uberDiDi||[])
      .filter(r => r.fecha && r.fecha > fIni && r.fecha <= fFin)
      .reduce((s,r) => s + (r.transferencia||0), 0);
    const gastosZapia = (zapiaData||[])
      .filter(r => r.fecha && r.fecha > fIni && r.fecha <= fFin && r.quien === 'Julieta' && r.medio === 'transferencia')
      .reduce((s,r) => s + r.costo, 0);
    const delta = saldoFin - saldoIni;
    periodos.push({
      fechaInicio: fIni, fechaFin: fFin, saldoIni, saldoFin, transferido, gastosZapia,
      ingresoGerman: Math.max(0, delta),
      gastoHormiga:  Math.max(0, transferido - gastosZapia - delta),
    });
  }
  return periodos;
};

// Ingreso de Germán en un mes: la parte que se reconcilia por la diferencia
// real de saldo de Julieta (ver arriba) + el efectivo depositado al cierre
// del mes. Un período se atribuye al mes de su fecha de CIERRE (cuando
// Julieta reporta el saldo y recién ahí se sabe cuánto quedó realmente).
export const calcularIngresoGerman = (uberDiDi, mesKey, zapiaData, saldoJulieta) => {
  const cierreMes = (uberDiDi||[])
    .filter(r => r.fecha && r.fecha.slice(0,7) === mesKey && r.efectivoCierreMes > 0)
    .reduce((s,r) => s + r.efectivoCierreMes, 0);

  // Si Julieta tiene un saldo cargado dentro del mes actual, ese saldo es el
  // punto de partida REAL de Germán. Mientras el período siga abierto, se
  // muestra ese saldo y se ajusta únicamente por movimientos posteriores:
  // transferencias que ingresaron a Julieta y gastos de Julieta pagados por
  // transferencia. El gasto hormiga NO se calcula todavía.
  const hoyStr = hoy();
  const fechas = Object.keys(saldoJulieta||{}).sort();
  const ultimaFecha = fechas.length ? fechas[fechas.length - 1] : null;

  if (ultimaFecha && ultimaFecha.slice(0,7) === mesKey) {
    const saldoInicial = n(saldoJulieta[ultimaFecha]);
    const transferido = (uberDiDi||[])
      .filter(r => r.fecha && r.fecha > ultimaFecha && r.fecha <= hoyStr)
      .reduce((s,r) => s + (r.transferencia||0), 0);
    const gastosZapia = (zapiaData||[])
      .filter(r => r.fecha && r.fecha > ultimaFecha && r.fecha <= hoyStr &&
        r.quien === 'Julieta' && r.medio === 'transferencia')
      .reduce((s,r) => s + (r.costo||0), 0);

    return Math.max(0, saldoInicial + transferido - gastosZapia);
  }

  // Para períodos cerrados se mantiene la reconciliación histórica: el
  // resultado se conoce recién cuando existe la siguiente carga de saldo.
  const reconciliado = calcularReconciliacionJulieta(saldoJulieta, uberDiDi, zapiaData)
    .filter(p => p.fechaFin.slice(0,7) === mesKey)
    .reduce((s,p) => s + p.ingresoGerman, 0);

  return reconciliado + cierreMes;
};

// Calcula el total de cada tarjeta por mes a partir de los movimientos cargados por Zapia
export const calcularTotalesTarjetas = (movimientos, dolarTarjetaMap) => {
  const out = {};
  (movimientos||[]).forEach(m => {
    if (!m.mes || !m.tarjeta) return;
    const key = m.tarjeta.toLowerCase() === 'icbc' ? 'icbc' : m.tarjeta.toLowerCase() === 'bna' ? 'bna' : null;
    if (!key) return;
    const dolar = n(dolarTarjetaMap?.[m.mes]) || 0;
    const monto = m.moneda === 'USD' ? m.importe * dolar : m.importe;
    if (!out[m.mes]) out[m.mes] = {};
    out[m.mes][key] = (out[m.mes][key] || 0) + monto;
  });
  return out;
};

// Claves de gastos fijos que se cargan en Principal
export const GASTOS_FIJOS_KEYS = ['icbc','bna','prestamos','nicolas','segundo','alquiler'];

// Total de gastos fijos marcados en Principal para un mes dado.
// Replica la misma prioridad que usa Principal: si Zapia ya cargó el total de una tarjeta
// (icbc/bna) ese mes, se usa ese valor por sobre lo cargado a mano o lo recurrente.
export const calcularGastosFijos = (monthly, gastosRecurrentes, totalesTarjetas, mesKey) => {
  const s    = monthly?.[mesKey] || {};
  const tMes = totalesTarjetas?.[mesKey] || {};
  const rec  = gastosRecurrentes || {};
  return GASTOS_FIJOS_KEYS.reduce((sum, key) => {
    if ((key === 'icbc' || key === 'bna') && tMes[key] !== undefined) return sum + tMes[key];
    const val = s.gastos?.[key] !== undefined && s.gastos?.[key] !== '' ? s.gastos[key] : (rec[key] || '');
    return sum + n(val);
  }, 0);
};

// Igual que calcularGastosFijos pero SIN incluir icbc/bna (para Cierre Real,
// donde los gastos de tarjeta ya están contados en agruparGastosPorCategoria).
export const calcularGastosFijosSinTarjetas = (monthly, gastosRecurrentes, mesKey) => {
  const s   = monthly?.[mesKey] || {};
  const rec = gastosRecurrentes || {};
  const keysSinTarjetas = GASTOS_FIJOS_KEYS.filter(k => k !== 'icbc' && k !== 'bna');
  return keysSinTarjetas.reduce((sum, key) => {
    const val = s.gastos?.[key] !== undefined && s.gastos?.[key] !== '' ? s.gastos[key] : (rec[key] || '');
    return sum + n(val);
  }, 0);
};

// Junta los gastos cargados via Zapia (WhatsApp) y TODOS los movimientos de Tarjetas
// de un mes, y los agrupa por categoria usando las mismas categorias para ambos.
// Cuotas van a "Cuotas", financieros a "Pagos/Impuestos/Intereses", y el resto se
// categoriza con las reglas compartidas (categorizarMovimientoTarjeta / categorizarUno).
export const agruparGastosPorCategoria = (zapiaData, tarjetasData, categories, dolarTarjetaMap, mesKey) => {
  const zapiaItems = (zapiaData||[])
    .filter(r => r.fecha && monthOf(r.fecha) === mesKey)
    .map(r => ({ key:r.que, monto:r.costo, fecha:r.fecha, quien:r.quien, medio:r.medio, origen:'zapia' }));

  const tarjetaItems = (tarjetasData||[])
    .filter(m => m.mes === mesKey)
    .map(m => {
      const dolar = n(dolarTarjetaMap?.[m.mes]) || 0;
      const monto = m.moneda === 'USD' ? m.importe * dolar : m.importe;
      return { key:m.comercio, monto, fecha:m.fecha, tarjeta:m.tarjeta, cuotas:m.cuotas, tipoMovimiento:m.tipoMovimiento, origen:'tarjeta' };
    });

  const items  = [...zapiaItems, ...tarjetaItems];
  const grupos = {};
  items.forEach(item => {
    const cat = item.origen === 'tarjeta'
      ? categorizarMovimientoTarjeta({ comercio:item.key, cuotas:item.cuotas, tipoMovimiento:item.tipoMovimiento }, categories)
      : (categories[item.key] || categorizarUno(item.key));
    if (!grupos[cat.categoria]) grupos[cat.categoria] = { emoji:cat.emoji, items:[], total:0 };
    grupos[cat.categoria].items.push(item);
    grupos[cat.categoria].total += item.monto;
  });

  return { items, grupos, total: items.reduce((s,i)=>s+i.monto,0) };
};

// Total de los movimientos MANUALES de ahorro (ajuste inicial, ingresos
// extraordinarios, retiros) hasta un mes dado (o todos, si no se pasa upTo).
// Se suma aparte del acumulado automático de saldos mensuales positivos.
export const calcularAhorroManual = (movimientos, upTo) => (movimientos||[])
  .filter(m => !upTo || (m.fecha && m.fecha.slice(0,7) <= upTo))
  .reduce((s,m) => s + (m.tipo === 'retiro' ? -n(m.monto) : n(m.monto)), 0);

// Total de UNA categoría específica en cada uno de los meses dados —
// alimenta el gráfico de tendencia que aparece al abrir una categoría.
export const historialCategoriaPorMes = (categoria, zapiaData, tarjetasData, categories, dolarTarjetaMap, mesesKeys) =>
  mesesKeys.map(mes => {
    const { grupos } = agruparGastosPorCategoria(zapiaData, tarjetasData, categories, dolarTarjetaMap, mes);
    return { mes: fmtKey(mes).split(' ')[0].substring(0,3), total: grupos[categoria]?.total || 0 };
  });
