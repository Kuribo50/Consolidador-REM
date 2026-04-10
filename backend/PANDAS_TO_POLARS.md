# Migración de Pandas a Polars ⚡

Este documento explica las optimizaciones técnicas realizadas al motor de consolidación para alcanzar el máximo rendimiento.

## 🚀 ¿Por qué Polars?

Originalmente, el Consolidador RM utilizaba **Pandas**. Aunque Pandas es el estándar de la industria, presenta cuellos de botella significativos al procesar archivos clínicos de gran ancho (más de 190 columnas) y múltiples archivos simultáneamente.

**Beneficios obtenidos:**

- **Procesamiento Multihilo:** Polars está escrito en Rust y utiliza todos los núcleos de la CPU para leer archivos CSV de forma paralela.
- **Copy-on-Write:** Minimiza el uso de memoria al evitar copias innecesarias de datos.
- **Optimización de Consultas:** El motor detecta cuándo puede realizar operaciones en bloque.

## 🛠 Cambios Arquitectónicos

### 1. Lectura Paralela (`ThreadPoolExecutor`)

En lugar de procesar un archivo tras otro, el nuevo motor lanza hasta **8 hilos simultáneos** para leer y normalizar los datos.

### 2. Intelligent Mapping Cache

El proceso de "Fuzzy Matching" (comparar nombres de columnas parecidos) es costoso computacionalmente. Hemos implementado una caché que:

1. Analiza el primer archivo de un lote.
2. Guarda el "mapa" de columnas.
3. Lo aplica instantáneamente a los archivos siguientes si tienen la misma estructura.

### 3. Concatenación Vertical

A diferencia de Pandas, que a menudo requiere realinear índices, Polars permite una "Concatenación Vertical" (`pl.concat(how='vertical')`) que es órdenes de magnitud más rápida cuando los esquemas coinciden.

### 4. Excel High-Speed Writing

Utilizamos el motor `xlsxwriter` optimizado a través de Polars para manejar el volumen de datos (3 millones de celdas en el ejemplo de Producción Citas) de la forma más eficiente posible en Python.

## 📊 Comparativa de Rendimiento

| Etapa                    | Pandas (Anterior) | Polars (Actual)       |
| :----------------------- | :---------------- | :-------------------- |
| Lectura de 12 archivos   | ~12.0s            | **~3.5s**             |
| Normalización y Matching | ~15.0s            | **~1.2s** (con caché) |
| Concatenación            | ~5.0s             | **~0.1s**             |
| Escritura Excel (14MB)   | ~30.0s            | **~21.0s**            |
| **Total Estimado**       | **~62.0s**        | **~26.0s**            |

## ⚠️ Notas Técnicas

Para mantener la compatibilidad con los archivos de TrakCare (que a veces vienen corruptos o con encodings antiguos), el motor implementa un **Fallback Automático**: si falla el UTF-8, intenta Latin-1 automáticamente sin detener el proceso.
