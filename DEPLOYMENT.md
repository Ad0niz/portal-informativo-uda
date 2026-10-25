# Demo en Vercel y Supabase

## Estado

- Supabase creado: `portal-informativo-uda`, referencia `hfsjubvnyyzcqqsvpiei`, región São Paulo.
- Vercel: proyecto independiente `portal-informativo-uda`, dentro del workspace `adoniz-projects`.
- URL pública: https://portal-informativo-uda.vercel.app ; administración: https://portal-informativo-uda.vercel.app/admin .
- Código en el repositorio público https://github.com/Ad0niz/portal-informativo-uda ; rama de producción `main` conectada a Vercel. Los pushes a esa rama inician despliegues automáticos.
- Adaptador en `api/index.js` y `lib/cloud.mjs`; esquema versionado en `supabase/schema.sql`.
- Variables de servidor configuradas en Vercel. Las claves privadas se mantienen fuera del repositorio.
- Tres cuentas demo creadas: **Administración**, **Secretaría** y **Aprobador**; credenciales en archivo local ignorado por Git.
- Auth, roles, persistencia, publicación y Web Push probados contra Supabase y la API pública.
- El correo fue migrado desde Resend a Azure Communication Services Email. La infraestructura Azure quedó configurada y el flujo de recepción con destinatarios reales debe validarse después de cada cambio relevante del proveedor o credenciales.
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
2. Copiar `.env.cloud.example` a `.env.cloud` para pruebas locales contra la nube. Guardar las claves privadas únicamente en variables secretas.
3. Aplicar `supabase/schema.sql` en un proyecto nuevo. Para proyectos ya creados, aplicar las migraciones posteriores en lugar de volver a ejecutar el esquema completo.
4. Verificar RLS y permisos. Las tablas están protegidas frente a `anon` y `authenticated`; la API de Vercel media el acceso usando la clave del servidor.
5. Crear la cuenta inicial `owner` y luego las cuentas `editor` y `approver`. En la interfaz, `editor` se muestra como **Secretaría**.
6. Configurar las variables de Vercel y `PUBLIC_BASE_URL` con la URL definitiva.
7. Configurar Azure Communication Services Email según la sección de correo de este documento.
8. Verificar desde el navegador ambos caminos: publicación directa y revisión opcional.
9. Confirmar que la publicación aparece en el portal y que las notificaciones abren el aviso correspondiente.

## Cambio de flujo aplicado el 25 de octubre de 2026

Se reemplazó el requisito de aprobación obligatoria por un modelo opcional:

- `editor` / Secretaría puede publicar directamente borradores propios y avisos con cambios solicitados.
- Secretaría también puede enviar esos avisos a `pending` para revisión.
- `approver` no crea contenido; revisa los avisos enviados voluntariamente a revisión.
- El Aprobador puede publicar o devolver el aviso con una observación.
- Administración mantiene control general y gestión de cuentas.

La función PostgreSQL `public.portal_edit_notice` fue actualizada en Supabase y la definición equivalente está versionada en `supabase/schema.sql`.

## Notificaciones

### Web Push

Web Push usa claves VAPID y requiere HTTPS y permiso del navegador. La suscripción, recepción y apertura de avisos fueron probadas en producción.

### Correo electrónico con Azure

El despliegue utiliza **Azure Communication Services Email** para los correos de confirmación y los avisos enviados a suscriptores.

Recursos Azure creados para esta demo:

- Resource group: `rg-portal-informativo-uda`.
- Email Communication Service: `portal-informativo-uda-email`.
- Communication Service: `portal-informativo-uda-comms`.
- Dominio administrado por Azure: `b700abf8-4aa2-4009-b9e4-c8f5c5b66f0a.azurecomm.net`.
- Remitente: `DoNotReply@b700abf8-4aa2-4009-b9e4-c8f5c5b66f0a.azurecomm.net`.
- Estado del dominio: verificado.
- SPF: verificado.
- DKIM y DKIM2: verificados.

El dominio administrado por Azure permite realizar la demostración sin comprar un dominio propio ni depender de una cuenta personal. Para una eventual adopción institucional, el remitente debería reemplazarse por uno autorizado por la Universidad.

La API de Vercel utiliza `lib/email.mjs`, que firma las peticiones hacia Azure con la clave incluida en la connection string. La clave nunca se envía al navegador.

Variables requeridas:

```env
AZURE_COMMUNICATION_CONNECTION_STRING=
AZURE_EMAIL_SENDER=
PUBLIC_BASE_URL=
```

`AZURE_COMMUNICATION_CONNECTION_STRING` debe almacenarse como secreto. `AZURE_EMAIL_SENDER` puede almacenarse como configuración no sensible.

La restricción `EMAIL_TEST_RECIPIENT` ya no forma parte de la lógica del portal: cualquier dirección con formato válido puede solicitar el correo de confirmación durante la demo. Las variables antiguas `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL` y `EMAIL_TEST_RECIPIENT` pueden retirarse de Vercel una vez validado satisfactoriamente el envío por Azure.

Los trabajos de entrega se crean cuando un aviso se publica. Cada petición procesa una cantidad limitada de entregas y el panel mantiene la opción **Enviar pendientes** para reintentos administrativos cuando sea necesario. La base de datos evita duplicar trabajos mediante la combinación única `(announcement_id, channel, recipient)`, y las peticiones a Azure incluyen un identificador de cliente para correlación.

## Variables principales

```env
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
PUBLIC_BASE_URL=

AZURE_COMMUNICATION_CONNECTION_STRING=
AZURE_EMAIL_SENDER=

VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
```

## Límites de esta demo

- La sesión está limitada a la vigencia del token de Supabase.
- Los avisos publicados se archivan en lugar de eliminarse desde el flujo normal.
- Listado público limitado a 200 avisos y panel a 500; paginación pendiente para uso institucional.
- Los reintentos de entrega no tienen todavía un worker automático permanente.
- El remitente de demostración pertenece al dominio administrado de Azure y no representa una cuenta institucional oficial de la UDA.
- Antes de uso institucional: recuperación de cuentas, gestión formal de usuarios, antispam, auditoría, accesibilidad, remitente institucional y continuidad operativa.

## Comprobaciones de seguridad

RLS está activado en las tablas. Los roles `anon` y `authenticated` no tienen acceso directo a los datos administrativos; la API de Vercel media las operaciones. La función `portal_edit_notice` usa `security invoker`, valida el rol almacenado en `portal_profiles` y no confía en un rol enviado por el navegador.

Las claves secretas de Supabase, Azure Communication Services y VAPID no deben incluirse en Git ni exponerse en JavaScript público.

## Pruebas reproducibles

- `npm test`: pruebas locales de autorización, origen y validación de proveedores push.
- `node scripts/cloud-smoke.mjs`: integración contra Supabase usando `.env.cloud`.
- Con `CLOUD_TEST_URL=https://portal-informativo-uda.vercel.app`, el script puede probar la API desplegada. Evitar ejecutar pruebas que publiquen avisos cuando existan suscriptores reales sin planificar las notificaciones.

Las pruebas deberían cubrir ambos flujos editoriales:

```text
Secretaría → publicar directamente
Secretaría → enviar a revisión → Aprobador → publicar / solicitar cambios
```

Para validar el correo en producción:

1. Abrir el portal público.
2. Seleccionar **Recibir por correo**.
3. Ingresar una dirección real accesible, por ejemplo una cuenta `@alumnos.uda.cl` utilizada con autorización para la prueba.
4. Seleccionar categorías y enviar la confirmación.
5. Abrir el correo recibido y confirmar la suscripción.
6. Publicar un aviso de prueba de una categoría suscrita y comprobar la recepción del segundo mensaje.