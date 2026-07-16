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

**Fase 2 en marcha:**
- [x] Dashboard (historial de conversaciones + detección de preguntas sin
      respuesta).
- [x] README con guía de instalación real y docs de configuración. Desde el
      2026-07-16, README.md en inglés (audiencia del lanzamiento) y
      README.es.md en español, enlazados entre sí; el dashboard también
      pasó a inglés.
- [x] Pulido de código (rate limiting, umbral de similitud, sitemaps
      índice, dedupe de ingesta) y CI con GitHub Actions (2026-07-16).
- [x] Dominio docsera.dev registrado y landing en producción (2026-07-16).
- [x] GIF de demo en `docs/demo.gif` (2026-07-16): grabado con Playwright
      contra el stack local (Ollama/llama3.2), pregunta con citas por
      sección + pregunta fuera de tema con "I don't know".
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
- [ ] Publicación en Hacker News (Show HN) y r/selfhosted — la hace Mikel
      con los borradores ya preparados (ver conversación del 2026-07-16).

Siguiente: publicar los posts y pasar a Fase 3 (iterar con feedback real,
prototipo cloud).
