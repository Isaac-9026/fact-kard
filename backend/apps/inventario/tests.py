from decimal import Decimal
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.auditoria.models import Auditoria
from apps.catalogos.models import Moneda, TipoExistencia, UnidadMedida
from apps.empresas.models import Empresa, Establecimiento
from apps.inventario.models import Almacen, Tercero, Producto, ProductoUnidad
from apps.usuarios.models import Usuario, UsuarioEmpresa


class InventarioModelTest(TestCase):
    def setUp(self):
        self.moneda = Moneda.objects.create(codigo='PEN', nombre='Soles')
        self.empresa = Empresa.objects.create(
            ruc='20100070970',
            razon_social='EMPRESA MODELO S.A.C.',
            moneda_base_codigo=self.moneda
        )
        self.establecimiento = Establecimiento.objects.create(
            empresa=self.empresa,
            codigo_sunat='0000',
            nombre='PRINCIPAL'
        )
        self.tipo_existencia = TipoExistencia.objects.create(
            codigo='01',
            descripcion='MERCADERIAS'
        )
        self.und = UnidadMedida.objects.create(codigo='NIU', descripcion='UNIDADES')
        self.caja = UnidadMedida.objects.create(codigo='BX', descripcion='CAJAS')

    def test_crear_almacen_y_unique_constraint(self):
        alm = Almacen.objects.create(
            empresa=self.empresa,
            establecimiento=self.establecimiento,
            codigo='ALM01',
            nombre='ALMACEN CENTRAL'
        )
        self.assertEqual(alm.codigo, 'ALM01')
        self.assertTrue(alm.activo)

        # Mismo código en la misma empresa debe fallar
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Almacen.objects.create(
                    empresa=self.empresa,
                    establecimiento=self.establecimiento,
                    codigo='ALM01',
                    nombre='OTRO ALMACEN'
                )

    def test_tercero_constraints(self):
        # Debe tener es_cliente o es_proveedor en True
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Tercero.objects.create(
                    empresa=self.empresa,
                    tipo_documento='6',
                    numero_documento='20601111111',
                    razon_social='CLIENTE INVALIDO',
                    es_cliente=False,
                    es_proveedor=False
                )

        # Tercero válido
        tercero = Tercero.objects.create(
            empresa=self.empresa,
            tipo_documento='6',
            numero_documento='20601111111',
            razon_social='PROVEEDOR CENTRAL S.A.C.',
            es_proveedor=True
        )
        self.assertEqual(tercero.estado, 'ACTIVO')

        # Duplicado en la misma empresa debe fallar
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Tercero.objects.create(
                    empresa=self.empresa,
                    tipo_documento='6',
                    numero_documento='20601111111',
                    razon_social='OTRO NOMBRE',
                    es_cliente=True
                )

    def test_producto_y_uq_producto_unidad_base(self):
        prod = Producto.objects.create(
            empresa=self.empresa,
            codigo_interno='PROD-001',
            descripcion='PRODUCTO DE PRUEBA',
            tipo_existencia_codigo=self.tipo_existencia
        )

        # 1. Crear unidad base (es_base=True)
        pu_base = ProductoUnidad.objects.create(
            producto=prod,
            unidad_codigo=self.und,
            factor_a_base=Decimal('1.00000000'),
            es_base=True
        )
        self.assertTrue(pu_base.es_base)

        # 2. Crear segunda unidad derivada (es_base=False, factor 12)
        pu_caja = ProductoUnidad.objects.create(
            producto=prod,
            unidad_codigo=self.caja,
            factor_a_base=Decimal('12.00000000'),
            es_base=False
        )
        self.assertFalse(pu_caja.es_base)

        # 3. Intentar agregar una SEGUNDA unidad con es_base=True al mismo producto
        # Debe fallar obligatoriamente por el índice parcial único uq_producto_unidad_base
        und_paquete = UnidadMedida.objects.create(codigo='PK', descripcion='PAQUETES')
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                ProductoUnidad.objects.create(
                    producto=prod,
                    unidad_codigo=und_paquete,
                    factor_a_base=Decimal('6.00000000'),
                    es_base=True
                )

    def test_producto_unidad_factor_check_constraint(self):
        prod = Producto.objects.create(
            empresa=self.empresa,
            codigo_interno='PROD-002',
            descripcion='PRODUCTO FACTOR CERO',
            tipo_existencia_codigo=self.tipo_existencia
        )
        # Factor a base debe ser estrictamente > 0
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                ProductoUnidad.objects.create(
                    producto=prod,
                    unidad_codigo=self.und,
                    factor_a_base=Decimal('0.00000000'),
                    es_base=True
                )


class InventarioApiTest(TestCase):
    def setUp(self):
        self.moneda = Moneda.objects.create(codigo='PEN', nombre='Soles')
        self.tipo_existencia = TipoExistencia.objects.create(
            codigo='01', descripcion='MERCADERÍAS'
        )
        self.niu = UnidadMedida.objects.create(codigo='NIU', descripcion='UNIDAD')
        self.pack = UnidadMedida.objects.create(codigo='PK', descripcion='PAQUETE')
        self.caja = UnidadMedida.objects.create(codigo='BX', descripcion='CAJA')
        self.empresa_a = Empresa.objects.create(
            ruc='20600000001',
            razon_social='EMPRESA A S.A.C.',
            moneda_base_codigo=self.moneda,
        )
        self.empresa_b = Empresa.objects.create(
            ruc='20600000002',
            razon_social='EMPRESA B S.A.C.',
            moneda_base_codigo=self.moneda,
        )
        self.establecimiento_a = Establecimiento.objects.create(
            empresa=self.empresa_a, codigo_sunat='0001', nombre='PRINCIPAL A'
        )
        self.establecimiento_b = Establecimiento.objects.create(
            empresa=self.empresa_b, codigo_sunat='0001', nombre='PRINCIPAL B'
        )
        self.admin = Usuario.objects.create(
            username='admin_inv', email='admin_inv@factkard.pe', password_hash='hash'
        )
        self.usuario = Usuario.objects.create(
            username='usuario_inv', email='usuario_inv@factkard.pe', password_hash='hash'
        )
        UsuarioEmpresa.objects.create(
            usuario=self.admin, empresa=self.empresa_a, rol='ADMIN'
        )
        UsuarioEmpresa.objects.create(
            usuario=self.admin, empresa=self.empresa_b, rol='ADMIN'
        )
        UsuarioEmpresa.objects.create(
            usuario=self.usuario, empresa=self.empresa_a, rol='USUARIO'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def headers(self, empresa):
        return {'HTTP_X_EMPRESA_ID': str(empresa.id)}

    def crear_producto_api(self, codigo='P001'):
        return self.client.post(
            reverse('producto-list-create'),
            {
                'codigo_interno': codigo,
                'descripcion': f'PRODUCTO {codigo}',
                'tipo_existencia_codigo': self.tipo_existencia.codigo,
                'unidad_base_codigo': self.niu.codigo,
            },
            format='json',
            **self.headers(self.empresa_a),
        )

    def test_terceros_aislados_por_empresa(self):
        tercero_a = Tercero.objects.create(
            empresa=self.empresa_a,
            tipo_documento='6',
            numero_documento='20601111111',
            razon_social='TERCERO A',
            es_cliente=True,
        )
        tercero_b = Tercero.objects.create(
            empresa=self.empresa_b,
            tipo_documento='6',
            numero_documento='20602222222',
            razon_social='TERCERO B',
            es_proveedor=True,
        )

        response = self.client.get(
            reverse('tercero-list-create'), **self.headers(self.empresa_b)
        )

        self.assertEqual(response.status_code, 200)
        ids = {item['id'] for item in response.data}
        self.assertEqual(ids, {tercero_b.id})
        self.assertNotIn(tercero_a.id, ids)

    def test_almacenes_aislados_por_empresa(self):
        almacen_a = Almacen.objects.create(
            empresa=self.empresa_a,
            establecimiento=self.establecimiento_a,
            codigo='A01',
            nombre='ALMACÉN A',
        )
        almacen_b = Almacen.objects.create(
            empresa=self.empresa_b,
            establecimiento=self.establecimiento_b,
            codigo='B01',
            nombre='ALMACÉN B',
        )

        response = self.client.get(
            reverse('almacen-list-create'), **self.headers(self.empresa_b)
        )

        self.assertEqual(response.status_code, 200)
        ids = {item['id'] for item in response.data}
        self.assertEqual(ids, {almacen_b.id})
        self.assertNotIn(almacen_a.id, ids)

    def test_productos_aislados_por_empresa(self):
        producto_a = Producto.objects.create(
            empresa=self.empresa_a,
            codigo_interno='A001',
            descripcion='PRODUCTO A',
            tipo_existencia_codigo=self.tipo_existencia,
        )
        producto_b = Producto.objects.create(
            empresa=self.empresa_b,
            codigo_interno='B001',
            descripcion='PRODUCTO B',
            tipo_existencia_codigo=self.tipo_existencia,
        )

        response = self.client.get(
            reverse('producto-list-create'), **self.headers(self.empresa_b)
        )

        self.assertEqual(response.status_code, 200)
        ids = {item['id'] for item in response.data}
        self.assertEqual(ids, {producto_b.id})
        self.assertNotIn(producto_a.id, ids)

    def test_almacen_rechaza_establecimiento_de_otra_empresa(self):
        response = self.client.post(
            reverse('almacen-list-create'),
            {
                'establecimiento': self.establecimiento_b.id,
                'codigo': 'CRUZADO',
                'nombre': 'NO DEBE CREARSE',
                'activo': True,
            },
            format='json',
            **self.headers(self.empresa_a),
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Almacen.objects.filter(codigo='CRUZADO').exists())

    def test_crear_producto_genera_exactamente_una_unidad_base(self):
        response = self.crear_producto_api()

        self.assertEqual(response.status_code, 201)
        producto = Producto.objects.get(pk=response.data['id'])
        unidades_base = ProductoUnidad.objects.filter(producto=producto, es_base=True)
        self.assertEqual(unidades_base.count(), 1)
        self.assertEqual(unidades_base.get().unidad_codigo_id, 'NIU')
        self.assertEqual(unidades_base.get().factor_a_base, Decimal('1.00000000'))
        self.assertTrue(Auditoria.objects.filter(
            empresa=self.empresa_a,
            entidad='PRODUCTO',
            registro_id=producto.id,
        ).exists())

    def test_agregar_unidades_secundarias_pack_y_caja(self):
        producto_id = self.crear_producto_api().data['id']
        url = reverse('producto-unidad-list-create', args=[producto_id])

        pack_response = self.client.post(
            url,
            {'unidad_codigo': 'PK', 'factor_a_base': '6.00000000', 'es_base': False},
            format='json',
            **self.headers(self.empresa_a),
        )
        caja_response = self.client.post(
            url,
            {'unidad_codigo': 'BX', 'factor_a_base': '24.00000000', 'es_base': False},
            format='json',
            **self.headers(self.empresa_a),
        )

        self.assertEqual(pack_response.status_code, 201)
        self.assertEqual(caja_response.status_code, 201)
        self.assertEqual(
            ProductoUnidad.objects.get(pk=pack_response.data['id']).factor_a_base,
            Decimal('6.00000000'),
        )
        self.assertEqual(
            ProductoUnidad.objects.get(pk=caja_response.data['id']).factor_a_base,
            Decimal('24.00000000'),
        )

    def test_rechaza_segunda_unidad_base(self):
        producto_id = self.crear_producto_api().data['id']

        response = self.client.post(
            reverse('producto-unidad-list-create', args=[producto_id]),
            {'unidad_codigo': 'PK', 'factor_a_base': '1.00000000', 'es_base': True},
            format='json',
            **self.headers(self.empresa_a),
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            ProductoUnidad.objects.filter(producto_id=producto_id, es_base=True).count(),
            1,
        )

    def test_usuario_no_admin_puede_leer_pero_no_escribir(self):
        producto = Producto.objects.create(
            empresa=self.empresa_a,
            codigo_interno='LECTURA',
            descripcion='SOLO LECTURA',
            tipo_existencia_codigo=self.tipo_existencia,
        )
        self.client.force_authenticate(user=self.usuario)

        get_response = self.client.get(
            reverse('producto-list-create'), **self.headers(self.empresa_a)
        )
        post_response = self.client.post(
            reverse('tercero-list-create'),
            {
                'tipo_documento': '6',
                'numero_documento': '20603333333',
                'razon_social': 'NO AUTORIZADO',
                'es_cliente': True,
            },
            format='json',
            **self.headers(self.empresa_a),
        )
        patch_response = self.client.patch(
            reverse('producto-detail', args=[producto.id]),
            {'descripcion': 'CAMBIO NO AUTORIZADO'},
            format='json',
            **self.headers(self.empresa_a),
        )

        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(post_response.status_code, 403)
        self.assertEqual(patch_response.status_code, 403)

    def test_filtros_y_busqueda_de_terceros(self):
        Tercero.objects.create(
            empresa=self.empresa_a,
            tipo_documento='6',
            numero_documento='20604444444',
            razon_social='COMERCIAL ANDINA',
            nombre_comercial='ANDINA',
            es_cliente=True,
        )
        Tercero.objects.create(
            empresa=self.empresa_a,
            tipo_documento='6',
            numero_documento='20605555555',
            razon_social='SUMINISTROS DEL SUR',
            es_proveedor=True,
        )

        response = self.client.get(
            reverse('tercero-list-create'),
            {'tipo': 'cliente', 'search': 'ANDINA'},
            **self.headers(self.empresa_a),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['numero_documento'], '20604444444')

    def test_empresa_inactiva_no_permite_operar(self):
        self.empresa_a.estado = 'INACTIVA'
        self.empresa_a.save(update_fields=['estado'])

        get_response = self.client.get(
            reverse('producto-list-create'), **self.headers(self.empresa_a)
        )
        post_response = self.client.post(
            reverse('almacen-list-create'),
            {
                'establecimiento': self.establecimiento_a.id,
                'codigo': 'INACTIVO',
                'nombre': 'NO DEBE CREARSE',
                'activo': True,
            },
            format='json',
            **self.headers(self.empresa_a),
        )

        self.assertEqual(get_response.status_code, 404)
        self.assertEqual(post_response.status_code, 404)
        self.assertFalse(Almacen.objects.filter(codigo='INACTIVO').exists())
