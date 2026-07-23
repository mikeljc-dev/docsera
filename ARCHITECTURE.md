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

## How does the PDF connector work?

PDF extraction uses [unpdf](https://github.com/unjs/unpdf), a serverless-friendly
wrapper over pdf.js (the same engine Firefox and Chrome use to render PDFs
in the browser) — it needs no worker process and no native dependencies
outside Node, unlike using `pdfjs-dist` directly. There's no OCR: only the
text layer already embedded in the PDF is extracted, so a scanned page with
no selectable text yields nothing for that page (silently skipped, not an
error — a PDF that mixes real and scanned pages still gets indexed
partially).

A PDF has no heading structure to derive citation anchors from, but pages
are a citation unit everyone already understands, and `#page=N` is the
fragment syntax browsers and PDF viewers use to jump straight to a page —
so each non-empty page becomes its own section (one heading block per page,
reusing the same `chunkBlocks` pipeline as HTML/Markdown), and a citation
looks like `whitepaper.pdf#page=3`. The document title comes from the PDF's
own `/Title` metadata when present, falling back to the URL like every
other source type.

Fetching enforces a 20 MB cap (checked against `Content-Length` first, then
against the actual bytes downloaded, since the header can be missing or
wrong) — parsing a PDF is far more CPU/memory-intensive than handling text,
so an unbounded fetch is a real cost in a way `"url"`/`"sitemap"` ingestion
isn't.

## Why is secret redaction opt-in per ingestion, not a global setting?

`redactSecrets: true` on an `/ingest` call masks known API keys, tokens,
private keys and card numbers (Luhn-validated, matched against real card
network prefixes) in the extracted chunks *before* they're embedded and
stored, so a leaked value never reaches Postgres or the LLM. It deliberately
does **not** touch emails or phone numbers — those are frequently
*intentional* content (a support contact), and masking them would make the
assistant worse, not more private.

The harder design question was where the flag lives. A global env var
(`PII_MASKING=true` for the whole instance) was the first draft, and it's
wrong: the same masking that protects an internal wiki someone hasn't fully
reviewed would silently corrupt a payments-integration tutorial that shows
a real, intentionally-public test card — Stripe's `4242 4242 4242 4242`
passes Luhn and the Visa prefix check exactly like a real card, because
it's designed to. There's no regex-level way to tell "leaked real secret"
from "official test value published on purpose," and a per-instance toggle
would apply the same answer to both. Making it a parameter *on the ingest
request itself* moves the decision to the only place that actually has the
context to make it: whoever is ingesting that specific document knows
whether its content is trusted.

The response reports a `redactions` count per document (present only when
the flag was used), so it's never a silent no-op — if nothing matched, you
see `0`, not an absent field pretending the check never ran.

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
network call. Optional cross-encoder re-ranking (`RERANKER_ENABLED`) can
reorder the fused candidates before the final cut — see below for why it
runs on WASM instead of a native runtime.

## Why does the re-ranker run on WASM instead of a native ONNX runtime?

`RERANKER_ENABLED=true` reorders the RRF-fused candidates with a small
cross-encoder (`Xenova/ms-marco-MiniLM-L-6-v2`, 6 layers, int8-quantized,
~23 MB) before the final cut to `TOP_K`: unlike the bi-encoder embedding
used for vector search, a cross-encoder scores the *actual pair*
(question, chunk) jointly, so it can promote a chunk RRF ranked lower —
at the cost of one inference call per candidate, which is why it's opt-in
and only reorders a bounded pool (`RERANK_POOL`), not every chunk in the
database.

The obvious choice, `onnxruntime-node` (native bindings), doesn't work on
the server's own base image: Alpine uses musl libc, and
`onnxruntime-node`'s prebuilt binaries need glibc — a gap open in
[microsoft/onnxruntime#9483](https://github.com/microsoft/onnxruntime/issues/9483)
since 2021, confirmed directly (`docker run node:20-alpine` +
`require("onnxruntime-node")` throws `ERR_DLOPEN_FAILED`, missing
`ld-linux*.so`). Switching the base image to a glibc one (`node:20-slim`)
would work, but measured concretely it very nearly doubles the image
(+121 MB base image, +259 MB for the native package, vs. the current
~470 MB total) — a lot to pay across *every* deployment for a feature
most won't enable, and a change to the one image the whole project ships
from. `onnxruntime-web`'s WASM backend has no native bindings, so it
loads fine on the existing Alpine image, at a fixed ~132 MB dependency
cost regardless of whether `RERANKER_ENABLED` is ever turned on, and some
inference latency vs. native (WASM, no GPU, no SIMD guarantees) — a trade
made deliberately for a feature whose value is still unproven with real
traffic (see the roadmap). Measured directly, reranking a pool of 12
candidates adds roughly 600-700ms on top of a ~3s baseline request
(local Ollama on CPU, so the LLM call itself dominates) — noticeable but
not prohibitive; a hosted LLM provider would make the relative overhead
smaller still.

The model and tokenizer files themselves are **not** baked into the
image: they're downloaded once, lazily, on first use, into the OS temp
directory — the same "pull a model file once" pattern as `ollama pull`,
which keeps the image size unchanged for the majority who never enable
this. A download failure (offline build environment, Hugging Face
unreachable) doesn't fail the request: retrieval falls back to the plain
RRF order and logs the error, exactly like a condense-question LLM call
failing falls back to the original question.

`@huggingface/tokenizers`'s `Tokenizer` class builds its normalizer,
pre-tokenizer, post-processor and decoder internally from the `type`
field of each section — so the model's `tokenizer.json` is passed through
close to as-is, rather than needing every piece
(`WordPiece`/`BertNormalizer`/`BertPreTokenizer`/...) instantiated by
hand. `@huggingface/tokenizers` was picked over rolling WordPiece
tokenization by hand specifically because it *doesn't* pull in
`onnxruntime-node` transitively (unlike the higher-level
`@huggingface/transformers`, which does, and crashes for the same reason
on Alpine even if you only intend to use its WASM backend — confirmed the
same way, by actually running it in a container).

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

### Why does the widget restore the conversation after a reload?

The widget is a web component that gets re-mounted from scratch on every page
load, so refreshing — or clicking a link to another page of the same site —
used to wipe the visible conversation even though the server still remembered
it (the same 30-minute window above). That mismatch was confusing: the
assistant would clearly reference earlier context on a follow-up, but the
transcript on screen showed nothing before it.

`GET /chat/history?sessionId=` fixes this by hydrating `messages` from the
server on mount, using the **exact same window and turn limit** as the
rewrite above (`HISTORY_TURNS`/`HISTORY_MAX_AGE_MINUTES`, exported from
`chat/history.ts` for this reason) — what's shown and what the model actually
remembers can't drift apart. Deliberately server-side rather than duplicating
the transcript in `localStorage`: the conversation is already persisted in
Postgres for the operator's dashboard, so this reads it back instead of
keeping a second copy that could disagree with it (and that two open tabs of
the same site could clobber). It also means a feedback vote already cast
comes back correctly reflected, at no extra cost. The session id itself is
an unguessable random UUID, so the endpoint only ever returns your own
conversation, not anyone else's; malformed and empty/unknown session ids get
the same shaped response, so the endpoint can't be used to probe which ids
are real.

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

## Why are the Discord and Slack bots HTTP endpoints, not gateway/socket bots?

The `/ask` command lives at `POST /discord/interactions` — Discord's HTTP
interactions model — instead of a `discord.js` gateway bot with a persistent
WebSocket. Three reasons. It keeps the **one container** promise: no second
process to run, supervise or document, and it works on platforms that only
speak request/response. It needs **zero new dependencies**: the Ed25519
signature check Discord requires ships in `node:crypto` (the only subtlety
is wrapping Discord's raw 32-byte key in a DER/SPKI header), and command
registration and answer delivery are plain `fetch` calls. And it's
**stateless**, like the MCP endpoint — nothing per-guild or per-connection
to lose on restart.

The trade-off is scope: slash commands only, no listening to mentions or
auto-threading (those need the gateway). For "let my community query the
docs", the slash command is the product; the gateway can come later without
touching this design. Because every interaction arrives from Discord's own
IPs, the `/chat` rate-limit layers are reused with the **Discord user id**
as the key instead of the IP — same buckets, same env knobs. Answers are
delivered by editing the deferred message through the interaction's webhook
token, so the bot token is used only once at boot to register the command.

The Slack bot (`POST /slack/commands`) follows the exact same shape, and
turns out even simpler: Slack has no command-registration API at all —
whoever creates the Slack app names the slash command themselves in its
dashboard, so the endpoint doesn't hardcode a command name — and its
delivery mechanism (`response_url`, a single-use webhook Slack hands back
in every request) needs no bot token whatsoever, unlike Discord's
interaction webhook, which at least requires the token to *register* the
command once. Signing differs too: Slack signs with HMAC-SHA256 over a
shared secret (`v0:{timestamp}:{body}`) instead of Discord's Ed25519, and
Slack's own docs call for rejecting requests with a timestamp more than 5
minutes old as replay protection — a check Discord's scheme doesn't need
since the timestamp is itself part of what's signed and Discord doesn't
document a staleness requirement. Same rate-limit reuse (Slack user id as
the key), same "endpoint doesn't exist without its secret configured"
default.

## How does the one-command install work?

`npx docsera` (the `packages/cli` package, published to npm as `docsera`)
exists because the real installation friction was never `docker compose up`
— it was everything around it: cloning a monorepo just to build an image,
hand-editing a 90-line `.env`, generating tokens, crafting the first
`/ingest` curl. The CLI moves all of that into a short wizard and generates
three files: a `.env` with freshly minted secrets, a `docker-compose.yml`
that pulls the **prebuilt multi-arch image** from `ghcr.io/mikeljc-dev/docsera`
(published by CI on every release tag), and a `docsera.json` with the CLI's
own state (the chosen docs source, whether the first ingestion ran).

Deliberate choices: the CLI has **zero runtime dependencies** (Node's
readline, crypto and fetch are enough), so `npx` starts fast and there's no
supply-chain surface to audit. All server configuration stays in `.env` —
the CLI writes it but the server contract doesn't change, so graduating
from the CLI to hand-managed compose is just… editing the same files. The
admin token is generated on the user's machine and never leaves it (the
first ingestion is a localhost call). And the generated compose keeps
Postgres unexposed to the host, which the repo's own developer compose
can't do (local `pnpm dev` needs the port).

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
