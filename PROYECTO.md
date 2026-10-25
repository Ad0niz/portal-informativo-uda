# Propuesta: Panel Informativo de Derecho UDA

## Objetivo

Reemplazar el flujo de consulta del blog actual por un portal de avisos académicos fácil de usar desde el teléfono. La prioridad es encontrar información reciente y recibir alertas sobre cambios relevantes, sin convertir el portal en una página de presentación institucional.

## Personas y permisos

| Rol | Puede hacer |
| --- | --- |
| Estudiante | Buscar, filtrar, leer, compartir y suscribirse por tema. |
| Secretaría | Crear y editar avisos, guardar borradores, publicar directamente, enviar a revisión cuando sea necesario, archivar avisos y eliminar borradores propios. |
| Aprobador | Revisar únicamente los avisos enviados voluntariamente a revisión, aprobarlos y publicarlos o solicitar cambios con una observación. |
| Administración | Gestionar cuentas, supervisar contenido y actuar sobre avisos cuando sea necesario. |

La aprobación no es obligatoria. Secretaría puede publicar directamente cuando la información está confirmada o necesita salir con rapidez. Si existen dudas sobre el contenido, datos o redacción, puede solicitar una segunda revisión.

Flujo principal:

```text
borrador → publicar → publicado
        ↘ enviar a revisión → aprobar → publicado
                            ↘ solicitar cambios → borrador/cambios solicitados
```

Este modelo evita que la revisión se convierta en un cuello de botella para avisos urgentes, pero mantiene una instancia de control editorial disponible cuando el equipo la necesita.

## Contenido de cada aviso

- Título claro y resumen corto.
- Categoría: clases, evaluaciones, salas, convocatorias o general.
- Contenido completo y fecha relacionada opcional.
- Prioridad normal o importante.
- Fecha de publicación, autor y estado editorial.
- Observación del Aprobador cuando se solicitan cambios.

## Notificaciones

- **Navegador:** cada estudiante autoriza el permiso en su dispositivo y elige temas. La notificación abre el aviso al pulsarla. Requiere HTTPS y claves VAPID.
- **Correo:** cada estudiante elige temas y confirma la dirección mediante un enlace. La demo utiliza Azure Communication Services Email con un dominio administrado por Azure, lo que permite enviar correos reales sin comprar un dominio propio. Cada mensaje incluye un enlace para cancelar la suscripción.

Las notificaciones se generan en el momento en que un aviso pasa a estado **publicado**, ya sea mediante publicación directa de Secretaría/Administración o mediante aprobación después de una revisión.

Para una eventual implementación institucional, el remitente administrado por Azure debería reemplazarse por una dirección autorizada por la Universidad de Atacama.

## Criterios para una primera puesta en marcha

1. La unidad responsable valida nombre, identidad visual, textos legales y dominio.
2. Se designa al menos una cuenta de Administración y una cuenta de Secretaría. El rol Aprobador es recomendable, pero no obligatorio para publicar.
3. Se configuran HTTPS, un servicio de correo autorizado y el contacto para notificaciones del navegador.
4. Se eliminan los avisos de demostración y se publica un aviso real de prueba.
5. Se prueban ambos flujos: publicación directa y publicación después de revisión.
6. Se verifica la recepción de correo, Web Push y el enlace de apertura en un teléfono y un computador.
7. Se define quién mantiene las cuentas, los respaldos y la actualización de avisos.

## Estado actual del prototipo

La demo desplegada utiliza Vercel, Supabase PostgreSQL, Supabase Auth, Azure Communication Services Email y Web Push. Para correo se configuraron recursos Azure independientes del proyecto TryAI, con un dominio `azurecomm.net` administrado por Azure y autenticado mediante SPF/DKIM. El archivo JSON se mantiene únicamente para desarrollo local.

La publicación como canal institucional oficial requiere validación de la Universidad de Atacama, definición de responsables editoriales, políticas de acceso, un remitente institucional autorizado y continuidad operativa.