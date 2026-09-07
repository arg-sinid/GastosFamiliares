import { categorizarUno } from './categorias.js';

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

// ¿La fecha dada (string YYYY-MM-DD) es el último día de su mes?
export const esUltimoDiaMes = (fechaStr) => {
  if (!fechaStr) return false;
  const d = new Date(fechaStr + 'T12:00:00');
  const next = new Date(d); next.setDate(d.getDate() + 1);
  return next.getMonth() !== d.getMonth();
};

// Ingreso de Germán en un mes:
//   (transferencias dominicales − gastos de Julieta vía transferencia registrados en Zapia ese mes)
//   + efectivo depositado al cierre del mes
// La resta evita contar como "ahorro" plata que Julieta ya gastó del día a día.
export const calcularIngresoGerman = (uberDiDi, mesKey, zapiaData) => {
  const enMes = (uberDiDi||[]).filter(r => r.fecha && r.fecha.slice(0,7) === mesKey);
  const transferencias = enMes.filter(r => r.transferencia > 0).reduce((s,r)=>s+r.transferencia, 0);
  const cierreMes      = enMes.filter(r => r.efectivoCierreMes > 0).reduce((s,r)=>s+r.efectivoCierreMes, 0);
  const gastosJulietaTransf = (zapiaData||[])
    .filter(r => r.fecha && r.fecha.slice(0,7) === mesKey && r.quien === 'Julieta' && r.medio === 'transferencia')
    .reduce((s,r) => s + r.costo, 0);
  const transferenciasNetas = Math.max(0, transferencias - gastosJulietaTransf);
  return transferenciasNetas + cierreMes;
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
// categoriza con las reglas compartidas (categorias guardadas o categorizarUno).
export const agruparGastosPorCategoria = (zapiaData, tarjetasData, categories, dolarTarjetaMap, mesKey, tiposFinancieros) => {
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
    let cat;
    if (item.origen === 'tarjeta') {
      if (item.cuotas && item.cuotas.trim() !== '') {
        cat = { categoria: 'Cuotas', emoji: '\uD83E\uDD9E' };
      } else if ((tiposFinancieros||[]).includes(item.tipoMovimiento)) {
        cat = { categoria: 'Pagos/Impuestos/Intereses', emoji: '\uD83D\uDCB0' };
      } else {
        cat = categories[item.key] || categorizarUno(item.key);
      }
    } else {
      cat = categories[item.key] || categorizarUno(item.key);
    }
    if (!grupos[cat.categoria]) grupos[cat.categoria] = { emoji:cat.emoji, items:[], total:0 };
    grupos[cat.categoria].items.push(item);
    grupos[cat.categoria].total += item.monto;
  });

  return { items, grupos, total: items.reduce((s,i)=>s+i.monto,0) };
};
