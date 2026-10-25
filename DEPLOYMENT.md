# Demo en Vercel y Supabase

## Estado

- Supabase creado: `portal-informativo-uda`, referencia `hfsjubvnyyzcqqsvpiei`, región São Paulo.
- Vercel: proyecto independiente `portal-informativo-uda`.
- URL pública: https://portal-informativo-uda.vercel.app ; administración: https://portal-informativo-uda.vercel.app/admin .
- Código en el repositorio público https://github.com/Ad0niz/portal-informativo-uda ; rama de producción `main` conectada a Vercel. Los pushes a esa rama inician despliegues automáticos.
- Adaptador en `api/index.js` y `lib/cloud.mjs`; esquema versionado en `supabase/schema.sql`.
- Variables de servidor configuradas en Vercel. Las claves privadas se mantienen fuera del repositorio.
- Tres cuentas demo creadas: **Administración**, **Secretaría** y **Aprobador**; credenciales en archivo local ignorado por Git.
- Auth, roles, persistencia, publicación, correo y Web Push probados contra Supabase y la API pública.
- El servidor local sigue usando JSON; el adaptador de Vercel requiere Supabase y nunca cae silenciosamente al almacenamiento local.

## Flujo editorial actual

La revisión es opcional por aviso:

1. Secretaría crea o edita un borrador.
2. Puede elegir **Publicar ahora** si la información está confirmada o es urgente.
3. También puede elegir **Enviar a revisión** cuando quiere una segunda validación.
4. El Aprobador puede **Aprobar y publicar** o **Solicitar cambios**.
5. Un aviso con cambios solicitados vuelve a Secretaría, que puede corregirlo y decidir nuevamente entre publicar o enviarlo a revisión.

Administración gestiona cuentas y puede intervenir en el contenido cuando sea necesario.

Las notificaciones se generan cuando el aviso pasa a `published`, independientemente de si se publicó directamente o después de una revisión.

## Configuración realizada y pasos para repetirla

1. Crear el proyecto de Supabase y el proyecto de Vercel.
2. Copiar `.env.cloud.example` a `.env.cloud` para pruebas locales contra la nube. Guardar la Secret Key únicamente en variables privadas.
3. Aplicar `supabase/schema.sql` en un proyecto nuevo. Para proyectos ya creados, aplicar las migraciones posteriores en lugar de volver a ejecutar el esquema completo.
4. Verificar RLS y permisos. Las tablas están protegidas frente a `anon` y `authenticated`; la API de Vercel media el acceso usando la clave del servidor.
5. Crear la cuenta inicial `owner` y luego las cuentas `editor` y `approver`. En la interfaz, `editor` se muestra como **Secretaría**.
6. Configurar las variables de Vercel y `PUBLIC_BASE_URL` con la URL definitiva.
7. Verificar desde el navegador ambos caminos: publicación directa y revisión opcional.
8. Confirmar que la publicación aparece en el portal y que las notificaciones abren el aviso correspondiente.

## Cambio de flujo aplicado el 25 de octubre de 2026

Se reemplazó el requisito de aprobación obligatoria por un modelo opcional:

- `editor` / Secretaría puede publicar directamente borradores propios y avisos con cambios solicitados.
- Secretaría también puede enviar esos avisos a `pending` para revisión.
- `approver` no crea contenido; revisa los avisos enviados voluntariamente a revisión.
- El Aprobador puede publicar o devolver el aviso con una observación.
- Administración mantiene control general y gestión de cuentas.

La función PostgreSQL `public.portal_edit_notice` fue actualizada en Supabase y la definición equivalente está versionada en `supabase/schema.sql`.

## Notificaciones

Web Push usa claves VAPID y requiere HTTPS y permiso del navegador. La suscripción, recepción y apertura de avisos fueron probadas en producción.

Correo usa Resend. La demo puede mantenerse restringida a `EMAIL_TEST_RECIPIENT`; para permitir destinatarios generales se debe verificar un dominio propio, actualizar `NOTIFY_FROM_EMAIL`, retirar la restricción de prueba y desplegar nuevamente.

Los trabajos de entrega se crean cuando un aviso se publica. Cada petición procesa una cantidad limitada de entregas y el panel mantiene la opción **Enviar pendientes** para reintentos administrativos cuando sea necesario. Resend utiliza clave de idempotencia por trabajo.

## Variables principales

```env
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
PUBLIC_BASE_URL=

RESEND_API_KEY=
NOTIFY_FROM_EMAIL=
EMAIL_TEST_RECIPIENT=

VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
```

## Límites de esta demo

- La sesión está limitada a la vigencia del token de Supabase.
- Los avisos publicados se archivan en lugar de eliminarse desde el flujo normal.
- Listado público limitado a 200 avisos y panel a 500; paginación pendiente para uso institucional.
- Los reintentos de entrega no tienen todavía un worker automático permanente.
- Antes de uso institucional: recuperación de cuentas, gestión formal de usuarios, antispam, auditoría, accesibilidad y continuidad operativa.

## Comprobaciones de seguridad

RLS está activado en las tablas. Los roles `anon` y `authenticated` no tienen acceso directo a los datos administrativos; la API de Vercel media las operaciones. La función `portal_edit_notice` usa `security invoker`, valida el rol almacenado en `portal_profiles` y no confía en un rol enviado por el navegador.

Las claves secretas de Supabase, Resend y VAPID no deben incluirse en Git ni exponerse en JavaScript público.

## Pruebas reproducibles

- `npm test`: pruebas locales de autorización, origen y validación de proveedores push.
- `node scripts/cloud-smoke.mjs`: integración contra Supabase usando `.env.cloud`.
- Con `CLOUD_TEST_URL=https://portal-informativo-uda.vercel.app`, el script puede probar la API desplegada. Evitar ejecutar pruebas que publiquen avisos cuando existan suscriptores reales sin planificar las notificaciones.

Las pruebas deberían cubrir ambos flujos editoriales:

```text
Secretaría → publicar directamente
Secretaría → enviar a revisión → Aprobador → publicar / solicitar cambios
```