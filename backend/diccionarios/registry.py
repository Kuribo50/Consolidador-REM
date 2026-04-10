from __future__ import annotations

from typing import Dict, Optional, Tuple

from .base import DiccionarioSpec, noop_spec


_REGISTRY: Dict[Tuple[str, str], DiccionarioSpec] = {}


def register(spec: DiccionarioSpec) -> None:
    key = (spec.tipo.lower(), spec.nombre)
    _REGISTRY[key] = spec


def get_diccionario(tipo: str, nombre: Optional[str]) -> DiccionarioSpec:
    tipo_norm = (tipo or "auto").lower()
    if tipo_norm == "auto":
        # Default no-op dictionary; specific selection should be provided by UI.
        tipo_norm = "rm"

    if nombre:
        found = _REGISTRY.get((tipo_norm, nombre))
        if found:
            return found

    # Fallback no-op spec.
    return noop_spec(tipo=tipo_norm)
