from django.db import IntegrityError
from django.test import TestCase
from apps.catalogos.models import Moneda
from apps.empresas.models import Empresa
from apps.usuarios.models import Usuario, UsuarioEmpresa


class UsuariosModelTest(TestCase):
    def setUp(self):
        self.moneda = Moneda.objects.create(codigo='PEN', nombre='Soles')
        self.empresa = Empresa.objects.create(
            ruc='20100070970',
            razon_social='EMPRESA MODELO S.A.C.',
            moneda_base_codigo=self.moneda
        )
        self.usuario = Usuario.objects.create(
            username='admin_test',
            email='admin@factkard.pe',
            password_hash='pbkdf2_sha256$test_hash'
        )

    def test_crear_usuario_y_asignacion(self):
        ue = UsuarioEmpresa.objects.create(
            usuario=self.usuario,
            empresa=self.empresa,
            rol='ADMIN'
        )
        self.assertEqual(ue.rol, 'ADMIN')
        self.assertTrue(ue.activo)

    def test_rol_invalido_check_constraint(self):
        with self.assertRaises(IntegrityError):
            UsuarioEmpresa.objects.create(
                usuario=self.usuario,
                empresa=self.empresa,
                rol='SUPER_INV'
            )

    def test_usuario_empresa_unique_constraint(self):
        UsuarioEmpresa.objects.create(
            usuario=self.usuario,
            empresa=self.empresa,
            rol='ADMIN'
        )
        with self.assertRaises(IntegrityError):
            UsuarioEmpresa.objects.create(
                usuario=self.usuario,
                empresa=self.empresa,
                rol='USUARIO'
            )
