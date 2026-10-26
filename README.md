# Panel Informativo Derecho UDA

Portal de avisos académicos para estudiantes de Derecho de la Universidad de Atacama. Centraliza comunicados, permite filtrar información por categoría y ofrece notificaciones por correo y navegador.

> **Demo académica independiente.** No corresponde a un canal oficial de la Universidad de Atacama.

## Demo

- Portal público: https://portal-informativo-uda.vercel.app
- Panel de encargados: https://portal-informativo-uda.vercel.app/admin

## Funciones principales

- Avisos de clases, evaluaciones, salas, convocatorias y temas generales.
- Publicación directa o revisión opcional antes de publicar.
- Suscripciones por correo según categorías de interés.
- Notificaciones Web Push.
- Gestión de cuentas y roles desde el panel.
- Cargos visibles independientes del rol, por ejemplo **Presidente** o **Vicepresidente**.
- Cambio obligatorio de contraseña en el primer ingreso para cuentas nuevas.
- Consulta y eliminación de suscriptores del boletín por parte de Administración.

## Roles

- **Administración:** gestiona cuentas, avisos y suscriptores del boletín.
- **Secretaría:** redacta, edita y publica avisos.
- **Aprobador:** revisa únicamente los avisos enviados voluntariamente a revisión.

La aprobación es opcional: Secretaría puede publicar directamente cuando la información está confirmada.

## Tecnologías

- **Vercel** — hosting y API.
- **Supabase PostgreSQL** — persistencia.
- **Supabase Auth** — autenticación de encargados.
- **Azure Communication Services Email** — confirmaciones y avisos por correo.
- **Web Push + VAPID** — notificaciones del navegador.
- **JavaScript / Node.js** — aplicación y backend.

## Arquitectura

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
 │                ├── Azure Email
 │                └── Web Push
 │
 └── Avisos publicados
```

## Seguridad de cuentas

Las cuentas nuevas creadas desde el panel utilizan una clave temporal de **8 a 128 caracteres**. En el primer ingreso, la persona debe reemplazarla por una contraseña nueva antes de acceder al panel administrativo.

Las credenciales, claves privadas y variables de entorno no se almacenan en el repositorio.

## Desarrollo local

Requiere Node.js 22 o posterior.

```bash
npm install
npm run setup
npm start
```

Portal local: `http://localhost:3000`

Panel local: `http://localhost:3000/admin`

La versión local puede utilizar almacenamiento JSON. La demo desplegada en Vercel utiliza Supabase y los servicios cloud configurados para producción.

## Documentación

- [PROYECTO.md](PROYECTO.md) — propuesta, alcance funcional, roles y experiencia de uso.
- [DEPLOYMENT.md](DEPLOYMENT.md) — arquitectura cloud, Supabase, Azure, seguridad, variables y pruebas de despliegue.

## Estado del prototipo

La demo se encuentra desplegada y funcional. Se han validado en producción:

- autenticación y roles;
- publicación de avisos;
- correo real hacia cuentas `@alumnos.uda.cl`;
- Web Push;
- gestión de suscriptores;
- creación de cuentas administrativas;
- cambio obligatorio de contraseña en primer ingreso.

Repositorio: https://github.com/Ad0niz/portal-informativo-uda
