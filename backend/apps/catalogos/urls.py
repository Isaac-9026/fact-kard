from django.urls import path

from apps.catalogos.views import MonedaListView


urlpatterns = [
    path('monedas/', MonedaListView.as_view(), name='moneda-list'),
]
