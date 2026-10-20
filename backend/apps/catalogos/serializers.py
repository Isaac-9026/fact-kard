from rest_framework import serializers

from apps.catalogos.models import Moneda


class MonedaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Moneda
        fields = ('codigo', 'nombre')
        read_only_fields = fields
