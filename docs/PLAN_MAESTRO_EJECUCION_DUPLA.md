# PLAN MAESTRO DE EJECUCIÓN EN DUPLA (FULL-STACK + IA) — FACT-KARD

## 1. Reglas de Oro del Equipo (Para no pisarnos el código)

Ambos programaremos tanto en **Backend (Django + PostgreSQL)** como en **Frontend (React + TypeScript)**[cite: 1] apoyados por agentes de IA (Antigravity / Codex). Para avanzar a máxima velocidad sin conflictos en Git, cumpliremos estas 4 reglas:

1. **Un App de Django / Una Carpeta de React por persona:** En cada bloque nos repartimos módulos distintos. Nunca editamos el mismo archivo `views.py` ni la misma carpeta de `pages/` al mismo tiempo.
2. **Ventana Única de Migración (15 minutos al iniciar cada bloque):** Nunca corremos `makemigrations` en paralelo. Al empezar un bloque, **uno solo** genera los modelos del bloque (copiando 1:1 el archivo `FACT_KARD_BD_COMPLETA_SQL.md`[cite: 2]), aplica la migración, la sube a `develop`, ambos hacen `git pull` y recién ahí nos separamos a programar.
3. **Límite WIP = 1 (Una tarea a la vez):** Nadie empieza una segunda tarjeta sin haber subido el Pull Request (PR) de la anterior y haber pasado la revisión del compañero.
4. **Ramas y Commits Estándar:**
   - Ramas principales: `main` (cerrado por fase) y `develop` (integración diaria).
   - Ramas de trabajo: `feat/modulo-tarea`, `fix/modulo-error`, `test/modulo-caso`.
   - Commits con formato *Conventional Commits*: `feat(accounts): ...`, `feat(inventory): ...`, `test(kardex): ...`.

---

## 2. Plataformas y Stack de Trabajo

- **Repositorio y Tablero Kanban:** GitHub + GitHub Projects (Columnas: `Backlog` | `Por Hacer` | `En Progreso` | `En Revisión (PR)` | `Terminado`).
- **Base de Datos Local:** PostgreSQL corriendo en Docker (`docker-compose.yml`) para tener exactamente la misma versión en ambas PCs.
- **Documentación de API en vivo:** `drf-spectacular` (Swagger en `/api/docs/`) para ver los JSON de cada endpoint sin adivinar.
- **Carpeta `/docs/` del repositorio (Fuente de verdad para humanos y agentes)[cite: 1]:**
  1. `MANUAL_COMPLETO_CONSTRUCCION_FACT_KARD.md`[cite: 1]
  2. `FACT_KARD_BD_COMPLETA_SQL.md`[cite: 2]
  3. `CONTEXTO_COMPLETO_FACT_KARD_ACTUALIZADO.md`[cite: 3]
  4. `PLAN_MAESTRO_EJECUCION_DUPLA.md` (este documento)

---

## 3. Instrucciones Obligatorias para los Agentes de IA (`AGENTS.md`)

En la raíz del repositorio crearemos el archivo `AGENTS.md` con estas reglas que nuestros agentes deben obedecer siempre:
- **Esquema SQL Inalterable:** Todo modelo de Django debe calzar exactamente con `docs/FACT_KARD_BD_COMPLETA_SQL.md` (tipos `NUMERIC(20,8)`, `CHECK`, `UNIQUE`, índices y triggers)[cite: 2].
- **Cero `float`:** Prohibido usar `float` en Python o JS para montos/cantidades[cite: 1, 3]. Usar siempre `Decimal` con `ROUND_HALF_UP` (6 decimales de cálculo, 8 en BD)[cite: 1, 3].
- **Aislamiento Multiempresa:** Todo endpoint, servicio y consulta debe filtrar obligatoriamente por `empresa_id`[cite: 2, 3].
- **Inmutabilidad:** Prohibido hacer `UPDATE` o `DELETE` en `movimiento` y `auditoria`[cite: 1, 2].
- **Concurrencia:** Todo cálculo o confirmación del Kardex debe ir dentro de `transaction.atomic()` usando `.select_for_update()` sobre `saldo_cpp_actual`[cite: 1].

---

## 4. PASO A PASO DE EJECUCIÓN (De Día 1 a Piloto Final)

### PASO 0: Setup Inicial y Gestión con el Contador (Día 1)
**Juntos en llamada (45 min):**
- [ ] **0.1.** Crear el repositorio `FACT-KARD` en GitHub con ramas `main` y `develop`[cite: 1].
- [ ] **0.2.** Crear estructura base: `backend/`, `frontend/`, `docs/`, `.gitignore`, `docker-compose.yml` (PostgreSQL) y `AGENTS.md`[cite: 1].
- [ ] **0.3.** Inicializar en `backend/` el proyecto Django con las 8 apps vacías (`accounts`, `companies`, `catalogs`, `inventory`, `documents`, `kardex`, `audit`, `reports`)[cite: 1] y `config/urls.py` apuntando a los `urls.py` de cada app.
- [ ] **0.4.** Inicializar en `frontend/` el proyecto Vite (`react-ts`) con `axios`, `react-router-dom` y carpetas base (`api/`, `components/`, `layouts/`, `pages/`, `hooks/`, `types/`, `utils/`)[cite: 1].

**En paralelo con el contador de ASESCON (Fase 0)[cite: 1, 3]:**
- [x] **0.5.** **3 reglas contables validadas (Fase 0 cerrada):** 1) Formato 13.1 por establecimiento con CPP global y asignación de redondeo a `establecimiento_principal_id` (registrado en `auditoria`); 2) NC/ND con período origen cerrado repartida proporcional según stock restante en inventario (porción vendida va directo a costo de ventas/gasto fuera de Kardex); 3) NC/ND en USD aplica obligatoriamente el TC del documento original (`documento_origen_id`)[cite: 1, 2, 3].
- [ ] **0.6.** Solicitar los **10–15 casos reales** en Excel con sus resultados esperados y medir el tiempo manual actual por comprobante[cite: 1, 3].

---

### BLOQUE 1: Seguridad, Multiempresa y Auditoría (Fases 2 y 3 — Migración 1)[cite: 1, 3]
1. **Ventana de Migración 1 (15 min):** Crear modelos y migrar `moneda`, `empresa`, `config_empresa`, `usuario`, `usuario_empresa` y `auditoria` + el trigger SQL `bloquear_modificacion_auditoria()`[cite: 1, 2].
2. **Reparto Full-Stack en paralelo:**
   - **Dev A (Apps `accounts` + `audit` | UI Auth)[cite: 1]:**
     - *Backend:* Autenticación (Login/Logout), gestión de `USUARIO`, servicio transversal de escritura en `AUDITORIA` (`valor_anterior`, `valor_nuevo`)[cite: 1, 2].
     - *Frontend:* Pantalla de Login, manejo de sesión/token y vista de tabla de Auditoría.
   - **Dev B (App `companies` | UI Empresas)[cite: 1]:**
     - *Backend:* CRUD de `EMPRESA` y `CONFIG_EMPRESA`, asignación `USUARIO_EMPRESA` (`ADMIN`/`USUARIO`) y middleware/permiso que exige `empresa_id` activo en cada petición[cite: 1, 2].
     - *Frontend:* Layout principal, Selector de Empresa activa en la barra superior y pantalla de Configuración de Empresa.
3. **✅ Evidencia para cerrar el Bloque 1:** Un usuario de `Empresa A` no puede ver ni modificar nada de `Empresa B`[cite: 1, 3]. Intentar borrar un registro en `auditoria` lanza excepción de PostgreSQL[cite: 2].

---

### BLOQUE 2: Maestros, Catálogos SUNAT y Períodos (Fases 4 y 5 — Migraciones 2 y 3)[cite: 1, 3]
1. **Ventana de Migraciones 2 y 3 (20 min):**
   - *Migración 2:* `tipo_existencia`, `unidad_medida`, `tipo_comprobante`, `tipo_operacion`, `establecimiento`, `almacen`, `tercero`, `producto`, `producto_unidad` (con el índice único parcial `uq_producto_unidad_base`)[cite: 1, 2].
   - *Migración 3:* `tipo_cambio`, `periodo`, `config_igv_periodo`[cite: 1, 2].
2. **Reparto Full-Stack en paralelo:**
   - **Dev A (App `catalogs` + Fiscal en `companies`)[cite: 1]:**
     - *Backend:* Comando `seed_catalogs` para poblar tablas SUNAT (Tablas 5, 6, 10, 12 y monedas)[cite: 1], API de `TIPO_CAMBIO` (con regla de último TC publicado si es feriado/fin de semana)[cite: 1, 3], API de `PERIODO` (reglas de orden de apertura) y `CONFIG_IGV_PERIODO` (`TOTAL`, `NULO`, `PRORRATA`)[cite: 1, 2, 3].
     - *Frontend:* Pantallas de Períodos, Configuración de IGV por período y registro/consulta de Tipos de Cambio.
   - **Dev B (App `inventory` — Maestros)[cite: 1]:**
     - *Backend:* APIs y validaciones de `TERCERO` (cliente/proveedor unificado)[cite: 1, 2, 3], `ESTABLECIMIENTO`, `ALMACEN`, `PRODUCTO` y `PRODUCTO_UNIDAD` (validando exactamente 1 unidad base por producto)[cite: 1, 2, 3].
     - *Frontend:* Pantallas CRUD de Terceros, Establecimientos/Almacenes y Productos con sus conversiones de unidades (`UND=1`, `PACK=6`, `CAJA=24`)[cite: 1].
3. **✅ Evidencia para cerrar el Bloque 2:** Catálogos SUNAT cargados, productos creados con su unidad base obligatoria y períodos configurados con su regla de IGV por empresa[cite: 1, 2, 3].

---

### BLOQUE 3: Captura Manual de Documentos y Operaciones (Fase 6 — Migración 4)[cite: 1, 3]
1. **Ventana de Migración 4 (15 min):** Crear modelos y migrar `saldo_inicial`, `documento`, `documento_detalle`, `nota_interna`, `nota_interna_detalle`[cite: 1, 2].
2. **Reparto Full-Stack en paralelo:**
   - **Dev A (App `documents` — Comprobantes Comerciales)[cite: 1]:**
     - *Backend:* API de `DOCUMENTO` y `DOCUMENTO_DETALLE` (Compras, Ventas, NC, ND)[cite: 1, 2, 3], separación de `estado` (`BORRADOR`, `CONFIRMADO`, `ANULADO`) y `estado_revision` (`PENDIENTE`, `EN_REVISION`, `REVISADO`, `OBSERVADO`)[cite: 1, 2, 3], bloqueo de duplicados lógicos y copia histórica de `monto_tc`, `factor_conversion` y `porcentaje_credito_fiscal_aplicado`[cite: 1, 2, 3].
     - *Frontend:* Formulario completo de registro manual de Compras/Ventas/Notas y bandeja de Revisión de Comprobantes.
   - **Dev B (App `inventory` — Saldo Inicial y Notas Internas)[cite: 1]:**
     - *Backend:* APIs de `SALDO_INICIAL` (unicidad por empresa+período+almacén+producto) y `NOTA_INTERNA` + `NOTA_INTERNA_DETALLE` (mermas, desmedros, consumo interno, retiros, ajustes con permisos de `ADMIN` para costos manuales)[cite: 1, 2, 3].
     - *Frontend:* Pantallas de carga de Saldo Inicial y registro de Notas Internas con subida de archivo sustento[cite: 1, 2].
3. **✅ Evidencia para cerrar el Bloque 3:** Se pueden registrar compras, ventas, saldos iniciales y mermas en estado `BORRADOR` y pasarlas a `REVISADO`[cite: 1, 3].

---

### BLOQUE 4: El Motor Kardex Valorizado (Fase 7: M1 a M6 — Migración 5)[cite: 1, 3]
*(Aquí ambos programamos en la app `kardex` alternando entre Código del Motor y Batería de Tests con los casos del contador)[cite: 1, 3].*

1. **Ventana de Migración 5 (20 min):** Migrar `transferencia`, `transferencia_detalle`, `movimiento` (+ Trigger SQL `bloquear_modificacion_movimiento()`), `recalculo`, `valorizacion_movimiento`, `recalculo_detalle`, `stock_almacen`, `saldo_cpp_actual` e `incidencia`[cite: 1, 2].
2. **Reparto por Submódulos del Motor (M1 a M6)[cite: 1, 3]:**
   - **Submódulo M1 (Compras, Ventas, Saldo Inicial y CPP)[cite: 1, 3]:**
     - *Dev A:* Programa el motor de confirmación, bloqueo `select_for_update()` en `saldo_cpp_actual`, orden del día (`prioridad_dia` 1 a 4) y cálculo de CPP y cachés[cite: 1, 2, 3].
     - *Dev B:* Programa `test_compra_basica`, `test_venta_cpp`, bonificaciones (costo 0) y compras en USD con IGV no recuperable/prorrata[cite: 1, 3].
   - **Submódulo M2 (Documentos Atrasados y Recálculo Cronológico)[cite: 1, 3]:**
     - *Dev B:* Programa el servicio de `RECALCULO` y `RECALCULO_DETALLE` (recalcular desde `fecha_desde` hacia adelante y revalidar saldos posteriores)[cite: 1, 2, 3].
     - *Dev A:* Programa `test_documento_atrasado`, `test_recalculo` y `test_stock_negativo_posterior`[cite: 1].
   - **Submódulo M3 (Devoluciones, NC, ND y Anulaciones)[cite: 1, 3]:**
     - *Dev A:* Programa devoluciones usando `movimiento_origen_id`, NC/ND de compra (`AJUSTE_VALOR`), NC de venta sin devolución (no afecta Kardex) y extornos (`movimiento_extornado_id`)[cite: 1, 2, 3].
     - *Dev B:* Programa los 6 tests de M3 (`test_devolucion_venta`, `test_devolucion_compra`, `test_nc_compra`, `test_nd_compra`, `test_nc_venta_sin_devolucion`, `test_anulacion`)[cite: 1].
   - **Submódulos M4 y M5 (Notas Internas y Transferencias)[cite: 1, 3]:**
     - *Dev B:* Programa impacto en Kardex de Notas Internas, API/Motor de `TRANSFERENCIA` (salida en origen + entrada en destino atómica sin alterar CPP global) y su pantalla en React[cite: 1, 3].
     - *Dev A:* Programa `test_merma`, `test_desmedro`, `test_ajuste` y `test_transferencia`[cite: 1].
   - **Submódulo M6 (Residuos, Incidencias y Bloqueos)[cite: 1, 3]:**
     - *Dev A:* Programa ajuste automático de residuos (`generado_por_motor = True` cuando `cantidad = 0` y residuo $\le$ S/ 0.05) y el motor detector de `INCIDENCIA`[cite: 1, 2, 3].
     - *Dev B:* Programa `test_residuo`, `test_valor_negativo`, `test_bloqueo_cierre` y la Bandeja de Incidencias en React[cite: 1].
3. **✅ Evidencia para cerrar el Bloque 4:** Todos los tests automáticos de `M1` a `M6` pasan en verde y cuadran al sexto decimal con los casos reales del contador[cite: 1, 3].

---

### BLOQUE 5: Kardex, Excel, Cierres y Prepiloto (Fases 8, 9 y 10 — Migración 6)[cite: 1, 3]
1. **Ventana de Migración 6 (10 min):** Migrar `cierre_periodo` y `cierre_periodo_detalle`[cite: 1, 2].
2. **Reparto Full-Stack en paralelo:**
   - **Dev A (App `reports` — Kardex y Excel)[cite: 1]:**
     - *Backend:* Endpoint optimizado de consulta de Kardex Valorizado y servicio de exportación a Excel (`openpyxl`) para Kardex, movimientos, incidencias y resumen[cite: 1, 3].
     - *Frontend:* Pantalla principal del Kardex Valorizado con todos los filtros (empresa, producto, período, almacén, tipo de operación) y botones de exportación[cite: 1, 3].
   - **Dev B (Cierre y Reapertura de Períodos):**
     - *Backend:* Servicio de Cierre (verifica 0 incidencias bloqueantes, genera Excel oficial, calcula `hash_resultado` y guarda `CIERRE_PERIODO` + `CIERRE_PERIODO_DETALLE`) y servicio de Reapertura (solo `ADMIN`, exige motivo, audita y marca períodos posteriores como `DESACTUALIZADO`)[cite: 1, 2, 3].
     - *Frontend:* Pantalla de Cierre/Reapertura de períodos y comparador de versiones de cierre[cite: 1, 3].
3. **✅ Evidencia para cerrar el Bloque 5 (Prepiloto Fase 10):** El Kardex en pantalla y el Excel exportado coinciden 100% con el Kardex manual del contador[cite: 1, 3].

---

### BLOQUE 6: XML, Homologación, OCR, Formato 13.1 y Piloto Final (Fases 11 a 14 — Migración 7)[cite: 1, 3]
1. **Ventana de Migración 7 (15 min):** Migrar `producto_equivalencia`, `documento_captura` y `captura_campo`[cite: 1, 2].
2. **Reparto Full-Stack en paralelo:**
   - **Dev A (XML UBL y Homologación de Productos)[cite: 1, 3]:**
     - *Backend:* Parser de archivos XML hacia `DOCUMENTO_CAPTURA` / `CAPTURA_CAMPO` (creando siempre `BORRADOR`) y lógica de `PRODUCTO_EQUIVALENCIA` (sugerencia y confirmación humana)[cite: 1, 2, 3].
     - *Frontend:* Subida de XML y pantalla de Homologación de productos del proveedor[cite: 1, 3].
   - **Dev B (OCR Básico y Formato 13.1 SUNAT)[cite: 1, 3]:**
     - *Backend:* Servicio de extracción OCR de PDF/Imágenes hacia `CAPTURA_CAMPO` (`CABECERA` y `DETALLE` con porcentaje de `confianza`) y generador del reporte oficial **Formato 13.1**[cite: 1, 2, 3].
     - *Frontend:* Visor de revisión de capturas OCR (documento original al lado de los campos extraídos) y pantalla de exportación del Formato 13.1[cite: 1, 3].
3. **✅ Evidencia Final (Piloto Paralelo Fase 14):** Ejecutar 1 a 2 períodos reales en paralelo con el método actual de ASESCON, validando exactitud contable total y calculando el porcentaje real de ahorro de tiempo por comprobante[cite: 1, 3].