from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse

from apps.auditoria.models import Auditoria
from apps.auditoria.serializers import AuditoriaSerializer
from apps.usuarios.authentication import UsuarioTokenAuthentication
from apps.usuarios.permissions import TieneEmpresaActiva, EsAdminEmpresa


class AuditoriaListView(APIView):
    """
    Endpoint de consulta de auditoría.
    Protegido con TieneEmpresaActiva y EsAdminEmpresa.
    Aislamiento estricto: solo devuelve registros de request.empresa_id.
    Permite filtrar por 'entidad' y 'accion'.
    """
    permission_classes = [TieneEmpresaActiva, EsAdminEmpresa]
    authentication_classes = [UsuarioTokenAuthentication]

    @extend_schema(
        summary="Consultar registros de auditoría",
        description="Retorna el log inmutable de auditoría de la empresa activa. Permite filtros por entidad y acción.",
        parameters=[
            OpenApiParameter(name='entidad', description='Filtrar por nombre de entidad (ej: USUARIO_EMPRESA, DOCUMENTO)', required=False, type=str),
            OpenApiParameter(name='accion', description='Filtrar por tipo de acción (ej: ASIGNAR_USUARIO, CREAR)', required=False, type=str),
        ],
        responses={200: AuditoriaSerializer(many=True)}
    )
    def get(self, request):
        # Aislamiento multiempresa estricto
        qs = (
            Auditoria.objects.filter(empresa_id=request.empresa_id)
            .select_related('usuario', 'empresa')
            .order_by('-fecha', '-id')
        )

        entidad = request.query_params.get('entidad')
        if entidad:
            qs = qs.filter(entidad__iexact=entidad.strip())

        accion = request.query_params.get('accion')
        if accion:
            qs = qs.filter(accion__iexact=accion.strip())

        serializer = AuditoriaSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
