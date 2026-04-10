# Despliegue en Coolify (Docker)

## Opción A — Servicio Dockerfile (recomendada)

1. En Coolify crea un **New Resource > Application**.
2. Fuente: tu repo.
3. Build Pack: **Dockerfile**.
4. Dockerfile path: `./Dockerfile`.
5. Puerto: `3000`.

### Variables de entorno sugeridas

```env
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

CONSOLIDAR_QUEUE_MODE=redis
REDIS_URL=redis://<tu-redis-host>:6379
CONSOLIDAR_MAX_XLSX=4
CONSOLIDAR_MAX_CSV=8
CONSOLIDAR_MAX_TOTAL=8
CONSOLIDAR_JOB_WAIT_TIMEOUT_MS=900000
```

Si aún no tienes Redis, puedes arrancar con:

```env
CONSOLIDAR_QUEUE_MODE=direct
```

## Opción B — Docker Compose (app + redis)

Puedes desplegar usando `docker-compose.yml` del repo.

- Servicio `app`: Next.js + Python (Polars)
- Servicio `redis`: cola BullMQ

## Verificación post-deploy

1. Abrir app y ejecutar una consolidación CSV.
2. Ejecutar una XLSX.
3. Revisar headers de respuesta API:
   - `X-Consolidador-Queue-Mode`
   - `X-Consolidador-Queue-Wait-Ms`

Si `Queue-Mode` sale `direct`, revisa `CONSOLIDAR_QUEUE_MODE` y `REDIS_URL`.

## Healthcheck

- Endpoint: `GET /api/health`
- Respuesta esperada: `200` con `{ ok: true, ... }`

El `Dockerfile` y `docker-compose.yml` ya incluyen `HEALTHCHECK` apuntando a ese endpoint.
