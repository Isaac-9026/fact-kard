from django.db.models import Q
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.documentos.models import Documento
from apps.documentos.serializers import (
    DocumentoListSerializer,
    DocumentoDetailSerializer,
    DocumentoCreateSerializer,
    DocumentoRevisarSerializer,
    DocumentoAnularSerializer,
)
from apps.documentos.services import (
    revisar_documento,
    confirmar_documento_validacion,
    anular_documento,
)
from apps.usuarios.permissions import TieneEmpresaActiva


class DocumentoListCreateView(generics.ListCreateAPIView):
    """
    Lista y crea comprobantes comerciales (Compras, Ventas, NC, ND).
    Aislamiento estricto por empresa_id (X-Empresa-Id).
    """
    permission_classes = [TieneEmpresaActiva]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return DocumentoCreateSerializer
        return DocumentoListSerializer

    def get_queryset(self):
        empresa_id = getattr(self.request, 'empresa_id', None)
        if not empresa_id:
            return Documento.objects.none()

        qs = Documento.objects.filter(empresa_id=empresa_id).select_related(
            'periodo', 'tercero', 'tipo_comprobante', 'moneda_codigo', 'revisado_por'
        )

        clase = self.request.query_params.get('clase')
        if clase:
            qs = qs.filter(clase=clase.upper())

        periodo_id = self.request.query_params.get('periodo')
        if periodo_id:
            qs = qs.filter(periodo_id=periodo_id)

        estado = self.request.query_params.get('estado')
        if estado:
            qs = qs.filter(estado=estado.upper())

        estado_revision = self.request.query_params.get('estado_revision')
        if estado_revision:
            qs = qs.filter(estado_revision=estado_revision.upper())

        search = self.request.query_params.get('search')
        if search:
            search = search.strip()
            qs = qs.filter(
                Q(serie_normalizada__icontains=search) |
                Q(numero_normalizado__icontains=search) |
                Q(ruc_emisor__icontains=search) |
                Q(tercero__razon_social__icontains=search)
            )

        return qs.order_by('-fecha_emision', '-id')

    @extend_schema(
        summary="Listar documentos comerciales",
        description="Obtiene el listado de comprobantes filtrados por empresa activa y filtros opcionales.",
        parameters=[
            OpenApiParameter(name='clase', description='COMPRA o VENTA', required=False, type=str),
            OpenApiParameter(name='periodo', description='ID del período', required=False, type=int),
            OpenApiParameter(name='estado', description='BORRADOR, CONFIRMADO, ANULADO', required=False, type=str),
            OpenApiParameter(name='estado_revision', description='PENDIENTE, EN_REVISION, REVISADO, OBSERVADO', required=False, type=str),
            OpenApiParameter(name='search', description='Búsqueda por comprobante, RUC o tercero', required=False, type=str),
        ],
        responses={200: DocumentoListSerializer(many=True)}
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        summary="Crear documento comercial con detalles",
        description="Registra un comprobante con validaciones de duplicados, cálculo de cantidad base y costo unitario en PEN.",
        request=DocumentoCreateSerializer,
        responses={201: DocumentoDetailSerializer}
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        documento = serializer.save()
        output_serializer = DocumentoDetailSerializer(documento)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)


class DocumentoDetailView(generics.RetrieveDestroyAPIView):
    """
    Consulta el detalle completo o elimina un comprobante en estado BORRADOR.
    """
    permission_classes = [TieneEmpresaActiva]
    serializer_class = DocumentoDetailSerializer

    def get_queryset(self):
        empresa_id = getattr(self.request, 'empresa_id', None)
        return Documento.objects.filter(empresa_id=empresa_id).prefetch_related(
            'detalles__producto',
            'detalles__producto_unidad',
            'detalles__almacen',
            'detalles__tipo_operacion'
        )

    def perform_destroy(self, instance):
        if instance.estado != 'BORRADOR':
            raise ValidationError({'detail': 'Solo se pueden eliminar documentos en estado BORRADOR.'})
        instance.delete()


class DocumentoRevisarView(APIView):
    """
    Cambia el estado de revisión de un comprobante (EN_REVISION, REVISADO, OBSERVADO)
    registrando la traza inmutable en Auditoría.
    """
    permission_classes = [TieneEmpresaActiva]

    @extend_schema(
        summary="Revisar documento",
        description="Actualiza el estado de revisión del comprobante con registro de auditoría.",
        request=DocumentoRevisarSerializer,
        responses={200: DocumentoDetailSerializer}
    )
    def post(self, request, pk):
        serializer = DocumentoRevisarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        nuevo_estado = serializer.validated_data['estado_revision']
        motivo = serializer.validated_data.get('motivo')

        doc = revisar_documento(
            documento_id=pk,
            empresa_id=request.empresa_id,
            usuario_id=request.user.id,
            nuevo_estado_revision=nuevo_estado,
            motivo=motivo
        )

        return Response(DocumentoDetailSerializer(doc).data, status=status.HTTP_200_OK)


class DocumentoConfirmarView(APIView):
    """
    Valida y confirma un documento comercial.
    Exige que el comprobante esté en estado de revisión REVISADO y en período ABIERTO.
    """
    permission_classes = [TieneEmpresaActiva]

    @extend_schema(
        summary="Confirmar documento",
        description="Pasa el documento a CONFIRMADO tras verificar que esté REVISADO y el período ABIERTO.",
        responses={200: DocumentoDetailSerializer}
    )
    def post(self, request, pk):
        doc = confirmar_documento_validacion(
            documento_id=pk,
            empresa_id=request.empresa_id,
            usuario_id=request.user.id
        )
        return Response(DocumentoDetailSerializer(doc).data, status=status.HTTP_200_OK)


class DocumentoAnularView(APIView):
    """
    Anula un documento comercial con motivo obligatorio y registro en Auditoría.
    """
    permission_classes = [TieneEmpresaActiva]

    @extend_schema(
        summary="Anular documento",
        description="Marca el documento como ANULADO con motivo obligatorio.",
        request=DocumentoAnularSerializer,
        responses={200: DocumentoDetailSerializer}
    )
    def post(self, request, pk):
        serializer = DocumentoAnularSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        doc = anular_documento(
            documento_id=pk,
            empresa_id=request.empresa_id,
            usuario_id=request.user.id,
            motivo=serializer.validated_data['motivo']
        )
        return Response(DocumentoDetailSerializer(doc).data, status=status.HTTP_200_OK)
