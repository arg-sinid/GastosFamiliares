# Pruebas manuales v7.0 (celular, dos dispositivos, red, PDF)
Automáticas: `npm test` (motor, utilidades, sincronización y backend en sandbox).

**G — Navegación e interfaz**
1. Tres accesos inferiores: Principal, Gastos, Auto. Sin botones extra.
2. Principal → Mes: orden Disponibilidad → Ingresos familiares → Gastos fijos y obligaciones → Resultado → Ahorro. No hay listados diarios, ni control de efectivo, ni ingresos diarios de Uber/DiDi.
3. Tocar "Germán · saldo de Uala" abre/cierra la conciliación (misma que en Control) y "Ver todo en Control ›" lleva a Control.
4. Selector de mes: cambiar a un mes anterior y volver; los importes y obligaciones de cada mes no se mezclan. Historial muestra 🔒 en meses cerrados.
5. Ahorros: cargar un ingreso y un retiro; el ahorro NO cambia la disponibilidad ni el resultado.
6. Control: Uala (período declaración a declaración, declarar en cualquier fecha, editar/borrar saldos) y Efectivo familiar.
7. Cierre: Cerrar mes → aparece la foto; cambiar un dato y ver el aviso de diferencia; Reabrir.
8. 👁️ oculta importes en todas las pantallas.

**Obligaciones**
9. Fijo con 📅: aparece como pendiente; ✓ Pagado lo pasa a Pagadas; deshacer lo devuelve.
10. Dejar pasar la fecha sin pagar: queda "Vencido" y el período siguiente aparece como "Estimado" sin ocultar lo vencido.
11. Tarjeta: con resumen cargado figura "definitivo"; al cargar el del mes siguiente reemplaza al estimado (no se suma).
12. Tocar "Tarjeta ICBC" lleva a Gastos → Tarjetas del resumen correcto.

**Conciliaciones**
13. Uala: declarar un saldo igual al esperado (diferencia 0), uno menor (negativa) y uno mayor (positiva).
14. Efectivo: declarar el domingo en Auto y ver el período en Control.

**Sincronización**
15. Dos celulares: cargar datos distintos antes de sincronizar → quedan los dos.
16. Modo avión: guardar → "pendiente"; con red se envía solo; nunca dice "sincronizado" antes.
17. Importar dos veces el mismo PDF: el total de la tarjeta no cambia.
18. Cartel de Apps Script: con la v6 aparece el aviso; tras pegar la v7 desaparece.


## v7.1
1. Principal (mes actual): aparece "Cobertura de diciembre" con obligaciones, disponibilidad real y sueldo previsto por separado; el sueldo dice "Todavía no cobrado".
2. Si hay vencidas de meses anteriores: bloque rojo con total; tocarlo muestra período, concepto, vencimiento e importe. Marcar una como pagada la saca del bloque y del total.
3. Tarjeta sin resumen de noviembre pero con movimientos provisorios: Principal la muestra "Temporal de noviembre" (vence 3/12 o 4/12). Tocarla abre Gastos > Tarjetas en noviembre con los movimientos, cada uno con su categoría y la marca "provisorio".
4. Sin movimientos provisorios: se muestra "Estimado · basado en el resumen de octubre".
5. Cargar el resumen definitivo de noviembre: desaparecen los temporales, queda un solo importe (el del resumen) y ya no figura "provisorio".
6. El resumen de octubre (vencía 3/11) no aparece como obligación.
