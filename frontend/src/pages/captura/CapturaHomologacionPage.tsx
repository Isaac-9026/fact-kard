import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  actualizarEquivalencia,
  corregirCampoCaptura,
  crearEquivalencia,
  generarBorradorDesdeCaptura,
  obtenerCapturaDetalle,
  obtenerCapturas,
  obtenerEquivalencias,
  subirCaptura,
  sugerirEquivalencia,
  type CapturaCampo,
  type DocumentoCaptura,
  type GenerarBorradorResponse,
  type ProductoEquivalencia,
} from '../../api/captura';
import {
  getAlmacenes,
  getProductos,
  getProductoUnidades,
  getTerceros,
  getUnidadesMedida,
  type Almacen,
  type Producto,
  type ProductoUnidad,
  type Tercero,
  type UnidadMedida,
} from '../../api/inventario';

export const CapturaHomologacionPage: React.FC = () => {
  const { empresaActiva } = useAuth();

  // Pestaña activa: 'capturas' | 'homologaciones'
  const [activeTab, setActiveTab] = useState<'capturas' | 'homologaciones'>('capturas');

  // Estados de carga y feedback
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Catálogos auxiliares
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [terceros, setTerceros] = useState<Tercero[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [unidadesMedida, setUnidadesMedida] = useState<UnidadMedida[]>([]);

  // -------------------------------------------------------------
  // ESTADOS PESTAÑA 1: CAPTURAS XML / PDF / OCR
  // -------------------------------------------------------------
  const [capturas, setCapturas] = useState<DocumentoCaptura[]>([]);
  const [selectedCapturaId, setSelectedCapturaId] = useState<number | null>(null);
  const [capturaDetalle, setCapturaDetalle] = useState<DocumentoCaptura | null>(null);

  // Subida de archivos
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTipo, setUploadTipo] = useState<'XML' | 'PDF' | 'IMAGEN' | 'ESCANER'>('XML');
  const [textoOcr, setTextoOcr] = useState<string>('');
  const [selectedAlmacenId, setSelectedAlmacenId] = useState<number | string>('');

  // Edición en línea de campos
  const [editingCampoId, setEditingCampoId] = useState<number | null>(null);
  const [tempValorCorregido, setTempValorCorregido] = useState<string>('');

  // Resultado de generación de borrador
  const [borradorResultado, setBorradorResultado] = useState<GenerarBorradorResponse | null>(null);

  // -------------------------------------------------------------
  // ESTADOS PESTAÑA 2: HOMOLOGACIONES (PRODUCTO_EQUIVALENCIA)
  // -------------------------------------------------------------
  const [equivalencias, setEquivalencias] = useState<ProductoEquivalencia[]>([]);
  const [filtroTerceroId, setFiltroTerceroId] = useState<string>('');
  const [busquedaEquiv, setBusquedaEquiv] = useState<string>('');

  // Formulario Nueva Equivalencia
  const [showEquivModal, setShowEquivModal] = useState(false);
  const [formTerceroId, setFormTerceroId] = useState<string>('');
  const [formCodigoExt, setFormCodigoExt] = useState<string>('');
  const [formDescExt, setFormDescExt] = useState<string>('');
  const [formUnidadExt, setFormUnidadExt] = useState<string>('NIU');
  const [formProductoId, setFormProductoId] = useState<string>('');
  const [productoUnidades, setProductoUnidades] = useState<ProductoUnidad[]>([]);
  const [formProductoUnidadId, setFormProductoUnidadId] = useState<string>('');
  const [formFactor, setFormFactor] = useState<string>('1.00000000');

  // Probador de Sugerencias
  const [showSugerirModal, setShowSugerirModal] = useState(false);
  const [testTerceroId, setTestTerceroId] = useState<string>('');
  const [testCodigoExt, setTestCodigoExt] = useState<string>('');
  const [testDescExt, setTestDescExt] = useState<string>('');
  const [sugerenciaResultado, setSugerenciaResultado] = useState<any>(null);

  // Carga inicial de datos auxiliares
  useEffect(() => {
    if (!empresaActiva) return;
    const cargarAuxiliares = async () => {
      try {
        const [alms, tercs, prods, unds] = await Promise.all([
          getAlmacenes(),
          getTerceros({ tipo: 'proveedor' }),
          getProductos(),
          getUnidadesMedida(),
        ]);
        setAlmacenes(alms);
        setTerceros(tercs);
        setProductos(prods);
        setUnidadesMedida(unds);
        if (alms.length > 0) {
          setSelectedAlmacenId(alms[0].id);
        }
      } catch (err) {
        console.error('Error al cargar catálogos auxiliares:', err);
      }
    };
    cargarAuxiliares();
  }, [empresaActiva]);

  // Cargar lista de capturas
  const cargarCapturas = async () => {
    if (!empresaActiva) return;
    try {
      setLoading(true);
      const data = await obtenerCapturas();
      setCapturas(data);
      if (data.length > 0 && selectedCapturaId === null) {
        setSelectedCapturaId(data[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Error al cargar capturas.');
    } finally {
      setLoading(false);
    }
  };

  // Cargar lista de equivalencias
  const cargarEquivalencias = async () => {
    if (!empresaActiva) return;
    try {
      setLoading(true);
      const tercId = filtroTerceroId ? Number(filtroTerceroId) : undefined;
      const data = await obtenerEquivalencias(tercId);
      setEquivalencias(data);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Error al cargar equivalencias.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'capturas') {
      cargarCapturas();
    } else {
      cargarEquivalencias();
    }
  }, [activeTab, empresaActiva, filtroTerceroId]);

  // Cargar detalle de la captura seleccionada
  useEffect(() => {
    if (!selectedCapturaId) {
      setCapturaDetalle(null);
      return;
    }
    const cargarDetalle = async () => {
      try {
        setBorradorResultado(null);
        const data = await obtenerCapturaDetalle(selectedCapturaId);
        setCapturaDetalle(data);
      } catch (err) {
        console.error('Error al obtener detalle de captura:', err);
      }
    };
    cargarDetalle();
  }, [selectedCapturaId]);

  // Manejo de cambio de archivo y detección de tipo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploadFile(file);
      if (file.name.toLowerCase().endsWith('.xml')) {
        setUploadTipo('XML');
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        setUploadTipo('PDF');
      } else if (/\.(jpe?g|png)$/i.test(file.name)) {
        setUploadTipo('IMAGEN');
      }
    }
  };

  // Subir captura
  const handleSubirCaptura = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setErrorMsg('Seleccione un archivo XML o documento para procesar.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      setLoading(true);
      const res = await subirCaptura(uploadFile, uploadTipo, textoOcr);
      setSuccessMsg(res.mensaje || 'Archivo procesado exitosamente.');
      setUploadFile(null);
      setTextoOcr('');
      await cargarCapturas();
      setSelectedCapturaId(res.id);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.archivo || err?.response?.data?.detail || 'Error al subir y procesar captura.');
    } finally {
      setLoading(false);
    }
  };

  // Guardar corrección de campo
  const handleGuardarCorreccion = async (campoId: number) => {
    if (!selectedCapturaId) return;
    try {
      const updated = await corregirCampoCaptura(selectedCapturaId, campoId, tempValorCorregido);
      if (capturaDetalle && capturaDetalle.campos) {
        setCapturaDetalle({
          ...capturaDetalle,
          campos: capturaDetalle.campos.map((c) => (c.id === campoId ? updated : c)),
        });
      }
      setEditingCampoId(null);
      setSuccessMsg(`Campo ${updated.nombre_campo} corregido con éxito.`);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Error al corregir campo.');
    }
  };

  // Generar borrador desde captura
  const handleGenerarBorrador = async () => {
    if (!selectedCapturaId) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      setLoading(true);
      const almId = selectedAlmacenId ? Number(selectedAlmacenId) : undefined;
      const res = await generarBorradorDesdeCaptura(selectedCapturaId, almId);
      setBorradorResultado(res);
      setSuccessMsg(res.mensaje);
      await cargarCapturas();
      const detalleActualizado = await obtenerCapturaDetalle(selectedCapturaId);
      setCapturaDetalle(detalleActualizado);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || err?.response?.data?.periodo || 'Error al generar borrador.');
    } finally {
      setLoading(false);
    }
  };

  // Cargar unidades del producto cuando se selecciona en el modal de equivalencia
  useEffect(() => {
    if (!formProductoId) {
      setProductoUnidades([]);
      setFormProductoUnidadId('');
      return;
    }
    const cargarUnidades = async () => {
      try {
        const unds = await getProductoUnidades(Number(formProductoId));
        setProductoUnidades(unds);
        if (unds.length > 0) {
          const base = unds.find((u) => u.es_base) || unds[0];
          setFormProductoUnidadId(String(base.id));
        }
      } catch (err) {
        console.error('Error al cargar unidades del producto:', err);
      }
    };
    cargarUnidades();
  }, [formProductoId]);

  // Guardar nueva equivalencia
  const handleCrearEquivalencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTerceroId || !formProductoUnidadId) {
      setErrorMsg('Debe seleccionar el proveedor y la unidad del producto.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      setLoading(true);
      await crearEquivalencia({
        tercero: Number(formTerceroId),
        codigo_externo: formCodigoExt.trim() || null,
        descripcion_externa: formDescExt.trim() || null,
        unidad_externa_codigo: formUnidadExt || null,
        producto_unidad: Number(formProductoUnidadId),
        factor_conversion: formFactor,
        activa: true,
      });
      setSuccessMsg('Equivalencia confirmada y registrada exitosamente.');
      setShowEquivModal(false);
      setFormCodigoExt('');
      setFormDescExt('');
      setFormFactor('1.00000000');
      await cargarEquivalencias();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || err?.response?.data?.factor_conversion || 'Error al registrar equivalencia.');
    } finally {
      setLoading(false);
    }
  };

  // Alternar estado activo de equivalencia
  const handleToggleEquivalencia = async (equiv: ProductoEquivalencia) => {
    try {
      await actualizarEquivalencia(equiv.id, { activa: !equiv.activa });
      await cargarEquivalencias();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Error al actualizar equivalencia.');
    }
  };

  // Probar sugerencia
  const handleProbarSugerencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTerceroId) {
      setErrorMsg('Seleccione un proveedor para probar la sugerencia.');
      return;
    }
    try {
      setLoading(true);
      const res = await sugerirEquivalencia(Number(testTerceroId), testCodigoExt.trim(), testDescExt.trim());
      setSugerenciaResultado(res);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Error al probar sugerencia.');
    } finally {
      setLoading(false);
    }
  };

  // Campos separados de la captura
  const camposCabecera = useMemo(() => {
    if (!capturaDetalle?.campos) return [];
    return capturaDetalle.campos.filter((c) => c.seccion === 'CABECERA');
  }, [capturaDetalle]);

  const camposDetalle = useMemo(() => {
    if (!capturaDetalle?.campos) return [];
    return capturaDetalle.campos.filter((c) => c.seccion === 'DETALLE');
  }, [capturaDetalle]);

  // Agrupación de líneas de detalle
  const lineasAgrupadas = useMemo(() => {
    const mapa: Record<number, Record<string, CapturaCampo>> = {};
    camposDetalle.forEach((c) => {
      const num = c.numero_linea || 1;
      if (!mapa[num]) mapa[num] = {};
      mapa[num][c.nombre_campo] = c;
    });
    return Object.entries(mapa).sort(([a], [b]) => Number(a) - Number(b));
  }, [camposDetalle]);

  // Filtrado de equivalencias en frontend
  const equivalenciasFiltradas = useMemo(() => {
    return equivalencias.filter((eq) => {
      if (!busquedaEquiv) return true;
      const b = busquedaEquiv.toLowerCase();
      const codExt = eq.codigo_externo?.toLowerCase() || '';
      const descExt = eq.descripcion_externa?.toLowerCase() || '';
      const prodCod = eq.producto_info?.producto_codigo.toLowerCase() || '';
      const prodDesc = eq.producto_info?.producto_descripcion.toLowerCase() || '';
      return codExt.includes(b) || descExt.includes(b) || prodCod.includes(b) || prodDesc.includes(b);
    });
  }, [equivalencias, busquedaEquiv]);

  // Helper para badge de confianza
  const renderConfianzaBadge = (confStr: string | null) => {
    if (confStr === null) return <span style={styles.badgeMuted}>N/A</span>;
    const num = Number(confStr);
    let bg = '#dcfce7';
    let text = '#15803d';
    if (num < 70) {
      bg = '#fee2e2';
      text = '#b91c1c';
    } else if (num < 90) {
      bg = '#fef3c7';
      text = '#b45309';
    }
    return (
      <span style={{ ...styles.confBadge, backgroundColor: bg, color: text }}>
        {num.toFixed(1)}%
      </span>
    );
  };

  return (
    <div style={styles.page}>
      {/* Encabezado Principal */}
      <header style={styles.header}>
        <div style={styles.titleWrap}>
          <div style={styles.badgeHeader}>BLOQUE 6 • FASES 11 & 12</div>
          <h1 style={styles.title}>Captura XML / OCR y Homologación de Productos</h1>
          <p style={styles.subtitle}>
            Importación automatizada de comprobantes electrónicos (UBL 2.1) y catálogo de equivalencias proveedor ↔ almacén ·{' '}
            <strong>{empresaActiva?.razon_social || 'Empresa activa'}</strong>
          </p>
        </div>

        {/* Selector de Pestañas */}
        <div style={styles.tabBar}>
          <button
            style={activeTab === 'capturas' ? styles.tabActive : styles.tabInactive}
            onClick={() => setActiveTab('capturas')}
          >
            📥 Bandeja de Captura XML / PDF / OCR
          </button>
          <button
            style={activeTab === 'homologaciones' ? styles.tabActive : styles.tabInactive}
            onClick={() => setActiveTab('homologaciones')}
          >
            🔄 Catálogo de Homologación ({equivalencias.length})
          </button>
        </div>
      </header>

      {/* Alertas */}
      {errorMsg && (
        <div role="alert" style={styles.alertError}>
          <span>⚠️</span> {errorMsg}
        </div>
      )}
      {successMsg && (
        <div role="status" style={styles.alertSuccess}>
          <span>✅</span> {successMsg}
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 1: BANDEJA DE CAPTURA XML / PDF / OCR             */}
      {/* ========================================================= */}
      {activeTab === 'capturas' && (
        <div style={styles.tabContent}>
          {/* Tarjeta de Carga de Comprobantes */}
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Subir Comprobante para Captura Automática</h2>
            <p style={styles.cardSubtitle}>
              Cargue una factura electrónica en formato XML (UBL 2.1) o un documento digital (PDF, Imagen, Escáner) para extracción de datos.
            </p>

            <form onSubmit={handleSubirCaptura} style={styles.uploadForm}>
              <div style={styles.uploadRow}>
                {/* Selector de archivo */}
                <div style={styles.fieldWrap}>
                  <label style={styles.label}>Archivo del comprobante</label>
                  <input
                    type="file"
                    accept=".xml,.pdf,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                    style={styles.fileInput}
                  />
                  {uploadFile && (
                    <span style={styles.fileHint}>
                      Seleccionado: <strong>{uploadFile.name}</strong> ({(uploadFile.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>

                {/* Tipo de captura */}
                <div style={styles.fieldWrap}>
                  <label style={styles.label}>Tipo de Captura</label>
                  <div style={styles.tipoBtnGroup}>
                    {(['XML', 'PDF', 'IMAGEN', 'ESCANER'] as const).map((t) => (
                      <button
                        type="button"
                        key={t}
                        style={uploadTipo === t ? styles.tipoBtnActive : styles.tipoBtn}
                        onClick={() => setUploadTipo(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Botón de envío */}
                <div style={{ ...styles.fieldWrap, alignSelf: 'flex-end' }}>
                  <button type="submit" disabled={loading || !uploadFile} style={styles.primaryBtn}>
                    {loading ? 'Procesando…' : '🚀 Subir y Extraer Datos'}
                  </button>
                </div>
              </div>

              {uploadTipo !== 'XML' && (
                <div style={{ marginTop: '12px' }}>
                  <label style={styles.label}>Texto OCR o Contenido Escaneado (Opcional si se requiere sobreescritura manual)</label>
                  <textarea
                    rows={2}
                    value={textoOcr}
                    onChange={(e) => setTextoOcr(e.target.value)}
                    placeholder="Pegue aquí texto reconocido por OCR si el PDF no contiene capas de texto..."
                    style={styles.textArea}
                  />
                </div>
              )}
            </form>
          </section>

          {/* Master-Detail Layout */}
          <div style={styles.masterDetailGrid}>
            {/* Panel Izquierdo: Lista de Capturas */}
            <div style={styles.listPanel}>
              <div style={styles.panelHeader}>
                <h3 style={styles.panelTitle}>Capturas Registradas ({capturas.length})</h3>
                <button type="button" onClick={cargarCapturas} style={styles.smallRefreshBtn}>
                  🔄 Actualizar
                </button>
              </div>

              {capturas.length === 0 ? (
                <p style={styles.emptyText}>No hay comprobantes cargados en esta empresa.</p>
              ) : (
                <div style={styles.capturasScrollList}>
                  {capturas.map((c) => {
                    const isSelected = c.id === selectedCapturaId;
                    const isDraftGenerated = c.estado_proceso === 'BORRADOR_GENERADO';
                    return (
                      <div
                        key={c.id}
                        style={isSelected ? styles.capturaCardSelected : styles.capturaCard}
                        onClick={() => setSelectedCapturaId(c.id)}
                      >
                        <div style={styles.capturaCardTop}>
                          <span style={styles.tipoTag}>{c.tipo}</span>
                          <span style={isDraftGenerated ? styles.statusDraftTag : styles.statusProcTag}>
                            {c.estado_proceso}
                          </span>
                        </div>
                        <div style={styles.capturaCardBody}>
                          <span style={styles.capturaRuta} title={c.ruta_archivo}>
                            📄 {c.ruta_archivo.split('/').pop()}
                          </span>
                          <span style={styles.capturaHash} title={c.hash_sha256}>
                            Hash: <code>{c.hash_sha256.slice(0, 12)}…</code>
                          </span>
                          <div style={styles.capturaMeta}>
                            <span>👤 {c.subido_por_username || 'Usuario'}</span>
                            <span>📅 {new Date(c.creado_en).toLocaleDateString('es-PE')}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Panel Derecho: Detalle, Campos Extraídos y Generar Borrador */}
            <div style={styles.detailPanel}>
              {!capturaDetalle ? (
                <div style={styles.placeholderEmpty}>
                  <span>🔍</span>
                  <p>Seleccione una captura de la lista izquierda para inspeccionar sus datos extraídos.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Barra de Acciones de la Captura */}
                  <div style={styles.actionBanner}>
                    <div style={styles.actionBannerInfo}>
                      <span style={styles.actionBannerTitle}>
                        Captura #{capturaDetalle.id} [{capturaDetalle.tipo}] — SHA-256: <code>{capturaDetalle.hash_sha256.slice(0, 16)}…</code>
                      </span>
                      {capturaDetalle.documento_serie_numero ? (
                        <span style={styles.docGeneradoBadge}>
                          ✅ Comprobante Borrador Generado: <strong>{capturaDetalle.documento_serie_numero}</strong>
                        </span>
                      ) : (
                        <span style={styles.docPendienteBadge}>
                          ⏳ Pendiente de conversión a comprobante borrador
                        </span>
                      )}
                    </div>

                    <div style={styles.actionBannerControls}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                          Almacén Destino:
                        </label>
                        <select
                          value={selectedAlmacenId}
                          onChange={(e) => setSelectedAlmacenId(e.target.value)}
                          style={styles.selectSm}
                          disabled={Boolean(capturaDetalle.documento_id)}
                        >
                          {almacenes.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.codigo} - {a.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={handleGenerarBorrador}
                        disabled={loading || Boolean(capturaDetalle.documento_id)}
                        style={capturaDetalle.documento_id ? styles.btnDisabled : styles.convertirBtn}
                      >
                        {capturaDetalle.documento_id
                          ? 'Comprobante Ya Generado'
                          : '📄 Convertir a Comprobante en Borrador'}
                      </button>
                    </div>
                  </div>

                  {/* Feedback de Borrador Generado con Incidencias */}
                  {borradorResultado && (
                    <div style={styles.borradorAvisoBox}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>📋</span>
                        <div>
                          <strong>{borradorResultado.mensaje}</strong> (Doc #{borradorResultado.documento_id} · {borradorResultado.serie_numero})
                        </div>
                      </div>
                      {borradorResultado.lineas_sin_homologar > 0 && (
                        <div style={styles.incidenciaAviso}>
                          ⚠️ Se generaron <strong>{borradorResultado.lineas_sin_homologar} incidencia(s) de tipo PRODUCTO_SIN_HOMOLOGAR</strong>.
                          Debe registrar la homologación en la Pestaña 2 para que los productos queden vinculados antes de confirmar el documento.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sección 1: Campos de Cabecera */}
                  <div style={styles.card}>
                    <h4 style={styles.sectionHeaderTitle}>Datos Extraídos de Cabecera</h4>
                    <div style={styles.cabeceraGrid}>
                      {camposCabecera.map((c) => {
                        const isEditing = editingCampoId === c.id;
                        return (
                          <div key={c.id} style={styles.campoItem}>
                            <div style={styles.campoLabelWrap}>
                              <span style={styles.campoLabel}>{c.nombre_campo.replace('_', ' ').toUpperCase()}</span>
                              {renderConfianzaBadge(c.confianza)}
                            </div>
                            {isEditing ? (
                              <div style={styles.inlineEditWrap}>
                                <input
                                  type="text"
                                  value={tempValorCorregido}
                                  onChange={(e) => setTempValorCorregido(e.target.value)}
                                  style={styles.inputInline}
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleGuardarCorreccion(c.id)}
                                  style={styles.btnSaveInline}
                                >
                                  💾
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingCampoId(null)}
                                  style={styles.btnCancelInline}
                                >
                                  ✖
                                </button>
                              </div>
                            ) : (
                              <div style={styles.campoValorWrap}>
                                <span style={styles.campoValor}>
                                  {c.valor_corregido ? (
                                    <>
                                      <span style={styles.corregidoTag}>Corregido:</span>{' '}
                                      <strong>{c.valor_corregido}</strong>{' '}
                                      <span style={styles.originalSub}>({c.valor_extraido})</span>
                                    </>
                                  ) : (
                                    <strong>{c.valor_extraido || '—'}</strong>
                                  )}
                                </span>
                                {!capturaDetalle.documento_id && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCampoId(c.id);
                                      setTempValorCorregido(c.valor_corregido || c.valor_extraido || '');
                                    }}
                                    style={styles.btnEditIcon}
                                    title="Corregir valor"
                                  >
                                    ✏️
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sección 2: Líneas de Detalle Extraídas */}
                  <div style={styles.card}>
                    <h4 style={styles.sectionHeaderTitle}>Líneas de Detalle del Comprobante ({lineasAgrupadas.length})</h4>
                    <div style={styles.tableScroll}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Línea</th>
                            <th style={styles.th}>Código Externo</th>
                            <th style={styles.th}>Descripción Ítem</th>
                            <th style={styles.th}>Unidad</th>
                            <th style={{ ...styles.th, textAlign: 'right' }}>Cantidad</th>
                            <th style={{ ...styles.th, textAlign: 'right' }}>Precio Unit.</th>
                            <th style={{ ...styles.th, textAlign: 'right' }}>Valor Total</th>
                            <th style={{ ...styles.th, textAlign: 'center' }}>Confianza</th>
                            <th style={{ ...styles.th, textAlign: 'center' }}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineasAgrupadas.map(([numLinea, camposMap]) => {
                            const codCampo = camposMap['codigo_externo'];
                            const descCampo = camposMap['descripcion'];
                            const undCampo = camposMap['unidad_medida'];
                            const cantCampo = camposMap['cantidad'];
                            const precCampo = camposMap['precio_unitario'];
                            const totCampo = camposMap['valor_total'];

                            const codVal = codCampo?.valor_corregido || codCampo?.valor_extraido || '—';
                            const descVal = descCampo?.valor_corregido || descCampo?.valor_extraido || '—';
                            const undVal = undCampo?.valor_corregido || undCampo?.valor_extraido || 'NIU';
                            const cantVal = cantCampo?.valor_corregido || cantCampo?.valor_extraido || '0.00';
                            const precVal = precCampo?.valor_corregido || precCampo?.valor_extraido || '0.00';
                            const totVal = totCampo?.valor_corregido || totCampo?.valor_extraido || '0.00';

                            return (
                              <tr key={numLinea} style={styles.tr}>
                                <td style={{ ...styles.td, fontWeight: 700 }}>#{numLinea}</td>
                                <td style={styles.td}>
                                  <code style={styles.codeText}>{codVal}</code>
                                </td>
                                <td style={styles.td}>{descVal}</td>
                                <td style={styles.td}>{undVal}</td>
                                <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                  {Number(cantVal).toFixed(2)}
                                </td>
                                <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                  S/ {Number(precVal).toFixed(4)}
                                </td>
                                <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                                  S/ {Number(totVal).toFixed(2)}
                                </td>
                                <td style={{ ...styles.td, textAlign: 'center' }}>
                                  {renderConfianzaBadge(codCampo?.confianza || '100.0000')}
                                </td>
                                <td style={{ ...styles.td, textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    style={styles.linkBtn}
                                    onClick={() => {
                                      setActiveTab('homologaciones');
                                      setFormCodigoExt(codVal);
                                      setFormDescExt(descVal);
                                      setShowEquivModal(true);
                                    }}
                                  >
                                    Homologar
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 2: CATÁLOGO DE HOMOLOGACIÓN (`ProductoEquivalencia`)*/}
      {/* ========================================================= */}
      {activeTab === 'homologaciones' && (
        <div style={styles.tabContent}>
          {/* Barra de Filtros y Acciones */}
          <section style={styles.card}>
            <div style={styles.equivFilterBar}>
              <div style={styles.fieldWrap}>
                <label style={styles.label}>Filtrar por Proveedor</label>
                <select
                  value={filtroTerceroId}
                  onChange={(e) => setFiltroTerceroId(e.target.value)}
                  style={styles.selectLg}
                >
                  <option value="">Todos los Proveedores</option>
                  {terceros.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.numero_documento} - {t.razon_social}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.fieldWrap}>
                <label style={styles.label}>Buscar Código o Descripción</label>
                <input
                  type="text"
                  placeholder="Buscar por SKU externo o producto interno..."
                  value={busquedaEquiv}
                  onChange={(e) => setBusquedaEquiv(e.target.value)}
                  style={styles.inputLg}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowEquivModal(true)}
                  style={styles.primaryBtn}
                >
                  + Nueva Equivalencia
                </button>
                <button
                  type="button"
                  onClick={() => setShowSugerirModal(true)}
                  style={styles.secondaryBtn}
                >
                  🧪 Probar Sugerencia
                </button>
              </div>
            </div>
          </section>

          {/* Tabla de Equivalencias */}
          <section style={styles.card}>
            <div style={styles.panelHeader}>
              <h3 style={styles.panelTitle}>
                Equivalencias Confirmadas de Proveedores ({equivalenciasFiltradas.length})
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Regla de Oro: Solo las confirmadas por usuario humano se aplican automáticamente en los comprobantes.
              </span>
            </div>

            {equivalenciasFiltradas.length === 0 ? (
              <p style={styles.emptyText}>No existen equivalencias registradas para los filtros aplicados.</p>
            ) : (
              <div style={styles.tableScroll}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Proveedor (Tercero)</th>
                      <th style={styles.th}>Código Externo</th>
                      <th style={styles.th}>Descripción Externa</th>
                      <th style={styles.th}>Und. Ext.</th>
                      <th style={styles.th}>Producto Interno</th>
                      <th style={styles.th}>Und. Base</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Factor Conv.</th>
                      <th style={styles.th}>Confirmado Por</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Estado</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equivalenciasFiltradas.map((eq) => (
                      <tr key={eq.id} style={styles.tr}>
                        <td style={styles.td}>
                          <strong>{eq.tercero_info?.razon_social}</strong>
                          <span style={styles.subtext}>RUC: {eq.tercero_info?.numero_documento}</span>
                        </td>
                        <td style={styles.td}>
                          <code style={styles.codeText}>{eq.codigo_externo || '—'}</code>
                        </td>
                        <td style={styles.td}>{eq.descripcion_externa || '—'}</td>
                        <td style={styles.td}>{eq.unidad_externa_codigo || 'NIU'}</td>
                        <td style={styles.td}>
                          <strong>{eq.producto_info?.producto_codigo}</strong> — {eq.producto_info?.producto_descripcion}
                        </td>
                        <td style={styles.td}>{eq.producto_info?.unidad_codigo}</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                          {Number(eq.factor_conversion).toFixed(4)}
                        </td>
                        <td style={styles.td}>
                          <span>👤 {eq.confirmado_por_username || 'Admin'}</span>
                          {eq.confirmado_en && (
                            <span style={styles.subtext}>{new Date(eq.confirmado_en).toLocaleDateString('es-PE')}</span>
                          )}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <span style={eq.activa ? styles.badgeActive : styles.badgeInactive}>
                            {eq.activa ? 'ACTIVA' : 'INACTIVA'}
                          </span>
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleEquivalencia(eq)}
                            style={styles.toggleBtn}
                          >
                            {eq.activa ? 'Desactivar' : 'Activar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Modal Nueva Equivalencia */}
          {showEquivModal && (
            <div style={styles.modalOverlay}>
              <div style={styles.modalContent}>
                <div style={styles.modalHeader}>
                  <h3 style={styles.modalTitle}>Nueva Equivalencia de Producto (Homologación)</h3>
                  <button type="button" onClick={() => setShowEquivModal(false)} style={styles.closeBtn}>
                    ✖
                  </button>
                </div>

                <form onSubmit={handleCrearEquivalencia} style={styles.modalForm}>
                  <div style={styles.fieldWrap}>
                    <label style={styles.label}>Proveedor Emisor (*)</label>
                    <select
                      value={formTerceroId}
                      onChange={(e) => setFormTerceroId(e.target.value)}
                      style={styles.selectLg}
                      required
                    >
                      <option value="">Seleccione un proveedor</option>
                      {terceros.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.numero_documento} - {t.razon_social}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.rowTwo}>
                    <div style={styles.fieldWrap}>
                      <label style={styles.label}>Código del Proveedor (SKU Externo)</label>
                      <input
                        type="text"
                        value={formCodigoExt}
                        onChange={(e) => setFormCodigoExt(e.target.value)}
                        placeholder="Ej. TAL-500W-PROV"
                        style={styles.inputLg}
                      />
                    </div>
                    <div style={styles.fieldWrap}>
                      <label style={styles.label}>Unidad Externa</label>
                      <select
                        value={formUnidadExt}
                        onChange={(e) => setFormUnidadExt(e.target.value)}
                        style={styles.selectLg}
                      >
                        {unidadesMedida.map((u) => (
                          <option key={u.codigo} value={u.codigo}>
                            {u.codigo} - {u.descripcion}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={styles.fieldWrap}>
                    <label style={styles.label}>Descripción del Ítem en la Factura</label>
                    <input
                      type="text"
                      value={formDescExt}
                      onChange={(e) => setFormDescExt(e.target.value)}
                      placeholder="Ej. TALADRO INDUSTRIAL IMPACTO 500W"
                      style={styles.inputLg}
                    />
                  </div>

                  <div style={styles.divider} />

                  <div style={styles.fieldWrap}>
                    <label style={styles.label}>Producto Interno en FACT-KARD (*)</label>
                    <select
                      value={formProductoId}
                      onChange={(e) => setFormProductoId(e.target.value)}
                      style={styles.selectLg}
                      required
                    >
                      <option value="">Seleccione el producto de nuestro catálogo</option>
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.codigo_interno} - {p.descripcion}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.rowTwo}>
                    <div style={styles.fieldWrap}>
                      <label style={styles.label}>Unidad Interna</label>
                      <select
                        value={formProductoUnidadId}
                        onChange={(e) => setFormProductoUnidadId(e.target.value)}
                        style={styles.selectLg}
                        required
                        disabled={productoUnidades.length === 0}
                      >
                        {productoUnidades.map((pu) => (
                          <option key={pu.id} value={pu.id}>
                            {pu.unidad_codigo} (Factor: {pu.factor_a_base}) {pu.es_base ? '★ Base' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={styles.fieldWrap}>
                      <label style={styles.label}>Factor de Conversión (*)</label>
                      <input
                        type="number"
                        step="0.00000001"
                        min="0.00000001"
                        value={formFactor}
                        onChange={(e) => setFormFactor(e.target.value)}
                        style={styles.inputLg}
                        required
                      />
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        1 Unidad Externa = {formFactor} Unidades Internas
                      </span>
                    </div>
                  </div>

                  <div style={styles.modalFooter}>
                    <button
                      type="button"
                      onClick={() => setShowEquivModal(false)}
                      style={styles.secondaryBtn}
                    >
                      Cancelar
                    </button>
                    <button type="submit" disabled={loading} style={styles.primaryBtn}>
                      {loading ? 'Confirmando…' : '✅ Confirmar Homologación'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal Probar Sugerencia */}
          {showSugerirModal && (
            <div style={styles.modalOverlay}>
              <div style={styles.modalContent}>
                <div style={styles.modalHeader}>
                  <h3 style={styles.modalTitle}>Probador de Sugerencia Automática de Homologación</h3>
                  <button type="button" onClick={() => setShowSugerirModal(false)} style={styles.closeBtn}>
                    ✖
                  </button>
                </div>

                <form onSubmit={handleProbarSugerencia} style={styles.modalForm}>
                  <div style={styles.fieldWrap}>
                    <label style={styles.label}>Proveedor (*)</label>
                    <select
                      value={testTerceroId}
                      onChange={(e) => setTestTerceroId(e.target.value)}
                      style={styles.selectLg}
                      required
                    >
                      <option value="">Seleccione proveedor</option>
                      {terceros.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.numero_documento} - {t.razon_social}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.fieldWrap}>
                    <label style={styles.label}>Código Externo</label>
                    <input
                      type="text"
                      placeholder="Ej. SKU-PROV-A"
                      value={testCodigoExt}
                      onChange={(e) => setTestCodigoExt(e.target.value)}
                      style={styles.inputLg}
                    />
                  </div>

                  <div style={styles.fieldWrap}>
                    <label style={styles.label}>Descripción Externa</label>
                    <input
                      type="text"
                      placeholder="Ej. TALADRO ACERO 500W"
                      value={testDescExt}
                      onChange={(e) => setTestDescExt(e.target.value)}
                      style={styles.inputLg}
                    />
                  </div>

                  <button type="submit" disabled={loading} style={styles.primaryBtn}>
                    🔍 Consultar Motor de Sugerencia
                  </button>
                </form>

                {sugerenciaResultado && (
                  <div style={{ marginTop: '16px', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
                    <strong>Resultado:</strong>
                    {sugerenciaResultado.encontrado ? (
                      <div style={{ color: '#166534', marginTop: '6px' }}>
                        ✅ {sugerenciaResultado.mensaje}
                        <div style={{ marginTop: '4px', fontSize: '13px' }}>
                          Producto Vinculado:{' '}
                          <strong>
                            {sugerenciaResultado.sugerencia.producto_info?.producto_codigo} -{' '}
                            {sugerenciaResultado.sugerencia.producto_info?.producto_descripcion}
                          </strong>{' '}
                          (Factor: {sugerenciaResultado.sugerencia.factor_conversion})
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: '#991b1b', marginTop: '6px' }}>
                        ⚠️ {sugerenciaResultado.mensaje}
                        <div style={{ fontSize: '12px', marginTop: '4px' }}>
                          Estado retornado: <code>{sugerenciaResultado.estado}</code> (generaría incidencia).
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    color: '#0f172a',
    maxWidth: '1440px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '16px',
  },
  titleWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  badgeHeader: {
    alignSelf: 'flex-start',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.05em',
    background: '#e0e7ff',
    color: '#3730a3',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: 0,
    fontSize: '13px',
    color: '#64748b',
  },
  tabBar: {
    display: 'flex',
    gap: '8px',
    background: '#f1f5f9',
    padding: '4px',
    borderRadius: '8px',
  },
  tabActive: {
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 700,
    borderRadius: '6px',
    background: '#ffffff',
    color: '#0f172a',
    border: 'none',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
    cursor: 'pointer',
  },
  tabInactive: {
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    borderRadius: '6px',
    background: 'transparent',
    color: '#64748b',
    border: 'none',
    cursor: 'pointer',
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
  },
  cardTitle: {
    margin: '0 0 4px',
    fontSize: '16px',
    fontWeight: 700,
    color: '#0f172a',
  },
  cardSubtitle: {
    margin: '0 0 16px',
    fontSize: '13px',
    color: '#64748b',
  },
  uploadForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  uploadRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    alignItems: 'center',
  },
  fieldWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: '220px',
    flex: 1,
  },
  label: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#334155',
  },
  fileInput: {
    fontSize: '13px',
    padding: '6px 8px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    background: '#f8fafc',
  },
  fileHint: {
    fontSize: '11px',
    color: '#0369a1',
  },
  tipoBtnGroup: {
    display: 'flex',
    gap: '6px',
  },
  tipoBtn: {
    padding: '7px 12px',
    fontSize: '12px',
    fontWeight: 600,
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#475569',
    cursor: 'pointer',
  },
  tipoBtnActive: {
    padding: '7px 12px',
    fontSize: '12px',
    fontWeight: 700,
    borderRadius: '6px',
    border: '1px solid #047857',
    background: '#ecfdf5',
    color: '#065f46',
    cursor: 'pointer',
  },
  textArea: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '13px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  primaryBtn: {
    padding: '10px 18px',
    fontSize: '13px',
    fontWeight: 700,
    borderRadius: '6px',
    background: '#047857',
    color: '#ffffff',
    border: 'none',
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '10px 18px',
    fontSize: '13px',
    fontWeight: 700,
    borderRadius: '6px',
    background: '#f1f5f9',
    color: '#334155',
    border: '1px solid #cbd5e1',
    cursor: 'pointer',
  },
  masterDetailGrid: {
    display: 'grid',
    gridTemplateColumns: '320px 1fr',
    gap: '20px',
    alignItems: 'flex-start',
  },
  listPanel: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  panelTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 700,
  },
  smallRefreshBtn: {
    fontSize: '11px',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    cursor: 'pointer',
  },
  capturasScrollList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '680px',
    overflowY: 'auto',
  },
  capturaCard: {
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    cursor: 'pointer',
    background: '#ffffff',
    transition: 'all 0.15s ease',
  },
  capturaCardSelected: {
    padding: '10px 12px',
    border: '1px solid #047857',
    borderRadius: '6px',
    cursor: 'pointer',
    background: '#f0fdf4',
  },
  capturaCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  tipoTag: {
    fontSize: '10px',
    fontWeight: 800,
    padding: '1px 6px',
    borderRadius: '3px',
    background: '#e2e8f0',
    color: '#1e293b',
  },
  statusDraftTag: {
    fontSize: '10px',
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: '3px',
    background: '#dcfce7',
    color: '#166534',
  },
  statusProcTag: {
    fontSize: '10px',
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: '3px',
    background: '#fef3c7',
    color: '#92400e',
  },
  capturaCardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  capturaRuta: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#0f172a',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  capturaHash: {
    fontSize: '11px',
    color: '#64748b',
  },
  capturaMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#94a3b8',
    marginTop: '2px',
  },
  detailPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  placeholderEmpty: {
    padding: '60px 20px',
    textAlign: 'center',
    background: '#ffffff',
    border: '1px dashed #cbd5e1',
    borderRadius: '10px',
    color: '#64748b',
  },
  actionBanner: {
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
  },
  actionBannerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  actionBannerTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#0f172a',
  },
  docGeneradoBadge: {
    fontSize: '12px',
    color: '#166534',
    background: '#dcfce7',
    padding: '3px 8px',
    borderRadius: '4px',
    alignSelf: 'flex-start',
  },
  docPendienteBadge: {
    fontSize: '12px',
    color: '#b45309',
    background: '#fef3c7',
    padding: '3px 8px',
    borderRadius: '4px',
    alignSelf: 'flex-start',
  },
  actionBannerControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  selectSm: {
    fontSize: '12px',
    padding: '7px 10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
  },
  convertirBtn: {
    padding: '10px 18px',
    fontSize: '13px',
    fontWeight: 700,
    borderRadius: '6px',
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
  },
  btnDisabled: {
    padding: '10px 18px',
    fontSize: '13px',
    fontWeight: 700,
    borderRadius: '6px',
    background: '#e2e8f0',
    color: '#94a3b8',
    border: 'none',
    cursor: 'not-allowed',
  },
  borradorAvisoBox: {
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: '8px',
    padding: '14px 18px',
    color: '#065f46',
    fontSize: '13px',
  },
  incidenciaAviso: {
    marginTop: '6px',
    fontSize: '12px',
    color: '#991b1b',
    background: '#fee2e2',
    padding: '6px 10px',
    borderRadius: '4px',
  },
  sectionHeaderTitle: {
    margin: '0 0 14px',
    fontSize: '14px',
    fontWeight: 700,
    color: '#0f172a',
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: '8px',
  },
  cabeceraGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '12px',
  },
  campoItem: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  campoLabelWrap: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  campoLabel: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#64748b',
    letterSpacing: '0.04em',
  },
  confBadge: {
    fontSize: '10px',
    fontWeight: 800,
    padding: '1px 5px',
    borderRadius: '3px',
    fontVariantNumeric: 'tabular-nums',
  },
  badgeMuted: {
    fontSize: '10px',
    padding: '1px 5px',
    borderRadius: '3px',
    background: '#e2e8f0',
    color: '#64748b',
  },
  campoValorWrap: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  campoValor: {
    fontSize: '13px',
    color: '#0f172a',
    wordBreak: 'break-all',
  },
  corregidoTag: {
    fontSize: '11px',
    color: '#b45309',
    fontWeight: 700,
  },
  originalSub: {
    fontSize: '11px',
    color: '#94a3b8',
    textDecoration: 'line-through',
  },
  btnEditIcon: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '2px 4px',
  },
  inlineEditWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  inputInline: {
    flex: 1,
    padding: '4px 6px',
    fontSize: '12px',
    borderRadius: '4px',
    border: '1px solid #2563eb',
  },
  btnSaveInline: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: 'none',
    background: '#047857',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '11px',
  },
  btnCancelInline: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    cursor: 'pointer',
    fontSize: '11px',
  },
  tableScroll: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    background: '#f8fafc',
    borderBottom: '2px solid #e2e8f0',
    fontSize: '12px',
    fontWeight: 700,
    color: '#475569',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '10px 12px',
    color: '#0f172a',
  },
  codeText: {
    background: '#f1f5f9',
    padding: '2px 5px',
    borderRadius: '3px',
    fontSize: '12px',
    color: '#0f172a',
  },
  linkBtn: {
    background: 'transparent',
    border: '1px solid #047857',
    color: '#047857',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  subtext: {
    display: 'block',
    fontSize: '11px',
    color: '#64748b',
    marginTop: '2px',
  },
  equivFilterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    alignItems: 'flex-end',
  },
  selectLg: {
    padding: '9px 12px',
    fontSize: '13px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
  },
  inputLg: {
    padding: '9px 12px',
    fontSize: '13px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    boxSizing: 'border-box',
  },
  badgeActive: {
    fontSize: '10px',
    fontWeight: 800,
    padding: '2px 6px',
    borderRadius: '4px',
    background: '#dcfce7',
    color: '#15803d',
  },
  badgeInactive: {
    fontSize: '10px',
    fontWeight: 800,
    padding: '2px 6px',
    borderRadius: '4px',
    background: '#fee2e2',
    color: '#b91c1c',
  },
  toggleBtn: {
    fontSize: '11px',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    cursor: 'pointer',
  },
  emptyText: {
    textAlign: 'center',
    padding: '30px 10px',
    color: '#64748b',
    fontSize: '13px',
  },
  alertError: {
    padding: '12px 16px',
    borderRadius: '8px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#991b1b',
    fontSize: '13px',
  },
  alertSuccess: {
    padding: '12px 16px',
    borderRadius: '8px',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#166534',
    fontSize: '13px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  modalContent: {
    background: '#ffffff',
    borderRadius: '10px',
    padding: '24px',
    width: '100%',
    maxWidth: '560px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  modalTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 800,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: '16px',
    cursor: 'pointer',
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  rowTwo: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  divider: {
    height: '1px',
    background: '#e2e8f0',
    margin: '4px 0',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '12px',
  },
};

export default CapturaHomologacionPage;
