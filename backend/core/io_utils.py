import gzip
import zipfile
from pathlib import Path
from typing import Optional, List
import polars as pl
from .logging_utils import log_error, log_info

def leer_csv_bytes(contenido: bytes, nombre_origen: str, sep_override: Optional[str] = None) -> Optional[pl.DataFrame]:
    """
    Lee CSV desde bytes usando Polars con fallback de encoding (UTF-8 -> Latin-1).
    Todas las columnas se leen como String para evitar conflictos de schema entre archivos.
    """
    try:
        # 1. Determinar separador
        separator = sep_override
        if separator == "auto" or separator is None:
            primera_linea = contenido.decode("utf-8-sig", errors="ignore").split("\n")[0]
            if "~" in primera_linea:
                separator = "~"
            elif ";" in primera_linea:
                separator = ";"
            elif "," in primera_linea:
                separator = ","
            else:
                separator = None  # Dejar que Polars adivine

        # Opciones comunes: infer_schema_length=0 lee todo como Utf8 (sin doble pasada de 5000 filas),
        # ignore_errors=True maneja filas con columnas ragged o valores inesperados,
        # truncate_ragged_lines=True evita crash por filas con menos columnas que el header.
        read_opts = dict(
            separator=separator if separator else ",",
            infer_schema_length=0,
            ignore_errors=True,
            truncate_ragged_lines=True,
        )

        # 2. Intentar leer con UTF-8-SIG
        try:
            df = pl.read_csv(contenido, encoding="utf-8-sig", **read_opts)
        except Exception as e_utf8:
            # 3. Fallback a Latin-1 para archivos de sistemas legados con tildes
            if "codec can't decode" in str(e_utf8) or "invalid utf-8" in str(e_utf8).lower():
                log_info(f"Fallo UTF-8 en {nombre_origen}, intentando Latin-1...")
                df = pl.read_csv(contenido, encoding="latin-1", **read_opts)
            else:
                raise e_utf8

        if df.is_empty():
            return None

        # Limpiar espacios en nombres de columnas
        df = df.rename({c: c.strip() for c in df.columns})

        # Asegurar que _archivo_origen no exista previamente para evitar duplicados
        if "_archivo_origen" in df.columns:
            df = df.select(pl.all().exclude("_archivo_origen"))

        # Insertar columna de origen al principio
        df = df.insert_column(0, pl.lit(nombre_origen).alias("_archivo_origen"))

        return df
    except Exception as e:
        log_error(f"Error leyendo {nombre_origen} con Polars: {e}")
        return None


def _es_gzip(ruta: Path) -> bool:
    """Detecta si un archivo es gzip por su magic number (1f 8b), sin importar la extensión."""
    try:
        with open(ruta, "rb") as f:
            return f.read(2) == b"\x1f\x8b"
    except Exception:
        return False


def procesar_archivo(ruta: Path, sep_override: Optional[str] = None) -> List[pl.DataFrame]:
    """
    Procesa un archivo (CSV, ZIP estándar, o gzip/.gz) y devuelve una lista de DataFrames.
    Muchos archivos exportados por TrakCare tienen extensión .zip pero son en realidad gzip.
    """
    resultados: List[pl.DataFrame] = []
    suf = ruta.suffix.lower()

    if suf == ".zip":
        # Detectar formato real por magic number antes de intentar abrirlo
        if _es_gzip(ruta):
            # Archivo gzip con extensión .zip (común en exportaciones de TrakCare)
            try:
                with gzip.open(ruta, "rb") as f:
                    contenido = f.read()
                origen = ruta.name
                df = leer_csv_bytes(contenido, origen, sep_override=sep_override)
                if df is not None and not df.is_empty():
                    resultados.append(df)
            except Exception as e:
                log_error(f"Error leyendo gzip {ruta.name}: {e}")
        else:
            # ZIP estándar: puede contener múltiples CSVs internos
            try:
                with zipfile.ZipFile(ruta, "r") as zf:
                    csvs = [n for n in zf.namelist() if n.lower().endswith(".csv")]
                    for nombre_csv in csvs:
                        with zf.open(nombre_csv) as f:
                            contenido = f.read()
                        origen = f"{ruta.name}::{nombre_csv}"
                        df = leer_csv_bytes(contenido, origen, sep_override=sep_override)
                        if df is not None and not df.is_empty():
                            resultados.append(df)
            except zipfile.BadZipFile:
                log_error(f"ZIP corrupto o formato desconocido: {ruta.name}")
        return resultados

    if suf in (".gz",):
        try:
            with gzip.open(ruta, "rb") as f:
                contenido = f.read()
            df = leer_csv_bytes(contenido, ruta.name, sep_override=sep_override)
            if df is not None and not df.is_empty():
                resultados.append(df)
        except Exception as e:
            log_error(f"Error leyendo gzip {ruta.name}: {e}")
        return resultados

    if suf == ".csv":
        contenido = ruta.read_bytes()
        df = leer_csv_bytes(contenido, ruta.name, sep_override=sep_override)
        if df is not None and not df.is_empty():
            resultados.append(df)
        return resultados

    return resultados
