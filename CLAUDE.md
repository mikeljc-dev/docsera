# CLAUDE.md — Contexto del proyecto Docsera

Este archivo te da el contexto para trabajar en este repositorio. Léelo al
empezar cada sesión. Trabajas de forma incremental y por fases: no adelantes
trabajo de fases futuras salvo que se te pida.

## Qué es Docsera

Widget open source de chat con IA sobre documentación propia. Cualquiera puede
instalar un asistente inteligente sobre sus docs con una sola línea de
`<script>`. Self-hosted y privacy-first: en ese modo los datos no salen del
servidor del usuario. Agnóstico de LLM (Anthropic, OpenAI, Ollama). Cada
respuesta cita sus fuentes.

Analogía: "el chat de soporte de Intercom, pero open source y self-hosted".

## Decisiones ya tomadas (no reabrir sin permiso)

- **Licencia:** AGPL-3.0-only.
- **Lenguaje:** TypeScript en todo el monorepo.
- **Gestor de paquetes:** pnpm (workspaces).
- **Framework del server:** Hono + @hono/node-server.
- **Base de datos:** Postgres + pgvector (un solo servicio para datos y vectores).
- **Estructura:** monorepo con pnpm workspaces.
- **Nombre y dominio:** Docsera (antes "AskDocs" — renombrado por colisión
  con un producto comercial existente del mismo nombre). Repo, paquetes y
  contenedores ya renombrados. Dominio **docsera.dev** registrado el
  2026-07-16 (en Vercel) y con la landing (`packages/web`) desplegada en
  producción desde Vercel (root directory `packages/web`, preset Vite).

## Estructura del monorepo

```
docsera/
├── package.json            # raíz, workspaces + scripts (db:up, build...)
├── pnpm-workspace.yaml
├── tsconfig.base.json      # config TS estricta compartida
├── docker-compose.yml      # de momento solo Postgres+pgvector
├── .env.example            # plantilla de configuración
└── packages/
    ├── widget/     # web component embebible (el chat flotante)
    ├── server/     # API: chat (RAG), ingesta, administración
    ├── dashboard/  # panel: conversaciones y preguntas sin respuesta
    ├── web/        # landing de docsera.dev (Vite + Preact, en inglés)
    └── docs/       # docs.docsera.dev (Vite, estática, una página con anclas;
                    # embebe el propio widget apuntando a api.docsera.dev)
```

Cada paquete usa el prefijo `@docsera/`. Los `tsconfig.json` de cada paquete
deben extender `../../tsconfig.base.json`.

## Principios de diseño (mantener siempre)

- **Instalación en < 10 minutos** con Docker Compose.
- **Privacy-first**: en self-hosted, nada de datos del usuario sale del servidor.
- **Agnóstico de LLM**: adaptadores intercambiables; el usuario pone su API key.
- **Respuestas con fuentes**: cada respuesta enlaza a la sección de la doc de
  donde salió. Antes de alucinar, responde "no lo sé".
- **Costes controlados**: las llamadas al LLM son el coste variable. Cachear
  respuestas frecuentes cuando tenga sentido.

## Convenciones de código

> Los estándares completos y obligatorios (convenciones, reglas por paquete,
> puerta de calidad, reglas de producto) están en la skill
> `.claude/skills/docsera-standards/SKILL.md`. Léela antes de escribir código.

- TypeScript estricto (ver `tsconfig.base.json`). Nada de `any` sin justificar.
- ESM (`"type": "module"`).
- Node >= 20. Usa `--env-file` o `dotenv` para cargar `.env`.
- Commits pequeños y con mensaje claro. Un commit por unidad lógica de trabajo.
- No metas secretos ni `.env` en git (ya está en `.gitignore`).

## Plan por fases

Trabaja una fase cada vez. Al terminar cada una, para y resume qué has hecho y
cómo probarlo antes de seguir.

### Fase 1 — Núcleo (objetivo: RAG funcional + widget + Docker)
1. **Server: API mínima.** Endpoint `GET /health` → `{ status: "ok", version }`.
   CORS desde `ALLOWED_ORIGINS`. Script `dev` en watch (tsx).
2. **BD: esquema e migraciones.** Tablas para documentos, chunks (con columna
   `vector` de pgvector) y conversaciones. Script de migración.
3. **Ingesta.** Dado una URL/sitemap o markdown: crawlea, trocea en chunks,
   genera embeddings y los guarda. Endpoint `POST /ingest`.
4. **Adaptadores de LLM.** Interfaz común + implementaciones Anthropic, OpenAI,
   Ollama (chat + embeddings). Selección por `LLM_PROVIDER`.
5. **Chat RAG.** `POST /chat`: recibe pregunta, recupera chunks relevantes por
   similitud vectorial, construye el prompt con contexto y devuelve respuesta
   **con citas** a las fuentes.
6. **Widget.** Web component (Lit) con chat flotante que llama a `/chat` y
   muestra las respuestas con sus enlaces de fuente. Empaquetado a un solo JS
   embebible por `<script>`.
7. **Docker.** Añadir server (y lo necesario) al `docker-compose.yml` para que
   todo levante con un comando. Demo local funcionando.

### Fase 2 — Lanzamiento (dashboard + docs)
- Dashboard: historial de conversaciones y detección de preguntas sin respuesta.
- README con GIF de demo, guía de instalación real, docs de configuración.
- Pulir para lanzamiento público (GitHub, Hacker News, r/selfhosted).

### Fase 3 — Tracción (cloud)
- Iterar según feedback real.
- Prototipo de versión cloud: multi-tenant, billing por uso (Stripe), free tier
  simbólico. Lista de espera.

## Antes de publicar el repo

- [x] Reemplazar `LICENSE` con el texto oficial.
- [x] Nombre definitivo elegido: Docsera. Repo/paquetes/contenedores
      renombrados.
- [x] Registrar el dominio: **docsera.dev**, registrado el 2026-07-16 en
      Vercel. Landing desplegada y en producción en https://docsera.dev.

## Estado actual

**Fase 1 completa** (server, esquema de BD, ingesta, adaptadores de LLM,
chat RAG con citas, widget embebible, Docker) — todo probado de extremo a
extremo, no solo compilado.

**Fase 2 cerrada (2026-07-17).** Todo el trabajo de lanzamiento está hecho
y verificado en producción; el único acto pendiente es personal de Mikel:
publicar los posts (Show HN y r/selfhosted, borradores listos en la
conversación del 2026-07-16/17). Lo que se hizo:
- [x] Dashboard (historial de conversaciones + detección de preguntas sin
      respuesta).
- [x] README con guía de instalación real y docs de configuración. Desde el
      2026-07-16, README.md en inglés (audiencia del lanzamiento) y
      README.es.md en español, enlazados entre sí; el dashboard también
      pasó a inglés.
- [x] Pulido de código (rate limiting, umbral de similitud, sitemaps
      índice, dedupe de ingesta) y CI con GitHub Actions (2026-07-16).
- [x] Dominio docsera.dev registrado y landing en producción (2026-07-16).
- [x] GIF de demo en `docs/demo.gif` (regrabado 2026-07-17 con Playwright
      contra la demo pública en vivo): pregunta con citas por sección +
      pregunta fuera de tema con "I don't know".
- [x] Landing lista para lanzamiento (2026-07-17): CTA a la demo en vivo,
      widget embebido funcionando (docsera.dev está en ALLOWED_ORIGINS),
      og:image para previews sociales, enlace a docs. CONTRIBUTING y
      plantillas de GitHub en inglés.
- [x] Release v0.1.0 publicada en GitHub (2026-07-16), con tag y notas:
      https://github.com/mikeljc-dev/docsera/releases/tag/v0.1.0
- [x] Demo pública desplegada (2026-07-16), todo en free tiers: server en
      Railway (deploy automático desde main con Wait for CI; el CMD del
      Dockerfile aplica las migraciones al arrancar — ojo con los "Custom
      Start Command" de Railway, que lo pisan), BD en Neon
      (Postgres+pgvector, branch production/neondb, región eu-west-2), y
      LLM+embeddings en el free tier de Gemini vía OPENAI_BASE_URL
      (modo compatibilidad OpenAI, LLM_MODEL=gemini-flash-lite-latest,
      EMBEDDING_MODEL=gemini-embedding-001 a 1536 dims). README en inglés
      ingerido como contenido inicial.
- [x] Demo completa en vivo (2026-07-17): docs.docsera.dev (Vercel, root
      packages/docs) con el widget funcionando contra api.docsera.dev
      (custom domain en Railway; CNAME + TXT _railway-verify.api en el
      DNS de Vercel — un wildcard * ALIAS de Vercel responde por
      cualquier subdominio sin registro explícito). Contenido ingerido:
      README inglés + https://docs.docsera.dev/. Verificado E2E con
      Playwright contra producción.
- [x] Última pasada pre-lanzamiento (2026-07-17), a partir de feedback de
      revisión externa: tour con Driver.js desde el CTA de la landing,
      FAQ ingerida para preguntas de evaluación, favicon de marca,
      nav móvil, og:image, widget personalizable (data-primary/
      data-position), receta de reindexado desde CI, roadmap Fase 3
      detallado y ARCHITECTURE.md con las decisiones de diseño.

**Fase 3 en marcha:** entregado hasta ahora (2026-07-17/18) — widget v2
(feedback 👍/👎, Markdown con código copiable, data-suggestions,
data-contact), límites anti-abuso en 3 capas (minuto/día-IP/día-global),
ingesta de repos de GitHub (type "github"), analíticas de cobertura en el
dashboard (endpoint /admin/stats + pestaña Analytics) con stats públicas
opcionales (/stats/public, PUBLIC_STATS) mostradas en vivo en la sección
del dashboard de las docs, modo claro/oscuro en landing y docs, y GIF v2.
Quick wins 1-5 y punto 6 de docs/fase-3-ideas.md completos. Release
v0.2.0 publicada el 2026-07-18 con tag y notas:
https://github.com/mikeljc-dev/docsera/releases/tag/v0.2.0
(incluye GIF v3 grabado contra producción con el widget animado).
Regla de trabajo: preguntar a Mikel antes de cada push.

Entregado y **desplegado en producción** (2026-07-18, inspirado en
codebase-memory-mcp; commits 3f16167 / 1312aa7 / d2c189d en `main`,
CI verde):
- [x] **Búsqueda híbrida**: rama full-text de Postgres (columna `tsv`
      generada, config 'simple', `websearch_to_tsquery` + `ts_rank_cd`,
      migración 0005) fusionada con la vectorial por Reciprocal Rank
      Fusion (`fuseRankings` puro en `chat/retrieve.ts`, k=60, 12
      candidatos/rama, top 6). Caza términos exactos (variables, códigos
      de error) donde el embedding flojea; si ninguna rama aporta nada,
      sigue respondiendo "no lo sé" sin llamar al LLM. Nueva firma
      `retrieveRelevantChunks(pool, embedding, query, limit)`. Tests de
      RRF (`chat/retrieve.test.ts`, 47 en total) + E2E local y en prod.
      Migración 0005 aplicada en Neon (la corre el CMD del Dockerfile al
      arrancar).
- [x] **Servidor MCP** en `POST /mcp` (`routes/mcp.ts`, Streamable HTTP,
      stateless, Server de bajo nivel para esquemas JSON Schema y evitar
      el choque zod v3/v4; dep `@modelcontextprotocol/sdk`): tools
      `search_docs` (retrieval puro, sin LLM) y `ask_docs` (RAG con citas,
      mismo `runChat`). Comparte los rate limits de `/chat` (`chatRateLimit`).
      Verificado E2E con Client + StreamableHTTPClientTransport del SDK,
      contra local y contra prod (`https://docseraserver-production.up.railway.app/mcp`).
      Documentado en docs (sección `#mcp-server` + fila API), README/ES,
      ARCHITECTURE y fase-3-ideas (#6b y #12 marcados). Docs re-ingeridas
      en prod: el asistente ya responde sobre MCP citando `#mcp-server`.

Entregado en local, **sin desplegar todavía** (2026-07-19):
- [x] **Skill `docsera-standards`** (`.claude/skills/`): estándares mínimos
      para lo que genere cualquier IA en el repo (convenciones TS/ESM,
      reglas por paquete, puerta de calidad, reglas de producto).
      Commit ebfa489, ya en `main`.
- [x] **Multi-turno con refinado de pregunta** (punto 7 de fase-3-ideas):
      `chat/history.ts` (últimos 3 turnos de la sesión, ventana de 30 min
      porque el sessionId del widget vive para siempre en localStorage) y
      `chat/condense.ts` (reescribe la pregunta a una autocontenida antes
      de embeber; `buildCondenseMessages`/`resolveStandaloneQuestion`
      puros y testeados). `buildChatMessages` acepta los turnos previos y
      los mete como mensajes reales; el system prompt marca el historial
      como no-fuente de hechos. Coste: una llamada extra al LLM solo en
      seguimientos, con degradación a la pregunta original si falla.
      `ask_docs` del MCP usa sessionId aleatorio, así que no paga nada.
      Verificado E2E con Ollama: "Does Docsera support Ollama?" →
      "¿Cómo lo configuro?" responde la config real de Ollama, mientras
      que la misma pregunta en sesión nueva responde genéricamente.
      54 tests en verde (47 antes, +7 de condense/prompt).
      Desplegado y verificado en prod el 2026-07-19 (commit dd7486b).
- [x] **Streaming de respuestas** (punto 9 de fase-3-ideas): `POST
      /chat/stream` por SSE (`routes/chatStream.ts`, `streamSSE` de Hono,
      eventos `delta` + `done` + `error`). Ruta aparte a propósito: `/chat`
      sigue siendo el contrato JSON estable del MCP y de integraciones
      propias. `chatStream` es opcional en `ChatAdapter` e implementado en
      los tres proveedores (`llm/stream.ts` reensambla líneas: SSE en
      OpenAI/Anthropic, NDJSON en Ollama); sin él se cae a `chat()` y se
      emite todo de golpe. `chat/index.ts` se partió en `prepareChat` /
      `finishChat` para que streaming y no-streaming compartan todo salvo
      la generación. El centinela se retiene 32 caracteres
      (`chat/stream.ts`) para que nunca se pinte "NO_ANS…". El widget
      (`sse.ts` + `send()`) rellena la burbuja fragmento a fragmento.
      60 tests en verde. Verificado con Playwright contra el widget real:
      la burbuja crece 0→115→…→1184 caracteres, fuentes y feedback
      llegan con el `done`, y el centinela no se filtra.
      Desplegado y verificado en prod el 2026-07-19 (commit 8b9b4ed).
      Ojo: Gemini manda fragmentos muy grandes (la respuesta entera en
      2 deltas), así que el efecto máquina de escribir apenas se aprecia
      en la demo pública; con Ollama o proveedores de pago sí. Si se
      quiere suavizar, habría que trocear en el cliente.

**Release v0.3.0 publicada el 2026-07-19** con tag y notas:
https://github.com/mikeljc-dev/docsera/releases/tag/v0.3.0
Incluye lo acumulado desde el tag v0.2.0: búsqueda híbrida, servidor MCP,
multi-turno y streaming. Versión subida en los 6 package.json y en los
sitios donde estaba hardcodeada (`ingest/fetchSource.ts` USER_AGENT,
`routes/mcp.ts`, badge y ejemplo de `/health` en las docs) — conviene
recordar que esos tres no leen el package.json y hay que tocarlos a mano
en cada release.

Después de la v0.3.0 (2026-07-19), sin desplegar todavía:
- [x] **`GET /llms.txt`** (`routes/llms.ts`): índice en Markdown según la
      convención de llmstxt.org, **generado desde los documentos indexados**
      (no estático, así no se desincroniza de la doc real). Incluye cómo
      consultarla (MCP y HTTP API, con el origen sacado de la petición) y la
      lista de páginas. Título configurable con `LLMS_TXT_TITLE`.
      `buildLlmsTxt` es pura y tiene tests. Cierra el "pendiente" del punto
      12 de fase-3-ideas.
- [ ] **Señal de confianza (punto 8): implementada y REVERTIDA.** Por
      distancia coseno no funciona — está medido y explicado en
      `docs/fase-3-ideas.md`. No volver a intentarlo por esa vía. La
      alternativa (marcador `PARTIAL` pedido al propio LLM) apunta bien pero
      necesita calibrarse con preguntas reales, no con cuatro ejemplos.

Siguiente (para retomar en otra sesión):
- **Higiene: HECHA el 2026-07-19.** `ADMIN_TOKEN` y key de Gemini rotados
  por Mikel. Regla que deja: no volver a pegar el `ADMIN_TOKEN` en el chat
  para re-ingestas — que las lance él, o por CI con el secreto de GitHub.
  Pendiente aún: instalar codebase-memory-mcp para el flujo de trabajo:
  `curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash`
  (script ya revisado y limpio; sus tools MCP solo aparecerán en la
  PRÓXIMA sesión).
- **Producto (siguientes candidatas del roadmap):** conector PDF (10) o el
  bot de Discord (11) — el análisis competitivo señala Discord como lo que
  más encaja con comunidades open source. La señal de confianza (8) queda
  aparcada con el porqué documentado. Ideas priorizadas y análisis
  de la competencia (Fin, Mintlify, DocsBot, kapa.ai) en
  `docs/fase-3-ideas.md`.
- **Lanzamiento (Mikel):** publicar los posts (Show HN y r/selfhosted,
  borradores listos con "Try it live: https://docs.docsera.dev/?demo=1").
- **Infra:** decidir plan de Railway cuando se agote el crédito del trial
  (Hobby ~5 $/mes o migrar a Cloud Run + Neon con la misma imagen).
- **Nota codebase-memory-mcp:** se instaló como inspiración para dos
  features (híbrida + MCP, ya hechas); la idea original "ambos" incluía
  también usarlo como herramienta de desarrollo — pendiente de instalar.
