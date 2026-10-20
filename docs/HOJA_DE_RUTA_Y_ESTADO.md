# 🧭 HOJA DE RUTA Y ESTADO ACTUAL — FACT-KARD

> **⚠️ ACLARACIÓN IMPORTANTE PARA EL EQUIPO: ¿Por qué solo hay 7 tablas en Django ahora mismo?**
> La base de datos completa tiene **32 tablas** y ya está 100% diseñada en `docs/FACT_KARD_BD_COMPLETA_SQL.md`.
> Sin embargo, siguiendo la **Sección 53 del Manual de Construcción**, **NO se crean las 32 tablas de golpe**. Las iremos activando en Django en **7 Migraciones progresivas** a medida que avancemos de bloque:
> - **Migración 1 (YA EN DEVELOP):** 7 tablas (`moneda`, `empresa`, `establecimiento`, `config_empresa`, `usuario`, `usuario_empresa`, `auditoria`).
> - **Migración 2 (Próximo bloque):** 8 tablas (`tercero`, `producto`, `unidad_medida`, `producto_unidad`, `almacen`, `tipo_existencia`, `tipo_comprobante`, `tipo_operacion`).
> - **Migración 3:** 3 tablas (`tipo_cambio`, `periodo`, `config_igv_periodo`).
> - **Migración 4:** 5 tablas (`saldo_inicial`, `documento`, `documento_detalle`, `nota_interna`, `nota_interna_detalle`).
> - **Migración 5 (El Motor):** 9 tablas (`movimiento`, `valorizacion_movimiento`, `saldo_cpp_actual`, `stock_almacen`, `recalculo`, `recalculo_detalle`, `incidencia`, `transferencia`, `transferencia_detalle`).
> - **Migración 6 (Cierres):** 2 tablas (`cierre_periodo`, `cierre_periodo_detalle`).
> - **Migración 7 (XML/OCR):** 3 tablas (`producto_equivalencia`, `documento_captura`, `captura_campo`).

---

## 🛡️ CÓMO EVITAMOS CONFLICTOS EN GIT (BACKEND Y FRONTEND)

Para que nuestros agentes de IA (Antigravity / Codex) jamás modifiquen el mismo archivo ni tengamos conflictos al unir ramas (*merge*):

1. **Archivos Centrales "Congelados" en `develop`:**
   - En Backend, `backend/config/urls.py` y `settings.py` ya están listos. Nadie los modifica en sus ramas; cada uno edita solo el `urls.py` dentro de su propia app (`apps/usuarios/urls.py`, `apps/empresas/urls.py`, etc.).
   - En Frontend, antes de separarnos dejamos listo `frontend/src/App.tsx` (con las rutas de ambos ya declaradas) y `frontend/src/api/http.ts` (cliente Axios común). Así cada uno solo edita su propia carpeta dentro de `frontend/src/pages/`.
2. **Frontera Estricta por Desarrollador:**
   - **Dev A (Isai)** y **Dev B (Compañero)** tienen carpetas exclusivas asignadas en cada bloque.
   - Al darle un prompt al agente de IA, siempre le indicamos qué carpetas tiene permiso de tocar y cuáles tiene prohibidas.

---

## ✅ CHECKLIST DE AVANCE PASO A PASO (Marcar con `[x]`)

### FASE 0 Y SETUP BASE (Completado)
- [x] Estructura monorepo (`backend/`, `frontend/`, `docs/`, `docker-compose.yml`, `AGENTS.md`).
- [x] Reglas contables de Fase 0 validadas con el contador (13.1 con CPP global, NC/ND de período cerrado proporcional al stock restante, y NC/ND en USD con TC del documento origen).
- [x] **Migración 1 aplicada en `develop`** (7 tablas iniciales + trigger de inmutabilidad en `auditoria`).

---

### 🚀 BLOQUE 1 (ACTUAL): Seguridad, Multiempresa y Auditoría

#### Paso 1.0 — Puente Base de Frontend (Hacer 1 sola vez en `develop` antes de abrir ramas)
- [x] Crear en `develop` el cliente Axios base (`frontend/src/api/http.ts`), el contexto de sesión/empresa (`frontend/src/context/AuthContext.tsx`) y dejar declaradas las rutas vacías en `frontend/src/App.tsx` para que ningún agente choque en `App.tsx`.

#### Paso 1.1 — Trabajo en Paralelo (Cada uno en su propia rama)

**👨‍💻 Carril DEV A — Rama: `feat/usuarios-auditoria`**
*Carpetas exclusivas:* `backend/apps/usuarios/`, `backend/apps/auditoria/`, `frontend/src/pages/auth/`, `frontend/src/pages/auditoria/`
- [ ] **Backend (`auditoria`):** Función `registrar_auditoria()` en `apps/auditoria/services.py` y endpoint `GET /api/auditoria/` filtrado por `X-Empresa-Id`.
- [ ] **Backend (`usuarios`):** Endpoints `POST /api/usuarios/login/`, `GET /api/usuarios/me/` y permisos reutilizables (`TieneEmpresaActiva` leyendo header `X-Empresa-Id` y `EsAdminEmpresa`).
- [ ] **Tests (`usuarios` y `auditoria`):** Test automático que compruebe que un usuario de `Empresa A` recibe error `403` si intenta consultar `Empresa B`.
- [ ] **Frontend (`pages/auth/` y `pages/auditoria/`):** Pantalla de Login funcional y vista de tabla de Auditoría.
- [ ] Subir Pull Request a `develop`.

**👨‍💻 Carril DEV B — Rama: `feat/empresas-config`**
*Carpetas exclusivas:* `backend/apps/empresas/`, `backend/apps/catalogos/`, `frontend/src/layouts/`, `frontend/src/pages/empresas/`
- [ ] **Backend (`catalogos`):** Carga inicial (*seed*) de monedas `PEN` y `USD` en la tabla `moneda`.
- [ ] **Backend (`empresas`):** CRUD de `Empresa` (creando automáticamente su `ConfigEmpresa` 1:1 con `Decimal('0.05')`), actualización de `ConfigEmpresa` y CRUD de `Establecimiento` filtrando por `X-Empresa-Id`.
- [ ] **Tests (`empresas`):** Test de creación de empresa + configuración automática.
- [ ] **Frontend (`layouts/` y `pages/empresas/`):** Layout principal con barra superior, Selector de Empresa Activa (que guarda el ID para el header `X-Empresa-Id`) y pantalla de gestión de Empresas/Establecimientos/Configuración.
- [ ] Subir Pull Request a `develop`.

#### Paso 1.2 — Cierre del Bloque 1
- [ ] Revisar ambos Pull Requests, unir a `develop` y probar en pantalla: Login $\rightarrow$ Elegir Empresa A $\rightarrow$ Ver que no se mezclan datos con Empresa B.

---

### 📦 BLOQUE 2 (SIGUIENTE): Maestros, Catálogos SUNAT y Períodos
- [ ] **Ventana de Migración 2 y 3 (1 sola persona en `develop`):** Agregar las 11 tablas de Maestros, Catálogos SUNAT, Tipo de Cambio, Períodos e IGV.
- [ ] **Carril DEV A:** `apps/catalogos/` (Seed Tablas SUNAT + Tipo de Cambio) y Períodos/IGV + sus pantallas en React.
- [ ] **Carril DEV B:** `apps/inventario/` (Terceros, Almacenes, Productos y Unidades de medida con 1 unidad base) + sus pantallas en React.

---

### 📝 BLOQUE 3: Registro Manual de Compras, Ventas y Notas Internas
- [ ] **Ventana de Migración 4 (1 sola persona en `develop`):** Agregar las 5 tablas (`documento`, `documento_detalle`, `saldo_inicial`, `nota_interna`, `nota_interna_detalle`).
- [ ] **Carril DEV A:** `apps/documentos/` (Borradores, revisión, duplicados, copia histórica de TC/IGV) + Formulario de Compras/Ventas en React.
- [ ] **Carril DEV B:** `apps/inventario/` (Saldo Inicial y Notas Internas: mermas, desmedros, ajustes) + Pantallas en React.

---

### ⚙️ BLOQUE 4: El Motor Kardex Valorizado (M1 a M6)
- [ ] **Ventana de Migración 5 (1 sola persona en `develop`):** Agregar las 9 tablas del motor (`movimiento` con trigger de inmutabilidad, `valorizacion_movimiento`, cachés, `recalculo`, `incidencia`, `transferencia`).
- [ ] **Ejecución TDD cruzada (M1 a M6):** Alternarnos programación del motor y batería de tests con los casos reales del contador.

---

### 📊 BLOQUE 5: Vista Kardex, Exportación Excel y Cierre de Períodos
- [ ] **Ventana de Migración 6:** Agregar las 2 tablas de cierre (`cierre_periodo`, `cierre_periodo_detalle`).
- [ ] **Carril DEV A:** Consulta de Kardex Valorizado y exportación a Excel (`openpyxl`) + Pantalla de Kardex.
- [ ] **Carril DEV B:** Lógica de Cierre (snapshot + hash) y Reapertura (paso a `DESACTUALIZADO`) + Pantalla de Cierres.

---

### 🤖 BLOQUE 6: XML, Homologación, OCR y Formato 13.1 SUNAT
- [ ] **Ventana de Migración 7 (Últimas 3 tablas — Completando las 32 tablas):** `producto_equivalencia`, `documento_captura`, `captura_campo`.
- [ ] **Carril DEV A:** Lector XML UBL y Homologación de productos.
- [ ] **Carril DEV B:** OCR básico a borrador y reporte Formato 13.1 SUNAT.