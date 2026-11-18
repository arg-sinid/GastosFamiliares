# v7.1 — Cobertura del mes siguiente, vencidas aparte y período de tarjetas

**Período de tarjetas (corrección).** El resumen de un mes (los gastos de noviembre) vence el mes SIGUIENTE (3/12). El período/ID de la
obligación es el mes del resumen (`2026-11|icbc`). El resumen de octubre vencía el 3/11 y ya está pagado: el corte por defecto de
obligaciones pasó a `2026-11-05`, así que no aparece como obligación. Se eliminó el ajuste "desfase de tarjetas" (`ajustes.tarjetaDesfase`
queda ignorado): en el Principal de noviembre figura el resumen de noviembre.

**Importes de tarjeta, en este orden:** resumen definitivo → importe manual → **Temporal de noviembre** (movimientos provisorios) →
**Estimado** (último resumen anterior, con "basado en el resumen de …"). Al llegar el definitivo reemplaza a lo anterior: nunca se suman.

**Principal.**
- *Cobertura de {mes siguiente}*: obligaciones impagas que vencen ESE mes (definitivas / temporales / estimadas, por separado) − disponibilidad real − sueldo previsto de Julieta.
  El sueldo previsto es el del mes anterior al de las obligaciones (el de noviembre, que se cobra el último día hábil, paga diciembre); se muestra aparte y aclarado como no disponible. No incluye meses posteriores ni lo vencido de meses anteriores.
- *Vencidas de meses anteriores*: bloque aparte con total; al tocarlo lista período, concepto, vencimiento e importe. No entra en la cobertura.
- *Vencen en {mes actual}* (incluye lo vencido este mes que sigue impago) y *Más adelante* (fuera de la cobertura).

**Gastos > Tarjetas.** Mes sin resumen definitivo: cada tarjeta se muestra como "Temporal de {mes}" (provisorio), con su vencimiento; el detalle lista cada movimiento con su categoría. No suman en Gastos ni en el resultado. Tocar la tarjeta desde Principal abre ese detalle del mes del resumen.

**No cambia:** resultado mensual, conciliaciones de Uala y efectivo, disponibilidad, ahorro, sincronización, backend (sigue 7.0).

---

# GastosFamiliares v7.0 — arquitectura, fórmulas, migración y límites

## 1. Diagnóstico (qué estaba mal en la v6)
- **Tres motores distintos para lo mismo.** `utils.js` calculaba el "resultado mensual" de Principal (sueldo + saldo de la Uala − fijos: mezclaba un SALDO con ingresos), `CierreReal` calculaba otro (bruto − gastos) y la hoja Control otro más. Principal y Cierre no podían coincidir.
- **El efectivo no se conciliaba.** Solo había un control del lado de Germán (bruto vs. usos) que además sumaba el depósito de fin de mes dos veces.
- **Vencimientos se daban por pagados al pasar la fecha** (y se ocultaban por regla del día 25): una deuda vieja desaparecía sola.
- **El saldo de la Uala "vivo"** restaba pagos estimados y se alejaba del saldo real declarado.
- Cálculos y vistas mezclados: cada pantalla recalculaba por su cuenta.

## 2. Arquitectura final
```
src/motor.js          ← ÚNICO motor financiero (puro, sin React ni guardado)
src/utils.js          ← helpers: formato, fechas, ítems de Gastos, Auto, vehículos, normalización de datos
src/sync.js           ← persistencia/sincronización con control de concurrencia
src/App.jsx           ← carga/guarda; pasa datos; NO calcula plata
src/apps/ControlGastos.jsx  (Principal) · Control.jsx · CierreReal.jsx · Gastos.jsx · Auto.jsx   ← solo muestran
src/components/conciliacion.jsx   ← vistas de conciliación compartidas (Control y Principal)
backend/apps_script_v7.js          ← Apps Script (solo persistencia y tablas derivadas)
```
`construirSituacion({appData, zapiaData, tarjetasData, tarjetasProvisorias, mesKey, hoyStr})` devuelve TODO lo que muestran las pantallas: disponibilidad, ingresos, conciliaciones (Uala y efectivo), obligaciones, cobertura, resultado y ahorro. La hoja "Control 2026" y las tablas legibles de Google Sheets salen del mismo motor.

## 3. Fórmulas definitivas
| Concepto | Fórmula |
|---|---|
| Transferencia dominical | bruto Uber/DiDi − gastos personales de Germán por transferencia (es un movimiento entre bolsillos, **no** un ingreso) |
| Aportes a la Uala | transferencias de Germán + efectivo depositado a fin de mes (`efectivoCierreMes`) |
| Saldo esperado de la Uala | saldo anterior confirmado + aportes − gastos de **Julieta** por transferencia |
| Diferencia Uala | saldo declarado − esperado (negativa = posible gasto hormiga; positiva = sobrante a justificar) |
| Efectivo esperado | efectivo anterior + (bruto − gastos de Germán por transferencia) − transferencia a la Uala − depósito de fin de mes − gastos en efectivo de Germán y de Julieta |
| Disponibilidad familiar | saldo real de la Uala (último declarado) + efectivo real (último declarado) |
| Resultado mensual | (sueldo de Julieta + bruto Uber/DiDi del mes) − (gastos de Zapia del mes + tarjetas del mes + fijos sin tarjeta) |
| Cobertura | disponibilidad − (vencido + pendiente definitivo). No cuenta sueldo pendiente ni estimados |
| Ahorro | solo movimientos cargados a mano |

Qué gastos salen de dónde: Germán/transferencia → de su bruto (ya neto en la transferencia); Julieta/transferencia → Uala; Germán o Julieta/efectivo → fondo de efectivo común.

## 4. Conciliación de la Uala: análisis y decisión
La regla acordada ("transferencias − gastos de Julieta debería coincidir con el saldo declarado") se probó contra las dos formas posibles, con los saldos históricos que mostraba la app (27/09 = 425.000, 25/10 = 800.000, 01/11 = 740.000):

| Período | Alternativa A: saldo anterior + aportes − gastos | Alternativa B: solo aportes − gastos |
|---|---|---|
| 27/09 → 25/10 | −225.000 | **+200.000** |
| 25/10 → 01/11 | −49.100 | **+750.900** |

**Identidad:** `difB − difA = saldo anterior`. B solo equivale a A si la cuenta arrancó el período en 0; como la Uala acumula saldo, B atribuye el saldo previo a "sobrante" y da diferencias absurdas. **Se adopta A**, y se muestra con la regla acordada expresada como **variación**: variación esperada (transferencias − gastos) vs. variación real (saldo declarado − saldo anterior), con el "saldo anterior confirmado" visible en pantalla. La primera declaración es solo punto de partida (sin base no hay diferencia). No se modifica ningún saldo declarado ni se esconde la diferencia. Cada saldo se usa una vez como inicio del período siguiente; un gasto del mismo día de la declaración pertenece al período que esa declaración cierra.

## 5. Control del efectivo: contradicción detectada
Tomadas literalmente, las dos reglas se contradicen: si la transferencia es `B − Gt` y el efectivo esperado es `anterior + B − T − gastos`, el efectivo termina sumando `+Gt` (los gastos de Germán por transferencia) sin ninguna entrada real. **Criterio adoptado:** en la fórmula de efectivo se usa el bruto **neto** de esos gastos (`B − Gt`), porque la transferencia ya los tiene descontados. Además se descuenta el depósito de fin de mes (`efectivoCierreMes`: efectivo que pasa a la Uala; es otro campo que `efectivoEnMano`, que es el efectivo declarado). Se muestra el "efectivo retenido" (`B − Gt − T`). Una declaración de efectivo REEMPLAZA a la anterior. Limitación: una declaración en 0 solo se reconoce si el registro de Auto tiene `efectivoDeclarado` (los registros nuevos lo guardan).

## 6. Obligaciones (gastos fijos y vencimientos)
Una obligación = gasto fijo + período + vencimiento + estado + pago. Estados: **vencido, pendiente, próximo a vencer (≤ 7 días), pagado**; tipo **definitivo / provisorio (estimado)**.
- Un vencimiento **no se da por pagado por pasar la fecha**: queda vencido hasta marcarlo "✓ Pagado". Se quitó la regla de los días 25.
- Tarjetas: el resumen anterior es la obligación actual hasta que se paga; después aparece el siguiente como **provisorio** (suma de movimientos provisorios si hay; si no, estimación = último resumen, marcada como "Estimado"). Al llegar el definitivo lo **reemplaza** (nunca se suman). Una deuda anterior impaga sigue visible mientras aparece la siguiente.
- Alquiler/recurrentes: igual lógica; el período siguiente aparece como estimado cuando el anterior se pagó o venció.
- Lo estimado **no entra** en el resultado ni en "lo que hay que pagar hoy". Los pagados quedan en el historial.
- Un fijo sin 📅 no es obligación (Principal avisa cuáles faltan).
- **Corte histórico:** las obligaciones con vencimiento anterior a `2026-11-01` (constante `OBLIGACIONES_DESDE_DEFECTO`, o `ajustes.obligacionesDesde`) se consideran historia y no aparecen como vencidas.
- **Movimientos provisorios de tarjeta:** convención para Zapia en la hoja `Tarjetas`: `tipo_movimiento = provisorio` **o** `archivo_origen` que contenga "provisorio"/"últimos movimientos". El backend v7 los marca; la app los separa y nunca los suma a Gastos ni al resultado.

## 7. Cierre e historial
Cierre usa el mismo motor y distingue: ingresos reales, gastos reales, resultado, saldos reales, obligaciones (vencidas/pendientes/estimadas) y ahorros. **🔒 Cerrar mes** guarda una foto (`cierres[mes]`); el historial la usa sin recalcular y, si después los datos cambiarían el resultado, lo avisa en vez de pisarla.

## 8. Cambios que mueven números respecto de v6
1. **Resultado mensual** de Principal ahora es el económico (igual que Cierre): ya no usa el saldo de la Uala.
2. La **disponibilidad** es la suma de los dos saldos reales declarados (se quitó el "saldo vivo" estimado).
3. Los vencimientos ya no se autopagan ni desaparecen por fecha.
4. La hoja **Control 2026** cambia de columnas (`Sueldo`, `Uber/DiDi (bruto)`, `Gastos Zapia`, `Resultado del mes`…) y sus encabezados los manda la app.
5. **Control** ahora concilia por períodos entre declaraciones (Uala y efectivo), sin vista semana/mes.

## 9. Migración y compatibilidad de datos
- Sin migraciones destructivas: se agregó el campo `cierres` (vacío por defecto) y `efectivoDeclarado` en registros nuevos. Todo lo anterior se lee igual (`normalizarAppData`). `deuda_anterior` de meses viejos queda guardado y se ignora. Los ids de pagos (`mes|gasto`) no cambiaron.
- Datos históricos no se recalculan ni se reinterpretan; los saldos declarados no se tocan.

## 10. Apps Script
- Archivo: `backend/apps_script_v7.js` (derivado de v6.1; el v6 queda como respaldo). **No asumir cuál está publicado:** abrir `<URL del script>?tipo=info`: si responde `{"status":"ok","backend":"7.0"}` ya está la v7; si no, la app lo avisa con un cartel en Principal.
- Novedades de v7 sobre v6.1: endpoint `info`; marca `provisorio` en Tarjetas; encabezados de Control enviados por la app; tablas nuevas **Efectivo** y **Obligaciones** (más Ganancias Auto, Saldos Uala, Conciliaciones, Ahorros). Mismo formato de datos y de versionado: v7 y la app anterior son compatibles entre sí salvo por esas tablas/encabezados.
- Sincronización: solo se informa "sincronizado" si el HTTP fue correcto, `status:"ok"` y el servidor devolvió la versión nueva; respuesta incompleta o error = cambios pendientes en el dispositivo.

## 11. Riesgos y límites
- El día de cobro del sueldo es el último día hábil (lunes a viernes); no considera feriados.
- La estimación de tarjeta sin movimientos provisorios usa el último resumen; si no hay ninguno, no se estima.
- Sin `efectivoDeclarado`, una declaración de efectivo en 0 de registros viejos no se detecta.
- No se pudo ejecutar `vite build` ni probar en un celular real en el entorno de desarrollo: se verificó sintaxis, imports y nombres, 69 pruebas automáticas y una prueba de humo que renderiza todas las pantallas (con React simulado) con datos reales y vacíos.
