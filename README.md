# Panel Informativo Derecho UDA

Portal de avisos académicos para estudiantes de Derecho de la Universidad de Atacama. Permite consultar información relevante, filtrar avisos por categoría y administrar publicaciones mediante roles diferenciados. También incorpora notificaciones por correo electrónico y Web Push.

## Demo desplegada

- Portal: https://portal-informativo-uda.vercel.app
- Panel de administración: https://portal-informativo-uda.vercel.app/admin
- Base de datos y autenticación: Supabase PostgreSQL + Supabase Auth.
- Hosting y API: Vercel.
- Correo electrónico: Resend.
- Notificaciones del navegador: Web Push con VAPID.
- Tres cuentas demo creadas: **Administración**, **Secretaría** y **Aprobador**. Las credenciales se mantienen fuera del repositorio.
- Correo y Web Push configurados y probados en producción.

La configuración técnica, las pruebas realizadas y las consideraciones para producción están documentadas en `DEPLOYMENT.md`.

## Flujo editorial

El sistema utiliza tres roles:

- **Administración:** gestiona las cuentas con acceso al panel, supervisa el contenido y puede intervenir cuando sea necesario.
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
 │                ├── Resend
 │                └── Web Push
 │
 └── Avisos publicados
```

El despliegue en Vercel utiliza `lib/cloud.mjs` para acceder a Supabase. La aplicación no depende del almacenamiento local de Vercel para conservar información.

## Iniciar la versión local con JSON

La versión de desarrollo local puede ejecutarse sin Supabase y utiliza `data/portal.json` como almacenamiento.

Requiere Node.js 22 o posterior.

1. Ejecuta `npm install`.
2. Ejecuta `npm run setup` para generar `.env`, una clave inicial segura y las claves VAPID. También puedes copiar `.env.example` a `.env` y configurar las variables manualmente.
3. Ejecuta `npm start`.
4. Abre `http://localhost:3000`.
5. El panel local está disponible en `http://localhost:3000/admin`.

La versión local y la versión desplegada en Vercel utilizan sistemas de autenticación y almacenamiento independientes.

## Notificaciones por correo

Las suscripciones por correo utilizan Resend. El usuario selecciona las categorías que desea recibir, confirma su dirección mediante un enlace y posteriormente recibe los nuevos avisos correspondientes a sus preferencias.

Los correos incluyen un enlace directo al aviso y una opción para cancelar la suscripción.

Variables principales:

```env
RESEND_API_KEY=
NOTIFY_FROM_EMAIL=
PUBLIC_BASE_URL=
```

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

## Contexto

El proyecto surge como una propuesta para modernizar el acceso a los avisos académicos que anteriormente se publicaban en [El Panel Informativo](https://secretariaderecho.blogspot.com/).

El objetivo es centralizar cancelaciones de clases, cambios de sala, evaluaciones, convocatorias y comunicados en una interfaz más simple para los estudiantes, incorporando además notificaciones automáticas y una revisión editorial opcional cuando sea necesaria.

Actualmente corresponde a una **demo funcional / prototipo independiente**. Su adopción como canal institucional oficial requiere la validación de la Universidad de Atacama y la definición de responsables editoriales.