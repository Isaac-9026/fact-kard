# Token de sesión en localStorage — evaluación (Bloque 6)

## Situación actual

- El backend emite un token firmado (`django.core.signing`) que el frontend guarda en
  `localStorage` y envía como `Authorization: Bearer <token>` desde el interceptor de axios.
- Frontend (Vite, puerto 5173) y API (Django, puerto 8000) están en orígenes distintos.

## Riesgo

`localStorage` es legible por cualquier JavaScript que se ejecute en la página. Si existiera
una vulnerabilidad XSS (dependencia comprometida, HTML inyectado), el atacante podría leer
el token y usarlo desde otro equipo hasta que expire o se revoque.

## Por qué no se migró en el Bloque 6 a cookie HttpOnly

Hacerlo bien exige cambiar varias piezas a la vez y probarlas en el despliegue real:

1. Backend: emitir la cookie (`HttpOnly`, `Secure`, `SameSite`) en el login, autenticar por
   cookie y **activar protección CSRF** para métodos de escritura (hoy no aplica porque el
   token viaja en un encabezado).
2. Orígenes cruzados: con 5173 → 8000 la cookie requiere `SameSite=None; Secure` (HTTPS) o
   servir frontend y API bajo el mismo sitio (proxy inverso). Depende del despliegue.
3. Frontend: `withCredentials`, lectura/envío del token CSRF, nuevo flujo de sesión en
   `AuthContext` (hoy decide la sesión por la presencia del token) y del manejo de 401.

Forzarlo sin definir el despliegue podía romper el login existente.

## Endurecimiento aplicado en el Bloque 6

- Cada token tiene un identificador (`jti`) y el **logout lo revoca en el servidor**
  (`POST /api/usuarios/logout/`, tabla `token_revocado`). Un token robado deja de servir
  cuando el usuario cierra sesión.
- **Duración configurable** con `TOKEN_MAX_AGE_SECONDS` (por defecto 7 días; se recomienda
  8–12 horas en producción).
- Usuario desactivado: su token deja de funcionar en la siguiente petición.
- Tokens antiguos sin `jti` se rechazan (piden un nuevo login).
- Login con **throttling** por IP (`LOGIN_THROTTLE_RATE`, por defecto `10/min`) y mensaje
  genérico que no revela si el usuario existe.

## Propuesta para el siguiente bloque

1. Definir despliegue con proxy inverso (frontend y `/api` en el mismo dominio).
2. Cookie `HttpOnly; Secure; SameSite=Lax` emitida en el login; autenticación DRF por cookie
   con `CSRF` obligatorio en POST/PUT/PATCH/DELETE; mantener el encabezado `Authorization`
   solo para clientes de API durante la transición.
3. Frontend: quitar el token de `localStorage`, `withCredentials: true`, encabezado
   `X-CSRFToken`, y obtener la sesión desde `/api/usuarios/me/`.
4. Agregar Content-Security-Policy en el servidor web del frontend.

## Bloque 7 — decisión: cookie HttpOnly preparada, no activada

**Evaluación.** El backend puede emitir la sesión en una cookie HttpOnly sin cambios de
despliegue, pero que el navegador la envíe depende de dónde vivan frontend y API:

| Despliegue | ¿Funciona la cookie? |
| --- | --- |
| Mismo dominio con proxy inverso (`https://app.x/` y `https://app.x/api/`) | Sí, `SameSite=Lax` |
| Subdominios del mismo sitio (`app.x` y `api.x`) | Sí, `SameSite=Lax` + CORS con credenciales |
| Dominios distintos (`app.com` → `api.net`) | Solo con `SameSite=None; Secure`, y los navegadores que bloquean cookies de terceros (Safari, modo estricto de Chrome/Firefox) la descartan |
| Desarrollo (`localhost:5173` → `localhost:8000`) | Sí (mismo sitio; el puerto no cuenta) |

Como el dominio y el hosting de producción aún no están definidos, **no se migró el
frontend**: seguiría funcionando en un caso y rompiéndose en otro. Se dejó todo el lado del
servidor listo y probado, apagado por defecto.

**Qué quedó implementado (backend, `AUTH_COOKIE_ENABLED=False` por defecto):**

- Login: con la cookie activa responde `usuario` y `empresas` **sin** `token` en el cuerpo y
  emite `fk_sesion` (`HttpOnly`, `Secure` configurable, `SameSite` configurable, `Path=/api/`,
  `Max-Age = TOKEN_MAX_AGE_SECONDS`). No existe un segundo token legible desde JavaScript.
- Autenticación: si no hay encabezado `Authorization`, se lee la cookie; las escrituras
  (POST/PUT/PATCH/DELETE) exigen `X-CSRFToken`. Los clientes con `Authorization: Bearer`
  siguen igual (sin CSRF, porque el navegador no envía ese encabezado por sí solo).
- `GET /api/usuarios/csrf/` entrega el token CSRF; el login lo rota.
- Logout revoca el `jti` (como en el Bloque 6) y borra la cookie.
- `CORS_ALLOW_CREDENTIALS` se activa solo con la cookie.
- Validaciones al arrancar: `SameSite` ∈ {Lax, Strict, None}; `None` exige `Secure`; en
  producción con HTTPS la cookie debe ser `Secure`.
- Tests: `apps/usuarios/tests_b7_produccion.py` (`SesionPorCookieTests`).

**Qué falta para activarla (en este orden):**

1. Definir el despliegue. Recomendado: frontend y `/api/` bajo el mismo dominio (proxy
   inverso, p. ej. nginx) con HTTPS.
2. Frontend (`src/api/http.ts`, `src/api/auth.ts`, `src/context/AuthContext.tsx`):
   - `withCredentials: true` en axios y `xsrfCookieName: 'csrftoken'`,
     `xsrfHeaderName: 'X-CSRFToken'` (o leer `GET /api/usuarios/csrf/`).
   - Quitar `localStorage.getItem/setItem('token')` y el encabezado `Authorization`.
   - Decidir la sesión con `GET /api/usuarios/me/` (200 → sesión; 401 → login), no por la
     presencia del token. `RutaProtegida`/`sesion.ts` usan hoy `token`.
   - El login ya no recibe `token`: guardar solo `usuario`/`empresas`.
3. Variables: `AUTH_COOKIE_ENABLED=True`, `AUTH_COOKIE_SAMESITE` según la tabla,
   `CSRF_TRUSTED_ORIGINS=https://<origen del frontend>`, `CORS_ALLOWED_ORIGINS` igual.
   Solo si hay subdominios: `AUTH_COOKIE_DOMAIN=.<dominio>`.
4. Desplegar backend y frontend juntos (activar la cookie sin el frontend nuevo rompe el
   login actual, que espera `token` en la respuesta).
5. Agregar Content-Security-Policy en el servidor web del frontend.

## Bloque 9 — soporte HttpOnly completo (frontend + backend), sigue APAGADO por defecto

El frontend ya soporta los dos modos y los distingue por la respuesta del login:

| | Modo token (actual, por defecto) | Modo cookie HttpOnly |
| --- | --- | --- |
| Backend | `AUTH_COOKIE_ENABLED=False` | `AUTH_COOKIE_ENABLED=True` |
| Respuesta del login | `token` en el cuerpo | sin `token`; cookie `fk_sesion` HttpOnly |
| `localStorage` | `token` | solo la marca `sesion_cookie=1` (no es una credencial) |
| Peticiones | `Authorization: Bearer` | la cookie viaja sola; escrituras con `X-CSRFToken` |
| Logout | revoca el token | revoca la sesión y borra la cookie |

Nunca se guardan ambas cosas: no hay un segundo token de respaldo
(`frontend/src/utils/credencialSesion.ts`, con tests).

**Probado en local (HTTP, sin VPS):** login sin token en la respuesta, `fk_sesion`
`HttpOnly; SameSite=Lax; Path=/api/` invisible para JavaScript, navegación y recarga de la
página con la sesión validada por `/me`, POST sin CSRF → 403, creación de un comprobante desde
la aplicación con CSRF → 201, logout → 204 y `/me` → 401. El smoke test
(`deploy/scripts/smoke_test.py`) funciona en ambos modos.

Desarrollo con cookie (opcional):
```
# backend/.env
AUTH_COOKIE_ENABLED=True
CSRF_TRUSTED_ORIGINS=http://localhost:5173
# frontend: VITE_AUTH_COOKIE=true npm run dev   (orígenes distintos 5173 → 8000)
```

**Qué falta para activarlo en producción (Bloque 10):** solo configuración, cuando el VPS
tenga HTTPS. Pasos en `DESPLIEGUE_VPS.md` §Cookie HttpOnly. No se activa antes porque la
cookie `Secure` exige HTTPS real.
