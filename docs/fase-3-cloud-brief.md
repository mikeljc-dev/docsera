# Fase 3 "cloud" — brief de decisión (2026-08-03)

La Fase 3 del plan original (versión multi-tenant, billing con Stripe, free
tier) lleva sin empezar toda la vida del proyecto. Este documento la convierte
en algo decidible: qué costaría de verdad, qué caminos hay, y una
recomendación. No es un compromiso de construir nada.

## La pregunta estratégica primero (no la técnica)

**No hay usuarios y el lanzamiento se descartó** (decisión de Mikel,
2026-07-19). Construir un SaaS multi-tenant es la apuesta más especulativa de
todo el backlog: mucha ingeniería a cambio de una demanda que no está validada.
La conclusión de este brief es, sobre todo, **de secuencia**: no rehacer el
producto para multi-tenancy hasta que alguien pague. Lo técnico de abajo existe
para que, si se persigue, se empiece por el escalón más barato.

## Dónde estamos: todo asume un solo tenant

Aterrizado contra el código (2026-08-03):
- **Esquema**: `documents`, `chunks`, `conversations`, `conversation_sources`
  no tienen columna de tenant/org. Una consulta ve toda la BD.
- **Auth**: un único `ADMIN_TOKEN` global (`lib/adminAuth.ts`).
- **Config de LLM/embeddings**: global por env (`LLM_PROVIDER`, keys,
  `EMBEDDING_DIMENSIONS`). Una instancia = un proveedor, un modelo, una
  dimensión de vector.
- **Rate limits**: por IP / usuario de bot, no por tenant (`lib/chatRateLimit`).
- **CORS**: un solo `ALLOWED_ORIGINS`. **Widget**: apunta a un `server` fijo,
  sin identificar tenant.

## Qué exige de verdad el multi-tenant "pooled" (esquema compartido)

El camino "SaaS clásico" (una BD, `tenant_id` en todo) toca casi cada capa:
- `tenant_id` en las 4 tablas + en cada índice, y **filtrarlo en cada query**
  de retrieval/historial/stats (un fallo aquí = fuga de datos entre clientes:
  el riesgo nº1). Idealmente Row-Level Security de Postgres como red de
  seguridad, no solo `WHERE`.
- **Identidad del widget**: una public key por tenant en el `<script>` que el
  server resuelve a un tenant (hoy no existe ese concepto).
- **Config por tenant**: proveedor/modelo/keys de LLM por cliente (o un pool
  compartido con la key de Docsera y coste medido). Rompe el "trae tu propia
  key" del self-hosted.
- **La dimensión de embeddings es global** (columna `vector(N)` fija en la
  migración; ver deuda #2 y la guarda de #60). Multi-tenant con modelos de
  embedding distintos por cliente **no cabe en una sola columna** — obliga a
  fijar un modelo/dimensión para toda la nube, o a una tabla de vectores por
  dimensión. Es la restricción técnica menos obvia y la más incómoda.
- Rate limits/quotas **por tenant y por plan**; metering de uso; control plane
  de alta/baja; aislamiento del abuso de un tenant.
- **Billing**: Stripe (suscripción o uso), free tier, webhooks, dunning.

Es una reescritura grande y con un modo de fallo caro (fuga entre tenants).

## Los caminos (de menos a más inversión)

- **A. Managed single-tenant (una instancia por cliente).** **Reutiliza el
  código de hoy casi sin tocarlo**: cada cliente = un contenedor + su BD (la
  imagen slim de #57 ya está lista). Aislamiento y privacy-first **gratis** (por
  construcción, no por `WHERE`). Solo hace falta un **control plane fino**:
  aprovisionar contenedor+BD al alta, y medir uso para Stripe. Contra: coste de
  infra por cliente más alto y no escala a miles de tenants pequeños. Pero para
  **validar willingness-to-pay** es, con diferencia, lo más barato de llegar.
- **B. Pooled multi-tenant (esquema compartido con `tenant_id` + RLS).** El
  SaaS clásico, escalable a muchos tenants pequeños. Es la reescritura de la
  sección de arriba. Solo merece la pena **cuando el volumen de tenants haga
  insostenible A**.
- **C. Híbrido**: A para los primeros clientes / planes altos (aislamiento
  fuerte), y migrar a B cuando la cola de tenants pequeños lo pida. Es el
  destino realista si el producto funciona.

## Recomendación

1. **No construir B ahora.** Rehacer para pooled-tenancy sin un solo cliente es
   invertir en el modo de fallo más caro antes de saber si alguien paga.
2. **Si se persigue cloud, empezar por A.** El salto técnico es un **control
   plane** (alta → contenedor+BD desde la imagen slim → snippet del widget →
   Stripe por uso), no una reescritura del server. Valida el negocio con el
   riesgo técnico mínimo y sin romper privacy-first.
3. **Antes que cualquiera de los dos**, el bloqueo real no es técnico: es que
   **no hay señal de demanda**. El experimento más barato no es código —es
   poner una lista de espera / precio en la landing y ver si alguien pica, o
   mirar si la demo pública ya tiene uso (dashboard). Eso decide si A siquiera
   merece empezar.
4. **Deuda que hay que resolver para cualquier cloud**, cuando llegue: la
   dimensión de embeddings global. Fijar un modelo/dimensión para toda la nube
   es la vía simple; documentarlo como decisión.

## Lectura de una línea

El cuello de botella de la Fase 3 no es la arquitectura —es la demanda. Si
aparece, el primer paso es A (una instancia por cliente + control plane fino),
no el SaaS pooled. B se gana con tracción, no se construye por adelantado.
