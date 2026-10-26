import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG_VISTAS, claseInicialNuevo, filtrosApiDocumentos, tiposComprobanteDeVista } from './vistaDocumentos.ts';

const usuario = { clase: 'VENTA' as const, periodo: 3, estado: 'CONFIRMADO', search: 'F001' };

test('Comprobantes (TODOS) envía exactamente los filtros del usuario: no cambia nada', () => {
  assert.deepEqual(filtrosApiDocumentos('TODOS', usuario), usuario);
  assert.deepEqual(filtrosApiDocumentos('TODOS', {}), {});
  assert.equal(claseInicialNuevo('TODOS', 'VENTA'), 'VENTA');
});

test('Compras y Ventas reutilizan el listado con clase fija y sin notas', () => {
  assert.deepEqual(filtrosApiDocumentos('COMPRA', usuario), { ...usuario, clase: 'COMPRA', es_nota: false });
  assert.deepEqual(filtrosApiDocumentos('VENTA', { periodo: 3 }), { periodo: 3, clase: 'VENTA', es_nota: false });
  assert.equal(claseInicialNuevo('COMPRA', 'VENTA'), 'COMPRA');
  assert.equal(claseInicialNuevo('VENTA', 'COMPRA'), 'VENTA');
  assert.equal(CONFIG_VISTAS.COMPRA.botonNuevo, 'Nueva Compra');
});

test('Notas: solo notas, de compra o de venta', () => {
  assert.deepEqual(filtrosApiDocumentos('NOTAS', { clase: 'COMPRA' }), { clase: 'COMPRA', es_nota: true });
  assert.deepEqual(filtrosApiDocumentos('NOTAS', {}), { es_nota: true });
});

test('el formulario ofrece los tipos de comprobante de la vista', () => {
  const tipos = [{ id: 1, es_nota: false }, { id: 7, es_nota: true }, { id: 8, es_nota: true }];
  assert.deepEqual(tiposComprobanteDeVista('TODOS', tipos).map((t) => t.id), [1, 7, 8]);
  assert.deepEqual(tiposComprobanteDeVista('COMPRA', tipos).map((t) => t.id), [1]);
  assert.deepEqual(tiposComprobanteDeVista('NOTAS', tipos).map((t) => t.id), [7, 8]);
});
