# Guía de Diccionarios

Los **diccionarios** definen cómo el consolidador interpreta y estandariza las columnas de cada tipo de exportación. Cada diccionario especifica qué columnas se esperan, qué aliases son válidos y en qué orden debe aparecer el resultado.

---

## Cómo funcionan

### 1. Detección automática

Cuando se procesa un archivo como `RM-Atenciones-A01_202601_CESFAM_.csv`, el sistema extrae el token `RM-Atenciones-A01` del nombre y lo busca en el registro. Si hay coincidencia, aplica ese diccionario automáticamente.

El patrón de detección (en `consolidar.py`):
```python
re.search(r"(RM-[^._]+?)(?:_|\.(?:csv|zip)|$)", filename)
```

### 2. Mapeo de columnas

Para cada columna del archivo de entrada, el sistema aplica este orden de prioridad:

```
1. Alias exacto    → known_aliases["IdAtencion"] = "IdAtención"
2. Normalización   → "id_atencion" == normalize("IdAtención")
3. Fuzzy match     → difflib.SequenceMatcher ≥ 0.94 de similitud
4. Nombre original → si nada coincide, se conserva tal cual
```

La normalización convierte a minúsculas, elimina tildes, espacios y caracteres no alfanuméricos antes de comparar.

### 3. Validación

Un archivo es descartado si encuentra menos del `min_required_match` (por defecto 60%) de las columnas core:

```
core_encontradas / core_total < 0.6  →  archivo descartado + error en log
```

### 4. Columnas faltantes

Si `crear_columnas_faltantes=True` (el default), las columnas core no encontradas se crean como columnas vacías (`""`). Esto asegura que todos los archivos de un mismo tipo puedan concatenarse verticalmente.

### 5. Caché de mapeo

El resultado del fuzzy matching se guarda en `_MAPPING_CACHE` indexado por la tupla de columnas de entrada. Archivos con el mismo esquema (mismo set de columnas) reutilizan el mapeo sin recalcular.

---

## Diccionarios implementados

### RM-Atenciones-A01

**Archivo:** `backend/diccionarios/rm/rm_atenciones_a01.py`

**Descripción:** Atenciones (prestaciones) del período de análisis.

**Columnas core (26):**
```
HOSP_Code, NombreEstablecimiento, NombreLocal, NumeroEpisodio, EstadoEpisodio,
Prevision, PlanSalud, IdAtención, EstadoAtencion, IDPaciente, RutPaciente,
FechaNacimiento, SexoPaciente, FechaAtencion, CodigoPrestacion, GlosaEstudio,
NombrePrestacion, Profesional, RUTProfesional, CodigoServicio, NombreServicio,
FechaIngreso, HoraIngreso, FechaSalida, HoraSalida, DuracionAtencion
```

**Aliases conocidos:**
```python
"IdAtencion"    → "IdAtención"
"IDAtencion"    → "IdAtención"
"Id_Atencion"   → "IdAtención"
"NroEpisodio"   → "NumeroEpisodio"
"Nro_Episodio"  → "NumeroEpisodio"
```

---

### RM-ProduccionCitas

**Archivo:** `backend/diccionarios/rm/rm_produccion_citas.py`

**Descripción:** Citas agendadas del período (excluye anuladas).

**Columnas core (9):**
```
HOSP_Code, NombreEstablecimiento, NombreLocal,
TipoProfesionalAten, RUNProfesional, NombreProfesional,
NroEpisodio, PlanSalud, Prevision
```

**Alias:**
```python
"NumeroEpisodio" → "NroEpisodio"
```

---

### RM-EpisodiosUrgencia

**Archivo:** `backend/diccionarios/rm/rm_episodios_urgencia.py`

**Descripción:** Episodios de urgencia cerrados del período.

**Columnas core (11):**
```
HOSP_Code, NombreEstablecimiento, NombreLocal,
NumerodeEpisodio, FechaEpisodio, HoraEpisodio, EstadoEpisodio,
PrevisionEpisodio, PlanSaludEpisodio, FechaAtencion, HoraAtencion
```

**Aliases:**
```python
"NumeroEpisodio"  → "NumerodeEpisodio"
"FechaAltaMedica" → "FechaAltaMédica"
"HoraAltaMedica"  → "HoraAltaMédica"
```

---

### Percápita FONASA

**Archivo:** `backend/diccionarios/percapita/percapita_fonasa.py`

**Descripción:** Archivo de pago per-cápita FONASA. Acepta cualquier estructura de columnas (sin core obligatorio). Útil para consolidaciones flexibles de datos de cobertura/pago.

---

## Agregar un nuevo diccionario

### 1. Crear el archivo de especificación

```python
# backend/diccionarios/rm/rm_nuevo_tipo.py

from ..base import DiccionarioSpec
from ..registry import register

spec = DiccionarioSpec(
    id="rm_nuevo_tipo",
    nombre="RM-NuevoTipo",
    tipo="rm",
    descripcion="Descripción del nuevo tipo de extracción",

    required_core_columns=[
        "HOSP_Code",
        "NombreEstablecimiento",
        "FechaAtencion",
        # ... columnas que DEBEN estar presentes
    ],

    recommended_columns=[
        "NombreProfesional",
        # ... columnas deseables pero no obligatorias
    ],

    optional_patterns=[
        "_Desc",     # columnas que terminan en _Desc se conservan como "extra"
        "Codigo",
    ],

    known_aliases={
        "FecAtencion": "FechaAtencion",   # alias → nombre canónico
        "Hosp_Code":   "HOSP_Code",
    },

    orden_columnas=[
        "HOSP_Code",
        "NombreEstablecimiento",
        "FechaAtencion",
        # ... orden deseado en el output; columnas no listadas van al final
    ],

    allow_extra_columns=True,      # conservar columnas no reconocidas
    min_required_match=0.6,        # rechazar archivo si < 60% de core encontrado
    crear_columnas_faltantes=True, # crear vacías para core faltantes
)

register(spec)
```

### 2. Importar en el `__init__.py` del módulo

```python
# backend/diccionarios/rm/__init__.py
from . import rm_atenciones_a01      # ya existe
from . import rm_produccion_citas    # ya existe
from . import rm_episodios_urgencia  # ya existe
from . import rm_nuevo_tipo          # agregar esta línea
```

### 3. Agregar a la lista del frontend (opcional)

En `app/page.tsx`, buscar `DICCIONARIOS_RM` y agregar el nombre:

```typescript
const DICCIONARIOS_RM = [
  // ... lista existente ...
  "RM-NuevoTipo",   // agregar aquí
];
```

Y marcarlo como implementado:

```typescript
const DICCIONARIOS_IMPLEMENTADOS_RM = new Set([
  "RM-Atenciones-A01",
  "RM-ProduccionCitas",
  "RM-EpisodiosUrgencia",
  "RM-NuevoTipo",   // agregar aquí
]);
```

### 4. Verificar

```bash
cd backend
python consolidar.py \
  --input  "/ruta/archivos/rm-nuevotipo" \
  --output "/tmp/test.csv" \
  --diccionario-tipo rm \
  --diccionario "RM-NuevoTipo"
```

El log mostrará cuántas columnas core se encontraron y cuáles fueron renombradas.

---

## Diccionarios disponibles en la interfaz (no implementados)

La lista completa que aparece en la UI pero que aún no tiene especificación backend incluye, entre otros:

```
Censo Diario · Estimacion Riesgo Ulceracion Del Pie 2
Historico de Pacientes · Libro de Partos
REGE-AtencionesIRAERA · REGE-EnfermedadesNotificaciónObligatoria
RM-AgendaPabellon · RM-ApoyoPsicosocialHospitalizado
RM-Atenciones-A03 al A32 · RM-AtencionesEvaluaciones-*
RM-AtencionOdontologica · RM-CensoMensual · RM-CoberturaCAMujer
RM-DatosAdminMensual-* (30+ variantes) · RM-DEISUrgencia
RM-ExamenMedicinaPreventiva · RM-FamiliasBajoControl-P7
RM-HospitalizacionDiurna · RM-ListaEspera · RM-Maternidad
RM-NotificaciónRAM-A04 · RM-PoblacionBajoControl-P* (9 variantes)
RM-Prestaciones · RM-ProduccionFarmacia · RM-ProduccionRescates
RM-ProtocoloOperatorio · RM-SolicitudesHospitalizacion · RM-StockPNACPACAM
```

Para agregar cualquiera de estos, seguir los pasos de la sección anterior. La interfaz los activará automáticamente una vez registrados.

---

## Referencia: `DiccionarioSpec`

```python
@dataclass(frozen=True)
class DiccionarioSpec:
    id: str                            # Identificador único interno
    nombre: str                        # Nombre mostrado en la UI
    tipo: str                          # "rm" o "percapita"
    descripcion: str                   # Descripción human-readable

    required_core_columns: List[str]   # Columnas obligatorias
    recommended_columns: List[str]     # Columnas deseables
    optional_patterns: List[str]       # Patrones para columnas extra a conservar
    known_aliases: Dict[str, str]      # {alias: canónico}
    orden_columnas: List[str]          # Orden del output

    allow_extra_columns: bool          # Default: True
    min_required_match: float          # Default: 0.6  (0.0 – 1.0)
    crear_columnas_faltantes: bool     # Default: True
```
