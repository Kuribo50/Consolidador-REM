# Consolidador REM

## Descripción del Proyecto

El sistema Consolidador REM es una aplicación de entorno web destinada al procesamiento asíncrono y consolidación de volúmenes extensos de datos de salud contenidos en archivos CSV o carpetas comprimidas tipo ZIP. Permite la ejecución de sentencias de agrupación para estructurar los resultados y generar un modelo de exportación unificado.

## Estructura Tecnológica

El proyecto se segmenta en las siguientes capas técnicas y sus componentes de infraestructura:

| Capa Técnica         | Frameworks y Librerías         | Objetivo Funcional                                                   |
| -------------------- | ------------------------------ | -------------------------------------------------------------------- |
| Frontend (Cliente)   | Next.js, React, TailwindCSS    | Presentación y acceso a la interfaz de recepción de archivos.        |
| Control de Servicios | BullMQ, ioredis                | Motor interno para colas de trabajo sobre cargas de cómputo pesadas. |
| Procesamiento Base   | Entorno Node.js, Módulo `xlsx` | Parseo, extracción, e interacción IO de estructuras CSV y Excel.     |

## Parámetros Lógicos de Procesamiento

El entorno de servidores soporta dos flujos de trabajo sobre la gestión del procesamiento interno:

| Modo de Procesamiento | Valor Mínimo de Entorno        | Contexto de Aplicación                                                                                                                    |
| --------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Consumo Directo       | `CONSOLIDAR_QUEUE_MODE=direct` | Permite despliegue simple prescindiendo del servicio in-memory externo. Ideal como modo desarrollo estándar y fase uno de pruebas.        |
| Gestión por Colas     | `CONSOLIDAR_QUEUE_MODE=queue`  | Flujo de sistema asíncrono. Precisa conexión de microservicio estable en Redis para distribuir procesos sin obstruir subprocesos vitales. |

## Instrucciones de Instalación Local

### Requerimientos Previos de Máquina

- Motor de ejecución Node.js (se sugiere la versión 18 LTS o superior).
- Gestor de paquetes nativo de entorno (NPM).
- Servicio virtualizador estable y compatibilidad Docker Compose (exclusivamente si se pretende desplegar la capa de colas Redis a escala pre-producción).

### Guía de Operación Inicial

1. Proceda con la instalación de todo el listado de las dependencias nativas del proyecto tras acceder por terminal a la ruta respectiva de este proyecto:

   ```bash
   npm install
   ```

2. Realice una copia estándar de los parámetros referenciales del ambiente, y si la ejecuta por primera vez, defina las variables principales dentro del modelo `.env.local` creado:

   ```bash
   cp .env.example .env.local
   ```

3. Despliegue el servidor local bajo la estrategia modo cliente:

   ```bash
   npm run dev
   ```

4. Alternativamente, para el despliegue local integrando colas BullMQ, inicialice el clúster contenedor de apoyo previamente (Precisa agente Docker en operación):
   ```bash
   docker compose -f docker-compose.redis.local.yml up -d
   npm run dev
   ```

## Especificaciones de Orquestación y Despliegue (Coolify)

El presente sistema está adecuado para su inserción rápida y estabilización empleando la plataforma Coolify, configurado para no depender obligatoriamente de contenedores de imagen subidos en repositorios de distribución públicos.

- **Configuración del Construcción (Build Pack):** `Docker Compose`
- **Ubicación de Referencia Interna:** `/docker-compose.coolify.yml`

### Guía de Configuración Fase 1

Se estira una normalización estructural con variables estáticas que impidan un colapso prematuro del servicio al obviar un servicio externo por primera vez. Es aconsejable comenzar adjuntando sus especificaciones de esta manera:

- `NODE_ENV=production`
- `PORT=3000`
- `HOSTNAME=0.0.0.0`
- `CONSOLIDAR_QUEUE_MODE=direct`
