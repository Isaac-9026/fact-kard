from django.core import signing
from rest_framework import authentication, exceptions
from apps.usuarios.models import Usuario

TOKEN_SALT = 'fact-kard-token-auth'
TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7  # 7 días de validez


def generar_token(usuario: Usuario) -> str:
    """
    Genera un token firmado criptográficamente para el usuario.
    Utiliza el SECRET_KEY del proyecto y es a prueba de manipulaciones.
    """
    payload = {
        'user_id': usuario.id,
        'username': usuario.username,
    }
    return signing.dumps(payload, salt=TOKEN_SALT)


def validar_token(token_str: str) -> Usuario:
    """
    Decodifica y valida el token firmado.
    Retorna la instancia activa del usuario o lanza AuthenticationFailed.
    """
    try:
        payload = signing.loads(token_str, salt=TOKEN_SALT, max_age=TOKEN_MAX_AGE_SECONDS)
    except signing.SignatureExpired:
        raise exceptions.AuthenticationFailed('El token de autenticación ha expirado.')
    except signing.BadSignature:
        raise exceptions.AuthenticationFailed('El token de autenticación es inválido o corrupto.')

    user_id = payload.get('user_id')
    try:
        usuario = Usuario.objects.get(id=user_id)
    except Usuario.DoesNotExist:
        raise exceptions.AuthenticationFailed('El usuario asociado a este token no existe.')

    if not usuario.activo:
        raise exceptions.AuthenticationFailed('El usuario se encuentra inactivo.')

    return usuario


class UsuarioTokenAuthentication(authentication.BaseAuthentication):
    """
    Esquema de autenticación por Token 'Bearer <token>' o 'Token <token>'
    para el modelo customizado Usuario de FACT-KARD.
    """
    keyword = 'Bearer'

    def authenticate(self, request):
        auth_header = request.headers.get('Authorization') or request.META.get('HTTP_AUTHORIZATION')
        if not auth_header:
            return None

        parts = auth_header.split()
        if len(parts) != 2:
            return None

        prefix = parts[0].lower()
        if prefix not in ('bearer', 'token'):
            return None

        token_str = parts[1]
        usuario = validar_token(token_str)
        return (usuario, token_str)

    def authenticate_header(self, request):
        return self.keyword
