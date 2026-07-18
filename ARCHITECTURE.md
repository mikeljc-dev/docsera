# Architecture

Design decisions behind Docsera, and the reasoning for each. Structured as
the questions a reviewer would actually ask.

## Why do the widget, dashboard and API ship in one server?

Deployment simplicity is the product's core promise ("installed in under 10
minutes"), and every extra service multiplies the ways a self-hosted install
can go wrong. The Hono server serves the API and also the widget bundle and
dashboard build as static assets, so the whole product is **one container +
Postgres**. The pieces are still separate packages in the monorepo
(`widget`, `dashboard`, `server`, plus the `web`/`docs` sites that are not
part of the deployable product), so they can be split later without
untangling code — the coupling is only at the packaging level.

## How are documents chunked?

Extraction (from HTML or Markdown) produces a flat list of blocks: headings
(with their anchor) and text. Chunking groups text under the heading it
belongs to, and splits sections that exceed ~1500 characters. Every chunk
carries the anchor of its section, which is what makes citations deep-link
to the exact part of a page (`/docs#configuration`) rather than just the
page. Heading anchors are taken from the element's `id` when present, or
generated with the same slugify used everywhere, so cited anchors always
resolve.

## What's the retrieval strategy?

Plain cosine similarity over pgvector with an HNSW index: the question is
embedded, the top 6 chunks within a **distance threshold**
(`CHAT_MAX_DISTANCE`, default 0.8) are retrieved, and if none qualify the
server answers the configured no-answer phrase **without calling the LLM** —
irrelevant questions cost retrieval, not generation. Hybrid retrieval
(BM25 + embeddings) and re-ranking are on the roadmap; they're deliberately
not in yet because plain vector search with a threshold covers the core
use case well and keeps the mental model simple.

## How does the "I don't know" detection work?

The system prompt instructs the model to reply with a stable ASCII sentinel
(`NO_ANSWER`) when the context is insufficient. The server detects the
sentinel and replaces it with the configurable, localized phrase
(`CHAT_NO_ANSWER_TEXT`). We first tried instructing the exact localized
phrase, but small models paraphrase ("No sé" instead of "No lo sé") and
break detection — a sentinel is robust across models and languages.
Unanswered questions are stored flagged, which is what feeds the
dashboard's "unanswered" filter.

## What happens when documents change?

A document's identity is its URL. On ingest, the raw content is hashed
(SHA-256): same hash → `unchanged`, nothing is re-embedded (re-ingesting on
every CI deploy is free); different hash → the document's chunks are
replaced atomically in a transaction and re-embedded. Markdown without a
URL has no stable identity, so it only gets exact-hash dedupe — the docs
recommend always passing a `url`.

## How are sources ordered and deduplicated?

Sources inherit retrieval order (closest chunk first), deduplicated by
`url#anchor`. The widget labels each source with its section
("Docsera Docs § configuration") because several chunks of the same
document would otherwise render as identical links. When the model answers
the no-answer sentinel, sources are suppressed entirely — citing sources
for a non-answer misleads.

## Why is the LLM behind an adapter?

The LLM is a provider, not the application. A minimal `ChatAdapter` /
`EmbeddingsAdapter` interface has implementations for Anthropic, OpenAI and
Ollama, selected by env var — and the OpenAI adapter accepts a custom
`OPENAI_BASE_URL`, which covers every OpenAI-compatible API (Gemini's
compatibility mode, Groq, Mistral, LM Studio, vLLM…) with zero extra code.
Chat and embeddings are configured independently because they're different
markets: Anthropic has no embeddings API, and embedding models are where
local (Ollama) is most practical.

## How are the public endpoints protected?

The public surface is `/chat`, `/feedback` and (opt-in, aggregates only)
`/stats/public`: CORS restricted to `ALLOWED_ORIGINS`, per-IP rate limiting
(in-memory token bucket — per instance, which is why the deployment docs
cap instances) plus optional per-IP-daily and instance-daily question caps
for public demos, and internal errors are logged server-side but never
returned to the client. `x-forwarded-for` is only
trusted behind a proxy you control (`TRUST_PROXY`). Admin endpoints
(`/ingest`, `/admin/*`) require a bearer token compared in constant time.

## What's deliberately left out (for now)?

Answer streaming, hybrid search + re-ranking, multi-turn conversations,
multi-project instances and connectors beyond sitemap/URL/Markdown/GitHub.
See the [roadmap](./README.md#roadmap) — each is planned; the project
optimizes for a complete, verifiable end-to-end product over feature
breadth. (Answer feedback, coverage analytics and GitHub repo ingestion
started on that list and have since shipped.)
