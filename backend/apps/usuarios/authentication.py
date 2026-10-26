import uuid

from django.conf import settings
from django.core import signing
from rest_framework import authentication, exceptions
from rest_framework.throttling import SimpleRateThrottle

from apps.usuarios.models import TokenRevocado, Usuario

TOKEN_SALT = 'fact-kard-token-auth'
MENSAJE_SESION_INVALIDA = 'La sesión no es válida o expiró. Inicie sesión nuevamente.'


def duracion_token():
    """Bloque 6: duración configurable (settings.TOKEN_MAX_AGE_SECONDS / variable de entorno)."""
    return int(getattr(settings, 'TOKEN_MAX_AGE_SECONDS', 60 * 60 * 24 * 7))


def generar_token(usuario: Usuario) -> str:
    """
    Token firmado con SECRET_KEY. Bloque 6: incluye un identificador único (`jti`) para
    poder revocarlo en el logout.
    """
    payload = {
        'user_id': usuario.id,
        'username': usuario.username,
        'jti': uuid.uuid4().hex,
    }
    return signing.dumps(payload, salt=TOKEN_SALT)


def leer_token(token_str: str) -> dict:
    try:
        payload = signing.loads(token_str, salt=TOKEN_SALT, max_age=duracion_token())
    except signing.SignatureExpired:
        raise exceptions.AuthenticationFailed('El token de autenticación ha expirado.')
    except signing.BadSignature:
        raise exceptions.AuthenticationFailed('El token de autenticación es inválido o corrupto.')
    if not payload.get('jti'):
        # Tokens emitidos antes del Bloque 6 no son revocables: se pide un nuevo login.
        raise exceptions.AuthenticationFailed(MENSAJE_SESION_INVALIDA)
    return payload


def validar_token(token_str: str) -> Usuario:
    """
    Decodifica y valida el token firmado.
    Retorna la instancia activa del usuario o lanza AuthenticationFailed.
    """
    payload = leer_token(token_str)
    if TokenRevocado.objects.filter(jti=payload['jti']).exists():
        raise exceptions.AuthenticationFailed(MENSAJE_SESION_INVALIDA)

    try:
        usuario = Usuario.objects.get(id=payload.get('user_id'))
    except Usuario.DoesNotExist:
        raise exceptions.AuthenticationFailed(MENSAJE_SESION_INVALIDA)

    # Se verifica en cada request: desactivar al usuario corta sus sesiones de inmediato.
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


class LoginRateThrottle(SimpleRateThrottle):
    """
    Bloque 6: limita los intentos de login por IP (settings.LOGIN_THROTTLE_RATE, p. ej.
    '10/min'). Responde 429 sin revelar si el usuario existe.
    """
    scope = 'login'

    def get_rate(self):
        return getattr(settings, 'LOGIN_THROTTLE_RATE', '10/min')

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}
