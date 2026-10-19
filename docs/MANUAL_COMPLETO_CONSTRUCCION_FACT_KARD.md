# MANUAL COMPLETO DE CONSTRUCCIÓN — FACT-KARD

## 0. Propósito de este manual

Este documento explica cómo construir FACT-KARD desde cero hasta el piloto final.

FACT-KARD será un sistema web multiempresa para ASESCON cuyo objetivo es convertir comprobantes y operaciones internas en movimientos de inventario correctamente valorizados, calcular CPP, generar Kardex valorizado, controlar incidencias, cerrar períodos y producir salidas en Excel y Formato 13.1.

Este manual usa como base el diseño consolidado del proyecto y el ERD v5.1.

---

# 1. Alcance de la V1

La V1 incluye:

- Multiempresa.
- Usuarios y permisos.
- Tabla única TERCERO para clientes y proveedores.
- Productos.
- Unidades de medida.
- Conversión de unidades.
- Establecimientos.
- Almacenes.
- Períodos.
- Configuración de IGV por período.
- Monedas y tipo de cambio.
- Registro manual de comprobantes.
- Saldo inicial.
- Compras.
- Ventas.
- Devoluciones de venta.
- Devoluciones de compra.
- Notas de crédito de compra.
- Notas de débito.
- Bonificaciones.
- Mermas.
- Desmedros.
- Consumo interno.
- Retiros.
- Ajustes.
- Transferencias.
- CPP.
- Kardex valorizado.
- Recalculo cronológico.
- Incidencias.
- Cierre y reapertura de períodos.
- Excel.
- XML.
- Homologación de productos.
- OCR básico.
- Formato 13.1.
- Auditoría.
- Piloto paralelo.

Fuera de V1:

- ERP completo.
- SIRE automático.
- Importación masiva de Excel.
- IA avanzada.
- Homologación automática sin revisión humana.
- Microservicios.

---

# 2. Reglas contables y funcionales principales

## 2.1 CPP

El CPP oficial se calcula por:

```text
EMPRESA + PRODUCTO
```

No por almacén.

## 2.2 Stock físico

El stock se controla por:

```text
EMPRESA + ALMACEN + PRODUCTO
```

## 2.3 Compras

Generan entrada.

Costo:

```text
valor de adquisición
+
IGV no recuperable
```

## 2.4 Ventas

Generan salida al CPP vigente en PEN.

Aunque el comprobante de venta esté en USD, el Kardex sale valorizado en PEN.

## 2.5 Bonificaciones

```text
cantidad entra
costo = 0
```

## 2.6 Devolución de venta

Reingresa al costo histórico de la salida original.

## 2.7 Devolución de compra

Sale al costo original de la compra.

## 2.8 Nota de crédito de compra por descuento

```text
cantidad = no cambia
valor = disminuye
CPP = recalcula
```

## 2.9 Nota de crédito de venta sin devolución física

```text
NO afecta Kardex
```

## 2.10 Nota de débito de compra

```text
cantidad = no cambia
valor = aumenta
CPP = recalcula
```

## 2.11 Tipo de cambio

Para compras USD:

```text
TC Venta SBS
fecha de emisión
```

Si la fecha cae en fin de semana o feriado:

```text
último TC publicado
```

Guardar:

```text
fecha_tc
monto_tc
fuente_tc
```

## 2.12 Stock negativo

No permitido.

## 2.13 Precisión

Base de datos:

```text
NUMERIC(20,8)
```

Cálculo:

```text
6 decimales
```

Usar:

```text
Decimal
ROUND_HALF_UP
```

Nunca `float`.

## 2.14 Orden del mismo día

Orden propuesto:

```text
1. SALDO_INICIAL
2. ENTRADAS
3. AJUSTES_VALOR
4. SALIDAS
5. SECUENCIA
6. ID
```

La regla de entradas antes que salidas debe validarse con casos reales.

---

# 3. Pendientes de Fase 0

Antes de congelar completamente la lógica de valorización deben validarse con el contador:

1. Formato 13.1 por establecimiento con CPP global.
2. Fórmula de reparto de ND/NC cuando el período origen está cerrado.
3. Tipo de cambio aplicable a ND/NC en USD.

Estos puntos no impiden empezar las fases técnicas estables.

---

# 4. Stack tecnológico

## Backend

```text
Python
Django
Django REST Framework
```

## Frontend

```text
React
TypeScript
Vite
```

## Base de datos

```text
PostgreSQL
```

## Procesamiento asíncrono

```text
Celery
```

Solo si el recálculo de una empresa + producto durante un año supera 2 segundos.

## Archivos

Desarrollo:

```text
local
```

Producción:

```text
S3 o MinIO
```

---

# 5. Estructura recomendada de repositorios

```text
FACT-KARD/
│
├── backend/
│   ├── manage.py
│   ├── config/
│   ├── apps/
│   │   ├── accounts/
│   │   ├── companies/
│   │   ├── catalogs/
│   │   ├── inventory/
│   │   ├── documents/
│   │   ├── kardex/
│   │   ├── audit/
│   │   └── reports/
│   ├── requirements.txt
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── utils/
│   ├── package.json
│   └── .env
│
├── docs/
│   ├── erd/
│   ├── casos-contador/
│   └── arquitectura/
│
└── README.md
```

---

# 6. Preparación del entorno

## 6.1 PostgreSQL

Crear base de datos:

```sql
CREATE DATABASE fact_kard;
```

Crear usuario:

```sql
CREATE USER fact_kard_user WITH PASSWORD 'cambiar_esto';
GRANT ALL PRIVILEGES ON DATABASE fact_kard TO fact_kard_user;
```

## 6.2 Backend Django

En PowerShell:

```powershell
mkdir FACT-KARD
cd FACT-KARD

python -m venv .venv
.\.venv\Scripts\Activate.ps1

pip install django djangorestframework psycopg[binary] python-decouple django-cors-headers
django-admin startproject config backend
cd backend
```

Crear apps:

```powershell
python manage.py startapp accounts
python manage.py startapp companies
python manage.py startapp catalogs
python manage.py startapp inventory
python manage.py startapp documents
python manage.py startapp kardex
python manage.py startapp audit
python manage.py startapp reports
```

## 6.3 Frontend

Desde la raíz:

```powershell
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install axios react-router-dom
```

---

# 7. Variables de entorno

Backend `.env`:

```text
DEBUG=True
SECRET_KEY=cambiar
DB_NAME=fact_kard
DB_USER=fact_kard_user
DB_PASSWORD=cambiar_esto
DB_HOST=localhost
DB_PORT=5432
```

Frontend `.env`:

```text
VITE_API_URL=http://localhost:8000/api
```

---

# 8. Módulo Seguridad y Multiempresa

## Entidades

- EMPRESA
- CONFIG_EMPRESA
- USUARIO
- USUARIO_EMPRESA
- AUDITORIA

## Reglas

Roles V1:

```text
ADMIN
USUARIO
```

`es_admin_global` puede utilizarse para un administrador general de ASESCON.

`USUARIO_EMPRESA.rol` controla el rol dentro de una empresa concreta.

## Permisos

ADMIN:

- CRUD de maestros.
- ajustes manuales.
- extornos.
- cierre.
- reapertura.
- resolución de incidencias críticas.

USUARIO:

- compras.
- ventas.
- notas internas sin ajuste manual.
- revisión.
- confirmación de operaciones permitidas.
- consulta y exportación.

---

# 9. Módulo Maestros

## TERCERO

Tabla única para cliente/proveedor.

Restricción:

```text
UNIQUE(
    empresa_id,
    tipo_documento,
    numero_documento
)
```

Debe cumplirse:

```text
es_cliente = true
OR
es_proveedor = true
```

## PRODUCTO

Restricción:

```text
UNIQUE(
    empresa_id,
    codigo_interno
)
```

## PRODUCTO_UNIDAD

Cada producto debe tener exactamente una unidad base.

Ejemplo:

```text
UND = 1
PACK = 6
CAJA = 24
```

## ESTABLECIMIENTO

Representa establecimiento/anexo.

## ALMACEN

Cada almacén pertenece a un establecimiento.

Restricción:

```text
UNIQUE(
    empresa_id,
    codigo
)
```

---

# 10. Catálogos

Crear:

- MONEDA
- TIPO_CAMBIO
- TIPO_COMPROBANTE
- TIPO_OPERACION
- TIPO_EXISTENCIA
- UNIDAD_MEDIDA

`TIPO_COMPROBANTE.codigo_sunat` y `TIPO_OPERACION.codigo_sunat` deben existir desde el inicio.

---

# 11. Períodos

Estados:

```text
ABIERTO
CERRADO
DESACTUALIZADO
```

Reglas:

- No cerrar período si el anterior está ABIERTO.
- No cerrar período si el anterior está DESACTUALIZADO.
- Reapertura solo ADMIN.
- Reapertura requiere motivo.
- Reabrir N y modificarlo marca N+1... como DESACTUALIZADOS.

---

# 12. Configuración IGV

Tabla:

```text
CONFIG_IGV_PERIODO
```

Campos importantes:

```text
metodo
porcentaje_recuperable
```

Métodos:

```text
TOTAL
NULO
PRORRATA
```

El porcentaje aplicado debe copiarse a DOCUMENTO_DETALLE para conservar historia.

---

# 13. Registro manual de documentos

## DOCUMENTO

Debe contener:

```text
empresa
tercero
ruc_emisor
tipo comprobante
serie
numero
fecha
moneda
TC
periodo propio
documento origen
estado
estado revision
```

Clave lógica de duplicado:

```text
empresa
+
ruc_emisor
+
tipo comprobante
+
serie normalizada
+
numero normalizado
```

## DOCUMENTO_DETALLE

Cada línea contiene:

```text
producto
unidad
almacen
tipo operación
cantidad original
cantidad base
factor
precio
IGV
% crédito fiscal
costo PEN
bonificación
detalle origen
```

---

# 14. Estados del documento

Estado documental:

```text
BORRADOR
CONFIRMADO
ANULADO
```

Estado de revisión:

```text
PENDIENTE
EN_REVISION
REVISADO
OBSERVADO
```

No mezclar ambos conceptos.

---

# 15. Saldo inicial

Tabla:

```text
SALDO_INICIAL
```

Restricción:

```text
UNIQUE(
    empresa,
    periodo,
    almacen,
    producto
)
```

Al confirmar:

```text
SALDO_INICIAL
↓
MOVIMIENTO tipo SALDO_INICIAL
```

El motor solo trabaja con MOVIMIENTO.

---

# 16. Nota interna

Tablas:

```text
NOTA_INTERNA
NOTA_INTERNA_DETALLE
```

Usos:

- Merma.
- Desmedro.
- Consumo interno.
- Retiro.
- Ajuste.

---

# 17. Transferencias

Tablas:

```text
TRANSFERENCIA
TRANSFERENCIA_DETALLE
```

Una transferencia puede mover múltiples productos.

Al confirmar cada detalle:

```text
SALIDA almacén origen
+
ENTRADA almacén destino
```

Dentro de una sola transacción.

```python
transaction.atomic()
```

Si falla uno:

```text
ROLLBACK
```

---

# 18. Regla estructural central

FACT-KARD separa:

```text
MOVIMIENTO
=
HECHO

VALORIZACION_MOVIMIENTO
=
CALCULO
```

MOVIMIENTO es inmutable.

VALORIZACION_MOVIMIENTO puede cambiar mediante recálculo.

---

# 19. MOVIMIENTO

Campos conceptuales:

```text
empresa
producto
almacen
periodo

documento_detalle
nota_interna_detalle
transferencia_detalle
transferencia
saldo_inicial

movimiento_origen
movimiento_extornado

tipo_operacion
fecha_movimiento
prioridad_dia
secuencia
naturaleza
cantidad_base
valor_ajuste_pen

es_extorno
generado_por_motor

creado_por
creado_en
```

No utilizar un CHECK universal que obligue a exactamente un origen.

Las reglas dependen de `TIPO_OPERACION.origen_requerido`.

---

# 20. MOVIMIENTO inmutable

Después de confirmar:

```text
NO UPDATE
NO DELETE
```

Correcciones:

```text
EXTORNO
+
NUEVO MOVIMIENTO
```

---

# 21. Ajustes automáticos del motor

Los ajustes automáticos llevan:

```text
generado_por_motor = true
```

En recálculo:

```text
extornar ajuste automático anterior
↓
recalcular
↓
generar nuevo ajuste si corresponde
```

Los ajustes manuales:

```text
generado_por_motor = false
```

y nunca se modifican automáticamente.

---

# 22. VALORIZACION_MOVIMIENTO

Debe guardar:

```text
movimiento
costo unitario
valor movimiento
saldo cantidad empresa
saldo valor empresa
CPP
versión actual
recalculo
fecha cálculo
```

Relación:

```text
MOVIMIENTO 1 ↔ 0..1 VALORIZACION_MOVIMIENTO
```

---

# 23. Caché CPP actual

Tabla:

```text
SALDO_CPP_ACTUAL
```

Restricción:

```text
UNIQUE(
    empresa_id,
    producto_id
)
```

Campos:

```text
cantidad_total
valor_total_pen
cpp_pen
ultimo_movimiento
actualizado_en
```

No es fuente de verdad.

---

# 24. Caché stock almacén

Tabla:

```text
STOCK_ALMACEN
```

Restricción:

```text
UNIQUE(
    empresa_id,
    almacen_id,
    producto_id
)
```

Debe poder reconstruirse desde MOVIMIENTO.

---

# 25. Concurrencia

Durante:

```text
confirmar
recalcular
ajustar
transferir
```

bloquear:

```text
empresa + producto
```

Ejemplo Django:

```python
with transaction.atomic():
    saldo = (
        SaldoCppActual.objects
        .select_for_update()
        .get(empresa=empresa, producto=producto)
    )
```

Esto evita dos confirmaciones simultáneas calculando desde el mismo saldo.

---

# 26. Cálculo del CPP

Ejemplo:

```text
Saldo:
100 u
S/ 1,000

Compra:
50 u
S/ 700

Nuevo saldo:
150 u
S/ 1,700

CPP:
1,700 / 150
= S/ 11.333333
```

---

# 27. Salidas

Valor salida:

```text
cantidad × CPP vigente
```

Después:

```text
saldo cantidad -= cantidad
saldo valor -= valor salida
```

---

# 28. Saldo valorizado

Siempre acumular:

```text
saldo valor nuevo
=
saldo anterior
+
entrada
-
salida
```

No reconstruir continuamente:

```text
cantidad × CPP redondeado
```

---

# 29. Recálculo cronológico

Tablas:

```text
RECALCULO
RECALCULO_DETALLE
```

Cuando aparece un documento atrasado:

```text
fecha afectada
↓
empresa + producto
↓
recalcular todos los movimientos posteriores
```

Debe recalcular:

- CPP.
- valores.
- devoluciones.
- residuos.
- stock posterior.

---

# 30. Revalidación de stock

Todo recálculo debe volver a verificar las salidas posteriores.

Si una queda negativa:

```text
STOCK_INSUFICIENTE
```

Mostrar:

```text
fecha
movimiento
producto
cantidad faltante
```

---

# 31. Incidencias

Tabla:

```text
INCIDENCIA
```

Debe poder vincular:

```text
documento
documento_detalle
movimiento
producto
periodo
```

Principales:

```text
STOCK_INSUFICIENTE
PRODUCTO_SIN_HOMOLOGAR
UNIDAD_SIN_CONVERSION
MOVIMIENTO_SIN_COSTO
DOCUMENTO_USD_SIN_TIPO_CAMBIO
DOCUMENTO_DUPLICADO
DOCUMENTO_PENDIENTE_REVISION
NOTA_SIN_DOCUMENTO_ORIGEN
NOTA_EXCEDE_OPERACION_ORIGINAL
NOTA_EXCEDE_VALOR_INVENTARIO
DOCUMENTO_ANULADO_CON_MOVIMIENTO
ERROR_CALCULO_KARDEX
PERIODO_ANTERIOR_ABIERTO
RESIDUO_VALORIZACION
VALOR_INVENTARIO_NEGATIVO
```

---

# 32. Residuos

Tolerancia inicial:

```text
S/ 0.05
```

Configurable en CONFIG_EMPRESA.

Si:

```text
cantidad = 0
|valor residual| <= tolerancia
```

generar:

```text
AJUSTE_VALOR automático
```

Si supera tolerancia:

```text
INCIDENCIA_RESIDUO_VALORIZACION
```

Bloquea cierre.

---

# 33. Anulación

Período abierto:

```text
documento confirmado
↓
extorno
↓
ANULADO
```

Período cerrado:

```text
incidencia
↓
regularización o reapertura autorizada
```

---

# 34. Cierre

Tablas:

```text
CIERRE_PERIODO
CIERRE_PERIODO_DETALLE
```

Guardar:

```text
version_calculo
cerrado_por
cerrado_en
archivo_excel
hash_resultado
snapshot_resumen
```

No cerrar si existen incidencias bloqueantes.

---

# 35. Reapertura

Solo ADMIN.

Debe:

```text
mostrar advertencia
pedir motivo
guardar auditoría
```

Después de modificación:

```text
períodos posteriores cerrados
→ DESACTUALIZADOS
```

---

# 36. Auditoría

Tabla solo inserción:

```text
AUDITORIA
```

Registrar:

- extornos.
- ajustes.
- cierres.
- reaperturas.
- homologaciones.
- recálculos.
- cambios de configuración.
- anulaciones.

---

# 37. XML

Después de validar el motor.

Flujo:

```text
XML
↓
DOCUMENTO_CAPTURA
↓
extraer datos
↓
BORRADOR
↓
REVISIÓN
↓
CONFIRMACIÓN
```

Nunca confirmar automáticamente.

---

# 38. DOCUMENTO_CAPTURA

Guardar:

```text
archivo
tipo
hash
estado proceso
usuario
documento asociado
```

---

# 39. CAPTURA_CAMPO

Debe soportar cabecera y líneas.

Campos:

```text
seccion
numero_linea
nombre_campo
valor_extraido
confianza
valor_corregido
corregido_por
```

Ejemplo:

```text
CABECERA | NULL | ruc
DETALLE  | 1    | descripcion
DETALLE  | 1    | cantidad
DETALLE  | 2    | descripcion
```

---

# 40. OCR básico

Debe extraer:

- RUC.
- tipo de comprobante.
- serie.
- número.
- fecha.
- moneda.
- líneas.
- descripción.
- cantidad.
- precio.

Resultado:

```text
BORRADOR
```

Nunca:

- confirma.
- mueve stock.
- homologa automáticamente.

Regla para piloto:

```text
si revisar OCR
tarda más que digitar manualmente
→ OCR no pasa al piloto
```

---

# 41. Homologación

Tabla:

```text
PRODUCTO_EQUIVALENCIA
```

Clave conceptual:

```text
tercero proveedor
+
codigo externo
+
unidad externa
```

→ producto/unidad interna.

La primera vez:

```text
usuario confirma
```

Después:

```text
sistema propone
```

---

# 42. Kardex

Mostrar:

```text
fecha
documento
tipo operación

entrada cantidad
entrada costo
entrada valor

salida cantidad
salida costo
salida valor

saldo cantidad
CPP
saldo valor
```

Filtros:

- empresa.
- producto.
- período.
- almacén.
- tipo de operación.

---

# 43. Excel

Debe existir temprano.

Exportar:

- Kardex.
- movimientos.
- incidencias.
- resumen.

También sirve como snapshot de cierre.

---

# 44. Formato 13.1

Estructura preparada desde el ERD:

- período.
- empresa.
- establecimiento.
- producto.
- tipo de existencia.
- unidad.
- método de valuación.
- documento.
- tipo de operación.
- entradas.
- salidas.
- saldo.

Regla por establecimiento todavía pendiente de validación final.

---

# 45. Tests automáticos

Los tests comienzan junto con el motor.

## M1

```text
test_compra_basica
test_venta_cpp
```

## M2

```text
test_documento_atrasado
test_recalculo
test_stock_negativo_posterior
```

## M3

```text
test_devolucion_venta
test_devolucion_compra
test_nc_compra
test_nd_compra
test_nc_venta_sin_devolucion
test_anulacion
```

## M4

```text
test_merma
test_desmedro
test_ajuste
```

## M5

```text
test_transferencia
```

## M6

```text
test_residuo
test_valor_negativo
test_bloqueo_cierre
```

---

# 46. Orden de construcción real

## FASE 0

- cerrar 3 reglas pendientes.
- obtener 10–15 casos reales.
- medir tiempo manual actual.

## FASE 1

- ERD definitivo.

## FASE 2

- Django.
- PostgreSQL.
- React.
- multiempresa.
- auditoría.
- infraestructura base.

## FASE 3

- usuarios.
- empresas.
- permisos.

## FASE 4

- terceros.
- productos.
- unidades.
- establecimientos.
- almacenes.
- catálogos.

## FASE 5

- períodos.
- IGV.
- moneda.
- tipo de cambio.

## FASE 6

- saldo inicial.
- documentos manuales.
- notas internas.

## FASE 7 — MOTOR

### M1
Compra + venta + CPP.

### M2
Atrasados + recálculo.

### M3
Devoluciones + NC + ND + anulación.

### M4
Movimientos internos.

### M5
Transferencias.

### M6
Incidencias + residuos + bloqueo de cierre.

## FASE 8

- Kardex.
- Excel.

## FASE 9

- cierre.
- reapertura.
- DESACTUALIZADO.
- snapshot.
- hash.

## FASE 10

- prepiloto manual.

## FASE 11

- XML.
- homologación.

## FASE 12

- PDF.
- escáner.
- OCR básico.

## FASE 13

- Formato 13.1.

## FASE 14

- piloto paralelo.

---

# 47. Criterio de terminado por fase

Cada fase termina con evidencia.

Ejemplos:

```text
Fase 3:
usuario de Empresa A
NO puede ver Empresa B

Fase 6:
se puede registrar compra y venta manual

M1:
casos compra/venta pasan tests

Fase 8:
Excel = Kardex mostrado

Fase 10:
prepiloto coincide con Kardex del contador

Fase 12:
revisar OCR tarda menos que digitar manualmente

Fase 14:
FACT-KARD coincide con proceso real
```

---

# 48. Infraestructura

Entornos separados:

```text
DESARROLLO
PRUEBAS
PRODUCCION
```

Debe existir:

- HTTPS.
- backups PostgreSQL.
- restauración probada.
- logs.
- variables de entorno.
- manejo de archivos.
- monitoreo básico.

---

# 49. Backup

Programar copia automática de PostgreSQL.

Ejemplo:

```powershell
pg_dump -Fc fact_kard > fact_kard.backup
```

Debe probarse restauración:

```powershell
pg_restore -d fact_kard_restore fact_kard.backup
```

Un backup que nunca fue restaurado no debe considerarse confiable.

---

# 50. Rendimiento

Medir recálculo con:

```text
100 movimientos
1,000 movimientos
10,000 movimientos
```

Si:

```text
empresa + producto + 1 año
> 2 segundos
```

mover recálculo a Celery.

---

# 51. Piloto

FACT-KARD y el método actual deben correr en paralelo durante uno o dos períodos.

Comparar:

- cantidades.
- CPP.
- valor.
- saldos.
- incidencias.
- tiempo.

No apagar el proceso anterior hasta terminar la validación.

---

# 52. Métrica de mejora

Antes del piloto medir:

```text
tiempo manual por comprobante
```

Después:

```text
tiempo FACT-KARD
```

Fórmula:

```text
reducción %
=
(tiempo_manual - tiempo_factkard)
/
tiempo_manual
× 100
```

---

# 53. Qué construir primero

No crear todas las tablas del mapa completo de una sola vez.

## Migración 1

```text
EMPRESA
CONFIG_EMPRESA
USUARIO
USUARIO_EMPRESA
AUDITORIA
```

## Migración 2

```text
TERCERO
PRODUCTO
UNIDAD_MEDIDA
PRODUCTO_UNIDAD
ESTABLECIMIENTO
ALMACEN
TIPO_EXISTENCIA
TIPO_COMPROBANTE
TIPO_OPERACION
```

## Migración 3

```text
MONEDA
TIPO_CAMBIO
PERIODO
CONFIG_IGV_PERIODO
```

## Migración 4

```text
SALDO_INICIAL
DOCUMENTO
DOCUMENTO_DETALLE
NOTA_INTERNA
NOTA_INTERNA_DETALLE
```

## Migración 5

```text
MOVIMIENTO
VALORIZACION_MOVIMIENTO
SALDO_CPP_ACTUAL
STOCK_ALMACEN
RECALCULO
RECALCULO_DETALLE
INCIDENCIA
TRANSFERENCIA
TRANSFERENCIA_DETALLE
```

## Migración 6

```text
CIERRE_PERIODO
CIERRE_PERIODO_DETALLE
```

## Migración 7

```text
PRODUCTO_EQUIVALENCIA
DOCUMENTO_CAPTURA
CAPTURA_CAMPO
```

---

# 54. Próximo paso

El próximo paso técnico recomendado es:

```text
ERD v5.1 validado
↓
MODELOS DJANGO DE FASES 2 A 5
↓
MIGRACIONES
↓
TESTS DE INTEGRIDAD
```

No programar todavía el motor completo hasta tener los casos reales del contador.

Pero sí se puede empezar inmediatamente con:

- multiempresa;
- usuarios;
- terceros;
- productos;
- unidades;
- establecimientos;
- almacenes;
- catálogos;
- períodos;
- IGV;
- monedas;
- tipo de cambio.

---

# 55. Resultado esperado de la V1

Al terminar la V1:

```text
Comprobante
↓
Manual / XML / OCR
↓
Borrador
↓
Revisión
↓
Confirmación
↓
Movimiento
↓
Valorización
↓
CPP
↓
Kardex
↓
Incidencias
↓
Cierre
↓
Excel / Formato 13.1
```

El sistema debe demostrar:

- cantidades correctas;
- CPP correcto;
- valorización correcta;
- saldos correctos;
- trazabilidad;
- aislamiento multiempresa;
- menor trabajo manual;
- menor tiempo;
- coincidencia con el Kardex validado por ASESCON.
