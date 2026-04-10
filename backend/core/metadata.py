import json
import sys
from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Metadata:
    filas: int
    columnas: int
    archivos: int
    nombre: str
    columnas_unidas: int = 0
    columnas_renombradas: int = 0
    columnas_faltantes: int = 0
    columnas_extras: int = 0
    columnas_sacadas: int = 0
    preview_renombradas: str = ""
    preview_faltantes: str = ""
    preview_extras: str = ""


def emit_metadata(meta: Metadata) -> None:
    # Next.js parses a single JSON object from stderr with prefix METADATA::
    print(f"METADATA::{json.dumps(asdict(meta), ensure_ascii=False)}", file=sys.stderr)
