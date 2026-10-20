from django.urls import path

from apps.inventario.views import (
    AlmacenDetailView,
    AlmacenListCreateView,
    ProductoDetailView,
    ProductoListCreateView,
    ProductoUnidadDetailView,
    ProductoUnidadListCreateView,
    TerceroDetailView,
    TerceroListCreateView,
    TipoExistenciaListView,
    UnidadMedidaListView,
)


urlpatterns = [
    path('almacenes/', AlmacenListCreateView.as_view(), name='almacen-list-create'),
    path('almacenes/<int:pk>/', AlmacenDetailView.as_view(), name='almacen-detail'),
    path('terceros/', TerceroListCreateView.as_view(), name='tercero-list-create'),
    path('terceros/<int:pk>/', TerceroDetailView.as_view(), name='tercero-detail'),
    path('productos/', ProductoListCreateView.as_view(), name='producto-list-create'),
    path('productos/<int:pk>/', ProductoDetailView.as_view(), name='producto-detail'),
    path(
        'productos/<int:producto_id>/unidades/',
        ProductoUnidadListCreateView.as_view(),
        name='producto-unidad-list-create',
    ),
    path(
        'productos/<int:producto_id>/unidades/<int:unidad_id>/',
        ProductoUnidadDetailView.as_view(),
        name='producto-unidad-detail',
    ),
    path(
        'catalogos/tipos-existencia/',
        TipoExistenciaListView.as_view(),
        name='tipo-existencia-list',
    ),
    path(
        'catalogos/unidades-medida/',
        UnidadMedidaListView.as_view(),
        name='unidad-medida-list',
    ),
]
