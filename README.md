# Consolidador RM — CESFAM Dr. Alberto Reyes

Aplicación web para consolidar extracciones masivas de archivos CSV/ZIP exportados desde **TrakCare** y otros sistemas de información de salud. Combina múltiples archivos en un único dataset limpio, estandarizado y listo para análisis.

Desarrollado para **DISAM Tomé / CESFAM Dr. Alberto Reyes**, Tomé, Chile.

---

## Características principales

- **Consolidación paralela** — lee hasta 8 archivos simultáneamente
- **Detección automática** — detecta separador (`;` `,` `~`), encoding (UTF-8 / Latin-1) y tipo de diccionario desde el nombre del archivo
- **Fuzzy matching** — mapea columnas con nombres similares al canónico (umbral 94%), con caché por esquema
- **Soporte gzip transparente** — los `.zip` de TrakCare son en realidad gzip; se detectan por magic number
- **Salida CSV o Excel** — CSV instantáneo; Excel disponible con advertencia para datasets grandes
- **Interfaz web reactiva** — drag & drop, historial de descargas, notificaciones toast, barra de progreso
- **Motor Polars** — procesamiento en Rust; 50 000 filas × 193 columnas en menos de 1 segundo

---

## Requisitos

| Herramienta | Versión mínima |
|-------------|----------------|
| Node.js     | 18+            |
| Python      | 3.12+          |

---

## Instalación

```bash
# Dependencias Node
npm install

# Dependencias Python
pip install polars xlsxwriter

# Servidor de desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### Producción

```bash
npm run build
npm start
```

> Python debe estar disponible en PATH como `python`, `python3` o `py -3`.

### Cola robusta (recomendado en producción)

La app soporta cola con Redis/BullMQ para controlar concurrencia:

- `XLSX`: 4 simultáneos
- `CSV`: 8 simultáneos
- `Total`: 8 simultáneos

Configuración completa en [docs/PRODUCCION.md](docs/PRODUCCION.md).
Archivos incluidos:

- `.env.example`
- `docker-compose.redis.yml`

---

## Estructura del proyecto

```
Consolidador 2/
├── app/                           # Frontend Next.js (React 19, TypeScript 5)
│   ├── api/consolidar/route.ts    # Endpoint POST — invoca Python, retorna archivo
│   ├── components/toasts.tsx      # Notificaciones React Aria
│   ├── layout.tsx
│   ├── page.tsx                   # UI principal (~1 400 líneas)
│   └── globals.css
│
├── backend/                       # Motor Python + Polars
│   ├── consolidar.py              # CLI principal
│   ├── core/
│   │   ├── dataframe_utils.py     # Mapeo de columnas, fuzzy matching, merge
│   │   ├── io_utils.py            # Lectura CSV / ZIP / gzip con fallback encoding
│   │   ├── logging_utils.py       # Logging estructurado a stderr
│   │   ├── metadata.py            # Emisión de metadatos JSON
│   │   └── selectors.py           # Selección de diccionario
│   └── diccionarios/
│       ├── base.py                # DiccionarioSpec dataclass
│       ├── registry.py            # Registro global
│       ├── rm/                    # Diccionarios RM (3 implementados)
│       └── percapita/             # Diccionarios Percápita (1 implementado)
│
└── docs/                          # Documentación técnica
    ├── ARQUITECTURA.md
    ├── DICCIONARIOS.md
    └── API.md
```

---

## Uso — Interfaz web

1. Seleccionar **diccionario** en el panel lateral (RM o Percápita)
2. **Subir archivos** CSV o ZIP (drag & drop o selector)
3. Elegir **formato** de salida: CSV (recomendado) o Excel
4. Hacer clic en **Consolidar**
5. La descarga inicia automáticamente; una notificación confirma el resultado

El sistema detecta el diccionario automáticamente si el nombre del archivo sigue el patrón `RM-Atenciones-A01_*.csv`.

---

## Uso — CLI

```bash
cd backend

python consolidar.py \
  --input  "/ruta/carpeta/archivos" \
  --output "/ruta/consolidado.csv" \
  --formato csv \
  --tipo    auto
```

### Parámetros

| Parámetro            | Valores                         | Default  | Descripción                                    |
|----------------------|---------------------------------|----------|------------------------------------------------|
| `--input`            | ruta                            | requerid | Carpeta con `.csv` / `.zip`                    |
| `--output`           | ruta                            | requerid | Archivo de salida                              |
| `--formato`          | `csv` \| `xlsx`                 | `csv`    | Formato de salida                              |
| `--tipo`             | `rm` \| `percapita` \| `auto`   | `auto`   | Tipo de datos                                  |
| `--diccionario-tipo` | `rm` \| `percapita`             | —        | Override de tipo                               |
| `--diccionario`      | nombre                          | —        | Ej. `RM-Atenciones-A01`                        |
| `--separador`        | `;` \| `,` \| `~` \| `auto`    | `auto`   | Separador CSV                                  |

---

## Formatos de entrada

| Extensión | Descripción                                                         |
|-----------|---------------------------------------------------------------------|
| `.csv`    | Texto delimitado — auto-detecta `;`, `,`, `~`                       |
| `.zip`    | ZIP estándar con CSVs internos, **o** gzip con extensión `.zip`     |
| `.gz`     | Gzip directo                                                        |

**Encodings:** UTF-8 (con/sin BOM) y Latin-1 (fallback automático).

> Los archivos TrakCare con extensión `.zip` suelen ser gzip. Se detectan por magic number `\x1f\x8b` sin necesidad de configuración.
>
> Si la carpeta contiene tanto archivos `.zip` como `.csv` con los mismos datos, el sistema usa solo los `.csv` para evitar duplicados.

---

## Formatos de salida

| Formato | Velocidad típica | Notas                                       |
|---------|------------------|---------------------------------------------|
| CSV     | < 1 s            | Separador `;`, UTF-8 con BOM, abre en Excel |
| XLSX    | 30 – 90 s        | Recomendado solo para < 100 000 filas       |

Nombre del archivo generado:
```
Consolidado_{Centro}_{Tipo}_{Diccionario}_{Timestamp}.{formato}
```

---

## Diccionarios implementados

### RM

| Nombre               | Columnas core | Descripción                         |
|----------------------|:-------------:|-------------------------------------|
| RM-Atenciones-A01    | 26            | Atenciones del período              |
| RM-ProduccionCitas   | 9             | Citas agendadas (excluye anuladas)  |
| RM-EpisodiosUrgencia | 11            | Episodios de urgencia cerrados      |

### Percápita

| Nombre           | Descripción                            |
|------------------|----------------------------------------|
| Percápita FONASA | Archivo de pago per-cápita FONASA      |

La interfaz muestra más de 120 diccionarios RM en la lista — los no implementados están deshabilitados. Ver [docs/DICCIONARIOS.md](docs/DICCIONARIOS.md) para agregar nuevos.

---

## Rendimiento (datos reales de producción)

| Dataset                  | Archivos | Filas  | Columnas | CSV     | Excel    |
|--------------------------|:--------:|:------:|:--------:|---------|----------|
| RM-Atenciones-A01 / CAR  | 3        | 36 750 | 87       | 0.30 s  | ~20 s    |
| RM-EpisodiosUrgencia     | 3        | 8 052  | 140      | 0.63 s  | ~12 s    |
| RM-ProduccionCitas / CAR | 3        | 48 661 | 193      | 0.56 s  | ~60 s    |

---

## Documentación técnica

| Documento                                  | Contenido                                         |
|--------------------------------------------|---------------------------------------------------|
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Pipeline de datos, diseño backend y frontend     |
| [docs/DICCIONARIOS.md](docs/DICCIONARIOS.md) | Cómo funcionan y cómo agregar nuevos diccionarios|
| [docs/API.md](docs/API.md)                   | Referencia del endpoint REST y la CLI Python     |
| [docs/PRODUCCION.md](docs/PRODUCCION.md)     | Despliegue con Redis + cola robusta              |

---

## Stack tecnológico

**Frontend:** Next.js 16.2 · React 19 · TypeScript 5 · Tailwind CSS 4 · React Aria Components · Lucide React

**Backend:** Python 3.12+ · Polars · XlsxWriter

---

Desarrollado para la salud pública · Tomé, Chile.
