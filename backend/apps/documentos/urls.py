from django.urls import path
from apps.documentos.views import (
    DocumentoListCreateView,
    DocumentoDetailView,
    DocumentoRevisarView,
    DocumentoConfirmarView,
    DocumentoAnularView,
)

urlpatterns = [
    path('', DocumentoListCreateView.as_view(), name='documento-list-create'),
    path('<int:pk>/', DocumentoDetailView.as_view(), name='documento-detail'),
    path('<int:pk>/revisar/', DocumentoRevisarView.as_view(), name='documento-revisar'),
    path('<int:pk>/confirmar/', DocumentoConfirmarView.as_view(), name='documento-confirmar'),
    path('<int:pk>/anular/', DocumentoAnularView.as_view(), name='documento-anular'),
]
