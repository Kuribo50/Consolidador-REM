from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass(frozen=True)
class DiccionarioSpec:
    # Identificadores
    id: str
    nombre: str
    tipo: str  # "rm" | "percapita"
    descripcion: str

    # Columnas
    required_core_columns: List[str] = field(default_factory=list)
    recommended_columns: List[str] = field(default_factory=list)
    optional_patterns: List[str] = field(default_factory=list)
    known_aliases: Dict[str, str] = field(default_factory=dict)  # alias -> canonical
    orden_columnas: List[str] = field(default_factory=list)

    # Comportamiento
    allow_extra_columns: bool = True
    min_required_match: float = 0.6
    crear_columnas_faltantes: bool = True


def noop_spec(tipo: str = "rm") -> DiccionarioSpec:
    return DiccionarioSpec(
        id="default",
        nombre="default",
        tipo=tipo,
        descripcion="Especificacion por defecto (sin reglas).",
    )
