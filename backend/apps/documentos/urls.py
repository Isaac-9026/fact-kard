from django.urls import path
from apps.documentos.views import (
    DocumentoListCreateView,
    DocumentoDetailView,
    DocumentoRevisarView,
    DocumentoConfirmarView,
    DocumentoAnularView,
    DocumentoCapturaSubirView,
    DocumentoCapturaListView,
    DocumentoCapturaDetailView,
    CapturaCampoCorregirView,
    DocumentoCapturaGenerarBorradorView,
)

urlpatterns = [
    path('', DocumentoListCreateView.as_view(), name='documento-list-create'),
    path('capturas/', DocumentoCapturaListView.as_view(), name='documento-captura-list'),
    path('capturas/subir/', DocumentoCapturaSubirView.as_view(), name='documento-captura-subir'),
    path('capturas/<int:pk>/', DocumentoCapturaDetailView.as_view(), name='documento-captura-detail'),
    path('capturas/<int:pk>/corregir-campo/', CapturaCampoCorregirView.as_view(), name='captura-campo-corregir'),
    path('capturas/<int:pk>/generar-borrador/', DocumentoCapturaGenerarBorradorView.as_view(), name='documento-captura-generar-borrador'),
    path('<int:pk>/', DocumentoDetailView.as_view(), name='documento-detail'),
    path('<int:pk>/revisar/', DocumentoRevisarView.as_view(), name='documento-revisar'),
    path('<int:pk>/confirmar/', DocumentoConfirmarView.as_view(), name='documento-confirmar'),
    path('<int:pk>/anular/', DocumentoAnularView.as_view(), name='documento-anular'),
]
