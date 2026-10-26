from django.db.models import Q, Count
from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from config.api import PaginacionOpcional, entero_param
from apps.documentos.models import Documento, DocumentoCaptura
from apps.documentos.serializers import (
    DocumentoListSerializer,
    DocumentoDetailSerializer,
    DocumentoCreateSerializer,
    DocumentoRevisarSerializer,
    DocumentoAnularSerializer,
    CapturaCampoSerializer,
    DocumentoCapturaListSerializer,
    DocumentoCapturaDetailSerializer,
    DocumentoCapturaSubirSerializer,
    CapturaCampoCorregirSerializer,
    GenerarBorradorSerializer,
)
from apps.documentos.services import (
    revisar_documento,
    confirmar_documento_validacion,
    anular_documento,
)
from apps.documentos.captura_services import (
    procesar_subida_captura,
    corregir_campo_captura,
    generar_borrador_desde_captura,
)
from apps.usuarios.permissions import EsAdminEmpresa, TieneEmpresaActiva


class DocumentoListCreateView(generics.ListCreateAPIView):
    """
    Lista y crea comprobantes comerciales (Compras, Ventas, NC, ND).
    Aislamiento estricto por empresa_id (X-Empresa-Id).
    """
    permission_classes = [TieneEmpresaActiva]
    pagination_class = PaginacionOpcional

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return DocumentoCreateSerializer
        return DocumentoListSerializer

    def get_queryset(self):
        empresa_id = getattr(self.request, 'empresa_id', None)
        if not empresa_id:
            return Documento.objects.none()

        # Bloque 6: el número de líneas se anota en SQL (antes un COUNT por documento).
        qs = Documento.objects.filter(empresa_id=empresa_id).select_related(
            'periodo', 'tercero', 'tipo_comprobante', 'moneda_codigo', 'revisado_por'
        ).annotate(num_detalles=Count('detalles'))

        clase = self.request.query_params.get('clase')
        if clase:
            qs = qs.filter(clase=clase.upper())

        periodo_id = entero_param(self.request.query_params, 'periodo')  # Bloque 6: 400 si no es id
        if periodo_id:
            qs = qs.filter(periodo_id=periodo_id)

        estado = self.request.query_params.get('estado')
        if estado:
            qs = qs.filter(estado=estado.upper())

        estado_revision = self.request.query_params.get('estado_revision')
        if estado_revision:
            qs = qs.filter(estado_revision=estado_revision.upper())

        # Navegación: vistas separadas de Compras/Ventas (sin notas) y de Notas de Crédito/Débito.
        es_nota = self.request.query_params.get('es_nota')
        if es_nota not in (None, ''):
            valor = str(es_nota).strip().lower()
            if valor not in ('true', 'false', '1', '0'):
                raise ValidationError({'es_nota': "Valor no permitido. Use 'true' o 'false'."})
            qs = qs.filter(tipo_comprobante__es_nota=valor in ('true', '1'))

        search = self.request.query_params.get('search')
        if search:
            search = search.strip()
            condicion = (
                Q(serie_normalizada__icontains=search) |
                Q(numero_normalizado__icontains=search) |
                Q(ruc_emisor__icontains=search) |
                Q(tercero__razon_social__icontains=search)
            )
            # Bloque 7: el buscador del frontend admite "SERIE-NUMERO" (antes se filtraba
            # en el navegador sobre "F001-123"); ahora la búsqueda se hace aquí.
            if '-' in search:
                serie, _, numero = search.partition('-')
                if serie and numero:
                    condicion |= Q(serie_normalizada__iendswith=serie, numero_normalizado__istartswith=numero)
                elif serie:
                    condicion |= Q(serie_normalizada__iendswith=serie)
                elif numero:
                    condicion |= Q(numero_normalizado__istartswith=numero)
            qs = qs.filter(condicion)

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
    permission_classes = [TieneEmpresaActiva, EsAdminEmpresa]

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
    permission_classes = [TieneEmpresaActiva, EsAdminEmpresa]

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


class DocumentoCapturaSubirView(APIView):
    """
    Sube un archivo XML, PDF o Imagen para captura electrónica u OCR.
    Calcula SHA-256 para evitar duplicados y extrae campos automáticamente.
    """
    permission_classes = [TieneEmpresaActiva]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        serializer = DocumentoCapturaSubirSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        archivo = serializer.validated_data['archivo']
        tipo = serializer.validated_data['tipo']
        texto_ocr = serializer.validated_data.get('texto_ocr', '')

        captura, fue_creado = procesar_subida_captura(
            empresa_id=request.empresa_id,
            usuario=request.user,
            archivo=archivo,
            tipo=tipo,
            texto_ocr=texto_ocr,
            nombre_archivo=serializer.validated_data['nombre_seguro'],
        )

        data = DocumentoCapturaDetailSerializer(captura).data
        data['fue_creado_nuevo'] = fue_creado
        data['mensaje'] = (
            'Archivo procesado exitosamente.'
            if fue_creado
            else 'Archivo idéntico detectado (hash SHA-256 ya existente), reutilizando captura.'
        )

        st = status.HTTP_201_CREATED if fue_creado else status.HTTP_200_OK
        return Response(data, status=st)


class DocumentoCapturaListView(generics.ListAPIView):
    """Lista las capturas realizadas por la empresa activa."""
    permission_classes = [TieneEmpresaActiva]
    serializer_class = DocumentoCapturaListSerializer
    pagination_class = PaginacionOpcional

    def get_queryset(self):
        empresa_id = getattr(self.request, 'empresa_id', None)
        if not empresa_id:
            return DocumentoCaptura.objects.none()
        qs = DocumentoCaptura.objects.filter(empresa_id=empresa_id).select_related('subido_por').prefetch_related('campos')
        tipo = self.request.query_params.get('tipo')
        if tipo:
            qs = qs.filter(tipo=tipo.upper())
        estado = self.request.query_params.get('estado')
        if estado:
            qs = qs.filter(estado_proceso=estado.upper())
        return qs.order_by('-id')


class DocumentoCapturaDetailView(generics.RetrieveAPIView):
    """Detalle completo de una captura con todos sus campos extraídos."""
    permission_classes = [TieneEmpresaActiva]
    serializer_class = DocumentoCapturaDetailSerializer

    def get_queryset(self):
        empresa_id = getattr(self.request, 'empresa_id', None)
        if not empresa_id:
            return DocumentoCaptura.objects.none()
        return DocumentoCaptura.objects.filter(empresa_id=empresa_id).select_related('subido_por', 'documento').prefetch_related('campos')


class CapturaCampoCorregirView(APIView):
    """Permite al usuario corregir el valor de un campo extraído en CapturaCampo."""
    permission_classes = [TieneEmpresaActiva]

    def patch(self, request, pk):
        serializer = CapturaCampoCorregirSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        campo = corregir_campo_captura(
            captura_id=pk,
            campo_id=serializer.validated_data['campo_id'],
            valor_corregido=serializer.validated_data['valor_corregido'],
            empresa_id=request.empresa_id,
            usuario=request.user,
        )
        return Response(CapturaCampoSerializer(campo).data, status=status.HTTP_200_OK)


class DocumentoCapturaGenerarBorradorView(APIView):
    """
    Convierte la captura en un Documento comercial estrictamente en BORRADOR y PENDIENTE.
    Crea Incidencia tipo 'PRODUCTO_SIN_HOMOLOGAR' para cada ítem sin ProductoEquivalencia.
    """
    permission_classes = [TieneEmpresaActiva]

    def post(self, request, pk):
        serializer = GenerarBorradorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        res = generar_borrador_desde_captura(
            captura_id=pk,
            empresa_id=request.empresa_id,
            usuario=request.user,
            almacen_id=serializer.validated_data.get('almacen_id'),
        )
        return Response(res, status=status.HTTP_201_CREATED)
