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
