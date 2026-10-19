# FACT-KARD — CONTEXTO COMPLETO DEL SISTEMA

## 1. Propósito

Este archivo no es un manual de instalación ni una guía de programación. Su función es concentrar el contexto funcional, contable y arquitectónico necesario para que cualquier agente, compañero o desarrollador entienda qué se quiere construir, qué reglas ya están decididas, qué partes siguen pendientes y cómo debe evolucionar el sistema.

FACT-KARD será un sistema web multiempresa para ASESCON orientado a reducir el trabajo manual necesario para transformar comprobantes y operaciones internas en movimientos de inventario correctamente valorizados, calcular CPP, generar Kardex valorizado, controlar incidencias, cerrar períodos y preparar salidas en Excel y Formato 13.1.

## 2. Alcance de la V1

La V1 contempla multiempresa, usuarios y permisos, auditoría, terceros, productos, unidades, establecimientos, almacenes, períodos, IGV, monedas, tipo de cambio, registro manual de comprobantes, saldo inicial, compras, ventas, devoluciones, notas de crédito y débito, bonificaciones, mermas, desmedros, consumo interno, retiros, ajustes, transferencias, CPP móvil, Kardex valorizado, recálculo cronológico, incidencias, cierre y reapertura, Excel, XML, homologación, OCR básico, Formato 13.1 y piloto paralelo.

Fuera de V1 quedan ERP completo, SIRE automático, importación masiva de Excel, IA avanzada, homologación totalmente automática y microservicios.

## 3. Flujo general

Comprobante u operación → captura o registro → validación → revisión humana → confirmación → movimiento → valorización → CPP → Kardex → incidencias/cierre → Excel/Formato 13.1.

XML, PDF, imagen, escáner y registro manual son formas de captura, no tipos distintos de comprobante.

## 4. Documentos y operaciones

Documentos comerciales:
- Factura.
- Boleta.
- Nota de crédito.
- Nota de débito.

Otros orígenes:
- SALDO_INICIAL.
- NOTA_INTERNA.
- TRANSFERENCIA.

NOTA_INTERNA cubre merma, desmedro, consumo interno, retiro y ajuste.

TRANSFERENCIA maneja traslados entre almacenes y puede contener varios productos.

## 5. Reglas principales de inventario

CPP oficial: EMPRESA + PRODUCTO.

Stock físico: EMPRESA + ALMACÉN + PRODUCTO.

Compras: generan entrada. El costo incluye valor de adquisición más IGV no recuperable.

Ventas: generan salida al CPP vigente en PEN. El precio de venta no se usa como costo de salida.

Bonificaciones: ingresan cantidad con costo cero.

Devolución de venta: reingresa al costo histórico de la salida original.

Devolución de compra: sale al costo histórico de la compra original.

NC de compra por descuento: no cambia cantidad, disminuye valor y recalcula CPP.

NC de venta sin devolución física: no afecta Kardex.

ND de compra: no cambia cantidad, aumenta valor y recalcula CPP.

Stock negativo: no permitido.

## 6. Tipo de cambio e IGV

Para compras USD se usa TC venta SBS de la fecha del documento. En fin de semana o feriado se usa el último TC publicado, conservando fecha, monto y fuente aplicados.

IGV recuperable no integra costo. IGV no recuperable sí. Se soporta TOTAL, NULO y PRORRATA. El porcentaje aplicado se copia al detalle para conservar historia.

## 7. Precisión y orden cronológico

Los cálculos monetarios usan precisión decimal, no float.

Base: hasta 8 decimales. Cálculo operativo inicial: 6 decimales.

Orden propuesto del mismo día:
1. Saldo inicial.
2. Entradas.
3. Ajustes de valor.
4. Salidas.
5. Secuencia.
6. ID.

La regla de entradas antes que salidas debe validarse con casos reales del contador.

## 8. Multiempresa y permisos

ASESCON administra varias empresas y la información debe quedar aislada por empresa.

Roles V1:
- ADMIN.
- USUARIO.

Puede existir además un administrador global de ASESCON.

ADMIN realiza acciones sensibles como ajustes manuales, extornos, cierres, reaperturas y resolución de incidencias críticas.

USUARIO registra y revisa documentos, confirma operaciones permitidas, consulta Kardex y exportaciones autorizadas.

## 9. Terceros

Se usa una sola tabla TERCERO.

Un tercero puede ser cliente, proveedor o ambos.

Unicidad: empresa + tipo_documento + numero_documento.

El RUC es un tipo de documento más.

## 10. Productos, unidades y homologación

Cada producto pertenece a una empresa y tiene código interno único por empresa.

PRODUCTO_UNIDAD permite varias presentaciones del mismo producto. Cada producto debe tener exactamente una unidad base.

PRODUCTO_EQUIVALENCIA relaciona códigos/unidades del proveedor con el producto/unidad internos. La primera homologación debe ser confirmada por una persona. El sistema puede sugerir, pero no confirmar automáticamente.

## 11. Establecimientos y almacenes

Una empresa puede tener varios establecimientos y cada establecimiento varios almacenes.

El almacén controla stock físico.

El establecimiento se usa para la presentación por establecimiento del Formato 13.1.

Debe existir un establecimiento principal configurable para resolver diferencias de redondeo si el contador aprueba esa regla.

## 12. Períodos

Estados:
- ABIERTO.
- CERRADO.
- DESACTUALIZADO.

Un período cerrado solo se reabre con autorización, motivo y auditoría.

Si se modifica un período reabierto, los períodos posteriores cerrados pueden pasar a DESACTUALIZADO.

No se cierra un período si el anterior está ABIERTO o DESACTUALIZADO.

## 13. Documentos y revisión

DOCUMENTO representa el comprobante comercial.

Estados documentales:
- BORRADOR.
- CONFIRMADO.
- ANULADO.

Estado de revisión:
- PENDIENTE.
- EN_REVISION.
- REVISADO.
- OBSERVADO.

Duplicado lógico: empresa + ruc_emisor + tipo_comprobante + serie_normalizada + numero_normalizado.

El RUC del emisor se guarda directamente en DOCUMENTO. En una venta, el emisor es la propia empresa, no el cliente.

## 14. Documento detalle

Cada línea conserva producto, unidad, almacén, tipo de operación, descripción original, cantidad original, factor de conversión, cantidad base, precio, IGV, porcentaje de crédito fiscal aplicado, costo PEN, indicador de bonificación, detalle origen y resultado histórico de si afecta Kardex.

Esto permite que una NC/ND pueda referenciar una línea concreta.

## 15. Los cuatro orígenes de MOVIMIENTO

1. DOCUMENTO_DETALLE: compras, ventas, notas y devoluciones.
2. NOTA_INTERNA_DETALLE: mermas, desmedros, consumos, retiros y ajustes.
3. TRANSFERENCIA_DETALLE: traslados entre almacenes.
4. SALDO_INICIAL: inventario de arranque.

Todos convergen en MOVIMIENTO.

## 16. MOVIMIENTO y VALORIZACION_MOVIMIENTO

MOVIMIENTO representa el hecho histórico del inventario y, una vez confirmado, no se modifica ni elimina.

VALORIZACION_MOVIMIENTO representa el resultado calculado y sí puede cambiar cuando se recalcula la historia.

MOVIMIENTO conserva referencias separadas para:
- movimiento_origen_id: devoluciones.
- movimiento_extornado_id: extornos.

## 17. Ajustes de valor

Los ajustes de valor tienen cantidad cero y su importe se guarda en MOVIMIENTO.

Los ajustes automáticos del motor se marcan como generados_por_motor. Si un recálculo cambia el residuo, el motor no los edita: los extorna y genera uno nuevo si corresponde.

Los ajustes manuales del ADMIN no se modifican automáticamente.

## 18. Recálculo cronológico

Cuando entra un documento atrasado en período abierto:
- se inserta en su posición cronológica;
- se recalcula solo empresa + producto;
- se recalcula desde la fecha afectada hacia adelante;
- se revalidan CPP, valores, devoluciones, residuos y stock posterior.

RECALCULO registra cada ejecución y RECALCULO_DETALLE conserva los valores anteriores y nuevos que cambiaron.

## 19. Concurrencia y rendimiento

Durante confirmaciones, recálculos, ajustes y transferencias se protege empresa + producto para impedir cálculos simultáneos sobre el mismo saldo.

SALDO_CPP_ACTUAL puede servir como punto de bloqueo y caché del CPP.

Si recalcular empresa + producto durante un año tarda más de 2 segundos, el proceso debe pasar a segundo plano.

## 20. Cachés

STOCK_ALMACEN: caché del stock actual por empresa + almacén + producto. Reconstruible desde MOVIMIENTO.

SALDO_CPP_ACTUAL: caché del saldo global por empresa + producto. Conserva cantidad total, valor total, CPP, último movimiento y fecha de actualización.

Ninguna de las dos es fuente de verdad.

## 21. Incidencias

INCIDENCIA puede vincularse a empresa, período, documento, detalle de documento, movimiento y producto.

Ejemplos:
- STOCK_INSUFICIENTE.
- PRODUCTO_SIN_HOMOLOGAR.
- UNIDAD_SIN_CONVERSION.
- MOVIMIENTO_SIN_COSTO.
- DOCUMENTO_USD_SIN_TIPO_CAMBIO.
- DOCUMENTO_DUPLICADO.
- DOCUMENTO_PENDIENTE_REVISION.
- NOTA_SIN_DOCUMENTO_ORIGEN.
- NOTA_EXCEDE_OPERACION_ORIGINAL.
- NOTA_EXCEDE_VALOR_INVENTARIO.
- DOCUMENTO_ANULADO_CON_MOVIMIENTO.
- ERROR_CALCULO_KARDEX.
- PERIODO_ANTERIOR_ABIERTO.
- RESIDUO_VALORIZACION.
- VALOR_INVENTARIO_NEGATIVO.

Las críticas bloquean cierre.

## 22. Residuo de valorización

Tolerancia configurable, propuesta inicialmente en S/ 0.05.

Si cantidad = 0 y el residuo está dentro de tolerancia, se genera AJUSTE_VALOR automático.

Si supera tolerancia, se genera incidencia y el período no puede cerrarse hasta revisar el caso.

## 23. Transferencias

Una transferencia puede mover varios productos.

Cada detalle genera una salida en almacén origen y una entrada en almacén destino.

Ambos movimientos pertenecen a la misma transferencia y deben confirmarse de forma atómica.

La transferencia no cambia el CPP global de la empresa.

## 24. Anulación y extorno

En período abierto, anular un documento confirmado genera extorno y el documento pasa a ANULADO.

En período cerrado no se modifica retroactivamente de forma directa: se genera incidencia y se decide entre regularización o reapertura autorizada.

## 25. Cierre y reapertura

CIERRE_PERIODO conserva la versión oficial.

Debe guardar versión de cálculo, usuario/fecha, archivo Excel, hash y resumen del cierre.

CIERRE_PERIODO_DETALLE conserva saldos por producto y establecimiento.

Al reabrir un período debe advertirse que períodos posteriores pueden haber sido ya presentados. Debe poder compararse lo originalmente cerrado/presentado contra lo recalculado.

## 26. Auditoría

AUDITORIA es transversal y solo recibe registros nuevos.

Debe registrar anulaciones, extornos, ajustes, cierres, reaperturas, homologaciones, recálculos y cambios de configuración.

## 27. XML, PDF y OCR

DOCUMENTO_CAPTURA conserva archivo original, tipo, hash, estado del procesamiento y usuario.

CAPTURA_CAMPO distingue CABECERA o DETALLE, número de línea, nombre de campo, valor extraído, confianza, valor corregido y usuario que corrigió.

El OCR básico solo genera BORRADOR. Nunca confirma, mueve stock ni homologa automáticamente.

Solo pasa al piloto si revisar el borrador tarda menos que digitar manualmente.

## 28. Kardex y Excel

El Kardex muestra fecha, documento, tipo de operación, cantidades/costos/valores de entrada y salida, saldo cantidad, CPP y saldo valorizado.

Filtros: empresa, producto, período, almacén y tipo de operación.

Excel sirve para comparar resultados, auditar, entregar reportes y conservar snapshot de cierre.

## 29. Formato 13.1

Debe quedar preparado para período, empresa, establecimiento, producto, tipo de existencia, unidad, método de valuación, documento, tipo de operación, entradas, salidas y saldo.

La regla final por establecimiento sigue pendiente de validación contable.

## 30. Arquitectura de datos

La arquitectura actual se organiza en aproximadamente 32 tablas y en circuitos claros de seguridad, maestros, entrada de datos, motor, cierre e incidencias.

Las tablas de caché existen por rendimiento y concurrencia. Las tablas de captura/homologación se necesitan principalmente en XML/OCR.

## 31. Entidades principales

Seguridad y multiempresa:
- EMPRESA
- CONFIG_EMPRESA
- USUARIO
- USUARIO_EMPRESA
- AUDITORIA

Catálogos:
- MONEDA
- TIPO_CAMBIO
- TIPO_COMPROBANTE
- TIPO_OPERACION
- TIPO_EXISTENCIA
- UNIDAD_MEDIDA

Maestros:
- ESTABLECIMIENTO
- ALMACEN
- TERCERO
- PRODUCTO
- PRODUCTO_UNIDAD
- PRODUCTO_EQUIVALENCIA

Períodos y fiscal:
- PERIODO
- CONFIG_IGV_PERIODO
- CIERRE_PERIODO
- CIERRE_PERIODO_DETALLE

Documentos y operaciones:
- DOCUMENTO
- DOCUMENTO_DETALLE
- DOCUMENTO_CAPTURA
- CAPTURA_CAMPO
- NOTA_INTERNA
- NOTA_INTERNA_DETALLE
- TRANSFERENCIA
- TRANSFERENCIA_DETALLE
- SALDO_INICIAL

Motor:
- MOVIMIENTO
- VALORIZACION_MOVIMIENTO
- RECALCULO
- RECALCULO_DETALLE
- STOCK_ALMACEN
- SALDO_CPP_ACTUAL
- INCIDENCIA

## 32. Correcciones ya incorporadas al diseño

- CAPTURA_CAMPO incluye seccion y numero_linea.
- INCIDENCIA incluye documento_detalle_id opcional.
- SALDO_CPP_ACTUAL incluye actualizado_en.
- MOVIMIENTO separa devolución y extorno.
- AJUSTE_VALOR guarda su importe en MOVIMIENTO.
- TRANSFERENCIA tiene TRANSFERENCIA_DETALLE.
- SALDO_INICIAL existe como origen propio.
- Estado documental y estado de revisión están separados.
- STOCK_ALMACEN y SALDO_CPP_ACTUAL son cachés reconstruibles.
- DOCUMENTO conserva su propio período; una ND/NC consulta además el período del documento origen.

## 33. Tres decisiones contables pendientes

Antes de cerrar definitivamente la lógica del motor deben validarse con el contador mediante un caso numérico:

1. Formato 13.1 por establecimiento usando CPP global y tratamiento del redondeo.
2. Reparto exacto de una ND/NC cuando el documento origen está cerrado y parte de la mercadería ya salió.
3. Tipo de cambio para ND/NC en USD: TC del documento origen o TC de la nota.

Estas decisiones afectan lógica, no obligan a rehacer la arquitectura actual.

## 34. Orden de construcción

Fase 0: cerrar las tres reglas pendientes, obtener 10–15 casos reales y medir tiempo manual.

Fases 1–5: ERD, multiempresa, usuarios, permisos, terceros, productos, unidades, establecimientos, almacenes, catálogos, períodos, IGV, monedas y TC.

Fase 6: saldo inicial, documentos manuales y operaciones internas.

Fase 7 — Motor:
- M1 compra, venta y CPP.
- M2 atrasados y recálculo.
- M3 devoluciones, NC, ND y anulaciones.
- M4 movimientos internos.
- M5 transferencias.
- M6 incidencias, residuos y bloqueo de cierre.

Fase 8: Kardex y Excel.

Fase 9: cierre, reapertura, DESACTUALIZADO, snapshots y hash.

Fase 10: prepiloto manual.

Fases 11–12: XML, homologación y OCR básico.

Fase 13: Formato 13.1.

Fase 14: piloto paralelo.

## 35. Criterios de terminado

Cada fase termina con evidencia concreta.

Ejemplos:
- Multiempresa: Empresa A no puede ver Empresa B.
- Registro manual: compra y venta pueden registrarse y confirmarse.
- Motor: casos del contador pasan tests.
- Kardex: vista y Excel coinciden.
- Cierre: se puede cerrar, reabrir y comparar snapshots.
- OCR: revisar borrador tarda menos que digitar.
- Piloto: FACT-KARD coincide con el proceso real.

## 36. Casos reales necesarios

Se requieren entre 10 y 15 casos del contador, incluyendo compra, venta, compra USD, bonificación, devoluciones, NC, ND, merma, transferencia, documento atrasado, saldo cero, dos operaciones el mismo día, residuo y reapertura.

Cada caso debe indicar cantidad, valor y CPP esperados.

## 37. Infraestructura y operación

Separar desarrollo, pruebas y producción.

Debe existir respaldo automático de PostgreSQL, prueba real de restauración, HTTPS, logs, variables de entorno, gestión de archivos y monitoreo básico.

El recálculo se mide con volúmenes reales; si supera 2 segundos para empresa + producto + un año, pasa a procesamiento en segundo plano.

## 38. Piloto

FACT-KARD y el proceso actual deben ejecutarse en paralelo durante uno o dos períodos.

Se comparan cantidades, CPP, valores, saldos, errores y tiempo.

No se reemplaza el proceso actual hasta obtener resultados consistentes.

## 39. Métrica de mejora

Antes del piloto se mide el tiempo manual promedio por comprobante. Después se mide el tiempo con FACT-KARD.

La meta es demostrar reducción real de trabajo manual y tiempo de revisión, además de exactitud contable.

## 40. Estado actual

Ya están definidos:
- alcance V1;
- arquitectura general;
- TERCERO único;
- roles ADMIN y USUARIO;
- CPP global por empresa + producto;
- stock físico por empresa + almacén + producto;
- MOVIMIENTO inmutable;
- VALORIZACION_MOVIMIENTO recalculable;
- RECALCULO para trazabilidad;
- STOCK_ALMACEN y SALDO_CPP_ACTUAL como cachés;
- CIERRE_PERIODO como snapshot oficial;
- XML/OCR como captura que siempre genera borrador;
- tests desde el primer bloque del motor;
- construcción progresiva por fases.

Solo quedan pendientes las tres decisiones contables de Fase 0 y la validación del motor con casos reales.
