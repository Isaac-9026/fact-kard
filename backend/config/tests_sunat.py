"""
Bloque 17B — seguridad y preparación pre-SUNAT (sin conexión, sin credenciales reales).

Todas las credenciales de estas pruebas son FALSAS y se inyectan con override_settings; el
certificado es un archivo temporal con bytes de relleno fuera del repositorio.
"""
import json
import logging
import pickle
import shutil
import subprocess
import tempfile
from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.catalogos.models import Moneda
from apps.empresas.models import Empresa
from apps.usuarios.models import Usuario, UsuarioEmpresa
from config.registro import ENMASCARADO, FiltroDatosSensibles, enmascarar
from config.sunat import (
    FiltroReporteExcepciones, Secreto, leer_configuracion_sunat, validar_configuracion_sunat,
)

RAIZ_REPO = Path(settings.BASE_DIR).resolve().parent
USUARIO_FALSO = '20100100100FAKEUSER'
CLAVE_FALSA = 'ClaveSolFalsa-123'
PASSWORD_PFX_FALSA = 'PfxPasswordFalsa-456'
CONTENIDO_CERT_FALSO = b'CONTENIDO-CERTIFICADO-FALSO-NO-ES-PFX'


class CertificadoTemporal:
    """Crea un .pfx de relleno FUERA del repositorio y devuelve su ruta."""
    def __enter__(self):
        self.dir = Path(tempfile.mkdtemp(prefix='fk_sunat_test_'))
        self.ruta = self.dir / 'certificado_prueba.pfx'
        self.ruta.write_bytes(CONTENIDO_CERT_FALSO)
        return self.ruta

    def __exit__(self, *exc):
        shutil.rmtree(self.dir, ignore_errors=True)


def config_completa(ruta, **extra):
    return {'SUNAT_AMBIENTE': 'beta', 'SUNAT_USUARIO_SOL': Secreto(USUARIO_FALSO), 'SUNAT_CLAVE_SOL': Secreto(CLAVE_FALSA),
            'SUNAT_CERTIFICADO_PATH': str(ruta), 'SUNAT_CERTIFICADO_PASSWORD': Secreto(PASSWORD_PFX_FALSA), **extra}


CONFIG_VACIA = dict(SUNAT_AMBIENTE='beta', SUNAT_USUARIO_SOL=Secreto(''), SUNAT_CLAVE_SOL=Secreto(''),
                    SUNAT_CERTIFICADO_PATH='', SUNAT_CERTIFICADO_PASSWORD=Secreto(''))


# =============================================================================================
class ValidacionConfiguracionTests(SimpleTestCase):
    @override_settings(**CONFIG_VACIA)
    def test_configuracion_vacia(self):
        r = validar_configuracion_sunat()
        self.assertEqual((r['configurado'], r['credenciales_configuradas'], r['certificado_configurado'], r['ambiente']),
                         (False, False, False, 'beta'))
        self.assertEqual(r['faltantes'], ['SUNAT_USUARIO_SOL', 'SUNAT_CLAVE_SOL', 'SUNAT_CERTIFICADO_PATH',
                                          'SUNAT_CERTIFICADO_PASSWORD'])

    def test_configuracion_completa_simulada(self):
        with CertificadoTemporal() as ruta, override_settings(**config_completa(ruta)):
            r = validar_configuracion_sunat()
        self.assertEqual((r['configurado'], r['credenciales_configuradas'], r['certificado_configurado'], r['faltantes'],
                          r['advertencias']), (True, True, True, [], []))

    def test_solo_credenciales(self):
        with override_settings(**{**CONFIG_VACIA, 'SUNAT_USUARIO_SOL': Secreto(USUARIO_FALSO),
                                  'SUNAT_CLAVE_SOL': Secreto(CLAVE_FALSA)}):
            r = validar_configuracion_sunat()
        self.assertEqual((r['configurado'], r['credenciales_configuradas'], r['certificado_configurado']), (False, True, False))
        self.assertEqual(r['faltantes'], ['SUNAT_CERTIFICADO_PATH', 'SUNAT_CERTIFICADO_PASSWORD'])

    def test_certificado_inexistente_extension_y_dentro_del_repo(self):
        with override_settings(**config_completa('/no/existe/cert.pfx')):
            r = validar_configuracion_sunat()
        self.assertFalse(r['certificado_configurado'])
        self.assertIn('SUNAT_CERTIFICADO_PATH', r['faltantes'])
        self.assertTrue(any('no existe' in a for a in r['advertencias']))
        with CertificadoTemporal() as ruta:
            txt = ruta.with_suffix('.txt')
            txt.write_bytes(b'x')
            with override_settings(**config_completa(txt)):
                r = validar_configuracion_sunat()
        self.assertFalse(r['certificado_configurado'])
        self.assertTrue(any('.pfx o .p12' in a for a in r['advertencias']))
        dentro = Path(tempfile.mkdtemp(dir=RAIZ_REPO / 'backend', prefix='tmp_cert_'))
        try:
            (dentro / 'c.pfx').write_bytes(b'x')
            with override_settings(**config_completa(dentro / 'c.pfx')):
                r = validar_configuracion_sunat()
            self.assertTrue(any('dentro de la carpeta del proyecto' in a for a in r['advertencias']))
        finally:
            shutil.rmtree(dentro, ignore_errors=True)

    def test_ambiente_invalido_y_produccion_con_debug(self):
        with CertificadoTemporal() as ruta:
            with override_settings(**config_completa(ruta, SUNAT_AMBIENTE='prod')):
                r = validar_configuracion_sunat()
            self.assertEqual((r['configurado'], r['ambiente'], r['ambiente_valido']), (False, None, False))
            self.assertIn('SUNAT_AMBIENTE', r['faltantes'])
            with override_settings(**config_completa(ruta, SUNAT_AMBIENTE='produccion'), DEBUG=True):
                r = validar_configuracion_sunat()
            self.assertTrue(r['configurado'])
            self.assertTrue(any('produccion con DEBUG=True' in a for a in r['advertencias']))

    def test_lectura_desde_variables(self):
        entorno = {'SUNAT_AMBIENTE': ' PRODUCCION ', 'SUNAT_CLAVE_SOL': CLAVE_FALSA}
        leido = leer_configuracion_sunat(lambda n, default='': entorno.get(n, default))
        self.assertEqual(leido['SUNAT_AMBIENTE'], 'produccion')
        self.assertIsInstance(leido['SUNAT_CLAVE_SOL'], Secreto)
        self.assertEqual(leido['SUNAT_CLAVE_SOL'].revelar(), CLAVE_FALSA)
        self.assertFalse(leido['SUNAT_USUARIO_SOL'])
        self.assertEqual(leer_configuracion_sunat(lambda n, default='': default)['SUNAT_AMBIENTE'], 'beta')


# =============================================================================================
class NoExposicionTests(SimpleTestCase):
    def test_secreto_no_se_muestra(self):
        s = Secreto(CLAVE_FALSA)
        for texto in (str(s), repr(s), f'{s}', f'{s:>30}', '%s' % s, str([s]), str({'k': s})):
            self.assertNotIn(CLAVE_FALSA, texto)
        self.assertEqual(s.revelar(), CLAVE_FALSA)
        with self.assertRaises(TypeError):
            pickle.dumps(s)
        self.assertEqual((bool(Secreto('')), bool(Secreto('  ')), str(Secreto(''))), (False, False, ''))

    def test_settings_y_logs_ocultan_credenciales(self):
        with override_settings(SUNAT_CLAVE_SOL=Secreto(CLAVE_FALSA), SUNAT_USUARIO_SOL=Secreto(USUARIO_FALSO),
                               SUNAT_CERTIFICADO_PASSWORD=Secreto(PASSWORD_PFX_FALSA)):
            self.assertNotIn(CLAVE_FALSA, f'clave: {settings.SUNAT_CLAVE_SOL}')  # print(settings.SUNAT_CLAVE_SOL)
            filtro = FiltroDatosSensibles()
            registro = logging.LogRecord('fact_kard', logging.INFO, __file__, 1,
                                         'conectando %s %s %s', (settings.SUNAT_USUARIO_SOL, CLAVE_FALSA,
                                                                 PASSWORD_PFX_FALSA), None)
            filtro.filter(registro)
            mensaje = registro.getMessage()
        for valor in (USUARIO_FALSO, CLAVE_FALSA, PASSWORD_PFX_FALSA):
            self.assertNotIn(valor, mensaje)
        self.assertIn(ENMASCARADO, mensaje)

    def test_patrones_por_nombre_y_pem(self):
        texto = enmascarar('clave_sol=abc12345 "usuario_sol": "20100MOD" SUNAT_CERTIFICADO_PASSWORD=zzzz9999 '
                           '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEF\n-----END PRIVATE KEY-----')
        for valor in ('abc12345', '20100MOD', 'zzzz9999', 'MIIEvQ', 'BEGIN PRIVATE KEY'):
            self.assertNotIn(valor, texto)

    def test_pagina_de_error_oculta_sunat(self):
        with override_settings(SUNAT_CLAVE_SOL=Secreto(CLAVE_FALSA), SUNAT_USUARIO_SOL=Secreto(USUARIO_FALSO),
                               SUNAT_CERTIFICADO_PASSWORD=Secreto(PASSWORD_PFX_FALSA), SUNAT_CERTIFICADO_PATH='/x/c.pfx'):
            seguros = FiltroReporteExcepciones().get_safe_settings()
        self.assertEqual(settings.DEFAULT_EXCEPTION_REPORTER_FILTER, 'config.sunat.FiltroReporteExcepciones')
        for nombre in ('SUNAT_CLAVE_SOL', 'SUNAT_USUARIO_SOL', 'SUNAT_CERTIFICADO_PASSWORD', 'SUNAT_CERTIFICADO_PATH'):
            self.assertEqual(seguros[nombre], FiltroReporteExcepciones.cleansed_substitute)
        self.assertNotIn(CLAVE_FALSA, json.dumps(seguros, default=str))


# =============================================================================================
class EndpointEstadoTests(TestCase):
    def setUp(self):
        pen = Moneda.objects.create(codigo='PEN', nombre='Soles')
        self.empresa = Empresa.objects.create(ruc='20100100100', razon_social='EMPRESA SUNAT', moneda_base_codigo=pen)
        self.otra = Empresa.objects.create(ruc='20200200200', razon_social='OTRA SUNAT', moneda_base_codigo=pen)
        self.admin = Usuario.objects.create(username='admin17b', email='a17b@test.pe', password_hash='x')
        self.usuario = Usuario.objects.create(username='user17b', email='u17b@test.pe', password_hash='x')
        UsuarioEmpresa.objects.create(usuario=self.admin, empresa=self.empresa, rol='ADMIN')
        UsuarioEmpresa.objects.create(usuario=self.admin, empresa=self.otra, rol='ADMIN')
        UsuarioEmpresa.objects.create(usuario=self.usuario, empresa=self.empresa, rol='USUARIO')
        self.client = APIClient()
        self.url = reverse('sunat-estado')
        self.h = {'HTTP_X_EMPRESA_ID': str(self.empresa.id)}

    def test_no_autenticado_rechazado(self):
        self.assertEqual(self.client.get(self.url, **self.h).status_code, 401)

    def test_usuario_sin_permiso_rechazado(self):
        self.client.force_authenticate(user=self.usuario)
        self.assertEqual(self.client.get(self.url, **self.h).status_code, 403)

    def test_usuario_de_otra_empresa_rechazado(self):
        self.client.force_authenticate(user=self.usuario)
        self.assertEqual(self.client.get(self.url, HTTP_X_EMPRESA_ID=str(self.otra.id)).status_code, 403)

    @override_settings(**CONFIG_VACIA)
    def test_admin_configuracion_vacia(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get(self.url, **self.h)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['ambiente'], 'beta')
        self.assertEqual((r.data['configurado'], r.data['credenciales_configuradas'], r.data['certificado_configurado'],
                          r.data['conexion_sunat_habilitada']), (False, False, False, False))
        self.assertEqual(len(r.data['faltantes']), 4)

    def test_admin_configuracion_completa_sin_exponer_nada(self):
        self.client.force_authenticate(user=self.admin)
        with CertificadoTemporal() as ruta, override_settings(**config_completa(ruta)):
            r = self.client.get(self.url, **self.h)
            texto = r.content.decode()
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['configurado'])
        for prohibido in (USUARIO_FALSO, CLAVE_FALSA, PASSWORD_PFX_FALSA, str(ruta), ruta.name,
                          CONTENIDO_CERT_FALSO.decode(), 'PRIVATE KEY'):
            self.assertNotIn(prohibido, texto)
        claves = ' '.join(r.data.keys()).lower()
        for palabra in ('clave', 'password', 'private', 'contenido', 'path', 'usuario_sol'):
            self.assertNotIn(palabra, claves)

    def test_multiempresa_credenciales_de_otro_ruc(self):
        self.client.force_authenticate(user=self.admin)
        with CertificadoTemporal() as ruta, override_settings(**config_completa(ruta)):
            propia = self.client.get(self.url, **self.h).data
            otra = self.client.get(self.url, HTTP_X_EMPRESA_ID=str(self.otra.id)).data
        self.assertEqual((propia['credenciales_corresponden_a_empresa'], otra['credenciales_corresponden_a_empresa']),
                         (True, False))


# =============================================================================================
def _git(*args):
    return subprocess.run(['git', *args], cwd=RAIZ_REPO, capture_output=True, text=True, timeout=30)


class GitignoreTests(SimpleTestCase):
    def setUp(self):
        try:
            if _git('rev-parse', '--is-inside-work-tree').stdout.strip() != 'true':
                self.skipTest('No es un repositorio Git.')
        except (OSError, subprocess.SubprocessError):
            self.skipTest('git no está disponible.')

    def ignorado(self, ruta):
        return _git('check-ignore', '-q', '--no-index', ruta).returncode == 0

    def test_extensiones_y_carpetas_sensibles_ignoradas(self):
        for ruta in ('backend/.env', '.env', '.env.local', 'backend/.env.produccion', 'certificado.pfx', 'x/firma.p12',
                     'clave.pem', 'privada.key', 'cert.crt', 'cert.cer', 'almacen.jks', 'a.keystore',
                     'certificados/sunat.pfx', 'certificates/a.txt', 'secrets/a.txt', 'private/a.txt',
                     'credentials/sol.txt', 'backups/fact_kard.backup', 'backend/.secret_key.dev'):
            self.assertTrue(self.ignorado(ruta), f'{ruta} debería estar ignorado')

    def test_ejemplos_y_codigo_no_ignorados(self):
        for ruta in ('backend/.env.example', 'frontend/.env.example', 'frontend/.env.production',
                     'backend/config/sunat.py', 'deploy/env.produccion.example'):
            self.assertFalse(self.ignorado(ruta), f'{ruta} NO debe ignorarse')

    def test_ningun_archivo_sensible_versionado(self):
        versionados = _git('ls-files').stdout.splitlines()
        import re
        sensible = re.compile(r'(^|/)\.env$|(^|/)\.env\.(?!example$|production$)|\.(pfx|p12|pem|key|crt|cer|jks|keystore)$|'
                              r'(^|/)(certificados|certificates|secrets|private|credentials)/|\.secret_key')
        self.assertEqual([f for f in versionados if sensible.search(f)], [])
