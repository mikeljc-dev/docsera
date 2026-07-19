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

**Hybrid retrieval**: two branches run in parallel and are fused. The
vector branch embeds the question and takes the nearest chunks over pgvector
(HNSW, cosine) within a **distance threshold** (`CHAT_MAX_DISTANCE`, default
0.8); the full-text branch runs Postgres FTS (`websearch_to_tsquery` over a
`tsvector` generated column with the `simple` config — no stemming, no
stopwords, language-agnostic) so exact terms like identifiers, env-var names
and error codes are matched verbatim, which is exactly where embeddings are
weakest. The two ranked lists are merged by **Reciprocal Rank Fusion**
(score = Σ 1/(k + rank), k=60) and the top 6 go to the prompt. If *neither*
branch returns anything, the server answers the configured no-answer phrase
**without calling the LLM** — irrelevant questions cost retrieval, not
generation. FTS was chosen over a second embedding model or an external
re-ranker because it adds one generated column and no new dependency or
network call. Cross-encoder re-ranking is still on the roadmap.

## How do follow-up questions work?

Retrieval happens on a **standalone rewrite** of the question, not on the raw
text. "How do I configure it?" embeds to nothing useful, so before retrieving,
the last 3 turns of the session are used to rewrite it into a self-contained
query ("How do I configure Ollama in Docsera?"); the model still receives the
*original* question, with the previous turns as real chat messages, so the
answer reads as a conversation. Facts must still come from the retrieved
context — history is explicitly marked as not a source.

Two deliberate limits. The rewrite costs **one extra LLM call, and only on
follow-ups** — the first question of a session skips it entirely; if that call
fails, retrieval degrades to the raw question instead of failing the request.
And history expires after **30 minutes**: the widget keeps its session id in
`localStorage` forever, so without a window a question today would be rewritten
against a visit from last week.

## How does streaming work?

The widget talks to `POST /chat/stream`, which answers Server-Sent Events:
`delta` events carrying text as the model produces it, then a single `done`
event with the sources, `conversationId` and `answered` flag. Sources arrive
at the end on purpose — until the answer is complete we don't know whether it
is a non-answer, and citing sources for a non-answer misleads.

It's a **separate route, not content negotiation on `/chat`**: `/chat` stays
the stable JSON contract used by the MCP server and any custom integration.
Streaming is an optional capability of the adapter (`chatStream`) — a provider
that doesn't implement it still works, its full answer is emitted as a single
delta.

The subtle part is the **no-answer sentinel**. It arrives in pieces like any
other text, so emitting the first delta blindly would paint `NO_ANS…` in the
bubble before we could take it back. The first 32 characters are held — more
than the sentinel needs even when a small model decorates it (`**NO_ANSWER**`)
— and only then does text start flowing; past that threshold the answer can no
longer *be* the sentinel, so the rest streams unbuffered.

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

The public surface is `/chat`, `/feedback`, `/mcp` and (opt-in, aggregates
only) `/stats/public`: CORS restricted to `ALLOWED_ORIGINS`, per-IP rate limiting
(in-memory token bucket — per instance, which is why the deployment docs
cap instances) plus optional per-IP-daily and instance-daily question caps
for public demos, and internal errors are logged server-side but never
returned to the client. `x-forwarded-for` is only
trusted behind a proxy you control (`TRUST_PROXY`). Admin endpoints
(`/ingest`, `/admin/*`) require a bearer token compared in constant time.

## What's deliberately left out (for now)?

Answer streaming, cross-encoder re-ranking, multi-turn conversations,
multi-project instances and connectors beyond sitemap/URL/Markdown/GitHub.
See the [roadmap](./README.md#roadmap) — each is planned; the project
optimizes for a complete, verifiable end-to-end product over feature
breadth. (Answer feedback, coverage analytics, GitHub repo ingestion,
hybrid retrieval and the MCP server started on that list and have since
shipped.)

## Why an MCP server?

The same retrieval pipeline that powers the widget is exposed over the
[Model Context Protocol](https://modelcontextprotocol.io) at `POST /mcp`, so
AI coding agents can query your docs while they work. It's a thin adapter
over existing internals — `search_docs` calls `retrieveRelevantChunks`
directly (no LLM, cheap) and `ask_docs` calls the same `runChat` as the
widget. The transport is Streamable HTTP in **stateless** mode (a fresh
`Server`+transport per request, `sessionIdGenerator: undefined`): no
per-client state fits the ephemeral, possibly multi-instance deployment and
means the MCP endpoint inherits the exact same rate limits as `/chat`. The
low-level `Server` (not `McpServer`) is used so tool schemas are declared as
plain JSON Schema, sidestepping a Zod v3/v4 clash between the SDK's bundled
Zod and ours.
