from django.urls import path

from apps.empresas.views import (
    ConfigEmpresaView,
    EmpresaListCreateView,
    EstablecimientoDetailView,
    EstablecimientoListCreateView,
)


urlpatterns = [
    path('', EmpresaListCreateView.as_view(), name='empresa-list-create'),
    path('config/', ConfigEmpresaView.as_view(), name='empresa-config'),
    path('establecimientos/', EstablecimientoListCreateView.as_view(), name='establecimiento-list-create'),
    path('establecimientos/<int:pk>/', EstablecimientoDetailView.as_view(), name='establecimiento-detail'),
]
