from diccionarios.base import DiccionarioSpec
from diccionarios.registry import register


register(
    DiccionarioSpec(
        id="rm_produccion_citas",
        nombre="RM-ProduccionCitas",
        tipo="rm",
        descripcion="Citas del período excluyendo canceladas",
        required_core_columns=[
            "HOSP_Code",
            "NombreEstablecimiento",
            "NombreLocal",
            "TipoProfesionalAten",
            "RUNProfesional",
            "NombreProfesional",
            "NroEpisodio",
            "PlanSalud",
            "Prevision",
        ],
        recommended_columns=[
            "AgendadoPor",
            "RUNProfesional_Agenda",
            "NombreProfesional_Agenda",
            "ListaTipoProfesional",
            "Flag_Beneficiario",
            "ListaDiagnosticos",
        ],
        optional_patterns=[
            "_Desc",
            "_List",
            "Prenatal",
            "Embarazo",
            "Violencia",
            "ARO",
        ],
        known_aliases={
            "NumeroEpisodio": "NroEpisodio",
            "Nro_Episodio": "NroEpisodio",
        },
        orden_columnas=[
            "_archivo_origen",
            "HOSP_Code",
            "NombreEstablecimiento",
            "NombreLocal",
            "TipoProfesionalAten",
            "RUNProfesional",
            "NombreProfesional",
            "NroEpisodio",
            "Prevision",
            "PlanSalud",
            "AgendadoPor",
            "RUNProfesional_Agenda",
            "NombreProfesional_Agenda",
            "ListaTipoProfesional",
            "Flag_Beneficiario",
            "ListaDiagnosticos",
        ],
        allow_extra_columns=True,
        min_required_match=0.6,
        crear_columnas_faltantes=True,
    )
)

