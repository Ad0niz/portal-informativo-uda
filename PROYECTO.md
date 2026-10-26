# Propuesta: Panel Informativo de Derecho UDA

## Objetivo

Reemplazar el flujo de consulta del blog actual por un portal de avisos académicos fácil de usar desde el teléfono. La prioridad es encontrar información reciente y recibir alertas sobre cambios relevantes, sin convertir el portal en una página de presentación institucional.

## Personas y permisos

| Rol | Puede hacer |
| --- | --- |
| Estudiante | Buscar, filtrar, leer, compartir y suscribirse por tema. |
| Secretaría | Crear y editar avisos, guardar borradores, publicar directamente, enviar a revisión cuando sea necesario, archivar avisos y eliminar borradores propios. |
| Aprobador | Revisar únicamente los avisos enviados voluntariamente a revisión, aprobarlos y publicarlos o solicitar cambios con una observación. |
| Administración | Gestionar cuentas, crear otras cuentas de Administración, supervisar contenido, actuar sobre avisos cuando sea necesario y administrar los correos registrados al boletín. |

El sistema diferencia entre **rol interno** y **cargo visible**. El rol determina permisos; el cargo identifica la función de la persona dentro del equipo. Por ejemplo, una persona con cargo **Presidente** puede utilizar el rol interno **Administración** y conservar todos sus permisos administrativos.

La aprobación no es obligatoria. Secretaría puede publicar directamente cuando la información está confirmada o necesita salir con rapidez. Si existen dudas sobre el contenido, datos o redacción, puede solicitar una segunda revisión.

Flujo principal:

```text
borrador → publicar → publicado
        ↘ enviar a revisión → aprobar → publicado
                            ↘ solicitar cambios → borrador/cambios solicitados
```

Este modelo evita que la revisión se convierta en un cuello de botella para avisos urgentes, pero mantiene una instancia de control editorial disponible cuando el equipo la necesita.

## Gestión de cuentas

Desde el panel, una cuenta de Administración puede crear nuevas cuentas con los siguientes roles:

- **Administración:** control general, gestión de cuentas y administración del boletín.
- **Secretaría:** redacción y publicación.
- **Aprobador:** revisión opcional.

Al crear una cuenta puede indicarse un **cargo visible** opcional, por ejemplo Presidente, Vicepresidente o Encargado de Comunicaciones. Ese cargo no modifica los permisos asociados al rol.

### Clave temporal y primer ingreso

Toda cuenta nueva creada desde el panel recibe una **clave temporal de entre 8 y 128 caracteres**.

La persona debe cambiarla obligatoriamente la primera vez que inicia sesión. Para completar ese proceso debe:

1. ingresar con su correo y clave temporal;
2. introducir nuevamente la clave temporal actual;
3. definir una nueva contraseña de al menos 8 caracteres;
4. confirmar la nueva contraseña;
5. usar una clave distinta de la temporal.

Mientras el cambio esté pendiente, el sistema no permite utilizar las funciones administrativas del panel. La validación se realiza también en el backend, no solo en la interfaz.

Este comportamiento se controla mediante el campo `mustChangePassword` del perfil. Las cuentas existentes antes de incorporar la función no son forzadas automáticamente a cambiar su clave.

## Registro del boletín

Administración dispone de una vista de suscriptores por correo. La interfaz expone únicamente la información necesaria para la gestión:

- correo registrado;
- temas o categorías seleccionadas;
- estado de confirmación;
- fecha de última actualización.

Administración también puede **eliminar una suscripción** directamente desde el panel. La acción elimina el registro del boletín y los trabajos de correo pendientes que todavía no se hayan enviado a esa dirección.

Los tokens de confirmación y baja, las credenciales y los datos técnicos de Web Push no se muestran en el panel.

## Contenido de cada aviso

- Título claro y resumen corto.
- Categoría: clases, evaluaciones, salas, convocatorias o general.
- Contenido completo y fecha relacionada opcional.
- Prioridad normal o importante.
- Fecha de publicación, autor y estado editorial.
- Observación del Aprobador cuando se solicitan cambios.

## Notificaciones

- **Navegador:** cada estudiante autoriza el permiso en su dispositivo y elige temas. La notificación abre el aviso al pulsarla. Requiere HTTPS y claves VAPID.
- **Correo:** cada estudiante elige temas y confirma la dirección mediante un enlace. La demo utiliza Azure Communication Services Email con un dominio administrado por Azure, lo que permite enviar correos reales sin comprar un dominio propio. Cada mensaje incluye un enlace para abrir el aviso y otro para cancelar la suscripción.

Las notificaciones se generan en el momento en que un aviso pasa a estado **publicado**, ya sea mediante publicación directa de Secretaría/Administración o mediante aprobación después de una revisión.

El **25 de octubre de 2026** se validó el flujo completo de correo en producción con una cuenta real `@alumnos.uda.cl`: la cuenta recibió el correo de confirmación de suscripción y, después de publicar un aviso desde el panel, recibió también el correo correspondiente al nuevo aviso.

Para una eventual implementación institucional, el remitente administrado por Azure debería reemplazarse por una dirección autorizada por la Universidad de Atacama.

## Criterios para una primera puesta en marcha

1. La unidad responsable valida nombre, identidad visual, textos legales y dominio.
2. Se designa al menos una cuenta de Administración y una cuenta de Secretaría. El rol Aprobador es recomendable, pero no obligatorio para publicar.
3. Se configuran HTTPS, un servicio de correo autorizado y el contacto para notificaciones del navegador.
4. Las cuentas operativas se crean desde Administración y cada persona reemplaza su clave temporal en el primer ingreso.
5. Se eliminan los avisos de demostración y se publica un aviso real de prueba.
6. Se prueban ambos flujos: publicación directa y publicación después de revisión.
7. Se verifica la recepción de correo, Web Push y el enlace de apertura en un teléfono y un computador.
8. Se define quién mantiene las cuentas, los respaldos, las suscripciones del boletín y la actualización de avisos.

## Estado actual del prototipo

La demo desplegada utiliza:

- **Vercel** para hosting y API serverless.
- **Supabase PostgreSQL** para persistencia.
- **Supabase Auth** para acceso de encargados.
- **Azure Communication Services Email** para confirmaciones de suscripción y avisos por correo.
- **Web Push con VAPID** para notificaciones del navegador.

En el panel ya están operativas:

- creación de cuentas de Administración, Secretaría y Aprobador;
- cargos visibles independientes del rol de seguridad;
- clave temporal de mínimo 8 caracteres;
- cambio obligatorio de contraseña en el primer ingreso;
- consulta y eliminación de suscriptores del boletín;
- publicación directa o revisión opcional de avisos.

Para el correo se configuraron recursos Azure independientes del proyecto TryAI, con un dominio `azurecomm.net` administrado por Azure y autenticado mediante SPF, DKIM y DKIM2. El envío real hacia una cuenta `@alumnos.uda.cl` fue probado satisfactoriamente en producción.

Resend fue utilizado durante una etapa inicial de la demo, pero **ya no forma parte de la arquitectura activa**.

El archivo JSON se mantiene únicamente para desarrollo local. La versión desplegada utiliza Supabase y los servicios cloud configurados para la demo.

## Alcance de la demo

El prototipo permite demostrar de forma autónoma:

```text
Estudiante
   ├── consulta avisos
   ├── filtra por categoría
   ├── se suscribe por correo
   └── activa Web Push

Secretaría
   ├── crea y edita avisos
   ├── publica directamente
   └── envía a revisión de forma opcional

Aprobador
   └── revisa únicamente los avisos enviados a revisión

Administración
   ├── gestiona cuentas
   ├── puede crear otras cuentas administrativas
   ├── utiliza cargos visibles independientes del rol
   ├── exige cambio de clave temporal en cuentas nuevas
   ├── consulta suscriptores del boletín
   ├── elimina suscripciones cuando sea necesario
   └── supervisa el contenido
```

El correo y Web Push permiten que la demostración no dependa de que el desarrollador esté presente durante la presentación.

La publicación como canal institucional oficial requiere validación de la Universidad de Atacama, definición de responsables editoriales, políticas de acceso, tratamiento adecuado de datos personales, un remitente institucional autorizado y continuidad operativa.