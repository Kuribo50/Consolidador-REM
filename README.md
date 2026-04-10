# Consolidador REM

Aplicación para consolidar archivos de datos de salud (CSV/ZIP), aplicando una query seleccionada y generando un archivo final en CSV o Excel.

## Deploy en Coolify (sin Docker Hub)

- Build Pack: `Docker Compose`
- Docker Compose Location: `/docker-compose.coolify.yml`
- No configurar `Docker Image` externo ni registry externo.
- Primer despliegue: modo directo (sin Redis), con:
  - `NODE_ENV=production`
  - `PORT=3000`
  - `HOSTNAME=0.0.0.0`
  - `CONSOLIDAR_QUEUE_MODE=direct`

Redis queda opcional para una segunda etapa.
