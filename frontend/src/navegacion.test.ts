import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ACCESOS_RAPIDOS, NAV_SECCIONES, RUTA_INICIAL, RUTAS_ANTERIORES, destinoInicial, itemActivo, todasLasRutasDelMenu,
} from './navegacion.ts';
import { resolverAccesoRuta } from './utils/sesion.ts';

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const login = readFileSync(new URL('./pages/auth/LoginPage.tsx', import.meta.url), 'utf8');
const rutasDeApp = new Set([...app.matchAll(/<Route path="([^"*]+)"/g)].map((m) => `/${m[1].replace(/^\//, '')}`));

test('Dashboard es la ruta inicial: raíz, rutas desconocidas y después del login', () => {
  assert.equal(RUTA_INICIAL, '/dashboard');
  assert.match(app, /<Route index element={<Navigate to={RUTA_INICIAL} replace \/>} \/>/);
  assert.match(app, /<Route path="\*" element={<Navigate to={RUTA_INICIAL} replace \/>} \/>/);
  assert.match(login, /navigate\(RUTA_INICIAL\)/);
  assert.ok(rutasDeApp.has('/dashboard'));
});

test('usuario autenticado entra al Dashboard', () => {
  assert.equal(destinoInicial({ token: 'tk' }), '/dashboard');
  assert.equal(resolverAccesoRuta({ token: 'tk', verificandoSesion: false }), 'permitido');
});

test('usuario no autenticado sigue yendo a login', () => {
  assert.equal(destinoInicial({ token: null }), '/login');
  assert.equal(resolverAccesoRuta({ token: null, verificandoSesion: false }), 'redirigir_login');
  // El Dashboard está dentro de las rutas protegidas (RutaProtegida).
  assert.ok(app.indexOf('<Route element={<RutaProtegida />}>') < app.indexOf('path="dashboard"'));
});

test('menú con las secciones y opciones en el orden del flujo', () => {
  assert.deepEqual(
    NAV_SECCIONES.map((s) => [s.title, s.items.map((i) => i.label)]),
    [
      ['INICIO', ['Dashboard']],
      ['CONFIGURACIÓN', ['Empresas y Anexos', 'Períodos e IGV', 'Catálogos y TC SBS']],
      ['MAESTROS', ['Productos y Unidades', 'Almacenes', 'Terceros']],
      ['INVENTARIO INICIAL', ['Saldo Inicial', 'Inventario']],
      ['OPERACIONES', ['Compras', 'Ventas', 'Comprobantes', 'Notas de Crédito / Débito', 'Transferencias', 'Captura XML / OCR']],
      ['KARDEX', ['Kardex Valorizado', 'Incidencias y Recálculo']],
      ['CIERRE Y REPORTES', ['Cierres y Snapshots', 'Formato 13.1 SUNAT']],
      ['SEGURIDAD', ['Auditoría Inmutable']],
    ],
  );
});

test('cada opción del menú tiene ruta, sin duplicados, y resalta la opción activa', () => {
  const rutas = todasLasRutasDelMenu();
  assert.equal(new Set(rutas).size, rutas.length);
  for (const ruta of rutas) assert.ok(rutasDeApp.has(ruta), `falta la ruta ${ruta} en App.tsx`);
  assert.equal(itemActivo('/compras')?.item.label, 'Compras');
  assert.equal(itemActivo('/documentos')?.item.label, 'Comprobantes');
  assert.equal(itemActivo('/notas')?.seccion.title, 'OPERACIONES');
  assert.equal(itemActivo('/inventario')?.seccion.title, 'INVENTARIO INICIAL');
  assert.equal(itemActivo('/no-existe'), null);
  // /compras no activa /comprobantes ni al revés (coincidencia exacta o por segmento).
  assert.equal(itemActivo('/comprasx'), null);
});

test('accesos rápidos navegan a rutas existentes', () => {
  assert.deepEqual(ACCESOS_RAPIDOS.map((a) => [a.label, a.to]), [
    ['Nueva compra', '/compras?nuevo=1'],
    ['Nueva venta', '/ventas?nuevo=1'],
    ['Ver Kardex', '/kardex'],
    ['Ver incidencias', '/incidencias'],
  ]);
  for (const a of ACCESOS_RAPIDOS) assert.ok(rutasDeApp.has(a.to.split('?')[0]), a.to);
});

test('rutas anteriores redirigen a su nueva ubicación', () => {
  assert.equal(RUTAS_ANTERIORES['/operaciones-internas'], '/saldo-inicial');
  assert.ok(rutasDeApp.has('/saldo-inicial'));
});
