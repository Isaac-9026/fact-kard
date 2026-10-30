from decimal import Decimal

from django.db import transaction
from django.db.models import F
from rest_framework import generics, status
from rest_framework.exceptions import NotAuthenticated, NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.empresas.models import CierrePeriodo, ConfigEmpresa, ConfigIgvPeriodo, Empresa, Establecimiento, Periodo
from apps.empresas.serializers import (
    ConfigEmpresaSerializer,
    ConfigIgvPeriodoSerializer,
    DatosFiscalesEmpresaSerializer,
    EmpresaSerializer,
    EstablecimientoSerializer,
    PeriodoCreateSerializer,
    PeriodoSerializer,
    ReabrirPeriodoSerializer,
    CierrePeriodoSerializer,
)
from apps.empresas.services import cerrar_periodo, reabrir_periodo
from apps.usuarios.models import UsuarioEmpresa
from apps.usuarios.permissions import EsAdminEmpresa, TieneEmpresaActiva
from apps.auditoria.services import registrar_auditoria


def _usuario_actual(request):
    usuario = getattr(request, 'user', None)
    if usuario is None or getattr(usuario, 'pk', None) is None:
        raise NotAuthenticated('Se requiere un usuario autenticado.')
    return usuario


def _empresa_activa(request):
    usuario = _usuario_actual(request)
    raw_empresa_id = request.headers.get('X-Empresa-Id')
    if not raw_empresa_id:
        raise ValidationError({'X-Empresa-Id': 'Este header es obligatorio.'})
    try:
        empresa_id = int(raw_empresa_id)
    except (TypeError, ValueError):
        raise ValidationError({'X-Empresa-Id': 'Debe ser un identificador válido.'})

    asignacion = UsuarioEmpresa.objects.filter(
        usuario_id=usuario.pk,
        empresa_id=empresa_id,
        activo=True,
    ).select_related('empresa').first()
    if asignacion is None:
        raise NotFound('Empresa no encontrada.')
    request.empresa_id = empresa_id
    request.rol_empresa = asignacion.rol
    return asignacion.empresa


class EmpresaListCreateView(APIView):
    def get(self, request):
        usuario = _usuario_actual(request)
        empresas = Empresa.objects.filter(
            usuarios_asignados__usuario_id=usuario.pk,
            usuarios_asignados__activo=True,
        ).annotate(
            rol_usuario=F('usuarios_asignados__rol')
        ).order_by('razon_social')
        return Response(EmpresaSerializer(empresas, many=True).data)

    def post(self, request):
        usuario = _usuario_actual(request)
        serializer = EmpresaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            empresa = serializer.save()
            ConfigEmpresa.objects.create(
                empresa=empresa,
                tolerancia_residuo_pen=Decimal('0.05000000'),
                decimales_calculo=6,
                regla_redondeo='ROUND_HALF_UP',
                metodo_valuacion='CPP',
            )
            UsuarioEmpresa.objects.create(
                usuario_id=usuario.pk,
                empresa=empresa,
                rol='ADMIN',
            )
        empresa.rol_usuario = 'ADMIN'
        return Response(EmpresaSerializer(empresa).data, status=status.HTTP_201_CREATED)


class ConfigEmpresaView(APIView):
    def get_object(self, request):
        empresa = _empresa_activa(request)
        try:
            return empresa.configuracion
        except ConfigEmpresa.DoesNotExist as exc:
            raise NotFound('Configuración no encontrada.') from exc

    def get(self, request):
        config = self.get_object(request)
        serializer = ConfigEmpresaSerializer(
            config,
            context={'empresa_id': config.empresa_id},
        )
        return Response(serializer.data)

    def patch(self, request):
        config = self.get_object(request)
        if getattr(request, 'rol_empresa', None) != 'ADMIN' and not getattr(request.user, 'es_admin_global', False):
            raise PermissionDenied("Se requieren privilegios de Administrador para modificar la configuración de la empresa.")
        serializer = ConfigEmpresaSerializer(
            config,
            data=request.data,
            partial=True,
            # Bloque 5: el cambio de tasa (con su vigencia) lo audita registrar_tasa_igv.
            context={'empresa_id': config.empresa_id, 'usuario_id': request.user.id},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class DatosFiscalesEmpresaView(APIView):
    """
    Bloque 17A: datos fiscales del emisor (empresa activa) y su validación previa a la emisión.
    GET para cualquier usuario de la empresa; PATCH solo ADMIN (auditado).
    """
    def _respuesta(self, empresa):
        from apps.documentos.reglas_tributarias import validar_emisor
        errores, advertencias = validar_emisor(empresa)
        return {**DatosFiscalesEmpresaSerializer(empresa).data,
                'validacion': {'listo': not errores, 'errores': errores, 'advertencias': advertencias}}

    def get(self, request):
        return Response(self._respuesta(_empresa_activa(request)))

    def patch(self, request):
        empresa = _empresa_activa(request)
        if getattr(request, 'rol_empresa', None) != 'ADMIN' and not getattr(request.user, 'es_admin_global', False):
            raise PermissionDenied('Se requieren privilegios de Administrador para modificar los datos fiscales.')
        with transaction.atomic():
            empresa = Empresa.objects.select_for_update().get(pk=empresa.pk)
            antes = DatosFiscalesEmpresaSerializer(empresa).data
            serializer = DatosFiscalesEmpresaSerializer(empresa, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            empresa = serializer.save()
            despues = DatosFiscalesEmpresaSerializer(empresa).data
            cambios = {k: despues[k] for k in despues if despues[k] != antes[k]}
            if cambios:
                registrar_auditoria(
                    empresa_id=empresa.id, usuario_id=request.user.id, accion='ACTUALIZAR_DATOS_FISCALES',
                    entidad='empresa', registro_id=empresa.id,
                    valor_anterior={k: antes[k] for k in cambios}, valor_nuevo=cambios,
                    motivo='Datos fiscales del emisor',
                )
        return Response(self._respuesta(empresa))


class EstablecimientoListCreateView(generics.ListCreateAPIView):
    serializer_class = EstablecimientoSerializer
    permission_classes = [TieneEmpresaActiva]

    def get_queryset(self):
        empresa = _empresa_activa(self.request)
        return Establecimiento.objects.filter(empresa_id=empresa.id).select_related('empresa__configuracion').order_by('codigo_sunat')

    def perform_create(self, serializer):
        if getattr(self.request, 'rol_empresa', None) != 'ADMIN' and not getattr(self.request.user, 'es_admin_global', False):
            raise PermissionDenied("Se requieren privilegios de Administrador para crear establecimientos.")
        serializer.save(empresa=_empresa_activa(self.request))


class EstablecimientoDetailView(generics.UpdateAPIView):
    serializer_class = EstablecimientoSerializer
    permission_classes = [TieneEmpresaActiva, EsAdminEmpresa]
    http_method_names = ('patch', 'options')

    def get_queryset(self):
        empresa = _empresa_activa(self.request)
        return Establecimiento.objects.filter(empresa_id=empresa.id)


class PeriodoListCreateView(APIView):
    permission_classes = [TieneEmpresaActiva]

    def get(self, request):
        periodos = Periodo.objects.filter(
            empresa_id=request.empresa_id
        ).prefetch_related('configs_igv').order_by('-orden')
        serializer = PeriodoSerializer(periodos, many=True)
        return Response(serializer.data)

    def post(self, request):
        if getattr(request, 'rol_empresa', None) != 'ADMIN' and not getattr(request.user, 'es_admin_global', False):
            raise PermissionDenied("Se requieren privilegios de Administrador para crear períodos contables.")
        serializer = PeriodoCreateSerializer(
            data=request.data,
            context={'empresa_id': request.empresa_id}
        )
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            periodo = serializer.save()
            registrar_auditoria(
                empresa_id=request.empresa_id,
                usuario_id=request.user.id,
                accion='CREAR',
                entidad='periodo',
                registro_id=periodo.id,
                valor_nuevo={
                    'anio': periodo.anio,
                    'mes': periodo.mes,
                    'orden': periodo.orden,
                    'fecha_inicio': periodo.fecha_inicio.isoformat(),
                    'fecha_fin': periodo.fecha_fin.isoformat(),
                    'estado': periodo.estado,
                },
                motivo=f'Creación de período {periodo.anio}-{periodo.mes:02d}'
            )
        return Response(PeriodoSerializer(periodo).data, status=status.HTTP_201_CREATED)


class PeriodoReabrirView(APIView):
    permission_classes = [TieneEmpresaActiva, EsAdminEmpresa]

    def post(self, request, pk):
        serializer = ReabrirPeriodoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        motivo = serializer.validated_data['motivo_reapertura']

        periodo, desactualizados_count = reabrir_periodo(empresa_id=request.empresa_id, periodo_id=pk, usuario=request.user, motivo=motivo)

        return Response({
            'mensaje': 'Período reabierto correctamente.',
            'periodos_desactualizados': desactualizados_count,
            'periodo': PeriodoSerializer(periodo).data,
        }, status=status.HTTP_200_OK)


class PeriodoCerrarView(APIView):
    permission_classes = [TieneEmpresaActiva, EsAdminEmpresa]

    def post(self, request, pk):
        cierre, advertencias = cerrar_periodo(empresa_id=request.empresa_id, periodo_id=pk, usuario=request.user)
        return Response({
            'mensaje': 'Período cerrado correctamente.',
            'periodo': PeriodoSerializer(cierre.periodo).data,
            'cierre': CierrePeriodoSerializer(cierre).data,
            'advertencias': advertencias,
        }, status=status.HTTP_200_OK)


class CierrePeriodoListView(APIView):
    permission_classes = [TieneEmpresaActiva]

    def get(self, request):
        cierres = CierrePeriodo.objects.filter(periodo__empresa_id=request.empresa_id).select_related('periodo', 'cerrado_por').prefetch_related('detalles__producto', 'detalles__establecimiento').order_by('-periodo__orden', '-version_calculo')
        return Response(CierrePeriodoSerializer(cierres, many=True).data)


class CompararCierresView(APIView):
    permission_classes = [TieneEmpresaActiva]

    def get(self, request, pk):
        cierres = list(CierrePeriodo.objects.filter(periodo_id=pk, periodo__empresa_id=request.empresa_id).select_related('periodo', 'cerrado_por').prefetch_related('detalles__producto', 'detalles__establecimiento').order_by('version_calculo'))
        if not cierres:
            raise NotFound('No existen cierres para el período indicado.')
        versiones = CierrePeriodoSerializer(cierres, many=True).data
        comparacion = []
        if len(cierres) >= 2:
            try:
                version_a = int(request.query_params.get('version_a', cierres[-2].version_calculo))
                version_b = int(request.query_params.get('version_b', cierres[-1].version_calculo))
            except (TypeError, ValueError) as exc:
                raise ValidationError({'detail': 'Las versiones deben ser números enteros.'}) from exc
            anterior = next((c for c in cierres if c.version_calculo == version_a), None)
            actual = next((c for c in cierres if c.version_calculo == version_b), None)
            if not anterior or not actual or anterior.id == actual.id:
                raise ValidationError({'detail': 'Seleccione dos versiones distintas existentes del período.'})
            mapa_anterior = {(d.producto_id, d.establecimiento_id): d for d in anterior.detalles.all()}
            mapa_actual = {(d.producto_id, d.establecimiento_id): d for d in actual.detalles.all()}
            for clave in sorted(set(mapa_anterior) | set(mapa_actual)):
                a, b = mapa_anterior.get(clave), mapa_actual.get(clave)
                cantidad_a = a.saldo_cantidad if a else Decimal('0'); cantidad_b = b.saldo_cantidad if b else Decimal('0')
                valor_a = a.saldo_valor_pen if a else Decimal('0'); valor_b = b.saldo_valor_pen if b else Decimal('0')
                cpp_a = a.cpp_pen if a else Decimal('0'); cpp_b = b.cpp_pen if b else Decimal('0')
                comparacion.append({'producto_id': clave[0], 'establecimiento_id': clave[1], 'version_anterior': {'saldo_cantidad': str(cantidad_a), 'saldo_valor_pen': str(valor_a), 'cpp_pen': str(cpp_a)}, 'version_nueva': {'saldo_cantidad': str(cantidad_b), 'saldo_valor_pen': str(valor_b), 'cpp_pen': str(cpp_b)}, 'diferencia': {'cantidad': str(cantidad_b - cantidad_a), 'valor_pen': str(valor_b - valor_a), 'cpp_pen': str(cpp_b - cpp_a)}})
        return Response({'periodo_id': pk, 'version_a': anterior.version_calculo if len(cierres) >= 2 else None, 'version_b': actual.version_calculo if len(cierres) >= 2 else None, 'versiones': versiones, 'comparacion_ultimas_versiones': comparacion})


class ConfigIgvPeriodoView(APIView):
    permission_classes = [TieneEmpresaActiva]

    def get_periodo(self, request, periodo_id):
        periodo = Periodo.objects.filter(
            id=periodo_id,
            empresa_id=request.empresa_id
        ).first()
        if not periodo:
            raise NotFound('Período no encontrado.')
        return periodo

    def get(self, request, periodo_id):
        periodo = self.get_periodo(request, periodo_id)
        config = ConfigIgvPeriodo.objects.filter(
            empresa_id=request.empresa_id,
            periodo=periodo
        ).first()
        if not config:
            raise NotFound('Configuración de IGV no establecida para este período.')
        return Response(ConfigIgvPeriodoSerializer(config).data)

    def post(self, request, periodo_id):
        if getattr(request, 'rol_empresa', None) != 'ADMIN' and not getattr(request.user, 'es_admin_global', False):
            raise PermissionDenied("Se requieren privilegios de Administrador para configurar el IGV del período.")
        periodo = self.get_periodo(request, periodo_id)
        if periodo.estado != 'ABIERTO':
            raise ValidationError({'periodo': 'No se puede modificar la configuración de IGV de un período cerrado.'})
        config = ConfigIgvPeriodo.objects.filter(
            empresa_id=request.empresa_id,
            periodo=periodo
        ).first()

        serializer = ConfigIgvPeriodoSerializer(
            config,
            data=request.data,
            partial=bool(config),
            context={'empresa_id': request.empresa_id},
        )
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            if config:
                valor_ant = {
                    'metodo': config.metodo,
                    'porcentaje_recuperable': str(config.porcentaje_recuperable),
                }
                config = serializer.save()
                accion = 'MODIFICAR'
                motivo = f'Actualización de configuración IGV para período {periodo.anio}-{periodo.mes:02d}'
            else:
                valor_ant = None
                config = serializer.save(
                    empresa_id=request.empresa_id,
                    periodo=periodo,
                    creado_por=request.user
                )
                accion = 'CREAR'
                motivo = f'Configuración inicial de IGV para período {periodo.anio}-{periodo.mes:02d}'

            registrar_auditoria(
                empresa_id=request.empresa_id,
                usuario_id=request.user.id,
                accion=accion,
                entidad='config_igv_periodo',
                registro_id=config.id,
                valor_anterior=valor_ant,
                valor_nuevo={
                    'metodo': config.metodo,
                    'porcentaje_recuperable': str(config.porcentaje_recuperable),
                },
                motivo=motivo
            )

        return Response(
            ConfigIgvPeriodoSerializer(config).data,
            status=status.HTTP_200_OK if valor_ant else status.HTTP_201_CREATED
        )

    def patch(self, request, periodo_id):
        return self.post(request, periodo_id)


class ConfigIgvListCreateView(APIView):
    permission_classes = [TieneEmpresaActiva]

    def get(self, request):
        configs = ConfigIgvPeriodo.objects.filter(
            empresa_id=request.empresa_id
        ).select_related('periodo').order_by('-periodo__orden')
        return Response(ConfigIgvPeriodoSerializer(configs, many=True).data)

    def post(self, request):
        if getattr(request, 'rol_empresa', None) != 'ADMIN' and not getattr(request.user, 'es_admin_global', False):
            raise PermissionDenied("Se requieren privilegios de Administrador para configurar el IGV del período.")
        periodo_id = request.data.get('periodo') or request.data.get('periodo_id')
        if not periodo_id:
            raise ValidationError({'periodo': 'El ID del período es obligatorio.'})

        periodo = Periodo.objects.filter(
            id=periodo_id,
            empresa_id=request.empresa_id
        ).first()
        if not periodo:
            raise ValidationError({'periodo': 'El período no existe o no pertenece a la empresa activa.'})
        if periodo.estado != 'ABIERTO':
            raise ValidationError({'periodo': 'No se puede configurar el IGV de un período cerrado.'})

        config = ConfigIgvPeriodo.objects.filter(
            empresa_id=request.empresa_id,
            periodo=periodo
        ).first()

        serializer = ConfigIgvPeriodoSerializer(
            config,
            data=request.data,
            partial=bool(config),
            context={'empresa_id': request.empresa_id},
        )
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            if config:
                valor_ant = {
                    'metodo': config.metodo,
                    'porcentaje_recuperable': str(config.porcentaje_recuperable),
                }
                config = serializer.save()
                accion = 'MODIFICAR'
                motivo = f'Actualización de configuración IGV para período {periodo.anio}-{periodo.mes:02d}'
            else:
                valor_ant = None
                config = serializer.save(
                    empresa_id=request.empresa_id,
                    periodo=periodo,
                    creado_por=request.user
                )
                accion = 'CREAR'
                motivo = f'Configuración inicial de IGV para período {periodo.anio}-{periodo.mes:02d}'

            registrar_auditoria(
                empresa_id=request.empresa_id,
                usuario_id=request.user.id,
                accion=accion,
                entidad='config_igv_periodo',
                registro_id=config.id,
                valor_anterior=valor_ant,
                valor_nuevo={
                    'metodo': config.metodo,
                    'porcentaje_recuperable': str(config.porcentaje_recuperable),
                },
                motivo=motivo
            )

        return Response(
            ConfigIgvPeriodoSerializer(config).data,
            status=status.HTTP_200_OK if valor_ant else status.HTTP_201_CREATED
        )


class ConfigIgvDetailView(APIView):
    permission_classes = [TieneEmpresaActiva]

    def get_object(self, request, pk):
        config = ConfigIgvPeriodo.objects.filter(
            id=pk,
            empresa_id=request.empresa_id
        ).first()
        if not config:
            raise NotFound('Configuración de IGV no encontrada.')
        return config

    def get(self, request, pk):
        config = self.get_object(request, pk)
        return Response(ConfigIgvPeriodoSerializer(config).data)

    def patch(self, request, pk):
        config = self.get_object(request, pk)
        serializer = ConfigIgvPeriodoSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        valor_ant = {
            'metodo': config.metodo,
            'porcentaje_recuperable': str(config.porcentaje_recuperable),
        }
        with transaction.atomic():
            config = serializer.save()
            registrar_auditoria(
                empresa_id=request.empresa_id,
                usuario_id=request.user.id,
                accion='MODIFICAR',
                entidad='config_igv_periodo',
                registro_id=config.id,
                valor_anterior=valor_ant,
                valor_nuevo={
                    'metodo': config.metodo,
                    'porcentaje_recuperable': str(config.porcentaje_recuperable),
                },
                motivo=f'Modificación de configuración IGV de período {config.periodo_id}'
            )
        return Response(ConfigIgvPeriodoSerializer(config).data)
