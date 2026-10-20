from decimal import Decimal
from django.db import IntegrityError
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from apps.catalogos.models import Moneda
from apps.empresas.models import Empresa, Establecimiento, ConfigEmpresa
from apps.usuarios.models import Usuario, UsuarioEmpresa


class EmpresasModelTest(TestCase):
    def setUp(self):
        self.moneda = Moneda.objects.create(codigo='PEN', nombre='Soles')
        self.empresa = Empresa.objects.create(
            ruc='20100070970',
            razon_social='EMPRESA MODELO S.A.C.',
            moneda_base_codigo=self.moneda
        )

    def test_crear_empresa_y_establecimiento(self):
        est = Establecimiento.objects.create(
            empresa=self.empresa,
            codigo_sunat='0000',
            nombre='PRINCIPAL'
        )
        config = ConfigEmpresa.objects.create(
            empresa=self.empresa,
            tolerancia_residuo_pen=Decimal('0.05'),
            decimales_calculo=6,
            establecimiento_principal=est
        )
        self.assertEqual(config.tolerancia_residuo_pen, Decimal('0.05'))
        self.assertEqual(config.decimales_calculo, 6)
        self.assertEqual(config.regla_redondeo, 'ROUND_HALF_UP')
        self.assertEqual(config.metodo_valuacion, 'CPP')

    def test_empresa_estado_check_constraint(self):
        with self.assertRaises(IntegrityError):
            Empresa.objects.create(
                ruc='20100070971',
                razon_social='TEST INVALID ESTADO',
                moneda_base_codigo=self.moneda,
                estado='ESTADO_INVALIDO'
            )

    def test_config_decimales_calculo_check_constraint(self):
        with self.assertRaises(IntegrityError):
            ConfigEmpresa.objects.create(
                empresa=self.empresa,
                decimales_calculo=10  # Solo entre 2 y 8
            )


class EmpresasApiTest(TestCase):
    def setUp(self):
        self.moneda = Moneda.objects.create(codigo='PEN', nombre='Soles')
        self.usuario = Usuario.objects.create(
            username='dev_b',
            email='devb@factkard.pe',
            password_hash='hash',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.usuario)

    def crear_empresa(self, ruc, razon_social):
        return Empresa.objects.create(
            ruc=ruc,
            razon_social=razon_social,
            moneda_base_codigo=self.moneda,
        )

    def test_api_crear_empresa_crea_config_y_asignacion_admin(self):
        response = self.client.post(
            reverse('empresa-list-create'),
            {
                'ruc': '20601234567',
                'razon_social': 'NUEVA EMPRESA S.A.C.',
                'nombre_comercial': 'Nueva Empresa',
                'direccion': 'Lima',
                'moneda_base_codigo': 'PEN',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        empresa = Empresa.objects.get(pk=response.data['id'])
        config = ConfigEmpresa.objects.get(empresa=empresa)
        self.assertEqual(config.tolerancia_residuo_pen, Decimal('0.05000000'))
        self.assertEqual(config.decimales_calculo, 6)
        self.assertEqual(config.regla_redondeo, 'ROUND_HALF_UP')
        self.assertEqual(config.metodo_valuacion, 'CPP')
        self.assertTrue(UsuarioEmpresa.objects.filter(
            usuario=self.usuario,
            empresa=empresa,
            rol='ADMIN',
            activo=True,
        ).exists())

    def test_establecimientos_aislados_por_empresa_activa(self):
        empresa_a = self.crear_empresa('20600000001', 'EMPRESA A')
        empresa_b = self.crear_empresa('20600000002', 'EMPRESA B')
        UsuarioEmpresa.objects.create(usuario=self.usuario, empresa=empresa_b, rol='USUARIO')
        establecimiento_a = Establecimiento.objects.create(
            empresa=empresa_a,
            codigo_sunat='A001',
            nombre='LOCAL A',
        )
        establecimiento_b = Establecimiento.objects.create(
            empresa=empresa_b,
            codigo_sunat='B001',
            nombre='LOCAL B',
        )

        response = self.client.get(
            reverse('establecimiento-list-create'),
            HTTP_X_EMPRESA_ID=str(empresa_b.id),
        )

        self.assertEqual(response.status_code, 200)
        ids = {item['id'] for item in response.data}
        self.assertIn(establecimiento_b.id, ids)
        self.assertNotIn(establecimiento_a.id, ids)

    def test_patch_establecimiento_ajeno_responde_404(self):
        empresa_a = self.crear_empresa('20600000003', 'EMPRESA A')
        empresa_b = self.crear_empresa('20600000004', 'EMPRESA B')
        UsuarioEmpresa.objects.create(usuario=self.usuario, empresa=empresa_b, rol='ADMIN')
        establecimiento_a = Establecimiento.objects.create(
            empresa=empresa_a,
            codigo_sunat='A002',
            nombre='LOCAL AJENO',
        )

        response = self.client.patch(
            reverse('establecimiento-detail', args=[establecimiento_a.id]),
            {'nombre': 'INTENTO'},
            format='json',
            HTTP_X_EMPRESA_ID=str(empresa_b.id),
        )

        self.assertEqual(response.status_code, 404)
        establecimiento_a.refresh_from_db()
        self.assertEqual(establecimiento_a.nombre, 'LOCAL AJENO')

    def test_config_rechaza_establecimiento_de_otra_empresa(self):
        empresa_a = self.crear_empresa('20600000005', 'EMPRESA A')
        empresa_b = self.crear_empresa('20600000006', 'EMPRESA B')
        ConfigEmpresa.objects.create(empresa=empresa_b)
        UsuarioEmpresa.objects.create(usuario=self.usuario, empresa=empresa_b, rol='ADMIN')
        establecimiento_a = Establecimiento.objects.create(
            empresa=empresa_a,
            codigo_sunat='A003',
            nombre='LOCAL AJENO',
        )

        response = self.client.patch(
            reverse('empresa-config'),
            {'establecimiento_principal': establecimiento_a.id},
            format='json',
            HTTP_X_EMPRESA_ID=str(empresa_b.id),
        )

        self.assertEqual(response.status_code, 400)
