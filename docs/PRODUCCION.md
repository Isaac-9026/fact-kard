# Configuración de producción (Bloques 7 y 8)

> Despliegue paso a paso en el VPS (Nginx, Gunicorn, PostgreSQL, Redis, SSL, DNS, firewall,
> backup, rollback, smoke test): **`docs/DESPLIEGUE_VPS.md`**.
> Plantilla del `.env` de producción para `https://sistema.asescon.net`:
> **`deploy/env.produccion.example`** (el dominio no está fijo en el código).

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
| `AUTH_COOKIE_*` | `AUTH_COOKIE_ENABLED=False` | Sesión por cookie HttpOnly preparada, apagada (ver `DESPLIEGUE_VPS.md` §Cookie HttpOnly). |
| `NUM_PROXIES` | `1` (Nginx delante) | **Bloque 8.** IP real para el throttling. `0` (desarrollo) usa la IP de la conexión. Con `SECURE_PROXY_SSL_HEADER_HTTPS=True` y `0` el backend no arranca. |
| `SECURE_HSTS_INCLUDE_SUBDOMAINS` | `True` | Solo afecta a `*.sistema.asescon.net`. `SECURE_HSTS_PRELOAD` queda en `False` (exige el dominio raíz; aviso `security.W021` esperado). |
| `DB_NAME`, `DB_USER`, `DB_HOST`, `DB_PORT` | `fact_kard`, `fact_kard_user`, `127.0.0.1`, `5432` | PostgreSQL solo local. |
| `DB_PASSWORD` | larga y aleatoria | **Bloque 8.** Vacía o de ejemplo (`cambiar_esto`…) → no arranca en producción. |
| `DB_CONN_MAX_AGE` | `60` | Conexiones persistentes (con chequeo de salud). |
| `STATIC_ROOT` | `/srv/fact-kard/app/backend/staticfiles` | `collectstatic`; Nginx lo sirve en `/static/`. Las capturas no se guardan en disco (no hay `MEDIA_ROOT`). |
| `DATA_UPLOAD_MAX_MEMORY_SIZE` | `5242880` | Cuerpo máximo de peticiones no-archivo. Archivos: `CAPTURA_MAX_BYTES` (10 MB) y `client_max_body_size 12m` en Nginx. |
| `LOG_LEVEL`, `LOG_FILE`, `LOG_FILE_MAX_MB`, `LOG_FILE_BACKUPS` | `INFO`, vacío | **Bloque 8.** Sin archivo → journald. Con archivo → rotación. Tokens/contraseñas/SECRET_KEY se enmascaran. |
| `API_DOCS_ENABLED` | `False` | **Bloque 8.** Swagger (`/api/docs/`, `/api/schema/`) solo en desarrollo. |
| `GUNICORN_BIND`, `GUNICORN_WORKERS`, `GUNICORN_TIMEOUT` | `127.0.0.1:8001`, `3`, `120` | `backend/gunicorn.conf.py`. |

## Health check (Bloque 8)

`GET /api/health/` (sin autenticación) → `200 {"status":"ok","database":"ok","cache":"ok"}`.
`503` si PostgreSQL no responde o si la caché (Redis) falla —el login depende de ella—. No
devuelve hosts, versiones, mensajes de error ni configuración; el detalle va al log
(`fact_kard.health`).

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
python manage.py check --deploy     # esperado: solo security.W021 (HSTS preload)
python manage.py migrate
python3 ../deploy/scripts/smoke_test.py --base https://sistema.asescon.net --usuario <usuario> --frontend
```
