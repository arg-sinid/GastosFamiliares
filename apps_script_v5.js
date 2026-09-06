// ─────────────────────────────────────────────────────────────────────
//  CONTROL DE GASTOS FAMILIAR — Apps Script v5
//  Lee la hoja "Tarjetas" (cargada por Zapia) con columnas:
//  id_unico | mes | tarjeta | fecha | comercio | detalle_original |
//  categoria | subcategoria | importe | moneda | cuotas | cuota_actual |
//  tipo_movimiento | archivo_origen | fecha_carga
// ─────────────────────────────────────────────────────────────────────

const SHEET_ID       = "1cMVhNzKL1nRcIJRf_WS_kyC981K8kkW3TY201EH-CXw";
const SHEET_CONTROL  = "Control 2026";
const SHEET_ZAPIA    = "Registro Diario";
const SHEET_TARJETAS = "Tarjetas";
const SHEET_DATA     = "_app_data_";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
               "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const HEADERS_CONTROL = [
  "Mes","Julieta (ICBC)","Germán (transfers.)","Total Ingresos",
  "Tarjeta ICBC","Tarjeta BNA","Préstamos","Nicolás","Segundo","Alquiler",
  "Total Gastos Fijos","Deuda Anterior","Total Egresos","Saldo / Ahorro","Última sync"
];

// ── App data (config: categorías, dólar tarjeta por mes, etc.) ────────
function getDataSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(SHEET_DATA);
  if (!sh) { sh = ss.insertSheet(SHEET_DATA); sh.hideSheet(); }
  return sh;
}
function readAppData() {
  try {
    const val = getDataSheet().getRange("A1").getValue();
    if (!val) return { monthly:{}, categories:{}, uberDiDi:[], gastosRecurrentes:{}, saldoJulieta:{}, dolarTarjeta:{} };
    const d = JSON.parse(val);
    return {
      monthly: d.monthly||{}, categories: d.categories||{}, uberDiDi: d.uberDiDi||[],
      gastosRecurrentes: d.gastosRecurrentes||{}, saldoJulieta: d.saldoJulieta||{},
      dolarTarjeta: d.dolarTarjeta||{}
    };
  } catch(e) {
    return { monthly:{}, categories:{}, uberDiDi:[], gastosRecurrentes:{}, saldoJulieta:{}, dolarTarjeta:{} };
  }
}
function writeAppData(data) { getDataSheet().getRange("A1").setValue(JSON.stringify(data)); }

function parseCosto(val) {
  if (typeof val==="number") return val;
  return parseFloat(String(val).replace(/[$\s]/g,"").replace(/\./g,"").replace(",",".")) || 0;
}
function normQuien(val) {
  const s=String(val||"").toLowerCase().trim();
  if(s.includes("german")||s.includes("germán")) return "Germán";
  if(s.includes("juliet")) return "Julieta";
  return val;
}
function fmtFechaCell(val) {
  if (val instanceof Date) return Utilities.formatDate(val, "America/Argentina/Buenos_Aires", "yyyy-MM-dd");
  return String(val||"").trim();
}

// Normaliza el campo "mes" a formato canónico "YYYY-MM", sin importar si Sheets
// lo guardó como texto plano, con guiones sin ceros, o como fecha autoconvertida.
function normalizarMes(val) {
  if (val instanceof Date) return Utilities.formatDate(val, "America/Argentina/Buenos_Aires", "yyyy-MM");
  const s = String(val||"").trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s; // ya viene correcto
  const m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return m[1] + "-" + m[2].padStart(2,"0");
  return s; // último recurso: devolver tal cual
}

// Lee y parsea la hoja "Registro Diario" (gastos que carga Zapia desde WhatsApp)
function leerRegistroDiario(ss) {
  const sheet = ss.getSheetByName(SHEET_ZAPIA);
  if (!sheet) return [];
  const vals = sheet.getDataRange().getValues();
  if (vals.length <= 1) return [];
  return vals.slice(1).filter(r=>r[0]!=="").map(row=>({
    fecha: fmtFechaCell(row[0]), hora:String(row[1]||"").trim(), quien:normQuien(row[2]),
    que:String(row[3]||"").trim(), costo:parseCosto(row[4]), medio:String(row[5]||"").toLowerCase().trim()
  })).filter(r=>r.fecha&&r.que);
}

// ── doGet ─────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    const tipo = (e&&e.parameter&&e.parameter.tipo)||"";

    if (tipo==="appdata") {
      return ContentService.createTextOutput(JSON.stringify({status:"ok",data:readAppData()}))
                           .setMimeType(ContentService.MimeType.JSON);
    }

    if (tipo==="zapia") {
      const ss=SpreadsheetApp.openById(SHEET_ID);
      return ContentService.createTextOutput(JSON.stringify({status:"ok",data:leerRegistroDiario(ss)})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── Tarjetas: lee la hoja que carga Zapia ──────────────────────
    if (tipo==="tarjetas") {
      const ss=SpreadsheetApp.openById(SHEET_ID);
      const sheet=ss.getSheetByName(SHEET_TARJETAS);
      if(!sheet) return ContentService.createTextOutput(JSON.stringify({status:"ok",data:[]})).setMimeType(ContentService.MimeType.JSON);
      const vals=sheet.getDataRange().getValues();
      if(vals.length<=1) return ContentService.createTextOutput(JSON.stringify({status:"ok",data:[]})).setMimeType(ContentService.MimeType.JSON);

      // Mapear headers por nombre (case-insensitive) para tolerar orden distinto
      const headers = vals[0].map(h => String(h).toLowerCase().trim());
      const idx = (name) => headers.indexOf(name);

      const iId = idx("id_unico"), iMes = idx("mes"), iTarjeta = idx("tarjeta"),
            iFecha = idx("fecha"), iComercio = idx("comercio"), iDetalleOrig = idx("detalle_original"),
            iCategoria = idx("categoria"), iSubcategoria = idx("subcategoria"),
            iImporte = idx("importe"), iMoneda = idx("moneda"),
            iCuotas = idx("cuotas"), iCuotaActual = idx("cuota_actual"),
            iTipoMov = idx("tipo_movimiento");

      const datos = vals.slice(1).filter(r => r[iComercio] !== "" && r[iComercio] != null).map(row => ({
        id:          iId>=0 ? String(row[iId]) : "",
        mes:         iMes>=0 ? normalizarMes(row[iMes]) : "",
        tarjeta:     iTarjeta>=0 ? String(row[iTarjeta]).trim().toUpperCase() : "",
        fecha:       iFecha>=0 ? fmtFechaCell(row[iFecha]) : "",
        comercio:    iComercio>=0 ? String(row[iComercio]).trim() : "",
        categoriaZapia: iCategoria>=0 ? String(row[iCategoria]).trim() : "",
        subcategoriaZapia: iSubcategoria>=0 ? String(row[iSubcategoria]).trim() : "",
        importe:     iImporte>=0 ? parseCosto(row[iImporte]) : 0,
        moneda:      iMoneda>=0 ? String(row[iMoneda]).trim().toUpperCase() : "ARS",
        cuotas:      iCuotas>=0 ? String(row[iCuotas]).trim() : "",
        tipoMovimiento: iTipoMov>=0 ? String(row[iTipoMov]).trim().toLowerCase() : "consumo",
      })).filter(r => r.comercio && r.mes && r.tarjeta);

      return ContentService.createTextOutput(JSON.stringify({status:"ok",data:datos})).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({status:"ok",msg:"API v5"})).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({status:"error",msg:err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

// ── doPost ────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const allData          = payload.allData          || {};
    const categories       = payload.categories       || {};
    const uberDiDi          = payload.uberDiDi         || [];
    const gastosRecurrentes = payload.gastosRecurrentes || {};
    const saldoJulieta     = payload.saldoJulieta      || {};
    const dolarTarjeta     = payload.dolarTarjeta      || {};
    const totalesTarjetas  = payload.totalesTarjetas   || {}; // { "2026-08": { icbc: 123, bna: 456 } }

    writeAppData({ monthly:allData, categories, uberDiDi, gastosRecurrentes, saldoJulieta, dolarTarjeta });

    const ss=SpreadsheetApp.openById(SHEET_ID);

    // Leer Registro Diario para poder descontar los gastos de Julieta vía transferencia
    // del ingreso de Germán (esa plata ya se gastó, no es ahorro disponible).
    const zapiaData = leerRegistroDiario(ss);

    let sheet=ss.getSheetByName(SHEET_CONTROL);
    if(!sheet) sheet=ss.insertSheet(SHEET_CONTROL);

    // Encabezados: se reescriben siempre (no solo la primera vez), así si el
    // esquema de columnas cambia entre versiones del script, la hoja no queda
    // con textos de encabezado desactualizados mezclados con datos nuevos.
    const hr=sheet.getRange(1,1,1,HEADERS_CONTROL.length);
    hr.setValues([HEADERS_CONTROL]);
    hr.setFontWeight("bold").setBackground("#1A365D").setFontColor("#FFFFFF").setHorizontalAlignment("center").setWrap(true);
    sheet.setFrozenRows(1); sheet.setRowHeight(1,40);
    [130,110,120,110,100,110,100,90,90,90,120,110,120,120,140].forEach((w,i)=>sheet.setColumnWidth(i+1,w));

    const now=new Date().toLocaleString("es-AR");

    for (const key of Object.keys(allData).sort()) {
      const [year,month]=key.split("-");
      const mesLabel=`${MESES[parseInt(month)-1]} ${year}`;
      const d=allData[key];

      // Ingreso de Germán = (transferencias − gastos de Julieta vía transferencia en Zapia) + efectivo cierre de mes
      const enMes = uberDiDi.filter(r=>r.fecha&&r.fecha.slice(0,7)===key);
      const transferencias = enMes.filter(r=>r.transferencia>0).reduce((s,r)=>s+r.transferencia,0);
      const cierreMes      = enMes.filter(r=>r.efectivoCierreMes>0).reduce((s,r)=>s+r.efectivoCierreMes,0);
      const gastosJulietaTransf = zapiaData
        .filter(r=>r.fecha&&r.fecha.slice(0,7)===key&&r.quien==="Julieta"&&r.medio==="transferencia")
        .reduce((s,r)=>s+r.costo,0);
      const germanIncome = Math.max(0, transferencias - gastosJulietaTransf) + cierreMes;

      const julieta   = parseFloat(d.ingresos?.julieta)||0;
      const totalIng  = julieta + germanIncome;

      // Si la app mandó totales calculados de Tarjetas para este mes, usarlos; si no, usar lo manual
      const tCard = totalesTarjetas[key] || {};
      const icbc      = tCard.icbc  !== undefined ? tCard.icbc : (parseFloat(d.gastos?.icbc)||0);
      const bna       = tCard.bna   !== undefined ? tCard.bna  : (parseFloat(d.gastos?.bna)||0);
      const prestamos = parseFloat(d.gastos?.prestamos)||0;
      const nicolas   = parseFloat(d.gastos?.nicolas)||0;
      const segundo   = parseFloat(d.gastos?.segundo)||0;
      const alquiler  = parseFloat(d.gastos?.alquiler)||0;
      const totalGas  = icbc+bna+prestamos+nicolas+segundo+alquiler;
      const deuda     = parseFloat(d.deuda_anterior)||0;
      const egresos   = totalGas+deuda;
      const saldo     = totalIng-egresos;

      const rowData=[mesLabel,julieta,germanIncome,totalIng,icbc,bna,prestamos,nicolas,segundo,alquiler,totalGas,deuda,egresos,saldo,now];

      const sd=sheet.getDataRange().getValues();
      let tr=-1;
      for(let i=1;i<sd.length;i++){if(sd[i][0]===mesLabel){tr=i+1;break;}}

      if(tr>0){
        sheet.getRange(tr,1,1,rowData.length).setValues([rowData]);
      } else {
        const kn=parseInt(year)*100+parseInt(month); let ia=sheet.getLastRow()+1;
        for(let i=1;i<sd.length;i++){
          const p=String(sd[i][0]).split(" ");
          if(p.length===2){const mi=MESES.indexOf(p[0]);const cn=parseInt(p[1])*100+mi+1;if(cn>kn){ia=i+1;break;}}
        }
        sheet.insertRowBefore(ia); sheet.getRange(ia,1,1,rowData.length).setValues([rowData]);
      }
    }

    const lr=sheet.getLastRow();
    if(lr>1){
      sheet.getRange(2,2,lr-1,12).setNumberFormat("$#,##0").setHorizontalAlignment("right");
      for(let r=2;r<=lr;r++){
        const c=sheet.getRange(r,14); c.setNumberFormat("$#,##0").setFontWeight("bold");
        const v=c.getValue(); c.setFontColor(v>0?"#276749":v<0?"#C53030":"#718096");
      }
      sheet.getRange(1,2,1,3).setBackground("#276749");
      sheet.getRange(1,5,1,7).setBackground("#C53030");
      sheet.getRange(1,12,1,3).setBackground("#744210");
      sheet.getRange(1,14,1,2).setBackground("#2B6CB0");
    }

    return ContentService.createTextOutput(JSON.stringify({status:"ok",meses:Object.keys(allData).length}))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({status:"error",msg:err.toString()}))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

// ══════════════════════════════════════════════════════════════════════
//  PARA ACTUALIZAR (URL no cambia):
//  1. Extensiones → Apps Script → pegar este código → Guardar
//  2. Implementar → Administrar implementaciones → ✏️ → Nueva versión → Implementar
//
//  IMPORTANTE: la hoja "Tarjetas" debe tener estos encabezados exactos
//  en la primera fila (Zapia ya los genera así):
//  id_unico | mes | tarjeta | fecha | comercio | detalle_original |
//  categoria | subcategoria | importe | moneda | cuotas | cuota_actual |
//  tipo_movimiento | archivo_origen | fecha_carga
// ══════════════════════════════════════════════════════════════════════
