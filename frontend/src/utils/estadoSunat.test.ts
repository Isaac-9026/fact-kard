import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filasEstadoSunat } from './estadoSunat.ts';

test('configuración vacía: todo pendiente', () => {
  const filas = filasEstadoSunat({ ambiente: 'beta', configurado: false, certificado_configurado: false, credenciales_configuradas: false });
  assert.deepEqual(filas.map((f) => [f.etiqueta, f.valor, f.ok]), [
    ['Ambiente', 'Beta (pruebas)', true],
    ['Credenciales SOL', 'No configuradas', false],
    ['Certificado digital', 'No configurado', false],
    ['Estado', 'Pendiente', false],
  ]);
});

test('configuración completa en producción', () => {
  const filas = filasEstadoSunat({ ambiente: 'produccion', configurado: true, certificado_configurado: true, credenciales_configuradas: true, credenciales_corresponden_a_empresa: true });
  assert.deepEqual(filas.map((f) => f.valor), ['Producción', 'Configuradas', 'Configurado', 'Preparado (sin conexión aún)']);
  assert.ok(filas.every((f) => f.ok));
});

test('credenciales de otro RUC y ambiente inválido se señalan', () => {
  const filas = filasEstadoSunat({ ambiente: null, configurado: false, certificado_configurado: true, credenciales_configuradas: true, credenciales_corresponden_a_empresa: false });
  assert.equal(filas[0].valor, 'No válido');
  assert.ok(filas.some((f) => f.valor === 'Pertenecen a otro RUC' && !f.ok));
});

test('la tarjeta de preparación SUNAT no pide ni muestra credenciales', async () => {
  const { readFileSync } = await import('node:fs');
  const fuente = readFileSync(new URL('../components/tributario/PreparacionSunatCard.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(fuente, /<input|type="password"|<Input/);
  const api = readFileSync(new URL('../api/empresas.ts', import.meta.url), 'utf8');
  const tipo = api.slice(api.indexOf('export interface EstadoSunat'), api.indexOf('export const obtenerEstadoSunat'));
  assert.doesNotMatch(tipo, /clave|password|usuario_sol|certificado_path|contenido/i);
});
