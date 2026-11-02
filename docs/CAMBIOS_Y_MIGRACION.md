# GastosFamiliares v5 — cambios, migración y pendientes

## Orden de despliegue (importante)
1. **Primero** pegar `backend/apps_script_v6.js` en el editor de Apps Script → Implementar → Administrar implementaciones → ✏️ → Nueva versión. La URL no cambia.
2. **Después** subir la app (merge a la rama que publica GitHub Pages).
   - App nueva + backend viejo: la app lo detecta (no hay `version`) y no deja guardar.
   - App vieja en caché + backend nuevo: el backend rechaza el guardado ("app desactualizada"). No se pisa nada.

## Migración de datos (no destructiva)
- El estado sigue en la hoja oculta `_app_data_`. Formato nuevo: JSON partido en celdas de 40.000 caracteres (columna A) + marca de versión en `B1`.
- Formato viejo (todo en A1) se lee igual (versión 0). **Antes de la primera escritura** el backend crea la hoja oculta `_backup_pre_v6_<fecha>` con el JSON original intacto.
- La celda A1 original se sobrescribe recién con el primer guardado; el backup es el respaldo.
- Recuperación: en el editor de Apps Script ejecutar `restaurarBackup("_backup_pre_v6_...")`. También existe `crearBackupManual()`.
- Validación: comparar en Drive la cantidad de registros de Uber/DiDi, saldos y ahorros antes/después (el backup está en la misma planilla).
- Campo nuevo `autoDetalle` (detalle de mantenimiento): arranca vacío, no toca datos viejos.

## Reglas de negocio aplicadas (confirmadas por Germán)
- Ingreso de Germán en Principal = saldo de la Uala TAL CUAL lo declara Julieta (último saldo del mes). Sin sumas ni restas: ni movimientos posteriores, ni gastos de Zapia (salen de ese saldo), ni diferencia de conciliación. Mes sin declaración todavía: 0.
- Saldo esperado = saldo real anterior + transferencias de domingos + depósito de fin de mes − gastos de Zapia de Julieta (efectivo y transferencia).
- Diferencia = real − esperado. Negativa = gasto hormiga, positiva = sobrante. Solo control: nunca se resta del resultado.
- Germán: bruto Uber/DiDi vs (sus gastos de Zapia + girado/depositado a Uala + efectivo que queda). Misma convención de signo.
- Tarjetas: se descuentan en Principal (fijos), no del saldo de Uala.
- Resultado mensual: UNA función (`calcularResultadoMensual`), usada por Principal, Historial, Ahorros y la hoja Control.
- "Cierre económico" (ex Cierre Real) es otro indicador, con otro nombre: bruto del auto − todos los gastos.

## Cambios de comportamiento que van a mover números
1. **Mes abierto de Germán**: muestra el saldo declarado (corregido en v5.1; en v5.0 mostraba la suba del saldo).
2. **Depósito de fin de mes**: ya no se suma aparte (estaba contado dos veces).
3. **Gastos de Julieta**: ahora restan efectivo Y transferencia (antes solo transferencia).
4. **Hormiga**: ya no se recorta en 0; puede ser negativa o positiva.
5. En meses cerrados la suba del saldo puede ser negativa (ya no se recorta en 0).
6. **Hoja Control** y **Principal** usan ahora el mismo cálculo (antes la hoja usaba los valores manuales de tarjeta por un bug de closure).
7. **Categorías**: se agregan Combustible, Mantenimiento y Peajes/TelePASE. Las compras de tarjeta sin categoría guardada se clasifican al vuelo, así que lo que antes caía en "Auto" ahora cae en la categoría fina (montos y totales NO cambian). Lo ya guardado por vos en categorías no se toca; lo que quedó en "Auto" aparece en Auto → "por clasificar".
8. Palabras cortas ("pan", "dia") ahora coinciden solo como palabra completa (pantalon ≠ pan).

## Para comparar antes/después
Sacá captura de Principal (Historial) de los últimos meses ANTES de actualizar. Las diferencias esperadas están solo en los puntos 1–5.

## Pendientes / no tocado a propósito
- **Ahorro acumulado**: sigue sumando saldos mensuales positivos, incluido el mes en curso (provisorio). Propuesta: contar solo meses cerrados. Necesito tu decisión.
- La deuda del mes anterior sigue guardándose en el mes siguiente al guardar (regla original).
- Compras de tarjeta en cuotas quedan en "Cuotas" aunque las hayas categorizado como mantenimiento (precedencia original).
- Lo que Zapia carga en `Registro Diario` no tiene id propio: el backend lo genera (hash de fecha|hora|quién|qué|costo + contador).
- Deduplicación de PDFs: por `id_unico` (filas sin id nunca se descartan).
- Ocultar importes: enmascara textos y gráficos; los campos donde escribís siguen visibles.
- No se ejecutó `vite build` en mi entorno (sin red): correr `npm run build` en Termux.
- Seguridad: la URL del Apps Script sigue siendo el único secreto.

## v5.2 — Vencimientos y varios vehículos
**Datos nuevos** (arrancan vacíos, no tocan nada existente): `vencimientos` (clave del fijo → `{dia, mesSiguiente}`), `vehiculos` (id, marca, modelo, patente, año) y `gastoVehiculo` (id del gasto → id del vehículo).
- **Vencimientos:** cada gasto fijo tiene un botón 📅 para cargar el día de vencimiento (se repite todos los meses). Por defecto ICBC, Banco Nación y Préstamos se marcan "del mes siguiente" (el resumen de octubre vence en noviembre); es editable.
- **Principal:** mientras queden vencimientos sin pasar, arriba de todo se ve cuánto hace falta reunir para el próximo (y acumulado por fecha) contra lo disponible = sueldo de Julieta + saldo de la Uala. Solo cuentan los fijos con fecha cargada. Cuando pasan todos, la tarjeta desaparece y queda el resultado mensual como siempre (que se sigue viendo debajo mientras tanto).
- **Vehículos:** en Auto → "Vehículos y gastos" se agregan/editan/quitan vehículos (marca, modelo, patente, año; la patente no se puede repetir). Se elige el vehículo antes de ver el mes.
- **Imputación:** el gasto se carga una sola vez en Gastos. Al categorizarlo como Combustible, Mantenimiento, Peajes/TelePASE o Auto, si hay más de un vehículo se pregunta a cuál corresponde. También se puede cambiar desde Auto. Los gastos sin asignar (y todos los anteriores) van al primer vehículo.
- La suma de los vehículos coincide con el total de Gastos. El bruto de Uber/DiDi no se reparte por vehículo, así que la rentabilidad se calcula contra todos los vehículos.
- El detalle de mantenimiento (km, próximo cambio) y el "último km" son por vehículo.
- Backend: `apps_script_v6.js` cambió solo en los valores por defecto de los campos nuevos. Actualizarlo es opcional (los datos nuevos se guardan igual).

## v5.3 — Saldo de la Uala tal cual y sin arrastre de deuda
- **Germán · saldo de la Uala** = el último saldo que declaró Julieta en el mes, exacto (con la fecha de la carga). Vale para todos los meses.
- **Nuevo bloque "Cómo se cubren los fijos"** (Principal → Mes): los fijos se restan primero del sueldo de Julieta y lo que falte, de la Uala de Germán. En un mes nuevo, sin saldo declarado, la Uala puede figurar negativa (provisorio) hasta el domingo en que Julieta declare. Es solo una vista: el resultado mensual sigue siendo ingresos − fijos.
- **Deuda arrastrada eliminada**: ya no se muestra ni se crea el mes siguiente con deuda al guardar. El campo `deuda_anterior` de meses viejos se conserva guardado pero se ignora en las cuentas.
- Control (conciliación) no cambia: sigue mostrando esperado, real y diferencia/hormiga como control.
- **Pendiente:** el "Ahorro acumulado" suma saldos mensuales positivos; con el saldo de la Uala contado en cada mes (es un saldo, no un flujo) ese acumulado se infla. Propuesta: mostrar como ahorro el saldo actual. Necesito tu OK.
