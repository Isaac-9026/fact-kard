/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { AFECTACIONES_IGV, igvEditable, igvSugerido, tasaVigente } from './afectacionIgv.ts';

test('tasa vigente según la fecha del comprobante', () => {
  const tasas = [{ vigente_desde: '1900-01-01', tasa_pct: '18.00' }, { vigente_desde: '2026-01-15', tasa_pct: '10.00' }];
  assert.equal(tasaVigente(tasas, '2026-01-14', '10.00'), '18.00');
  assert.equal(tasaVigente(tasas, '2026-01-15', '10.00'), '10.00');
  assert.equal(tasaVigente([], '2026-01-14', '18.00'), '18.00');
  assert.equal(tasaVigente(undefined, '2026-01-14', '18.00'), '18.00');
});

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
