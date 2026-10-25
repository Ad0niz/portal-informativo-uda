# Demo en Vercel y Supabase

## Estado

- Supabase creado: `portal-informativo-uda`, referencia `hfsjubvnyyzcqqsvpiei`, región São Paulo.
- Vercel: proyecto independiente `portal-informativo-uda`, dentro del workspace `adoniz-projects`.
- URL pública: https://portal-informativo-uda.vercel.app ; administración: https://portal-informativo-uda.vercel.app/admin .
- Código en el repositorio público https://github.com/Ad0niz/portal-informativo-uda ; rama de producción `main` conectada a Vercel. Los pushes a esa rama inician despliegues automáticos.
- Adaptador en `api/index.js` y `lib/cloud.mjs`; gestión administrativa adicional en `lib/accounts.mjs`; esquema versionado en `supabase/schema.sql`.
- Variables de servidor configuradas en Vercel. Las claves privadas se mantienen fuera del repositorio.
- Roles disponibles: **Administración**, **Secretaría** y **Aprobador**.
- Administración puede crear otras cuentas administrativas desde el panel.
- Los perfiles admiten un campo `position` para mostrar un cargo como **Presidente** sin alterar el rol interno ni los permisos.
- Administración puede consultar los correos registrados al boletín, sus categorías, estado de confirmación y fecha de actualización.
- Auth, roles, persistencia, publicación y Web Push probados contra Supabase y la API pública.
- El correo fue migrado desde Resend a **Azure Communication Services Email**.
- El **25 de octubre de 2026** se validó en producción el flujo completo con una cuenta real `@alumnos.uda.cl`: confirmación de suscripción recibida y aviso posterior recibido correctamente.
- El servidor local sigue usando JSON; el adaptador de Vercel requiere Supabase y nunca cae silenciosamente al almacenamiento local.

## Flujo editorial actual

La revisión es opcional por aviso:

1. Secretaría crea o edita un borrador.
2. Puede elegir **Publicar ahora** si la información está confirmada o es urgente.
3. También puede elegir **Enviar a revisión** cuando quiere una segunda validación.
4. El Aprobador puede **Aprobar y publicar** o **Solicitar cambios**.
5. Un aviso con cambios solicitados vuelve a Secretaría, que puede corregirlo y decidir nuevamente entre publicar o enviarlo a revisión.

Administración gestiona cuentas, puede crear otras cuentas con rol `owner`, consulta el registro del boletín y puede intervenir en el contenido cuando sea necesario.

Las notificaciones se generan cuando el aviso pasa a `published`, independientemente de si se publicó directamente o después de una revisión.

## Roles internos y cargos visibles

Los permisos continúan controlados exclusivamente por `portal_profiles.role`:

- `owner` → Administración.
- `editor` → Secretaría.
- `approver` → Aprobador.

El campo `portal_profiles.position` es únicamente descriptivo. Permite mostrar cargos como **Presidente**, **Vicepresidente** o **Encargado de Comunicaciones** sin crear roles técnicos adicionales.

Ejemplo:

```text
name: Fernando Molina
position: Presidente
role: owner
```

En la interfaz se presenta como **Fernando Molina · Presidente**, mientras que el backend lo autoriza como `owner`.

## Gestión de cuentas desde el panel

La sección **Cuentas y roles** está disponible únicamente para `owner`.

Administración puede crear:

- otras cuentas `owner` / Administración;
- cuentas `editor` / Secretaría;
- cuentas `approver` / Aprobador.

El flujo de alta crea primero el usuario en Supabase Auth con correo confirmado y luego registra el perfil en `portal_profiles`. Si la creación del perfil falla, la API intenta eliminar el usuario de Auth para evitar cuentas incompletas.

La clave inicial debe tener entre 12 y 128 caracteres y debe entregarse a la persona por un canal seguro.

## Consulta de suscriptores del boletín

El endpoint administrativo `/api/admin/subscribers` requiere una sesión válida y comprueba que el perfil activo tenga rol `owner`.

La respuesta expone únicamente:

```text
email
categories
confirmed
updatedAt
```

No se envían al navegador `confirmToken`, `unsubscribeToken`, credenciales, claves de servidor ni datos de Web Push.

La interfaz muestra esta información en **Boletín informativo → Suscriptores por correo**, incluyendo el total y un botón para actualizar la lista.

## Configuración realizada y pasos para repetirla

1. Crear el proyecto de Supabase y el proyecto de Vercel.
2. Copiar `.env.cloud.example` a `.env.cloud` para pruebas locales contra la nube. Guardar las claves privadas únicamente en variables secretas.
3. Aplicar `supabase/schema.sql` en un proyecto nuevo. Para proyectos ya creados, aplicar las migraciones posteriores en lugar de volver a ejecutar el esquema completo.
4. Verificar RLS y permisos. Las tablas están protegidas frente a `anon` y `authenticated`; la API de Vercel media el acceso usando la clave del servidor.
5. Crear la cuenta inicial `owner`; desde esa cuenta pueden crearse otras cuentas `owner`, `editor` y `approver` desde el panel.
6. Configurar las variables de Vercel y `PUBLIC_BASE_URL` con la URL definitiva.
7. Configurar Azure Communication Services Email según la sección de correo de este documento.
8. Verificar desde el navegador ambos caminos: publicación directa y revisión opcional.
9. Confirmar que la publicación aparece en el portal y que las notificaciones abren el aviso correspondiente.
10. Realizar una prueba de suscripción con un correo real accesible antes de una demostración importante.

## Cambio de flujo aplicado el 25 de octubre de 2026

Se reemplazó el requisito de aprobación obligatoria por un modelo opcional:

- `editor` / Secretaría puede publicar directamente borradores propios y avisos con cambios solicitados.
- Secretaría también puede enviar esos avisos a `pending` para revisión.
- `approver` no crea contenido; revisa los avisos enviados voluntariamente a revisión.
- El Aprobador puede publicar o devolver el aviso con una observación.
- Administración mantiene control general y gestión de cuentas.

La función PostgreSQL `public.portal_edit_notice` fue actualizada en Supabase y la definición equivalente está versionada en `supabase/schema.sql`.

## Cambio de gestión administrativa aplicado el 25 de octubre de 2026

Se agregó el campo `position` a `portal_profiles` con máximo de 80 caracteres y valor vacío por defecto. La modificación mantiene compatibles todos los perfiles existentes.

También se agregó:

- creación de nuevas cuentas de Administración desde el panel;
- separación entre cargo visible y rol interno;
- módulo `lib/accounts.mjs` para operaciones administrativas;
- consulta protegida de suscriptores del boletín;
- nueva vista administrativa de correos registrados.

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

La API de Vercel utiliza `lib/email.mjs`, que firma las peticiones hacia Azure usando la credencial incluida en la connection string. La clave nunca se envía al navegador.

Variables requeridas:

```env
AZURE_COMMUNICATION_CONNECTION_STRING=
AZURE_EMAIL_SENDER=
PUBLIC_BASE_URL=
```

`AZURE_COMMUNICATION_CONNECTION_STRING` debe almacenarse como secreto. `AZURE_EMAIL_SENDER` puede almacenarse como configuración no sensible.

La restricción `EMAIL_TEST_RECIPIENT` ya no forma parte de la lógica del portal. Cualquier dirección con formato válido puede solicitar el correo de confirmación durante la demo.

Resend y las variables `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL` y `EMAIL_TEST_RECIPIENT` **ya no forman parte de la configuración activa requerida**.

Los trabajos de entrega se crean cuando un aviso se publica. Cada petición procesa una cantidad limitada de entregas y el panel mantiene la opción **Enviar pendientes** para reintentos administrativos cuando sea necesario. La base de datos evita duplicar trabajos mediante la combinación única `(announcement_id, channel, recipient)`, y las peticiones a Azure incluyen un identificador de cliente para correlación.

## Validación real de correo — 25/10/2026

Se realizó una prueba completa en producción usando una cuenta real de estudiante `@alumnos.uda.cl`.

Flujo validado:

```text
Portal público
   ↓
Suscripción por correo
   ↓
Azure Communication Services Email
   ↓
Correo de confirmación recibido ✅
   ↓
Confirmación de la suscripción ✅
   ↓
Publicación de aviso desde el panel
   ↓
Trabajo de entrega generado en Supabase
   ↓
Correo del nuevo aviso recibido ✅
```

El mensaje recibido incluyó:

- asunto con el título del aviso;
- resumen del anuncio;
- enlace **Leer aviso**;
- enlace **Dejar de recibir correos**.

Con esta prueba se confirmó que el portal puede enviar notificaciones de correo reales en tiempo de ejecución a destinatarios externos al dominio administrado de Azure.

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
- Azure Communication Services Email se utiliza únicamente como infraestructura de demostración; una implementación oficial debería utilizar un remitente autorizado por la Universidad.
- La vista de suscriptores contiene direcciones de correo y debe considerarse información administrativa; para un uso institucional se deben definir políticas de privacidad, acceso y retención.
- Antes de uso institucional: recuperación de cuentas, gestión formal de usuarios, antispam, auditoría, accesibilidad, remitente institucional y continuidad operativa.

## Comprobaciones de seguridad

RLS está activado en las tablas. Los roles `anon` y `authenticated` no tienen acceso directo a los datos administrativos; la API de Vercel media las operaciones. La función `portal_edit_notice` usa `security invoker`, valida el rol almacenado en `portal_profiles` y no confía en un rol enviado por el navegador.

Los endpoints de gestión de cuentas y suscriptores vuelven a comprobar el rol `owner` en el servidor. Ocultar una sección en el HTML no se utiliza como mecanismo de autorización.

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

Para validar nuevamente el correo en producción:

1. Abrir el portal público.
2. Seleccionar **Recibir por correo**.
3. Ingresar una dirección real accesible utilizada con autorización para la prueba.
4. Seleccionar categorías y enviar la confirmación.
5. Abrir el correo recibido y confirmar la suscripción.
6. Publicar un aviso de prueba de una categoría suscrita.
7. Comprobar la recepción del segundo mensaje y sus enlaces.