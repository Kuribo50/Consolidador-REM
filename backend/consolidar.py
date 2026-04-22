#!/usr/bin/env python3
"""
Consolidador RM + Percápita — CESFAM Dr. Alberto Reyes / DISAM Tomé (Edición Polars)
"""

import argparse
import os
import time
import re
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

import polars as pl

import diccionarios.percapita  # noqa: F401
import diccionarios.rm  # noqa: F401
from diccionarios.registry import get_diccionario
from core.dataframe_utils import apply_diccionario_spec, merge_duplicate_columns
from core.logging_utils import log_error, log_info, log_warn
from core.metadata import Metadata, emit_metadata
from core.selectors import SelectorInput, select_diccionario
from core.io_utils import procesar_archivo

CENTRO_NOMBRE_DEFAULT = "CESFAM Dr. Alberto Reyes"
RM_IMPLEMENTADOS = [
    "RM-Atenciones-A01",
    "RM-ProduccionCitas",
    "RM-EpisodiosUrgencia",
]

def sanitize_filename_part(value: str) -> str:
    text = str(value or "").strip()
    if not text: return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"\s+", "_", text)
    text = re.sub(r"[^A-Za-z0-9._-]", "", text)
    text = re.sub(r"_+", "_", text)
    text = text.strip("_-")
    return text[:60]

def infer_centro_value(df_total: pl.DataFrame, input_files: List[Path]) -> str:
    # Polars version
    for col in ("NombreEstablecimiento", "NombreLocal", "HOSP_Code"):
        if col in df_total.columns:
            # Seleccionar columna, quitar nulos y vacios, contar
            try:
                counts = (
                    df_total.select(pl.col(col).cast(pl.String))
                    .filter(pl.col(col).is_not_null() & (pl.col(col) != "") & (pl.col(col) != "nan"))
                    .group_by(col)
                    .len()
                    .sort("len", descending=True)
                )
                if not counts.is_empty():
                    return str(counts[col][0])
            except Exception:
                pass

    for p in input_files:
        stem = p.stem
        m = re.search(r"(CECO[_ -].+)$", stem, flags=re.IGNORECASE)
        if m: return m.group(1).replace("_", " ").strip()
        tok = re.split(r"[_-]+", stem)[0].strip()
        if tok and len(tok) >= 3: return tok

    return CENTRO_NOMBRE_DEFAULT

def infer_diccionario_from_filenames(input_files: List[Path]) -> Optional[Tuple[str, str]]:
    tokens: set[str] = set()
    for p in input_files:
        m = re.search(r"(RM-[^._]+?)(?:_|\.(?:csv|zip)|$)", p.name, flags=re.IGNORECASE)
        if m: tokens.add(m.group(1))

    if len(tokens) != 1: return None
    token = next(iter(tokens)).strip()
    token_canon = token
    for cand in RM_IMPLEMENTADOS:
        if cand.lower() == token.lower():
            token_canon = cand
            break
    
    spec_try = get_diccionario("rm", token_canon)
    if spec_try.id != "default":
        return ("rm", spec_try.nombre)
    return None

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--formato", default="csv", choices=["xlsx", "csv"])
    p.add_argument("--tipo", default="auto", choices=["rm", "percapita", "auto"])
    p.add_argument("--output", required=True)
    p.add_argument("--diccionario-tipo", default=None)
    p.add_argument("--diccionario", dest="diccionario_nombre", default=None)
    p.add_argument("--separador", default="auto")
    return p.parse_args()

def main() -> int:
    start_script = time.time()
    args = parse_args()
    carpeta = Path(args.input)
    if not carpeta.exists(): return 1

    archivos_all = sorted(carpeta.glob("*.zip")) + sorted(carpeta.glob("*.csv"))
    if not archivos_all: return 1

    # Si coexisten archivos .zip (frecuentemente gzip de TrakCare) y .csv en la misma carpeta,
    # los .zip son copias comprimidas de los mismos datos. Procesarlos junto con los .csv
    # duplicaría todas las filas. Regla: si hay CSVs, usar solo CSVs; si solo hay ZIPs, usarlos.
    hay_csvs = any(p.suffix.lower() == ".csv" for p in archivos_all)
    hay_zips = any(p.suffix.lower() == ".zip" for p in archivos_all)
    if hay_csvs and hay_zips:
        log_info("Detectados tanto ZIP como CSV — usando solo CSV para evitar duplicados.")
        archivos_all = [p for p in archivos_all if p.suffix.lower() == ".csv"]

    if not (args.diccionario_tipo and args.diccionario_nombre):
        inferred = infer_diccionario_from_filenames(archivos_all)
        if inferred:
            args.diccionario_tipo, args.diccionario_nombre = inferred
            log_info(f"Diccionario auto-detectado: {args.diccionario_nombre}")

    spec = select_diccionario(SelectorInput(
        tipo=args.tipo,
        diccionario_tipo=args.diccionario_tipo,
        diccionario_nombre=args.diccionario_nombre,
    ))
    
    tipo_efectivo = args.diccionario_tipo if args.tipo == "auto" and args.diccionario_tipo else args.tipo
    archivos = archivos_all if tipo_efectivo != "percapita" else [a for a in archivos_all if a.suffix.lower() == ".csv"]

    log_info(f"Procesando {len(archivos)} archivo(s) con Polars...")

    dfs: List[pl.DataFrame] = []
    renombradas_set: set[str] = set()
    faltantes_set: set[str] = set()
    extras_set: set[str] = set()
    sep_override = args.separador if args.separador != "auto" else None

    def worker(ruta: Path):
        try:
            res_archivos = procesar_archivo(ruta, sep_override=sep_override)
            bloques_out = []
            for df in res_archivos:
                if df is not None and not df.is_empty():
                    df_aplicado, report = apply_diccionario_spec(
                        df, source_label=ruta.name,
                        required_core_columns=spec.required_core_columns,
                        recommended_columns=spec.recommended_columns,
                        optional_patterns=spec.optional_patterns,
                        known_aliases=spec.known_aliases,
                        orden_columnas=spec.orden_columnas,
                        allow_extra_columns=spec.allow_extra_columns,
                        min_required_match=spec.min_required_match,
                        crear_columnas_faltantes=spec.crear_columnas_faltantes,
                        include_detectadas=False,
                    )
                    if df_aplicado is not None:
                        bloques_out.append((df_aplicado, report, ruta.name))
            return bloques_out
        except Exception as e:
            log_error(f"Error en worker para {ruta.name}: {e}")
            return []

    cpu_count = os.cpu_count() or 2
    env_workers = os.getenv("CONSOLIDADOR_MAX_WORKERS", "").strip()
    if env_workers.isdigit() and int(env_workers) > 0:
        max_workers = min(len(archivos), int(env_workers))
    else:
        # Evitar sobre-suscripcion: Polars ya paraleliza internamente.
        max_workers = max(1, min(len(archivos), 4, cpu_count))
    log_info(f"Workers activos: {max_workers} (CPU detectada: {cpu_count})")

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        results = list(executor.map(worker, archivos))

    for bloques in results:
        for df_app, rep, nombre in bloques:
            for r in rep["renombradas"]:
                origen = str(r.get("ColumnaOriginal", "")).strip()
                final = str(r.get("ColumnaFinal", "")).strip()
                if origen and final:
                    renombradas_set.add(f"{origen} -> {final}")
            for r in rep["faltantes"]:
                faltante = str(r.get("ColumnaRequerida", "")).strip()
                if faltante:
                    faltantes_set.add(faltante)
            for r in rep["extras"]:
                extra = str(r.get("ColumnaExtra", "")).strip()
                if extra:
                    extras_set.add(extra)
            dfs.append(df_app)
            log_info(f"     {nombre}: {df_app.height:,} registros")

    if not dfs:
        log_warn("Sin datos para consolidar.")
        return 0

    log_info(f"Consolidando {len(dfs)} bloques con Polars backend...")
    
    t0 = time.time()
    # Optimizacion: Si todos los DataFrames tienen las mismas columnas en el mismo orden, 
    # la concatenacion vertical es mucho mas rapida que la diagonal.
    first_cols = dfs[0].columns
    all_same = True
    for d in dfs[1:]:
        if d.columns != first_cols:
            all_same = False
            break
            
    if all_same:
        log_info("     (Optimizacion: Usando concatenacion vertical)")
        df_total = pl.concat(dfs, how="vertical")
    else:
        log_info("     (Usando concatenacion diagonal por diferencias de esquema)")
        df_total = pl.concat(dfs, how="diagonal")

    cols_pre_merge = len(df_total.columns)
    df_total = merge_duplicate_columns(df_total)
    cols_post_merge = len(df_total.columns)
    columnas_unidas = max(0, cols_pre_merge - cols_post_merge)
    t1 = time.time()
    log_info(f"Concat/Merge: {t1 - t0:.2f}s")

    total_filas = df_total.height
    
    # Reorden final
    t2 = time.time()
    if spec.orden_columnas:
        target_order = [c for c in spec.orden_columnas if c in df_total.columns]
        rest = [c for c in df_total.columns if c not in target_order]
        final_selection = []
        seen_fs = set()
        for c in (target_order + rest):
            if c not in seen_fs:
                final_selection.append(c)
                seen_fs.add(c)
        df_total = df_total.select(final_selection)
    t3 = time.time()
    log_info(f"Reordenamiento: {t3 - t2:.2f}s")

    total_cols = len(df_total.columns)
    log_info(f"Total: {total_filas:,} filas × {total_cols} columnas")

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    centro_value = infer_centro_value(df_total, archivos)
    centro_part = sanitize_filename_part(centro_value) or "Centro"
    dic_name = spec.nombre if spec.id != "default" else "AUTO"
    dic_part = sanitize_filename_part(dic_name)
    nombre_descarga = f"Consolidado_{centro_part}_{dic_part}.{args.formato}"

    t4 = time.time()
    if args.formato == "xlsx":
        celdas_aprox = df_total.height * len(df_total.columns)
        if celdas_aprox > 500_000:
            log_warn(
                f"Exportando {df_total.height:,} filas × {len(df_total.columns)} columnas a Excel "
                f"({celdas_aprox/1_000_000:.1f}M celdas). Esto puede tardar entre 30 y 90 segundos. "
                "Para exportaciones rápidas use --formato csv."
            )
        df_total.write_excel(
            str(output_path),
            worksheet="Consolidado",
        )
    else:
        df_total.write_csv(str(output_path), separator=";", include_bom=True)
    t5 = time.time()
    log_info(f"Escritura {args.formato}: {t5 - t4:.2f}s")

    renombradas_sorted = sorted(renombradas_set)
    faltantes_sorted = sorted(faltantes_set)
    extras_sorted = sorted(extras_set)

    def _preview(items: List[str], n: int = 8) -> str:
        if not items:
            return ""
        head = items[:n]
        suffix = " ..." if len(items) > n else ""
        return "; ".join(head) + suffix

    columnas_sacadas = len(extras_sorted) if not spec.allow_extra_columns else 0

    meta = Metadata(
        filas=total_filas,
        columnas=total_cols,
        archivos=len(dfs),
        nombre=nombre_descarga,
        columnas_unidas=columnas_unidas,
        columnas_renombradas=len(renombradas_sorted),
        columnas_faltantes=len(faltantes_sorted),
        columnas_extras=len(extras_sorted),
        columnas_sacadas=columnas_sacadas,
        preview_renombradas=_preview(renombradas_sorted),
        preview_faltantes=_preview(faltantes_sorted),
        preview_extras=_preview(extras_sorted),
    )
    emit_metadata(meta)
    log_info(f"Exito: {output_path} (Total Script: {time.time() - start_script:.2f}s)")
    return 0

if __name__ == "__main__":
    import sys
    import traceback
    try:
        sys.exit(main())
    except Exception:
        log_error(f"CRASH CRITICO:\n{traceback.format_exc()}")
        sys.exit(1)
