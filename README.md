<div align="center">

# AskDocs

**Chat con IA sobre tu documentación. Open source, self-hosted, en una línea.**

Instala un asistente inteligente sobre tus docs con un solo `<script>`.
Tus datos no salen de tu servidor. Funciona con Anthropic, OpenAI o modelos locales.

[Instalación](#instalación) · [Cómo funciona](#cómo-funciona) · [Roadmap](#roadmap) · [Licencia](#licencia)

</div>

> ⚠️ **Estado: en construcción (v0.0.1).** El esqueleto del proyecto está montado; la funcionalidad llega por fases. Aún no es usable.

---

## ¿Qué es?

AskDocs es un widget embebible que responde preguntas sobre tu documentación usando IA, **con citas a las fuentes**. Piensa en el chat de soporte de Intercom, pero open source y que puedes alojar tú mismo.

- **Instalación en < 10 minutos** con Docker Compose.
- **Privacy-first**: en modo self-hosted, los datos nunca salen de tu servidor.
- **Agnóstico de LLM**: Anthropic, OpenAI o modelos locales vía Ollama.
- **Respuestas con fuentes**: cada respuesta enlaza a la sección de donde salió.

## Cómo funciona

Tres piezas dentro de un monorepo:

| Paquete | Qué hace |
|---|---|
| `packages/widget` | El web component embebible (el chat flotante) |
| `packages/server` | La API: chat con RAG, ingesta de docs y administración |
| `packages/dashboard` | Panel para ver conversaciones y preguntas sin respuesta |

## Instalación

> Aún no disponible — se documentará al cerrar la Fase 1 del roadmap.

Requisitos previos: Node ≥ 20, pnpm y Docker.

```bash
# (próximamente)
git clone ...
pnpm install
pnpm db:up        # levanta Postgres + pgvector
pnpm dev
```

## Roadmap

- [ ] **Fase 1 — Núcleo (días 1–30):** RAG funcional + widget + Docker. Demo pública.
- [ ] **Fase 2 — Lanzamiento (días 31–60):** dashboard, docs, README con demo. Lanzamiento público.
- [ ] **Fase 3 — Tracción (días 61–90):** iterar con feedback, lista de espera del cloud.

## Stack

TypeScript en todo el monorepo · pnpm workspaces · Postgres + pgvector · Docker.

## Licencia

[AGPL-3.0](./LICENSE). El núcleo es y será siempre open source. La versión cloud gestionada (de pago) llegará más adelante para quien no quiera mantener la infraestructura.
