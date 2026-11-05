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
- (Reemplazado en v5.4 por el saldo vivo, ver abajo.)
- **Deuda arrastrada eliminada**: ya no se muestra ni se crea el mes siguiente con deuda al guardar. El campo `deuda_anterior` de meses viejos se conserva guardado pero se ignora en las cuentas.
- Control (conciliación) no cambia: sigue mostrando esperado, real y diferencia/hormiga como control.

## v5.4 — Saldo vivo de la Uala y ahorro solo manual
- **Fijos y tarjetas** se pagan por la contabilidad de Principal en los primeros días del mes: ahí sale el dinero de la Uala (confirmado por Germán). Los gastos de Zapia de Julieta también salen de la Uala y se ven en Control.
- **Saldo vivo:** el saldo declarado el domingo se mantiene tal cual hasta que llega un vencimiento de Principal (fecha anterior a hoy). Desde ahí se va usando: primero el sueldo de Julieta que quede y lo que falte sale de la Uala (puede quedar negativa; provisorio hasta que Julieta declare). Los pagos anteriores a la declaración ya están reflejados en ese saldo. Un vencimiento cuenta como pagado al día siguiente de su fecha (el día que vence figura "vence hoy"). No incluye transferencias ni gastos de Zapia posteriores a la carga (se ven en Control).
- **El resultado mensual no cambia**: sueldo de Julieta + saldo declarado − gastos fijos. El saldo vivo es una vista de cuánto queda hoy.
- **Disponible para vencimientos** = sueldo que queda + Uala de hoy (ya descontado lo pagado).
- **Ahorro:** ahora es solo lo que se carga a mano en Ahorros (ingresos, ajuste inicial, retiros). No suma ni resta nada automático de ingresos/egresos. Se eliminó el acumulado automático, su tabla y su gráfico (el gráfico ahora acumula solo los movimientos manuales).
- Las etiquetas "ahorro" del resultado del mes pasaron a "a favor".

## v5.5 — Pagos del mes anterior, solo transferencias de Julieta y texto del vencimiento
- **Texto de la tarjeta de vencimientos:** arriba se lee el estado ("✓ Hay plata suficiente para pagarlo" / "⚠️ No alcanza la plata para pagarlo"); abajo, lo que hay que pagar, lo disponible hoy y cuánto sobra o falta.
- **Pagos del mes anterior (opción B):** los vencimientos del mes anterior que caen dentro del mes que se mira (por ejemplo las tarjetas de octubre pagadas el 3 y 4/11) se restan del saldo de la Uala a partir del día siguiente a su fecha, y solo si son posteriores a la declaración del domingo. Salen primero del sueldo de su propio mes (octubre) y después de la Uala. La Uala puede quedar negativa hasta que Julieta declare de nuevo. Los anteriores a la declaración ya están reflejados en ese saldo.
- **Gastos de Julieta por Zapia:** de la Uala solo salen los cargados por Julieta en modo **transferencia** (en la conciliación de Control y en el saldo de Principal). Los de efectivo y los de Germán no restan. En Principal bajan el saldo los posteriores a la declaración.
- No cambia el resultado mensual (sueldo + saldo declarado − fijos) ni el ahorro manual.

## v5.6 — Principal reordenado, vencimientos con "Pagado" y Control corregido
**Principal → Mes**
- Orden nuevo: (1) Vencimientos, solo cuando corresponde; (2) Ingresos familiares; (3) Gastos fijos, con el resultado mensual como una línea al pie. Se quitaron de esta pestaña la tarjeta grande de resultado, el banner de ahorro (sigue en Ahorros) y el bloque "Cómo se van pagando".
- **Vencimientos globales:** se listan por fecha real, los más cercanos primero, aunque vengan de otro mes de Principal (las tarjetas de octubre que se pagan el 3 y 4/11 salen antes que los de diciembre).
- **Ventana:** cada vencimiento aparece desde el 25 del mes anterior al de su fecha y se oculta cuando se paga o pasa su fecha. Si no queda ninguno visible, la tarjeta desaparece y solo se ven ingresos y gastos fijos.
- **Marcar pagado:** cada ítem tiene "✓ Pagado" (se puede deshacer). Un pago marcado deja de ser pendiente y, desde ese día, baja el saldo.
- **Saldo de la Uala:** cada pago (marcado o ya vencido) sale primero del sueldo de Julieta del MES EN QUE SE PAGA y después de la Uala. Los pagos anteriores a la declaración ya están reflejados en el saldo declarado. También bajan el saldo los gastos de Zapia de Julieta en modo transferencia posteriores a la declaración. Puede quedar negativo hasta que Julieta declare de nuevo.
- Nuevo dato guardado: `pagosFijos` (id `mes|gasto` → fecha de pago). Se sincroniza entre celulares.

**Control**
- Julieta puede declarar el saldo **cualquier día** (selector de fecha; antes estaba atado al domingo). Semana/Mes muestran las conciliaciones cuyo cierre cae en ese período.
- Sobre el saldo declarado se descuentan sus gastos de Zapia **por transferencia**; "transferencia" se reconoce por la raíz (transferencia, transf., etc.). La diferencia contra el próximo saldo declarado es el gasto hormiga (negativa) o sobrante (positiva).
- Se quitó la fila "Transferido desde esa carga" cuando es 0 (aparece solo si Germán transfirió).
- Nuevo desplegable **🔎 Qué gastos de Julieta restan**: lista los que restan, los del mismo día de la carga (ya incluidos en el saldo), los que no son transferencia y los que no se pudo identificar quién cargó. Sirve para ver por qué un gasto no está restando.
