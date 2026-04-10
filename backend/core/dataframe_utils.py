import difflib
import re
import unicodedata
from typing import Dict, List, Optional, Sequence, Tuple
import polars as pl

def strip_suffix(name: str) -> str:
    return re.sub(r"\.\d+$", "", str(name).strip())

def normalize_column_name(name: str) -> str:
    """
    Normalizacion robusta compatible con Polars.
    """
    base = strip_suffix(name)
    text = base.strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"\s+", " ", text).strip()
    return re.sub(r"[^a-z0-9]", "", text)

def merge_duplicate_columns(df: pl.DataFrame) -> pl.DataFrame:
    """
    Agrupa columnas que normalizan al mismo nombre y las combina (coalesce).
    En Polars, primero debemos asegurar que no haya nombres EXACTAMENTE iguales
    antes de usar expresiones, para evitar ambigüedades.
    """
    if df.is_empty():
        return df

    # 1. Hacer que todos los nombres sean únicos físicamente
    orig_cols = df.columns
    unique_names = []
    counts = {}
    for col in orig_cols:
        if col in counts:
            counts[col] += 1
            unique_names.append(f"{col}__dupe_{counts[col]}")
        else:
            counts[col] = 0
            unique_names.append(col)
    
    if unique_names != orig_cols:
        # Usar pl.nth(i).alias() para renombrar por posición física, 
        # evitando la ambigüedad de nombres duplicados en un mapping dict.
        df = df.select([pl.nth(i).alias(unique_names[i]) for i in range(len(orig_cols))])

    # 2. Agrupar por nombre normalizado
    col_names = df.columns
    groups: Dict[str, List[str]] = {}
    for col in col_names:
        key = normalize_column_name(col)
        groups.setdefault(key, []).append(col)

    expressions = []
    seen_final_names = set()
    
    for key, cols in groups.items():
        # Tomar un nombre base razonable (el primero del grupo sin el sufijo de dupe)
        base_name = strip_suffix(re.sub(r"__dupe_\d+$", "", cols[0]))
        final_name = base_name
        
        # Evitar colisiones de nombres finales entre grupos distintos
        suf = 2
        while final_name in seen_final_names:
            final_name = f"{base_name}_{suf}"
            suf += 1
        seen_final_names.add(final_name)
        
        if len(cols) > 1:
            # Coalesce: toma el primer valor no nulo
            expressions.append(pl.coalesce(cols).alias(final_name))
        else:
            expressions.append(pl.col(cols[0]).alias(final_name))
            
    return df.select(expressions)

def apply_column_corrections(df: pl.DataFrame, corrections: dict[str, str]) -> pl.DataFrame:
    if not corrections:
        return df
    return df.rename({k: v for k, v in corrections.items() if k in df.columns})

def build_canonical_map(canonical_columns: Sequence[str]) -> Dict[str, str]:
    m: Dict[str, str] = {}
    for col in canonical_columns:
        m[normalize_column_name(col)] = col
    return m

def build_alias_map(known_aliases: Dict[str, str]) -> Dict[str, str]:
    m: Dict[str, str] = {}
    for alias, canonical in known_aliases.items():
        m[normalize_column_name(alias)] = canonical
    return m

def best_fuzzy_match(
    target_norm: str,
    candidates: Sequence[Tuple[str, str]],
    threshold: float = 0.94,
) -> Optional[Tuple[str, str, float]]:
    scored: List[Tuple[float, str, str]] = []
    for orig, norm in candidates:
        if not norm: continue
        score = difflib.SequenceMatcher(a=target_norm, b=norm).ratio()
        scored.append((score, orig, norm))

    if not scored: return None
    scored.sort(reverse=True, key=lambda x: x[0])
    best = scored[0]
    if best[0] < threshold: return None
    if len(scored) > 1 and (best[0] - scored[1][0]) < 0.02: return None
    return (best[1], best[2], best[0])

# Cache simple para optimizar archivos con estructuras idénticas
_MAPPING_CACHE = {}

def apply_diccionario_spec(
    df: pl.DataFrame,
    *,
    source_label: str,
    required_core_columns: Sequence[str],
    recommended_columns: Sequence[str],
    optional_patterns: Sequence[str],
    known_aliases: Dict[str, str],
    orden_columnas: Sequence[str],
    allow_extra_columns: bool,
    min_required_match: float,
    crear_columnas_faltantes: bool,
) -> Tuple[Optional[pl.DataFrame], Dict[str, List[dict]]]:
    """
    Versión optimizada con caché para evitar fuzzy matching repetitivo.
    """
    cols_in = df.columns
    core = list(required_core_columns)
    rec = list(recommended_columns)
    # canon_order es vital para el reporte y el orden final
    canon_order = list(orden_columnas) if orden_columnas else (core + rec)
    
    # Cache key: tupla de nombres de columnas originales + configuración clave
    cache_key = (tuple(cols_in), tuple(required_core_columns), tuple(recommended_columns), 
                 tuple(orden_columnas) if orden_columnas else None, allow_extra_columns)
    
    if cache_key in _MAPPING_CACHE:
        mapping, report_base = _MAPPING_CACHE[cache_key]
        # Clonar reporte para este archivo específico (poniendo el nombre de archivo correcto)
        report = {k: [dict(item, Archivo=source_label) for item in v] for k, v in report_base.items()}
        # Aplicar mapeo y fusionar
        df_mapped = df.rename(mapping)
        df_merged = merge_duplicate_columns(df_mapped)
    else:
        report = {
            "detectadas": [], "faltantes": [], "extras": [], "renombradas": [],
        }
        
        canonical_map = build_canonical_map(core + rec + canon_order)
        alias_map = build_alias_map(known_aliases)
        mapping: Dict[str, str] = {}
        reasons: Dict[str, str] = {}
        norms: Dict[str, str] = {}

        for c in cols_in:
            if c == "_archivo_origen":
                mapping[c] = c
                continue
            
            base = strip_suffix(c)
            norm = normalize_column_name(base)
            norms[c] = norm

            if norm in alias_map:
                mapping[c] = alias_map[norm]
                reasons[c] = "alias"
            elif norm in canonical_map:
                mapping[c] = canonical_map[norm]
                reasons[c] = "normalizacion"
            else:
                mapping[c] = base.strip()
                reasons[c] = "original"

            if mapping[c] != c:
                report["renombradas"].append({
                    "Archivo": source_label, "ColumnaOriginal": c,
                    "ColumnaFinal": mapping[c], "Motivo": reasons[c],
                })

        # Fuzzy match para core faltantes
        current_names = set(mapping.values())
        present_norms = {normalize_column_name(c) for c in current_names}
        candidates = [(c, norms[c]) for c in cols_in if c != "_archivo_origen"]
        used_orig = {o for o, r in reasons.items() if r in ("alias", "normalizacion")}

        for required in core:
            req_norm = normalize_column_name(required)
            if req_norm in present_norms: continue

            remaining = [(o, n) for (o, n) in candidates if o not in used_orig]
            best = best_fuzzy_match(req_norm, remaining, threshold=0.94)
            if not best: continue
            
            best_orig, _, score = best
            mapping[best_orig] = required
            reasons[best_orig] = f"fuzzy({score:.2f})"
            used_orig.add(best_orig)
            report["renombradas"].append({
                "Archivo": source_label, "ColumnaOriginal": best_orig,
                "ColumnaFinal": required, "Motivo": reasons[best_orig],
            })

        # Aplicar mapeo y mergear
        df_mapped = df.rename(mapping)
        df_merged = merge_duplicate_columns(df_mapped)

        # Reporte de detectadas
        known_set = set(core) | set(rec) | set(canon_order)
        for original in cols_in:
            if original == "_archivo_origen": continue
            final = mapping.get(original, strip_suffix(original))
            kind = "core" if final in core else "recommended" if final in rec else "ordered" if final in known_set else "extra"
            report["detectadas"].append({
                "Archivo": source_label, "ColumnaOriginal": original,
                "ColumnaFinal": final, "Clasificacion": kind, "Motivo": reasons.get(original, ""),
            })

        # Filtrado de extras si no se permiten
        if not allow_extra_columns:
            to_keep = ["_archivo_origen"] + [c for c in df_merged.columns if c in known_set]
            to_drop = [c for c in df_merged.columns if c not in to_keep and c != "_archivo_origen"]
            for c in to_drop:
                matched = [p for p in optional_patterns if p and p.lower() in c.lower()]
                report["extras"].append({
                    "Archivo": source_label, "ColumnaExtra": c,
                    "MatchOptionalPattern": " | ".join(matched) if matched else "",
                })
            df_merged = df_merged.select(to_keep)
        else:
            for c in df_merged.columns:
                if c == "_archivo_origen" or c in known_set: continue
                matched = [p for p in optional_patterns if p and p.lower() in c.lower()]
                report["extras"].append({
                    "Archivo": source_label, "ColumnaExtra": c,
                    "MatchOptionalPattern": " | ".join(matched) if matched else "",
                })
        
        # Guardar en caché antes de validaciones finales
        report_templ = {k: [dict(item, Archivo="") for item in v] for k, v in report.items()}
        _MAPPING_CACHE[cache_key] = (mapping, report_templ)

    # --- Validaciones y reordenamiento final (siempre se ejecutan) ---
    present_now = {normalize_column_name(c) for c in df_merged.columns if c != "_archivo_origen"}
    core_norms = [normalize_column_name(c) for c in core]
    core_total = len(core_norms)
    core_found = sum(1 for n in core_norms if n in present_now)
    ratio = 1.0 if core_total == 0 else (core_found / core_total)

    if core_total > 0 and ratio < float(min_required_match):
        for required in core:
            if normalize_column_name(required) not in present_now:
                report["faltantes"].append({
                    "Archivo": source_label, "ColumnaRequerida": required, "Tipo": "core",
                    "MatchCore": f"{core_found}/{core_total}", "Ratio": round(ratio, 3),
                })
        return None, report

    # Columnas faltantes
    missing_core = [c for c in core if c not in df_merged.columns]
    for m in missing_core:
        report["faltantes"].append({
            "Archivo": source_label, "ColumnaRequerida": m, "Tipo": "core",
            "MatchCore": f"{core_found}/{core_total}", "Ratio": round(ratio, 3),
        })

    if crear_columnas_faltantes and missing_core:
        # Cast explicitamente a String para evitar errores de esquema en el concat diagonal posterior
        df_merged = df_merged.with_columns([pl.lit("").cast(pl.String).alias(c) for c in missing_core])

    # Orden final robusto
    selection_raw = ["_archivo_origen"] + [c for c in canon_order if c in df_merged.columns]
    rest = [c for c in df_merged.columns if c not in selection_raw]
    
    final_selection = []
    seen = set()
    for c in (selection_raw + rest):
        if c not in seen:
            final_selection.append(c)
            seen.add(c)
            
    df_final = df_merged.select(final_selection)
    
    return df_final, report
