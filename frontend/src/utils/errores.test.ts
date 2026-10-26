import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensajeDeError } from './errores.ts';

const err = (data: unknown) => ({ response: { data } });

test('usa el primer campo con contenido en el orden indicado', () => {
  assert.equal(mensajeDeError(err({ detail: 'D', archivo: 'A' }), ['archivo', 'detail'], 'x'), 'A');
  assert.equal(mensajeDeError(err({ detail: 'D' }), ['archivo', 'detail'], 'x'), 'D');
});

test('une las listas de errores de DRF', () => {
  assert.equal(mensajeDeError(err({ periodo: ['Periodo cerrado.', 'Otro.'] }), ['detail', 'periodo'], 'x'), 'Periodo cerrado. Otro.');
});

test('sin respuesta o sin campos conocidos usa el texto por defecto', () => {
  assert.equal(mensajeDeError(new Error('red'), ['detail'], 'Por defecto'), 'Por defecto');
  assert.equal(mensajeDeError(null, ['detail'], 'Por defecto'), 'Por defecto');
  assert.equal(mensajeDeError(err({ detail: '' }), ['detail'], 'Por defecto'), 'Por defecto');
  assert.equal(mensajeDeError(err('texto plano'), ['detail'], 'Por defecto'), 'Por defecto');
});
