import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  obtenerDocumentos,
  obtenerDocumento,
  crearDocumento,
  revisarDocumento,
  confirmarDocumento,
  anularDocumento,
} from '../../api/documentos';
import type {
  Documento,
  ClaseDocumento,
  EstadoDocumental,
  EstadoRevision,
  CrearDocumentoPayload,
} from '../../api/documentos';
import { obtenerPeriodos } from '../../api/periodos';
import type { Periodo } from '../../api/periodos';
import {
  obtenerTiposComprobante,
  obtenerTiposOperacion,
  resolverTipoCambio,
} from '../../api/catalogos';
import type {
  TipoComprobante,
  TipoOperacion,
  TipoCambioResolverResult,
} from '../../api/catalogos';
import {
  getProductos,
  getProductoUnidades,
  getAlmacenes,
  getTerceros,
} from '../../api/inventario';
import type {
  Producto,
  ProductoUnidad,
  Almacen,
  Tercero,
} from '../../api/inventario';
import { useAuth } from '../../context/AuthContext';
import { fechaCalendarioLocal } from '../../utils/date';

interface LineaFormulario {
  tempId: string;
  productoId: number | '';
  productoUnidadId: number | '';
  almacenId: number | '';
  tipoOperacionId: number | '';
  cantidadOriginal: string;
  precioUnitario: string;
  igv: string;
  esBonificacion: boolean;
  descripcionOriginal: string;
  detalleOrigenId?: number | '';
  // Auxiliary UI values
  unidadesDisponibles: ProductoUnidad[];
  factorConversion: number;
}

export const DocumentosPage: React.FC = () => {
  const { empresaActiva } = useAuth();

  // Master Data
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [tiposComprobante, setTiposComprobante] = useState<TipoComprobante[]>([]);
  const [tiposOperacion, setTiposOperacion] = useState<TipoOperacion[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [terceros, setTerceros] = useState<Tercero[]>([]);

  // Filters
  const [filtroClase, setFiltroClase] = useState<ClaseDocumento | ''>('');
  const [filtroPeriodo, setFiltroPeriodo] = useState<number | ''>('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoDocumental | ''>('');
  const [filtroRevision, setFiltroRevision] = useState<EstadoRevision | ''>('');
  const [filtroBusqueda, setFiltroBusqueda] = useState('');

  // UI States
  const [cargando, setCargando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [exitoGlobal, setExitoGlobal] = useState<string | null>(null);

  // Modals
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);
  const [modalDetalleDocumento, setModalDetalleDocumento] = useState<Documento | null>(null);
  const [modalRevisionDoc, setModalRevisionDoc] = useState<Documento | null>(null);
  const [modalAnulacionDoc, setModalAnulacionDoc] = useState<Documento | null>(null);

  // Form State (New Document)
  const [formClase, setFormClase] = useState<ClaseDocumento>('COMPRA');
  const [formPeriodo, setFormPeriodo] = useState<number | ''>('');
  const [formTipoComprobante, setFormTipoComprobante] = useState<number | ''>('');
  const [formTercero, setFormTercero] = useState<number | ''>('');
  const [formSerie, setFormSerie] = useState('');
  const [formNumero, setFormNumero] = useState('');
  const [formFechaEmision, setFormFechaEmision] = useState(fechaCalendarioLocal);
  const [formMoneda, setFormMoneda] = useState<'PEN' | 'USD'>('PEN');
  const [formDocOrigen, setFormDocOrigen] = useState<number | ''>('');
  const [tcResuelto, setTcResuelto] = useState<TipoCambioResolverResult | null>(null);
  const [cargandoTc, setCargandoTc] = useState(false);
  const [guardandoDoc, setGuardandoDoc] = useState(false);

  // Detail Lines
  const [lineas, setLineas] = useState<LineaFormulario[]>([]);

  // Revision Modal Action
  const [revEstadoSeleccionado, setRevEstadoSeleccionado] = useState<EstadoRevision>('REVISADO');
  const [revMotivo, setRevMotivo] = useState('');
  const [anulacionMotivo, setAnulacionMotivo] = useState('');

  // Cargar datos iniciales
  const cargarCatalogosYDocumentos = useCallback(async () => {
    setCargando(true);
    setErrorGlobal(null);
    try {
      const [docs, pers, comps, ops, prods, alms, tercs] = await Promise.all([
        obtenerDocumentos(),
        obtenerPeriodos(),
        obtenerTiposComprobante(),
        obtenerTiposOperacion(),
        getProductos(),
        getAlmacenes(),
        getTerceros(),
      ]);
      setDocumentos(docs);
      setPeriodos(pers);
      setTiposComprobante(comps.filter((c) => c.activo));
      setTiposOperacion(ops.filter((o) => o.activo));
      setProductos(prods.filter((p) => p.estado === 'ACTIVO'));
      setAlmacenes(alms.filter((a) => a.activo));
      setTerceros(tercs.filter((t) => t.estado === 'ACTIVO'));

      // Preseleccionar primer período abierto si existe
      const periodoAbierto = pers.find((p) => p.estado === 'ABIERTO');
      if (periodoAbierto) {
        setFormPeriodo(periodoAbierto.id);
      }
    } catch (err: any) {
      setErrorGlobal(err.response?.data?.detail || 'Error al cargar los datos del sistema.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarCatalogosYDocumentos();
  }, [cargarCatalogosYDocumentos, empresaActiva?.id]);

  // Resolver Tipo de Cambio automáticamente cuando la moneda sea USD y cambie la fecha
  useEffect(() => {
    if (formMoneda === 'USD' && formFechaEmision) {
      setCargandoTc(true);
      resolverTipoCambio('USD', formFechaEmision)
        .then((res) => {
          setTcResuelto(res);
        })
        .catch(() => {
          setTcResuelto(null);
        })
        .finally(() => {
          setCargandoTc(false);
        });
    } else {
      setTcResuelto(null);
    }
  }, [formMoneda, formFechaEmision]);

  // Comprobante seleccionado
  const tipoCompSeleccionado = useMemo(() => {
    return tiposComprobante.find((c) => c.id === formTipoComprobante);
  }, [tiposComprobante, formTipoComprobante]);

  const esNota = Boolean(tipoCompSeleccionado?.es_nota);

  // RUC Emisor automático
  const rucEmisorDisplay = useMemo(() => {
    if (formClase === 'VENTA') {
      return empresaActiva?.ruc || 'RUC Empresa Activa';
    }
    const t = terceros.find((ter) => ter.id === formTercero);
    return t ? t.numero_documento : 'Pendiente de selección';
  }, [formClase, formTercero, empresaActiva?.ruc, terceros]);

  // Manejo de líneas en formulario
  const agregarLinea = () => {
    const primerAlmacen = almacenes[0]?.id || '';
    const primerTipoOp = tiposOperacion[0]?.id || '';

    setLineas((prev) => [
      ...prev,
      {
        tempId: Math.random().toString(36).substring(2, 9),
        productoId: '',
        productoUnidadId: '',
        almacenId: primerAlmacen,
        tipoOperacionId: primerTipoOp,
        cantidadOriginal: '1.00000000',
        precioUnitario: '0.00000000',
        igv: '0.00000000',
        esBonificacion: false,
        descripcionOriginal: '',
        unidadesDisponibles: [],
        factorConversion: 1,
      },
    ]);
  };

  const eliminarLinea = (tempId: string) => {
    setLineas((prev) => prev.filter((l) => l.tempId !== tempId));
  };

  const actualizarLinea = async (tempId: string, campo: string, valor: any) => {
    setLineas((prev) =>
      prev.map((l) => {
        if (l.tempId !== tempId) return l;

        const actualizada = { ...l, [campo]: valor };

        // Si cambia el precio o cantidad, recalcular IGV sugerido (18%)
        if (campo === 'precioUnitario' || campo === 'cantidadOriginal') {
          const cant = parseFloat(campo === 'cantidadOriginal' ? valor : l.cantidadOriginal) || 0;
          const precio = parseFloat(campo === 'precioUnitario' ? valor : l.precioUnitario) || 0;
          if (!l.esBonificacion) {
            actualizada.igv = (cant * precio * 0.18).toFixed(8);
          }
        }

        if (campo === 'esBonificacion' && valor === true) {
          actualizada.precioUnitario = '0.00000000';
          actualizada.igv = '0.00000000';
        }

        return actualizada;
      })
    );

    // Si cambia el producto, cargar sus unidades dinámicamente
    if (campo === 'productoId' && valor) {
      try {
        const unidades = await getProductoUnidades(Number(valor));
        const unidadBase = unidades.find((u) => u.es_base) || unidades[0];
        setLineas((prev) =>
          prev.map((l) => {
            if (l.tempId !== tempId) return l;
            return {
              ...l,
              unidadesDisponibles: unidades,
              productoUnidadId: unidadBase ? unidadBase.id : '',
              factorConversion: unidadBase ? parseFloat(unidadBase.factor_a_base) : 1,
            };
          })
        );
      } catch {
        // Fallback silently
      }
    }

    if (campo === 'productoUnidadId' && valor) {
      setLineas((prev) =>
        prev.map((l) => {
          if (l.tempId !== tempId) return l;
          const u = l.unidadesDisponibles.find((unit) => unit.id === Number(valor));
          return {
            ...l,
            factorConversion: u ? parseFloat(u.factor_a_base) : 1,
          };
        })
      );
    }
  };

  // Totales en vivo
  const totalesCalculados = useMemo(() => {
    let subtotal = 0;
    let igvTotal = 0;

    lineas.forEach((l) => {
      const cant = parseFloat(l.cantidadOriginal) || 0;
      const precio = parseFloat(l.precioUnitario) || 0;
      const igv = parseFloat(l.igv) || 0;
      subtotal += cant * precio;
      igvTotal += igv;
    });

    return {
      subtotal: subtotal.toFixed(2),
      igv: igvTotal.toFixed(2),
      total: (subtotal + igvTotal).toFixed(2),
    };
  }, [lineas]);

  // Guardar Nuevo Documento
  const handleGuardarDocumento = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorGlobal(null);
    setExitoGlobal(null);

    if (!formPeriodo) {
      setErrorGlobal('Debe seleccionar un período contable.');
      return;
    }
    if (!formTipoComprobante) {
      setErrorGlobal('Debe seleccionar el tipo de comprobante.');
      return;
    }
    if (!formSerie.trim()) {
      setErrorGlobal('Debe ingresar la serie del comprobante.');
      return;
    }
    if (!formNumero.trim()) {
      setErrorGlobal('Debe ingresar el número del comprobante.');
      return;
    }
    if (formClase === 'COMPRA' && !formTercero) {
      setErrorGlobal('Debe seleccionar el proveedor del comprobante.');
      return;
    }
    if (esNota && !formDocOrigen) {
      setErrorGlobal('Las Notas de Crédito / Débito requieren seleccionar un documento de origen.');
      return;
    }
    if (lineas.length === 0) {
      setErrorGlobal('Debe agregar al menos una línea de detalle.');
      return;
    }

    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i];
      if (!l.productoId) {
        setErrorGlobal(`Línea ${i + 1}: Debe seleccionar un producto.`);
        return;
      }
      if (!l.almacenId) {
        setErrorGlobal(`Línea ${i + 1}: Debe seleccionar un almacén.`);
        return;
      }
      if (!l.tipoOperacionId) {
        setErrorGlobal(`Línea ${i + 1}: Debe seleccionar un tipo de operación.`);
        return;
      }
      if (parseFloat(l.cantidadOriginal) <= 0) {
        setErrorGlobal(`Línea ${i + 1}: La cantidad debe ser mayor a 0.`);
        return;
      }
    }

    const payload: CrearDocumentoPayload = {
      clase: formClase,
      periodo: Number(formPeriodo),
      tipo_comprobante: Number(formTipoComprobante),
      serie: formSerie.trim(),
      numero: formNumero.trim(),
      fecha_emision: formFechaEmision,
      moneda_codigo: formMoneda,
      tercero: formTercero ? Number(formTercero) : null,
      documento_origen: formDocOrigen ? Number(formDocOrigen) : null,
      origen_captura: 'MANUAL',
      detalles: lineas.map((l) => ({
        producto: Number(l.productoId),
        producto_unidad: l.productoUnidadId ? Number(l.productoUnidadId) : null,
        almacen: Number(l.almacenId),
        tipo_operacion: Number(l.tipoOperacionId),
        cantidad_original: l.cantidadOriginal,
        precio_unitario: l.precioUnitario,
        igv: l.igv,
        es_bonificacion: l.esBonificacion,
        descripcion_original: l.descripcionOriginal,
        detalle_origen: l.detalleOrigenId ? Number(l.detalleOrigenId) : null,
      })),
    };

    setGuardandoDoc(true);
    try {
      const nuevoDoc = await crearDocumento(payload);
      setExitoGlobal(`Comprobante ${nuevoDoc.serie_normalizada}-${nuevoDoc.numero_normalizado} registrado exitosamente.`);
      setModalNuevoAbierto(false);
      // Reset form
      setFormSerie('');
      setFormNumero('');
      setLineas([]);
      // Recargar lista
      const docsActualizados = await obtenerDocumentos();
      setDocumentos(docsActualizados);
    } catch (err: any) {
      const msgs = err.response?.data;
      if (typeof msgs === 'object') {
        const key = Object.keys(msgs)[0];
        const val = Array.isArray(msgs[key]) ? msgs[key][0] : msgs[key];
        setErrorGlobal(`${key}: ${val}`);
      } else {
        setErrorGlobal(err.response?.data?.detail || 'Error al guardar el comprobante.');
      }
    } finally {
      setGuardandoDoc(false);
    }
  };

  // Acciones Rápidas de Revisión
  const handleEjecutarRevision = async () => {
    if (!modalRevisionDoc) return;
    setErrorGlobal(null);
    try {
      await revisarDocumento(modalRevisionDoc.id, revEstadoSeleccionado, revMotivo);
      setExitoGlobal(`Estado de revisión actualizado a ${revEstadoSeleccionado}.`);
      setModalRevisionDoc(null);
      setRevMotivo('');
      const docsActualizados = await obtenerDocumentos();
      setDocumentos(docsActualizados);
    } catch (err: any) {
      setErrorGlobal(err.response?.data?.detail || 'Error al cambiar estado de revisión.');
    }
  };

  // Confirmar Documento
  const handleConfirmar = async (doc: Documento) => {
    if (!window.confirm(`¿Confirmar el comprobante ${doc.serie_normalizada}-${doc.numero_normalizado}? No podrá volver a borrador.`)) {
      return;
    }
    setErrorGlobal(null);
    try {
      await confirmarDocumento(doc.id);
      setExitoGlobal(`Documento ${doc.serie_normalizada}-${doc.numero_normalizado} confirmado exitosamente.`);
      const docsActualizados = await obtenerDocumentos();
      setDocumentos(docsActualizados);
    } catch (err: any) {
      setErrorGlobal(err.response?.data?.detail || 'No se pudo confirmar el comprobante.');
    }
  };

  // Anular Documento
  const handleEjecutarAnulacion = async () => {
    if (!modalAnulacionDoc || !anulacionMotivo.trim()) {
      setErrorGlobal('Debe especificar un motivo de anulación.');
      return;
    }
    setErrorGlobal(null);
    try {
      await anularDocumento(modalAnulacionDoc.id, anulacionMotivo.trim());
      setExitoGlobal(`Documento ${modalAnulacionDoc.serie_normalizada}-${modalAnulacionDoc.numero_normalizado} anulado.`);
      setModalAnulacionDoc(null);
      setAnulacionMotivo('');
      const docsActualizados = await obtenerDocumentos();
      setDocumentos(docsActualizados);
    } catch (err: any) {
      setErrorGlobal(err.response?.data?.detail || 'Error al anular el documento.');
    }
  };

  // Filtrado de documentos en memoria
  const documentosFiltrados = useMemo(() => {
    return documentos.filter((d) => {
      if (filtroClase && d.clase !== filtroClase) return false;
      if (filtroPeriodo && d.periodo !== filtroPeriodo) return false;
      if (filtroEstado && d.estado !== filtroEstado) return false;
      if (filtroRevision && d.estado_revision !== filtroRevision) return false;
      if (filtroBusqueda.trim()) {
        const q = filtroBusqueda.toLowerCase();
        const comp = `${d.serie_normalizada}-${d.numero_normalizado}`.toLowerCase();
        const ruc = d.ruc_emisor.toLowerCase();
        const terc = (d.tercero_razon_social || '').toLowerCase();
        if (!comp.includes(q) && !ruc.includes(q) && !terc.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [documentos, filtroClase, filtroPeriodo, filtroEstado, filtroRevision, filtroBusqueda]);

  // Documentos elegibles como origen para Notas (deben ser de la misma empresa)
  const documentosOrigenElegibles = useMemo(() => {
    return documentos.filter((d) => !d.es_nota);
  }, [documentos]);

  return (
    <div style={styles.container}>
      {/* 1. CABECERA PRINCIPAL */}
      <div style={styles.topHeader}>
        <div>
          <h1 style={styles.mainTitle}>Documentos Comerciales</h1>
          <p style={styles.mainSubtitle}>
            Gestión de Comprobantes (Compras, Ventas, NC, ND) y Mesa de Control y Revisión Fiscal.
          </p>
        </div>
        <button
          style={styles.btnPrimary}
          onClick={() => {
            setModalNuevoAbierto(true);
            if (lineas.length === 0) agregarLinea();
          }}
        >
          ➕ Nuevo Comprobante
        </button>
      </div>

      {/* Alertas */}
      {errorGlobal && <div style={styles.alertDanger}>⚠️ {errorGlobal}</div>}
      {exitoGlobal && <div style={styles.alertSuccess}>✅ {exitoGlobal}</div>}

      {/* 2. BARRA DE FILTROS Y MESA DE REVISIÓN */}
      <div style={styles.filterCard}>
        <div style={styles.filterGrid}>
          {/* Clase */}
          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Clase</label>
            <select
              style={styles.selectInput}
              value={filtroClase}
              onChange={(e) => setFiltroClase(e.target.value as any)}
            >
              <option value="">Todas las clases</option>
              <option value="COMPRA">Compras</option>
              <option value="VENTA">Ventas</option>
            </select>
          </div>

          {/* Período */}
          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Período</label>
            <select
              style={styles.selectInput}
              value={filtroPeriodo}
              onChange={(e) => setFiltroPeriodo(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Todos los períodos</option>
              {periodos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.anio}-{String(p.mes).padStart(2, '0')} ({p.estado})
                </option>
              ))}
            </select>
          </div>

          {/* Estado Documental */}
          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Estado Doc.</label>
            <select
              style={styles.selectInput}
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as any)}
            >
              <option value="">Todos los estados</option>
              <option value="BORRADOR">Borrador</option>
              <option value="CONFIRMADO">Confirmado</option>
              <option value="ANULADO">Anulado</option>
            </select>
          </div>

          {/* Estado de Revisión */}
          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Mesa de Revisión</label>
            <select
              style={styles.selectInput}
              value={filtroRevision}
              onChange={(e) => setFiltroRevision(e.target.value as any)}
            >
              <option value="">Todas las revisiones</option>
              <option value="PENDIENTE">PENDIENTE</option>
              <option value="EN_REVISION">EN REVISIÓN</option>
              <option value="REVISADO">REVISADO (Aprobado)</option>
              <option value="OBSERVADO">OBSERVADO</option>
            </select>
          </div>

          {/* Búsqueda */}
          <div style={{ ...styles.filterField, flex: 2 }}>
            <label style={styles.filterLabel}>Buscar Comprobante / RUC / Tercero</label>
            <input
              type="text"
              placeholder="Ej: F001-123, 2060..., COMERCIAL..."
              style={styles.textInput}
              value={filtroBusqueda}
              onChange={(e) => setFiltroBusqueda(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 3. TABLA DE ALTA DENSIDAD CONTABLE (TABULAR-NUMS) */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeaderInfo}>
          <span style={styles.tableCount}>
            Mostrando <strong>{documentosFiltrados.length}</strong> comprobantes
          </span>
          {cargando && <span style={styles.spinner}>Cargando datos...</span>}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thRow}>
                <th style={styles.th}>Clase</th>
                <th style={styles.th}>Comprobante</th>
                <th style={styles.th}>Emisión</th>
                <th style={styles.th}>Emisor / Tercero</th>
                <th style={styles.th}>Moneda / TC</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Subtotal</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>IGV</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Total</th>
                <th style={styles.th}>Revisión</th>
                <th style={styles.th}>Estado</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {documentosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={11} style={styles.emptyTd}>
                    No se encontraron comprobantes registrados para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                documentosFiltrados.map((doc) => {
                  const esCompra = doc.clase === 'COMPRA';
                  return (
                    <tr key={doc.id} style={styles.tr}>
                      {/* Clase */}
                      <td style={styles.td}>
                        <span style={esCompra ? styles.badgeCompra : styles.badgeVenta}>
                          {doc.clase}
                        </span>
                      </td>

                      {/* Comprobante */}
                      <td style={styles.td}>
                        <strong>{doc.tipo_comprobante_codigo || 'DOC'}: </strong>
                        <span style={styles.tabularNum}>
                          {doc.serie_normalizada}-{doc.numero_normalizado}
                        </span>
                        {doc.es_nota && (
                          <span style={styles.badgeNota} title="Nota de Crédito/Débito">
                            NOTA
                          </span>
                        )}
                      </td>

                      {/* Fecha Emisión */}
                      <td style={{ ...styles.td, ...styles.tabularNum }}>
                        {doc.fecha_emision}
                      </td>

                      {/* Emisor / Tercero */}
                      <td style={styles.td}>
                        <div style={styles.terceroCell}>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>
                            {doc.tercero_razon_social || (doc.clase === 'VENTA' ? 'CLIENTES VARIOS' : doc.ruc_emisor)}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b', ...styles.tabularNum }}>
                            RUC: {doc.ruc_emisor}
                          </span>
                        </div>
                      </td>

                      {/* Moneda / TC */}
                      <td style={styles.td}>
                        <span style={styles.badgeMoneda}>{doc.moneda_codigo}</span>
                        {doc.moneda_codigo === 'USD' && (
                          <div style={{ fontSize: '11px', color: '#475569', ...styles.tabularNum, marginTop: '2px' }}>
                            TC: {doc.monto_tc ? Number(doc.monto_tc).toFixed(4) : '-'}
                          </div>
                        )}
                      </td>

                      {/* Subtotal */}
                      <td style={{ ...styles.td, textAlign: 'right', ...styles.tabularNum }}>
                        {Number(doc.subtotal).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* IGV */}
                      <td style={{ ...styles.td, textAlign: 'right', ...styles.tabularNum }}>
                        {Number(doc.igv).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Total */}
                      <td style={{ ...styles.td, textAlign: 'right', ...styles.tabularNum, fontWeight: 700 }}>
                        {Number(doc.total).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Estado Revisión */}
                      <td style={styles.td}>
                        <span style={getBadgeRevisionStyle(doc.estado_revision)}>
                          {doc.estado_revision}
                        </span>
                      </td>

                      {/* Estado Documental */}
                      <td style={styles.td}>
                        <span style={getBadgeEstadoStyle(doc.estado)}>
                          {doc.estado}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <div style={styles.actionsWrap}>
                          {/* Ver Detalle */}
                          <button
                            style={styles.btnActionIcon}
                            title="Ver Detalle Completo"
                            onClick={async () => {
                              const fullDoc = await obtenerDocumento(doc.id);
                              setModalDetalleDocumento(fullDoc);
                            }}
                          >
                            👁️
                          </button>

                          {/* Mesa de Revisión (solo en borrador) */}
                          {doc.estado === 'BORRADOR' && (
                            <button
                              style={{ ...styles.btnActionIcon, color: '#2563eb' }}
                              title="Mesa de Revisión"
                              onClick={() => {
                                setModalRevisionDoc(doc);
                                setRevEstadoSeleccionado(doc.estado_revision === 'PENDIENTE' ? 'REVISADO' : doc.estado_revision);
                              }}
                            >
                              ⚖️
                            </button>
                          )}

                          {/* Confirmar Documento (solo si REVISADO y BORRADOR) */}
                          {doc.estado === 'BORRADOR' && doc.estado_revision === 'REVISADO' && (
                            <button
                              style={{ ...styles.btnActionIcon, color: '#16a34a' }}
                              title="Confirmar Comprobante"
                              onClick={() => handleConfirmar(doc)}
                            >
                              ✅
                            </button>
                          )}

                          {/* Anular Documento */}
                          {doc.estado !== 'ANULADO' && (
                            <button
                              style={{ ...styles.btnActionIcon, color: '#dc2626' }}
                              title="Anular Comprobante"
                              onClick={() => setModalAnulacionDoc(doc)}
                            >
                              🚫
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. MODAL: NUEVO COMPROBANTE MAESTRO-DETALLE */}
      {modalNuevoAbierto && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContentLarge}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Registrar Comprobante Comercial</h2>
                <p style={styles.modalSubtitle}>Captura manual de facturas, boletas y notas de crédito/débito.</p>
              </div>
              <button style={styles.btnClose} onClick={() => setModalNuevoAbierto(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarDocumento} style={styles.formContent}>
              {/* Bloque Cabecera */}
              <div style={styles.formSection}>
                <h3 style={styles.sectionHeaderTitle}>1. Cabecera del Documento</h3>
                <div style={styles.formGridHeader}>
                  {/* Clase */}
                  <div style={styles.formField}>
                    <label style={styles.formLabel}>Clase de Operación *</label>
                    <select
                      style={styles.selectInput}
                      value={formClase}
                      onChange={(e) => setFormClase(e.target.value as ClaseDocumento)}
                    >
                      <option value="COMPRA">COMPRA (Entrada)</option>
                      <option value="VENTA">VENTA (Salida)</option>
                    </select>
                  </div>

                  {/* Período */}
                  <div style={styles.formField}>
                    <label style={styles.formLabel}>Período Contable *</label>
                    <select
                      style={styles.selectInput}
                      value={formPeriodo}
                      onChange={(e) => setFormPeriodo(Number(e.target.value))}
                      required
                    >
                      <option value="">Seleccione Período...</option>
                      {periodos.map((p) => (
                        <option key={p.id} value={p.id} disabled={p.estado === 'CERRADO'}>
                          {p.anio}-{String(p.mes).padStart(2, '0')} ({p.estado})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tipo de Comprobante */}
                  <div style={styles.formField}>
                    <label style={styles.formLabel}>Tipo de Comprobante *</label>
                    <select
                      style={styles.selectInput}
                      value={formTipoComprobante}
                      onChange={(e) => setFormTipoComprobante(Number(e.target.value))}
                      required
                    >
                      <option value="">Seleccione Tipo...</option>
                      {tiposComprobante.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.codigo_sunat} - {c.descripcion} {c.es_nota ? '(Nota)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tercero (Proveedor o Cliente) */}
                  <div style={styles.formField}>
                    <label style={styles.formLabel}>
                      {formClase === 'COMPRA' ? 'Proveedor *' : 'Cliente (Opcional)'}
                    </label>
                    <select
                      style={styles.selectInput}
                      value={formTercero}
                      onChange={(e) => setFormTercero(e.target.value ? Number(e.target.value) : '')}
                      required={formClase === 'COMPRA'}
                    >
                      <option value="">Seleccione Tercero...</option>
                      {terceros
                        .filter((t) => (formClase === 'COMPRA' ? t.es_proveedor : t.es_cliente))
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.numero_documento} - {t.razon_social}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* RUC Emisor informativo */}
                  <div style={styles.formField}>
                    <label style={styles.formLabel}>RUC Emisor Resuelto</label>
                    <input
                      type="text"
                      disabled
                      value={rucEmisorDisplay}
                      style={{ ...styles.textInput, backgroundColor: '#f1f5f9' }}
                    />
                  </div>

                  {/* Serie y Número */}
                  <div style={styles.formField}>
                    <label style={styles.formLabel}>Serie *</label>
                    <input
                      type="text"
                      placeholder="Ej: F001"
                      style={styles.textInput}
                      value={formSerie}
                      onChange={(e) => setFormSerie(e.target.value)}
                      required
                    />
                  </div>

                  <div style={styles.formField}>
                    <label style={styles.formLabel}>Número *</label>
                    <input
                      type="text"
                      placeholder="Ej: 12345"
                      style={styles.textInput}
                      value={formNumero}
                      onChange={(e) => setFormNumero(e.target.value)}
                      required
                    />
                  </div>

                  {/* Fecha de Emisión */}
                  <div style={styles.formField}>
                    <label style={styles.formLabel}>Fecha de Emisión *</label>
                    <input
                      type="date"
                      style={styles.textInput}
                      value={formFechaEmision}
                      onChange={(e) => setFormFechaEmision(e.target.value)}
                      required
                    />
                  </div>

                  {/* Moneda */}
                  <div style={styles.formField}>
                    <label style={styles.formLabel}>Moneda *</label>
                    <select
                      style={styles.selectInput}
                      value={formMoneda}
                      onChange={(e) => setFormMoneda(e.target.value as 'PEN' | 'USD')}
                    >
                      <option value="PEN">PEN - Soles Peruanos</option>
                      <option value="USD">USD - Dólares Americanos</option>
                    </select>
                  </div>

                  {/* Si es USD: TC Venta */}
                  {formMoneda === 'USD' && (
                    <div style={styles.formField}>
                      <label style={styles.formLabel}>
                        TC Venta SBS {cargandoTc && '⏳'}
                      </label>
                      <input
                        type="text"
                        disabled
                        value={
                          tcResuelto
                            ? `${Number(tcResuelto.venta).toFixed(4)} (${tcResuelto.fecha_publicacion})`
                            : 'Sin TC registrado a la fecha'
                        }
                        style={{
                          ...styles.textInput,
                          backgroundColor: tcResuelto ? '#ecfdf5' : '#fff1f2',
                          color: tcResuelto ? '#065f46' : '#9f1239',
                          fontWeight: 600,
                        }}
                      />
                    </div>
                  )}

                  {/* Si es Nota: Documento Origen */}
                  {esNota && (
                    <div style={{ ...styles.formField, gridColumn: 'span 2' }}>
                      <label style={styles.formLabel}>
                        Documento de Origen Referenciado (Obligatorio para NC/ND) *
                      </label>
                      <select
                        style={styles.selectInput}
                        value={formDocOrigen}
                        onChange={(e) => setFormDocOrigen(e.target.value ? Number(e.target.value) : '')}
                        required
                      >
                        <option value="">Seleccione Factura / Boleta de Origen...</option>
                        {documentosOrigenElegibles.map((orig) => (
                          <option key={orig.id} value={orig.id}>
                            {orig.serie_normalizada}-{orig.numero_normalizado} ({orig.fecha_emision}) - {orig.tercero_razon_social} - {orig.moneda_codigo} {orig.total}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Bloque Grilla Dinámica de Líneas */}
              <div style={styles.formSection}>
                <div style={styles.sectionHeaderRow}>
                  <h3 style={styles.sectionHeaderTitle}>2. Líneas de Detalle del Comprobante</h3>
                  <button type="button" style={styles.btnSecondary} onClick={agregarLinea}>
                    ➕ Agregar Línea
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.tableLines}>
                    <thead>
                      <tr style={styles.thRow}>
                        <th style={styles.thLine}>#</th>
                        <th style={styles.thLine}>Producto *</th>
                        <th style={styles.thLine}>Unidad Presentación *</th>
                        <th style={styles.thLine}>Almacén *</th>
                        <th style={styles.thLine}>Operación *</th>
                        <th style={{ ...styles.thLine, width: '100px' }}>Cantidad</th>
                        <th style={{ ...styles.thLine, width: '100px' }}>Precio Unit.</th>
                        <th style={{ ...styles.thLine, width: '90px' }}>IGV</th>
                        <th style={{ ...styles.thLine, width: '80px', textAlign: 'center' }}>¿Bonif?</th>
                        <th style={{ ...styles.thLine, width: '90px', textAlign: 'right' }}>Cant. Base</th>
                        <th style={{ ...styles.thLine, width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineas.map((linea, idx) => {
                        const cant = parseFloat(linea.cantidadOriginal) || 0;
                        const factor = linea.factorConversion || 1;
                        const cantBase = (cant * factor).toFixed(2);

                        return (
                          <tr key={linea.tempId}>
                            {/* # */}
                            <td style={styles.tdLine}>{idx + 1}</td>

                            {/* Producto */}
                            <td style={styles.tdLine}>
                              <select
                                style={styles.tableSelect}
                                value={linea.productoId}
                                onChange={(e) => actualizarLinea(linea.tempId, 'productoId', e.target.value)}
                                required
                              >
                                <option value="">Seleccione...</option>
                                {productos.map((prod) => (
                                  <option key={prod.id} value={prod.id}>
                                    {prod.codigo_interno} - {prod.descripcion}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Unidad */}
                            <td style={styles.tdLine}>
                              <select
                                style={styles.tableSelect}
                                value={linea.productoUnidadId}
                                onChange={(e) => actualizarLinea(linea.tempId, 'productoUnidadId', e.target.value)}
                                required
                              >
                                <option value="">Unidad...</option>
                                {linea.unidadesDisponibles.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.unidad_codigo} (x{u.factor_a_base})
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Almacén */}
                            <td style={styles.tdLine}>
                              <select
                                style={styles.tableSelect}
                                value={linea.almacenId}
                                onChange={(e) => actualizarLinea(linea.tempId, 'almacenId', e.target.value)}
                                required
                              >
                                {almacenes.map((alm) => (
                                  <option key={alm.id} value={alm.id}>
                                    {alm.codigo} - {alm.nombre}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Tipo Operación */}
                            <td style={styles.tdLine}>
                              <select
                                style={styles.tableSelect}
                                value={linea.tipoOperacionId}
                                onChange={(e) => actualizarLinea(linea.tempId, 'tipoOperacionId', e.target.value)}
                                required
                              >
                                {tiposOperacion.map((op) => (
                                  <option key={op.id} value={op.id}>
                                    {op.codigo_interno} ({op.naturaleza})
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Cantidad Original */}
                            <td style={styles.tdLine}>
                              <input
                                type="number"
                                step="0.0001"
                                style={styles.tableInputNumber}
                                value={linea.cantidadOriginal}
                                onChange={(e) => actualizarLinea(linea.tempId, 'cantidadOriginal', e.target.value)}
                                required
                              />
                            </td>

                            {/* Precio Unitario */}
                            <td style={styles.tdLine}>
                              <input
                                type="number"
                                step="0.0001"
                                disabled={linea.esBonificacion}
                                style={styles.tableInputNumber}
                                value={linea.precioUnitario}
                                onChange={(e) => actualizarLinea(linea.tempId, 'precioUnitario', e.target.value)}
                                required
                              />
                            </td>

                            {/* IGV */}
                            <td style={styles.tdLine}>
                              <input
                                type="number"
                                step="0.01"
                                disabled={linea.esBonificacion}
                                style={styles.tableInputNumber}
                                value={linea.igv}
                                onChange={(e) => actualizarLinea(linea.tempId, 'igv', e.target.value)}
                              />
                            </td>

                            {/* ¿Bonificación? */}
                            <td style={{ ...styles.tdLine, textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={linea.esBonificacion}
                                onChange={(e) => actualizarLinea(linea.tempId, 'esBonificacion', e.target.checked)}
                              />
                            </td>

                            {/* Cant. Base (Cálculo en vivo) */}
                            <td style={{ ...styles.tdLine, textAlign: 'right', ...styles.tabularNum }}>
                              {cantBase}
                            </td>

                            {/* Eliminar */}
                            <td style={{ ...styles.tdLine, textAlign: 'center' }}>
                              <button
                                type="button"
                                style={styles.btnTrash}
                                onClick={() => eliminarLinea(linea.tempId)}
                                title="Eliminar Línea"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pie de Totales */}
                <div style={styles.totalesBox}>
                  <div style={styles.totalItem}>
                    <span style={styles.totalLabel}>Subtotal:</span>
                    <span style={styles.totalValue}>{formMoneda} {totalesCalculados.subtotal}</span>
                  </div>
                  <div style={styles.totalItem}>
                    <span style={styles.totalLabel}>IGV (18%):</span>
                    <span style={styles.totalValue}>{formMoneda} {totalesCalculados.igv}</span>
                  </div>
                  <div style={{ ...styles.totalItem, borderTop: '2px solid #cbd5e1', paddingTop: '6px' }}>
                    <span style={{ ...styles.totalLabel, fontWeight: 700 }}>Total Comprobante:</span>
                    <span style={{ ...styles.totalValue, fontSize: '18px', color: '#0f172a' }}>
                      {formMoneda} {totalesCalculados.total}
                    </span>
                  </div>
                </div>
              </div>

              {/* Botones de acción modal */}
              <div style={styles.modalFooter}>
                <button
                  type="button"
                  style={styles.btnSecondary}
                  onClick={() => setModalNuevoAbierto(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={styles.btnPrimary}
                  disabled={guardandoDoc}
                >
                  {guardandoDoc ? 'Guardando...' : '💾 Registrar en Borrador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: DETALLE COMPLETO DEL COMPROBANTE */}
      {modalDetalleDocumento && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContentLarge}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  Comprobante {modalDetalleDocumento.serie_normalizada}-{modalDetalleDocumento.numero_normalizado}
                </h2>
                <p style={styles.modalSubtitle}>
                  {modalDetalleDocumento.clase} | Emisión: {modalDetalleDocumento.fecha_emision} | Estado: {modalDetalleDocumento.estado}
                </p>
              </div>
              <button style={styles.btnClose} onClick={() => setModalDetalleDocumento(null)}>
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
              {/* Tarjetas resumen */}
              <div style={styles.detailSummaryGrid}>
                <div style={styles.detailCard}>
                  <span style={styles.detailLabel}>Tercero / Emisor</span>
                  <span style={styles.detailValue}>{modalDetalleDocumento.tercero_razon_social || '-'}</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>RUC: {modalDetalleDocumento.ruc_emisor}</span>
                </div>
                <div style={styles.detailCard}>
                  <span style={styles.detailLabel}>Moneda y TC Histórico</span>
                  <span style={styles.detailValue}>{modalDetalleDocumento.moneda_codigo}</span>
                  {modalDetalleDocumento.monto_tc && (
                    <span style={{ fontSize: '12px', color: '#047857' }}>
                      TC: {Number(modalDetalleDocumento.monto_tc).toFixed(4)} ({modalDetalleDocumento.fuente_tc})
                    </span>
                  )}
                </div>
                <div style={styles.detailCard}>
                  <span style={styles.detailLabel}>Mesa de Revisión</span>
                  <span style={getBadgeRevisionStyle(modalDetalleDocumento.estado_revision)}>
                    {modalDetalleDocumento.estado_revision}
                  </span>
                  {modalDetalleDocumento.revisado_por_username && (
                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      Por: {modalDetalleDocumento.revisado_por_username}
                    </span>
                  )}
                </div>
                <div style={styles.detailCard}>
                  <span style={styles.detailLabel}>Importe Total</span>
                  <span style={{ ...styles.detailValue, fontSize: '18px', color: '#0f172a' }}>
                    {modalDetalleDocumento.moneda_codigo} {Number(modalDetalleDocumento.total).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Grilla de líneas */}
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.tableLines}>
                  <thead>
                    <tr style={styles.thRow}>
                      <th style={styles.thLine}>Línea</th>
                      <th style={styles.thLine}>Producto</th>
                      <th style={styles.thLine}>Almacén</th>
                      <th style={styles.thLine}>Operación</th>
                      <th style={{ ...styles.thLine, textAlign: 'right' }}>Cant. Original</th>
                      <th style={{ ...styles.thLine, textAlign: 'right' }}>Factor</th>
                      <th style={{ ...styles.thLine, textAlign: 'right' }}>Cant. Base</th>
                      <th style={{ ...styles.thLine, textAlign: 'right' }}>Precio Unit.</th>
                      <th style={{ ...styles.thLine, textAlign: 'right' }}>IGV</th>
                      <th style={{ ...styles.thLine, textAlign: 'right' }}>% CF</th>
                      <th style={{ ...styles.thLine, textAlign: 'right' }}>Costo Base PEN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(modalDetalleDocumento.detalles || []).map((det) => (
                      <tr key={det.id}>
                        <td style={styles.tdLine}>{det.linea}</td>
                        <td style={styles.tdLine}>
                          <strong>{det.producto_codigo}</strong> - {det.producto_descripcion}
                          {det.es_bonificacion && <span style={styles.badgeNota}>BONIFICACIÓN</span>}
                        </td>
                        <td style={styles.tdLine}>{det.almacen_codigo}</td>
                        <td style={styles.tdLine}>{det.tipo_operacion_codigo}</td>
                        <td style={{ ...styles.tdLine, textAlign: 'right', ...styles.tabularNum }}>
                          {Number(det.cantidad_original).toFixed(2)}
                        </td>
                        <td style={{ ...styles.tdLine, textAlign: 'right', ...styles.tabularNum }}>
                          {Number(det.factor_conversion).toFixed(2)}
                        </td>
                        <td style={{ ...styles.tdLine, textAlign: 'right', ...styles.tabularNum, fontWeight: 600 }}>
                          {Number(det.cantidad_base).toFixed(2)}
                        </td>
                        <td style={{ ...styles.tdLine, textAlign: 'right', ...styles.tabularNum }}>
                          {Number(det.precio_unitario).toFixed(2)}
                        </td>
                        <td style={{ ...styles.tdLine, textAlign: 'right', ...styles.tabularNum }}>
                          {Number(det.igv).toFixed(2)}
                        </td>
                        <td style={{ ...styles.tdLine, textAlign: 'right', ...styles.tabularNum }}>
                          {Number(det.porcentaje_credito_fiscal_aplicado).toFixed(0)}%
                        </td>
                        <td style={{ ...styles.tdLine, textAlign: 'right', ...styles.tabularNum, fontWeight: 700, color: '#047857' }}>
                          {det.costo_unitario_pen !== null ? Number(det.costo_unitario_pen).toFixed(4) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button style={styles.btnSecondary} onClick={() => setModalDetalleDocumento(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: MESA DE REVISIÓN */}
      {modalRevisionDoc && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContentSmall}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Mesa de Revisión Fiscal</h2>
              <button style={styles.btnClose} onClick={() => setModalRevisionDoc(null)}>✕</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
                Comprobante: <strong>{modalRevisionDoc.serie_normalizada}-{modalRevisionDoc.numero_normalizado}</strong> ({modalRevisionDoc.clase})
              </p>

              <div>
                <label style={styles.formLabel}>Nuevo Estado de Revisión *</label>
                <select
                  style={styles.selectInput}
                  value={revEstadoSeleccionado}
                  onChange={(e) => setRevEstadoSeleccionado(e.target.value as EstadoRevision)}
                >
                  <option value="EN_REVISION">EN REVISIÓN</option>
                  <option value="REVISADO">REVISADO (Aprobado para confirmar)</option>
                  <option value="OBSERVADO">OBSERVADO (Requiere subsanación)</option>
                </select>
              </div>

              <div>
                <label style={styles.formLabel}>Motivo u Observación (Auditoría)</label>
                <textarea
                  rows={3}
                  style={styles.textareaInput}
                  placeholder="Ej: Verificación conforme de factura física contra sustento contable."
                  value={revMotivo}
                  onChange={(e) => setRevMotivo(e.target.value)}
                />
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.btnSecondary} onClick={() => setModalRevisionDoc(null)}>Cancelar</button>
              <button style={styles.btnPrimary} onClick={handleEjecutarRevision}>
                Guardar Revisión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: ANULACIÓN DE COMPROBANTE */}
      {modalAnulacionDoc && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContentSmall}>
            <div style={styles.modalHeader}>
              <h2 style={{ ...styles.modalTitle, color: '#dc2626' }}>Anular Comprobante</h2>
              <button style={styles.btnClose} onClick={() => setModalAnulacionDoc(null)}>✕</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
                ¿Está seguro de anular el comprobante <strong>{modalAnulacionDoc.serie_normalizada}-{modalAnulacionDoc.numero_normalizado}</strong>?
              </p>
              <div>
                <label style={styles.formLabel}>Motivo de Anulación *</label>
                <textarea
                  rows={3}
                  style={styles.textareaInput}
                  placeholder="Detalle el motivo tributario/operativo de la anulación..."
                  value={anulacionMotivo}
                  onChange={(e) => setAnulacionMotivo(e.target.value)}
                  required
                />
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.btnSecondary} onClick={() => setModalAnulacionDoc(null)}>Cancelar</button>
              <button style={{ ...styles.btnPrimary, backgroundColor: '#dc2626' }} onClick={handleEjecutarAnulacion}>
                Confirmar Anulación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Badges Helper
const getBadgeRevisionStyle = (estado: EstadoRevision): React.CSSProperties => {
  switch (estado) {
    case 'REVISADO':
      return { ...styles.badgeBase, backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' };
    case 'EN_REVISION':
      return { ...styles.badgeBase, backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' };
    case 'OBSERVADO':
      return { ...styles.badgeBase, backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' };
    case 'PENDIENTE':
    default:
      return { ...styles.badgeBase, backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' };
  }
};

const getBadgeEstadoStyle = (estado: EstadoDocumental): React.CSSProperties => {
  switch (estado) {
    case 'CONFIRMADO':
      return { ...styles.badgeBase, backgroundColor: '#f3e8ff', color: '#7e22ce', border: '1px solid #e9d5ff' };
    case 'ANULADO':
      return { ...styles.badgeBase, backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', textDecoration: 'line-through' };
    case 'BORRADOR':
    default:
      return { ...styles.badgeBase, backgroundColor: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0' };
  }
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    maxWidth: '1440px',
    margin: '0 auto',
  },
  tabularNum: {
    fontVariantNumeric: 'tabular-nums',
  },
  topHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
  },
  mainTitle: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  },
  mainSubtitle: {
    fontSize: '13px',
    color: '#64748b',
    margin: '4px 0 0 0',
  },
  btnPrimary: {
    backgroundColor: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  btnSecondary: {
    backgroundColor: '#f1f5f9',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  alertDanger: {
    padding: '12px 16px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    borderRadius: '8px',
    fontSize: '13px',
  },
  alertSuccess: {
    padding: '12px 16px',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#15803d',
    borderRadius: '8px',
    fontSize: '13px',
  },
  filterCard: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '16px',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  },
  filterGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignItems: 'flex-end',
  },
  filterField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: '150px',
  },
  filterLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
  },
  selectInput: {
    height: '36px',
    padding: '0 10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    backgroundColor: '#ffffff',
    color: '#0f172a',
  },
  textInput: {
    height: '36px',
    padding: '0 10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    backgroundColor: '#ffffff',
    color: '#0f172a',
  },
  textareaInput: {
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    fontFamily: 'inherit',
    backgroundColor: '#ffffff',
    color: '#0f172a',
  },
  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  },
  tableHeaderInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #f1f5f9',
    backgroundColor: '#f8fafc',
  },
  tableCount: {
    fontSize: '12px',
    color: '#64748b',
  },
  spinner: {
    fontSize: '12px',
    color: '#0284c7',
    fontWeight: 600,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
    textAlign: 'left',
  },
  thRow: {
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  th: {
    padding: '10px 12px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '10px 12px',
    color: '#1e293b',
    verticalAlign: 'middle',
  },
  emptyTd: {
    padding: '32px',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '13px',
  },
  terceroCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  actionsWrap: {
    display: 'flex',
    gap: '6px',
    justifyContent: 'center',
  },
  btnActionIcon: {
    background: 'none',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    cursor: 'pointer',
    padding: '4px 6px',
    fontSize: '13px',
  },
  badgeBase: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  badgeCompra: {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 700,
    backgroundColor: '#ecfdf5',
    color: '#065f46',
    border: '1px solid #a7f3d0',
  },
  badgeVenta: {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 700,
    backgroundColor: '#eff6ff',
    color: '#1e40af',
    border: '1px solid #bfdbfe',
  },
  badgeNota: {
    display: 'inline-block',
    padding: '1px 4px',
    borderRadius: '3px',
    fontSize: '9px',
    fontWeight: 700,
    backgroundColor: '#fef3c7',
    color: '#92400e',
    marginLeft: '4px',
  },
  badgeMoneda: {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 700,
    backgroundColor: '#f1f5f9',
    color: '#334155',
    border: '1px solid #e2e8f0',
  },
  // Modal Styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '16px',
  },
  modalContentLarge: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '1200px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
  },
  modalContentSmall: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '500px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '18px 24px',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  },
  modalSubtitle: {
    fontSize: '12px',
    color: '#64748b',
    margin: '3px 0 0 0',
  },
  btnClose: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#94a3b8',
  },
  formContent: {
    overflowY: 'auto',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  formSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#1e293b',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  formGridHeader: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
  },
  formField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  formLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#475569',
  },
  tableLines: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
  },
  thLine: {
    padding: '8px 10px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#475569',
    borderBottom: '1px solid #cbd5e1',
    backgroundColor: '#f1f5f9',
  },
  tdLine: {
    padding: '6px 8px',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'middle',
  },
  tableSelect: {
    width: '100%',
    height: '32px',
    padding: '0 6px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    fontSize: '12px',
  },
  tableInputNumber: {
    width: '100%',
    height: '32px',
    padding: '0 6px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    fontSize: '12px',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  btnTrash: {
    background: '#fee2e2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
    borderRadius: '4px',
    cursor: 'pointer',
    padding: '3px 6px',
    fontSize: '11px',
  },
  totalesBox: {
    alignSelf: 'flex-end',
    width: '300px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginTop: '12px',
  },
  totalItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
  },
  totalLabel: {
    color: '#64748b',
  },
  totalValue: {
    fontWeight: 600,
    color: '#1e293b',
    fontVariantNumeric: 'tabular-nums',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '14px 24px',
    borderTop: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
  },
  // Detalle Summary
  detailSummaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
  },
  detailCard: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  detailLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1e293b',
  },
};

export default DocumentosPage;
