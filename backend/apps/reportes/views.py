from datetime import datetime
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.usuarios.authentication import UsuarioTokenAuthentication
from apps.usuarios.permissions import TieneEmpresaActiva
from apps.reportes.services import consultar_kardex_valorizado
from apps.reportes.serializers import KardexReporteResponseSerializer
from apps.reportes.excel_exporter import generar_bytes_excel_kardex
from apps.reportes.formato131_excel import generar_excel_formato_131
from apps.reportes.formato131_service import generar_formato_131
from apps.reportes.piloto_service import comparar_piloto, obtener_valores_factkard
from apps.reportes.serializers import PilotoComparacionSerializer


class KardexReportView(APIView):
    """
    GET /api/reportes/kardex/
    Consulta de Kardex Valorizado bajo el orden cronológico oficial del motor:
    (fecha_movimiento, prioridad_dia, secuencia, id).
    Requiere encabezado 'X-Empresa-Id' y token de sesión.
    """
    authentication_classes = (UsuarioTokenAuthentication,)
    permission_classes = (TieneEmpresaActiva,)

    def get(self, request, *args, **kwargs):
        empresa_id = request.empresa_id

        producto_id = request.query_params.get('producto_id') or request.query_params.get('producto')
        periodo_id = request.query_params.get('periodo_id') or request.query_params.get('periodo')
        almacen_id = request.query_params.get('almacen_id') or request.query_params.get('almacen')
        tipo_operacion_id = request.query_params.get('tipo_operacion_id') or request.query_params.get('tipo_operacion')
        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')

        resultado = consultar_kardex_valorizado(
            empresa_id=empresa_id,
            producto_id=int(producto_id) if producto_id else None,
            periodo_id=int(periodo_id) if periodo_id else None,
            almacen_id=int(almacen_id) if almacen_id else None,
            tipo_operacion_id=int(tipo_operacion_id) if tipo_operacion_id else None,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
        )

        serializer = KardexReporteResponseSerializer(resultado)
        return Response(serializer.data)


class KardexExcelExportView(APIView):
    """
    GET /api/reportes/kardex/excel/
    Descarga del libro oficial de Kardex Valorizado en formato .xlsx con 4 hojas:
    1. Kardex Valorizado (1:1 con la vista en pantalla)
    2. Movimientos (detalle técnico)
    3. Incidencias (incidencias del período/empresa)
    4. Resumen de Saldos (resumen de stock y CPP por establecimiento)
    """
    authentication_classes = (UsuarioTokenAuthentication,)
    permission_classes = (TieneEmpresaActiva,)

    def get(self, request, *args, **kwargs):
        empresa_id = request.empresa_id

        producto_id = request.query_params.get('producto_id') or request.query_params.get('producto')
        periodo_id = request.query_params.get('periodo_id') or request.query_params.get('periodo')
        almacen_id = request.query_params.get('almacen_id') or request.query_params.get('almacen')
        tipo_operacion_id = request.query_params.get('tipo_operacion_id') or request.query_params.get('tipo_operacion')
        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')

        buffer = generar_bytes_excel_kardex(
            empresa_id=empresa_id,
            producto_id=int(producto_id) if producto_id else None,
            periodo_id=int(periodo_id) if periodo_id else None,
            almacen_id=int(almacen_id) if almacen_id else None,
            tipo_operacion_id=int(tipo_operacion_id) if tipo_operacion_id else None,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
        )

        nombre_archivo = f"kardex_empresa_{empresa_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'
        return response


class Formato131View(APIView):
    authentication_classes = (UsuarioTokenAuthentication,)
    permission_classes = (TieneEmpresaActiva,)

    def get(self, request):
        resultado = generar_formato_131(
            empresa_id=request.empresa_id,
            periodo_id=request.query_params.get('periodo_id'),
            establecimiento_id=request.query_params.get('establecimiento_id'),
            producto_id=request.query_params.get('producto_id'),
        )
        return Response(resultado)


class Formato131ExcelView(APIView):
    authentication_classes = (UsuarioTokenAuthentication,)
    permission_classes = (TieneEmpresaActiva,)

    def get(self, request):
        periodo_id = request.query_params.get('periodo_id')
        buffer = generar_excel_formato_131(
            empresa_id=request.empresa_id,
            periodo_id=periodo_id,
            establecimiento_id=request.query_params.get('establecimiento_id'),
            producto_id=request.query_params.get('producto_id'),
        )
        response = HttpResponse(buffer.getvalue(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename="formato_13_1_periodo_{periodo_id}.xlsx"'
        return response


class PilotoComparadorView(APIView):
    authentication_classes = (UsuarioTokenAuthentication,)
    permission_classes = (TieneEmpresaActiva,)

    def get(self, request):
        periodo_id = request.query_params.get('periodo_id')
        producto_id = request.query_params.get('producto_id')
        if not periodo_id:
            return Response({'periodo_id': 'Este parámetro es obligatorio.'}, status=400)
        if not producto_id:
            return Response({'producto_id': 'Este parámetro es obligatorio.'}, status=400)
        return Response(obtener_valores_factkard(
            empresa_id=request.empresa_id,
            periodo_id=periodo_id,
            producto_id=producto_id,
        ))

    def post(self, request):
        serializer = PilotoComparacionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(comparar_piloto(
            empresa_id=request.empresa_id,
            datos=serializer.validated_data,
        ))
