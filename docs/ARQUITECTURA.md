# Arquitectura del sistema

## Diagrama general

```
Usuario (navegador)
       │
       │  multipart/form-data (archivos CSV/ZIP)
       ▼
┌─────────────────────────────┐
│   Next.js App Router        │
│   /api/consolidar           │
│                             │
│  1. Guarda archivos en /tmp │
│  2. Invoca Python           │
│  3. Lee resultado binario   │
│  4. Retorna blob + headers  │
└────────────┬────────────────┘
             │  subprocess (CLI)
             ▼
┌─────────────────────────────┐
│   consolidar.py (Python)    │
│                             │
│  ThreadPoolExecutor (×8)    │
│    └─ io_utils              │  ← lee CSV/ZIP/gzip
│    └─ dataframe_utils       │  ← normaliza columnas
│                             │
│  pl.concat()                │  ← Polars (Rust)
│  merge_duplicate_columns()  │
│  write_csv() / write_excel()│
│                             │
│  stderr → METADATA::{}      │  ← capturado por Node
└─────────────────────────────┘
```

---

## Backend Python

### Pipeline de consolidación (`consolidar.py`)

Cada vez que se ejecuta el script sigue estos pasos en orden:

```
1. Descubrimiento de archivos
   carpeta.glob("*.zip") + carpeta.glob("*.csv")
   → si hay ambos en la misma carpeta: usar solo los .csv
     (los .zip de TrakCare son copias gzip del mismo dato)

2. Selección de diccionario
   → auto-detección desde nombre de archivo (regex RM-[^._]+)
   → fallback a spec no-op (acepta cualquier estructura)

3. Lectura paralela (ThreadPoolExecutor, max_workers=8)
   Por cada archivo:
     a. procesar_archivo() → bytes
     b. leer_csv_bytes()   → pl.DataFrame (infer_schema_length=0 → todo String)
     c. apply_diccionario_spec() → renombra columnas, fuzzy match, genera reporte
   Resultado: lista de DataFrames ya normalizados

4. Concatenación
   → Si todos tienen el mismo esquema: pl.concat(how="vertical")  [rápido]
   → Si hay diferencias de esquema:   pl.concat(how="diagonal")   [flexible]
   → merge_duplicate_columns() para fusionar columnas con mismo nombre normalizado

5. Reordenamiento
   → orden_columnas del diccionario
   → columnas extra al final

6. Exportación
   → CSV:  write_csv(separator=";", include_bom=True)
   → XLSX: write_excel(worksheet="Consolidado")
   → Si >500 000 celdas: [WARN] en stderr

7. Metadata
   → stderr: METADATA::{"filas": N, "columnas": M, "archivos": K, "nombre": "..."}
```

### Módulo `io_utils.py` — Lectura robusta

```
procesar_archivo(ruta)
  ├─ .zip → ¿magic number \x1f\x8b?
  │    ├─ sí → gzip.open() → leer_csv_bytes()
  │    └─ no → zipfile.ZipFile() → por cada .csv interno → leer_csv_bytes()
  ├─ .gz  → gzip.open() → leer_csv_bytes()
  └─ .csv → ruta.read_bytes() → leer_csv_bytes()

leer_csv_bytes(bytes, nombre)
  ├─ Detectar separador (primera línea: ~, ;, o ,)
  ├─ pl.read_csv(encoding="utf-8-sig", infer_schema_length=0,
  │              ignore_errors=True, truncate_ragged_lines=True)
  ├─ Si falla UTF-8 → pl.read_csv(encoding="latin-1", ...)
  ├─ df.rename({c: c.strip()})          ← limpiar espacios en headers
  ├─ df.select(pl.all().exclude("_archivo_origen"))  ← evitar duplicado
  └─ df.insert_column(0, pl.lit(nombre))             ← columna de origen
```

### Módulo `dataframe_utils.py` — Mapeo de columnas

```
apply_diccionario_spec(df, spec)
  │
  ├─ ¿cache_key en _MAPPING_CACHE?
  │    └─ sí → reutilizar mapping (evita fuzzy matching repetitivo)
  │
  └─ no → computar mapping:
       Para cada columna del df:
         1. ¿está en alias_map?       → usar nombre canónico (alias exacto)
         2. ¿está en canonical_map?   → usar nombre canónico (normalización)
         3. fuzzy match sobre restantes (threshold=0.94, difflib.SequenceMatcher)
            → acepta si score ≥ 0.94 y diferencia con 2.° candidato > 0.02
         4. si nada → mantener nombre original
       
       Validación:
         core_encontradas / core_total ≥ min_required_match (default 0.6)
         → si no: retornar None (archivo descartado)
       
       Guardar en _MAPPING_CACHE[cache_key]

merge_duplicate_columns(df)
  ├─ Renombrar columnas duplicadas físicamente: col → col__dupe_N
  ├─ Agrupar por normalize_column_name(col)
  └─ Por cada grupo con >1 columna: pl.coalesce(cols) → primer no-nulo
```

### Diccionarios (`DiccionarioSpec`)

Cada diccionario es un dataclass `frozen` que define:

```python
DiccionarioSpec(
    id                    = "rm_atenciones_a01",
    nombre                = "RM-Atenciones-A01",
    tipo                  = "rm",
    required_core_columns = ["HOSP_Code", "NombreEstablecimiento", ...],  # 26 cols
    recommended_columns   = ["TipoEpisodio", "ProgramaSalud", ...],       # 8 cols
    optional_patterns     = ["_Desc", "Madre", "Lactancia"],
    known_aliases         = {"IdAtencion": "IdAtención", ...},
    orden_columnas        = [...],    # orden final de columnas en el output
    allow_extra_columns   = True,     # conservar columnas no reconocidas
    min_required_match    = 0.6,      # mínimo 60% de core columns
    crear_columnas_faltantes = True,  # crear vacías si faltan core columns
)
```

El registro global (`registry.py`) mapea `(tipo, nombre)` → `DiccionarioSpec`.

---

## Frontend Next.js

### Flujo de consolidación (cliente)

```
Usuario sube archivos
       │
       ▼
consolidar() — XHR con progreso
  │
  ├─ upload.onprogress → faseProgreso="subiendo", pctProgreso=N%
  ├─ upload.onload     → faseProgreso="procesando"
  ├─ onprogress        → faseProgreso="descargando"  (si readyState≥3)
  └─ onload            → resolve({blob, headers, ms})
       │
       ▼
setResultados([nuevoResultado, ...prev])
addToast({title: "Consolidación completada", ...})
descargarResultado(resultado)  → URL.createObjectURL(blob)
```

### Estimación de progreso

La barra de progreso usa una heurística basada en formato y tamaño:

```typescript
segsEstimadosTotal =
  formato === "csv"
    ? max(2,  totalMB * 0.015 + nArchivos * 0.1)   // ~instantáneo
    : max(8,  totalMB * 1.4   + nArchivos * 0.5)   // ~1.4 s/MB para xlsx

progresoGlobal =
  "subiendo"    → 0%  – 20%  (proporcional a bytes enviados)
  "procesando"  → 20% – 90%  (proporcional a segundosTranscurridos / segsEstimados)
  "descargando" → 90% – 99%
```

ETA solo se muestra para formato Excel (CSV es tan rápido que no tiene sentido).

### Sistema de toasts (React Aria)

```typescript
// Singleton global — importable desde cualquier módulo cliente
export const toastQueue = new UNSTABLE_ToastQueue<ToastContent>({ maxVisibleToasts: 4 });

// Llamado desde consolidar() en page.tsx
addToast({ title: "Consolidación completada", description: "48 661 filas · ...", variant: "success" });

// Renderizado en layout.tsx (fuera del árbol de page.tsx)
<AppToastRegion />   // esquina inferior derecha, auto-dismiss 6 s
```

### API Route (`/api/consolidar`)

```
POST /api/consolidar
Content-Type: multipart/form-data

Pasos internos:
  1. Crear directorio temporal en os.tmpdir()
  2. Escribir archivos subidos a disco
  3. Detectar ejecutable Python (py -3 / python / python3)
  4. Invocar consolidar.py como subprocess con timeout 5 min
  5. Parsear METADATA:: de stderr
  6. Leer archivo de output como Buffer
  7. Retornar NextResponse con blob + headers custom
  8. Limpiar directorio temporal

Headers de respuesta:
  X-Consolidador-Filas     → número de filas
  X-Consolidador-Columnas  → número de columnas
  X-Consolidador-Archivos  → archivos procesados
  X-Consolidador-Nombre    → nombre sugerido del archivo
  Content-Disposition      → attachment; filename="..."
```

---

## Limitaciones conocidas

| Limitación | Causa | Workaround |
|---|---|---|
| Excel lento (30–90 s para datasets grandes) | XlsxWriter escribe celda a celda, sin paralelismo | Usar CSV para datasets grandes |
| ZIP con doble datos | TrakCare genera `.zip` (gzip) y `.csv` con el mismo contenido | El sistema elige automáticamente el `.csv` |
| Encoding silencioso | Fallback UTF-8 → Latin-1 sin notificación visual | Revisar logs si hay caracteres incorrectos |
| ThreadPoolExecutor y GIL | `zipfile` retiene el GIL durante descompresión; no hay paralelismo real en ZIPs | No aplica para archivos CSV |
| 60% de core columns requerido | Archivos que no coinciden bien se descartan | Revisar columnas o ajustar `min_required_match` en el diccionario |
