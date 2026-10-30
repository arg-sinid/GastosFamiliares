// ─────────────────────────────────────────────────────────────────────
//  CONTROL DE GASTOS FAMILIAR — Apps Script v6
//  Base: apps_script_v5_corregido.js (LockService + escritura en bloque).
//
//  Cambios respecto de v5_corregido:
//   · Versionado (control de concurrencia): cada guardado trae baseVersion;
//     si otro dispositivo guardó antes, responde "conflict" con su estado.
//   · Estado partido en celdas de 40.000 caracteres (ya no hay tope de una celda).
//     Compatible con el formato viejo (todo en A1): se lee igual y, antes de la
//     primera escritura, se hace una copia de seguridad en una hoja oculta.
//   · El backend ya NO recalcula ingresos: la app manda las filas de "Control 2026"
//     calculadas con las mismas funciones que muestra la pantalla; acá solo se escriben.
//   · Rechaza guardados vacíos que borrarían datos existentes, y payloads de
//     versiones viejas de la app (sin baseVersion).
//   · Registro Diario: cada fila devuelve un id estable (hash) para vincular
//     el detalle de Auto sin duplicar el gasto.
//  Hoja "Tarjetas": encabezados id_unico | mes | tarjeta | fecha | comercio |
//  detalle_original | categoria | subcategoria | importe | moneda | cuotas |
//  cuota_actual | tipo_movimiento | archivo_origen | fecha_carga
// ─────────────────────────────────────────────────────────────────────

const SHEET_ID       = "1cMVhNzKL1nRcIJRf_WS_kyC981K8kkW3TY201EH-CXw";
const SHEET_CONTROL  = "Control 2026";
const SHEET_ZAPIA    = "Registro Diario";
const SHEET_TARJETAS = "Tarjetas";
const SHEET_DATA     = "_app_data_";
const TZ             = "America/Argentina/Buenos_Aires";
const CHUNK          = 40000;      // límite de Sheets: 50.000 caracteres por celda
const MAX_TOTAL      = 3000000;    // tope defensivo del estado completo

const HEADERS_CONTROL = [
  "Mes","Julieta (ICBC)","Germán (transfers.)","Total Ingresos",
  "Tarjeta ICBC","Tarjeta BNA","Préstamos","Nicolás","Segundo","Alquiler",
  "Total Gastos Fijos","Deuda Anterior","Total Egresos","Saldo / Ahorro","Última sync"
];

const emptyData = () => ({ monthly:{}, categories:{}, uberDiDi:[], gastosRecurrentes:{},
  saldoJulieta:{}, dolarTarjeta:{}, ahorroMovimientos:[], autoDetalle:{} });

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ── Almacenamiento versionado ────────────────────────────────────────
// Columna A: el JSON partido en trozos. B1: {"v":versión,"n":trozos}.
// B1 se escribe AL FINAL: es la marca de "guardado completo".
function getDataSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(SHEET_DATA);
  if (!sh) { sh = ss.insertSheet(SHEET_DATA); sh.hideSheet(); }
  return sh;
}
function parseData(raw) {
  if (!raw) return emptyData();
  try {
    const d = JSON.parse(raw), e = emptyData();
    Object.keys(e).forEach(k => { if (d[k] === undefined || d[k] === null) d[k] = e[k]; });
    return d;
  } catch (err) { return emptyData(); }
}
function readMeta(sh) {
  const v = sh.getRange("B1").getValue();
  if (!v) return null;
  try { const m = JSON.parse(v); return (m && typeof m === "object" && m.n > 0) ? m : null; } catch (e) { return null; }
}
function readVersion() { const m = readMeta(getDataSheet()); return m ? m.v : 0; }
function readState() {
  const sh = getDataSheet(), m = readMeta(sh);
  if (!m) { const raw = sh.getRange("A1").getValue(); return { version:0, legacy:!!raw, raw, data: parseData(raw) }; }
  const raw = sh.getRange(1, 1, m.n, 1).getValues().map(r => r[0]).join("");
  return { version:m.v, legacy:false, raw, data: parseData(raw) };
}
function crearBackup(raw, etiqueta) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const name = "_backup_" + etiqueta + "_" + Utilities.formatDate(new Date(), TZ, "yyyyMMdd_HHmmss");
  const sh = ss.insertSheet(name);
  const trozos = [];
  for (let i = 0; i < raw.length; i += CHUNK) trozos.push([raw.slice(i, i + CHUNK)]);
  sh.getRange(1, 1, Math.max(1, trozos.length), 1).setValues(trozos.length ? trozos : [[""]]);
  sh.hideSheet();
  return name;
}
function writeState(data, newVersion) {
  const sh = getDataSheet();
  const text = JSON.stringify(data);
  if (text.length > MAX_TOTAL) throw new Error("El estado supera el tamaño máximo permitido (" + text.length + ").");
  const trozos = [];
  for (let i = 0; i < text.length; i += CHUNK) trozos.push([text.slice(i, i + CHUNK)]);
  const oldMeta = readMeta(sh);
  const oldN = oldMeta ? oldMeta.n : 1;
  sh.getRange(1, 1, trozos.length, 1).setValues(trozos);
  if (oldN > trozos.length) sh.getRange(trozos.length + 1, 1, oldN - trozos.length, 1).clearContent();
  sh.getRange("B1").setValue(JSON.stringify({ v:newVersion, n:trozos.length }));
}

// ── Util ──────────────────────────────────────────────────────────────
function parseCosto(val) {
  if (typeof val === "number") return val;
  return parseFloat(String(val).replace(/[$\s]/g,"").replace(/\./g,"").replace(",",".")) || 0;
}
function normQuien(val) {
  const s = String(val||"").toLowerCase().trim();
  if (s.includes("german") || s.includes("germán")) return "Germán";
  if (s.includes("juliet")) return "Julieta";
  return val;
}
function fmtFechaCell(val) {
  if (val instanceof Date) return Utilities.formatDate(val, TZ, "yyyy-MM-dd");
  return String(val||"").trim();
}
// Normaliza "mes" a "YYYY-MM" (texto, "2026-8" o fecha autoconvertida por Sheets).
function normalizarMes(val) {
  if (val instanceof Date) return Utilities.formatDate(val, TZ, "yyyy-MM");
  const s = String(val||"").trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return m[1] + "-" + m[2].padStart(2,"0");
  return s;
}
function hashId(texto) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, texto);
  return bytes.map(b => ((b + 256) % 256).toString(16).padStart(2,"0")).join("").slice(0, 12);
}

// Registro Diario (Zapia/WhatsApp). El id es estable: hash de fecha|hora|quién|qué|costo
// más un contador si hay filas idénticas (compras iguales el mismo día).
function leerRegistroDiario(ss) {
  const sheet = ss.getSheetByName(SHEET_ZAPIA);
  if (!sheet) return [];
  const vals = sheet.getDataRange().getValues();
  if (vals.length <= 1) return [];
  const vistos = {};
  return vals.slice(1).filter(r => r[0] !== "").map(row => {
    const o = { fecha:fmtFechaCell(row[0]), hora:String(row[1]||"").trim(), quien:normQuien(row[2]),
                que:String(row[3]||"").trim(), costo:parseCosto(row[4]), medio:String(row[5]||"").toLowerCase().trim() };
    const base = [o.fecha, o.hora, o.quien, o.que, o.costo].join("|");
    vistos[base] = (vistos[base] || 0) + 1;
    o.id = "z" + hashId(base + "#" + vistos[base]);
    return o;
  }).filter(r => r.fecha && r.que);
}

// ── doGet ─────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    const tipo = (e && e.parameter && e.parameter.tipo) || "";

    if (tipo === "version") return json({ status:"ok", version:readVersion() });

    if (tipo === "appdata") {
      const st = readState();
      return json({ status:"ok", version:st.version, data:st.data });
    }

    if (tipo === "zapia") {
      return json({ status:"ok", data:leerRegistroDiario(SpreadsheetApp.openById(SHEET_ID)) });
    }

    if (tipo === "tarjetas") {
      const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_TARJETAS);
      if (!sheet) return json({ status:"ok", data:[] });
      const vals = sheet.getDataRange().getValues();
      if (vals.length <= 1) return json({ status:"ok", data:[] });
      const headers = vals[0].map(h => String(h).toLowerCase().trim());
      const idx = name => headers.indexOf(name);
      const iId = idx("id_unico"), iMes = idx("mes"), iTarjeta = idx("tarjeta"), iFecha = idx("fecha"),
            iComercio = idx("comercio"), iCategoria = idx("categoria"), iSubcategoria = idx("subcategoria"),
            iImporte = idx("importe"), iMoneda = idx("moneda"), iCuotas = idx("cuotas"), iTipoMov = idx("tipo_movimiento");
      if (iComercio < 0) return json({ status:"error", msg:"La hoja Tarjetas no tiene la columna 'comercio'." });

      const datos = vals.slice(1).filter(r => r[iComercio] !== "" && r[iComercio] != null).map(row => ({
        id:        iId >= 0 ? String(row[iId]) : "",
        mes:       iMes >= 0 ? normalizarMes(row[iMes]) : "",
        tarjeta:   iTarjeta >= 0 ? String(row[iTarjeta]).trim().toUpperCase() : "",
        fecha:     iFecha >= 0 ? fmtFechaCell(row[iFecha]) : "",
        comercio:  String(row[iComercio]).trim(),
        categoriaZapia:    iCategoria >= 0 ? String(row[iCategoria]).trim() : "",
        subcategoriaZapia: iSubcategoria >= 0 ? String(row[iSubcategoria]).trim() : "",
        importe:   iImporte >= 0 ? parseCosto(row[iImporte]) : 0,
        moneda:    iMoneda >= 0 ? String(row[iMoneda]).trim().toUpperCase() : "ARS",
        cuotas:    iCuotas >= 0 ? String(row[iCuotas]).trim() : "",
        tipoMovimiento: iTipoMov >= 0 ? String(row[iTipoMov]).trim().toLowerCase() : "consumo",
      })).filter(r => r.comercio && r.mes && r.tarjeta);
      return json({ status:"ok", data:datos });
    }

    return json({ status:"ok", msg:"API v6" });
  } catch (err) {
    return json({ status:"error", msg:err.toString() });
  }
}

// ── doPost ────────────────────────────────────────────────────────────
// Payload: { baseVersion:number, data:{...estado...}, filasControl:[[...15 columnas...]] }
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    let payload;
    try { payload = JSON.parse(e.postData.contents); } catch (err) { return json({ status:"error", msg:"JSON inválido" }); }

    if (typeof payload.baseVersion !== "number" || !payload.data || typeof payload.data !== "object")
      return json({ status:"error", msg:"La app está desactualizada: cerrala y volvé a abrirla para actualizar." });

    const nuevo = Object.assign(emptyData(), payload.data);
    const tipos = (nuevo.monthly && typeof nuevo.monthly === "object") && Array.isArray(nuevo.uberDiDi) &&
                  Array.isArray(nuevo.ahorroMovimientos) && typeof nuevo.categories === "object";
    if (!tipos) return json({ status:"error", msg:"Estructura de datos inválida." });

    const actual = readState();
    // Control de concurrencia: si el estado cambió desde que la app lo leyó, no se pisa.
    if (actual.version !== payload.baseVersion)
      return json({ status:"conflict", version:actual.version, data:actual.data });

    // Protección contra vaciado accidental (p. ej. app que no llegó a cargar).
    const hoyHayDatos = Object.keys(actual.data.monthly||{}).length > 0 || (actual.data.uberDiDi||[]).length > 0;
    const nuevoVacio  = Object.keys(nuevo.monthly).length === 0 && nuevo.uberDiDi.length === 0;
    if (hoyHayDatos && nuevoVacio) return json({ status:"error", msg:"Se rechazó un guardado vacío que borraría los datos existentes." });

    // Primera escritura sobre el formato viejo: copia de seguridad previa.
    let backup = null;
    if (actual.version === 0 && actual.legacy) backup = crearBackup(actual.raw, "pre_v6");

    const version = actual.version + 1;
    writeState(nuevo, version);

    // La hoja Control es derivada: si falla no invalida el guardado de los datos.
    let controlOk = true;
    try { escribirControl(payload.filasControl); } catch (err) { controlOk = false; }

    return json({ status:"ok", version, controlOk, backup });
  } catch (err) {
    return json({ status:"error", msg:err.toString() });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// Escribe en bloque las filas ya calculadas por la app (sin recalcular nada).
function escribirControl(filas) {
  if (!Array.isArray(filas)) return;
  const cols = HEADERS_CONTROL.length;
  const rows = filas.filter(f => Array.isArray(f) && f.length === cols).map(f => {
    const r = f.slice(); r[cols - 1] = Utilities.formatDate(new Date(), TZ, "dd/MM/yyyy HH:mm"); return r;
  });
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_CONTROL);
  if (!sheet) sheet = ss.insertSheet(SHEET_CONTROL);

  const hr = sheet.getRange(1, 1, 1, cols);
  hr.setValues([HEADERS_CONTROL]);
  hr.setFontWeight("bold").setBackground("#1A365D").setFontColor("#FFFFFF").setHorizontalAlignment("center").setWrap(true);
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 40);

  const oldLast = sheet.getLastRow();
  if (oldLast > 1) sheet.getRange(2, 1, oldLast - 1, cols).clearContent();
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, cols).setValues(rows);
    sheet.getRange(2, 2, rows.length, 12).setNumberFormat("$#,##0").setHorizontalAlignment("right");
    sheet.getRange(2, 14, rows.length, 1).setNumberFormat("$#,##0").setFontWeight("bold")
         .setFontColors(rows.map(r => [Number(r[13]) > 0 ? "#276749" : Number(r[13]) < 0 ? "#C53030" : "#718096"]));
  }
  [130,110,120,110,100,110,100,90,90,90,120,110,120,120,140].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  sheet.getRange(1, 2, 1, 3).setBackground("#276749");
  sheet.getRange(1, 5, 1, 7).setBackground("#C53030");
  sheet.getRange(1, 12, 1, 3).setBackground("#744210");
  sheet.getRange(1, 14, 1, 2).setBackground("#2B6CB0");
}

// ── Mantenimiento manual (se ejecutan desde el editor de Apps Script) ─
// Copia de seguridad a demanda del estado actual.
function crearBackupManual() { const st = readState(); return crearBackup(st.raw || "", "manual"); }
// Recuperación: restaura el estado desde una hoja _backup_* (pasale el nombre).
// Deja el estado como versión nueva, así los dispositivos lo toman en su próxima lectura.
function restaurarBackup(nombreHoja) {
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(nombreHoja);
  if (!sh) throw new Error("No existe la hoja " + nombreHoja);
  const raw = sh.getDataRange().getValues().map(r => r[0]).join("");
  const data = parseData(raw);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { writeState(data, readVersion() + 1); } finally { lock.releaseLock(); }
}

// ══════════════════════════════════════════════════════════════════════
//  PARA ACTUALIZAR (la URL no cambia):
//  1. Extensiones → Apps Script → reemplazar TODO el código por este archivo → Guardar.
//  2. Implementar → Administrar implementaciones → ✏️ → Nueva versión → Implementar.
//  Este archivo NO forma parte de la app: no se sube con el resto desde Termux a
//  producción; se pega en el editor de Apps Script (queda en /backend solo como respaldo).
// ══════════════════════════════════════════════════════════════════════
