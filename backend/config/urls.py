from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from config.health import health
from apps.empresas.views import SunatEstadoView

urlpatterns = [
    path('api/health/', health, name='health'),
    path('admin/', admin.site.urls),
    path('api/usuarios/', include('apps.usuarios.urls')),
    path('api/empresas/', include('apps.empresas.urls')),
    path('api/catalogos/', include('apps.catalogos.urls')),
    path('api/inventario/', include('apps.inventario.urls')),
    path('api/documentos/', include('apps.documentos.urls')),
    path('api/kardex/', include('apps.kardex.urls')),
    path('api/auditoria/', include('apps.auditoria.urls')),
    path('api/reportes/', include('apps.reportes.urls')),
    # Bloque 17B: estado de la preparación SUNAT (solo lectura, solo ADMIN).
    path('api/configuracion/sunat/estado/', SunatEstadoView.as_view(), name='sunat-estado'),
]

# Bloque 8: Swagger/OpenAPI solo con API_DOCS_ENABLED=True (por defecto, solo en desarrollo).
if settings.API_DOCS_ENABLED:
    urlpatterns += [
        path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
        path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    ]
