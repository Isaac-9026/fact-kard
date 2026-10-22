from datetime import date
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, ValidationError
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse

from apps.catalogos.models import (
    Moneda,
    TipoCambio,
    TipoComprobante,
    TipoOperacion,
    TipoExistencia,
    UnidadMedida,
)
from apps.catalogos.serializers import (
    MonedaSerializer,
    TipoComprobanteSerializer,
    TipoOperacionSerializer,
    TipoExistenciaSerializer,
    UnidadMedidaSerializer,
    TipoCambioSerializer,
    TipoCambioResolverSerializer,
)


class MonedaListView(generics.ListAPIView):
    serializer_class = MonedaSerializer
    queryset = Moneda.objects.all().order_by('codigo')


class TipoComprobanteListView(generics.ListAPIView):
    serializer_class = TipoComprobanteSerializer
    queryset = TipoComprobante.objects.filter(activo=True).order_by('codigo_sunat')


class TipoOperacionListView(generics.ListAPIView):
    serializer_class = TipoOperacionSerializer
    queryset = TipoOperacion.objects.filter(activo=True).order_by('codigo_interno')


class TipoExistenciaListView(generics.ListAPIView):
    serializer_class = TipoExistenciaSerializer
    queryset = TipoExistencia.objects.all().order_by('codigo')


class UnidadMedidaListView(generics.ListAPIView):
    serializer_class = UnidadMedidaSerializer
    queryset = UnidadMedida.objects.all().order_by('codigo')


class TipoCambioListCreateView(generics.ListCreateAPIView):
    serializer_class = TipoCambioSerializer

    def get_queryset(self):
        qs = TipoCambio.objects.all().order_by('-fecha_publicacion', 'moneda_codigo')
        moneda = self.request.query_params.get('moneda')
        if moneda:
            qs = qs.filter(moneda_codigo=moneda.upper())
        fecha = self.request.query_params.get('fecha')
        if fecha:
            qs = qs.filter(fecha_publicacion=fecha)
        return qs


class TipoCambioResolverView(APIView):
    """
    Resuelve el tipo de cambio aplicable según la regla oficial contable de FACT-KARD:
    - Devuelve el TC publicado en la fecha exacta del documento.
    - Si la fecha corresponde a fin de semana o feriado (sin publicación),
      toma el último TC publicado anterior o igual a la fecha consultada (fecha_publicacion <= fecha).
    """

    @extend_schema(
        summary="Resolver Tipo de Cambio contable oficial",
        description="Devuelve el TC publicado para la fecha o el último publicado previo (fin de semana/feriado).",
        parameters=[
            OpenApiParameter(name='moneda', description='Código de moneda (ej: USD)', required=False, type=str, default='USD'),
            OpenApiParameter(name='fecha', description='Fecha del documento (YYYY-MM-DD)', required=True, type=str),
        ],
        responses={
            200: TipoCambioResolverSerializer,
            400: OpenApiResponse(description="Parámetros inválidos"),
            404: OpenApiResponse(description="No existe tipo de cambio aplicable"),
        }
    )
    def get(self, request):
        moneda_raw = request.query_params.get('moneda', 'USD').strip().upper()
        fecha_raw = request.query_params.get('fecha')

        if not fecha_raw:
            raise ValidationError({'fecha': 'El parámetro fecha es obligatorio (formato YYYY-MM-DD).'})

        try:
            fecha_consultada = date.fromisoformat(fecha_raw)
        except ValueError:
            raise ValidationError({'fecha': 'Formato de fecha inválido. Utilice YYYY-MM-DD.'})

        # Regla contable: buscar el TC con fecha_publicacion <= fecha_consultada más reciente
        tc = (
            TipoCambio.objects.filter(
                moneda_codigo=moneda_raw,
                fecha_publicacion__lte=fecha_consultada,
            )
            .order_by('-fecha_publicacion', '-id')
            .first()
        )

        if not tc:
            raise NotFound(
                f"No existe tipo de cambio registrado para {moneda_raw} al {fecha_consultada.isoformat()} ni en fechas anteriores."
            )

        data = {
            'id': tc.id,
            'moneda_codigo': tc.moneda_codigo_id,
            'fecha_publicacion': tc.fecha_publicacion,
            'fecha_consultada': fecha_consultada,
            'es_fecha_exacta': tc.fecha_publicacion == fecha_consultada,
            'venta': tc.venta,
            'compra': tc.compra,
            'fuente': tc.fuente,
        }
        serializer = TipoCambioResolverSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)
