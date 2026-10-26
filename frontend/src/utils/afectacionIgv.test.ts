/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { AFECTACIONES_IGV, igvEditable, igvSugerido } from './afectacionIgv.ts';

test('gravado sugiere 18 % por defecto', () => {
  assert.equal(igvSugerido('GRAVADO', '10', '10'), '18.00000000');
});

test('gravado usa la tasa configurada de la empresa', () => {
  assert.equal(igvSugerido('GRAVADO', '10', '10', '10.00'), '10.00000000');
  assert.equal(igvSugerido('EXONERADO', '10', '10', '10.00'), '0.00000000');
  assert.equal(igvSugerido('GRATUITO', '10', '10', '10.00'), null);
});

for (const afectacion of ['EXONERADO', 'INAFECTO', 'EXPORTACION'] as const) {
  test(`${afectacion} lleva IGV 0 y no es editable`, () => {
    assert.equal(igvSugerido(afectacion, '10', '10'), '0.00000000');
    assert.equal(igvEditable(afectacion), false);
  });
}

test('gratuito no sobrescribe el IGV ingresado', () => {
  assert.equal(igvSugerido('GRATUITO', '10', '10'), null);
  assert.equal(igvEditable('GRATUITO'), true);
});

test('las opciones coinciden con las del backend', () => {
  assert.deepEqual(AFECTACIONES_IGV.map((a) => a.valor), ['GRAVADO', 'EXONERADO', 'INAFECTO', 'EXPORTACION', 'GRATUITO']);
});
