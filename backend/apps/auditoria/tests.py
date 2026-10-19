from django.db import connection, ProgrammingError, InternalError
from django.test import TransactionTestCase
from apps.auditoria.models import Auditoria


class AuditoriaModelTest(TransactionTestCase):
    def test_auditoria_inmutabilidad_trigger(self):
        # 1. Crear registro (INSERT permitido)
        aud = Auditoria.objects.create(
            accion='CREAR',
            entidad='EMPRESA',
            registro_id=1,
            valor_nuevo={'ruc': '20100070970'},
            motivo='Registro inicial de auditoría'
        )
        self.assertIsNotNone(aud.id)

        # 2. Intentar UPDATE directo en base de datos (debe fallar por trigger)
        with self.assertRaises((ProgrammingError, InternalError)) as cm:
            with connection.cursor() as cur:
                cur.execute(f"UPDATE auditoria SET accion = 'MODIFICAR' WHERE id = {aud.id};")
        self.assertIn('AUDITORIA es de solo insercion', str(cm.exception))

        # 3. Intentar DELETE directo en base de datos (debe fallar por trigger)
        with self.assertRaises((ProgrammingError, InternalError)) as cm:
            with connection.cursor() as cur:
                cur.execute(f"DELETE FROM auditoria WHERE id = {aud.id};")
        self.assertIn('AUDITORIA es de solo insercion', str(cm.exception))
