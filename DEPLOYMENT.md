# Demo en Vercel y Supabase

## Estado

- Supabase creado: `portal-informativo-uda`, referencia `hfsjubvnyyzcqqsvpiei`, región São Paulo.
- Vercel: proyecto independiente `portal-informativo-uda`, ID `prj_r06CNB7lR08xwXkMUOhyBGi0iQvq`, espacio Proyectos-Red. No enlazar ni desplegar sobre `tryai-gap`.
- URL pública: https://portal-informativo-uda.vercel.app ; administración: https://portal-informativo-uda.vercel.app/admin .
- Adaptador en `api/index.js` y `lib/cloud.mjs`; esquema aplicado desde `supabase/schema.sql`.
- Variables de servidor configuradas en el proyecto nuevo. Claves privadas guardadas como sensibles en Vercel.
- Tres cuentas demo creadas; credenciales en `demo-credentials.txt` (ignorado por Git).
- Comprobado: Auth, roles, borrador privado, aprobación por otra persona, publicación única y archivo contra Supabase y contra la API pública de Vercel. Filtros y detalle comprobados en navegador.
- El servidor local existente sigue usando JSON; el adaptador de Vercel requiere Supabase y nunca cae silenciosamente al almacenamiento local.

## Configuración realizada y pasos para repetirla

1. Autorizar la conexión al espacio elegido y comprobar que mantiene el plan Hobby, sin prueba Pro ni servicios de pago.
2. Crear el nuevo proyecto de Vercel y comprobar su ID antes de configurar variables o desplegar.
3. Copiar `.env.cloud.example` a `.env.cloud`. Obtener la secret key del proyecto nuevo de Supabase en Settings → API Keys. Guardarla solo en ese archivo o en las variables sensibles de Vercel. No incluirla en código público.
4. Aplicar el esquema a Supabase y revisar los avisos de seguridad. Todas las tablas tienen RLS y no permiten acceso de anon/authenticated; la API del servidor valida la identidad con Supabase Auth y los roles guardados en portal_profiles.
5. Crear la cuenta inicial mediante Auth Admin y su perfil owner. Crear un editor y un aprobador para comprobar la demo. Usar contraseñas aleatorias y entregarlas en un archivo local ignorado.
6. Configurar las variables de Vercel, desplegar y asignar PUBLIC_BASE_URL a la dirección definitiva de la demo. Los datos, cuentas y claves del proyecto anterior son independientes.
7. Verificar desde el navegador: ingreso, borrador, revisión, aprobación por otra persona, aparición pública, persistencia después de otro despliegue, notificación y apertura del aviso.

## Notificaciones

Web Push usa claves VAPID y la URL del portal como VAPID_SUBJECT. Requiere HTTPS y permiso del navegador. Prueba real completada el 25 de octubre de 2026: suscripción guardada, envío aceptado por el proveedor, recepción y apertura del aviso confirmadas por el usuario. Incluye el proveedor alternativo de Chromium jmt17.google.com. La interfaz espera la activación del service worker y limita las esperas del permiso y de la suscripción.

Correo configurado con Resend y remitente de prueba onboarding@resend.dev. El usuario confirmó su suscripción mediante el enlace recibido y luego confirmó la recepción del aviso y la apertura de su enlace. EMAIL_TEST_RECIPIENT restringe los envíos al correo autorizado, sin exponer esa dirección en la API pública. Para habilitar otros destinatarios: verificar un dominio propio en Resend, cambiar NOTIFY_FROM_EMAIL a una dirección de ese dominio, retirar EMAIL_TEST_RECIPIENT y volver a desplegar.

La prueba produjo 1 correo y 1 notificación push aceptados, 0 fallidos y 0 pendientes. Aviso de prueba conservado: https://portal-informativo-uda.vercel.app/?aviso=f5e7593a-dad4-470d-b373-311bb5067166 . El usuario confirmó que ambos llegaron y abren la publicación.

La aprobación guarda trabajos de envío en la misma transacción. Cada petición envía hasta tres notificaciones; el panel ofrece **Enviar pendientes** para continuar o reintentar. En esta demo no hay un trabajador automático. Push puede repetirse después de una interrupción, usando la misma etiqueta del aviso. Resend recibe una clave de idempotencia por trabajo.

## Límites de esta demo

- Sesión limitada a la vigencia del token de Supabase; se vuelve a ingresar al caducar.
- Edición solamente de borradores propios o avisos devueltos: una corrección de un aviso publicado necesita un nuevo aviso y revisión.
- Listado público hasta 200 avisos y panel hasta 500; paginación pendiente para uso institucional.
- Antes de uso real: recuperación de cuentas, gestión de bajas, antispam de suscripciones, procesamiento automático de envíos y revisión de accesibilidad.

## Comprobaciones de seguridad

RLS activado en las cinco tablas. Los roles anon y authenticated no tienen SELECT directo; la API de Vercel media el acceso. El asesor de Supabase informa de RLS sin políticas (intencional en este modelo de acceso exclusivo del servidor) y protección contra contraseñas filtradas desactivada. Se usaron claves demo aleatorias; revisar la [protección de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) antes de uso institucional. [Detalle del aviso RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Pruebas reproducibles

- `npm test`: pruebas locales de autorización, origen y validación de proveedores push.
- `node scripts/cloud-smoke.mjs`: integración real con Supabase usando `.env.cloud`.
- Establecer `CLOUD_TEST_URL=https://portal-informativo-uda.vercel.app` y ejecutar el mismo script para probar el despliegue real. Crea un aviso técnico y lo archiva al terminar; no ejecutar con suscriptores reales sin planificar los envíos.
