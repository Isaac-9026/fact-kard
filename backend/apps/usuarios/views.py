from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiResponse

from apps.usuarios.models import TokenRevocado, Usuario, UsuarioEmpresa
from apps.usuarios.authentication import (
    LoginRateThrottle, UsuarioTokenAuthentication, duracion_token, generar_token, leer_token,
)
from apps.usuarios.permissions import TieneEmpresaActiva, EsAdminEmpresa
from apps.usuarios.serializers import (
    LoginRequestSerializer,
    UsuarioResponseSerializer,
    UsuarioEmpresaItemSerializer,
    AsignarUsuarioRequestSerializer,
)
from apps.auditoria.services import registrar_auditoria
from apps.empresas.models import Empresa


def obtener_empresas_usuario(usuario: Usuario):
    """
    Retorna la lista de empresas activas a las que el usuario tiene acceso,
    junto con su rol ('ADMIN' o 'USUARIO').
    """
    if usuario.es_admin_global:
        todas = Empresa.objects.filter(estado='ACTIVA').order_by('razon_social')
        asignaciones = {
            ue.empresa_id: ue.rol
            for ue in UsuarioEmpresa.objects.filter(usuario=usuario, activo=True)
        }
        return [
            {
                'id': emp.id,
                'ruc': emp.ruc,
                'razon_social': emp.razon_social,
                'nombre_comercial': emp.nombre_comercial,
                'rol': asignaciones.get(emp.id, 'ADMIN'),
                'activo': True,
            }
            for emp in todas
        ]

    asignaciones = (
        UsuarioEmpresa.objects.filter(
            usuario=usuario,
            activo=True,
            empresa__estado='ACTIVA'
        )
        .select_related('empresa')
        .order_by('empresa__razon_social')
    )
    return [
        {
            'id': ue.empresa.id,
            'ruc': ue.empresa.ruc,
            'razon_social': ue.empresa.razon_social,
            'nombre_comercial': ue.empresa.nombre_comercial,
            'rol': ue.rol,
            'activo': ue.activo,
        }
        for ue in asignaciones
    ]


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    @extend_schema(
        summary="Autenticación de usuario",
        description="Valida username y contraseña contra password_hash y devuelve token, datos de usuario y empresas asociadas.",
        request=LoginRequestSerializer,
        responses={
            200: OpenApiResponse(description="Inicio de sesión exitoso."),
            401: OpenApiResponse(description="Credenciales inválidas."),
            403: OpenApiResponse(description="Usuario inactivo."),
        }
    )
    def post(self, request):
        serializer = LoginRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        username = serializer.validated_data['username']
        password = serializer.validated_data['password']

        # Bloque 6: mismo mensaje y mismo trabajo de hash exista o no el usuario.
        usuario = Usuario.objects.filter(username=username).first()
        if usuario is None:
            make_password(password)  # equipara el tiempo de respuesta
            return Response({'detail': 'Credenciales de acceso inválidas.'}, status=status.HTTP_401_UNAUTHORIZED)

        if not usuario.check_password(password):
            return Response({'detail': 'Credenciales de acceso inválidas.'}, status=status.HTTP_401_UNAUTHORIZED)

        # Solo con la contraseña correcta se informa que la cuenta está inactiva.
        if not usuario.activo:
            return Response(
                {'detail': 'El usuario se encuentra inactivo. Contacte al administrador.'},
                status=status.HTTP_403_FORBIDDEN
            )

        token = generar_token(usuario)
        empresas_data = obtener_empresas_usuario(usuario)

        return Response({
            'token': token,
            'usuario': UsuarioResponseSerializer(usuario).data,
            'empresas': empresas_data,
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """Bloque 6: revoca el token usado en la petición (logout efectivo en el servidor)."""
    permission_classes = [IsAuthenticated]
    authentication_classes = [UsuarioTokenAuthentication]

    def post(self, request):
        payload = leer_token(request.auth)
        expira = timezone.now() + timedelta(seconds=duracion_token())
        TokenRevocado.objects.get_or_create(jti=payload['jti'], defaults={'usuario': request.user, 'expira_en': expira})
        # Limpieza oportunista de revocaciones ya expiradas.
        TokenRevocado.objects.filter(expira_en__lt=timezone.now()).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [UsuarioTokenAuthentication]

    @extend_schema(
        summary="Perfil del usuario autenticado",
        description="Retorna la información del usuario autenticado y su lista de empresas activas.",
        responses={200: OpenApiResponse(description="Datos del usuario actual.")}
    )
    def get(self, request):
        usuario = request.user
        if not usuario.activo:
            return Response(
                {'detail': 'El usuario se encuentra inactivo.'},
                status=status.HTTP_403_FORBIDDEN
            )

        empresas_data = obtener_empresas_usuario(usuario)
        return Response({
            'usuario': UsuarioResponseSerializer(usuario).data,
            'empresas': empresas_data,
        }, status=status.HTTP_200_OK)


class AsignacionesView(APIView):
    permission_classes = [TieneEmpresaActiva, EsAdminEmpresa]
    authentication_classes = [UsuarioTokenAuthentication]

    @extend_schema(
        summary="Listar usuarios asignados a la empresa activa",
        description="Retorna los usuarios vinculados a la empresa especificada en X-Empresa-Id. Requiere rol ADMIN.",
        responses={200: UsuarioEmpresaItemSerializer(many=True)}
    )
    def get(self, request):
        # Aislamiento multiempresa obligatorio por request.empresa_id
        asignaciones = (
            UsuarioEmpresa.objects.filter(empresa_id=request.empresa_id)
            .select_related('usuario', 'empresa')
            .order_by('usuario__username')
        )
        serializer = UsuarioEmpresaItemSerializer(asignaciones, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Asignar o actualizar rol de usuario en empresa activa",
        description="Crea o actualiza la vinculación de un usuario a la empresa activa con rol ADMIN o USUARIO.",
        request=AsignarUsuarioRequestSerializer,
        responses={
            200: UsuarioEmpresaItemSerializer,
            201: UsuarioEmpresaItemSerializer
        }
    )
    def post(self, request):
        serializer = AsignarUsuarioRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        usuario_id = serializer.validated_data['usuario_id']
        rol = serializer.validated_data['rol']
        activo = serializer.validated_data['activo']

        usuario_asignado = Usuario.objects.get(id=usuario_id)

        with transaction.atomic():
            ue, created = UsuarioEmpresa.objects.get_or_create(
                usuario_id=usuario_id,
                empresa_id=request.empresa_id,
                defaults={'rol': rol, 'activo': activo}
            )

            valor_anterior = None
            if not created:
                valor_anterior = {'rol': ue.rol, 'activo': ue.activo}
                ue.rol = rol
                ue.activo = activo
                ue.save()

            valor_nuevo = {'rol': ue.rol, 'activo': ue.activo}

            # Registrar en auditoría
            registrar_auditoria(
                empresa_id=request.empresa_id,
                usuario_id=request.user.id,
                accion='ASIGNAR_USUARIO' if created else 'ACTUALIZAR_ASIGNACION',
                entidad='USUARIO_EMPRESA',
                registro_id=ue.id,
                valor_anterior=valor_anterior,
                valor_nuevo=valor_nuevo,
                motivo=f"{'Creación' if created else 'Modificación'} de rol {rol} para usuario '{usuario_asignado.username}'."
            )

        res_serializer = UsuarioEmpresaItemSerializer(ue)
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(res_serializer.data, status=status_code)
