# Despliegue de FACT-KARD en VPS (Bloque 8)

Destino previsto: VPS Contabo con Ubuntu 24.04 LTS, publicado en `https://sistema.asescon.net`.
`asescon.net` (web y correos) sigue en el hosting cPanel actual; solo se agrega un registro
DNS para el subdominio `sistema`.

```
Internet ──443──▶ Nginx ──┬─ /            → frontend/dist (React compilado)
                          ├─ /static/     → backend/staticfiles (admin de Django)
                          └─ /api/, /admin/ → Gunicorn 127.0.0.1:8001 → Django
                                                ├─ PostgreSQL 127.0.0.1:5432
                                                └─ Redis      127.0.0.1:6379
```

Solo los puertos 22, 80 y 443 quedan abiertos a Internet. PostgreSQL, Redis y Gunicorn
escuchan únicamente en `127.0.0.1`.

Archivos del repositorio usados en esta guía:

| Archivo | Uso |
| --- | --- |
| `deploy/env.produccion.example` | plantilla de `backend/.env` del VPS |
| `deploy/nginx/fact-kard.conf` | sitio de Nginx |
| `deploy/systemd/fact-kard.service` | Gunicorn como servicio |
| `deploy/systemd/fact-kard-backup.{service,timer}` | backup diario |
| `deploy/scripts/fk-backup.sh` | backup verificado con retención |
| `deploy/scripts/fk-restore-qa.sh` | prueba de restauración en base temporal |
| `deploy/scripts/smoke_test.py` | smoke test no destructivo |
| `backend/gunicorn.conf.py` | configuración de Gunicorn |
| `frontend/.env.production` | `VITE_API_URL=/api` (mismo dominio, sin URL fija) |

Convenciones: usuario administrador `admin` (con sudo), usuario de servicio `fact-kard`
(sin login), código en `/srv/fact-kard/app`, entorno virtual en `/srv/fact-kard/venv`.

---

## Checklist de despliegue

Marcar cada paso al completarlo.

### 1. Contratar el VPS
- [ ] Contabo VPS con Ubuntu 24.04 LTS. Mínimo recomendado: 2 vCPU, 4 GB RAM, 50 GB disco.
- [ ] Anotar la **IP pública** (se usa solo en el DNS, nunca en el código).

### 2. Instalar Ubuntu
- [ ] Elegir Ubuntu 24.04 en el panel de Contabo y una clave SSH (mejor que contraseña).
- [ ] Zona horaria: `sudo timedatectl set-timezone America/Lima`.

### 3. Crear usuario administrador
```bash
ssh root@IP_PUBLICA_DEL_VPS
adduser admin && usermod -aG sudo admin
mkdir -p /home/admin/.ssh && cp ~/.ssh/authorized_keys /home/admin/.ssh/
chown -R admin:admin /home/admin/.ssh && chmod 700 /home/admin/.ssh
```
Probar `ssh admin@IP_PUBLICA_DEL_VPS` en otra terminal. Luego, en `/etc/ssh/sshd_config`:
`PermitRootLogin no` y `PasswordAuthentication no`; `sudo systemctl restart ssh`.

### 4. Actualizar el sistema
```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades
```

### 5. Firewall
```bash
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP (Let's Encrypt + redirección)
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
sudo ufw status verbose
```
**No** abrir 5432 (PostgreSQL), 6379 (Redis) ni 8001 (Gunicorn). Opcional: `sudo apt install
fail2ban` para bloquear intentos de SSH. Si Contabo ofrece firewall en el panel, aplicar
las mismas reglas allí también.

### 6. Git
```bash
sudo apt install -y git
```

### 7. Python
```bash
sudo apt install -y python3 python3-venv python3-dev build-essential libpq-dev
python3 --version   # 3.12 en Ubuntu 24.04 (compatible con Django 6.1)
```

### 8. PostgreSQL
```bash
sudo apt install -y postgresql
sudo -u postgres psql -c "CREATE ROLE fact_kard_user LOGIN PASSWORD '<contraseña larga>';"
sudo -u postgres psql -c "CREATE DATABASE fact_kard OWNER fact_kard_user ENCODING 'UTF8';"
```
Solo local (valores por defecto de Ubuntu; verificar):
```bash
sudo grep -E "^listen_addresses" /etc/postgresql/16/main/postgresql.conf   # vacío o 'localhost'
sudo ss -ltnp | grep 5432                                                # debe decir 127.0.0.1
```
Si `listen_addresses = '*'` aparece, cambiarlo a `'localhost'` y reiniciar PostgreSQL.
En `pg_hba.conf` no agregar reglas `host ... 0.0.0.0/0`.

### 9. Redis
```bash
sudo apt install -y redis-server
sudo grep -E "^bind|^protected-mode" /etc/redis/redis.conf   # bind 127.0.0.1 -::1 / protected-mode yes
sudo systemctl enable --now redis-server
redis-cli ping   # PONG
```
Redis solo guarda los contadores del límite de intentos de login: no necesita persistencia
ni contraseña mientras escuche únicamente en 127.0.0.1.

### 10. Nginx
```bash
sudo apt install -y nginx
```

### 11. Clonar FACT-KARD
```bash
sudo useradd --system --home /srv/fact-kard --shell /usr/sbin/nologin fact-kard
sudo mkdir -p /srv/fact-kard && sudo chown fact-kard:fact-kard /srv/fact-kard
sudo -u fact-kard git clone <URL del repositorio> /srv/fact-kard/app
sudo -u fact-kard git -C /srv/fact-kard/app checkout <rama o tag a desplegar>
```
Para un repositorio privado usar una *deploy key* de solo lectura del usuario `fact-kard`.

### 12. Crear `backend/.env`
```bash
cd /srv/fact-kard/app
sudo -u fact-kard cp deploy/env.produccion.example backend/.env
sudo -u fact-kard chmod 600 backend/.env
sudo -u fact-kard nano backend/.env     # completar SECRET_KEY y DB_PASSWORD
```
Generar la clave: `python3 -c "from django.core.management.utils import get_random_secret_key as g; print(g())"`.
Con `DEBUG=False` el backend **no arranca** si algo es inseguro (clave débil, `*` en hosts,
`http://` en CORS/CSRF, contraseña de BD vacía o de ejemplo, proxy sin `NUM_PROXIES=1`...).

### 13. Dependencias del backend
```bash
sudo -u fact-kard python3 -m venv /srv/fact-kard/venv
sudo -u fact-kard /srv/fact-kard/venv/bin/pip install --upgrade pip
sudo -u fact-kard /srv/fact-kard/venv/bin/pip install -r /srv/fact-kard/app/backend/requirements-prod.txt
```
(`requirements-prod.txt` = `requirements.txt` + `redis` + `gunicorn`.)

### 14. Migraciones
```bash
cd /srv/fact-kard/app/backend
sudo -u fact-kard /srv/fact-kard/venv/bin/python manage.py migrate
sudo -u fact-kard /srv/fact-kard/venv/bin/python manage.py check --deploy
```
`check --deploy` debe mostrar a lo sumo `security.W021` (HSTS *preload*: requiere el dominio
raíz `asescon.net`, que sigue en cPanel; es correcto no activarlo). Crear el primer usuario
administrador con el procedimiento habitual del proyecto.

### 15. Archivos estáticos
```bash
sudo -u fact-kard /srv/fact-kard/venv/bin/python manage.py collectstatic --noinput
sudo chmod o+x /srv/fact-kard /srv/fact-kard/app /srv/fact-kard/app/backend
sudo chmod -R o+rX /srv/fact-kard/app/backend/staticfiles
```
Nginx (usuario `www-data`) necesita leer `staticfiles/` y `frontend/dist/`. `backend/.env`
sigue con permisos 600: Nginx no puede leerlo.

### 16. Dependencias del frontend
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
cd /srv/fact-kard/app/frontend && sudo -u fact-kard npm ci
```

### 17. Compilar el frontend
```bash
sudo -u fact-kard npm run build      # usa frontend/.env.production → VITE_API_URL=/api
sudo chmod -R o+rX /srv/fact-kard/app/frontend/dist
sudo chmod o+x /srv/fact-kard/app/frontend
```

### 18. Gunicorn como servicio (systemd)
```bash
sudo cp /srv/fact-kard/app/deploy/systemd/fact-kard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fact-kard
curl -s -H "Host: sistema.asescon.net" -H "X-Forwarded-Proto: https" http://127.0.0.1:8001/api/health/
```
Comandos del servicio:

| Acción | Comando |
| --- | --- |
| Iniciar | `sudo systemctl start fact-kard` |
| Detener | `sudo systemctl stop fact-kard` |
| Reiniciar (corta peticiones en curso) | `sudo systemctl restart fact-kard` |
| Recargar código sin cortar (HUP) | `sudo systemctl reload fact-kard` |
| Estado | `sudo systemctl status fact-kard` |
| Logs en vivo | `sudo journalctl -u fact-kard -f` |

El servicio arranca con el VPS (`enable`), se reinicia solo si falla (`Restart=on-failure`)
y lee los secretos de `backend/.env` (600), no de la unidad. Gunicorn **nunca** se reemplaza
por `python manage.py runserver`.

### 19. Nginx
```bash
sudo mkdir -p /var/www/certbot
sudo cp /srv/fact-kard/app/deploy/nginx/fact-kard.conf /etc/nginx/sites-available/fact-kard
sudo ln -s /etc/nginx/sites-available/fact-kard /etc/nginx/sites-enabled/fact-kard
sudo rm -f /etc/nginx/sites-enabled/default
```
Antes de tener el certificado, el bloque `listen 443` no puede cargar: comentar
temporalmente el segundo `server { ... }` (o usar el paso 21 con `--nginx`). Luego
`sudo nginx -t && sudo systemctl reload nginx`.

Incluye: redirección HTTP→HTTPS, cabeceras `X-Forwarded-*`, límite de subida de 12 MB
(capturas de hasta 10 MB), *timeouts* de 130 s (Excel), caché larga para `/assets/`,
`index.html` sin caché, CSP y cabeceras de seguridad. HSTS se activa desde Django
(`SECURE_HSTS_SECONDS`); en Nginx queda comentado.

### 20. Apuntar `sistema.asescon.net` (cPanel)
En cPanel → **Zone Editor** (o "Editor de zona DNS") de `asescon.net` → **Agregar registro**:

| Tipo | Nombre | Destino / Registro | TTL |
| --- | --- | --- | --- |
| `A` | `sistema` | `IP_PUBLICA_DEL_VPS` | 300 (luego 3600/14400) |

- Si el VPS tiene IPv6: agregar también `AAAA` `sistema` → IPv6 del VPS (si no, nada).
- No tocar los registros de `asescon.net`, `www`, `mail`, `MX`, SPF/DKIM: la web y el correo
  siguen en cPanel.
- Si existe un subdominio `sistema` creado en cPanel (Subdominios), eliminarlo antes: crea un
  registro A hacia el propio hosting.
- Verificar: `dig +short sistema.asescon.net` (o `nslookup`) debe devolver la IP del VPS.

### 21. SSL (Let's Encrypt / Certbot)
Solo cuando el paso 20 ya resuelve a la IP del VPS:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot certonly --webroot -w /var/www/certbot -d sistema.asescon.net \
     --email <correo del responsable> --agree-tos --no-eff-email
# (alternativa: sudo certbot --nginx -d sistema.asescon.net)
```
Descomentar el bloque 443 si se comentó en el paso 19 y `sudo nginx -t && sudo systemctl reload nginx`.
Renovación automática: `systemctl list-timers | grep certbot`; probar con
`sudo certbot renew --dry-run`. Para que Nginx recargue tras renovar:
```bash
echo -e '#!/bin/sh\nsystemctl reload nginx' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
```
Cuando HTTPS lleve unos días estable: subir `SECURE_HSTS_SECONDS` a `31536000` en `backend/.env`
y `sudo systemctl restart fact-kard`.

### 22. Health check
```bash
curl -s https://sistema.asescon.net/api/health/
# {"status": "ok", "database": "ok", "cache": "ok"}  → HTTP 200
```
503 = PostgreSQL o Redis no responden (el detalle está en `journalctl -u fact-kard`).

### 23. Smoke test
```bash
cd /srv/fact-kard/app
FK_SMOKE_USER=<usuario de prueba> python3 deploy/scripts/smoke_test.py \
    --base https://sistema.asescon.net --frontend
```
Pide la contraseña, recorre (solo lectura) health, login, empresas, períodos, Dashboard,
inventario, documentos, NC/ND, Kardex, Formato 13.1, auditoría y logout (verifica que el
token quede revocado). No registra documentos. Termina con `TODO OK` o el número de fallos.

Revisión manual rápida en el navegador: login → Dashboard → cambiar de empresa → Kardex →
Formato 13.1 → Salir.

### Después del primer despliegue
- [ ] Backup programado (sección Backup) y una prueba de restauración en base QA.
- [ ] Copia de los backups fuera del VPS.
- [ ] Guardar en lugar seguro: `backend/.env`, contraseña de BD, acceso a cPanel y Contabo.

---

## Backup y restauración

### Backup manual
```bash
sudo mkdir -p /var/backups/fact-kard && sudo chown postgres:postgres /var/backups/fact-kard && sudo chmod 700 /var/backups/fact-kard
sudo -u postgres bash /srv/fact-kard/app/deploy/scripts/fk-backup.sh
```
Genera `diario/fact_kard_AAAAMMDD_HHMMSS.dump` (formato custom de `pg_dump`, comprimido),
comprueba que `pg_restore --list` lo lea completo y guarda su `.sha256`. Si la verificación
falla, el archivo se descarta y el comando termina con error.

### Backup programado
```bash
sudo cp /srv/fact-kard/app/deploy/systemd/fact-kard-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now fact-kard-backup.timer
systemctl list-timers fact-kard-backup.timer        # próxima ejecución (02:30)
sudo systemctl start fact-kard-backup.service       # ejecutar uno ahora
journalctl -u fact-kard-backup -n 20                # resultado
```

### Retención recomendada
- Diarios: 14 días (`FK_RETENCION_DIAS`).
- Mensuales (copia del día 1): 12 meses (`FK_RETENCION_MESES`).
- **Fuera del VPS**: copiar al menos semanalmente `/var/backups/fact-kard` a otro lugar
  (otro servidor, almacenamiento de objetos, o descarga con `scp`/`rsync`). Un backup que solo
  vive en el mismo VPS no protege contra la pérdida del VPS.
- Por la normativa tributaria, conservar backups de cierres de ejercicio el tiempo que exija
  SUNAT para los libros (copias anuales aparte).

### Verificar un backup (restauración de prueba, NO destructiva)
```bash
sudo -u postgres bash /srv/fact-kard/app/deploy/scripts/fk-restore-qa.sh /var/backups/fact-kard/diario/<archivo>.dump
```
Comprueba el checksum, restaura en una base temporal `fact_kard_restore_qa_<fecha>`, compara
conteos de tablas clave con la base real (solo lectura) y elimina la base temporal. Nunca
toca `fact_kard`. Hacerlo al menos una vez al mes.

### Restauración real (solo ante pérdida de datos; manual)
1. Avisar a los usuarios y detener la aplicación: `sudo systemctl stop fact-kard`.
2. Backup del estado actual aunque esté dañado: `sudo -u postgres fk-backup.sh` (o `pg_dump` manual).
3. Restaurar en una base **nueva** y verificarla:
   ```bash
   sudo -u postgres createdb -O fact_kard_user fact_kard_restaurada
   sudo -u postgres pg_restore --no-owner --role=fact_kard_user --exit-on-error -d fact_kard_restaurada <archivo>.dump
   ```
4. Cambiar `DB_NAME=fact_kard_restaurada` en `backend/.env` (la base original se conserva
   intacta para análisis) y `sudo systemctl start fact-kard`.
5. Health check + smoke test. Recién después, y si se decide, renombrar/eliminar la base vieja.

---

## Logs

| Qué | Dónde | Cómo verlo |
| --- | --- | --- |
| Django + Gunicorn (errores 500 con traza, seguridad, login/logout, health) | journald | `journalctl -u fact-kard -f`, `-p warning`, `--since today` |
| Archivo opcional (`LOG_FILE`) | `/var/log/fact-kard/` (rotación 20 MB × 10) | `tail -f /var/log/fact-kard/fact-kard.log` |
| Accesos y errores de Nginx | `/var/log/nginx/` (logrotate de Ubuntu) | `tail -f /var/log/nginx/access.log` |
| Backups | journald | `journalctl -u fact-kard-backup` |

Eventos registrados por FACT-KARD (`fact_kard.auth`): login correcto (id, usuario, IP), login
fallido (usuario intentado, si existe, IP), usuario inactivo, bloqueo por exceso de intentos,
logout. **Nunca** se registran contraseñas, tokens, `SECRET_KEY`, contraseña de BD ni SQL; un
filtro (`config/registro.py`) además enmascara tokens Bearer/firmados, `password=…` y claves en
URLs en cualquier mensaje o traza. Limitar el tamaño de journald si el disco es chico:
`SystemMaxUse=500M` en `/etc/systemd/journald.conf`.

Búsquedas útiles:
```bash
journalctl -u fact-kard --since "1 hour ago" | grep -E "ERROR|Login bloqueado|Login fallido"
journalctl -u fact-kard -p err --since today
```

---

## Actualización (nueva versión)

```bash
cd /srv/fact-kard/app
sudo -u fact-kard git fetch --all --tags
sudo -u fact-kard git log --oneline HEAD..origin/<rama>        # qué llega
sudo -u postgres bash /srv/fact-kard/app/deploy/scripts/fk-backup.sh # 1. backup ANTES de migrar
git rev-parse HEAD | sudo tee /srv/fact-kard/ULTIMO_COMMIT_OK    # 2. anotar commit actual
sudo -u fact-kard git pull --ff-only                            # 3. código nuevo
# 4. dependencias (solo si cambiaron requirements*.txt / package-lock.json)
sudo -u fact-kard /srv/fact-kard/venv/bin/pip install -r backend/requirements-prod.txt
(cd frontend && sudo -u fact-kard npm ci)
# 5. migraciones y estáticos
cd backend
sudo -u fact-kard /srv/fact-kard/venv/bin/python manage.py migrate --plan   # revisar
sudo -u fact-kard /srv/fact-kard/venv/bin/python manage.py migrate
sudo -u fact-kard /srv/fact-kard/venv/bin/python manage.py collectstatic --noinput
sudo -u fact-kard /srv/fact-kard/venv/bin/python manage.py check --deploy
# 6. frontend
(cd ../frontend && sudo -u fact-kard npm run build && sudo chmod -R o+rX dist)
# 7. reiniciar y verificar
sudo systemctl restart fact-kard
curl -s https://sistema.asescon.net/api/health/
FK_SMOKE_USER=<usuario> python3 ../deploy/scripts/smoke_test.py --base https://sistema.asescon.net --frontend
```

## Rollback

Nada de esto se automatiza: cada paso lo decide una persona.

1. **Volver al commit anterior**
   ```bash
   cd /srv/fact-kard/app
   sudo -u fact-kard git checkout $(cat /srv/fact-kard/ULTIMO_COMMIT_OK)
   ```
2. **Base de datos**
   - Si la versión nueva **no** tenía migraciones, o solo agregó índices/columnas opcionales:
     no tocar la BD (el código anterior funciona con ella).
   - Si tenía una migración que cambió o borró datos: revisar `migrate --plan`; si existe
     migración inversa, `manage.py migrate <app> <migración_anterior>`; si no, restaurar el
     backup del paso 1 de la actualización siguiendo **Restauración real** (en base nueva,
     sin borrar la actual).
3. **Dependencias** (si cambiaron): `pip install -r backend/requirements-prod.txt` y `npm ci`.
4. **Reconstruir el frontend**: `npm run build` en `frontend/`.
5. **Reiniciar**: `sudo systemctl restart fact-kard` (y `sudo systemctl reload nginx` si cambió su configuración).
6. **Verificar**: health check + smoke test.

---

## Cookie HttpOnly (preparada, sigue APAGADA)

La autenticación actual (token en `Authorization: Bearer`) funciona sin cambios. Con el VPS
ya publicado en `https://sistema.asescon.net` se cumplen las condiciones técnicas para la
cookie (frontend y API en el **mismo dominio**, HTTPS, Nginx), pero falta migrar el frontend.
Pasos, en este orden, como cambio propio con su prueba:

1. Frontend: `withCredentials: true` en axios, `xsrfCookieName: 'csrftoken'` /
   `xsrfHeaderName: 'X-CSRFToken'`, quitar el token de `localStorage` y del encabezado,
   decidir la sesión con `GET /api/usuarios/me/` (detalle en `SEGURIDAD_TOKEN_LOCALSTORAGE.md`).
2. `backend/.env`:
   ```
   AUTH_COOKIE_ENABLED=True
   AUTH_COOKIE_SECURE=True
   AUTH_COOKIE_SAMESITE=Lax
   AUTH_COOKIE_DOMAIN=            # vacío: cookie solo para sistema.asescon.net
   CSRF_TRUSTED_ORIGINS=https://sistema.asescon.net
   ```
3. Nginx: sin cambios (ya pasa `Host`, `X-Forwarded-Proto` y sirve todo en el mismo origen).
4. Desplegar backend y frontend **juntos** (activar la cookie con el frontend actual rompe el
   login, porque el login deja de devolver el token).
5. Smoke test; verificar en el navegador que `fk_sesion` aparezca como `HttpOnly; Secure;
   SameSite=Lax` y que `localStorage` ya no tenga `token`.

El backend valida al arrancar que `SameSite=None` lleve `Secure` y que en producción la cookie
sea `Secure` (`apps/usuarios/tests_b7_produccion.py`, `tests_b8_produccion.py`).
