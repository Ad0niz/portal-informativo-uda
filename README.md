# Panel Informativo Derecho UDA

Portal de avisos académicos para estudiantes de Derecho de la Universidad de Atacama. Permite consultar información relevante, filtrar avisos por categoría y administrar publicaciones mediante roles diferenciados. También incorpora notificaciones por correo electrónico y Web Push.

## Demo desplegada

- Portal: https://portal-informativo-uda.vercel.app
- Panel de administración: https://portal-informativo-uda.vercel.app/admin
- Base de datos y autenticación: Supabase PostgreSQL + Supabase Auth.
- Hosting y API: Vercel.
- Correo electrónico: Azure Communication Services Email.
- Notificaciones del navegador: Web Push con VAPID.
- Roles disponibles: **Administración**, **Secretaría** y **Aprobador**. Las credenciales se mantienen fuera del repositorio.
- Administración puede crear otras cuentas administrativas y asignar un **cargo visible** sin cambiar el rol interno de permisos.
- Las cuentas nuevas creadas desde el panel reciben una **clave temporal de 8 a 128 caracteres** y deben reemplazarla obligatoriamente en el primer ingreso antes de acceder al panel.
- Administración puede consultar los correos registrados al boletín, sus categorías, estado de confirmación y fecha de actualización, además de eliminar una suscripción cuando sea necesario.
- Web Push configurado y probado en producción.
- El flujo de correo fue probado satisfactoriamente el **25 de octubre de 2026** con una cuenta real `@alumnos.uda.cl`: se recibió el correo de confirmación de suscripción y posteriormente un aviso publicado desde el panel.

La configuración técnica, las pruebas realizadas y las consideraciones para producción están documentadas en `DEPLOYMENT.md`.

## Flujo editorial

El sistema utiliza tres roles:

- **Administración:** gestiona las cuentas con acceso al panel, puede crear otras cuentas de Administración, supervisa el contenido, consulta y administra el registro del boletín e interviene cuando sea necesario.
- **Secretaría:** crea, edita, publica, archiva y elimina borradores de sus avisos. Puede publicar inmediatamente o enviar un aviso a revisión si necesita una segunda validación.
- **Aprobador:** participa únicamente cuando un aviso fue enviado a revisión. Puede aprobarlo y publicarlo o solicitar cambios antes de su publicación.

La aprobación es **opcional por aviso**.

```text
Borrador
   │
   ├── Publicar ahora ───────────────► Publicado
   │
   └── Enviar a revisión
             │
             ├── Aprobar y publicar ─► Publicado
             │
             └── Solicitar cambios ──► Cambios solicitados
                                         │
                                         ├── Publicar ahora
                                         └── Volver a revisión
```

Esto permite publicar rápidamente cambios urgentes, como suspensiones de clases o cambios de sala, sin perder la posibilidad de solicitar revisión cuando la información o la redacción aún no están completamente confirmadas.

Cuando un aviso se publica, aparece en el portal y se generan las notificaciones correspondientes para las personas suscritas a esa categoría.

## Cuentas, roles y cargos

El rol interno controla los permisos y el cargo visible identifica la función institucional o del equipo. Por ejemplo, una persona puede tener:

```text
Nombre: Fernando Molina
Cargo visible: Presidente
Rol interno: Administración (owner)
```

Esto permite mostrar **“Fernando Molina · Presidente”** en el panel, manteniendo los permisos de Administración.

Desde **Cuentas y roles**, una cuenta de Administración puede crear:

- otra cuenta de **Administración**;
- una cuenta de **Secretaría**;
- una cuenta de **Aprobador**.

Las cuentas se crean en Supabase Auth y su perfil se registra en `portal_profiles` mediante la API del servidor.

### Cambio obligatorio de contraseña en el primer ingreso

Las cuentas nuevas creadas desde el panel se marcan con `mustChangePassword = true`.

El flujo es:

```text
Administración crea la cuenta
        ↓
Clave temporal de 8 a 128 caracteres
        ↓
La persona inicia sesión
        ↓
Pantalla obligatoria de cambio de contraseña
        ↓
Valida la clave temporal actual
        ↓
Guarda una nueva clave distinta
        ↓
Acceso normal al panel
```

Mientras el cambio esté pendiente, el backend bloquea el acceso a las rutas administrativas. La nueva contraseña debe tener entre **8 y 128 caracteres**, debe coincidir con su confirmación y no puede ser igual a la clave temporal utilizada para ingresar.

Las cuentas que ya existían antes de incorporar esta función no se marcan automáticamente para cambio de contraseña.

## Suscriptores del boletín

Administración dispone de una sección **Boletín informativo → Suscriptores por correo**. Esta vista muestra únicamente:

- dirección de correo;
- categorías seleccionadas;
- estado **Confirmado** o **Pendiente**;
- fecha de última actualización.

También puede eliminar una suscripción desde el panel. Al hacerlo se elimina el registro del boletín y se limpian los trabajos de correo pendientes que todavía no hayan sido enviados a esa dirección.

Los tokens de confirmación y cancelación, credenciales y datos técnicos de Web Push no se exponen en la interfaz administrativa.

## Código y actualizaciones

Repositorio público: https://github.com/Ad0niz/portal-informativo-uda

La rama `main` está conectada al proyecto de Vercel. Cada push a `main` inicia automáticamente un nuevo despliegue.

Para trabajar desde otro equipo:

1. Clonar el repositorio.
2. Ejecutar `npm ci`.
3. Consultar `DEPLOYMENT.md` para configurar los servicios y variables de entorno.
4. Ejecutar `npm test` antes de publicar cambios.

Las claves privadas, variables de entorno, credenciales demo, datos locales y evidencias de prueba no se incluyen en Git.

## Arquitectura de producción

```text
Estudiante / Encargado
        │
        ▼
      Vercel
 ┌──────┴─────────┐
 │                │
Portal público    API / Panel
 │                │
 │                ├── Supabase Auth
 │                ├── Supabase PostgreSQL
 │                ├── Azure Communication Services Email
 │                └── Web Push
 │
 └── Avisos publicados
```

El despliegue en Vercel utiliza:

- `lib/cloud.mjs` para autenticación, avisos, suscripciones y entrega de notificaciones;
- `lib/accounts.mjs` para la gestión administrativa de cuentas y suscriptores;
- `lib/password.mjs` para el cambio obligatorio de contraseña inicial y el bloqueo de rutas administrativas mientras esté pendiente;
- `lib/email.mjs` para enviar correo mediante Azure Communication Services.

La aplicación no depende del almacenamiento local de Vercel para conservar información.

## Iniciar la versión local con JSON

La versión de desarrollo local puede ejecutarse sin Supabase y utiliza `data/portal.json` como almacenamiento.

Requiere Node.js 22 o posterior.

1. Ejecuta `npm install`.
2. Ejecuta `npm run setup` para generar `.env`, una clave inicial segura y las claves VAPID. También puedes copiar `.env.example` a `.env` y configurar las variables manualmente.
3. Ejecuta `npm start`.
4. Abre `http://localhost:3000`.
5. El panel local está disponible en `http://localhost:3000/admin`.

La versión local y la versión desplegada en Vercel utilizan sistemas de autenticación y almacenamiento independientes. La integración Azure descrita a continuación corresponde al despliegue cloud.

## Notificaciones por correo

En producción las suscripciones por correo utilizan **Azure Communication Services Email**. El usuario selecciona las categorías que desea recibir, confirma su dirección mediante un enlace y posteriormente recibe los nuevos avisos correspondientes a sus preferencias.

Para la demo se utiliza un dominio administrado gratuitamente por Azure (`azurecomm.net`), por lo que no es necesario comprar un dominio propio ni utilizar una cuenta personal como remitente. El remitente visible es del tipo `DoNotReply@<dominio-administrado>.azurecomm.net`.

El flujo validado es:

```text
Estudiante
   ↓
Selecciona temas y registra su correo
   ↓
Azure envía confirmación
   ↓
Estudiante confirma la suscripción
   ↓
Secretaría / Administración publica un aviso
   ↓
Azure envía el aviso a los suscriptores de la categoría
```

Los correos incluyen un enlace directo al aviso y una opción para cancelar la suscripción.

Variables principales:

```env
AZURE_COMMUNICATION_CONNECTION_STRING=
AZURE_EMAIL_SENDER=
PUBLIC_BASE_URL=
```

La connection string es privada y debe almacenarse únicamente como secreto del servidor. No debe incluirse en Git ni exponerse en JavaScript público.

**Resend ya no forma parte del flujo activo de correo del portal.**

## Web Push

Las notificaciones del navegador utilizan Web Push y claves VAPID. Cada visitante puede seleccionar las categorías de interés y autorizar las notificaciones en su dispositivo.

Al pulsar una notificación, se abre directamente el aviso correspondiente en el portal.

Variables principales:

```env
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
```

HTTPS es obligatorio en producción; `localhost` funciona para desarrollo.

## Pruebas

Ejecutar las pruebas locales con:

```bash
npm test
```

El proyecto también cuenta con pruebas de integración para validar el flujo contra Supabase y el despliegue real en Vercel. Consulta `DEPLOYMENT.md` para más información.

### Prueba real de correo

El **25 de octubre de 2026** se validó en producción el flujo completo con una cuenta de estudiante `@alumnos.uda.cl`:

1. Solicitud de suscripción desde el portal.
2. Recepción del correo de confirmación.
3. Confirmación de la suscripción.
4. Publicación de un aviso desde el panel.
5. Recepción del aviso por correo con enlaces **Leer aviso** y **Dejar de recibir correos**.

Esta prueba confirmó que la demo puede enviar correos reales en tiempo de ejecución sin depender de un dominio propio.

## Contexto

El proyecto surge como una propuesta para modernizar el acceso a los avisos académicos que anteriormente se publicaban en [El Panel Informativo](https://secretariaderecho.blogspot.com/).

El objetivo es centralizar cancelaciones de clases, cambios de sala, evaluaciones, convocatorias y comunicados en una interfaz más simple para los estudiantes, incorporando además notificaciones automáticas y una revisión editorial opcional cuando sea necesaria.

Actualmente corresponde a una **demo funcional / prototipo independiente**. Su adopción como canal institucional oficial requiere la validación de la Universidad de Atacama y la definición de responsables editoriales.