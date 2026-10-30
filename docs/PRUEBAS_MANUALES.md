# Pruebas manuales (dos celulares, red, PDF)

Automáticas: `npm test` (finanzas, sincronización, backend v6 en sandbox).

1. **Dos dispositivos**: en A cargar una ganancia (Auto); en B cargar el saldo de Julieta (Principal → Control). Sin refrescar, guardar en ambos. Resultado: los dos registros en los dos celulares tras volver a abrir.
2. **Mismo registro**: cargar la misma ganancia en A y en B. Debe quedar una sola si tiene el mismo id (si son cargas distintas, quedan dos, que es lo correcto).
3. **Sin red**: modo avión → cargar una ganancia → aparece "pendiente de sincronizar" y el botón rojo en Principal. Cerrar la app, abrirla con red: se envía sola. No debe decir "sincronizado" antes.
4. **Respuesta perdida**: (difícil de forzar) cortar la red justo al guardar y reintentar: no debe duplicar.
5. **Cambio de mes**: Principal → elegir mes anterior y volver: los datos no cambian; Control y Cierre siguen el mes elegido.
6. **PDF**: importar dos veces el mismo resumen con Zapia → el total de la tarjeta no cambia (misma `id_unico`).
7. **Auto**: categorizar un gasto como Mantenimiento desde Gastos → aparece una vez en Auto; combustible y peajes coinciden con Gastos del mismo mes.
8. **Conciliación**: domingo con saldo igual al esperado (diferencia 0), uno con menos (hormiga) y uno con más (sobrante).
9. **Depósito de fin de mes**: cargarlo el último día y declarar el saldo: la diferencia no debe inflarse.
10. **Ocultar importes**: 👁️ en Principal → todos los importes de las 3 pantallas y gráficos se ocultan; se mantiene al reabrir.
