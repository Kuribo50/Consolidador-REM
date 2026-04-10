# API y CLI

## Endpoint HTTP

Ruta: `POST /api/consolidar`

Implementación: [`app/api/consolidar/route.ts`](/C:/Users/INFORMATICA%20CAR/Documents/GitHub/Consolidador%202/app/api/consolidar/route.ts)

### Request

`Content-Type: multipart/form-data`

Campos:
- `archivos`: uno o más archivos (`.csv`, `.zip`, `.gz` según el flujo backend)
- `formato`: `csv` | `xlsx` (default: `csv`)
- `tipo`: `auto` | `rm` | `percapita` (default: `auto`)
- `separador`: `auto` | `;` | `,` | `~` (default: `auto`)
- `diccionarioTipo` (opcional): `rm` | `percapita`
- `diccionarioNombre` (opcional): nombre exacto del diccionario

### Respuesta exitosa

`200 OK`

Body: archivo binario (`text/csv` o `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`)

Headers:
- `Content-Type`
- `Content-Disposition: attachment; filename="..."`
- `X-Consolidador-Filas`
- `X-Consolidador-Columnas`
- `X-Consolidador-Archivos`
- `X-Consolidador-Nombre`

### Respuestas de error

- `400`: no se recibieron archivos
- `500`: error del proceso Python / salida no generada
- `504`: timeout del proceso

Formato JSON de error:

```json
{ "error": "mensaje" }
```

## CLI Python

Script: [`backend/consolidar.py`](/C:/Users/INFORMATICA%20CAR/Documents/GitHub/Consolidador%202/backend/consolidar.py)

Ayuda:

```bash
python backend/consolidar.py --help
```

Opciones:
- `--input INPUT` (requerido): carpeta de entrada
- `--output OUTPUT` (requerido): ruta de salida
- `--formato {xlsx,csv}` (default: `csv`)
- `--tipo {rm,percapita,auto}` (default: `auto`)
- `--diccionario-tipo DICCIONARIO_TIPO` (opcional)
- `--diccionario DICCIONARIO_NOMBRE` (opcional)
- `--separador SEPARADOR` (default: `auto`)

### Ejemplos

Auto-detección:

```bash
python backend/consolidar.py \
  --input "D:/Datos/RM-ProduccionCitas/CAR" \
  --output "D:/salidas/consolidado.csv" \
  --formato csv \
  --tipo auto
```

Forzando diccionario:

```bash
python backend/consolidar.py \
  --input "D:/Datos/RM-Atenciones-A01/CAR" \
  --output "D:/salidas/consolidado.xlsx" \
  --formato xlsx \
  --tipo rm \
  --diccionario-tipo rm \
  --diccionario "RM-Atenciones-A01"
```

## Notas operativas

- En Windows, la API intenta ejecutar Python con `py -3`, luego `python`, luego `python3`.
- El timeout del subprocess en la API es de 5 minutos.
- El backend imprime metadata en stderr con prefijo `METADATA::{...}` para que la API la parsee y la exponga en headers.
