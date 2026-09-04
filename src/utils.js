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
