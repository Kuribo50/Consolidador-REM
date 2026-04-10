from dataclasses import dataclass
from typing import Optional

from diccionarios.registry import get_diccionario


@dataclass(frozen=True)
class SelectorInput:
    tipo: str
    diccionario_tipo: Optional[str]
    diccionario_nombre: Optional[str]


def select_diccionario(inp: SelectorInput):
    if inp.diccionario_tipo and inp.diccionario_nombre:
        return get_diccionario(inp.diccionario_tipo, inp.diccionario_nombre)
    return get_diccionario(inp.tipo, None)
