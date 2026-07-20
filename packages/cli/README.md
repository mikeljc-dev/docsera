# docsera

**AI chat for your docs — open source, self-hosted, installed with one command.**

[docsera.dev](https://docsera.dev) · [Documentation](https://docs.docsera.dev) · [Live demo](https://docs.docsera.dev/?demo=1) · [GitHub](https://github.com/mikeljc-dev/docsera)

This package is the installer and launcher for [Docsera](https://docsera.dev), an embeddable widget that answers questions about your documentation using AI, **with citations to the sources**. Think of Intercom's support chat — but open source (AGPL-3.0) and hosted by you: your docs, your users' questions and your Postgres never leave your server.

## Quick start

Requirements: [Docker](https://docs.docker.com/get-docker/) (Compose is bundled with it) and Node ≥ 20.

```bash
npx docsera
```

A short wizard asks three things:

1. **Which LLM answers** — Anthropic, OpenAI (or any compatible API: Gemini, Groq, Mistral, LM Studio…), or [Ollama](https://ollama.com). A locally running Ollama is auto-detected and offered as the default, which makes the whole stack **free and 100% local**, with zero external API calls.
2. **Which docs to index** — a URL, a `sitemap.xml`, a PDF or a GitHub `owner/repo`.
3. **Where the widget will live** — your site's origin, for CORS.

Everything else is done for you:

- Generates a `.env` with your keys and freshly minted secrets, and a `docker-compose.yml` that uses the prebuilt image from `ghcr.io/mikeljc-dev/docsera` — no cloning, no compiling.
- Starts Postgres (with pgvector) and the Docsera server, and applies migrations automatically.
- Runs the first ingestion of the docs you pointed it at.
- Prints the one-line `<script>` snippet ready to paste into your site, plus your dashboard URL.

If port 3000 is taken, the next free one is picked automatically. In an empty folder the files are written right there; anywhere else they go into `./docsera`.

## Day-to-day commands

| Command | What it does |
|---|---|
| `npx docsera` | First run: wizard + launch. Later runs: just launch. |
| `npx docsera ingest [source]` | Re-index your docs, or index a new source (URL, `sitemap.xml`, PDF or `owner/repo`). Unchanged pages cost nothing — content-hash dedupe. |
| `npx docsera up` | Start the stack again, e.g. after a reboot. |
| `npx docsera down` | Stop everything. Your data stays in `pgdata/`. |

## Changing the configuration

The generated `.env` is plain Docsera configuration — every variable is documented in the [configuration reference](https://docs.docsera.dev/#configuration). Edit it and run `npx docsera up` again. There's no lock-in in the CLI: the files it writes are a standard Docker Compose setup you can manage by hand whenever you outgrow it.

## Scripted installs

The wizard reads answers from stdin, so it works in CI or provisioning scripts:

```bash
printf '3\nllama3.1\nhttps://yourdomain.com/sitemap.xml\nhttps://yourdomain.com\n' | npx docsera
```

## Why Docsera?

- **Answers with sources**: every answer deep-links to the doc section it came from. When the docs don't contain the answer, it says "I don't know" instead of hallucinating — without even calling the LLM.
- **Privacy-first**: self-hosted; no telemetry, no third-party services in between.
- **LLM-agnostic**: chat and embeddings providers are configured independently, so you can mix them.
- **Batteries included**: hybrid retrieval (pgvector + full-text with rank fusion), streaming answers, a dashboard with coverage analytics and unanswered questions, an [MCP server](https://docs.docsera.dev/#mcp-server) so AI coding agents can query your docs, and `llms.txt`.

This package contains only the installer; the product lives in the [main repository](https://github.com/mikeljc-dev/docsera). Zero runtime dependencies — it's Node's own readline, crypto and fetch.

## License

[AGPL-3.0-only](https://github.com/mikeljc-dev/docsera/blob/main/LICENSE)
