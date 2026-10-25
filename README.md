# Panel Informativo Derecho UDA

Primera versión funcional de un portal de avisos para estudiantes de Derecho de la Universidad de Atacama. Permite consultar avisos, filtrar por tema y administrarlos desde un panel protegido. Admite notificaciones por correo y notificaciones clicables del navegador.

## Demo desplegada

- Portal: https://portal-informativo-uda.vercel.app
- Panel: https://portal-informativo-uda.vercel.app/admin
- Cuentas demo: archivo local privado `demo-credentials.txt`.
- El despliegue usa Supabase Auth y Postgres; configuración, pruebas y pendientes en `DEPLOYMENT.md`.
- Correo y Web Push configurados y probados: el titular confirmó que recibió ambos y que abren el aviso. Por ahora, el correo está limitado a la dirección de prueba autorizada de Resend.

## Iniciar la versión local con JSON

Requiere Node.js 22 o posterior. Ejecuta `npm install` antes de iniciar.

1. Ejecuta `npm run setup`. Genera `.env`, una clave inicial segura y las claves del navegador. Anota la clave que aparece una sola vez en la terminal. También puedes copiar `.env.example` a `.env` y configurar todo manualmente.
2. Ejecuta `npm start`.
3. Abre `http://localhost:3000`. El panel de publicación está en `/admin`; ingresa con el usuario `admin` y la clave inicial.

Si no configuras una clave, el portal público funciona con avisos de demostración y el acceso al panel queda deshabilitado. Después del primer inicio, cambiar `ADMIN_PASSWORD` no cambia la clave de la cuenta guardada.

## Publicar y notificar

La cuenta `admin` puede crear cuentas de tipo **redactor** y **aprobador**. Un redactor crea un borrador y lo envía a revisión. Un aprobador distinto de quien lo redactó puede devolverlo con una nota o publicarlo. Al publicar, se envían alertas a las personas suscritas a esa categoría.

Para correo se requiere `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL` (dominio verificado) y `PUBLIC_BASE_URL` con dominio público. La suscripción usa confirmación por correo e incluye un enlace para darse de baja.

Para alertas del navegador, `npm run setup` genera las claves VAPID. Antes de publicar, reemplaza el `VAPID_SUBJECT` de ejemplo por un correo de contacto real y configura `PUBLIC_BASE_URL`. Se necesita HTTPS en producción; `localhost` sirve para desarrollo. Cada visitante elige las categorías y autoriza el permiso en su navegador. El aviso abre la publicación correspondiente al hacer clic.

En esta versión local los avisos, cuentas y suscripciones se guardan en `data/portal.json`. El despliegue de Vercel utiliza la API independiente de `lib/cloud.mjs` y guarda los datos en Supabase; no carga este JSON ni las contraseñas locales. Las cuentas locales y las cuentas de Supabase son independientes.

Los avisos iniciales son **ejemplos ficticios** para revisar la interfaz. Deben eliminarse desde el panel antes de usarlo como canal oficial.

## Pruebas

`npm test`

## Contexto

El proyecto responde a la solicitud de reemplazar el blog [El Panel Informativo](https://secretariaderecho.blogspot.com/) con acceso más simple a cancelaciones, cambios de sala, evaluaciones y comunicados. Es un prototipo independiente; su publicación como canal oficial requiere validación de la universidad, dominio y responsables editoriales.
