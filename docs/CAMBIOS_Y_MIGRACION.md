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
- Ingreso de Germán en Principal = lo que se junta en la Uala = diferencia entre saldos reales consecutivos; mes abierto = estimación (transferencias + depósito − gastos de Julieta desde el último saldo real).
- Saldo esperado = saldo real anterior + transferencias de domingos + depósito de fin de mes − gastos de Zapia de Julieta (efectivo y transferencia).
- Diferencia = real − esperado. Negativa = gasto hormiga, positiva = sobrante. Solo control: nunca se resta del resultado.
- Germán: bruto Uber/DiDi vs (sus gastos de Zapia + girado/depositado a Uala + efectivo que queda). Misma convención de signo.
- Tarjetas: se descuentan en Principal (fijos), no del saldo de Uala.
- Resultado mensual: UNA función (`calcularResultadoMensual`), usada por Principal, Historial, Ahorros y la hoja Control.
- "Cierre económico" (ex Cierre Real) es otro indicador, con otro nombre: bruto del auto − todos los gastos.

## Cambios de comportamiento que van a mover números
1. **Mes abierto de Germán**: antes mostraba el saldo absoluto de Julieta; ahora la diferencia (flujo). Es el cambio más visible.
2. **Depósito de fin de mes**: ya no se suma aparte (estaba contado dos veces).
3. **Gastos de Julieta**: ahora restan efectivo Y transferencia (antes solo transferencia).
4. **Hormiga**: ya no se recorta en 0; puede ser negativa o positiva.
5. **Ingreso de Germán puede ser negativo** en un mes (si Julieta gastó de lo ahorrado). Para volver al piso en 0: `Math.max(0, …)` en `calcularIngresoGerman`.
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
