# Propuesta: Panel Informativo de Derecho UDA

## Objetivo

Reemplazar el flujo de consulta del blog actual por un portal de avisos académicos fácil de usar desde el teléfono. La prioridad es encontrar información reciente y recibir alertas sobre cambios relevantes, sin convertir el portal en una página de presentación institucional.

## Personas y permisos

| Rol | Puede hacer |
| --- | --- |
| Estudiante | Buscar, filtrar, leer, compartir y suscribirse por tema. |
| Redactor | Crear borradores y enviarlos a revisión. |
| Aprobador | Revisar avisos de otra persona, devolverlos con un motivo, publicarlos o archivarlos. |
| Administración | Crear cuentas y supervisar el contenido. |

Un aviso sigue el flujo **borrador → en revisión → publicado**. Si se devuelve, vuelve a borrador luego de corregirse. Solo la aprobación publica el aviso y dispara las alertas.

## Contenido de cada aviso

- Título claro y resumen corto.
- Categoría: clases, evaluaciones, salas, convocatorias o general.
- Contenido completo y fecha relacionada opcional.
- Prioridad normal o importante.
- Fecha de publicación, autor y estado editorial.

## Notificaciones

- **Navegador:** cada estudiante autoriza el permiso en su dispositivo y elige temas. La notificación abre el aviso al pulsarla. Requiere HTTPS y claves VAPID.
- **Correo:** cada estudiante elige temas y confirma la dirección por correo. Cada mensaje incluye un enlace para cancelar la suscripción. Requiere un dominio y un proveedor de envío configurado.

## Criterios para una primera puesta en marcha

1. La unidad responsable valida nombre, identidad visual, textos legales y dominio.
2. Se designan al menos una persona redactora y una aprobadora distintas.
3. Se configuran HTTPS, correo remitente y contacto para notificaciones del navegador.
4. Se eliminan los tres avisos de demostración y se publica un aviso real de prueba.
5. Se verifica la recepción y el enlace de apertura en un teléfono y un computador.
6. Se define quién mantiene las cuentas, la copia de seguridad y la actualización de avisos.

Esta implementación es un MVP local. Para operación institucional continua se recomienda sustituir el archivo JSON por una base de datos, integrar el acceso institucional y definir respaldo y auditoría.
