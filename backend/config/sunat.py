"""
Bloque 17B — configuración SUNAT (preparación; todavía NO se conecta a SUNAT).

Las credenciales se leen SOLO de variables de entorno (backend/.env, nunca del repositorio):

    SUNAT_AMBIENTE              beta | produccion           (por defecto: beta)
    SUNAT_USUARIO_SOL           usuario secundario SOL       (secreto)
    SUNAT_CLAVE_SOL             clave SOL                    (secreto)
    SUNAT_CERTIFICADO_PATH      ruta al .pfx/.p12, FUERA del repositorio
    SUNAT_CERTIFICADO_PASSWORD  contraseña del certificado   (secreto)

Reglas de este módulo:
- Los secretos viajan envueltos en `Secreto`: print(), repr(), str(), f-strings y logs muestran
  '[OCULTO]'. El valor real solo se obtiene con `.revelar()` (lo usará el Bloque 18 al firmar y
  enviar; hoy nadie lo llama).
- `validar_configuracion_sunat()` solo dice QUÉ falta (nombres de variables), nunca valores. No
  abre ni lee el certificado: solo comprueba que el archivo exista.
- `FiltroReporteExcepciones` oculta estas variables en las páginas de error de Django.
"""
import re
from pathlib import Path

from django.views.debug import SafeExceptionReporterFilter

ENMASCARADO = '[OCULTO]'
AMBIENTES = ('beta', 'produccion')
VARIABLES_CREDENCIALES = ('SUNAT_USUARIO_SOL', 'SUNAT_CLAVE_SOL')
VARIABLES_CERTIFICADO = ('SUNAT_CERTIFICADO_PATH', 'SUNAT_CERTIFICADO_PASSWORD')
VARIABLES_SECRETAS = ('SUNAT_USUARIO_SOL', 'SUNAT_CLAVE_SOL', 'SUNAT_CERTIFICADO_PASSWORD')
EXTENSIONES_CERTIFICADO = ('.pfx', '.p12')


class Secreto:
    """Valor sensible que nunca se muestra por accidente (print, logs, repr, errores)."""
    __slots__ = ('_valor',)

    def __init__(self, valor=''):
        self._valor = '' if valor is None else str(valor)

    def revelar(self) -> str:
        return self._valor

    def __bool__(self):
        return bool(self._valor.strip())

    def __str__(self):
        return ENMASCARADO if self._valor else ''

    def __repr__(self):
        return f"Secreto({ENMASCARADO if self._valor else 'vacío'})"

    def __format__(self, spec):  # f'{secreto}' también oculta
        return format(str(self), spec)

    def __eq__(self, otro):
        return isinstance(otro, Secreto) and otro._valor == self._valor

    def __hash__(self):
        return hash(('Secreto', self._valor))

    def __reduce__(self):  # no se serializa (pickle/caché) por accidente
        raise TypeError('Un Secreto no se serializa.')


def leer_configuracion_sunat(leer):
    """
    Lee las variables con `leer(nombre, default='')` (decouple.config u os.environ.get).
    Devuelve el dict que settings.py expone como SUNAT_*; los secretos quedan envueltos.
    """
    return {
        'SUNAT_AMBIENTE': (leer('SUNAT_AMBIENTE', default='beta') or 'beta').strip().lower(),
        'SUNAT_USUARIO_SOL': Secreto(leer('SUNAT_USUARIO_SOL', default='')),
        'SUNAT_CLAVE_SOL': Secreto(leer('SUNAT_CLAVE_SOL', default='')),
        'SUNAT_CERTIFICADO_PATH': (leer('SUNAT_CERTIFICADO_PATH', default='') or '').strip(),
        'SUNAT_CERTIFICADO_PASSWORD': Secreto(leer('SUNAT_CERTIFICADO_PASSWORD', default='')),
    }


def _definido(valor):
    if isinstance(valor, Secreto):
        return bool(valor)
    return bool((valor or '').strip())


def validar_configuracion_sunat(config=None, *, repo_dir=None, debug=None):
    """
    Estado de la configuración SUNAT, sin valores secretos:
        {ambiente, ambiente_valido, configurado, credenciales_configuradas,
         certificado_configurado, faltantes: [nombres de variables], advertencias: [...]}
    `config` es un objeto con atributos SUNAT_* (por defecto django.conf.settings).
    """
    if config is None:
        from django.conf import settings as config
    if repo_dir is None:
        repo_dir = Path(getattr(config, 'BASE_DIR', Path.cwd())).resolve().parent
    if debug is None:
        debug = bool(getattr(config, 'DEBUG', False))

    valor = lambda nombre: getattr(config, nombre, '')  # noqa: E731
    ambiente = (valor('SUNAT_AMBIENTE') or 'beta')
    ambiente = ambiente.strip().lower() if isinstance(ambiente, str) else 'beta'
    faltantes, advertencias = [], []

    ambiente_valido = ambiente in AMBIENTES
    if not ambiente_valido:
        faltantes.append('SUNAT_AMBIENTE')
        advertencias.append(f"SUNAT_AMBIENTE debe ser 'beta' o 'produccion' (tiene '{ambiente[:20]}').")

    for nombre in VARIABLES_CREDENCIALES:
        if not _definido(valor(nombre)):
            faltantes.append(nombre)
    credenciales = not any(n in faltantes for n in VARIABLES_CREDENCIALES)

    ruta_texto = (valor('SUNAT_CERTIFICADO_PATH') or '').strip()
    certificado = False
    if not ruta_texto:
        faltantes.append('SUNAT_CERTIFICADO_PATH')
    else:
        ruta = Path(ruta_texto).expanduser()
        if ruta.suffix.lower() not in EXTENSIONES_CERTIFICADO:
            advertencias.append('El certificado debe ser un archivo .pfx o .p12.')
        if not ruta.is_absolute():
            advertencias.append('SUNAT_CERTIFICADO_PATH debe ser una ruta absoluta.')
        if not ruta.is_file():
            faltantes.append('SUNAT_CERTIFICADO_PATH')
            advertencias.append('El archivo del certificado no existe o no es accesible.')
        else:
            certificado = ruta.suffix.lower() in EXTENSIONES_CERTIFICADO
            try:
                ruta.resolve().relative_to(Path(repo_dir).resolve())
                advertencias.append('El certificado está dentro de la carpeta del proyecto: muévalo fuera del '
                                    'repositorio para que nunca se suba a Git.')
            except ValueError:
                pass
    if not _definido(valor('SUNAT_CERTIFICADO_PASSWORD')):
        faltantes.append('SUNAT_CERTIFICADO_PASSWORD')
        certificado = False

    if ambiente == 'produccion' and debug:
        advertencias.append('SUNAT_AMBIENTE=produccion con DEBUG=True: use producción solo en el servidor.')

    faltantes = list(dict.fromkeys(faltantes))
    return {
        'ambiente': ambiente if ambiente_valido else None,
        'ambiente_valido': ambiente_valido,
        'configurado': ambiente_valido and credenciales and certificado,
        'credenciales_configuradas': credenciales,
        'certificado_configurado': certificado,
        'faltantes': faltantes,
        'advertencias': advertencias,
    }


class FiltroReporteExcepciones(SafeExceptionReporterFilter):
    """Páginas/informes de error de Django: además de API|TOKEN|KEY|SECRET|PASS oculta lo de SUNAT."""
    hidden_settings = re.compile(
        r'API|TOKEN|KEY|SECRET|PASS|SIGNATURE|HTTP_COOKIE|SUNAT|SOL|CLAVE|CERTIFICADO', flags=re.I)
