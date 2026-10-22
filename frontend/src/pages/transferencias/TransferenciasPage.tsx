import React, { useCallback, useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { getAlmacenes, getProductos, type Almacen, type Producto } from '../../api/inventario';
import { confirmarTransferencia, createTransferencia, getTransferencias, type Transferencia } from '../../api/transferencias';
import { useAuth } from '../../context/AuthContext';
import { fechaCalendarioFormulario, fechaCalendarioLocal } from '../../utils/date';

interface LineaTransferencia {
  producto: string;
  cantidad_base: string;
}

const lineaVacia = (): LineaTransferencia => ({ producto: '', cantidad_base: '' });

const errorApi = (error: unknown): string => {
  if (!axios.isAxiosError(error)) return 'No se pudo completar la operación.';
  const data = error.response?.data;
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    return Object.entries(data)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : String(v)}`)
      .join(' | ');
  }
  return 'No se pudo completar la operación.';
};

export const TransferenciasPage: React.FC = () => {
  const { empresaActiva } = useAuth();
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [form, setForm] = useState({
    almacen_origen: '',
    almacen_destino: '',
    fecha: fechaCalendarioLocal(),
    detalles: [lineaVacia()],
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaActiva) return;
    setLoading(true);
    try {
      const [lista, nuevosAlmacenes, nuevosProductos] = await Promise.all([
        getTransferencias(),
        getAlmacenes(),
        getProductos(),
      ]);
      setTransferencias(lista);
      setAlmacenes(nuevosAlmacenes);
      setProductos(nuevosProductos);
    } catch (err) {
      setError(errorApi(err));
    } finally {
      setLoading(false);
    }
  }, [empresaActiva?.id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const fecha = fechaCalendarioFormulario(new FormData(event.currentTarget).get('fecha'));

    if (!form.almacen_origen || !form.almacen_destino) {
      setError('Debe seleccionar los almacenes de origen y destino.');
      return;
    }

    if (form.almacen_origen === form.almacen_destino) {
      setError('El almacén destino debe ser distinto del almacén origen.');
      return;
    }

    if (!fecha) {
      setError('Debe ingresar la fecha de transferencia con formato YYYY-MM-DD.');
      return;
    }

    const lineasValidas = form.detalles.filter(
      (l) => l.producto && parseFloat(l.cantidad_base) > 0
    );

    if (lineasValidas.length === 0) {
      setError('Debe ingresar al menos un producto con cantidad mayor a 0.');
      return;
    }

    setSaving(true);
    try {
      await createTransferencia({
        almacen_origen: Number(form.almacen_origen),
        almacen_destino: Number(form.almacen_destino),
        fecha,
        detalles: lineasValidas.map((l) => ({
          producto: Number(l.producto),
          cantidad_base: l.cantidad_base,
        })),
      });
      setForm({
        almacen_origen: '',
        almacen_destino: '',
        fecha: fechaCalendarioLocal(),
        detalles: [lineaVacia()],
      });
      setSuccess('Transferencia creada exitosamente en estado BORRADOR.');
      await cargar();
    } catch (err) {
      setError(errorApi(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmar = async (transferencia: Transferencia) => {
    if (
      !window.confirm(
        `¿Confirmar el traslado #${transferencia.id}? Se generará la salida en ${transferencia.almacen_origen_nombre} y la entrada en ${transferencia.almacen_destino_nombre} sin alterar el CPP global.`
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await confirmarTransferencia(transferencia.id);
      setSuccess(`Traslado #${transferencia.id} confirmado correctamente.`);
      await cargar();
    } catch (err) {
      setError(errorApi(err));
    } finally {
      setSaving(false);
    }
  };

  const actualizarLinea = (indice: number, campo: keyof LineaTransferencia, valor: string) => {
    setForm((actual) => ({
      ...actual,
      detalles: actual.detalles.map((linea, posicion) =>
        posicion === indice ? { ...linea, [campo]: valor } : linea
      ),
    }));
  };

  return (
    <div style={styles.page}>
      {/* Encabezado */}
      <header style={styles.header}>
        <div>
          <div style={styles.badgeRow}>
            <span style={styles.badgePrimary}>MÓDULO DE OPERACIONES</span>
            <span style={styles.badgeNeutral}>Fase 7 · Motor Kardex</span>
          </div>
          <h1 style={styles.title}>Transferencias entre Almacenes</h1>
          <p style={styles.subtitle}>
            Traslados atómicos de inventario sin alteración del CPP global — {empresaActiva?.razon_social ?? 'Empresa Activa'}
          </p>
        </div>
      </header>

      {/* Alertas */}
      {error && (
        <div style={styles.alertError} role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}
      {success && (
        <div style={styles.alertSuccess} role="status">
          <strong>Éxito:</strong> {success}
        </div>
      )}

      {/* Formulario Maestro-Detalle */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.cardIconWrap}>
            <span>🔄</span>
          </div>
          <div>
            <h2 style={styles.cardTitle}>Nueva Transferencia de Inventario</h2>
            <p style={styles.cardSubtitle}>
              Registre el traslado en estado BORRADOR y confírmelo cuando el stock esté verificado.
            </p>
          </div>
        </div>

        <form onSubmit={guardar} style={styles.form}>
          <div style={styles.formRow3}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Almacén Origen (Salida) *</label>
              <select
                required
                style={styles.select}
                value={form.almacen_origen}
                onChange={(e) => setForm((actual) => ({ ...actual, almacen_origen: e.target.value }))}
              >
                <option value="">Seleccione almacén origen</option>
                {almacenes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.codigo} — {a.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Almacén Destino (Entrada) *</label>
              <select
                required
                style={styles.select}
                value={form.almacen_destino}
                onChange={(e) => setForm((actual) => ({ ...actual, almacen_destino: e.target.value }))}
              >
                <option value="">Seleccione almacén destino</option>
                {almacenes.map((a) => (
                  <option
                    key={a.id}
                    value={a.id}
                    disabled={String(a.id) === form.almacen_origen}
                  >
                    {a.codigo} — {a.nombre} {String(a.id) === form.almacen_origen ? '(Mismo almacén)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Fecha de Traslado *</label>
              <input
                required
                name="fecha"
                type="date"
                style={styles.input}
                value={form.fecha}
                onChange={(e) => setForm((actual) => ({ ...actual, fecha: e.target.value }))}
              />
            </div>
          </div>

          {/* Líneas de productos */}
          <div style={styles.detallesHeader}>
            <h3 style={styles.detallesTitle}>Productos a Trasladar</h3>
            <span style={styles.detallesHint}>
              La salida descuenta del almacén origen y suma al almacén destino con su costo vigente.
            </span>
          </div>

          <div style={styles.linesList}>
            {form.detalles.map((linea, indice) => (
              <div key={indice} style={styles.lineItem}>
                <span style={styles.lineIndex}>#{indice + 1}</span>

                <div style={{ flex: 3 }}>
                  <select
                    required
                    style={styles.select}
                    value={linea.producto}
                    onChange={(e) => actualizarLinea(indice, 'producto', e.target.value)}
                  >
                    <option value="">Seleccione producto</option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.codigo_interno} — {p.descripcion}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: 1.5 }}>
                  <input
                    required
                    type="text"
                    inputMode="decimal"
                    placeholder="Cantidad (ej: 10.5)"
                    style={styles.input}
                    value={linea.cantidad_base}
                    onChange={(e) => actualizarLinea(indice, 'cantidad_base', e.target.value)}
                  />
                </div>

                {form.detalles.length > 1 && (
                  <button
                    type="button"
                    style={styles.btnRemove}
                    onClick={() =>
                      setForm((actual) => ({
                        ...actual,
                        detalles: actual.detalles.filter((_, pos) => pos !== indice),
                      }))
                    }
                    title="Quitar producto"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <div style={styles.formActions}>
            <button
              type="button"
              style={styles.btnSecondary}
              onClick={() => setForm((actual) => ({ ...actual, detalles: [...actual.detalles, lineaVacia()] }))}
            >
              + Agregar otro producto
            </button>

            <button type="submit" disabled={saving} style={styles.btnPrimary}>
              {saving ? 'Guardando...' : 'Crear Transferencia (Borrador)'}
            </button>
          </div>
        </form>
      </div>

      {/* Listado de Transferencias */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.cardIconWrap}>
            <span>📋</span>
          </div>
          <div>
            <h2 style={styles.cardTitle}>Historial de Transferencias ({transferencias.length})</h2>
            <p style={styles.cardSubtitle}>
              Listado de traslados registrados y estado de confirmación en el motor Kardex.
            </p>
          </div>
        </div>

        {loading ? (
          <div style={styles.emptyWrap}>Cargando transferencias...</div>
        ) : transferencias.length === 0 ? (
          <div style={styles.emptyWrap}>
            <p style={{ margin: 0, fontWeight: 600 }}>No hay transferencias registradas.</p>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Utilice el formulario superior para registrar su primer traslado de inventario.
            </span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Fecha</th>
                  <th style={styles.th}>Almacén Origen</th>
                  <th style={styles.th}>Almacén Destino</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Líneas</th>
                  <th style={styles.th}>Estado</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {transferencias.map((t) => (
                  <tr key={t.id} style={styles.tr}>
                    <td style={{ ...styles.td, fontWeight: 700, fontFamily: 'monospace' }}>
                      #{t.id}
                    </td>
                    <td style={styles.td}>{t.fecha}</td>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{t.almacen_origen_nombre}</td>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{t.almacen_destino_nombre}</td>
                    <td style={{ ...styles.td, textAlign: 'center', fontFamily: 'monospace' }}>
                      {t.numero_lineas}
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badgeBase,
                          ...(t.estado === 'CONFIRMADO'
                            ? styles.badgeConfirmado
                            : t.estado === 'ANULADO'
                            ? styles.badgeAnulado
                            : styles.badgeBorrador),
                        }}
                      >
                        {t.estado}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {t.estado === 'BORRADOR' ? (
                        <button
                          type="button"
                          disabled={saving}
                          style={styles.btnConfirmar}
                          onClick={() => void confirmar(t)}
                        >
                          Confirmar Traslado
                        </button>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    color: '#0f172a', // Slate 900 explicitly
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '12px',
  },
  badgeRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '6px',
  },
  badgePrimary: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: '#1d4ed8',
    backgroundColor: '#dbeafe',
    padding: '3px 8px',
    borderRadius: '6px',
    textTransform: 'uppercase',
  },
  badgeNeutral: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#475569',
    backgroundColor: '#e2e8f0',
    padding: '3px 8px',
    borderRadius: '6px',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: '14px',
    color: '#475569',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    paddingBottom: '16px',
    borderBottom: '1px solid #f1f5f9',
  },
  cardIconWrap: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    backgroundColor: '#eff6ff',
    color: '#2563eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 700,
    color: '#0f172a',
  },
  cardSubtitle: {
    margin: '3px 0 0 0',
    fontSize: '13px',
    color: '#64748b',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formRow3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  select: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '13px',
    outline: 'none',
    width: '100%',
  },
  input: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '13px',
    outline: 'none',
    width: '100%',
  },
  detallesHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderTop: '1px solid #f1f5f9',
    paddingTop: '14px',
    flexWrap: 'wrap',
    gap: '6px',
  },
  detallesTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 700,
    color: '#0f172a',
  },
  detallesHint: {
    fontSize: '12px',
    color: '#64748b',
  },
  linesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  lineItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#f8fafc',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  lineIndex: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#64748b',
    width: '24px',
    textAlign: 'center',
  },
  btnRemove: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    border: '1px solid #fca5a5',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid #f1f5f9',
    paddingTop: '16px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  btnPrimary: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '13px',
    padding: '9px 18px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
  },
  btnSecondary: {
    backgroundColor: '#ffffff',
    color: '#334155',
    fontWeight: 600,
    fontSize: '13px',
    padding: '8px 14px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    cursor: 'pointer',
  },
  btnConfirmar: {
    backgroundColor: '#16a34a',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '12px',
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    textAlign: 'left',
  },
  th: {
    backgroundColor: '#f8fafc',
    color: '#475569',
    fontWeight: 700,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '10px 14px',
    borderBottom: '1px solid #e2e8f0',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '12px 14px',
    color: '#1e293b',
    verticalAlign: 'middle',
  },
  badgeBase: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  badgeBorrador: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    border: '1px solid #fde68a',
  },
  badgeConfirmado: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    border: '1px solid #bbf7d0',
  },
  badgeAnulado: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    border: '1px solid #fecaca',
  },
  alertError: {
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fecaca',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '13px',
  },
  alertSuccess: {
    backgroundColor: '#f0fdf4',
    color: '#166534',
    border: '1px solid #bbf7d0',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '13px',
  },
  emptyWrap: {
    padding: '36px 16px',
    textAlign: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px dashed #cbd5e1',
    color: '#475569',
  },
};

export default TransferenciasPage;
