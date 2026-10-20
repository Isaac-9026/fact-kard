from django.apps import AppConfig


class UsuariosConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.usuarios'

    def ready(self):
        from django.conf import settings
        from corsheaders.defaults import default_headers

        # Permitir el header multiempresa X-Empresa-Id en CORS preflight
        current_headers = list(getattr(settings, 'CORS_ALLOW_HEADERS', default_headers))
        if 'x-empresa-id' not in [h.lower() for h in current_headers]:
            current_headers.append('x-empresa-id')
            settings.CORS_ALLOW_HEADERS = tuple(current_headers)
