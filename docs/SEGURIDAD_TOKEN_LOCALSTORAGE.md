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
