<div align="center">

# Docsera

[![CI](https://github.com/mikeljc-dev/docsera/actions/workflows/ci.yml/badge.svg)](https://github.com/mikeljc-dev/docsera/actions/workflows/ci.yml)

**AI chat for your docs. Open source, self-hosted, one line of code.**

Add an intelligent assistant to your documentation with a single `<script>` tag.
Your data never leaves your server. Works with Anthropic, OpenAI or local models.

[docsera.dev](https://docsera.dev) · [Installation](#installation) · [Usage](#usage) · [Configuration](#configuration) · [How it works](#how-it-works) · [Roadmap](#roadmap) · [License](#license)

**English** · [Español](./README.es.md)

</div>

> **Status: v0.1.0.** Server, ingestion, RAG chat with citations, widget,
> dashboard and Docker all work end to end. Young project — feedback and
> issues are very welcome (see [Roadmap](#roadmap)).

---

## Demo

![Docsera widget answering a question with source citations, then saying "I don't know" to an off-topic question](./docs/demo.gif)

*(Real recording of the [live demo](https://docs.docsera.dev/?demo=1): an answer
with per-section citations, and an off-topic question getting an honest
"I don't know" — without even calling the LLM. Try it yourself — the chat
bubble on that page is Docsera running on its own docs.)*

## What is it?

Docsera is an embeddable widget that answers questions about your documentation using AI, **with citations to the sources**. Think of Intercom's support chat — but open source and hosted by you.

- **Installed in under 10 minutes** with Docker Compose.
- **Privacy-first**: self-hosted, your data never leaves your server (except the calls to the LLM provider *you* choose — or none at all with Ollama).
- **LLM-agnostic**: Anthropic, OpenAI, or local models via Ollama — for chat and embeddings, configured independently.
- **Answers with sources**: every answer links to the doc section it came from. Before hallucinating, it says "I don't know."

## How does it compare?

Products like **Intercom Fin, Mintlify's assistant, DocsBot or kapa.ai** solve the same problem as a hosted service: your docs and your users' questions flow through their infrastructure, with the models they manage, for a subscription. Docsera is the open-source, self-hosted take on the same idea:

| | Docsera | Hosted alternatives |
|---|---|---|
| Source code | Open (AGPL-3.0) | Proprietary |
| Where it runs | Your server | Their cloud |
| Where your data lives | Your Postgres | Their infrastructure |
| LLM | Your choice — Anthropic, OpenAI, any OpenAI-compatible API, or fully local via Ollama | Managed by them |
| Cost | Free — your infra plus optional LLM usage | Subscription |

If you want a managed, zero-ops product with support behind it, the hosted options are excellent. If you want control, privacy and no vendor lock-in — that's what Docsera is for.

## How it works

Three pieces in one monorepo, all served by a single deployable service:

| Package | What it does |
|---|---|
| `packages/server` | The API: `POST /chat` (RAG with citations), `POST /ingest` (markdown/URL/sitemap), and serves the widget and dashboard as static assets |
| `packages/widget` | The embeddable web component (the floating chat), bundled into a single `widget.js` |
| `packages/dashboard` | Admin panel to browse conversation history and detect unanswered questions |
| `packages/web` | The [docsera.dev](https://docsera.dev) landing page (not part of the deployable product) |
| `packages/docs` | The docs site for docs.docsera.dev, with the Docsera widget embedded — Docsera answering questions about Docsera |

The `server` is the only service you deploy (besides Postgres): it serves the API, the widget and the dashboard from the same process.

Curious about the design decisions (chunking, retrieval strategy, document invalidation, why one server)? See [ARCHITECTURE.md](./ARCHITECTURE.md).

## Installation

Prerequisites: [Docker](https://docs.docker.com/get-docker/) and Docker Compose (bundled with Docker Desktop). Node ≥ 20 and [pnpm](https://pnpm.io) only if you want to develop locally without Docker.

```bash
git clone https://github.com/mikeljc-dev/docsera.git
cd docsera
cp .env.example .env
```

Edit `.env` and fill in at least:

- `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`, depending on `LLM_PROVIDER`) — the chat provider.
- `OPENAI_API_KEY` — needed for ingestion embeddings even if you use Anthropic or Ollama for chat (Anthropic has no embeddings API). Free alternative: `EMBEDDING_PROVIDER=ollama`.
- `ADMIN_TOKEN` — generate one with `openssl rand -hex 32`. Protects `POST /ingest` and the dashboard.

Bring everything up with one command:

```bash
docker compose up -d --build
```

This starts Postgres+pgvector, applies migrations automatically and runs the server at `http://localhost:3000`. Check it:

```bash
curl http://localhost:3000/health
# {"status":"ok","version":"0.1.0"}
```

## Usage

### 1. Ingest your documentation

```bash
curl -X POST http://localhost:3000/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "type": "sitemap",
    "source": "https://yourdomain.com/sitemap.xml"
  }'
```

`type` can be `"url"` (a single page), `"sitemap"` (every listed page, up to 200; sitemap indexes pointing to other sitemaps work too), `"github"` (every `.md`/`.mdx` of a public repo — `"source": "owner/repo"`, optional `"branch"` and `"path"` folder filter, citations deep-link to GitHub) or `"markdown"` (raw text — handy for CI or content that isn't published as HTML):

```bash
curl -X POST http://localhost:3000/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "type": "markdown",
    "url": "https://yourdomain.com/docs/install",
    "title": "Installation",
    "source": "# Installation\n\n..."
  }'
```

Re-ingesting an unchanged document costs nothing in embeddings (content-hash deduplication).

For `"markdown"`, the `url` is optional but recommended: it's the document's identity (without it, a modified version of the same markdown is ingested as a new document instead of updating the previous one) and it's also the link that answers will cite.

**Keep it in sync from CI:** call `/ingest` from your pipeline on every docs deploy — unchanged pages cost nothing, so it's safe on every merge. See the [ready-made GitHub Actions workflow](https://docs.docsera.dev/#reindex-from-ci) in the docs.

### 2. Add the widget to your site

One line:

```html
<script src="http://localhost:3000/widget.js" data-server="http://localhost:3000"></script>
```

In production, replace `localhost:3000` with the domain where your server is deployed, and add your site's origin to `ALLOWED_ORIGINS` in `.env`.

**Customization.** Everything is configured with `data-*` attributes on the script tag: `data-primary` (your brand color), `data-position` (`right`/`left`), `data-locale` (UI language — ships in English, Spanish, French, German and Portuguese, auto-detected from your page's `<html lang>` or the browser), `data-suggestions` (starter questions as chips, `|`-separated), `data-contact` (link offered when it can't answer), and `data-heading`/`data-placeholder` to override individual strings. Answers render simple Markdown with copyable code blocks, and every answer has 👍/👎 feedback buttons that feed the dashboard. The assistant's no-answer phrase is set server-side with `CHAT_NO_ANSWER_TEXT`:

```html
<script src="https://docs.yourdomain.com/widget.js"
        data-server="https://docs.yourdomain.com"
        data-primary="#4F46E5"
        data-position="left"
        data-locale="es"
        data-heading="¿Dudas? Pregúntame"></script>
```

### 3. Review the history in the dashboard

Open `http://localhost:3000/dashboard`, paste your `ADMIN_TOKEN`, and you'll see the conversation history with a filter to isolate unanswered questions — the most direct signal of what's missing in your documentation.

## Configuration

All variables live in `.env` (template in `.env.example`).

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | — |
| `EMBEDDING_DIMENSIONS` | Vector dimensions; must match your embeddings model | `1536` |
| `LLM_PROVIDER` | Chat provider: `anthropic` \| `openai` \| `ollama` | `anthropic` |
| `LLM_MODEL` | Chat model (optional, each adapter has a sane default) | — |
| `EMBEDDING_PROVIDER` | Embeddings provider: `openai` \| `ollama` (Anthropic has none) | `openai` |
| `EMBEDDING_MODEL` | Embeddings model (optional) | — |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Keys for the providers you use | — |
| `OPENAI_BASE_URL` | Point the `openai` adapter at any OpenAI-compatible API (Gemini compat mode, Groq, Mistral, LM Studio, vLLM…) | OpenAI's API |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` |
| `GITHUB_TOKEN` | Optional token for `type: "github"` ingestion (raises API rate limits) | — |
| `PORT` | Server port | `3000` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins for the widget | `http://localhost:5173` |
| `ADMIN_TOKEN` | Token protecting `POST /ingest` and `GET /admin/*` (dashboard) | — |
| `CHAT_RATE_LIMIT` | Requests per IP per minute to `POST /chat` (public endpoint) | `20` |
| `CHAT_DAILY_LIMIT` | Optional questions-per-IP-per-day cap (`0` disables) — for public demos | `0` |
| `CHAT_GLOBAL_DAILY_LIMIT` | Optional instance-wide daily budget of questions (`0` disables) | `0` |
| `CHAT_MAX_DISTANCE` | Max cosine distance for a chunk to count as relevant; if none pass, the no-answer phrase is returned without calling the LLM. `2` disables the filter | `0.8` |
| `CHAT_NO_ANSWER_TEXT` | Exact phrase when the docs don't have the answer (set it in your users' language, e.g. `No lo sé.`) | `I don't know.` |
| `TRUST_PROXY` | `true` only if a reverse proxy you control sits in front and overwrites `x-forwarded-for`; the rate limiter will use that header as the client IP | `false` |

**About embeddings vs. LLM provider:** they're intentionally independent. You can use Anthropic for chat and OpenAI (or Ollama) just for ingestion embeddings, since Anthropic doesn't offer an embeddings API.

**About `EMBEDDING_DIMENSIONS`:** it's fixed in the Postgres `chunks.embedding` column from the first migration. If you switch embeddings provider/model after ingesting content, you need a new migration that recreates that column, then re-ingest everything.

**Zero-cost with Ollama:** if you prefer zero external API calls and have the hardware, `LLM_PROVIDER=ollama` + `EMBEDDING_PROVIDER=ollama` (with `EMBEDDING_DIMENSIONS=768` for `nomic-embed-text`) works just as well, only locally. It's not the default because it adds install friction (you need Ollama running) that doesn't fit the "installed in <10 minutes" promise for the general case.

## Local development (without Docker)

```bash
pnpm install
pnpm db:up          # Postgres+pgvector only, via Docker
pnpm db:migrate
pnpm dev            # all packages in parallel, in watch mode
```

`pnpm dev` starts the server (`:3000`), the widget test page (`:8000`, esbuild) and the dashboard (`:5173`, Vite proxying to the API). To work on a single package: `pnpm --filter @docsera/server dev` (or `widget` / `dashboard`).

## Roadmap

- [x] **Phase 1 — Core:** server, DB schema, ingestion (markdown/URL/sitemap), LLM adapters (Anthropic/OpenAI/Ollama), RAG chat with citations, embeddable widget, Docker.
- [x] **Phase 2 — Launch:** dashboard, real installation guide (this document), code polish (rate limiting, similarity threshold, sitemap indexes, ingestion dedupe), CI, [landing](https://docsera.dev) and [docs site](https://docs.docsera.dev) with the widget running live on both, customizable widget, demo GIF, v0.1.0 release.
- [ ] **Phase 3 — Traction:** iterate on real feedback. On the radar: answer streaming in the widget · hybrid retrieval (BM25 + embeddings) and re-ranking · 👍/👎 feedback on answers · more ingestion connectors (GitHub repos, Notion, PDF, Docusaurus/VitePress) · richer analytics (top questions, most-cited sources, token usage) · multi-project instances · cloud version prototype (multi-tenant, usage-based billing).

## Stack

TypeScript across the monorepo · pnpm workspaces · [Hono](https://hono.dev) · Postgres + [pgvector](https://github.com/pgvector/pgvector) · [Lit](https://lit.dev) (widget) · [Preact](https://preactjs.com) + Vite (dashboard) · Docker.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) — dev setup, checks to run before a
PR (`typecheck`/`lint`/`test`) and code style.

## License

[AGPL-3.0](./LICENSE). The core is and will always be open source. A managed (paid) cloud version will come later for those who'd rather not run the infrastructure.
