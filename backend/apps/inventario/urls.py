from django.urls import path

from apps.inventario.views import (
    AlmacenDetailView,
    AlmacenListCreateView,
    NotaInternaAnularView,
    NotaInternaDetailView,
    NotaInternaListCreateView,
    ProductoDetailView,
    ProductoListCreateView,
    ProductoUnidadDetailView,
    ProductoUnidadListCreateView,
    SaldoInicialDetailView,
    SaldoInicialListCreateView,
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
    path(
        'saldos-iniciales/',
        SaldoInicialListCreateView.as_view(),
        name='saldo-inicial-list-create',
    ),
    path(
        'saldos-iniciales/<int:pk>/',
        SaldoInicialDetailView.as_view(),
        name='saldo-inicial-detail',
    ),
    path(
        'notas-internas/',
        NotaInternaListCreateView.as_view(),
        name='nota-interna-list-create',
    ),
    path(
        'notas-internas/<int:pk>/',
        NotaInternaDetailView.as_view(),
        name='nota-interna-detail',
    ),
    path(
        'notas-internas/<int:pk>/anular/',
        NotaInternaAnularView.as_view(),
        name='nota-interna-anular',
    ),
]
