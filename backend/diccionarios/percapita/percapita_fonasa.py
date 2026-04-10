from diccionarios.base import DiccionarioSpec
from diccionarios.registry import register


register(
    DiccionarioSpec(
        id="percapita_fonasa",
        nombre="Percápita FONASA",
        tipo="percapita",
        descripcion="Archivo Percápita (FONASA).",
        required_core_columns=[],
        recommended_columns=[],
        optional_patterns=[],
        known_aliases={},
        orden_columnas=[],
        allow_extra_columns=True,
        min_required_match=0.0,
        crear_columnas_faltantes=True,
    )
)
