# Configuración de producción (Bloque 7)

Todas las variables van en `backend/.env` (ver `backend/.env.example`). Con `DEBUG=False`
el backend **no arranca** si la configuración es insegura (`config/seguridad.py`) y
`python manage.py check --deploy` muestra advertencias adicionales (`config/checks.py`).

## Variables

| Variable | Producción | Notas |
| --- | --- | --- |
| `DEBUG` | `False` | Obligatorio activarlo explícitamente en desarrollo. |
| `SECRET_KEY` | 50+ caracteres aleatorios | Rechaza valores de ejemplo, `django-insecure…`, cortos o con menos de 5 caracteres distintos. |
| `ALLOWED_HOSTS` | dominio(s) de la API | `*` rechazado. |
| `CORS_ALLOWED_ORIGINS` | `https://<frontend>` | `*`/`null` rechazados; `http://` no local rechazado (salvo `PRODUCCION_SIN_HTTPS`). |
| `CSRF_TRUSTED_ORIGINS` | `https://<frontend>` | Mismas reglas de esquema. |
| `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` | `True` (por defecto con `DEBUG=False`) | En `False` se rechaza salvo `PRODUCCION_SIN_HTTPS`. |
| `SECURE_SSL_REDIRECT` | `True` si Django recibe HTTP | Con proxy que ya redirige, puede quedar en `False`. |
| `SECURE_PROXY_SSL_HEADER_HTTPS` | `True` detrás de nginx/balanceador con TLS | Confía en `X-Forwarded-Proto: https`. Solo si el proxy reescribe ese encabezado. |
| `SECURE_HSTS_SECONDS` | `31536000` cuando HTTPS esté estable | Empezar con un valor bajo (p. ej. 3600). |
| `TOKEN_MAX_AGE_SECONDS` | `28800`–`43200` (8–12 h) | `<= 0` rechazado siempre; `> 30 días` rechazado en producción; aviso si `> 24 h`. |
| `LOGIN_THROTTLE_RATE` | `10/min` | Intentos de login por IP. |
| `CACHE_URL` (alias `REDIS_URL`) | `redis://[:clave@]host:6379/0` o `rediss://…` | Vacía → memoria local (cada worker cuenta por separado; aviso `fact_kard.W001`). |
| `CACHE_KEY_PREFIX` | `fact-kard` | Si el Redis se comparte. |
| `PRODUCCION_SIN_HTTPS` | `False` | Excepción explícita para una intranet sin certificado (aviso `fact_kard.W003`). |
| `AUTH_COOKIE_*` | ver `docs/SEGURIDAD_TOKEN_LOCALSTORAGE.md` | Sesión por cookie HttpOnly preparada, apagada. |

## Redis

- Local: no hace falta. Sin `CACHE_URL` se usa la caché en memoria y `requirements.txt` no
  incluye `redis`.
- Producción: `pip install -r requirements-prod.txt` (agrega `redis`) y definir `CACHE_URL`.
  Si `CACHE_URL` apunta a Redis y falta el paquete, el arranque falla con un mensaje claro.
- Probar el throttling contra un Redis real:
  `TEST_REDIS_URL=redis://127.0.0.1:6379/15 python manage.py test apps.usuarios.tests_b7_produccion`
  (usa el prefijo `fk-test-b7` y limpia la base indicada; usar una base vacía).

## Verificación antes de publicar

```bash
python manage.py check --deploy
python manage.py migrate
```
