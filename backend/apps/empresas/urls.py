from django.urls import path

from apps.empresas.views import (
    ConfigEmpresaView,
    ConfigIgvDetailView,
    ConfigIgvListCreateView,
    ConfigIgvPeriodoView,
    EmpresaListCreateView,
    EstablecimientoDetailView,
    EstablecimientoListCreateView,
    PeriodoCerrarView,
    PeriodoListCreateView,
    PeriodoReabrirView,
)


urlpatterns = [
    path('', EmpresaListCreateView.as_view(), name='empresa-list-create'),
    path('config/', ConfigEmpresaView.as_view(), name='empresa-config'),
    path('establecimientos/', EstablecimientoListCreateView.as_view(), name='establecimiento-list-create'),
    path('establecimientos/<int:pk>/', EstablecimientoDetailView.as_view(), name='establecimiento-detail'),
    path('periodos/', PeriodoListCreateView.as_view(), name='periodo-list-create'),
    path('periodos/<int:pk>/cerrar/', PeriodoCerrarView.as_view(), name='periodo-cerrar'),
    path('periodos/<int:pk>/reabrir/', PeriodoReabrirView.as_view(), name='periodo-reabrir'),
    path('periodos/<int:periodo_id>/igv/', ConfigIgvPeriodoView.as_view(), name='periodo-config-igv'),
    path('config-igv/', ConfigIgvListCreateView.as_view(), name='config-igv-list-create'),
    path('config-igv/<int:pk>/', ConfigIgvDetailView.as_view(), name='config-igv-detail'),
]
