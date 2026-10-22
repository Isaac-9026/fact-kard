from rest_framework.permissions import BasePermission
from rest_framework.exceptions import PermissionDenied, NotAuthenticated
from apps.usuarios.models import UsuarioEmpresa


class TieneEmpresaActiva(BasePermission):
    """
    Permiso reusable de DRF para control multiempresa estricto.
    1. Lee el encabezado 'X-Empresa-Id'.
    2. Valida que el usuario autenticado esté activo.
    3. Valida que tenga una fila activa en 'usuario_empresa' para esa empresa
       (o que sea 'es_admin_global=True').
    4. Inyecta 'request.empresa_id' y 'request.rol_empresa'.
    5. Si intenta acceder a otra empresa o no tiene asignación activa, retorna 403 Forbidden.
    """
    message = "Acceso denegado a la empresa solicitada."

    def has_permission(self, request, view):
        usuario = getattr(request, 'user', None)
        if not usuario or not getattr(usuario, 'is_authenticated', False) or not getattr(usuario, 'activo', False):
            raise NotAuthenticated("Se requiere autenticación para acceder a este recurso.")

        empresa_id_raw = (
            request.headers.get('X-Empresa-Id') or
            request.META.get('HTTP_X_EMPRESA_ID')
        )
        if not empresa_id_raw:
            raise PermissionDenied("El encabezado 'X-Empresa-Id' es obligatorio para operar en el sistema.")

        try:
            empresa_id = int(empresa_id_raw)
        except (ValueError, TypeError):
            raise PermissionDenied("El encabezado 'X-Empresa-Id' debe ser un identificador numérico válido.")

        # Si es Administrador Global, tiene acceso total a cualquier empresa con rol ADMIN
        if getattr(usuario, 'es_admin_global', False):
            request.empresa_id = empresa_id
            ue = UsuarioEmpresa.objects.filter(
                usuario=usuario,
                empresa_id=empresa_id,
                activo=True
            ).first()
            request.rol_empresa = ue.rol if ue else 'ADMIN'
            return True

        # Validar membresía activa en usuario_empresa
        ue = UsuarioEmpresa.objects.filter(
            usuario=usuario,
            empresa_id=empresa_id,
            activo=True
        ).first()

        if not ue:
            raise PermissionDenied(
                f"El usuario no tiene asignación activa en la empresa con ID {empresa_id}."
            )

        # Inyectar contexto multiempresa en la request
        request.empresa_id = empresa_id
        request.rol_empresa = ue.rol
        return True


class EsAdminEmpresa(BasePermission):
    """
    Permiso reusable de DRF que exige rol 'ADMIN' en la empresa activa
    o privilegios globales de superadministrador ('es_admin_global=True').
    """
    message = "Operación restringida: se requieren privilegios de Administrador en la empresa activa."

    def has_permission(self, request, view):
        usuario = getattr(request, 'user', None)
        if not usuario or not getattr(usuario, 'is_authenticated', False) or not getattr(usuario, 'activo', False):
            raise NotAuthenticated("Se requiere autenticación para acceder a este recurso.")

        if getattr(usuario, 'es_admin_global', False):
            return True

        rol = getattr(request, 'rol_empresa', None)
        if rol == 'ADMIN':
            return True

        raise PermissionDenied(self.message)
