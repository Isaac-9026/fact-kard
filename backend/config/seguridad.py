"""
Resolución segura de la configuración sensible de FACT-KARD (SEC-001).

Reglas:
- Producción (DEBUG=False): SECRET_KEY es obligatoria, no puede ser un valor
  conocido/de ejemplo y debe tener longitud suficiente. ALLOWED_HOSTS no puede
  contener '*'.
- Desarrollo (DEBUG=True) sin SECRET_KEY: se genera una clave aleatoria y se
  guarda en un archivo local ignorado por git, para que no exista ningún
  fallback público y los tokens sobrevivan a los reinicios del autoreload.
- Tests (`manage.py test`) sin SECRET_KEY: clave aleatoria efímera en memoria.
"""
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from django.core.management.utils import get_random_secret_key

LONGITUD_MINIMA_SECRET_KEY = 50

# Valores publicados en el repositorio (settings.py y .env.example) en versiones
# anteriores. Nunca deben aceptarse fuera de desarrollo.
SECRET_KEYS_INSEGURAS = frozenset({
    'django-insecure-fact-kard-secret-key-change-in-prod',
    'cambiar_este_secreto_por_uno_seguro',
    'cambiar_esto',
})

MENSAJE_SIN_SECRET_KEY = (
    "SECRET_KEY no está definida. Agrégala a backend/.env "
    "(genera una con: python -c \"from django.core.management.utils import "
    "get_random_secret_key; print(get_random_secret_key())\"). "
    "Para desarrollo local también puedes definir DEBUG=True."
)


def es_secret_key_insegura(valor: str) -> bool:
    return (
        valor in SECRET_KEYS_INSEGURAS
        or valor.startswith('django-insecure')
        or len(valor) < LONGITUD_MINIMA_SECRET_KEY
    )


def _clave_desarrollo_persistida(ruta: Path) -> str:
    try:
        existente = ruta.read_text(encoding='utf-8').strip()
    except FileNotFoundError:
        existente = ''
    if existente:
        return existente
    nueva = get_random_secret_key()
    ruta.write_text(nueva, encoding='utf-8')
    return nueva


def resolver_secret_key(*, valor, debug: bool, ejecutando_tests: bool, ruta_clave_dev: Path) -> str:
    valor = (valor or '').strip()

    if valor:
        if not debug and not ejecutando_tests and es_secret_key_insegura(valor):
            raise ImproperlyConfigured(
                'SECRET_KEY es insegura (valor de ejemplo, prefijo django-insecure o menos de '
                f'{LONGITUD_MINIMA_SECRET_KEY} caracteres). Genera una nueva para producción.'
            )
        return valor

    if ejecutando_tests:
        return get_random_secret_key()
    if debug:
        return _clave_desarrollo_persistida(ruta_clave_dev)
    raise ImproperlyConfigured(MENSAJE_SIN_SECRET_KEY)


def validar_allowed_hosts(hosts, *, debug: bool):
    hosts = [h.strip() for h in hosts if h and h.strip()]
    if not debug and '*' in hosts:
        raise ImproperlyConfigured(
            "ALLOWED_HOSTS='*' no está permitido con DEBUG=False. Lista los dominios reales."
        )
    return hosts
