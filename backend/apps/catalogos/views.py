from rest_framework import generics

from apps.catalogos.models import Moneda
from apps.catalogos.serializers import MonedaSerializer


class MonedaListView(generics.ListAPIView):
    serializer_class = MonedaSerializer
    queryset = Moneda.objects.all().order_by('codigo')
