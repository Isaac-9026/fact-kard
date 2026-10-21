from rest_framework import serializers


class KardexFilaSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    fecha = serializers.DateField()
    documento_referencia = serializers.CharField(allow_blank=True)
    tipo_operacion_codigo = serializers.CharField(allow_blank=True)
    tipo_operacion_descripcion = serializers.CharField(allow_blank=True)
    naturaleza = serializers.CharField()
    almacen_codigo = serializers.CharField(allow_blank=True)
    almacen_nombre = serializers.CharField(allow_blank=True)
    producto_id = serializers.IntegerField()
    producto_codigo = serializers.CharField(allow_blank=True)
    producto_descripcion = serializers.CharField(allow_blank=True)

    # Bloque Entradas
    entrada_cantidad = serializers.DecimalField(max_digits=20, decimal_places=8, allow_null=True)
    entrada_costo_unitario = serializers.DecimalField(max_digits=20, decimal_places=8, allow_null=True)
    entrada_valor = serializers.DecimalField(max_digits=20, decimal_places=8, allow_null=True)

    # Bloque Salidas
    salida_cantidad = serializers.DecimalField(max_digits=20, decimal_places=8, allow_null=True)
    salida_costo_unitario = serializers.DecimalField(max_digits=20, decimal_places=8, allow_null=True)
    salida_valor = serializers.DecimalField(max_digits=20, decimal_places=8, allow_null=True)

    # Bloque Saldo Final
    saldo_cantidad = serializers.DecimalField(max_digits=20, decimal_places=8, allow_null=True)
    cpp = serializers.DecimalField(max_digits=20, decimal_places=8, allow_null=True)
    saldo_valor = serializers.DecimalField(max_digits=20, decimal_places=8, allow_null=True)

    # Metadatos del motor
    prioridad_dia = serializers.IntegerField()
    secuencia = serializers.IntegerField()
    es_extorno = serializers.BooleanField()
    generado_por_motor = serializers.BooleanField()
    creado_en = serializers.DateTimeField()


class KardexResumenSerializer(serializers.Serializer):
    total_entradas_cantidad = serializers.DecimalField(max_digits=20, decimal_places=8)
    total_entradas_valor = serializers.DecimalField(max_digits=20, decimal_places=8)
    total_salidas_cantidad = serializers.DecimalField(max_digits=20, decimal_places=8)
    total_salidas_valor = serializers.DecimalField(max_digits=20, decimal_places=8)
    saldo_final_cantidad = serializers.DecimalField(max_digits=20, decimal_places=8)
    cpp_final = serializers.DecimalField(max_digits=20, decimal_places=8, allow_null=True)
    saldo_final_valor = serializers.DecimalField(max_digits=20, decimal_places=8)
    total_registros = serializers.IntegerField()


class KardexReporteResponseSerializer(serializers.Serializer):
    empresa_id = serializers.IntegerField()
    filtros = serializers.DictField()
    resumen = KardexResumenSerializer()
    movimientos = KardexFilaSerializer(many=True)
