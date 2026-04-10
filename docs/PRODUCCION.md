# Producción — Cola robusta con Redis

Esta guía deja el consolidado listo para operar con cola de trabajos y límites de concurrencia:

- XLSX: `4`
- CSV: `8`
- Total simultáneo: `8`

## 1) Variables de entorno

Copiar `.env.example` a `.env` y ajustar:

```bash
cp .env.example .env
```

Para activar cola robusta:

```env
CONSOLIDAR_QUEUE_MODE=redis
REDIS_URL=redis://127.0.0.1:6379
CONSOLIDAR_MAX_XLSX=4
CONSOLIDAR_MAX_CSV=8
CONSOLIDAR_MAX_TOTAL=8
CONSOLIDAR_JOB_WAIT_TIMEOUT_MS=900000
```

## 2) Levantar Redis

Con Docker Compose:

```bash
docker compose -f docker-compose.redis.yml up -d
```

Validar:

```bash
docker ps
docker exec -it consolidador-redis redis-cli ping
```

Debe responder: `PONG`.

## 3) Build y arranque de la app

```bash
npm install
npm run build
npm start
```

## 4) Verificar modo de ejecución

El endpoint `/api/consolidar` incluye headers:

- `X-Consolidador-Queue-Mode`: `redis` o `direct`
- `X-Consolidador-Queue-Wait-Ms`: tiempo esperando cupo en cola (ms)

Si está en `direct`, revisa:

1. `CONSOLIDAR_QUEUE_MODE=redis`
2. Redis accesible en `REDIS_URL`

## 5) Recomendaciones operativas

- Si hay alta demanda de Excel:
  - bajar `CONSOLIDAR_MAX_XLSX` a 3
- Si hay más CPU disponible:
  - subir `CONSOLIDAR_MAX_TOTAL` de 8 a 10
- Mantener `CSV` como formato recomendado en UI.

## 6) Fallback de seguridad

Si Redis falla, el backend hace fallback a ejecución directa para no detener el servicio.
Esto evita caída total, pero sin cola.

## 7) Smoke test rápido

Con la app en marcha:

```bash
node scripts/stress-consolidar.mjs
```

Para test XLSX:

```bash
# PowerShell
$env:CONSOLIDAR_FORMATO='xlsx'
$env:CONSOLIDAR_LADDER='1,2,3'
node scripts/stress-consolidar.mjs
```

Reporte: `stress-report.json`.
